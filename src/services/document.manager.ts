import { getWeaviateClient } from '../database/weaviate.client.js';
import { COLLECTION_NAME } from '../config/weaviate.config.js';

const TENANT_NAME = 'default_tenant';

// Seed/sample data fileIds — anything else is a user-uploaded document.
const SEED_FILE_IDS = new Set(['file-001', 'file-002', 'file-003', 'file-004']);

export interface DocumentInfo {
  fileId: string;
  chunkCount: number;
  pages: string[];
}

/**
 * Returns the list of user-uploaded document fileIds currently in the knowledge
 * base (excluding the built-in seed/sample data). Used by the router so that
 * questions are sent to RAG when the user has uploaded a document, even if the
 * question phrasing sounds like general knowledge.
 */
export async function getUploadedFileIds(): Promise<string[]> {
  const docs = await listDocuments();
  return docs
    .map(d => d.fileId)
    .filter(fileId => !SEED_FILE_IDS.has(fileId));
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAME);
  const tenantCollection = collection.withTenant(TENANT_NAME);

  const docMap = new Map<string, { chunkCount: number; pages: Set<string> }>();

  for await (const obj of tenantCollection.iterator()) {
    const props = obj.properties as any;
    const fileId = props.fileId as string;
    const pageNumbers = (props.pageNumber as string[]) || [];

    if (!docMap.has(fileId)) {
      docMap.set(fileId, { chunkCount: 0, pages: new Set() });
    }

    const entry = docMap.get(fileId)!;
    entry.chunkCount++;
    for (const p of pageNumbers) {
      entry.pages.add(p);
    }
  }

  return Array.from(docMap.entries())
    .map(([fileId, info]) => ({
      fileId,
      chunkCount: info.chunkCount,
      pages: Array.from(info.pages).sort((a, b) => Number(a) - Number(b)),
    }))
    .sort((a, b) => a.fileId.localeCompare(b.fileId));
}

export async function deleteDocument(fileId: string): Promise<number> {
  const client = await getWeaviateClient();
  const collection = client.collections.get(COLLECTION_NAME);
  const tenantCollection = collection.withTenant(TENANT_NAME);

  const result = await tenantCollection.data.deleteMany(
    collection.filter.byProperty('fileId').equal(fileId)
  );

  return result.successful;
}