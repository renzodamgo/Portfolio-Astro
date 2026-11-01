// Copies the rendered videos into the site (public/learn/videos/open/<slug>.mp4) with a poster frame
// (<slug>.jpg) for each, so the guide pages can embed them. Run after render-all.mjs.
// Usage: node publish.mjs [slug ...]
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// The frame shown before the video plays: one where the chapter's idea is on screen.
const POSTER_SECONDS = {
  'paso-0-instalar-y-preparar': 12, 'paso-1-el-coche': 12, 'paso-2-el-rumbo': 16, 'paso-3-ver-el-campo': 25,
  'paso-4-seguir-la-isla': 13, 'paso-5-la-esquina': 11, 'paso-6-cuando-girar': 9, 'paso-7-la-mision': 20,
  'paso-8-la-direccion': 15, 'paso-9-puntuar-y-medir': 37, 'armar-y-conectar-el-coche': 38,
  'paso-10-el-coche-real': 16, 'coche-del-equipo-v5': 13, 'paso-11-solucion-de-problemas': 20, 'paso-12-afinar': 26,
};
const steps = readFileSync(new URL('./src/steps.ts', import.meta.url), 'utf8');
const all = [...steps.matchAll(/slug: '([^']+)'/g)].map((m) => m[1]);
const wanted = process.argv.slice(2);
const dest = new URL('../public/learn/videos/open/', import.meta.url);
mkdirSync(dest, { recursive: true });
for (const slug of wanted.length ? wanted : all) {
  copyFileSync(new URL(`./out/${slug}.mp4`, import.meta.url), new URL(`${slug}.mp4`, dest));
  execFileSync('npx', ['remotion', 'still', 'src/index.ts', slug, new URL(`${slug}.jpg`, dest).pathname,
    `--frame=${POSTER_SECONDS[slug] * 30}`, '--image-format=jpeg', '--jpeg-quality=80', '--log=error'], { stdio: 'inherit' });
  console.log(`published ${slug}`);
}
