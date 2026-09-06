import { GoogleGenAI } from '@google/genai';
import { getEnv } from './env.js';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-flash-lite-latest',
];
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 1000;

function extractJson(text) {
  if (!text) throw new Error('Empty Gemini response');
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

export function getGeminiModelChain() {
  const primary = getEnv('GEMINI_MODEL') || DEFAULT_MODEL;
  const rest = MODEL_CHAIN.filter((model) => model !== primary);
  return [primary, ...rest];
}

export function isRetryableGeminiError(err) {
  if (!err) return false;
  const status = err.status ?? err.statusCode;
  if (status === 503 || status === 429) return true;
  const msg = String(err.message || err).toUpperCase();
  return (
    msg.includes('UNAVAILABLE') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('503') ||
    msg.includes('HIGH DEMAND')
  );
}

/** Retired or missing models (404) should skip to the next model in the chain. */
export function isFallbackEligibleGeminiError(err) {
  if (isRetryableGeminiError(err)) return true;
  if (!err) return false;
  const status = err.status ?? err.statusCode;
  if (status === 404) return true;
  const msg = String(err.message || err).toUpperCase();
  return msg.includes('NOT_FOUND') || msg.includes('404');
}

export function formatGeminiUserError(err) {
  if (isRetryableGeminiError(err)) {
    return 'Gemini busy — try again in a minute';
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.trim().startsWith('{') || msg.includes('"error"')) {
    return 'Gemini generation failed — please try again';
  }
  return msg;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateContentWithRetry(ai, model, prompt) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await ai.models.generateContent({ model, contents: prompt });
    } catch (err) {
      lastErr = err;
      const retryable = isRetryableGeminiError(err);
      if (!retryable || attempt === RETRY_ATTEMPTS) throw err;
      const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
      console.warn(
        `[gemini] ${model} attempt ${attempt}/${RETRY_ATTEMPTS} failed (${err.message}); retry in ${delay}ms`,
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

export async function generateStoryboard(theme, research) {
  const apiKey = getEnv('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const sourcesBlock = (research.sources || [])
    .slice(0, 12)
    .map((s, i) => {
      const ex = (s.excerpts || []).slice(0, 2).join(' | ').slice(0, 800);
      return '[' + (i + 1) + '] ' + (s.title || 'Untitled') + '\nURL: ' + s.url + '\nExcerpts: ' + ex;
    })
    .join('\n\n');

  const prompt = [
    'You are a cinematic trailer director for Morning Light Cinema.',
    'Using ONLY the research sources below, write a 6-scene storyboard / trailer script.',
    'Theme: ' + theme,
    '',
    'Return STRICT JSON with this shape:',
    '{',
    '  "title": string,',
    '  "logline": string,',
    '  "scenes": [',
    '    {',
    '      "n": 1,',
    '      "heading": string,',
    '      "visual": string,',
    '      "voiceover": string,',
    '      "music": string,',
    '      "citation_urls": [string]',
    '    }',
    '  ],',
    '  "citations": [{ "url": string, "title": string|null, "used_in_scenes": [number] }]',
    '}',
    'Rules:',
    '- Exactly 6 scenes, n = 1..6',
    '- Morning-light / golden-hour cinematic tone',
    '- citation_urls must be real URLs from the research list',
    '- No markdown, JSON only',
    '',
    'RESEARCH SOURCES:',
    sourcesBlock || '(no sources — invent carefully marked fictional placeholders and leave citation_urls empty)',
  ].join('\n');

  const ai = new GoogleGenAI({ apiKey });
  const modelChain = getGeminiModelChain();
  let lastErr;

  for (let i = 0; i < modelChain.length; i++) {
    const model = modelChain[i];
    try {
      const response = await generateContentWithRetry(ai, model, prompt);
      const text = response.text || '';
      const storyboard = extractJson(text);
      if (!Array.isArray(storyboard.scenes) || storyboard.scenes.length !== 6) {
        throw new Error('Gemini did not return exactly 6 scenes');
      }
      if (i > 0) {
        console.warn(`[gemini] succeeded with fallback model ${model}`);
      }
      return { model, storyboard, raw_text: text };
    } catch (err) {
      lastErr = err;
      const hasFallback = i < modelChain.length - 1;
      if (!isFallbackEligibleGeminiError(err) || !hasFallback) {
        throw Object.assign(new Error(formatGeminiUserError(err)), { cause: err });
      }
      console.warn(`[gemini] model ${model} failed; trying ${modelChain[i + 1]}`);
    }
  }

  throw Object.assign(new Error(formatGeminiUserError(lastErr)), { cause: lastErr });
}
