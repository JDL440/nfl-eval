/**
 * Spike: Local prompt enhancement (qwen3-4b-z-image-turbo) vs raw prompts
 * Generates images via Gemini with both raw and qwen-enhanced prompts.
 * Also generates enhanced prompts for future local diffusion comparison.
 *
 * Usage: node spike-image-comparison.mjs
 */

import { LMStudioClient } from '@lmstudio/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'spike-images');

// Read GEMINI_API_KEY from .env
function loadEnv() {
  // Search common locations for .env
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(process.env.USERPROFILE || '', '.nfl-lab', '.env'),
    path.join(process.env.USERPROFILE || '', '.nfl-lab', 'config', '.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return parseEnv(fs.readFileSync(p, 'utf8'));
    }
  }
  return {};
}

function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.substring(0, eq).trim();
      const val = trimmed.substring(eq + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  }
  return env;
}

// NFL editorial image prompts (3 diverse scenarios)
const PROMPTS = [
  {
    id: 'stadium-sunset',
    raw: 'NFL stadium at sunset, dramatic editorial sports photography, Seahawks blue and green team colors, 16:9 hero image',
    team: 'Seattle Seahawks',
  },
  {
    id: 'qb-pocket',
    raw: 'NFL quarterback standing tall in the pocket, stadium lights illuminating the field, intense game moment, editorial sports photo, clean wide banner',
    team: 'Pittsburgh Steelers',
  },
  {
    id: 'defensive-huddle',
    raw: 'NFL defense huddled together before a critical play, steam rising in cold weather, dramatic stadium atmosphere, editorial sports photography',
    team: 'Cleveland Browns',
  },
];

// ── Prompt Enhancement via LM Studio ──────────────────────────────────────────

async function enhancePrompt(client, rawPrompt, team) {
  const model = await client.llm.model('qwen3-4b-z-image-turbo-abliteratedv1');

  const result = await model.respond(
    [
      {
        role: 'system',
        content: `You are an expert image prompt engineer for editorial sports photography. 
Given a basic image description, expand it into a highly detailed, photorealistic prompt 
optimized for AI image generation (Stable Diffusion / Gemini / DALL-E style).

Include specific details about:
- Lighting (golden hour, rim lighting, dramatic shadows, etc.)
- Camera angle and lens (wide angle, 85mm portrait, low angle, etc.)
- Atmosphere (fog, steam, rain, lens flare, bokeh, etc.)
- Composition (rule of thirds, leading lines, negative space, etc.)
- Color palette (specific to the team)
- Texture and material details
- Editorial photo quality descriptors

Keep the enhanced prompt to 2-3 sentences max. Do NOT include thinking tags. Output ONLY the enhanced prompt.`,
      },
      {
        role: 'user',
        content: `Team: ${team}\nBasic prompt: ${rawPrompt}\n\nEnhanced prompt:`,
      },
    ],
    {
      maxPredictedTokens: 512,
      temperature: 0.7,
    },
  );

  // Strip any thinking tags
  let enhanced = result.content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();

  // If response is too long, truncate
  if (enhanced.length > 600) {
    enhanced = enhanced.substring(0, 600).replace(/\s+\S*$/, '');
  }

  return enhanced;
}

// ── Gemini Image Generation ──────────────────────────────────────────────────

async function generateGeminiImage(apiKey, promptText, outputPath) {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent' +
    `?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: `Generate an image: ${promptText}` }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts;

  if (!parts) {
    throw new Error('No parts in Gemini response');
  }

  // Find the image part
  const imagePart = parts.find((p) => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imagePart) {
    // Sometimes Gemini returns text only
    const textPart = parts.find((p) => p.text);
    throw new Error(`No image in response. Text: ${textPart?.text?.substring(0, 100) ?? 'none'}`);
  }

  const buf = Buffer.from(imagePart.inlineData.data, 'base64');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buf);

  return { path: outputPath, size: buf.length };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Image Generation Spike: Local Enhancement vs Raw Prompts ===\n');

  // Setup
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const env = loadEnv();
  const geminiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    console.error('❌ GEMINI_API_KEY not found in ~/.nfl-lab/.env or environment');
    process.exit(1);
  }

  // Connect to LM Studio
  let client;
  try {
    client = new LMStudioClient({ baseUrl: 'ws://127.0.0.1:1234' });
    const models = await client.llm.listLoaded();
    const hasQwen = models.some((m) => m.identifier.includes('image-turbo'));
    if (!hasQwen) {
      console.warn('⚠️ qwen3-4b-z-image-turbo not loaded in LM Studio, skipping enhancement');
      client = null;
    } else {
      console.log('✅ LM Studio connected — qwen3-4b-z-image-turbo available\n');
    }
  } catch {
    console.warn('⚠️ LM Studio not available, will only generate raw prompts\n');
    client = null;
  }

  const results = [];

  for (const p of PROMPTS) {
    console.log(`\n── ${p.id} (${p.team}) ──`);
    console.log(`Raw prompt: ${p.raw.substring(0, 80)}...`);

    // Step 1: Enhance prompt with qwen model
    let enhanced = null;
    if (client) {
      console.log('  Enhancing prompt with qwen3-4b-z-image-turbo...');
      const start = Date.now();
      enhanced = await enhancePrompt(client, p.raw, p.team);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  Enhanced (${elapsed}s): ${enhanced.substring(0, 100)}...`);
    }

    // Step 2: Generate image with RAW prompt via Gemini
    console.log('  Generating Gemini image (raw prompt)...');
    try {
      const start = Date.now();
      const rawResult = await generateGeminiImage(
        geminiKey,
        p.raw,
        path.join(OUT_DIR, `${p.id}-raw-gemini.png`),
      );
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  ✅ Raw: ${(rawResult.size / 1024).toFixed(0)}KB (${elapsed}s)`);
      results.push({ id: p.id, type: 'raw', provider: 'gemini', ...rawResult, prompt: p.raw });
    } catch (e) {
      console.log(`  ❌ Raw failed: ${e.message}`);
    }

    // Step 3: Generate image with ENHANCED prompt via Gemini
    if (enhanced) {
      console.log('  Generating Gemini image (enhanced prompt)...');
      try {
        const start = Date.now();
        const enhResult = await generateGeminiImage(
          geminiKey,
          enhanced,
          path.join(OUT_DIR, `${p.id}-enhanced-gemini.png`),
        );
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`  ✅ Enhanced: ${(enhResult.size / 1024).toFixed(0)}KB (${elapsed}s)`);
        results.push({
          id: p.id,
          type: 'enhanced',
          provider: 'gemini',
          ...enhResult,
          prompt: enhanced,
        });
      } catch (e) {
        console.log(`  ❌ Enhanced failed: ${e.message}`);
      }
    }

    // Small delay between prompts to avoid rate limits
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Save manifest
  const manifest = {
    timestamp: new Date().toISOString(),
    models: {
      enhancer: 'qwen3-4b-z-image-turbo-abliteratedv1 (LM Studio local)',
      generator: 'gemini-2.5-flash-image (Google API)',
    },
    results,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  // Save enhanced prompts for future diffusion testing
  if (client) {
    const promptsDoc = PROMPTS.map((p, i) => {
      const r = results.find((r) => r.id === p.id && r.type === 'enhanced');
      return `## ${p.id} (${p.team})\n**Raw:** ${p.raw}\n**Enhanced:** ${r?.prompt ?? 'N/A'}\n`;
    }).join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'enhanced-prompts.md'), promptsDoc);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results saved to: ${OUT_DIR}`);
  console.log(`Total images: ${results.length}`);
  console.log(`Files:`);
  fs.readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.png'))
    .forEach((f) => {
      const stat = fs.statSync(path.join(OUT_DIR, f));
      console.log(`  ${f} (${(stat.size / 1024).toFixed(0)}KB)`);
    });
  console.log(`\nManifest: ${path.join(OUT_DIR, 'manifest.json')}`);

  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
