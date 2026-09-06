import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { keyMeta, loadDotEnv } from './env.js';
import { parallelSearch } from './parallel.js';
import { generateStoryboard } from './gemini.js';

loadDotEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '..', 'sample-out.json');
const theme = 'Solana dawn over desert dunes, golden hour IMAX trailer';

const parallel = keyMeta('PARALLEL_API_KEY');
const gemini = keyMeta('GEMINI_API_KEY');
console.log('PARALLEL_API_KEY set=' + parallel.set + ' length=' + parallel.length);
console.log('GEMINI_API_KEY set=' + gemini.set + ' length=' + gemini.length);

if (!parallel.set || !gemini.set) {
  console.log('Skipping live generate — both keys required.');
  process.exit(0);
}

const research = await parallelSearch(theme);
const { model, storyboard } = await generateStoryboard(theme, research);
const payload = {
  theme,
  generatedAt: new Date().toISOString(),
  model,
  research: {
    search_id: research.search_id,
    session_id: research.session_id,
    sources: research.sources,
  },
  storyboard,
};
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log('Wrote ' + outPath);
console.log('scenes=' + (storyboard.scenes || []).length + ' sources=' + research.sources.length);
