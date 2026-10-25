// Widget "bicycle": the bicycle model. Steering angle -> turn circle and yaw rate (step 1: model.py).
// Variables and units are the ones of the code: `steer` in rad (the degrees are shown beside it), `speed` in m/s,
// turn_radius(steer) = L / tan(|steer|) and yaw_rate(speed, steer) = speed * tan(steer) / L.
import { animate, button, fmt, guarded, h, legend, readout, reducedMotion, slider, svgEl } from './lib/common';
import { STEER_LIMIT, WHEELBASE } from './lib/sim';

const W = 360, H = 300, K = 150; // viewBox, pixels per metre (2.4 m x 2.0 m window)
const REAL_LOCK_DEG = (STEER_LIMIT * 180) / Math.PI;
const FRONT = 0.1477, REAR = 0.0852, HALF = 0.074; // car outline around the rear axle (base_link)
const REFERENCE_STEER = 0.25; // rad: the default of the `steer` parameter of drive.py
const SIM_LOCK = (25 * Math.PI) / 180; // rad: what the simulator accepts
const DEFAULT_SPEED = 0.4;
const RAD_STEP = 0.01;
const SLIDER_MAX = 0.43; // rad, 24.6 deg: on the RAD_STEP grid, just under the simulator's 25 deg

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let steer = REFERENCE_STEER; // rad, positive = left (exact value; the slider snaps to RAD_STEP)
    let speed = DEFAULT_SPEED; // m/s
    let phi = 0; // angle already driven around the circle (rad, >= 0)
    let cancel: (() => void) | null = null;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'lw-svg', role: 'img' });
    const scene = svgEl('g');
    svg.append(scene);

    const rd = readout();
    const status = h('p', { class: 'lw-note' });
    const deg = (rad: number) => (rad * 180) / Math.PI;

    const geometry = () => {
      const straight = Math.abs(steer) < 0.0005;
      const radius = straight ? Infinity : WHEELBASE / Math.tan(Math.abs(steer));
      const dir = steer >= 0 ? 1 : -1; // +1 turns left
      const yawRate = (speed * Math.tan(steer)) / WHEELBASE;
      return { straight, radius, dir, yawRate };
    };

    function draw(): void {
      const { straight, radius, dir } = geometry();
      const lap = straight ? 0 : Math.min(2 * Math.PI, 6.0 / radius); // angle of the whole run
      const big = radius > 0.9;
      const cx = straight || big ? 0.5 : 0;
      const cy = straight ? 0 : big ? dir * 0.35 : dir * radius;
      const P = (x: number, y: number): [number, number] => [W / 2 + (x - cx) * K, H / 2 - (y - cy) * K];

      // Pose of the car after driving phi round the circle.
      const a = Math.min(phi, lap);
      let x = 0, y = 0, yaw = 0;
      if (straight) {
        x = phi * 0.3; // phi doubles as metres when straight
      } else {
        x = radius * Math.sin(a);
        y = dir * radius * (1 - Math.cos(a));
        yaw = dir * a;
      }

      let out = '';
      // floor grid every 0.5 m
      for (let gx = Math.ceil((cx - 1.2) / 0.5) * 0.5; gx <= cx + 1.2; gx += 0.5) {
        const [px] = P(gx, 0);
        out += `<line class="lw-grid" x1="${px}" y1="0" x2="${px}" y2="${H}"/>`;
      }
      for (let gy = Math.ceil((cy - 1.0) / 0.5) * 0.5; gy <= cy + 1.0; gy += 0.5) {
        const [, py] = P(0, gy);
        out += `<line class="lw-grid" x1="0" y1="${py}" x2="${W}" y2="${py}"/>`;
      }
      // turn circle and centre
      if (!straight) {
        const [ox, oy] = P(0, dir * radius);
        out += `<g class="lw-c-blue"><circle cx="${ox}" cy="${oy}" r="${radius * K}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 5"/>`;
        out += `<circle cx="${ox}" cy="${oy}" r="3.5" fill="currentColor"/>`;
        if (!big && phi === 0) out += `<text class="lw-tag" x="${ox + 8}" y="${oy - 8}" fill="currentColor">centro</text>`;
        out += '</g>';
      }
      // trail
      if (phi > 0) {
        const pts: string[] = [];
        const n = 90;
        for (let i = 0; i <= n; i++) {
          const t = (i / n) * a;
          const [px, py] = straight ? P((i / n) * x, 0) : P(radius * Math.sin(t), dir * radius * (1 - Math.cos(t)));
          pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
        }
        out += `<polyline class="lw-c-amber" points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`;
      }
      // car (local frame: metres, x forward, svg y points to the car's right)
      const [px, py] = P(x, y);
      const wheelDeg = deg(steer);
      const wheel = (wx: number, wy: number, rot: number) =>
        `<rect x="-0.032" y="-0.0085" width="0.064" height="0.017" rx="0.004" transform="translate(${wx} ${wy}) rotate(${rot})" class="lw-wheel"/>`;
      let car = `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${((-yaw * 180) / Math.PI).toFixed(2)}) scale(${K})">`;
      if (!straight) {
        const len = Math.min(radius, 6) * dir * -1;
        car += `<g class="lw-c-blue" stroke="currentColor" stroke-width="0.006" stroke-dasharray="0.03 0.025" opacity="0.8">`;
        car += `<line x1="0" y1="0" x2="0" y2="${len}"/>`;
        // the front wheel axis meets the rear axle line at the circle centre
        car += `<line x1="${WHEELBASE}" y1="0" x2="0" y2="${len}"/>`;
        car += '</g>';
      }
      // wheelbase L: a dimension line on the side opposite to the circle centre
      const side = dir >= 0 || straight ? 1 : -1; // +1 = the car's right (svg y down)
      const dimY = side * (HALF + 0.032);
      car += `<g class="lw-c-cream" stroke="currentColor" stroke-width="0.006"><line x1="0" y1="${dimY}" x2="${WHEELBASE}" y2="${dimY}"/>`;
      car += `<line x1="0" y1="${dimY - 0.012}" x2="0" y2="${dimY + 0.012}"/><line x1="${WHEELBASE}" y1="${dimY - 0.012}" x2="${WHEELBASE}" y2="${dimY + 0.012}"/></g>`;
      car += `<rect x="${-REAR}" y="${-HALF}" width="${FRONT + REAR}" height="${2 * HALF}" rx="0.012" class="lw-body"/>`;
      car += wheel(0, -HALF, 0) + wheel(0, HALF, 0);
      car += wheel(WHEELBASE, -HALF, -wheelDeg) + wheel(WHEELBASE, HALF, -wheelDeg);
      car += `<path d="M ${FRONT - 0.03} -0.03 L ${FRONT + 0.0} 0 L ${FRONT - 0.03} 0.03 Z" class="lw-nose"/>`;
      car += '</g>';
      out += car;
      // upright labels, placed from the car's pose (only at rest, so they never run over the trail)
      if (phi === 0) {
        const th = -yaw;
        const at = (u: number, v: number): [number, number] => [
          px + K * (u * Math.cos(th) - v * Math.sin(th)),
          py + K * (u * Math.sin(th) + v * Math.cos(th)),
        ];
        const [lx, ly] = at(WHEELBASE / 2, dimY + side * 0.048);
        out += `<g class="lw-c-cream"><text class="lw-tag" x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" fill="currentColor">L</text></g>`;
        if (!straight && !big) {
          const [rx, ry] = at(-0.045, (Math.min(radius, 6) * dir * -1) / 2);
          out += `<g class="lw-c-blue"><text class="lw-tag" x="${rx.toFixed(1)}" y="${(ry + 4).toFixed(1)}" text-anchor="middle" fill="currentColor">R</text></g>`;
        }
      }
      // scale bar 0.5 m
      out += `<g class="lw-c-cream"><line x1="14" y1="${H - 16}" x2="${14 + 0.5 * K}" y2="${H - 16}" stroke="currentColor" stroke-width="2"/><text class="lw-tick" x="14" y="${H - 22}" fill="currentColor">0,5 m</text></g>`;
      scene.innerHTML = out;
    }

    function readNumbers(): void {
      const { straight, radius, yawRate } = geometry();
      const lock = WHEELBASE / Math.tan(STEER_LIMIT);
      const rows: [string, string][] = [
        ['steer', `${fmt(steer, 3)} rad (${fmt(deg(steer), 1)}°)`],
        ['turn_radius(steer)', straight ? 'infinito (recta)' : `${fmt(radius, 3)} m`],
        ['yaw_rate(speed, steer)', `${fmt(yawRate, 2)} rad/s (${fmt(deg(yawRate), 0)}°/s)`],
        [
          'Una vuelta completa',
          straight ? 'no hay vuelta' : speed <= 0 ? 'el coche está parado' : `${fmt((2 * Math.PI * radius) / speed, 1)} s`,
        ],
      ];
      rd.set(
        rows,
        straight
          ? `Ruedas rectas. El coche va recto a ${fmt(speed, 2)} metros por segundo.`
          : `Ruedas a ${fmt(steer, 3)} radianes, ${fmt(deg(steer), 1)} grados. Radio ${fmt(radius, 2)} metros. Giro de ${fmt(yawRate, 2)} radianes por segundo.`,
      );
      if (Math.abs(steer) > STEER_LIMIT + 1e-6) {
        status.textContent = `Ojo: el servo del coche real solo llega a ${fmt(STEER_LIMIT, 3)} rad (${fmt(REAL_LOCK_DEG, 1)}°), con radio mínimo ${fmt(lock, 3)} m. El simulador admite hasta ${fmt(SIM_LOCK, 3)} rad (25°).`;
      } else if (straight) {
        status.textContent = 'Con las ruedas rectas el radio es infinito: el coche va en línea recta.';
      } else {
        status.textContent = `${fmt(WHEELBASE, 4)} / tan(${fmt(Math.abs(steer), 3)}) = ${fmt(radius, 3)} m. Tope del coche real: ${fmt(STEER_LIMIT, 3)} rad (${fmt(REAL_LOCK_DEG, 1)}°), radio mínimo ${fmt(lock, 3)} m.`;
      }
      svg.setAttribute(
        'aria-label',
        straight
          ? 'Vista desde arriba del coche con las ruedas rectas'
          : `Vista desde arriba del coche girando ${steer > 0 ? 'a la izquierda' : 'a la derecha'} en un círculo de radio ${fmt(radius, 2)} metros`,
      );
    }

    function reset(): void {
      cancel?.();
      cancel = null;
      phi = 0;
      draw();
      readNumbers();
    }

    function lap(): void {
      cancel?.();
      const { straight, radius } = geometry();
      if (speed <= 0) {
        status.textContent = 'La velocidad es 0: el coche no se mueve, así que no hay vuelta. Sube la velocidad.';
        return;
      }
      const total = straight ? 2.0 / 0.3 : Math.min(2 * Math.PI, 6.0 / radius);
      phi = 0;
      if (reducedMotion()) {
        phi = total;
        draw();
        return;
      }
      const ms = Math.max(1200, Math.min(4500, (total / (2 * Math.PI)) * 4500));
      cancel = animate(
        ms,
        (t) => {
          phi = t * total;
          draw();
        },
        () => {
          cancel = null;
        },
      );
    }

    // The slider snaps to RAD_STEP; while the exact `steer` (a preset such as 0.30718) is within half a step of the
    // slider value, the label shows the exact one.
    const showSteer = (v: number) => {
      const s = Math.abs(v - steer) <= RAD_STEP / 2 + 1e-9 ? steer : v;
      return `${fmt(s, 3)} rad (${fmt(deg(s), 1)}°)`;
    };
    const steerSlider = slider({
      label: 'Ángulo de las ruedas (steer)',
      min: -SLIDER_MAX,
      max: SLIDER_MAX,
      step: RAD_STEP,
      value: REFERENCE_STEER,
      format: showSteer,
      onInput: (v) => {
        steer = v;
        reset();
      },
    });
    const speedSlider = slider({
      label: 'Velocidad (speed)',
      min: 0,
      max: 0.6,
      step: 0.05,
      value: speed,
      format: (v) => `${fmt(v, 2)} m/s`,
      onInput: (v) => {
        speed = v;
        reset();
      },
    });

    const setSteer = (v: number) => {
      steer = v;
      steerSlider.set(v);
      reset();
    };
    const go = button('Dar una vuelta', lap, 'lw-btn-primary');
    const ref = button('Referencia (0,25 rad)', () => setSteer(REFERENCE_STEER));
    const full = button('Tope del coche real', () => setSteer(Math.sign(steer || 1) * STEER_LIMIT));
    const center = button('Ruedas rectas', () => setSteer(0));
    const again = button('Reiniciar', () => {
      speed = DEFAULT_SPEED;
      speedSlider.set(speed);
      setSteer(REFERENCE_STEER);
    });

    root.append(
      h('div', { class: 'lw-figure' }, svg),
      legend([
        ['blue', 'círculo que dibuja el coche, con su centro y el radio R'],
        ['amber', 'camino recorrido'],
        ['cream', 'L: distancia entre ejes'],
      ]),
      h('div', { class: 'lw-controls' }, steerSlider.root, speedSlider.root),
      h('div', { class: 'lw-actions' }, go, ref, full, center, again),
      rd.root,
      status,
    );
    reset();
  });
}
