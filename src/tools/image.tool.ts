export interface ImageResult {
  url: string;
  prompt: string;
  model: string;
}

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

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
    });

    if (imageUrl) {
      params.set('image', imageUrl);
    }

    const url = `${POLLINATIONS_BASE}/${encodedPrompt}?${params.toString()}`;

    // Verify the URL resolves (Pollinations generates on first request)
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) {
      throw new Error(`Pollinations API returned ${res.status}: ${res.statusText}`);
    }

    return { url, prompt, model };
  }
}

export const imageTool = ImageTool;