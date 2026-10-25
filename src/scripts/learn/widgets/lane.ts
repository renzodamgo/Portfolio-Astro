// Widget "lane": keep a fixed gap to the island wall. Port of step_03_lane.py (drive_lane) with the real servo.
import { animate, button, createPlot, fmt, guarded, h, legend, mulberry32, readout, reducedMotion, slider, svgEl } from './lib/common';
import { GyroHeading, MiniCar, STEER_LIMIT, WHEELBASE, clamp, headingSteer } from './lib/sim';

const SECONDS = 14, DT = 0.02, SPEED_CMD = 0.6, WALL_Y = -0.5, OUTER_Y = -1.5;
const FRONT = 0.1477, REAR = 0.0852, HALF = 0.074;
const VW = 480, VH = 240, K = 200; // viewBox and px/m (a window 2.4 m x 1.2 m that follows the car)

interface Row { t: number; gap: number; x: number; y: number; yaw: number }

function simulate(startGap: number, gain: number, limit: number, target: number): Row[] {
  const car = new MiniCar(-1.0, WALL_Y - startGap, 0, { bias: 0.006, noise: 0.0019, rng: mulberry32(3) });
  const heading = new GyroHeading();
  heading.calibrate(car.restingGyro(30));
  const rows: Row[] = [];
  const n = Math.round(SECONDS / DT);
  for (let k = 0; k <= n; k++) {
    const g = (WALL_Y - car.y) * Math.cos(car.yaw); // distance to the island wall (the car is south of it)
    rows.push({ t: k * DT, gap: g, x: car.x, y: car.y, yaw: car.yaw });
    if (k === n) break;
    const offset = clamp(gain * (g - target), -limit, limit); // lateral_bias(), island on the left
    car.step(SPEED_CMD, headingSteer(offset, heading.update(car.gyro(), DT)), DT);
  }
  return rows;
}

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let startGap = 0.45, gain = 0.3, limit = 0.4, target = 0.25;
    let rows: Row[] = [];
    let index = 0;
    let cancel: (() => void) | null = null;

    const svg = svgEl('svg', { viewBox: `0 0 ${VW} ${VH}`, class: 'lw-svg', role: 'img' });
    const scene = svgEl('g');
    svg.append(scene);
    const plot = createPlot({
      xmin: 0,
      xmax: SECONDS,
      xlabel: 'tiempo (s)',
      ylabel: 'hueco a la isla (m)',
      aria: 'Gráfico del hueco entre el coche y la pared de la isla a lo largo del tiempo',
      digitsY: 2,
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
      out += `<g class="lw-c-green"><line x1="0" y1="${ty}" x2="${VW}" y2="${ty}" stroke="currentColor" stroke-width="1.5" stroke-dasharray="7 5"/><text class="lw-tag" x="${VW - 6}" y="${ty + 14}" text-anchor="end" fill="currentColor">hueco buscado ${fmt(target, 2)} m</text></g>`;
      out += `<text class="lw-tag lw-c-muted" x="6" y="16" fill="currentColor">isla</text>`;
      // trail
      const pts: string[] = [];
      for (let i = 0; i <= index; i += 5) pts.push(P(rows[i].x, rows[i].y).map((v) => v.toFixed(1)).join(','));
      if (pts.length > 1) out += `<polyline class="lw-c-amber" points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="2" opacity="0.8"/>`;
      // measured gap
      const [px, py] = P(r.x, r.y);
      out += `<g class="lw-c-blue"><line x1="${px}" y1="${py}" x2="${px}" y2="${wy}" stroke="currentColor" stroke-width="1.5"/><text class="lw-tag" x="${px + 5}" y="${(py + wy) / 2 + 4}" fill="currentColor">${fmt(r.gap, 2)} m</text></g>`;
      // car
      const deg = (-r.yaw * 180) / Math.PI;
      out += `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${deg.toFixed(2)}) scale(${K})">`;
      out += `<rect x="${-REAR}" y="${-HALF}" width="${FRONT + REAR}" height="${2 * HALF}" rx="0.012" class="lw-body"/>`;
      out += `<path d="M ${FRONT - 0.03} -0.03 L ${FRONT} 0 L ${FRONT - 0.03} 0.03 Z" class="lw-nose"/></g>`;
      scene.innerHTML = out;
      scrub.set(r.t);

      const shown = rows.slice(0, index + 1);
      const gaps = rows.map((q) => q.gap);
      const lo = Math.min(0, ...gaps), hi = Math.max(...gaps, target) * 1.12 + 0.02;
      plot.update({
        ymin: Math.floor(lo * 20) / 20,
        ymax: Math.ceil(hi * 20) / 20,
        hlines: [{ y: target, label: `buscado ${fmt(target, 2)}`, color: 'green' }],
        series: [
          { color: 'muted', dashed: true, points: rows.filter((_, i) => i % 5 === 0).map((q) => [q.t, q.gap]) },
          { color: 'amber', points: shown.filter((_, i) => i % 5 === 0 || i === index).map((q) => [q.t, q.gap]) },
        ],
        marker: { x: r.t, y: r.gap, color: 'blue' },
      });
      numbers(r);
    }

    function numbers(r: Row): void {
      const offset = clamp(gain * (r.gap - target), -limit, limit);
      const end = rows[rows.length - 1];
      let settle = SECONDS;
      for (let i = rows.length - 1; i >= 0 && Math.abs(rows[i].gap - target) < 0.02; i--) settle = rows[i].t;
      const settled = Math.abs(end.gap - target) < 0.02;
      const minGap = Math.min(...rows.map((q) => q.gap));
      const touches = minGap < HALF;
      const rowsOut: [string, string][] = [
        ['Hueco ahora', `${fmt(r.gap, 3)} m`],
        ['Desvío de rumbo pedido', `${fmt((offset * 180) / Math.PI, 1)}°`],
        ['Entra en ±2 cm a los', settled ? `${fmt(settle, 1)} s` : 'no llega en 14 s'],
        ['Hueco más pequeño', `${fmt(minGap, 3)} m${touches ? ' (roza la isla)' : ''}`],
      ];
      rd.set(
        rowsOut,
        `Hueco final ${fmt(end.gap, 2)} metros. ${settled ? `Llega a ±2 centímetros a los ${fmt(settle, 1)} segundos.` : 'No llega a ±2 centímetros en 14 segundos.'}${touches ? ' El coche roza la isla.' : ''}`,
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
          rerun(true);
        },
      });

    const controls = h(
      'div',
      { class: 'lw-controls' },
      mk('Hueco inicial', 0.1, 0.8, 0.01, startGap, ' m', 2, (v) => (startGap = v)).root,
      mk('GAIN (rad por metro)', 0.05, 1, 0.05, gain, '', 2, (v) => (gain = v)).root,
      mk('LIMIT (rad)', 0.05, 0.8, 0.05, limit, '', 2, (v) => (limit = v)).root,
      mk('GAP (hueco buscado)', 0.1, 0.5, 0.01, target, ' m', 2, (v) => (target = v)).root,
    );

    root.append(
      h('div', { class: 'lw-figure' }, svg),
      h('div', { class: 'lw-figure' }, plot.svg),
      legend([
        ['amber', 'hueco medido hasta ahora'],
        ['muted', 'recorrido completo'],
        ['green', 'hueco buscado'],
      ]),
      controls,
      h('div', { class: 'lw-controls' }, scrub.root),
      h('div', { class: 'lw-actions' }, button('Reproducir de nuevo', () => rerun(true), 'lw-btn-primary')),
      rd.root,
      h('p', { class: 'lw-note' }, `Ley: desvío = clamp(GAIN · (hueco − GAP), ±LIMIT); la dirección sigue el rumbo meta + desvío con KP 0,8. Modelo de bicicleta con el servo real (tope ${fmt((STEER_LIMIT * 180) / Math.PI, 1)}°, batalla ${fmt(WHEELBASE, 4)} m).`),
    );
    svg.setAttribute('aria-label', 'Vista desde arriba: el coche avanza hacia el este junto a la pared de la isla y converge al hueco buscado');
    rerun(true);
  });
}
