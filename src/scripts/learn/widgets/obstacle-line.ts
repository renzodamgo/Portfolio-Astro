// Widget "obstacle-line": the line of a straight (plan.py). Choose the sign on each seat; the line holds its side offset
// from HOLD before to HOLD after every sign (side_offset: red on the right, green on the left, away from it when the
// colour is unknown) and ramps in between (offset_at). An unknown sign at the start of the next straight gets a lookout.
// The lane is drawn unrolled: progress across, lateral offset up (+ toward the island).
import { button, fmt, guarded, h, legend, readout, slider, svgEl } from './lib/common';
import { HOLD, HW, OFFSET_LIMIT, OUTLINE_FRONT, OUTLINE_REAR, SIGN_HALF, signKnots, sortKnots, offsetAt, withOffsets, type Colour, type Signs } from './lib/obstacle';

const VW = 640, VH = 300, L = 40, R = 16, T = 26, B = 46;
const S0 = -0.35, S1 = 2.35;            // progress window: the straight, its corner and the start of the next one
const RED = '#ee2737', GREEN = '#44d62c';
const SEAT_PROGRESS = [0, 0.5, 1, 2];
type Choice = 'none' | 'red-in' | 'red-out' | 'green-in' | 'green-out' | 'unk-in' | 'unk-out';
const CHOICES: [Choice, string][] = [
  ['none', 'sin señal'], ['red-in', 'roja, fila interior'], ['red-out', 'roja, fila exterior'], ['green-in', 'verde, fila interior'],
  ['green-out', 'verde, fila exterior'], ['unk-in', 'color desconocido, interior'], ['unk-out', 'color desconocido, exterior'],
];
const parse = (c: Choice): [number, Colour] | null => {
  if (c === 'none') return null;
  const lateral = c.endsWith('in') ? 0.1 : -0.1;
  return [lateral, c.startsWith('red') ? 'red' : c.startsWith('green') ? 'green' : null];
};

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    const DEFAULT: Choice[] = ['none', 'red-in', 'none', 'none'];
    let seats: Choice[] = ['red-in', 'none', 'green-out', 'none'];
    let clearance = 0.18;               // pillar_clearance (m from the sign to the car's side)
    let at = 0.0;                       // where the car is drawn (progress)
    const sx = (s: number) => L + ((s - S0) / (S1 - S0)) * (VW - L - R);
    const sy = (d: number) => T + ((0.5 - d) / 1.0) * (VH - T - B);
    const svg = svgEl('svg', { viewBox: `0 0 ${VW} ${VH}`, class: 'lw-svg', role: 'img' });
    const scene = svgEl('g');
    svg.append(scene);
    const rd = readout();

    function compute() {
      const signs: Signs = new Map();
      seats.forEach((c, i) => { const p = parse(c); if (p) signs.set(SEAT_PROGRESS[i], p); });
      const withOff = withOffsets(signs, clearance + HW);
      const knots = sortKnots(signKnots(withOff, -0.4));
      return { withOff, knots };
    }

    function draw(): void {
      const { withOff, knots } = compute();
      let out = '';
      // island and outer wall (the lane is 1 m: 0.5 to each side), the corner region
      out += `<rect class="lw-wall" x="${L}" y="0" width="${VW - L - R}" height="${sy(0.5)}"/>`;
      out += `<rect class="lw-wall" x="${L}" y="${sy(-0.5)}" width="${VW - L - R}" height="${VH - B - sy(-0.5) + 8}"/>`;
      out += `<rect x="${sx(1)}" y="${sy(0.5)}" width="${sx(2) - sx(1)}" height="${sy(-0.5) - sy(0.5)}" fill="var(--lw-panel)"/>`;
      out += `<text class="lw-tag lw-c-muted" x="${(sx(1) + sx(2)) / 2}" y="${sy(-0.42)}" text-anchor="middle" fill="currentColor">esquina (paso 5)</text>`;
      out += `<text class="lw-tag lw-c-muted" x="${L + 6}" y="${sy(0.5) - 6}" fill="currentColor">isla</text>`;
      out += `<text class="lw-tag lw-c-muted" x="${L + 6}" y="${sy(-0.5) + 16}" fill="currentColor">muro exterior</text>`;
      out += `<line class="lw-grid" x1="${L}" y1="${sy(0)}" x2="${VW - R}" y2="${sy(0)}" stroke-dasharray="6 5"/>`;
      for (const lim of [OFFSET_LIMIT, -OFFSET_LIMIT]) out += `<line class="lw-grid" x1="${L}" y1="${sy(lim)}" x2="${VW - R}" y2="${sy(lim)}" stroke-dasharray="2 5"/>`;
      for (let s = 0; s <= 2; s += 0.5) {
        out += `<line class="lw-grid" x1="${sx(s)}" y1="${sy(-0.5)}" x2="${sx(s)}" y2="${sy(-0.5) + 6}"/><text class="lw-tick" x="${sx(s)}" y="${sy(-0.5) + 30}" text-anchor="middle">${fmt(s, 1)}</text>`;
      }
      out += `<text class="lw-axis" x="${(L + VW - R) / 2}" y="${VH - 4}" text-anchor="middle">progreso (unidades) · arriba: hacia la isla</text>`;
      // seats (empty squares) and signs
      for (const s of SEAT_PROGRESS) for (const row of [0.1, -0.1]) {
        out += `<rect x="${sx(s) - 4}" y="${sy(row) - 4}" width="8" height="8" fill="none" stroke="var(--lw-muted)"/>`;
      }
      for (const [s, [lateral, colour, offset]] of withOff) {
        const half = (SIGN_HALF / 1.0) * (VH - T - B);
        out += `<rect x="${sx(s) - 7}" y="${sy(lateral) - half}" width="14" height="${2 * half}" fill="${colour === 'red' ? RED : colour === 'green' ? GREEN : 'var(--lw-muted)'}" stroke="#0c0a07"/>`;
        if (colour === null) out += `<text class="lw-tag" x="${sx(s)}" y="${sy(lateral) + 4}" text-anchor="middle" fill="#0c0a07">?</text>`;
        out += `<text class="lw-tag lw-c-amber" x="${sx(s)}" y="${sy(offset) + (offset > lateral ? -8 : 16)}" text-anchor="middle" fill="currentColor">${fmt(offset, 3)} m</text>`;
      }
      // the hold of each sign
      for (const [s] of withOff) out += `<rect x="${sx(s - HOLD)}" y="${T - 14}" width="${sx(s + HOLD) - sx(s - HOLD)}" height="5" fill="var(--lw-amber)" opacity="0.5"/>`;
      // the line (offset_at)
      const pts: string[] = [];
      for (let s = S0; s <= S1 + 1e-9; s += 0.01) pts.push(`${sx(s).toFixed(1)},${sy(offsetAt(knots, s)).toFixed(1)}`);
      out += `<polyline class="lw-c-amber" points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="3"/>`;
      for (const [s, d] of knots) out += `<circle cx="${sx(s)}" cy="${sy(d)}" r="3.5" fill="var(--lw-amber)" stroke="#0c0a07"/>`;
      // the car on the line (unrolled: it points along the lane)
      const d = offsetAt(knots, at);
      const x0 = sx(at - OUTLINE_REAR), x1 = sx(at + OUTLINE_FRONT), y0 = sy(d + HW), y1 = sy(d - HW);
      out += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" class="lw-body" opacity="0.7" style="stroke-width:1"/>`;
      scene.innerHTML = out;

      // margin to every sign while the car passes it (the car on the line, from its centre)
      const rows: [string, string, string?][] = [];
      let worst = Infinity;
      for (const [s, [lateral, colour, offset]] of withOff) {
        const dHere = offsetAt(knots, s);
        const gap = Math.abs(dHere - lateral) - HW - SIGN_HALF;
        const side = dHere < lateral ? 'derecha' : 'izquierda';
        const wrong = colour !== null && ((colour === 'red') !== (dHere < lateral));
        worst = Math.min(worst, wrong ? -gap : gap);
        rows.push([`señal en ${fmt(s, 1)} (${colour === 'red' ? 'roja' : colour === 'green' ? 'verde' : 'color desconocido'}, fila ${lateral > 0 ? 'interior' : 'exterior'})`,
          `${fmt(offset, 3)} m → pasa por su ${side}, ${fmt(gap * 100, 1)} cm libres${wrong ? ' · ¡LADO EQUIVOCADO!' : ''}`, wrong ? 'red' : undefined]);
      }
      rows.push(['coche en', `progreso ${fmt(at, 2)}, desplazamiento ${fmt(d, 3)} m`]);
      rd.set(rows, withOff.size ? `La línea pasa ${withOff.size} señales; el menor hueco es ${fmt(worst * 100, 1)} centímetros.` : 'Sin señales la línea va por el centro del carril.');
      pos.set(at);
    }

    const selects = SEAT_PROGRESS.map((s, i) => {
      const id = `lw-ol-${i}-${Math.random().toString(36).slice(2, 7)}`;
      const sel = h('select', { id });
      for (const [v, label] of CHOICES) sel.append(h('option', { value: v }, label));
      sel.value = seats[i];
      sel.addEventListener('change', () => { seats[i] = sel.value as Choice; draw(); });
      const where = i < 3 ? ['inicio de la recta (2k)', 'mitad (2k + 0,5)', 'final (2k + 1)'][i] : 'inicio de la siguiente (2k + 2)';
      return { sel, root: h('div', { class: 'lw-field' }, h('label', { for: id }, `Asiento en ${fmt(s, 1)}: ${where}`), sel) };
    });
    const clear = slider({ label: 'pillar_clearance (m hasta el costado del coche)', min: 0.08, max: 0.3, step: 0.01, value: clearance, format: (v) => `${fmt(v, 2)} m`, onInput: (v) => { clearance = v; draw(); } });
    const pos = slider({ label: 'Coche en el progreso', min: S0 + 0.1, max: S1 - 0.1, step: 0.01, value: at, format: (v) => fmt(v, 2), onInput: (v) => { at = v; draw(); } });
    const preset = (label: string, v: Choice[], c = 0.18) => button(label, () => {
      seats = [...v]; clearance = c; selects.forEach((s, i) => { s.sel.value = seats[i]; }); clear.set(c); draw();
    });
    root.append(
      h('div', { class: 'lw-figure' }, svg),
      legend([['amber', 'la línea planificada (offset_at) y sus nudos'], ['muted', 'asientos y el límite ±0,36 m']]),
      rd.root,
      h('div', { class: 'lw-controls' }, ...selects.map((s) => s.root)),
      h('div', { class: 'lw-controls' }, clear.root, pos.root),
      h('div', { class: 'lw-actions' },
        preset('Roja interior y verde exterior', ['red-in', 'none', 'green-out', 'none']),
        preset('Cruzar el carril', ['green-in', 'none', 'red-out', 'none']),
        preset('Color desconocido', ['unk-in', 'none', 'none', 'none']),
        preset('Mirar por adelantado', ['none', 'none', 'none', 'unk-in']),
        preset('Una sola señal', DEFAULT),
      ),
      h('p', { class: 'lw-note' }, `side_offset: roja = fila − (margen + 0,074 m de medio coche), verde = fila + (margen + 0,074), limitado a ±0,36 m; sin color, 0,12 m lejos de su fila. Cada señal se sostiene ${fmt(HOLD, 2)} unidades antes y después; entre señales, rampas rectas. Es plan.py del curso.`),
    );
    svg.setAttribute('aria-label', 'La línea de una recta desenrollada: el progreso a lo ancho, el desplazamiento lateral hacia arriba, las señales en sus asientos y la línea que las pasa por su lado');
    draw();
  });
}
