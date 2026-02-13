import { getWeaviateClient } from './weaviate.client.js';
import { COLLECTION_NAME } from '../config/weaviate.config.js';
import { dataType, vectorizer } from 'weaviate-client';

export async function createSchema(): Promise<void> {
  const client = await getWeaviateClient();

  try {
    const exists = await client.collections.exists(COLLECTION_NAME);
    
    if (exists) {
      console.log(`⚠️  Collection '${COLLECTION_NAME}' already exists. Deleting and recreating...`);
      await client.collections.delete(COLLECTION_NAME);
    }

    await client.collections.create({
      name: COLLECTION_NAME,
      properties: [
        {
          name: 'fileId',
          dataType: dataType.TEXT,
          skipVectorization: true,
          indexSearchable: false,
          indexFilterable: true,
        },
        {
          name: 'question',
          dataType: dataType.TEXT,
        },
        {
          name: 'answer',
          dataType: dataType.TEXT,
        },
        {
          name: 'pageNumber',
          dataType: dataType.TEXT_ARRAY,
          skipVectorization: true,
        },
      ],
      multiTenancy: {
        enabled: true,
      },
      vectorizers: vectorizer.text2VecPalm({
        projectId: 'google-ai-studio',
        apiEndpoint: 'generativelanguage.googleapis.com',
        modelId: 'text-embedding-004',
      }),
    });

    console.log(`✅ Schema created with Gemini embedding model`);
    console.log('   - Vectorizer: text-embedding-004 (Gemini)');
    console.log('   - fileId: text (not vectorized)');
    console.log('   - question: text (vectorized)');
    console.log('   - answer: text (vectorized)');
    console.log('   - pageNumber: text[] (not vectorized)');
    console.log('   - Multi-tenancy: enabled');
  } catch (error) {
    console.error('❌ Error creating schema:', error);
    throw error;
  }
}
