// Widget "scan-explorer": a simulated LD19 scan of the Open Challenge field and perceive() from
// step_07_perception.py (ported exactly, see lib/lidar.ts). Drag the car, break the scan, watch the four numbers,
// repeat the scan and see how much each one moves, put a wild beam in and see why the median is used.
import { button, fmt, guarded, h, legend, nextId, readout, slider, svgEl, toggle } from './lib/common';
import { LIDAR_X, WALLS, castScan, frontAxis, meanRange, perceiveDetailed } from './lib/lidar';
import { clamp, wrap } from './lib/sim';

const S = 100, VIEW = 3.4, HALF = VIEW / 2; // px per metre, side of the picture in metres
const FRONT = 0.1477, REAR = 0.0852, HALF_W = 0.074; // outline around base_link
const P = (x: number, y: number): [number, number] => [(x + HALF) * S, (HALF - y) * S];
const deg = (r: number) => (r * 180) / Math.PI;
const KEEP = 20; // scans kept in the history strip
const WILD = 9; // m: the reading of the wild beam

interface Pose { x: number; y: number; yaw: number }
type Metric = 'end' | 'left' | 'front';
interface Roll { left: number; front: number; end: number }

const METRICS: [Metric, string][] = [
  ['end', 'island_end'],
  ['left', 'left'],
  ['front', 'front_axis'],
];

/** Keep the car in the corridors: inside the field, outside the island. */
function constrain(p: Pose): Pose {
  let { x, y } = p;
  x = clamp(x, -1.38, 1.38);
  y = clamp(y, -1.38, 1.38);
  const m = 0.62;
  if (Math.abs(x) < m && Math.abs(y) < m) {
    if (m - Math.abs(x) < m - Math.abs(y)) x = (x < 0 ? -1 : 1) * m;
    else y = (y < 0 ? -1 : 1) * m;
  }
  return { x, y, yaw: wrap(p.yaw) };
}

/** Direction of the lap at a place: tangent to the ring, snapped to the corridor axis. */
function trackDirection(x: number, y: number, ccw: boolean): number {
  const t = Math.atan2(y, x) + Math.PI / 2;
  const snapped = Math.round(t / (Math.PI / 2)) * (Math.PI / 2);
  return ccw ? snapped : snapped + Math.PI;
}

const median = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    const start = (): Pose => ({ x: 0, y: -0.75, yaw: 0 });
    let pose = start();
    let ccw = true;
    let dropout = 4.3; // %
    let noiseMm = 8;
    let seed = 1;
    let showFit = true;
    let showRays = true;
    let wild = false;
    let metric: Metric = 'end';
    let history: Roll[] = [];
    let queued = 0;

    const svg = svgEl('svg', {
      viewBox: `0 0 ${VIEW * S} ${VIEW * S}`,
      class: 'lw-svg lw-scan',
      role: 'application',
      tabindex: 0,
      'aria-roledescription': 'campo con el coche',
      'aria-label': 'Campo del desafío visto desde arriba con el coche y su escaneo LiDAR. Flechas mueven el coche, Q y E lo giran.',
    });
    const world = svgEl('g');
    svg.append(world);
    const rd = readout();

    // ---------------------------------------------------------------------------------- one scan
    /** The scan the car would get with the current settings and this noise seed, and what perceive() makes of it. */
    function evaluate(s: number, perfect = false) {
      const { x, y, yaw } = pose;
      const scan = castScan(x, y, yaw, perfect ? { noise: 0, dropout: 0, seed: 0 } : { noise: noiseMm / 1000, dropout: dropout / 100, seed: s });
      const sign = ccw ? 1 : -1;
      let wildIndex = -1;
      if (wild && !perfect) {
        wildIndex = Math.round((Math.PI / 2 - scan.angleMin) / scan.angleIncrement); // the beam at +90 deg, straight at the island
        scan.ranges[wildIndex] = WILD;
      }
      const fy = wrap(trackDirection(x, y, ccw) - yaw);
      const d = perceiveDetailed(scan, fy, sign);
      return {
        scan, sign, fy, wildIndex, ...d,
        alongCar: frontAxis(d.angles, scan.ranges, d.ok, 0), // what you would get with forward_yaw = 0
        mean: meanRange(d.angles, scan.ranges, d.ok, Math.PI / 2), // the same beams, averaged
      };
    }
    const toRoll = (e: ReturnType<typeof evaluate>): Roll => ({ left: e.scene.left, front: e.scene.frontAxis, end: e.scene.islandEnd });

    /** Start the history over with the scan on screen (anything that changes the setting makes older scans not comparable). */
    function restartHistory(): void {
      history = [toRoll(evaluate(seed))];
    }
    function roll(): void {
      seed += 1;
      history.push(toRoll(evaluate(seed)));
      if (history.length > KEEP) history.shift();
    }

    // ---------------------------------------------------------------------------------- drawing
    /** A number written next to a point, with a halo so it reads over the walls. */
    function label(text: string, px: number, py: number, cls: string, anchor: 'start' | 'end', dy: number): string {
      const tx = anchor === 'start' ? px + 7 : px - 7;
      return `<text class="lw-scan-label lw-c-${cls}" x="${tx.toFixed(1)}" y="${(py + dy).toFixed(1)}" text-anchor="${anchor}" fill="currentColor">${text}</text>`;
    }

    function draw(): void {
      queued = 0;
      const { x, y, yaw } = pose;
      const e = evaluate(seed);
      const { scan, scene, fit, angles, sign, fy } = e;
      const ideal = evaluate(seed, true);
      const ox = x + LIDAR_X * Math.cos(yaw), oy = y + LIDAR_X * Math.sin(yaw);
      const [lx, ly] = P(ox, oy);
      const toWorld = (px: number, py: number): [number, number] => [
        x + px * Math.cos(yaw) - py * Math.sin(yaw),
        y + px * Math.sin(yaw) + py * Math.cos(yaw),
      ];
      const side = (px: number) => (px > VIEW * S * 0.62 ? 'end' : 'start');

      let out = `<rect class="lw-floor" x="0" y="0" width="${VIEW * S}" height="${VIEW * S}"/>`;
      for (const [cx, cy, sx, sy] of WALLS) {
        const [a, b] = P(cx - sx / 2, cy + sy / 2);
        out += `<rect class="lw-wall" x="${a}" y="${b}" width="${sx * S}" height="${sy * S}"/>`;
      }

      // rays and hit points
      let rays = '', plain = '', used = '', wall = '';
      let lost = 0;
      scan.ranges.forEach((r, i) => {
        if (!Number.isFinite(r)) {
          lost++;
          return;
        }
        if (i === e.wildIndex) return; // drawn on its own below
        const a = yaw + angles[i];
        const [hx, hy] = P(ox + r * Math.cos(a), oy + r * Math.sin(a));
        const dot = `M${hx.toFixed(1)} ${hy.toFixed(1)}h0`;
        if (showRays && i % 2 === 0) rays += `M${lx.toFixed(1)} ${ly.toFixed(1)}L${hx.toFixed(1)} ${hy.toFixed(1)}`;
        if (showFit && fit.valid && fit.onWall[i]) wall += dot;
        else if (showFit && fit.side[i]) used += dot;
        else plain += dot;
      });
      if (showRays) out += `<path class="lw-c-cream" d="${rays}" stroke="currentColor" stroke-width="0.6" opacity="0.13" fill="none"/>`;
      out += `<path class="lw-c-muted" d="${plain}" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/>`;
      out += `<path class="lw-c-amber" d="${used}" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" fill="none"/>`;
      out += `<path class="lw-c-green" d="${wall}" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" fill="none"/>`;

      // the wild beam: it goes through a gap in the island and comes back from far away
      if (e.wildIndex >= 0) {
        const a = yaw + angles[e.wildIndex];
        const [wx, wy] = P(ox + 1.65 * Math.cos(a), oy + 1.65 * Math.sin(a));
        out += `<g class="lw-c-red"><line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${wx.toFixed(1)}" y2="${wy.toFixed(1)}" stroke="currentColor" stroke-width="1.6" stroke-dasharray="4 3"/>`;
        out += `<circle cx="${wx.toFixed(1)}" cy="${wy.toFixed(1)}" r="4" fill="currentColor"/></g>`;
        out += label(`rayo salvaje: ${fmt(WILD, 0)} m`, wx, wy, 'red', side(wx), -9);
      }

      // the four numbers: an arrow for each one here, and the values written on the island below
      function arrow(cls: string, ang: number, len: number, dashed: boolean): string {
        if (!Number.isFinite(len)) return '';
        const [ax, ay] = P(ox + len * Math.cos(ang), oy + len * Math.sin(ang));
        const line = `<line class="lw-c-${cls}" x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="currentColor" stroke-width="2"${dashed ? ' stroke-dasharray="5 4"' : ''}/>`;
        return line + `<circle class="lw-c-${cls}" cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="${dashed ? 2.5 : 3}" fill="currentColor"/>`;
      }
      const crooked = Math.abs(fy) > 0.017;
      if (crooked) out += arrow('muted', yaw, e.alongCar, true);
      out += arrow('blue', yaw + Math.PI / 2, scene.left, false);
      out += arrow('blue', yaw - Math.PI / 2, scene.right, false);
      out += arrow('violet', yaw + fy, scene.frontAxis, false);
      const [hx0, hy0] = P(-0.45, 0.33);
      const hud: [string, string, number][] = [
        ['left', 'blue', scene.left], ['right', 'blue', scene.right], ['front_axis', 'violet', scene.frontAxis], ['island_end', 'green', scene.islandEnd],
      ];
      if (crooked) hud.push(['según coche', 'muted', e.alongCar]);
      hud.forEach(([name, cls, v], i) => {
        const y0 = hy0 + i * 15;
        out += `<text class="lw-scan-hud lw-c-${cls}" x="${hx0.toFixed(1)}" y="${y0.toFixed(1)}" fill="currentColor">${name}</text>`;
        out += `<text class="lw-scan-hud lw-c-${cls}" x="${(hx0 + 90).toFixed(1)}" y="${y0.toFixed(1)}" text-anchor="end" fill="currentColor">${fmt(v, 2)}</text>`;
      });

      // the fitted island line and where the wall ends
      if (showFit && fit.slope !== null && fit.offset !== null) {
        const xs: number[] = [];
        fit.side.forEach((s, i) => (s || fit.onWall[i]) && xs.push(fit.x[i]));
        if (xs.length) {
          const x0 = Math.min(...xs) - 0.05, x1 = Math.max(...xs) + 0.05;
          const a = toWorld(x0 + 0, sign * (fit.slope * x0 + fit.offset));
          const b = toWorld(x1, sign * (fit.slope * x1 + fit.offset));
          const [ax, ay] = P(a[0] + ox - x, a[1] + oy - y), [bx, by] = P(b[0] + ox - x, b[1] + oy - y);
          out += `<line class="lw-c-${fit.valid ? 'green' : 'red'}" x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="currentColor" stroke-width="2" ${fit.valid ? '' : 'stroke-dasharray="5 4"'}/>`;
        }
      }
      if (Number.isFinite(scene.islandEnd) && fit.slope !== null && fit.offset !== null) {
        const lx0 = scene.islandEnd - LIDAR_X; // fit coordinates are in the lidar frame
        const [wx, wy] = toWorld(scene.islandEnd, sign * (fit.slope * lx0 + fit.offset));
        const [ex, ey] = P(wx, wy);
        out += `<circle class="lw-c-green" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="7" fill="none" stroke="currentColor" stroke-width="2.5"/>`;
      }

      // car
      const [cx, cy] = P(x, y);
      out += `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${(-deg(yaw)).toFixed(2)}) scale(${S})">`;
      out += `<rect x="${-REAR}" y="${-HALF_W}" width="${FRONT + REAR}" height="${2 * HALF_W}" rx="0.012" class="lw-body"/>`;
      out += `<path d="M ${FRONT - 0.035} -0.035 L ${FRONT + 0.005} 0 L ${FRONT - 0.035} 0.035 Z" class="lw-nose"/>`;
      out += `<circle cx="${LIDAR_X}" cy="0" r="0.014" class="lw-lidar"/></g>`;
      world.innerHTML = out;

      // numbers
      const m = (v: number) => (Number.isFinite(v) ? `${fmt(v, 2)} m` : 'no se ve');
      const withIdeal = (v: number, i: number) => `${m(v)} (sin ruido: ${m(i)})`;
      const rows: [string, string, string?][] = [
        ['left (izquierda)', withIdeal(scene.left, ideal.scene.left), 'blue'],
        ['right (derecha)', withIdeal(scene.right, ideal.scene.right), 'blue'],
        ['front_axis (a lo largo de la pista)', withIdeal(scene.frontAxis, ideal.scene.frontAxis), 'violet'],
      ];
      if (crooked) rows.push(['front_axis con forward_yaw = 0 (hacia donde apunta el coche)', m(e.alongCar)]);
      rows.push(
        ['forward_yaw (la pista vista desde el coche)', `${fmt(deg(fy), 1)}°`],
        [
          'island_end (fin de la isla, en x del coche)',
          Number.isFinite(scene.islandEnd) ? `x = ${fmt(scene.islandEnd, 2)} m` : 'no termina a la vista',
          'green',
        ],
        ['island_end sin ruido ni pérdidas', Number.isFinite(ideal.scene.islandEnd) ? `x = ${fmt(ideal.scene.islandEnd, 2)} m` : 'no termina a la vista'],
        ['left con el promedio, para comparar', `${m(e.mean)}${wild ? ' (el rayo salvaje lo estropea)' : ''}`],
        ['Rayos perdidos', `${lost} de ${scan.ranges.length}`],
      );
      if (fit.slope !== null && fit.offset !== null) {
        rows.push(['Ajuste de la pared', fit.valid ? `a ${fmt(fit.offset, 2)} m, inclinada ${fmt(deg(Math.atan(fit.slope)), 1)}°` : 'rechazado (no es una pared a un lado)']);
      } else rows.push(['Ajuste de la pared', 'faltan rayos (menos de 10)']);
      rd.set(
        rows,
        `Izquierda ${m(scene.left)}, derecha ${m(scene.right)}, delante ${m(scene.frontAxis)}, ${Number.isFinite(scene.islandEnd) ? `la isla termina en x igual a ${fmt(scene.islandEnd, 2)} metros` : 'el fin de la isla no se ve'}. ${lost} rayos perdidos.`,
      );
      drawStrip(ideal.scene);
    }

    const redraw = () => {
      if (!queued) queued = requestAnimationFrame(draw);
    };
    const marked: HTMLButtonElement[] = [];
    /** Something changed what a scan looks like: the older scans do not count any more, and no scenario button is "on". */
    const changed = () => {
      restartHistory();
      marked.forEach((q) => { q.classList.remove('lw-btn-on'); q.setAttribute('aria-pressed', 'false'); });
      redraw();
    };

    // ------------------------------------------------------------------------------- history strip
    const SW = 360, SH = 146, SL = 46, SR = 10, ST = 14, SB = 24;
    const strip = svgEl('svg', { viewBox: `0 0 ${SW} ${SH}`, class: 'lw-svg lw-scan-strip', role: 'img' });
    const stripSummary = h('p', { class: 'lw-note lw-scan-summary' });
    const stripLive = h('p', { class: 'lw-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    let liveTimer = 0;

    function drawStrip(ideal: { left: number; frontAxis: number; islandEnd: number }): void {
      const key: keyof Roll = metric;
      const idealV = metric === 'end' ? ideal.islandEnd : metric === 'left' ? ideal.left : ideal.frontAxis;
      const vals = history.map((r) => r[key]);
      const finite = vals.filter(Number.isFinite);
      // the same window (0,6 m tall) for every number, so a steady number looks flat and a jumpy one does not
      const centre = Number.isFinite(idealV) ? idealV : finite.length ? median(finite) : 0.5;
      const lo = centre - 0.3, hi = centre + 0.3;
      const top = ST + 26, bottom = SH - SB; // the band above `top` is for "no se ve"
      const sy = (v: number) => top + ((hi - v) / (hi - lo)) * (bottom - top);
      const sx = (i: number) => SL + ((i + 0.5) / KEEP) * (SW - SL - SR);
      let o = '';
      for (const v of [lo, centre, hi]) {
        o += `<line class="lw-grid" x1="${SL}" y1="${sy(v)}" x2="${SW - SR}" y2="${sy(v)}"/>`;
        o += `<text class="lw-tick" x="${SL - 5}" y="${sy(v) + 4}" text-anchor="end">${fmt(v, 2)}</text>`;
      }
      o += `<rect class="lw-frame" x="${SL}" y="${ST}" width="${SW - SL - SR}" height="${bottom - ST}"/>`;
      o += `<line class="lw-grid" x1="${SL}" y1="${top - 4}" x2="${SW - SR}" y2="${top - 4}" stroke-dasharray="2 3"/>`;
      o += `<text class="lw-tick" x="${SL - 5}" y="${ST + 11}" text-anchor="end">no se ve</text>`;
      o += `<text class="lw-axis" x="${(SL + SW - SR) / 2}" y="${SH - 6}" text-anchor="middle">escaneos seguidos (el último, a la derecha)</text>`;
      if (Number.isFinite(idealV)) {
        o += `<g class="lw-c-green"><line x1="${SL}" y1="${sy(idealV)}" x2="${SW - SR}" y2="${sy(idealV)}" stroke="currentColor" stroke-width="1.6" stroke-dasharray="6 4"/></g>`;
      }
      if (finite.length >= 2) {
        const yy = sy(clamp(median(finite), lo, hi));
        o += `<g class="lw-c-amber"><line x1="${SL}" y1="${yy}" x2="${SW - SR}" y2="${yy}" stroke="currentColor" stroke-width="2"/></g>`;
      }
      let far = 0, gone = 0;
      vals.forEach((v, i) => {
        const px = sx(i);
        const last = i === vals.length - 1;
        if (!Number.isFinite(v)) {
          gone++;
          o += `<g class="lw-c-red"><path d="M${px - 4} ${ST + 5}l8 8m0 -8l-8 8" stroke="currentColor" stroke-width="2" fill="none"/></g>`;
          return;
        }
        const bad = !Number.isFinite(idealV) || Math.abs(v - idealV) > 0.1;
        if (bad) far++;
        const inside = v >= lo && v <= hi;
        const py = sy(clamp(v, lo, hi));
        const cls = bad ? 'red' : 'cream';
        o += inside
          ? `<circle class="lw-c-${cls}" cx="${px}" cy="${py}" r="${last ? 4.5 : 3.4}" fill="currentColor"/>`
          : `<circle class="lw-c-${cls}" cx="${px}" cy="${py}" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/>`;
        if (last) o += `<circle class="lw-c-amber" cx="${px}" cy="${py}" r="7.5" fill="none" stroke="currentColor" stroke-width="1.6"/>`;
      });
      strip.innerHTML = o;
      const name = METRICS.find(([k]) => k === metric)![1];
      strip.setAttribute('aria-label', `Gráfico de los últimos ${vals.length} valores de ${name}`);
      const spread = finite.length ? `mediana ${fmt(median(finite), 2)} m, de ${fmt(Math.min(...finite), 2)} a ${fmt(Math.max(...finite), 2)} m` : 'en ninguno se ve este número';
      const text = `${vals.length} ${vals.length === 1 ? 'escaneo' : 'escaneos'} de ${name}: ${spread}. ${far} con más de 10 cm de error${gone ? `, ${gone} sin verse` : ''}.`;
      stripSummary.textContent = text;
      clearTimeout(liveTimer);
      liveTimer = window.setTimeout(() => { stripLive.textContent = text; }, 700);
    }

    const metricId = nextId('lw-metric');
    const metricSelect = h('select', { id: metricId });
    for (const [k, name] of METRICS) metricSelect.append(h('option', { value: k }, name));
    metricSelect.addEventListener('change', () => {
      metric = metricSelect.value as Metric;
      redraw();
    });
    const metricField = h('div', { class: 'lw-field' }, h('label', { for: metricId }, 'Número que se sigue en la tira'), metricSelect);

    // ---------------------------------------------------------------------------------- controls
    const sx = slider({ label: 'Posición x', min: -1.4, max: 1.4, step: 0.01, value: pose.x, format: (v) => `${fmt(v, 2)} m`, onInput: (v) => setPose({ ...pose, x: v }, 'x') });
    const sy = slider({ label: 'Posición y', min: -1.4, max: 1.4, step: 0.01, value: pose.y, format: (v) => `${fmt(v, 2)} m`, onInput: (v) => setPose({ ...pose, y: v }, 'y') });
    const syaw = slider({ label: 'Rumbo del coche', min: -180, max: 180, step: 1, value: 0, format: (v) => `${fmt(v, 0)}°`, onInput: (v) => setPose({ ...pose, yaw: (v * Math.PI) / 180 }) });
    const sdrop = slider({ label: 'Perder rayos', min: 0, max: 15, step: 0.1, value: dropout, format: (v) => `${fmt(v, 1)} %`, onInput: (v) => { dropout = v; changed(); } });
    const snoise = slider({ label: 'Ruido de la distancia', min: 0, max: 30, step: 1, value: noiseMm, format: (v) => `${fmt(v, 0)} mm`, onInput: (v) => { noiseMm = v; changed(); } });

    function setPose(p: Pose, keep?: 'x' | 'y'): void {
      pose = constrain(p);
      // a slider that was moved keeps the value the user chose unless the island pushed it
      if (keep !== 'x') sx.set(pose.x);
      if (keep !== 'y') sy.set(pose.y);
      if (keep === 'x' && sx.get() !== pose.x) sx.set(pose.x);
      if (keep === 'y' && sy.get() !== pose.y) sy.set(pose.y);
      syaw.set(Math.round(deg(pose.yaw)));
      changed();
    }

    const dirId = nextId('lw-dir');
    const select = h('select', { id: dirId });
    select.append(h('option', { value: 'ccw' }, 'Antihoraria (isla a la izquierda)'), h('option', { value: 'cw' }, 'Horaria (isla a la derecha)'));
    // the mirror image of a pose: x flips, so the heading yaw becomes pi - yaw
    const mirror = (p: Pose): Pose => ({ x: -p.x, y: p.y, yaw: Math.PI - p.yaw });
    select.addEventListener('change', () => {
      ccw = select.value === 'ccw';
      setPose(mirror(pose));
    });
    const dirField = h('div', { class: 'lw-field' }, h('label', { for: dirId }, 'Sentido de la vuelta'), select);

    const wildT = toggle(`Un rayo salvaje a la izquierda (${fmt(WILD, 0)} m)`, wild, (v) => { wild = v; changed(); });
    const fitT = toggle('Mostrar el ajuste', showFit, (v) => { showFit = v; redraw(); });
    const raysT = toggle('Mostrar los rayos', showRays, (v) => { showRays = v; redraw(); });

    // "Prueba esto": each button sets up a situation from the text and says what to look at
    const hint = h('p', { class: 'lw-caption lw-scan-hint', role: 'status' }, 'Elige una situación y mira los números.');
    function scenario(name: string, say: string, apply: () => void): HTMLButtonElement {
      const b = button(name, () => {
        apply();
        hint.textContent = say;
        b.classList.add('lw-btn-on');
        b.setAttribute('aria-pressed', 'true');
      });
      b.setAttribute('aria-pressed', 'false');
      marked.push(b);
      return b;
    }
    const place = (px: number, py = -0.75, tilt = 0) => setPose(ccw ? { x: px, y: py, yaw: tilt } : mirror({ x: px, y: py, yaw: tilt }));
    const normal = () => {
      dropout = 4.3; noiseMm = 8; wild = false;
      sdrop.set(dropout); snoise.set(noiseMm); wildT.input.checked = false;
    };
    const rollMany = () => {
      history = [];
      for (let i = 0; i < KEEP; i++) roll();
      redraw();
    };
    const presets = h('div', { class: 'lw-actions' },
      scenario('Recta', 'El coche aún está lejos del final de la isla: la esquina no entra en el abanico y island_end dice «no termina a la vista».', () => { normal(); place(-0.4); }),
      scenario('Antes de la esquina', 'island_end debe quedar cerca de 0,5 m: la isla termina medio metro más adelante. Pulsa «Repetir 20 veces» para ver cuánto se mueve.', () => { normal(); place(0); }),
      scenario('En la esquina', 'La esquina está casi al lado: island_end baja a unos 0,2 m, y front_axis también ha bajado.', () => { normal(); place(0.3); }),
      scenario('Pasada la esquina', 'Ya no hay isla al lado: left salta a más de 2 m (ahora ve la pared de fuera del otro lado) e island_end vuelve a «no termina a la vista».', () => { normal(); place(0.8); }),
      scenario('Coche torcido 17°', 'El coche apunta 17° a un lado de la pista. front_axis a lo largo de la pista da 1,38 m; midiendo hacia donde apunta el coche (la flecha de rayas, forward_yaw = 0) da 1,44 m.', () => { normal(); place(0, -0.75, 0.3); }),
      scenario('Un rayo salvaje', 'Un rayo del lado izquierdo se cuela por una abertura y vuelve con 9 m. La mediana de left casi no se entera; el promedio (fila «left con el promedio») sube a unos 0,40 m.', () => { normal(); wild = true; wildT.input.checked = true; place(0); }),
      scenario('Perder 15 % de rayos', 'Con 15 % de rayos perdidos, a veces caen tres seguidos sobre la pared, el recorrido cree que ya terminó e island_end sale muy por debajo de 0,5 m. En 500 escaneos del simulador de Python, 70 (14 %) se equivocaron más de 10 cm. Mira la tira de abajo.', () => {
        normal(); dropout = 15; sdrop.set(dropout);
        place(0);
        rollMany();
      }),
      scenario('Ruido de 30 mm', 'El ajuste admite 3 cm de distancia a la recta (WALL_TOLERANCE). Con 30 mm de ruido muchos rayos se salen de la pared sin que la pared cambie, y island_end sale casi siempre muy por debajo de 0,5 m (386 de 500 escaneos de Python se equivocaron más de 10 cm). left y front_axis casi no se mueven: cambia «Número que se sigue» a left o front_axis y compara.', () => {
        normal(); noiseMm = 30; snoise.set(noiseMm);
        place(0);
        rollMany();
      }),
    );

    function resetAll(): void {
      ccw = true;
      select.value = 'ccw';
      normal();
      seed = 1;
      metric = 'end';
      metricSelect.value = 'end';
      showFit = fitT.input.checked = true;
      showRays = raysT.input.checked = true;
      hint.textContent = 'Elige una situación y mira los números.';
      setPose(start());
    }

    const againB = button('Otro ruido', () => { roll(); redraw(); });
    const manyB = button('Repetir 20 veces', rollMany, 'lw-btn-primary');

    // ------------------------------------------------------------------------------ pointer and keys
    const toWorldPx = (ev: PointerEvent): [number, number] => {
      const r = svg.getBoundingClientRect();
      return [((ev.clientX - r.left) / r.width) * VIEW - HALF, HALF - ((ev.clientY - r.top) / r.height) * VIEW];
    };
    let dragging = false;
    svg.addEventListener('pointerdown', (ev) => {
      const [wx, wy] = toWorldPx(ev);
      setPose({ ...pose, x: wx, y: wy });
      if (ev.pointerType !== 'touch') {
        dragging = true;
        svg.setPointerCapture(ev.pointerId);
      }
    });
    svg.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      const [wx, wy] = toWorldPx(ev);
      setPose({ ...pose, x: wx, y: wy });
    });
    const stop = () => { dragging = false; };
    svg.addEventListener('pointerup', stop);
    svg.addEventListener('pointercancel', stop);
    svg.addEventListener('keydown', (ev) => {
      const step = ev.shiftKey ? 0.01 : 0.05;
      const k = ev.key.toLowerCase();
      let next: Pose | null = null;
      if (k === 'arrowleft') next = { ...pose, x: pose.x - step };
      else if (k === 'arrowright') next = { ...pose, x: pose.x + step };
      else if (k === 'arrowup') next = { ...pose, y: pose.y + step };
      else if (k === 'arrowdown') next = { ...pose, y: pose.y - step };
      else if (k === 'q') next = { ...pose, yaw: pose.yaw + (5 * Math.PI) / 180 };
      else if (k === 'e') next = { ...pose, yaw: pose.yaw - (5 * Math.PI) / 180 };
      if (next) {
        ev.preventDefault();
        setPose(next);
      }
    });

    const group = (title: string, ...kids: HTMLElement[]) => {
      const f = h('fieldset', { class: 'lw-group' }, h('legend', {}, title));
      f.append(...kids);
      return f;
    };

    root.append(
      h('div', { class: 'lw-scan-stick' }, h('div', { class: 'lw-figure lw-square' }, svg)),
      legend([
        ['muted', 'rayo que vuelve'],
        ['amber', 'rayos del ajuste'],
        ['green', 'rayos sobre la pared ajustada'],
        ['blue', 'left y right'],
        ['violet', 'front_axis'],
      ]),
      group('Prueba esto', presets, hint),
      group('¿Cuánto se mueve cada número?',
        h('div', { class: 'lw-actions' }, againB, manyB),
        metricField,
        h('div', { class: 'lw-figure' }, strip),
        legend([
          ['cream', 'un escaneo'],
          ['red', 'a más de 10 cm del valor sin ruido'],
          ['green', 'valor sin ruido ni pérdidas'],
          ['amber', 'mediana de los escaneos'],
        ]),
        stripSummary,
        stripLive,
      ),
      rd.root,
      group('Mueve el coche', h('div', { class: 'lw-controls' }, dirField, sx.root, sy.root, syaw.root)),
      group('Estropea el escaneo',
        h('div', { class: 'lw-controls' }, sdrop.root, snoise.root),
        h('div', { class: 'lw-actions' }, wildT.root, fitT.root, raysT.root),
      ),
      h('div', { class: 'lw-actions' }, button('Volver al inicio', resetAll)),
      h('p', { class: 'lw-note' }, 'Arrastra el coche con el ratón, pulsa en el campo o usa las flechas (Shift para pasos finos; Q y E lo giran). El círculo verde marca island_end. El ruido y los rayos perdidos de cada escaneo salen de una semilla: «Otro ruido» cambia de semilla sin mover el coche.'),
    );
    metricSelect.value = metric;
    restartHistory();
    draw();
  });
}
