// Widget "scan-explorer": a simulated LD19 scan of the Open Challenge field and perceive() from
// step_07_perception.py (ported exactly, see lib/lidar.ts). Drag the car, break the scan, watch the four numbers.
import { button, fmt, guarded, h, legend, readout, slider, svgEl, toggle } from './lib/common';
import { LIDAR_X, WALLS, castScan, perceiveDetailed } from './lib/lidar';
import { clamp, wrap } from './lib/sim';

const S = 100, VIEW = 3.4, HALF = VIEW / 2; // px per metre, side of the picture in metres
const FRONT = 0.1477, REAR = 0.0852, HALF_W = 0.074; // outline around base_link
const P = (x: number, y: number): [number, number] => [(x + HALF) * S, (HALF - y) * S];
const deg = (r: number) => (r * 180) / Math.PI;

interface Pose { x: number; y: number; yaw: number }

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

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let pose: Pose = { x: 0, y: -0.75, yaw: 0 };
    let ccw = true;
    let dropout = 4.3; // %
    let noiseMm = 8;
    let seed = 1;
    let showFit = true;
    let showRays = true;
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

    // ---------------------------------------------------------------------------------- drawing
    function draw(): void {
      queued = 0;
      const { x, y, yaw } = pose;
      const noise = noiseMm / 1000;
      const scan = castScan(x, y, yaw, { noise, dropout: dropout / 100, seed });
      const sign = ccw ? 1 : -1;
      const fy = wrap(trackDirection(x, y, ccw) - yaw);
      const { scene, fit, angles } = perceiveDetailed(scan, fy, sign);
      const ox = x + LIDAR_X * Math.cos(yaw), oy = y + LIDAR_X * Math.sin(yaw);
      const [lx, ly] = P(ox, oy);
      const toWorld = (px: number, py: number): [number, number] => [
        x + px * Math.cos(yaw) - py * Math.sin(yaw),
        y + px * Math.sin(yaw) + py * Math.cos(yaw),
      ];

      let out = `<rect class="lw-floor" x="0" y="0" width="${VIEW * S}" height="${VIEW * S}"/>`;
      for (const [cx, cy, sx, sy] of WALLS) {
        const [a, b] = P(cx - sx / 2, cy + sy / 2);
        out += `<rect class="lw-wall" x="${a}" y="${b}" width="${sx * S}" height="${sy * S}"/>`;
      }
      out += `<text class="lw-tag lw-c-muted" x="${P(0, 0)[0]}" y="${P(0, 0)[1] + 4}" text-anchor="middle" fill="currentColor">isla 1 × 1 m</text>`;

      // rays and hit points
      let rays = '', plain = '', used = '', wall = '';
      let lost = 0;
      scan.ranges.forEach((r, i) => {
        if (!Number.isFinite(r)) {
          lost++;
          return;
        }
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

      // the four numbers
      const arrow = (cls: string, ang: number, len: number, dy = 0) => {
        if (!Number.isFinite(len)) return '';
        const [ax, ay] = P(ox + len * Math.cos(ang), oy + len * Math.sin(ang));
        return `<line class="lw-c-${cls}" x1="${lx.toFixed(1)}" y1="${(ly + dy).toFixed(1)}" x2="${ax.toFixed(1)}" y2="${(ay + dy).toFixed(1)}" stroke="currentColor" stroke-width="2"/><circle class="lw-c-${cls}" cx="${ax.toFixed(1)}" cy="${(ay + dy).toFixed(1)}" r="3" fill="currentColor"/>`;
      };
      out += arrow('blue', yaw + Math.PI / 2, scene.left);
      out += arrow('blue', yaw - Math.PI / 2, scene.right);
      out += arrow('violet', yaw + fy, scene.frontAxis);

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
        if (Number.isFinite(scene.islandEnd) && fit.slope !== null && fit.offset !== null) {
          const lx0 = scene.islandEnd - LIDAR_X; // fit coordinates are in the lidar frame
          const [wx, wy] = toWorld(scene.islandEnd, sign * (fit.slope * lx0 + fit.offset));
          const [ex, ey] = P(wx, wy);
          out += `<circle class="lw-c-green" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="7" fill="none" stroke="currentColor" stroke-width="2.5"/>`;
        }
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
      const rows: [string, string, string?][] = [
        ['left (izquierda)', m(scene.left), 'blue'],
        ['right (derecha)', m(scene.right), 'blue'],
        ['front_axis (delante, a lo largo de la pista)', m(scene.frontAxis), 'violet'],
        ['island_end (fin de la isla, en x del coche)', Number.isFinite(scene.islandEnd) ? `x = ${fmt(scene.islandEnd, 2)} m` : 'no termina a la vista', 'green'],
        ['Rayos perdidos', `${lost} de ${scan.ranges.length}`],
      ];
      if (fit.slope !== null && fit.offset !== null) {
        rows.push(['Ajuste de la pared', fit.valid ? `a ${fmt(fit.offset, 2)} m, inclinada ${fmt(deg(Math.atan(fit.slope)), 1)}°` : 'rechazado (no es una pared a un lado)']);
      } else rows.push(['Ajuste de la pared', 'faltan rayos (menos de 10)']);
      rd.set(
        rows,
        `Izquierda ${m(scene.left)}, derecha ${m(scene.right)}, delante ${m(scene.frontAxis)}, ${Number.isFinite(scene.islandEnd) ? `la isla termina en x igual a ${fmt(scene.islandEnd, 2)} metros` : 'el fin de la isla no se ve'}. ${lost} rayos perdidos.`,
      );
    }

    const redraw = () => {
      if (!queued) queued = requestAnimationFrame(draw);
    };

    // ---------------------------------------------------------------------------------- controls
    const sx = slider({ label: 'Posición x', min: -1.4, max: 1.4, step: 0.01, value: pose.x, format: (v) => `${fmt(v, 2)} m`, onInput: (v) => setPose({ ...pose, x: v }, 'x') });
    const sy = slider({ label: 'Posición y', min: -1.4, max: 1.4, step: 0.01, value: pose.y, format: (v) => `${fmt(v, 2)} m`, onInput: (v) => setPose({ ...pose, y: v }, 'y') });
    const syaw = slider({ label: 'Rumbo del coche', min: -180, max: 180, step: 1, value: 0, format: (v) => `${fmt(v, 0)}°`, onInput: (v) => setPose({ ...pose, yaw: (v * Math.PI) / 180 }) });
    const sdrop = slider({ label: 'Perder rayos', min: 0, max: 15, step: 0.1, value: dropout, format: (v) => `${fmt(v, 1)} %`, onInput: (v) => { dropout = v; redraw(); } });
    const snoise = slider({ label: 'Ruido de la distancia', min: 0, max: 30, step: 1, value: noiseMm, format: (v) => `${fmt(v, 0)} mm`, onInput: (v) => { noiseMm = v; redraw(); } });

    function syncSliders(): void {
      sx.set(pose.x);
      sy.set(pose.y);
      syaw.set(Math.round(deg(pose.yaw)));
    }
    function setPose(p: Pose, keep?: 'x' | 'y'): void {
      pose = constrain(p);
      // a slider that was moved keeps the value the user chose unless the island pushed it
      if (keep !== 'x') sx.set(pose.x);
      if (keep !== 'y') sy.set(pose.y);
      if (keep === 'x' && sx.get() !== pose.x) sx.set(pose.x);
      if (keep === 'y' && sy.get() !== pose.y) sy.set(pose.y);
      syaw.set(Math.round(deg(pose.yaw)));
      redraw();
    }

    // preset poses (counter-clockwise lap; mirrored for clockwise)
    const preset = (name: string, px: number) =>
      button(name, () => setPose(ccw ? { x: px, y: -0.75, yaw: 0 } : { x: -px, y: -0.75, yaw: Math.PI }));
    const presets = h('div', { class: 'lw-actions' },
      preset('Recta', -0.4),
      preset('Antes de la esquina', 0),
      preset('En la esquina', 0.3),
      button('Otro ruido', () => { seed += 1; redraw(); }),
    );

    const dirId = 'lw-dir-' + Math.random().toString(36).slice(2, 7);
    const select = h('select', { id: dirId });
    select.append(h('option', { value: 'ccw' }, 'Antihoraria (isla a la izquierda)'), h('option', { value: 'cw' }, 'Horaria (isla a la derecha)'));
    select.addEventListener('change', () => {
      ccw = select.value === 'ccw';
      setPose({ x: -pose.x, y: pose.y, yaw: pose.yaw + Math.PI });
    });
    const dirField = h('div', { class: 'lw-field' }, h('label', { for: dirId }, 'Sentido de la vuelta'), select);

    const fitT = toggle('Mostrar el ajuste', showFit, (v) => { showFit = v; redraw(); });
    const raysT = toggle('Mostrar los rayos', showRays, (v) => { showRays = v; redraw(); });

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

    root.append(
      h('div', { class: 'lw-figure lw-square' }, svg),
      legend([
        ['muted', 'rayo que vuelve'],
        ['amber', 'rayos del ajuste'],
        ['green', 'rayos sobre la pared ajustada'],
        ['blue', 'left y right'],
        ['violet', 'front_axis'],
      ]),
      presets,
      h('div', { class: 'lw-controls' }, dirField, sx.root, sy.root, syaw.root, sdrop.root, snoise.root),
      h('div', { class: 'lw-actions' }, fitT.root, raysT.root),
      rd.root,
      h('p', { class: 'lw-note' }, 'Arrastra el coche con el ratón, pulsa en el campo o usa las flechas (Q y E lo giran). El círculo verde marca island_end. Los rayos y el ruido se fijan con el botón «Otro ruido».'),
    );
    syncSliders();
    draw();
  });
}
