// Theme colours for the three.js scenes of /learn (CarSim and the replay player).
// The page theme lives in document.documentElement.dataset.theme ("light" | "dark", see ThemeToggle.astro);
// the toggle also fires a `themechange` CustomEvent on window. Everything the scenes need to know about the
// theme goes through here so that CSS (stage background) and WebGL (clear colour) always agree.

export type Theme = 'light' | 'dark';

export const currentTheme = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
export const isLight = (): boolean => currentTheme() === 'light';

/** Background of the 3D scenes: white on the light theme, black on the dark one. Also the clear colour. */
export const sceneBackground = (theme: Theme = currentTheme()): number => (theme === 'light' ? 0xffffff : 0x000000);

/** Calls `callback` when the theme changes (the `themechange` event or a direct change of data-theme). Returns the unsubscribe function. */
export function onThemeChange(callback: (theme: Theme) => void): () => void {
  let last = currentTheme();
  const notify = () => {
    const now = currentTheme();
    if (now === last) return;
    last = now;
    callback(now);
  };
  window.addEventListener('themechange', notify);
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    window.removeEventListener('themechange', notify);
    observer.disconnect();
  };
}

/** Colours of the overlays drawn inside the scenes, chosen so that they read on white and on black. */
export interface ScenePalette {
  /** LiDAR rays and hit points (main car). */
  lidarRay: number; lidarRayOpacity: number; lidarHit: number; lidarHitSize: number;
  /** Section tint of the mat (green). */
  section: number; sectionOpacityBoost: number;
  /** Left / right / front measure lines as RGB triplets (0..1). */
  measure: [number[], number[], number[]];
  /** Walls. */
  wall: number; wallHit: number;
}

export function scenePalette(theme: Theme = currentTheme()): ScenePalette {
  return theme === 'light'
    ? {
        lidarRay: 0xc2410c, lidarRayOpacity: 0.34, lidarHit: 0x9a3412, lidarHitSize: 1.35,
        section: 0x1c7a4c, sectionOpacityBoost: 1.35,
        measure: [[0.114, 0.373, 0.722], [0.11, 0.478, 0.298], [0.753, 0.224, 0.169]],
        wall: 0x3a352c, wallHit: 0xc0392b,
      }
    : {
        lidarRay: 0xff5a3c, lidarRayOpacity: 0.22, lidarHit: 0xffb454, lidarHitSize: 1,
        section: 0x6fd3a0, sectionOpacityBoost: 1,
        measure: [[0.49, 0.72, 1], [0.44, 0.83, 0.63], [1, 0.48, 0.42]],
        wall: 0x3a352c, wallHit: 0xc0392b,
      };
}

/** A track colour (#rrggbb) as it should be drawn: on white the pale colours of the replay files are darkened (x0.68 in sRGB). */
export function trackColor(hex: string, theme: Theme = currentTheme()): string {
  if (theme !== 'light') return hex;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * 0.68).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}
