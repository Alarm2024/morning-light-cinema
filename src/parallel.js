import { getEnv } from './env.js';

const PARALLEL_URL = 'https://api.parallel.ai/v1/search';

export async function parallelSearch(theme) {
  const apiKey = getEnv('PARALLEL_API_KEY');
  if (!apiKey) throw new Error('PARALLEL_API_KEY is not set');

  const objective =
    'Research cinematic references, visual motifs, sound design, and cultural context for a short trailer themed: ' +
    theme +
    '. Prefer concrete visual and narrative details useful for a 6-scene storyboard.';

  const search_queries = [
    theme + ' cinematic trailer visual motifs',
    theme + ' film lighting cinematography',
    'morning light cinema aesthetic ' + theme,
  ].map((q) => q.slice(0, 120));

  const res = await fetch(PARALLEL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      objective,
      search_queries,
      mode: 'basic',
      max_chars_total: 24000,
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Parallel Search returned non-JSON (HTTP ' + res.status + ')');
  }

  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || (data && data.message) || text.slice(0, 200);
    throw new Error('Parallel Search HTTP ' + res.status + ': ' + msg);
  }

  const sources = (data.results || []).map((r) => ({
    url: r.url,
    title: r.title || null,
    publish_date: r.publish_date || null,
    excerpts: Array.isArray(r.excerpts) ? r.excerpts : [],
  }));

  return {
    search_id: data.search_id || null,
    session_id: data.session_id || null,
    sources,
    raw_warnings: data.warnings || [],
  };
}
