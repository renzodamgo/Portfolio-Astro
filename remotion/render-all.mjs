// Renders every composition (one per chapter of the Open guide) to out/<slug>.mp4.
// Usage: node render-all.mjs [slug ...]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const steps = readFileSync(new URL('./src/steps.ts', import.meta.url), 'utf8');
const all = [...steps.matchAll(/slug: '([^']+)'/g)].map((m) => m[1]);
const wanted = process.argv.slice(2);
for (const slug of wanted.length ? wanted : all) {
  console.log(`\n== ${slug}`);
  execFileSync('npx', ['remotion', 'render', 'src/index.ts', slug, `out/${slug}.mp4`, '--codec=h264', '--crf=20', '--log=error'], { stdio: 'inherit' });
}
