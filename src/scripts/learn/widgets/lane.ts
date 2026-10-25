// Widget "lane": keep a fixed gap to the island wall. Port of lane.py (lateral_bias, lane_steer) and of the test bench
// drive_lane() with the real servo. The aim line shows lateral_bias(); the second plot shows what LIMIT does to it.
import { animate, button, createPlot, fmt, guarded, h, legend, mulberry32, readout, reducedMotion, slider, svgEl } from './lib/common';
import { GyroHeading, MiniCar, STEER_LIMIT, WHEELBASE, clamp, headingSteer } from './lib/sim';

const SECONDS = 14, DT = 0.02, SPEED_CMD = 0.6, WALL_Y = -0.5, OUTER_Y = -1.5;
const FRONT = 0.1477, REAR = 0.0852, HALF = 0.074;
const VW = 480, VH = 240, K = 200; // viewBox and px/m (a window 2.4 m x 1.2 m that follows the car)
const rad2deg = (r: number) => (r * 180) / Math.PI;

export interface Row {
  t: number;
  gap: number; // inner: distance to the island wall
  x: number;
  y: number;
  yaw: number;
  raw: number; // GAIN * (gap - GAP): what the law asks for before LIMIT
  bias: number; // lateral_bias(): clamp(raw, -LIMIT, LIMIT)
}

/** The 14 s bench: the car drives east along the island's south wall, the island on its left (sign = +1). */
export function simulate(startGap: number, gain: number, limit: number, target: number): Row[] {
  const car = new MiniCar(-1.0, WALL_Y - startGap, 0, { bias: 0.006, noise: 0.0019, rng: mulberry32(3) });
  const heading = new GyroHeading();
  heading.calibrate(car.restingGyro(30));
  const rows: Row[] = [];
  const n = Math.round(SECONDS / DT);
  for (let k = 0; k <= n; k++) {
    const g = (WALL_Y - car.y) * Math.cos(car.yaw); // distance to the island wall (the car is south of it)
    const raw = gain * (g - target);
    const bias = clamp(raw, -limit, limit); // lateral_bias(), island on the left
    rows.push({ t: k * DT, gap: g, x: car.x, y: car.y, yaw: car.yaw, raw, bias });
    if (k === n) break;
    car.step(SPEED_CMD, headingSteer(bias, heading.update(car.gyro(), DT)), DT); // lane_steer(0, yaw, inner)
  }
  return rows;
}

/** Seconds after which the gap stays within +-2 cm of the target until the end, or null when it does not get there. */
export function settleTime(rows: Row[], target: number): number | null {
  let settle: number | null = null;
  for (let i = rows.length - 1; i >= 0 && Math.abs(rows[i].gap - target) < 0.02; i--) settle = rows[i].t;
  return settle;
}

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    const DEFAULTS = { startGap: 0.45, gain: 0.3, limit: 0.4, target: 0.25 };
    let { startGap, gain, limit, target } = DEFAULTS;
    let rows: Row[] = [];
    let index = 0;
    let cancel: (() => void) | null = null;

    const svg = svgEl('svg', { viewBox: `0 0 ${VW} ${VH}`, class: 'lw-svg', role: 'img' });
    const scene = svgEl('g');
    svg.append(scene);
    const gapPlot = createPlot({
      xmin: 0,
      xmax: SECONDS,
      xlabel: 'tiempo (s)',
      ylabel: 'hueco a la isla (m)',
      aria: 'Gráfico del hueco entre el coche y la pared de la isla a lo largo del tiempo',
      digitsY: 2,
    });
    const biasPlot = createPlot({
      xmin: 0,
      xmax: SECONDS,
      xlabel: 'tiempo (s)',
      ylabel: 'desvío de rumbo (°)',
      aria: 'Gráfico del desvío de rumbo que pide la ley y el que se aplica tras el límite, a lo largo del tiempo',
      digitsY: 1,
    });
    const rd = readout();
    const scrub = slider({
      label: 'Instante',
      min: 0,
      max: SECONDS,
      step: DT * 5,
      value: 0,
      format: (v) => `${fmt(v, 1)} s`,
      onInput: (v) => {
        cancel?.();
        cancel = null;
        index = Math.round(v / DT);
        draw();
      },
    });

    function draw(): void {
      if (!rows.length) return;
      const r = rows[Math.min(index, rows.length - 1)];
      const cx = r.x + 0.55, cy = -0.95;
      const P = (x: number, y: number): [number, number] => [VW / 2 + (x - cx) * K, VH / 2 - (y - cy) * K];
      let out = '';
      // island (above the wall line) and outer wall (below the field)
      const [, wy] = P(0, WALL_Y), [, oy] = P(0, OUTER_Y);
      out += `<rect class="lw-wall" x="0" y="0" width="${VW}" height="${wy}"/>`;
      out += `<rect class="lw-wall" x="0" y="${oy}" width="${VW}" height="${VH - oy}"/>`;
      out += `<line class="lw-edge" x1="0" y1="${wy}" x2="${VW}" y2="${wy}"/>`;
      for (let gx = Math.ceil((cx - 1.3) / 0.5) * 0.5; gx <= cx + 1.3; gx += 0.5) {
        const [px] = P(gx, 0);
        out += `<line class="lw-grid" x1="${px}" y1="${wy}" x2="${px}" y2="${oy}"/>`;
        out += `<text class="lw-tick" x="${px + 3}" y="${oy - 4}">${fmt(gx, 1)} m</text>`;
      }
      const [, ty] = P(0, WALL_Y - target);
      out += `<g class="lw-c-green"><line x1="0" y1="${ty}" x2="${VW}" y2="${ty}" stroke="currentColor" stroke-width="1.5" stroke-dasharray="7 5"/><text class="lw-tag" x="${VW - 6}" y="${ty + 14}" text-anchor="end" fill="currentColor">GAP = ${fmt(target, 2)} m</text></g>`;
      out += `<text class="lw-tag lw-c-muted" x="6" y="16" fill="currentColor">isla</text>`;
      // trail
      const pts: string[] = [];
      for (let i = 0; i <= index; i += 5) pts.push(P(rows[i].x, rows[i].y).map((v) => v.toFixed(1)).join(','));
      if (pts.length > 1) out += `<polyline class="lw-c-amber" points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="2" opacity="0.8"/>`;
      // measured gap
      const [px, py] = P(r.x, r.y);
      out += `<g class="lw-c-blue"><line x1="${px}" y1="${py}" x2="${px}" y2="${wy}" stroke="currentColor" stroke-width="1.5"/><text class="lw-tag" x="${px + 5}" y="${(py + wy) / 2 + 4}" fill="currentColor">inner ${fmt(r.gap, 2)} m</text></g>`;
      // the aim: goal heading (0) and goal + lateral_bias, drawn from the car at their true angles
      const reach = 0.85 * K;
      const ray = (angle: number) => `x2="${(px + reach * Math.cos(angle)).toFixed(1)}" y2="${(py - reach * Math.sin(angle)).toFixed(1)}"`;
      out += `<line class="lw-c-muted" x1="${px}" y1="${py}" ${ray(0)} stroke="currentColor" stroke-width="1" stroke-dasharray="2 4"/>`;
      const clipped = Math.abs(r.raw) > Math.abs(r.bias) + 1e-9;
      if (clipped) {
        const rx = px + reach * Math.cos(r.raw), ry = py - reach * Math.sin(r.raw);
        out += `<g class="lw-c-red"><line x1="${px}" y1="${py}" x2="${rx.toFixed(1)}" y2="${ry.toFixed(1)}" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 4"/>`;
        out += `<text class="lw-tag" x="${(rx + 5).toFixed(1)}" y="${(ry + (r.raw > r.bias ? -4 : 12)).toFixed(1)}" fill="currentColor">sin LIMIT ${fmt(rad2deg(r.raw), 1)}°</text></g>`;
      }
      const tipX = px + reach * Math.cos(r.bias), tipY = py - reach * Math.sin(r.bias);
      out += `<g class="lw-c-violet"><line x1="${px}" y1="${py}" x2="${tipX.toFixed(1)}" y2="${tipY.toFixed(1)}" stroke="currentColor" stroke-width="2.2"/>`;
      out += `<text class="lw-tag" x="${(tipX + 5).toFixed(1)}" y="${(tipY + (clipped ? (r.raw > r.bias ? 12 : -4) : r.bias >= 0 ? -4 : 12)).toFixed(1)}" fill="currentColor">meta + desvío ${fmt(rad2deg(r.bias), 1)}°</text></g>`;
      // car
      const deg = (-r.yaw * 180) / Math.PI;
      out += `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${deg.toFixed(2)}) scale(${K})">`;
      out += `<rect x="${-REAR}" y="${-HALF}" width="${FRONT + REAR}" height="${2 * HALF}" rx="0.012" class="lw-body"/>`;
      out += `<path d="M ${FRONT - 0.03} -0.03 L ${FRONT} 0 L ${FRONT - 0.03} 0.03 Z" class="lw-nose"/></g>`;
      scene.innerHTML = out;
      scrub.set(r.t);

      const every = (_: Row, i: number) => i % 5 === 0;
      const shown = rows.slice(0, index + 1);
      const gaps = rows.map((q) => q.gap);
      const lo = Math.min(0, ...gaps), hi = Math.max(...gaps, target) * 1.12 + 0.02;
      gapPlot.update({
        ymin: Math.floor(lo * 20) / 20,
        ymax: Math.ceil(hi * 20) / 20,
        hlines: [{ y: target, label: `GAP ${fmt(target, 2)}`, color: 'green' }],
        series: [
          { color: 'muted', dashed: true, points: rows.filter(every).map((q) => [q.t, q.gap]) },
          { color: 'amber', points: shown.filter((q, i) => every(q, i) || i === index).map((q) => [q.t, q.gap]) },
        ],
        marker: { x: r.t, y: r.gap, color: 'blue' },
      });
      // the offset: what the law asks for (dashed) and what is applied after LIMIT (solid)
      const raws = rows.map((q) => rad2deg(q.raw));
      const limitDeg = rad2deg(limit);
      const rawTop = Math.max(...raws, 1);
      const bLo = Math.min(0, ...raws), bHi = rawTop >= 0.5 * limitDeg ? Math.max(rawTop, limitDeg) : rawTop; // the LIMIT line only when it matters
      const span = bHi - bLo;
      biasPlot.update({
        ymin: Math.floor((bLo - 0.05 * span) * 2) / 2,
        ymax: Math.ceil((bHi + 0.18 * span) * 2) / 2,
        hlines: [{ y: limitDeg, label: `LIMIT ${fmt(limitDeg, 1)}°`, color: 'red' }],
        series: [
          { color: 'muted', dashed: true, points: rows.filter(every).map((q) => [q.t, rad2deg(q.raw)]) },
          { color: 'violet', points: shown.filter((q, i) => every(q, i) || i === index).map((q) => [q.t, rad2deg(q.bias)]) },
        ],
        marker: { x: r.t, y: rad2deg(r.bias), color: 'violet' },
      });
      numbers(r);
    }

    function numbers(r: Row): void {
      const end = rows[rows.length - 1];
      const settle = settleTime(rows, target);
      const minGap = Math.min(...rows.map((q) => q.gap));
      const touches = minGap < HALF;
      const clipped = Math.abs(r.raw) > Math.abs(r.bias) + 1e-9;
      const both = (v: number) => `${fmt(v, 3)} rad (${fmt(rad2deg(v), 1)}°)`;
      const rowsOut: [string, string][] = [
        ['Hueco ahora (inner)', `${fmt(r.gap, 3)} m`],
        ['Error, inner − GAP', `${fmt(r.gap - target, 3)} m`],
        ['Lo que pide la ley, GAIN · error', both(r.raw)],
        ['lateral_bias, tras LIMIT', `${both(r.bias)}${clipped ? ' (LIMIT lo recorta)' : ''}`],
        ['Entra en ±2 cm a los', settle !== null ? `${fmt(settle, 1)} s` : `no llega en ${SECONDS} s`],
        ['Hueco más pequeño', `${fmt(minGap, 3)} m${touches ? ' (roza la isla)' : ''}`],
      ];
      rd.set(
        rowsOut,
        `Hueco final ${fmt(end.gap, 2)} metros. ${settle !== null ? `Llega a ±2 centímetros a los ${fmt(settle, 1)} segundos.` : `No llega a ±2 centímetros en ${SECONDS} segundos.`}${touches ? ' El coche roza la isla.' : ''}${clipped ? ' El límite recorta el desvío en este instante.' : ''}`,
      );
    }

    function rerun(replay: boolean): void {
      cancel?.();
      cancel = null;
      rows = simulate(startGap, gain, limit, target);
      if (!replay || reducedMotion()) {
        index = rows.length - 1;
        draw();
        return;
      }
      index = 0;
      draw();
      cancel = animate(
        SECONDS * 1000 / 3,
        (t) => {
          index = Math.round(t * (rows.length - 1));
          draw();
        },
        () => {
          cancel = null;
        },
      );
    }

    // sliders, and "Prueba esto" buttons that set them from the text
    const marked: HTMLButtonElement[] = [];
    const unmark = () => marked.forEach((q) => { q.classList.remove('lw-btn-on'); q.setAttribute('aria-pressed', 'false'); });
    const mk = (label: string, min: number, max: number, step: number, value: number, unit: string, digits: number, set: (v: number) => void) =>
      slider({
        label,
        min,
        max,
        step,
        value,
        format: (v) => `${fmt(v, digits)}${unit}`,
        onInput: (v) => {
          set(v);
          unmark();
          rerun(true);
        },
      });
    const sStart = mk('Hueco inicial (m)', 0.1, 0.8, 0.01, startGap, ' m', 2, (v) => (startGap = v));
    const sGain = mk('GAIN (rad por metro)', 0, 3, 0.05, gain, '', 2, (v) => (gain = v));
    const sLimit = mk('LIMIT (rad)', 0.05, 0.8, 0.05, limit, '', 2, (v) => (limit = v));
    const sTarget = mk('GAP (hueco buscado)', 0.1, 0.5, 0.01, target, ' m', 2, (v) => (target = v));
    const hint = h('p', { class: 'lw-caption lw-lane-hint', role: 'status' }, 'Elige una prueba y mira el hueco y el desvío.');
    const apply = (v: Partial<typeof DEFAULTS>) => {
      ({ startGap, gain, limit, target } = { ...DEFAULTS, ...v });
      sStart.set(startGap);
      sGain.set(gain);
      sLimit.set(limit);
      sTarget.set(target);
      rerun(true);
    };
    function trial(name: string, say: string, v: Partial<typeof DEFAULTS>): HTMLButtonElement {
      const b = button(name, () => {
        apply(v);
        unmark();
        hint.textContent = say;
        b.classList.add('lw-btn-on');
        b.setAttribute('aria-pressed', 'true');
      });
      b.setAttribute('aria-pressed', 'false');
      marked.push(b);
      return b;
    }
    const trials = h('div', { class: 'lw-actions' },
      trial('GAIN 0', 'Sin ganancia el desvío es 0 siempre: el coche no corrige y se queda donde salió (0,456 m a los 14 s en el banco).', { gain: 0 }),
      trial('GAIN 0,3 (curso)', 'La del curso: el hueco baja de 0,45 a 0,29 m en 14 s, sin pasarse de 0,25. Lenta, pero segura.', {}),
      trial('GAIN 1,0', 'Con 1,0 el hueco entra en ±2 cm en unos 5 s (el banco de Python da 5,2 s) y se queda.', { gain: 1 }),
      trial('GAIN 3,0', 'Con 3,0 entra casi al instante (el banco da 1,9 s). Aquí el hueco se lee exacto; con el LiDAR y su ruido, en el laboratorio previo 1 ronda de 6 rozó la isla con 3,0 (no se repitió en Gazebo).', { gain: 3 }),
      trial('Lejos, LIMIT 0,40', 'Desde 0,80 m el error es 0,55 m y la ley pide 0,165 rad (9,5°): no llega a 0,40, así que LIMIT no actúa. A los 14 s el hueco es unos 0,35 m.', { startGap: 0.8 }),
      trial('Lejos, LIMIT 0,05', 'Con LIMIT 0,05 (2,9°) la línea roja es lo que pedía la ley y la violeta lo que se aplica: el límite recorta el desvío y a los 14 s el hueco sigue en unos 0,52 m.', { startGap: 0.8, limit: 0.05 }),
    );

    const controls = h('div', { class: 'lw-controls' }, sStart.root, sGain.root, sLimit.root, sTarget.root);
    const group = (title: string, ...kids: HTMLElement[]) => {
      const f = h('fieldset', { class: 'lw-group' }, h('legend', {}, title));
      f.append(...kids);
      return f;
    };

    root.append(
      h('div', { class: 'lw-figure' }, svg),
      legend([
        ['amber', 'recorrido del coche'],
        ['blue', 'inner: hueco medido'],
        ['green', 'GAP: hueco buscado'],
        ['violet', 'meta + lateral_bias (hacia donde apunta la ley)'],
        ['red', 'lo que pediría sin LIMIT'],
      ]),
      group('Prueba esto', trials, hint),
      h('div', { class: 'lw-pair' }, h('div', { class: 'lw-figure' }, gapPlot.svg), h('div', { class: 'lw-figure' }, biasPlot.svg)),
      legend([
        ['amber', 'hueco hasta ahora'],
        ['violet', 'lateral_bias aplicado'],
        ['muted', 'recorrido completo / lo que pide la ley sin LIMIT'],
      ]),
      rd.root,
      group('Cambia los valores', controls, h('div', { class: 'lw-controls' }, scrub.root)),
      h('div', { class: 'lw-actions' },
        button('Reproducir de nuevo', () => rerun(true), 'lw-btn-primary'),
        button('Volver a los valores del curso', () => { apply({}); unmark(); hint.textContent = 'Elige una prueba y mira el hueco y el desvío.'; }),
      ),
      h('p', { class: 'lw-note' }, `Ley: lateral_bias = clamp(GAIN · (inner − GAP), ±LIMIT); el volante sigue el rumbo meta (0) + lateral_bias con KP 0,8. Modelo de bicicleta con el servo real (tope ${fmt(rad2deg(STEER_LIMIT), 1)}°, batalla ${fmt(WHEELBASE, 4)} m), velocidad de comando 0,6 y la isla a la izquierda. La línea punteada gris es el rumbo meta, 0°.`),
    );
    svg.setAttribute('aria-label', 'Vista desde arriba: el coche avanza hacia el este junto a la pared de la isla, con una línea que muestra hacia dónde apunta la ley, y converge al hueco buscado');
    rerun(true);
  });
}
