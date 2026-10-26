// Widget "obstacle-field": the Obstacle field of the rules seen from above. The lane (lane.py: four 1 m straights and
// four quarter circles of 0.5 m), the progress (8 units per lap), the 24 seats of the signs (3 per straight, 2 rows)
// and the signs and the parking lot of a layout of the rules. Move the progress to see lane_pose and lane_normal.
import { button, fmt, guarded, h, legend, readout, slider, svgEl, toggle } from './lib/common';
import { CORNER_UNITS, INNER, OUTER, ROW, SEATS, LOT_END, LOT_LENGTH, LOT_DEPTH, laneNormal, lanePoint, lanePose } from './lib/obstacle';
import { layout } from './lib/obstacle-layouts';

const VW = 400, K = 120, M = 20; // px per metre; the field is 3 m (+ walls)
const RED = '#ee2737', GREEN = '#44d62c', LOT = '#d63ad6';
const deg = (r: number) => (r * 180) / Math.PI;

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let progress = 0.5, layoutN = 4, lot = false, cw = false, showSeats = true;
    const svg = svgEl('svg', { viewBox: `0 0 ${VW} ${VW}`, class: 'lw-svg lw-square', role: 'img' });
    const scene = svgEl('g');
    svg.append(scene);
    const rd = readout();
    // World frame -> SVG. A clockwise round is the counter-clockwise one in a mirror: the track frame mirrors x.
    const P = (x: number, y: number): [number, number] => [VW / 2 + x * K, VW / 2 - y * K];
    const T = (x: number, y: number): [number, number] => P(cw ? -x : x, y);   // track frame -> SVG

    function draw(): void {
      let out = '';
      const [ox, oy] = P(-OUTER, OUTER);
      out += `<rect class="lw-wall" x="${ox - 6}" y="${oy - 6}" width="${3 * K + 12}" height="${3 * K + 12}"/>`;
      out += `<rect class="lw-floor" x="${ox}" y="${oy}" width="${3 * K}" height="${3 * K}" fill="var(--lw-bg)"/>`;
      const [ix, iy] = P(-INNER, INNER);
      out += `<rect class="lw-wall" x="${ix}" y="${iy}" width="${K}" height="${K}"/>`;
      out += `<text class="lw-tag lw-c-muted" x="${VW / 2}" y="${VW / 2 + 4}" text-anchor="middle" fill="currentColor">isla</text>`;
      // the sections (dashed: where a straight meets a corner)
      for (const [x0, y0, x1, y1] of [[-0.5, -1.5, -0.5, -0.5], [0.5, -1.5, 0.5, -0.5], [0.5, -0.5, 1.5, -0.5], [0.5, 0.5, 1.5, 0.5],
        [0.5, 0.5, 0.5, 1.5], [-0.5, 0.5, -0.5, 1.5], [-1.5, 0.5, -0.5, 0.5], [-1.5, -0.5, -0.5, -0.5]]) {
        const [a, b] = P(x0, y0), [c, d] = P(x1, y1);
        out += `<line class="lw-grid" x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke-dasharray="3 4"/>`;
      }
      // the start section and the lot
      const lotX0 = LOT_END - LOT_LENGTH;   // obstacle_field.PARKING_LOT: the same place in both directions
      if (lot) {
        for (const x of [lotX0 - 0.02, lotX0 + LOT_LENGTH]) {
          const [a, b] = P(x, -OUTER + LOT_DEPTH);
          out += `<rect x="${a}" y="${b}" width="${0.02 * K}" height="${LOT_DEPTH * K}" fill="${LOT}"/>`;
        }
        const [a, b] = P(lotX0 + LOT_LENGTH / 2, -OUTER + LOT_DEPTH + 0.04);
        out += `<text class="lw-tag" x="${a}" y="${b}" text-anchor="middle" fill="${LOT}">aparcamiento 0,35 m</text>`;
      }
      // the lane, with the progress every unit
      const pts: string[] = [];
      for (let s = 0; s <= 8.0001; s += 0.05) pts.push(T(...lanePose(s).slice(0, 2) as [number, number]).map((v) => v.toFixed(1)).join(','));
      out += `<polyline class="lw-c-amber" points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="7 5" opacity="0.8"/>`;
      for (let s = 0; s < 8; s++) {
        const [x, y] = lanePoint(s, -0.17);
        const [a, b] = T(x, y);
        const [lx, ly] = T(...lanePose(s).slice(0, 2) as [number, number]);
        out += `<circle cx="${lx}" cy="${ly}" r="3" fill="var(--lw-amber)"/>`;
        out += `<text class="lw-tick" x="${a}" y="${b + 4}" text-anchor="middle">${s}</text>`;
      }
      // the seats: 12 positions x 2 rows (inner +0.1, outer -0.1)
      if (showSeats) {
        for (const s of SEATS) for (const row of [ROW, -ROW]) {
          const [a, b] = T(...lanePoint(s, row));
          out += `<rect x="${a - 3}" y="${b - 3}" width="6" height="6" fill="none" stroke="var(--lw-muted)" stroke-width="1"/>`;
        }
      }
      // the signs of the layout (world coordinates: they do not mirror)
      for (const sign of layout(layoutN, lot)) {
        const [a, b] = P(sign.x, sign.y);
        out += `<rect x="${a - 0.025 * K - 1}" y="${b - 0.025 * K - 1}" width="${0.05 * K + 2}" height="${0.05 * K + 2}" fill="${sign.color === 'red' ? RED : GREEN}" stroke="#0c0a07" stroke-width="1"/>`;
      }
      // the start and the direction of the round
      const [sx, sy] = P(cw ? 0.25 : -0.25, -1.0);
      out += `<text class="lw-tag lw-c-muted" x="${sx}" y="${sy + 30}" text-anchor="middle" fill="currentColor">salida</text>`;
      // the car at the progress: lane_pose, its heading and lane_normal
      const [x, y, heading] = lanePose(progress);
      const [nx, ny] = laneNormal(progress);
      const [cx, cy] = T(x, y);
      const hx = cw ? -Math.cos(heading) : Math.cos(heading), hy = Math.sin(heading);
      out += `<g class="lw-c-blue"><line x1="${cx}" y1="${cy}" x2="${cx + (cw ? -nx : nx) * 0.3 * K}" y2="${cy - ny * 0.3 * K}" stroke="currentColor" stroke-width="2"/>`;
      out += `<text class="lw-tag" x="${cx + (cw ? -nx : nx) * 0.36 * K}" y="${cy - ny * 0.36 * K + 4}" text-anchor="middle" fill="currentColor">normal</text></g>`;
      const rot = -deg(Math.atan2(hy, hx));
      out += `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${K})">`;
      out += `<rect x="-0.0852" y="-0.074" width="0.2329" height="0.148" rx="0.012" class="lw-body"/>`;
      out += `<path d="M 0.118 -0.03 L 0.148 0 L 0.118 0.03 Z" class="lw-nose"/></g>`;
      scene.innerHTML = out;

      const section = Math.floor(((progress % 8) + 8) % 8);
      const straight = section % 2 === 0;
      const names = ['de salida (abajo)', 'de la derecha', 'de arriba', 'de la izquierda'];
      const where = straight ? `recta ${names[section / 2]}` : `esquina tras la recta ${names[(section - 1) / 2]}`;
      const seat = SEATS.find((s) => Math.abs(s - progress) < 0.02);
      rd.set([
        ['progreso', `${fmt(progress, 2)} unidades`],
        ['dónde', where],
        ['lane_pose: x, y', `${fmt(cw ? -x : x, 2)}, ${fmt(y, 2)} m${cw ? ' (en espejo: horario)' : ''}`],
        ['rumbo del carril', `${fmt(deg(Math.atan2(hy, hx)), 0)}°`],
        ['1 unidad aquí', straight ? '1 m (recta)' : `${fmt(CORNER_UNITS, 3)} m (cuarto de círculo de 0,5 m)`],
        ['asiento', seat !== undefined ? `sí: progreso ${fmt(seat, 1)}, filas a ±0,1 m` : 'no (los asientos están en 2k, 2k + 0,5 y 2k + 1)'],
      ], `Progreso ${fmt(progress, 2)}: ${where}.`);
      prog.set(progress);
    }

    const prog = slider({ label: 'Progreso (unidades)', min: 0, max: 8, step: 0.05, value: progress, format: (v) => fmt(v, 2), onInput: (v) => { progress = v; draw(); } });
    const layoutSelect = h('select', { id: 'lw-of-layout' });
    for (let n = 0; n < 5; n++) layoutSelect.append(h('option', { value: n }, `Campo ${n}`));
    layoutSelect.value = String(layoutN);
    layoutSelect.addEventListener('change', () => { layoutN = Number(layoutSelect.value); draw(); });
    const dirSelect = h('select', { id: 'lw-of-dir' });
    dirSelect.append(h('option', { value: 'ccw' }, 'Antihorario'), h('option', { value: 'cw' }, 'Horario (en espejo)'));
    dirSelect.addEventListener('change', () => { cw = dirSelect.value === 'cw'; draw(); });
    const lotToggle = toggle('Con aparcamiento (las señales de la salida pasan a la fila interior)', lot, (v) => { lot = v; draw(); });
    const seatsToggle = toggle('Mostrar los 24 asientos', showSeats, (v) => { showSeats = v; draw(); });
    const field = (id: string, label: string, control: HTMLElement) => h('div', { class: 'lw-field' }, h('label', { for: id }, label), control);
    let timer = 0;
    const play = button('Recorrer una vuelta', () => {
      clearInterval(timer);
      progress = 0;
      timer = window.setInterval(() => { progress = Math.min(8, progress + 0.04); draw(); if (progress >= 8) clearInterval(timer); }, 30);
    }, 'lw-btn-primary');

    root.append(
      h('div', { class: 'lw-figure' }, svg),
      legend([['amber', 'carril y progreso (0 a 8)'], ['blue', 'lane_normal: hacia la isla'], ['muted', 'asientos: 3 por recta, filas a ±0,1 m del carril']]),
      rd.root,
      h('div', { class: 'lw-controls' }, prog.root, field('lw-of-layout', 'Campo del reglamento', layoutSelect), field('lw-of-dir', 'Sentido', dirSelect)),
      h('div', { class: 'lw-controls' }, lotToggle.root, seatsToggle.root),
      h('div', { class: 'lw-actions' }, play),
      h('p', { class: 'lw-note' }, 'Las señales son las de regulation_signs del curso (campos 0 a 4). El carril y el progreso son lane_pose y lane_normal de lane.py; en horario todo se trabaja en espejo (x → −x), como hace la estrategia.'),
    );
    svg.setAttribute('aria-label', 'El campo del Obstacle desde arriba: isla, carril con el progreso de 0 a 8, asientos de las señales, señales del campo elegido y el coche en el carril');
    draw();
  });
}
