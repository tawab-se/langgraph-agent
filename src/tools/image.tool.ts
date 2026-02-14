export interface ImageResult {
  url: string;
  prompt: string;
  model: string;
}

const POLLINATIONS_BASE = 'https://gen.pollinations.ai/image';

/**
 * Image Tool - Generates or edits images via Pollinations.ai
 * - Text-to-image: uses flux model
 * - Image editing (with input image URL): uses kontext model
 */
export class ImageTool {
  static async execute(prompt: string, imageUrl?: string): Promise<ImageResult> {
    const encodedPrompt = encodeURIComponent(prompt);
    const model = imageUrl ? 'kontext' : 'flux';

    const params = new URLSearchParams({
      model,
      width: '1024',
      height: '1024',
      nologo: 'true',
      seed: String(Math.floor(Math.random() * 1000000)),
      key: process.env.POLLINATIONS_API_KEY || '',
    });

    if (imageUrl) {
      params.set('image', imageUrl);
    }

    const url = `${POLLINATIONS_BASE}/${encodedPrompt}?${params.toString()}`;

    // Pollinations generates the image on the first GET request.
    // The URL itself IS the image — the browser loads it via <img src>.
    return { url, prompt, model };
  }
}

export const imageTool = ImageTool;