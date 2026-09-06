import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { getEnv, keyMeta, loadDotEnv } from './env.js';
import { parallelSearch } from './parallel.js';
import { generateStoryboard } from './gemini.js';

loadDotEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PORT = Number(getEnv('PORT') || process.env.PORT || 3000);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  const parallel = keyMeta('PARALLEL_API_KEY');
  const gemini = keyMeta('GEMINI_API_KEY');
  res.json({
    ok: true,
    name: 'Morning Light Cinema Agent',
    providers: {
      parallel: parallel.set,
      gemini: gemini.set,
    },
    model: getEnv('GEMINI_MODEL') || 'gemini-2.5-flash',
  });
});

app.post('/api/generate', async (req, res) => {
  try {
    const theme = typeof req.body?.theme === 'string' ? req.body.theme.trim() : '';
    if (!theme || theme.length < 3) {
      res.status(400).json({ error: 'Provide a theme prompt (min 3 chars)' });
      return;
    }
    const parallelMeta = keyMeta('PARALLEL_API_KEY');
    const geminiMeta = keyMeta('GEMINI_API_KEY');
    if (!parallelMeta.set || !geminiMeta.set) {
      res.status(503).json({
        error: 'Missing provider keys',
        providers: { parallel: parallelMeta.set, gemini: geminiMeta.set },
      });
      return;
    }

    const research = await parallelSearch(theme);
    const { model, storyboard } = await generateStoryboard(theme, research);

    res.json({
      theme,
      generatedAt: new Date().toISOString(),
      model,
      research: {
        search_id: research.search_id,
        session_id: research.session_id,
        sources: research.sources,
      },
      storyboard,
      citations: storyboard.citations || research.sources.map((s) => ({
        url: s.url,
        title: s.title,
        used_in_scenes: [],
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generate failed';
    console.error('[generate]', message);
    res.status(502).json({ error: message });
  }
});

app.use(express.static(path.join(root, 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(root, 'public', 'index.html'), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  const p = keyMeta('PARALLEL_API_KEY');
  const g = keyMeta('GEMINI_API_KEY');
  console.log('Morning Light Cinema on http://127.0.0.1:' + PORT);
  console.log('providers parallel=' + p.set + ' (len ' + p.length + ') gemini=' + g.set + ' (len ' + g.length + ')');
});
