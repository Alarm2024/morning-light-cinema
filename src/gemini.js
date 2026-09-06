import { GoogleGenAI } from '@google/genai';
import { getEnv } from './env.js';

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

export async function generateStoryboard(theme, research) {
  const apiKey = getEnv('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const model = getEnv('GEMINI_MODEL') || 'gemini-2.5-flash';

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
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  const text = response.text || '';
  const storyboard = extractJson(text);
  if (!Array.isArray(storyboard.scenes) || storyboard.scenes.length !== 6) {
    throw new Error('Gemini did not return exactly 6 scenes');
  }
  return { model, storyboard, raw_text: text };
}
