// Widget "obstacle-follow": following the planned line (follow.py). The steering is three parts: the feed-forward of
// the line's curvature 10 cm ahead, minus LATERAL_GAIN times the distance to the line beside the car, minus kp times
// the heading error and kd times the gyro. A bicycle with the real servo (0.1 s dead time, 1.2 rad/s, 0.06 s lag)
// drives it at 0.30 m/s. Two runs: a 15 cm side step on a straight, and a corner of the lane.
import { button, createPlot, fmt, guarded, h, legend, readout, slider, svgEl } from './lib/common';
import { CORNER_UNITS, STEER_LIMIT, WHEELBASE, advance, clamp, laneNormal, lanePose, wrap } from './lib/obstacle';

const PREVIEW = 0.1, STENCIL = 0.15, SPEED = 0.3, DT = 0.02;
type Offset = (s: number) => number;
const point = (offset: Offset, s: number): [number, number] => {
  const [x, y] = lanePose(s), [nx, ny] = laneNormal(s), d = offset(s);
  return [x + d * nx, y + d * ny];
};
/** follow.reference: point, heading and curvature of the line at a progress. */
function reference(offset: Offset, s: number): [number, number, number, number] {
  const [x0, y0] = point(offset, advance(s, -STENCIL)), [x1, y1] = point(offset, s), [x2, y2] = point(offset, advance(s, STENCIL));
  const heading = Math.atan2(y2 - y0, x2 - x0);
  const cross = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1);
  const sides = Math.hypot(x1 - x0, y1 - y0) * Math.hypot(x2 - x1, y2 - y1) * Math.hypot(x2 - x0, y2 - y0);
  return [x1, y1, heading, (2 * cross) / Math.max(sides, 1e-9)];
}
/** Progress of the lane point nearest to (x, y), searching forward from `start` (lane.progress_of, 2 cm grid). */
function progressOf(x: number, y: number, start: number): number {
  let best = start, bd = Infinity;
  for (let s = start; s <= start + 0.6; s += 0.02) {
    const [lx, ly] = lanePose(s);
    const d = Math.hypot(x - lx, y - ly);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
interface Gains { lateral: number; kp: number; kd: number; feed: boolean }
interface Row { s: number; x: number; y: number; err: number; steer: number; ff: number; lat: number; head: number; damp: number }

export function simulate(offset: Offset, s0: number, s1: number, g: Gains): Row[] {
  let [x, y, th] = lanePose(s0);
  let steerNow = 0, rate = 0, phi = s0;
  const queue: number[] = Array(Math.round(0.1 / DT)).fill(0);
  const rows: Row[] = [];
  for (let k = 0; k < 4000 && phi < s1; k++) {
    phi = progressOf(x, y, phi - 0.05);
    const [px, py, heading] = reference(offset, phi);
    const kappa = reference(offset, advance(phi, PREVIEW))[3];
    const err = -(x - px) * Math.sin(heading) + (y - py) * Math.cos(heading);
    const ff = g.feed ? Math.atan(WHEELBASE * kappa) : 0, lat = -g.lateral * err, head = -g.kp * wrap(th - heading), damp = -g.kd * rate;
    const cmd = clamp(ff + lat + head + damp, -STEER_LIMIT, STEER_LIMIT);
    rows.push({ s: phi, x, y, err, steer: cmd, ff, lat, head, damp });
    queue.push(cmd);
    const target = queue.shift()!;
    steerNow += clamp((target - steerNow) * Math.min(1, DT / 0.06), -1.2 * DT, 1.2 * DT);
    rate = (SPEED * Math.tan(steerNow)) / WHEELBASE;
    th += rate * DT;
    x += SPEED * Math.cos(th) * DT;
    y += SPEED * Math.sin(th) * DT;
  }
  return rows;
}

export const SCENES = {
  step: { label: 'Un escalón de 15 cm en la recta', s0: 0, s1: 1.0, offset: ((s: number) => (s < 0.15 ? 0 : 0.15)) as Offset, view: [-0.75, 0.85, -1.52, -0.45] },
  corner: { label: 'Una esquina del carril', s0: 0.6, s1: 2.3, offset: ((_: number) => 0) as Offset, view: [-0.1, 1.55, -1.55, 0.25] },
};

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let which: keyof typeof SCENES = 'step';
    const g: Gains = { lateral: 6, kp: 1.5, kd: 0.2, feed: true };
    let at = 1;
    const svg = svgEl('svg', { viewBox: '0 0 420 300', class: 'lw-svg', role: 'img' });
    const sceneEl = svgEl('g');
    svg.append(sceneEl);
    const plot = createPlot({ xmin: 0, xmax: 1, xlabel: 'progreso (unidades)', ylabel: 'distancia a la línea (cm)', aria: 'Distancia del coche a la línea a lo largo del recorrido', digitsX: 1, digitsY: 0 });
    const rd = readout();
    let rows: Row[] = [];

    function run(): void {
      const sc = SCENES[which];
      rows = simulate(sc.offset, sc.s0, sc.s1, g);
      draw();
    }
    function draw(): void {
      const sc = SCENES[which];
      const [x0, x1, y0, y1] = sc.view;
      const K = Math.min(420 / (x1 - x0), 300 / (y1 - y0));
      const P = (x: number, y: number): [number, number] => [(x - x0) * K, (y1 - y) * K];
      let out = `<rect x="0" y="0" width="420" height="300" fill="var(--lw-bg)"/>`;
      // island and outer wall in the window
      const [ix0, iy0] = P(-0.5, 0.5), [ix1, iy1] = P(0.5, -0.5);
      out += `<rect class="lw-wall" x="${ix0}" y="${iy0}" width="${ix1 - ix0}" height="${iy1 - iy0}"/>`;
      const [, wy] = P(0, -1.5), [wx] = P(1.5, 0);
      out += `<rect class="lw-wall" x="0" y="${wy}" width="420" height="300"/><rect class="lw-wall" x="${wx}" y="0" width="420" height="300"/>`;
      // the lane centre (dashed) and the planned line
      const lane: string[] = [], line: string[] = [];
      for (let s = sc.s0 - 0.2; s <= sc.s1 + 0.2; s += 0.02) { lane.push(P(...(lanePose(s).slice(0, 2) as [number, number])).join(',')); line.push(P(...point(sc.offset, s)).join(',')); }
      out += `<polyline points="${lane.join(' ')}" fill="none" stroke="var(--lw-muted)" stroke-dasharray="5 5"/>`;
      out += `<polyline points="${line.join(' ')}" fill="none" stroke="var(--lw-green)" stroke-width="2.5"/>`;
      const n = Math.max(1, Math.round(at * (rows.length - 1)));
      out += `<polyline points="${rows.slice(0, n + 1).map((r) => P(r.x, r.y).join(',')).join(' ')}" fill="none" stroke="var(--lw-amber)" stroke-width="2"/>`;
      const r = rows[Math.min(n, rows.length - 1)];
      if (r) {
        const th = Math.atan2(rows[Math.min(n + 1, rows.length - 1)].y - r.y, rows[Math.min(n + 1, rows.length - 1)].x - r.x);
        out += `<g transform="translate(${P(r.x, r.y).map((v) => v.toFixed(1)).join(' ')}) rotate(${(-th * 180 / Math.PI).toFixed(1)}) scale(${K})"><rect x="-0.0852" y="-0.074" width="0.2329" height="0.148" rx="0.012" class="lw-body"/><path d="M 0.118 -0.03 L 0.148 0 L 0.118 0.03 Z" class="lw-nose"/></g>`;
      }
      sceneEl.innerHTML = out;
      const errs = rows.map((q) => q.err * 100);
      const max = Math.max(...errs.map(Math.abs), 1);
      plot.update({
        ymin: -Math.ceil(max * 1.15), ymax: Math.ceil(max * 1.15),
        series: [{ color: 'amber', points: rows.filter((_, i) => i % 2 === 0).map((q) => [(q.s - sc.s0) / (sc.s1 - sc.s0), q.err * 100]) }],
        hlines: [{ y: 0, label: 'sobre la línea', color: 'green' }],
        marker: r ? { x: (r.s - sc.s0) / (sc.s1 - sc.s0), y: r.err * 100, color: 'amber' } : undefined,
      });
      const tail = rows.slice(Math.floor(rows.length * 0.6));
      const settled = Math.max(...tail.map((q) => Math.abs(q.err))) * 100;
      const deg = (v: number) => `${fmt((v * 180) / Math.PI, 1)}°`;
      rd.set(r ? [
        ['feed-forward (curva)', deg(r.ff)],
        ['− LATERAL_GAIN · error', deg(r.lat)],
        ['− kp · error de rumbo', deg(r.head)],
        ['− kd · giroscopio', deg(r.damp)],
        ['volante (con tope 17,6°)', deg(r.steer), 'amber'],
        ['error máximo / al final', `${fmt(max, 1)} cm / ${fmt(settled, 1)} cm`],
      ] : [], `Error máximo ${fmt(max, 1)} centímetros.`);
    }
    const mk = (label: string, min: number, max: number, step: number, value: number, set: (v: number) => void) =>
      slider({ label, min, max, step, value, format: (v) => fmt(v, step < 0.1 ? 2 : 1), onInput: (v) => { set(v); run(); } });
    const sLat = mk('LATERAL_GAIN (rad por metro)', 0, 12, 0.5, g.lateral, (v) => (g.lateral = v));
    const sKp = mk('kp (rad por rad de rumbo)', 0, 4, 0.1, g.kp, (v) => (g.kp = v));
    const sKd = mk('kd (amortiguamiento)', 0, 1, 0.05, g.kd, (v) => (g.kd = v));
    const scrub = slider({ label: 'Recorrido', min: 0, max: 1, step: 0.01, value: 1, format: (v) => `${Math.round(v * 100)} %`, onInput: (v) => { at = v; draw(); } });
    const pick = (k: keyof typeof SCENES) => button(SCENES[k].label, () => { which = k; at = 1; scrub.set(1); run(); });
    const set = (label: string, v: Partial<Gains>) => button(label, () => {
      Object.assign(g, { lateral: 6, kp: 1.5, kd: 0.2, feed: true }, v);
      sLat.set(g.lateral); sKp.set(g.kp); sKd.set(g.kd); run();
    });
    root.append(
      h('div', { class: 'lw-figure' }, svg),
      legend([['green', 'la línea planificada'], ['amber', 'el coche'], ['muted', 'centro del carril']]),
      h('div', { class: 'lw-actions' }, pick('step'), pick('corner')),
      h('div', { class: 'lw-figure' }, plot.svg),
      rd.root,
      h('div', { class: 'lw-actions' }, set('La del curso', {}), set('Sin feed-forward', { feed: false }), set('LATERAL_GAIN 0', { lateral: 0 }), set('LATERAL_GAIN 12', { lateral: 12 }), set('Sin amortiguar', { kd: 0 })),
      h('div', { class: 'lw-controls' }, sLat.root, sKp.root, sKd.root, scrub.root),
      h('p', { class: 'lw-note' }, `follow.steer del curso con un coche de bicicleta y el servo real a ${fmt(SPEED, 2)} m/s: volante = atan(WHEELBASE · curvatura 10 cm por delante) − LATERAL_GAIN · error − kp · (rumbo − rumbo de la línea) − kd · giroscopio, con tope de 17,6°. En una esquina, una unidad de progreso son ${fmt(CORNER_UNITS, 3)} m.`),
    );
    svg.setAttribute('aria-label', 'Vista desde arriba: la línea planificada en verde y el camino del coche en ámbar');
    run();
  });
}
