import weaviate, { WeaviateClient } from 'weaviate-client';
import { WEAVIATE_URL, WEAVIATE_API_KEY } from '../config/weaviate.config.js';

let client: WeaviateClient | null = null;

export async function getWeaviateClient(): Promise<WeaviateClient> {
  if (client) {
    return client;
  }

  try {
    if (WEAVIATE_API_KEY) {
      // Cloud connection (Weaviate Cloud — used on Vercel / production)
      client = await weaviate.connectToWeaviateCloud(WEAVIATE_URL, {
        authCredentials: new weaviate.ApiKey(WEAVIATE_API_KEY),
        headers: {
          'X-Palm-Api-Key': process.env.GEMINI_API_KEY || '',
        },
      });
      console.log('✅ Connected to Weaviate Cloud');
    } else {
      // Local connection (Docker — used in development)
      const url = new URL(WEAVIATE_URL);
      const host = url.hostname;
      const port = url.port || '8080';

      client = await weaviate.connectToLocal({
        host: host,
        port: parseInt(port),
        grpcPort: 50051,
      });
      console.log(`✅ Connected to Weaviate at ${host}:${port}`);
    }

    return client;
  } catch (error) {
    console.error('❌ Failed to connect to Weaviate:', error);
    throw new Error(
      WEAVIATE_API_KEY
        ? 'Weaviate Cloud connection failed. Check WEAVIATE_URL and WEAVIATE_API_KEY.'
        : 'Weaviate connection failed. Please ensure Docker is running with: docker compose up -d'
    );
  }
}

export async function closeWeaviateClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    console.log('✅ Weaviate client closed');
  }
}
