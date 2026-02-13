import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DelegatingAgent } from './agents/delegating.agent.js';
import { closeWeaviateClient } from './database/weaviate.client.js';

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

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Main chat endpoint
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await closeWeaviateClient();
  process.exit(0);
});
