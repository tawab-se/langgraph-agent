import { PDFParse } from 'pdf-parse';

export interface PDFChunk {
  fileId: string;
  question: string;
  answer: string;
  pageNumber: string[];
}

export interface PDFParseResult {
  filename: string;
  totalPages: number;
  chunks: PDFChunk[];
}

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const MIN_PAGE_LENGTH = 50;

export async function parsePDF(buffer: Buffer, filename: string): Promise<PDFParseResult> {
  const pdf = new PDFParse({ data: new Uint8Array(buffer) });
  const textResult = await pdf.getText();

  const chunks: PDFChunk[] = [];

  for (const page of textResult.pages) {
    const pageText = cleanText(page.text);

    if (pageText.length < MIN_PAGE_LENGTH) continue;

    const textChunks = chunkText(pageText);

    for (const chunk of textChunks) {
      chunks.push({
        fileId: filename,
        question: `Content from ${filename}, page ${page.num}`,
        answer: chunk,
        pageNumber: [String(page.num)],
      });
    }
  }

  await pdf.destroy();

  return { filename, totalPages: textResult.total, chunks };
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chunkText(text: string, maxSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (text.length <= maxSize) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 <= maxSize) {
      current = current ? current + ' ' + sentence : sentence;
    } else {
      if (current) {
        chunks.push(current);
        // Start new chunk with overlap from end of previous
        const overlapText = current.slice(-overlap);
        const overlapStart = overlapText.indexOf(' ');
        current = overlapStart > 0
          ? overlapText.slice(overlapStart + 1) + ' ' + sentence
          : sentence;
      } else {
        // Single sentence longer than maxSize — split at word boundary
        let remaining = sentence;
        while (remaining.length > maxSize) {
          const splitAt = remaining.lastIndexOf(' ', maxSize);
          const breakPoint = splitAt > 0 ? splitAt : maxSize;
          chunks.push(remaining.slice(0, breakPoint));
          remaining = remaining.slice(breakPoint).trimStart();
        }
        current = remaining;
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}