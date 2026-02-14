import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

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
  const pageTexts: Map<number, string> = new Map();

  const result = await pdfParse(buffer, {
    pagerender(pageData: any) {
      return pageData.getTextContent().then((textContent: any) => {
        const text = textContent.items.map((item: any) => item.str).join(' ');
        pageTexts.set(pageData.pageIndex + 1, text);
        return text;
      });
    },
  });

  const totalPages = result.numpages;
  const chunks: PDFChunk[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const rawText = pageTexts.get(pageNum) || '';
    const pageText = cleanText(rawText);

    if (pageText.length < MIN_PAGE_LENGTH) continue;

    const textChunks = chunkText(pageText);

    for (const chunk of textChunks) {
      chunks.push({
        fileId: filename,
        question: `Content from ${filename}, page ${pageNum}`,
        answer: chunk,
        pageNumber: [String(pageNum)],
      });
    }
  }

  return { filename, totalPages, chunks };
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
        const overlapText = current.slice(-overlap);
        const overlapStart = overlapText.indexOf(' ');
        current = overlapStart > 0
          ? overlapText.slice(overlapStart + 1) + ' ' + sentence
          : sentence;
      } else {
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