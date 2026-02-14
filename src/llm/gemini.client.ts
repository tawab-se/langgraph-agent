import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import dotenv from 'dotenv';

dotenv.config();

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
    const result = await this.model.invoke(prompt);
    return result.content.toString();
  }

  async *generateStream(prompt: string): AsyncGenerator<string, void, unknown> {
    const stream = await this.model.stream(prompt);
    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content.toString();
      }
    }
  }
}

export const geminiClient = new GeminiClient();
