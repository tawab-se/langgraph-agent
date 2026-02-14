export interface ImageResult {
  url: string;
  prompt: string;
  model: string;
}

const POLLINATIONS_BASE = 'https://gen.pollinations.ai/image';

/**
 * Image Tool - Text-to-image generation via Pollinations.ai (flux model)
 * Image editing is handled client-side via Puter.js FLUX.1 Kontext.
 */
export class ImageTool {
  static async execute(prompt: string): Promise<ImageResult> {
    const encodedPrompt = encodeURIComponent(prompt);

    const params = new URLSearchParams({
      model: 'flux',
      width: '1024',
      height: '1024',
      nologo: 'true',
      seed: String(Math.floor(Math.random() * 1000000)),
      key: process.env.POLLINATIONS_API_KEY || '',
    });

    const url = `${POLLINATIONS_BASE}/${encodedPrompt}?${params.toString()}`;

    // Pollinations generates the image on the first GET request.
    // The URL itself IS the image — the browser loads it via <img src>.
    return { url, prompt, model: 'flux' };
  }
}

export const imageTool = ImageTool;