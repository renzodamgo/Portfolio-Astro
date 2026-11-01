export const W = 1920;
export const H = 1080;
export const FPS = 30;

export const C = {
  bg: '#0f1724',
  panel: '#172234',
  panel2: '#1e2b40',
  line: '#2c3b55',
  text: '#eef2f8',
  dim: '#93a3bb',
  mat: '#f3f0e8',
  matLine: '#d9d3c4',
  wall: '#222831',
  car: '#e8553e',
  carDark: '#a23423',
  blue: '#2f6fe0',
  orange: '#f08a24',
  accent: '#4fd1a5',
  yellow: '#f2c94c',
  violet: '#a78bfa',
  red: '#ef5a5a',
  ray: 'rgba(239, 90, 90, 0.35)',
};

export const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
export const MONO = '"SF Mono", Menlo, Consolas, monospace';

// Spanish number format: decimal comma.
export const num = (v: number, digits = 2) => {
  if (!isFinite(v)) return '∞';
  const s = v.toFixed(digits);
  return (Number(s) === 0 ? (0).toFixed(digits) : s).replace('.', ',').replace('-', '−');
};
