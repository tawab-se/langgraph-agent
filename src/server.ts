import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';
import { DelegatingAgent } from './agents/delegating.agent.js';
import { closeWeaviateClient } from './database/weaviate.client.js';
import { parsePDF } from './services/pdf.parser.js';
import { uploadChunksToWeaviate } from './services/weaviate.uploader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000');

app.use(express.json());

// Serve frontend
app.use(express.static(join(__dirname, '../public')));

// CORS
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') return res.status(204).end();
  next();
});

const agent = new DelegatingAgent();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// PDF upload endpoint
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file provided' });
  }

  try {
    const { filename, totalPages, chunks } = await parsePDF(
      req.file.buffer,
      req.file.originalname
    );

    if (chunks.length === 0) {
      return res.status(422).json({
        error: 'Could not extract text from PDF. The file may contain only images.',
      });
    }

    const insertedCount = await uploadChunksToWeaviate(chunks);

    console.log(`Uploaded "${filename}": ${totalPages} pages, ${insertedCount} chunks`);

    return res.json({
      success: true,
      filename,
      totalPages,
      chunksCreated: insertedCount,
      message: `Successfully processed "${filename}": ${totalPages} pages, ${insertedCount} chunks indexed`,
    });
  } catch (error) {
    console.error('PDF upload error:', error);
    return res.status(500).json({
      error: 'Failed to process PDF',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// SSE streaming chat endpoint
app.post('/api/chat/stream', async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    for await (const event of agent.processQueryStream(query)) {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    }
  } catch (error) {
    console.error('Stream error:', error);
    res.write(`event: error\ndata: ${JSON.stringify(error instanceof Error ? error.message : 'Unknown error')}\n\n`);
  }

  res.end();
});

// Main chat endpoint (non-streaming, kept for API consumers)
app.post('/api/chat', async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const result = await agent.processQuerySync(query);
    return res.json(result);
  } catch (error) {
    console.error('Error processing query:', error);
    return res.status(500).json({
      error: 'Failed to process query',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Multer error handler
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 20 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message === 'Only PDF files are allowed') {
    return res.status(415).json({ error: err.message });
  }
  next(err);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await closeWeaviateClient();
  process.exit(0);
});