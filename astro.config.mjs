// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    // The simulator and the replay load three.js and its STL loader lazily: pre-bundle them so the dev server
    // does not re-optimise (and drop the page's dynamic import with a 504) when they are first discovered.
    optimizeDeps: {
      include: ['three', 'three/examples/jsm/loaders/STLLoader.js'],
    },
  },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },
  site: "https://renzodamian.com"
});