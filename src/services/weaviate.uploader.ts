import { getWeaviateClient } from '../database/weaviate.client.js';
import { COLLECTION_NAME } from '../config/weaviate.config.js';
import { PDFChunk } from './pdf.parser.js';

const TENANT_NAME = 'default_tenant';

export async function uploadChunksToWeaviate(chunks: PDFChunk[]): Promise<number> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAME);
  const tenantCollection = collection.withTenant(TENANT_NAME);

  let inserted = 0;

  for (const chunk of chunks) {
    await tenantCollection.data.insert({
      properties: {
        fileId: chunk.fileId,
        question: chunk.question,
        answer: chunk.answer,
        pageNumber: chunk.pageNumber,
      },
    });
    inserted++;
  }

  return inserted;
}