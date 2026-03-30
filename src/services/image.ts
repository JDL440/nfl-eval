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
  /** 'cover' | 'inline' — used by buildEditorialPrompt for context-aware prompt construction */
  imageType?: 'cover' | 'inline';
  /** Full article title — used for richer prompt context */
  articleTitle?: string;
  /** 1-3 sentence article summary */
  articleSummary?: string;
  /** Fully custom prompt — bypasses all template logic */
  customPrompt?: string;
}

export interface ImageResult {
  path: string;
  width: number;
  height: number;
  prompt: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
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

/** Editorial style guide matching v1 prompt quality — photorealistic, cinematic, no AI artifacts. */
const STYLE_GUIDE = [
  'Photorealistic photograph, not an illustration or digital art.',
  'High contrast, dramatic natural lighting.',
  'NFL football aesthetic — stadium atmosphere, team colors, intensity.',
  'No text, logos, watermarks, or numbers anywhere in the image.',
  'Cinematic composition, widescreen feel.',
  'Professional quality suitable for a sports editorial publication.',
  'Shot on a full-frame DSLR. Natural color grading, realistic film grain.',
  'No oversaturation, no neon glow, no fantasy lighting.',
].join(' ');

function buildPromptText(prompt: ImagePrompt): string {
  // Fully custom prompt bypasses all template logic
  if (prompt.customPrompt) return prompt.customPrompt;

  const teamStr = prompt.team ? `${prompt.team} NFL team` : 'NFL';
  const playerStr = prompt.players?.length
    ? `featuring ${prompt.players.join(', ')}`
    : '';
  const isPlayerCentric = (prompt.players?.length ?? 0) > 0;
  const title = prompt.articleTitle ?? prompt.description;
  const summary = prompt.articleSummary ?? '';

  if (prompt.imageType === 'cover') {
    return [
      `Cover image for an NFL article titled "${title}".`,
      summary ? `Article topic: ${summary}.` : '',
      `Subject: ${teamStr} ${playerStr}.`,
      STYLE_GUIDE,
      'Wide aspect ratio. Hero image that captures the emotional core of the article.',
      isPlayerCentric
        ? 'If the article is centered on a specific player, make that player the clear visual subject in a realistic game-action or sideline moment that reflects the headline.'
        : 'If the story is team-wide or abstract, use a strong atmospheric team-driven scene tied to the headline.',
      'The image should explain the article at a glance and feel social-share ready.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (prompt.imageType === 'inline') {
    return [
      'Inline editorial image for an NFL article.',
      `Context: ${summary || title}.`,
      `Subject: ${teamStr} ${playerStr}.`,
      STYLE_GUIDE,
      'Wide 16:9 landscape format. Banner-style image that breaks up body text.',
      isPlayerCentric
        ? 'When the article is player-centric, use the player as the visual subject rather than a generic atmospheric scene.'
        : 'When the article is not player-centric, focus on atmosphere, environment, and team-driven editorial storytelling.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  // Generic fallback (non-editorial callers or unknown imageType)
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
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    };

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent' +
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
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };

    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(p => p.inlineData?.data);
    const b64 = imagePart?.inlineData?.data;
    if (!b64) {
      throw new Error('Gemini API returned no image data');
    }

    const mimeType = imagePart?.inlineData?.mimeType ?? 'image/png';
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
    // Replace .png extension with detected extension if different
    const finalPath = ext !== 'png' ? outputPath.replace(/\.png$/, `.${ext}`) : outputPath;

    ensureDir(join(finalPath, '..'));
    writeFileSync(finalPath, Buffer.from(b64, 'base64'));

    return {
      path: finalPath,
      width: dims.width,
      height: dims.height,
      prompt: promptText,
      provider: this.id,
      usage: json.usageMetadata
        ? {
            promptTokens: json.usageMetadata.promptTokenCount ?? 0,
            completionTokens: json.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: json.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
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
  ): Promise<{ cover?: ImageResult; inline: ImageResult[]; totalUsage?: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
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

    // Aggregate token usage across all image generation calls
    const allResults = [cover, ...inline].filter(Boolean) as ImageResult[];
    const withUsage = allResults.filter((r) => r.usage);
    const totalUsage = withUsage.length > 0
      ? {
          promptTokens: withUsage.reduce((sum, r) => sum + (r.usage?.promptTokens ?? 0), 0),
          completionTokens: withUsage.reduce((sum, r) => sum + (r.usage?.completionTokens ?? 0), 0),
          totalTokens: withUsage.reduce((sum, r) => sum + (r.usage?.totalTokens ?? 0), 0),
        }
      : undefined;

    return { cover, inline, totalUsage };
  }
}
