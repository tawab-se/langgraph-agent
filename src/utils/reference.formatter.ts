import { RAGReference } from '../agents/types.js';

/**
 * Format file references with display IDs
 * Groups pages by fileId and assigns display numbers (1, 2, 3...)
 */
export function formatReferences(references: RAGReference[]): string {
  if (references.length === 0) {
    return '';
  }

  const formatted = references.map(ref => {
    if (ref.pages.length === 1) {
      return `[${ref.displayId}] File ${ref.fileId} - Page ${ref.pages[0]}`;
    } else {
      return `[${ref.displayId}] File ${ref.fileId} - Pages ${ref.pages.join(', ')}`;
    }
  });

  return '\n\nReferences:\n' + formatted.join('\n');
}

/**
 * Group references by fileId and assign display IDs
 */
export function groupReferencesByFile(
  results: Array<{ fileId: string; pageNumber: string[]; answer: string }>
): RAGReference[] {
  const fileMap = new Map<string, RAGReference>();

  results.forEach(result => {
    if (fileMap.has(result.fileId)) {
      const existing = fileMap.get(result.fileId)!;
      // Add unique pages
      result.pageNumber.forEach(page => {
        if (!existing.pages.includes(page)) {
          existing.pages.push(page);
        }
      });
      // Append content
      if (result.answer && !existing.content?.includes(result.answer)) {
        existing.content = (existing.content || '') + '\n' + result.answer;
      }
    } else {
      fileMap.set(result.fileId, {
        type: 'rag',
        fileId: result.fileId,
        displayId: '', // Will be assigned below
        pages: [...result.pageNumber],
        content: result.answer,
      });
    }
  });

  // Assign display IDs (1, 2, 3...)
  const references = Array.from(fileMap.values());
  references.forEach((ref, index) => {
    ref.displayId = String(index + 1);
  });

  return references;
}

/**
 * Create a citation in the answer text
 */
export function createCitation(displayId: string, page: string): string {
  return `[${displayId}-Page ${page}]`;
}
