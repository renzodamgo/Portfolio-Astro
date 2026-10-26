// Widget "obstacle-corner": one corner planned as straight, arc, straight (corner.py). Choose the sign on the last seat
// of the straight before and on the first seat of the next one; plan() tries every offset and radius and keeps the line
// with the most clearance (or, past 11 cm, the one nearest the lane centre). Drawn in the first corner's frame: bottom
// straight -> right straight, island corner at (0.5, -0.5).
import { animate, button, fmt, guarded, h, legend, readout, reducedMotion, slider, svgEl } from './lib/common';
import { CORNERS, ENOUGH, HW, OUTLINE_FRONT, OUTLINE_REAR, RADII, SIGN_HALF, clearance, path, planCorner, type CornerSign, type Path } from './lib/obstacle';

const VW = 420, VH = 420, K = 230, X0 = -0.25, Y1 = 0.25; // window x in [-0.25, 1.55], y in [-1.55, 0.25]
const RED = '#ee2737', GREEN = '#44d62c';
type Choice = 'none' | 'red-in' | 'red-out' | 'green-in' | 'green-out';
const CHOICES: [Choice, string][] = [['none', 'sin señal'], ['red-in', 'roja, fila interior'], ['red-out', 'roja, fila exterior'], ['green-in', 'verde, fila interior'], ['green-out', 'verde, fila exterior']];
const parse = (c: Choice): CornerSign => (c === 'none' ? null : [c.endsWith('in') ? 0.1 : -0.1, c.startsWith('red') ? 'red' : 'green']);

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let a: Choice = 'green-in', b: Choice = 'red-in';
    let forced: number | null = null;     // a radius chosen by hand (null: plan() picks)
    let at = 1;                           // fraction of the line where the car is drawn
    let cancel: (() => void) | null = null;
    const P = (x: number, y: number): [number, number] => [(x - X0) * K, (Y1 - y) * K];
    const svg = svgEl('svg', { viewBox: `0 0 ${VW} ${VH}`, class: 'lw-svg lw-square', role: 'img' });
    const scene = svgEl('g');
    svg.append(scene);
    const rd = readout();

    function current(): { p: Path | null; gap: number; dA: number; dB: number; r: number; tried: number } | null {
      const sa = parse(a), sb = parse(b);
      const best = planCorner(sa, sb, 0, 0);
      if (!best) return null;
      if (forced === null || forced === best.r) return { ...best, p: path(best.dA, best.dB, best.r) };
      // the same offsets with another radius: what plan() avoided
      const p = path(best.dA, best.dB, forced);
      return { ...best, r: forced, p, gap: p ? clearance(p, sa, sb) : -Infinity };
    }

    function draw(): void {
      const plan = current();
      let out = '';
      // floor, island corner, outer walls
      out += `<rect x="0" y="0" width="${VW}" height="${VH}" fill="var(--lw-bg)"/>`;
      const [ix, iy] = P(X0, 0.5);
      out += `<rect class="lw-wall" x="${ix}" y="${iy}" width="${P(0.5, 0)[0] - ix}" height="${P(0, -0.5)[1] - iy}"/>`;
      const [wx] = P(1.5, 0), [, wy] = P(0, -1.5);
      out += `<rect class="lw-wall" x="${wx}" y="0" width="${VW - wx}" height="${VH}"/><rect class="lw-wall" x="0" y="${wy}" width="${VW}" height="${VH - wy}"/>`;
      out += `<text class="lw-tag lw-c-muted" x="${ix + 8}" y="${iy + 18}" fill="currentColor">isla</text>`;
      // the lane centre (dashed) and the two seats with their rows
      const lane: string[] = [];
      for (let t = 0; t <= 1.0001; t += 0.05) { const ang = -Math.PI / 2 + (t * Math.PI) / 2; lane.push(P(0.5 + 0.5 * Math.cos(ang), -0.5 + 0.5 * Math.sin(ang)).join(',')); }
      out += `<polyline points="${P(X0, -1).join(',')} ${lane.join(' ')} ${P(1, Y1).join(',')}" fill="none" stroke="var(--lw-muted)" stroke-dasharray="6 5"/>`;
      for (const row of [0.1, -0.1]) {
        const [p1, q1] = P(0.5, -1 + row), [p2, q2] = P(1 - row, -0.5);
        out += `<rect x="${p1 - 4}" y="${q1 - 4}" width="8" height="8" fill="none" stroke="var(--lw-muted)"/><rect x="${p2 - 4}" y="${q2 - 4}" width="8" height="8" fill="none" stroke="var(--lw-muted)"/>`;
      }
      const sign = (s: CornerSign, x: number, y: number) => {
        if (!s) return '';
        const [px, py] = P(x, y);
        const w = 2 * SIGN_HALF * K;
        return `<rect x="${px - w / 2}" y="${py - w / 2}" width="${w}" height="${w}" fill="${s[1] === 'red' ? RED : GREEN}" stroke="#0c0a07"/>`;
      };
      const sa = parse(a), sb = parse(b);
      if (sa) out += sign(sa, 0.5, -1 + sa[0]);
      if (sb) out += sign(sb, 1 - sb[0], -0.5);
      if (plan?.p) {
        const { p } = plan;
        // ghost outlines along the line, then the line, then the car at the slider
        for (let i = 0; i < p.x.length; i += 6) out += outline(p, i, 'var(--lw-amber)', 0.12);
        out += `<polyline class="lw-c-amber" points="${p.x.map((x, i) => P(x, p.y[i]).map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="3"/>`;
        const i = Math.min(p.x.length - 1, Math.round(at * (p.x.length - 1)));
        out += outline(p, i, 'var(--lw-amber)', 0.95, true);
        // the arc's centre
        const [cx, cy] = P(1 - plan.dB - plan.r, -1 + plan.dA + plan.r);
        out += `<circle cx="${cx}" cy="${cy}" r="3" fill="var(--lw-blue)"/><text class="lw-tag lw-c-blue" x="${cx + 6}" y="${cy - 6}" fill="currentColor">r = ${fmt(plan.r, 2)} m</text>`;
      }
      scene.innerHTML = out;
      const rows: [string, string, string?][] = plan ? [
        ['margen (clearance)', `${fmt(plan.gap * 100, 1)} cm${plan.gap < 0 ? ' · ¡toca o pasa una señal por el lado equivocado!' : plan.gap >= ENOUGH ? ' (≥ 11 cm: se queda cerca del centro)' : ''}`, plan.gap < 0 ? 'red' : 'green'],
        ['d_a (recta de antes)', `${fmt(plan.dA, 2)} m`],
        ['d_b (recta de después)', `${fmt(plan.dB, 2)} m`],
        ['radio del arco', `${fmt(plan.r, 2)} m${forced !== null ? ' (elegido a mano)' : ''}`],
        ['líneas probadas por plan()', String(plan.tried)],
      ] : [['plan()', 'ninguna línea cabe']];
      rd.set(rows, plan ? `Margen ${fmt(plan.gap * 100, 1)} centímetros con radio ${fmt(plan.r, 2)} metros.` : 'Ninguna línea cabe.');
    }

    function outline(p: Path, i: number, color: string, opacity: number, solid = false): string {
      const c = Math.cos(p.yaw[i]), s = Math.sin(p.yaw[i]);
      const pts = CORNERS.map(([u, v]) => P(p.x[i] + c * u - s * v, p.y[i] + s * u + c * v).map((q) => q.toFixed(1)).join(',')).join(' ');
      return solid ? `<polygon points="${pts}" class="lw-body" style="stroke-width:1" opacity="${opacity}"/>`
        : `<polygon points="${pts}" fill="none" stroke="${color}" stroke-width="1" opacity="${opacity}"/>`;
    }

    function replay(): void {
      cancel?.();
      if (reducedMotion()) { at = 1; draw(); return; }
      cancel = animate(2500, (t) => { at = t; scrub.set(t); draw(); }, () => { cancel = null; });
    }
    const pick = (label: string, value: Choice, set: (v: Choice) => void) => {
      const id = `lw-oc-${Math.random().toString(36).slice(2, 7)}`;
      const sel = h('select', { id });
      for (const [v, l] of CHOICES) sel.append(h('option', { value: v }, l));
      sel.value = value;
      sel.addEventListener('change', () => { set(sel.value as Choice); forced = null; radius.value = 'auto'; replay(); });
      return { sel, root: h('div', { class: 'lw-field' }, h('label', { for: id }, label), sel) };
    };
    const selA = pick('Último asiento de la recta (antes de la esquina)', a, (v) => (a = v));
    const selB = pick('Primer asiento de la siguiente (después)', b, (v) => (b = v));
    const radius = h('select', { id: 'lw-oc-r' });
    radius.append(h('option', { value: 'auto' }, 'el que elige plan()'), ...RADII.map((r) => h('option', { value: r }, `${fmt(r, 2)} m`)), h('option', { value: 0.41 }, '0,41 m (el coche a fondo)'));
    radius.addEventListener('change', () => { forced = radius.value === 'auto' ? null : Number(radius.value); replay(); });
    const scrub = slider({ label: 'Recorrido', min: 0, max: 1, step: 0.01, value: at, format: (v) => `${Math.round(v * 100)} %`, onInput: (v) => { cancel?.(); at = v; draw(); } });
    const preset = (label: string, x: Choice, y: Choice) => button(label, () => { a = x; b = y; selA.sel.value = x; selB.sel.value = y; forced = null; radius.value = 'auto'; replay(); });
    root.append(
      h('div', { class: 'lw-figure' }, svg),
      legend([['amber', 'la línea de plan() y el contorno del coche'], ['blue', 'centro del arco'], ['muted', 'centro del carril y asientos']]),
      rd.root,
      h('div', { class: 'lw-controls' }, selA.root, selB.root, h('div', { class: 'lw-field' }, h('label', { for: 'lw-oc-r' }, 'Radio del arco'), radius), scrub.root),
      h('div', { class: 'lw-actions' },
        preset('Verde int. → roja ext. (3,4 cm)', 'green-in', 'red-out'),
        preset('Roja ext. → verde int. (4,0 cm)', 'red-out', 'green-in'),
        preset('Verde int. → roja int.', 'green-in', 'red-in'),
        preset('Sin señales', 'none', 'none'),
        button('Reproducir', replay, 'lw-btn-primary'),
      ),
      h('p', { class: 'lw-note' }, `plan() prueba desplazamientos cada 2 cm del lado correcto de cada señal y radios de ${RADII.map((r) => fmt(r, 2)).join(', ')} m, y mide el margen con el contorno del coche (${fmt(OUTLINE_FRONT * 1000, 1)} mm delante, ${fmt(OUTLINE_REAR * 1000, 1)} detrás, ${fmt(HW * 1000, 0)} de medio ancho). Elige un radio a mano para ver lo que plan() evitó. Es corner.py del curso.`),
    );
    svg.setAttribute('aria-label', 'Una esquina vista desde arriba: la isla, las dos señales de los extremos y la línea recta-arco-recta con el contorno del coche');
    replay();
  });
}
