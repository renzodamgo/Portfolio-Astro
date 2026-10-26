// Widget "obstacle-signs": find the signs with the LiDAR, colour them with the camera, remember them by seat (signs.py).
// The car drives a lap of the lane; every LiDAR scan files the signs ahead (up to the look-ahead, 1.8 m) under their
// seat, and the camera (66.7 deg wide, turned 4.4 deg left, 2 m at most: the real one) votes their colour when it sees
// them. A seat counts as a sign after two sightings. Simplified: positions are exact here; the course's code fits them.
import { animate, button, fmt, guarded, h, legend, readout, reducedMotion, slider, svgEl } from './lib/common';
import { INNER, OUTER, ROW, SEATS, lanePoint, lanePose, wrap } from './lib/obstacle';
import { layout } from './lib/obstacle-layouts';

const VW = 400, K = 120;
const RED = '#ee2737', GREEN = '#44d62c';
const CAM_X = 0.0565, CAM_YAW = 0.077, CAM_HFOV = 1.164, CAM_RANGE = 2.0, LOOKAHEAD = 1.8;
const NAMES = ['salida', 'derecha', 'arriba', 'izquierda'];
interface Seat { key: number; lateral: number; hits: number; votes: Record<string, number>; firstSeen: number | null; coloured: number | null }

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let layoutN = 4, phi = 0, cameraWidth = 1;   // 1 = the real camera; the slider widens it
    let cancel: (() => void) | null = null;
    const P = (x: number, y: number): [number, number] => [VW / 2 + x * K, VW / 2 - y * K];
    const svg = svgEl('svg', { viewBox: `0 0 ${VW} ${VW}`, class: 'lw-svg lw-square', role: 'img' });
    const scene = svgEl('g');
    svg.append(scene);
    const rd = readout();
    const table = h('div', { class: 'lw-tablewrap' });

    /** The car pose at a progress (on the lane centre, as a simple driver would be). */
    const carAt = (s: number) => lanePose(s);
    /** The progress of a sign on the lane: its seat (signs only stand on seats). */
    function seatOf(sx: number, sy: number): { s: number; lateral: number } {
      let best = { s: 0, lateral: 0, d: Infinity };
      for (const s of SEATS) for (const row of [ROW, -ROW]) {
        const [x, y] = lanePoint(s, row);
        const d = Math.hypot(x - sx, y - sy);
        if (d < best.d) best = { s, lateral: row, d };
      }
      return best;
    }
    /** The memory after driving from progress 0 to `upto`, a scan every 3 cm of lane. */
    function memory(upto: number): Map<number, Seat> {
      const seats = new Map<number, Seat>();
      const signs = layout(layoutN, false).map((sg) => ({ ...sg, ...seatOf(sg.x, sg.y) }));
      for (let s = 0; s <= upto + 1e-9; s += 0.03) {
        const [x, y, th] = carAt(s);
        const c = Math.cos(th), sn = Math.sin(th);
        for (const sg of signs) {
          const dx = sg.x - x, dy = sg.y - y;
          const bx = c * dx + sn * dy, by = -sn * dx + c * dy;
          const ahead = ((sg.s - s) % 8 + 8) % 8;
          if (bx < -0.05 || ahead > LOOKAHEAD || Math.hypot(bx, by) > LOOKAHEAD + 0.5) continue;   // the LiDAR files it
          const key = Math.round(sg.s * 2) % 16;
          const seat = seats.get(key) ?? { key, lateral: sg.lateral, hits: 0, votes: {}, firstSeen: null, coloured: null };
          seat.hits++;
          if (seat.hits === 2) seat.firstSeen = s;
          const dist = Math.hypot(bx - CAM_X, by), bearing = Math.atan2(by, bx - CAM_X);
          if (dist > 0.12 && dist < CAM_RANGE && Math.abs(wrap(bearing - CAM_YAW)) <= (CAM_HFOV * cameraWidth) / 2) {
            seat.votes[sg.color] = (seat.votes[sg.color] ?? 0) + 1;
            if (seat.coloured === null && seat.hits >= 2) seat.coloured = s;
          }
          seats.set(key, seat);
        }
      }
      return seats;
    }

    function draw(): void {
      const seats = memory(phi);
      let out = '';
      const [ox, oy] = P(-OUTER, OUTER), [ix, iy] = P(-INNER, INNER);
      out += `<rect class="lw-wall" x="${ox - 6}" y="${oy - 6}" width="${3 * K + 12}" height="${3 * K + 12}"/><rect x="${ox}" y="${oy}" width="${3 * K}" height="${3 * K}" fill="var(--lw-bg)"/><rect class="lw-wall" x="${ix}" y="${iy}" width="${K}" height="${K}"/>`;
      // the camera's view and the LiDAR's look-ahead
      const [x, y, th] = carAt(phi);
      const cx = x + CAM_X * Math.cos(th), cy = y + CAM_X * Math.sin(th);
      const half = (CAM_HFOV * cameraWidth) / 2;
      const a0 = th + CAM_YAW - half, a1 = th + CAM_YAW + half;
      const [pcx, pcy] = P(cx, cy);
      const arc = (a: number) => P(cx + CAM_RANGE * Math.cos(a), cy + CAM_RANGE * Math.sin(a));
      out += `<path d="M ${pcx} ${pcy} L ${arc(a0).join(' ')} A ${CAM_RANGE * K} ${CAM_RANGE * K} 0 0 0 ${arc(a1).join(' ')} Z" fill="var(--lw-violet)" opacity="0.16" stroke="var(--lw-violet)" stroke-width="1"/>`;
      // seats and signs: grey while only the LiDAR knows them, coloured once the camera voted
      for (const s of SEATS) for (const row of [ROW, -ROW]) {
        const [qx, qy] = P(...lanePoint(s, row));
        out += `<rect x="${qx - 3}" y="${qy - 3}" width="6" height="6" fill="none" stroke="var(--lw-muted)" stroke-width="0.8"/>`;
      }
      for (const sg of layout(layoutN, false)) {
        const key = Math.round(seatOf(sg.x, sg.y).s * 2) % 16;
        const seat = seats.get(key);
        const known = seat && seat.hits >= 2;
        const votes = seat ? Object.entries(seat.votes).sort((a, b) => b[1] - a[1]) : [];
        const colour = known && votes.length ? (votes[0][0] === 'red' ? RED : GREEN) : null;
        const [qx, qy] = P(sg.x, sg.y);
        out += `<rect x="${qx - 6}" y="${qy - 6}" width="12" height="12" fill="${colour ?? (known ? '#8a8378' : 'none')}" stroke="${known ? '#0c0a07' : sg.color === 'red' ? RED : GREEN}" stroke-width="${known ? 1 : 1.5}" stroke-dasharray="${known ? '' : '2 2'}"/>`;
        if (known && !colour) out += `<text class="lw-tag" x="${qx}" y="${qy + 4}" text-anchor="middle" fill="#fff">?</text>`;
      }
      // the car
      const [px, py] = P(x, y);
      out += `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(-th * 180 / Math.PI).toFixed(1)}) scale(${K})"><rect x="-0.0852" y="-0.074" width="0.2329" height="0.148" rx="0.012" class="lw-body"/><path d="M 0.118 -0.03 L 0.148 0 L 0.118 0.03 Z" class="lw-nose"/></g>`;
      scene.innerHTML = out;

      // the memory as a table: 4 straights x 3 seats
      const rows = [0, 1, 2, 3].map((k) => h('tr', {}, h('th', {}, `recta ${NAMES[k]}`), ...[0, 0.5, 1].map((a) => {
        const key = Math.round((2 * k + a) * 2) % 16;
        const seat = seats.get(key);
        if (!seat || seat.hits < 2) return h('td', { class: 'lw-c-muted' }, '—');
        const votes = Object.entries(seat.votes).sort((p, q) => q[1] - p[1]);
        const text = votes.length ? `${votes[0][0] === 'red' ? 'roja' : 'verde'} (${votes.reduce((n, v) => n + v[1], 0)} votos)` : '¿color? (sin votos)';
        return h('td', { class: votes.length ? (votes[0][0] === 'red' ? 'lw-c-red' : 'lw-c-green') : '' }, `${text}, fila ${seat.lateral > 0 ? 'int.' : 'ext.'}`);
      })));
      table.replaceChildren(h('table', { class: 'lw-table lw-table-small' }, h('thead', {}, h('tr', {}, h('th', {}, 'memoria'), h('th', {}, 'inicio'), h('th', {}, 'mitad'), h('th', {}, 'final'))), h('tbody', {}, ...rows)));
      const all = [...seats.values()].filter((s) => s.hits >= 2);
      const coloured = all.filter((s) => Object.keys(s.votes).length).length;
      rd.set([
        ['progreso del coche', `${fmt(phi, 2)}`],
        ['señales en la memoria', `${all.length} de ${layout(layoutN, false).length}`],
        ['con color', `${coloured} (las demás: el LiDAR las vio, la cámara todavía no)`],
      ], `${all.length} señales en la memoria, ${coloured} con color.`);
      scrub.set(phi);
    }

    function play(): void {
      cancel?.();
      if (reducedMotion()) { phi = 8; draw(); return; }
      cancel = animate(9000, (t) => { phi = t * 8; draw(); }, () => { cancel = null; });
    }
    const scrub = slider({ label: 'Progreso del coche', min: 0, max: 8, step: 0.05, value: phi, format: (v) => fmt(v, 2), onInput: (v) => { cancel?.(); phi = v; draw(); } });
    const width = slider({ label: 'Ancho de la cámara', min: 0.5, max: 2, step: 0.05, value: 1, format: (v) => `${fmt(66.7 * v, 0)}°${Math.abs(v - 1) < 1e-9 ? ' (la real)' : ''}`, onInput: (v) => { cameraWidth = v; draw(); } });
    const sel = h('select', { id: 'lw-os-layout' });
    for (let n = 0; n < 5; n++) sel.append(h('option', { value: n }, `Campo ${n}`));
    sel.value = String(layoutN);
    sel.addEventListener('change', () => { layoutN = Number(sel.value); play(); });
    root.append(
      h('div', { class: 'lw-figure' }, svg),
      legend([['violet', 'lo que ve la cámara (66,7°, 2 m)'], ['muted', 'señal en la memoria sin color: gris con «?»']]),
      rd.root,
      table,
      h('div', { class: 'lw-actions' }, button('Recorrer una vuelta', play, 'lw-btn-primary')),
      h('div', { class: 'lw-controls' }, scrub.root, width.root, h('div', { class: 'lw-field' }, h('label', { for: 'lw-os-layout' }, 'Campo del reglamento'), sel)),
      h('p', { class: 'lw-note' }, 'Simplificado para ver la idea: el coche va por el centro del carril y las posiciones son exactas. En la estrategia, sign_position pasa cada clúster del LiDAR a (progreso, lateral), sign_colour le da el color de la observación de la cámara a menos de 12 cm, y SeatMemory guarda votos por asiento toda la ronda. Ensancha la cámara para ver cuánto antes llegarían los colores.'),
    );
    svg.setAttribute('aria-label', 'El campo desde arriba con el coche dando una vuelta, la vista de la cámara y las señales: con borde punteado las que aún no conoce, grises las que el LiDAR ya vio y de color las que la cámara ya votó');
    play();
  });
}
