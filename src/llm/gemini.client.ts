import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import dotenv from 'dotenv';

dotenv.config();

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('429') || msg.includes('resource has been exhausted')
      || msg.includes('rate limit') || msg.includes('quota');
  }
  return false;
}

function isDailyQuotaExhausted(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('resource has been exhausted') || msg.includes('quota');
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class GeminiClient {
  private model: ChatGoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required. Please set it in your .env file.');
    }

    this.model = new ChatGoogleGenerativeAI({
      apiKey,
      model: 'gemini-2.5-flash-lite',
      temperature: 0.1,
    });
  }

  async generate(prompt: string): Promise<string> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.model.invoke(prompt);
        return result.content.toString();
      } catch (error) {
        if (isRateLimitError(error) && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`⚠️  Gemini rate limit hit (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        throw isDailyQuotaExhausted(error)
          ? new Error('Gemini daily quota exceeded. The free tier resets at midnight Pacific Time. Please try again later.')
          : error;
      }
    }
    throw new Error('Gemini request failed after retries');
  }

  async *generateStream(prompt: string): AsyncGenerator<string, void, unknown> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const stream = await this.model.stream(prompt);
        for await (const chunk of stream) {
          if (chunk.content) {
            yield chunk.content.toString();
          }
        }
        return;
      } catch (error) {
        if (isRateLimitError(error) && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`⚠️  Gemini rate limit hit (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        throw isDailyQuotaExhausted(error)
          ? new Error('Gemini daily quota exceeded. The free tier resets at midnight Pacific Time. Please try again later.')
          : error;
      }
    }
    throw new Error('Gemini request failed after retries');
  }
}

export const geminiClient = new GeminiClient();