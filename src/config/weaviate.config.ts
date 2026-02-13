import dotenv from 'dotenv';

dotenv.config();

export const weaviateConfig = {
  url: process.env.WEAVIATE_URL || 'http://localhost:8080',
  apiKey: process.env.WEAVIATE_API_KEY || '',
  collectionName: 'DocumentQA',
};

export const WEAVIATE_URL = weaviateConfig.url;
export const WEAVIATE_API_KEY = weaviateConfig.apiKey;
export const COLLECTION_NAME = weaviateConfig.collectionName;
