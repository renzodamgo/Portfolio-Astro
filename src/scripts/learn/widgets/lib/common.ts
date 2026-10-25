// Shared helpers for the learn widgets (DOM, sliders, readout, plot, animation). No libraries.

export const SVGNS = 'http://www.w3.org/2000/svg';
type Attrs = Record<string, string | number | boolean | undefined>;

let uid = 0;
export const nextId = (prefix = 'lw'): string => `${prefix}-${++uid}`;

function setAttrs(e: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    e.setAttribute(k === 'className' ? 'class' : k, v === true ? '' : String(v));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...kids: (Node | string | null)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  setAttrs(e, attrs);
  for (const kid of kids) if (kid !== null) e.append(kid);
  return e;
}

export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  setAttrs(e, attrs);
  return e;
}

/** Number with a decimal comma and a real minus sign; never "-0,00". */
export function fmt(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : 'n/d';
  const t = v.toFixed(digits);
  const neg = Number(t) < 0;
  return (neg ? '−' : '') + t.replace('-', '').replace('.', ',');
}

export const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Build the widget; on any error leave only the static fallback message. */
export function guarded(el: HTMLElement, build: (root: HTMLElement) => void): void {
  try {
    el.replaceChildren();
    el.classList.add('lw');
    build(el);
  } catch (err) {
    console.error('[learn widget]', err);
    el.classList.add('lw');
    el.replaceChildren(h('p', { class: 'lw-fallback' }, 'Este gráfico necesita JavaScript.'));
  }
}

// --------------------------------------------------------------------------- random numbers
/** Deterministic uniform [0, 1) from three integers (no state: the pattern stays stable while you move things). */
export function hash01(a: number, b: number, c = 0): number {
  let x = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rng: () => number, std: number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ------------------------------------------------------------------------------- controls
export interface SliderOpts {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  onInput: (v: number) => void;
}

export interface Slider {
  root: HTMLElement;
  input: HTMLInputElement;
  get(): number;
  set(v: number): void;
}

/** Paints the filled part of a range input's track (the CSS reads --fill; Firefox also has its own progress pseudo-element). */
export function rangeFill(input: HTMLInputElement): void {
  const min = Number(input.min || 0), max = Number(input.max || 100), span = max - min;
  const pct = span > 0 ? ((Number(input.value) - min) / span) * 100 : 0;
  input.style.setProperty('--fill', `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`);
}

export function slider(o: SliderOpts): Slider {
  const id = nextId('lw-in');
  const out = h('output', { class: 'lw-value', for: id });
  const input = h('input', { type: 'range', id, min: o.min, max: o.max, step: o.step, value: o.value });
  const refresh = () => {
    const text = o.format(Number(input.value));
    out.textContent = text;
    input.setAttribute('aria-valuetext', text);
    rangeFill(input);
  };
  input.addEventListener('input', () => {
    refresh();
    o.onInput(Number(input.value));
  });
  refresh();
  const root = h('div', { class: 'lw-field' }, h('label', { for: id }, o.label), out, input);
  return {
    root,
    input,
    get: () => Number(input.value),
    set: (v) => {
      input.value = String(v);
      refresh();
    },
  };
}

export function button(label: string, onClick: () => void, extra = ''): HTMLButtonElement {
  const b = h('button', { type: 'button', class: `lw-btn ${extra}`.trim() }, label);
  b.addEventListener('click', onClick);
  return b;
}

export function toggle(label: string, checked: boolean, onChange: (v: boolean) => void): { root: HTMLElement; input: HTMLInputElement } {
  const id = nextId('lw-ck');
  const input = h('input', { type: 'checkbox', id });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const root = h('div', { class: 'lw-check' }, input, h('label', { for: id }, label));
  return { root, input };
}

/** Visible numbers (updated at once) plus a screen reader summary that only changes once things settle. */
export function readout(): { root: HTMLElement; set(rows: [string, string, string?][], summary: string): void } {
  const dl = h('dl', { class: 'lw-readout-list' });
  const live = h('p', { class: 'lw-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const root = h('div', { class: 'lw-readout' }, dl, live);
  let timer = 0;
  return {
    root,
    set(rows, summary) {
      dl.replaceChildren(
        ...rows.flatMap(([k, v, c]) => [h('dt', { class: c ? `lw-c-${c}` : undefined }, k), h('dd', {}, v)]),
      );
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        live.textContent = summary;
      }, 600);
    },
  };
}

export function legend(items: [string, string][]): HTMLElement {
  return h(
    'ul',
    { class: 'lw-legend' },
    ...items.map(([cls, text]) => {
      const li = h('li', {}, h('span', { class: `lw-swatch lw-c-${cls}`, 'aria-hidden': 'true' }), text);
      return li;
    }),
  );
}

// ----------------------------------------------------------------------------------- animation
/** Runs frame(t) for t in [0, 1] over `ms` milliseconds; returns a cancel function. */
export function animate(ms: number, frame: (t: number) => void, done?: () => void): () => void {
  let raf = 0;
  let start = 0;
  let live = true;
  const tick = (now: number) => {
    if (!live) return;
    if (!start) start = now;
    const t = Math.min(1, (now - start) / ms);
    frame(t);
    if (t < 1) raf = requestAnimationFrame(tick);
    else done?.();
  };
  raf = requestAnimationFrame(tick);
  return () => {
    live = false;
    cancelAnimationFrame(raf);
  };
}

// ---------------------------------------------------------------------------------------- plot
export interface PlotSeries {
  points: [number, number][];
  color: string; // lw-c-<color>
  dashed?: boolean;
}
export interface PlotOpts {
  xmin: number;
  xmax: number;
  xlabel: string;
  ylabel: string;
  aria: string;
  digitsX?: number;
  digitsY?: number;
}
export interface PlotState {
  ymin: number;
  ymax: number;
  series: PlotSeries[];
  hlines?: { y: number; label: string; color: string }[];
  marker?: { x: number; y?: number; color: string };
}

function niceStep(range: number, target: number): number {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
}

export function createPlot(o: PlotOpts): { svg: SVGSVGElement; update(s: PlotState): void } {
  const W = 360, H = 210, L = 44, R = 12, T = 10, B = 38;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.aria, class: 'lw-svg lw-plot' });
  const g = svgEl('g');
  svg.append(g);
  const sx = (x: number) => L + ((x - o.xmin) / (o.xmax - o.xmin)) * (W - L - R);
  return {
    svg,
    update(s) {
      const sy = (y: number) => H - B - ((y - s.ymin) / (s.ymax - s.ymin)) * (H - T - B);
      let out = '';
      const xs = niceStep(o.xmax - o.xmin, 5);
      for (let x = Math.ceil(o.xmin / xs) * xs; x <= o.xmax + 1e-9; x += xs) {
        out += `<line class="lw-grid" x1="${sx(x)}" y1="${T}" x2="${sx(x)}" y2="${H - B}"/>`;
        out += `<text class="lw-tick" x="${sx(x)}" y="${H - B + 14}" text-anchor="middle">${fmt(x, o.digitsX ?? 0)}</text>`;
      }
      const ys = niceStep(s.ymax - s.ymin, 4);
      for (let y = Math.ceil(s.ymin / ys) * ys; y <= s.ymax + 1e-9; y += ys) {
        out += `<line class="lw-grid" x1="${L}" y1="${sy(y)}" x2="${W - R}" y2="${sy(y)}"/>`;
        out += `<text class="lw-tick" x="${L - 5}" y="${sy(y) + 4}" text-anchor="end">${fmt(y, o.digitsY ?? 1)}</text>`;
      }
      out += `<rect class="lw-frame" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/>`;
      out += `<text class="lw-axis" x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">${o.xlabel}</text>`;
      out += `<text class="lw-axis" transform="translate(11 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${o.ylabel}</text>`;
      for (const hl of s.hlines ?? []) {
        if (hl.y < s.ymin || hl.y > s.ymax) continue;
        out += `<g class="lw-c-${hl.color}"><line x1="${L}" y1="${sy(hl.y)}" x2="${W - R}" y2="${sy(hl.y)}" stroke="currentColor" stroke-dasharray="5 4" stroke-width="1.2"/>`;
        out += `<text class="lw-tag" x="${W - R - 3}" y="${sy(hl.y) - 4}" text-anchor="end" fill="currentColor">${hl.label}</text></g>`;
      }
      for (const ser of s.series) {
        if (ser.points.length < 2) continue;
        const pts = ser.points.map(([x, y]) => `${sx(x).toFixed(1)},${Math.max(T, Math.min(H - B, sy(y))).toFixed(1)}`).join(' ');
        out += `<polyline class="lw-c-${ser.color}" points="${pts}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"${ser.dashed ? ' stroke-dasharray="6 4"' : ''}/>`;
      }
      if (s.marker) {
        out += `<g class="lw-c-${s.marker.color}"><line x1="${sx(s.marker.x)}" y1="${T}" x2="${sx(s.marker.x)}" y2="${H - B}" stroke="currentColor" stroke-width="1" opacity="0.6"/>`;
        if (s.marker.y !== undefined) out += `<circle cx="${sx(s.marker.x)}" cy="${sy(s.marker.y)}" r="4" fill="currentColor"/>`;
        out += '</g>';
      }
      g.innerHTML = out;
    },
  };
}
