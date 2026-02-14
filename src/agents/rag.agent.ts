import { getWeaviateClient } from '../database/weaviate.client.js';
import { COLLECTION_NAME } from '../config/weaviate.config.js';
import { RAGResult, RAGReference } from './types.js';
import { groupReferencesByFile } from '../utils/reference.formatter.js';
import { geminiClient } from '../llm/gemini.client.js';
import { colors, createSpinner, printSuccess } from '../utils/terminal.ui.js';

export interface RAGSearchResult {
  results: Array<{ fileId: string; pageNumber: string[]; answer: string; question: string; distance: number }>;
  references: RAGReference[];
  context: string;
  prompt: string;
}

export class RAGAgent {
  private tenantName = 'default_tenant';
  async search(userQuery: string): Promise<RAGSearchResult> {
    console.log(colors.rag(`🔍 RAG: `) + colors.info(`"${userQuery}"`));

    const spinner = createSpinner('Searching knowledge base...');
    spinner.start();

    const client = await getWeaviateClient();
    const collection = client.collections.get(COLLECTION_NAME);
    const tenantCollection = collection.withTenant(this.tenantName);

    let results: RAGSearchResult['results'] = [];

    try {
      const response = await tenantCollection.query.nearText(userQuery, {
        limit: 5,
        returnMetadata: ['distance'],
      });

      spinner.stop();

      for (const obj of response.objects) {
        const props = obj.properties as any;
        const distance = obj.metadata?.distance ?? 1;
        if (distance < 0.45) {
          results.push({
            fileId: props.fileId as string,
            pageNumber: props.pageNumber as string[],
            answer: props.answer as string,
            question: props.question as string,
            distance,
          });
        }
      }

      if (results.length > 0) {
        printSuccess(`Found ${results.length} relevant results`);
      } else {
        console.log(colors.dim('Not found in knowledge base - using LLM'));
      }
    } catch (error) {
      spinner.stop();
      console.log(colors.processing('⚠️  Falling back to keyword search...'));

      const response = await tenantCollection.query.fetchObjects({ limit: 10 });

      for (const obj of response.objects) {
        const props = obj.properties as any;
        if (this.isRelevant(userQuery, props.question, props.answer)) {
          results.push({
            fileId: props.fileId as string,
            pageNumber: props.pageNumber as string[],
            answer: props.answer as string,
            question: props.question as string,
            distance: 0,
          });
        }
      }

      if (results.length > 0) {
        printSuccess(`Found ${results.length} results (keyword fallback)`);
      } else {
        console.log(colors.dim('Not found in knowledge base - using LLM'));
      }
    }

    const references = results.length > 0 ? groupReferencesByFile(results) : [];

    let context = '';
    let prompt = '';

    if (results.length > 0) {
      context = results.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n');
      prompt = `Based on the following context, answer the user's question: "${userQuery}"

Context:
${context}

Instructions:
- Answer based on the context provided
- If the context does not contain relevant information to answer the question, answer using your own knowledge instead
- Be concise and accurate`;
    } else {
      prompt = `Answer the following question concisely and accurately: ${userQuery}`;
    }

    return { results, references, context, prompt };
  }

  async query(userQuery: string): Promise<RAGResult> {
    console.log(colors.rag(`🔍 RAG: `) + colors.info(`"${userQuery}"`));

    const spinner = createSpinner('Searching knowledge base...');
    spinner.start();

    const client = await getWeaviateClient();
    const collection = client.collections.get(COLLECTION_NAME);
    const tenantCollection = collection.withTenant(this.tenantName);

    let results: Array<{ fileId: string; pageNumber: string[]; answer: string; question: string; distance: number }> = [];

    try {
      const response = await tenantCollection.query.nearText(userQuery, {
        limit: 5,
        returnMetadata: ['distance'],
      });

      spinner.stop();

      for (const obj of response.objects) {
        const props = obj.properties as any;
        const distance = obj.metadata?.distance ?? 1;
        
        if (distance < 0.45) {
          results.push({
            fileId: props.fileId as string,
            pageNumber: props.pageNumber as string[],
            answer: props.answer as string,
            question: props.question as string,
            distance,
          });
        }
      }

      if (results.length > 0) {
        printSuccess(`Found ${results.length} relevant results`);
      } else {
        console.log(colors.dim('Not found in knowledge base - using LLM'));
      }

    } catch (error) {
      spinner.stop();
      console.log(colors.processing('⚠️  Falling back to keyword search...'));
      
      const response = await tenantCollection.query.fetchObjects({ limit: 10 });

      for (const obj of response.objects) {
        const props = obj.properties as any;
        if (this.isRelevant(userQuery, props.question, props.answer)) {
          results.push({
            fileId: props.fileId as string,
            pageNumber: props.pageNumber as string[],
            answer: props.answer as string,
            question: props.question as string,
            distance: 0,
          });
        }
      }

      if (results.length > 0) {
        printSuccess(`Found ${results.length} results (keyword fallback)`);
      } else {
        console.log(colors.dim('Not found in knowledge base - using LLM'));
      }
    }

    const references = results.length > 0 ? groupReferencesByFile(results) : [];
    let answer = '';

    if (results.length > 0) {
      const context = results.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n');
      const prompt = `Based on the following context, answer the user's question: "${userQuery}"

Context:
${context}

Instructions:
- Answer based on the context provided
- If the context does not contain relevant information to answer the question, answer using your own knowledge instead
- Be concise and accurate`;

      answer = await geminiClient.generate(prompt);

      const refText = references.map(ref =>
        ref.pages.length === 1
          ? `${ref.displayId}- Page ${ref.pages[0]}`
          : `${ref.displayId}- Pages ${ref.pages.join(', ')}`
      ).join(' ');

      answer = `${answer}\n\nSources: ${refText}`;
    } else {
      answer = await geminiClient.generate(
        `Answer the following question concisely and accurately: ${userQuery}`
      );
    }

    return { answer, references };
  }

  private isRelevant(query: string, question: string, answer: string): boolean {
    const queryLower = query.toLowerCase();
    const combined = (question + ' ' + answer).toLowerCase();

    const stopWords = new Set(['what', 'is', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'are', 'how', 'why', 'when', 'where', 'who', 'does', 'do', 'can', 'could', 'would', 'should', 'about', 'that', 'this', 'with', 'from', 'have', 'has', 'been', 'was', 'were', 'will', 'be', 'and', 'or', 'but', 'not', 'it', 'its', 'they', 'them', 'their', 'you', 'your', 'me', 'my', 'we', 'our']);

    const queryWords = queryLower
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stopWords.has(w));

    return queryWords.some(word => combined.includes(word));
  }
}

export const ragAgent = new RAGAgent();