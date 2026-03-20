import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageGenerationConfig {
  provider: 'gemini' | 'imagen' | 'stub';
  apiKey?: string;
  outputDir: string;
}

export interface ImagePrompt {
  description: string;
  style?: string;
  aspectRatio?: '16:9' | '1:1' | '4:3';
  team?: string;
  players?: string[];
}

export interface ImageResult {
  path: string;
  width: number;
  height: number;
  prompt: string;
  provider: string;
}

export interface ImageProvider {
  id: string;
  generate(prompt: ImagePrompt, outputPath: string): Promise<ImageResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '4:3': { width: 1440, height: 1080 },
};

/** Minimal valid 1×1 red PNG (68 bytes). */
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4' +
    'nGP4z8BQDwAEgAF/pooBPQAAAABJRU5ErkJggg==',
  'base64',
);

function buildPromptText(prompt: ImagePrompt): string {
  const parts: string[] = [prompt.description];
  if (prompt.style) parts.push(`Style: ${prompt.style}`);
  if (prompt.team) parts.push(`Team: ${prompt.team}`);
  if (prompt.players?.length) parts.push(`Players: ${prompt.players.join(', ')}`);
  if (prompt.aspectRatio) parts.push(`Aspect ratio: ${prompt.aspectRatio}`);
  return parts.join('. ');
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function validateConfig(config: ImageGenerationConfig): void {
  if (!config.outputDir) {
    throw new Error('ImageGenerationConfig.outputDir is required');
  }
  const validProviders = ['gemini', 'imagen', 'stub'] as const;
  if (!validProviders.includes(config.provider)) {
    throw new Error(
      `Invalid provider '${config.provider as string}'. Must be one of: ${validProviders.join(', ')}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export class StubImageProvider implements ImageProvider {
  id = 'stub';

  async generate(prompt: ImagePrompt, outputPath: string): Promise<ImageResult> {
    const dims = ASPECT_DIMENSIONS[prompt.aspectRatio ?? '16:9'];
    ensureDir(join(outputPath, '..'));
    writeFileSync(outputPath, PLACEHOLDER_PNG);
    return {
      path: outputPath,
      width: dims.width,
      height: dims.height,
      prompt: buildPromptText(prompt),
      provider: this.id,
    };
  }
}

export class GeminiImageProvider implements ImageProvider {
  id = 'gemini';
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('GeminiImageProvider requires an API key');
    }
    this.apiKey = apiKey;
  }

  async generate(prompt: ImagePrompt, outputPath: string): Promise<ImageResult> {
    const dims = ASPECT_DIMENSIONS[prompt.aspectRatio ?? '16:9'];
    const promptText = buildPromptText(prompt);

    const body = {
      contents: [{ parts: [{ text: `Generate an image: ${promptText}` }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    };

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent' +
      `?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType?: string }; text?: string }[] } }[];
    };

    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(p => p.inlineData?.data);
    const b64 = imagePart?.inlineData?.data;
    if (!b64) {
      throw new Error('Gemini API returned no image data');
    }

    ensureDir(join(outputPath, '..'));
    writeFileSync(outputPath, Buffer.from(b64, 'base64'));

    return {
      path: outputPath,
      width: dims.width,
      height: dims.height,
      prompt: promptText,
      provider: this.id,
    };
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ImageService {
  private provider: ImageProvider;
  private outputDir: string;

  constructor(config: ImageGenerationConfig) {
    validateConfig(config);
    this.outputDir = config.outputDir;

    switch (config.provider) {
      case 'stub':
        this.provider = new StubImageProvider();
        break;
      case 'gemini':
        if (!config.apiKey) {
          throw new Error("Provider 'gemini' requires config.apiKey (GEMINI_API_KEY)");
        }
        this.provider = new GeminiImageProvider(config.apiKey);
        break;
      case 'imagen':
        // Imagen provider not yet implemented — fall through to error
        throw new Error("Provider 'imagen' is not yet implemented");
      default:
        throw new Error(`Unknown provider: ${config.provider as string}`);
    }
  }

  /** Directory for a given article's images. */
  private slugDir(articleSlug: string): string {
    return join(this.outputDir, articleSlug);
  }

  async generateCover(articleSlug: string, prompt: ImagePrompt): Promise<ImageResult> {
    const dir = this.slugDir(articleSlug);
    ensureDir(dir);
    const outPath = join(dir, `${articleSlug}-cover.png`);
    const coverPrompt: ImagePrompt = { aspectRatio: '16:9', ...prompt };
    return this.provider.generate(coverPrompt, outPath);
  }

  async generateInline(
    articleSlug: string,
    prompt: ImagePrompt,
    index = 1,
  ): Promise<ImageResult> {
    const dir = this.slugDir(articleSlug);
    ensureDir(dir);
    const outPath = join(dir, `${articleSlug}-inline-${index}.png`);
    const inlinePrompt: ImagePrompt = { aspectRatio: '16:9', ...prompt };
    return this.provider.generate(inlinePrompt, outPath);
  }

  async generateArticleImages(
    articleSlug: string,
    prompts: { cover?: ImagePrompt; inline?: ImagePrompt[] },
  ): Promise<{ cover?: ImageResult; inline: ImageResult[] }> {
    let cover: ImageResult | undefined;
    if (prompts.cover) {
      cover = await this.generateCover(articleSlug, prompts.cover);
    }

    const inline: ImageResult[] = [];
    if (prompts.inline) {
      for (let i = 0; i < prompts.inline.length; i++) {
        const result = await this.generateInline(articleSlug, prompts.inline[i], i + 1);
        inline.push(result);
      }
    }

    return { cover, inline };
  }
}
