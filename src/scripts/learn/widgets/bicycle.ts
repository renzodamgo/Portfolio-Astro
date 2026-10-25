// Widget "bicycle": the bicycle model. Steering angle -> turn circle and yaw rate.
import { animate, button, fmt, guarded, h, readout, reducedMotion, slider, svgEl } from './lib/common';
import { STEER_LIMIT, WHEELBASE } from './lib/sim';

const W = 360, H = 300, K = 150; // viewBox, pixels per metre (2.4 m x 2.0 m window)
const REAL_LOCK_DEG = (STEER_LIMIT * 180) / Math.PI;
const FRONT = 0.1477, REAR = 0.0852, HALF = 0.074; // car outline around the rear axle (base_link)

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let steerDeg = 12;
    let speed = 0.4;
    let phi = 0; // angle already driven around the circle (rad, >= 0)
    let cancel: (() => void) | null = null;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'lw-svg', role: 'img' });
    const scene = svgEl('g');
    svg.append(scene);

    const rd = readout();
    const status = h('p', { class: 'lw-note' });

    const geometry = () => {
      const steer = (steerDeg * Math.PI) / 180;
      const straight = Math.abs(steerDeg) < 0.05;
      const radius = straight ? Infinity : WHEELBASE / Math.tan(Math.abs(steer));
      const dir = steerDeg >= 0 ? 1 : -1; // +1 turns left
      const yawRate = (speed * Math.tan(steer)) / WHEELBASE;
      return { steer, straight, radius, dir, yawRate };
    };

    function draw(): void {
      const { steer, straight, radius, dir } = geometry();
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
        out += `<circle cx="${ox}" cy="${oy}" r="3.5" fill="currentColor"/></g>`;
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
      const deg = (steer * 180) / Math.PI;
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
      car += `<rect x="${-REAR}" y="${-HALF}" width="${FRONT + REAR}" height="${2 * HALF}" rx="0.012" class="lw-body"/>`;
      car += wheel(0, -HALF, 0) + wheel(0, HALF, 0);
      car += wheel(WHEELBASE, -HALF, -deg) + wheel(WHEELBASE, HALF, -deg);
      car += `<path d="M ${FRONT - 0.03} -0.03 L ${FRONT + 0.0} 0 L ${FRONT - 0.03} 0.03 Z" class="lw-nose"/>`;
      car += '</g>';
      out += car;
      // scale bar 0.5 m
      out += `<g class="lw-c-cream"><line x1="14" y1="${H - 16}" x2="${14 + 0.5 * K}" y2="${H - 16}" stroke="currentColor" stroke-width="2"/><text class="lw-tick" x="14" y="${H - 22}" fill="currentColor">0,5 m</text></g>`;
      scene.innerHTML = out;
    }

    function readNumbers(): void {
      const { straight, radius, yawRate, steer } = geometry();
      const rows: [string, string][] = [
        ['Ángulo de las ruedas', `${fmt(steerDeg, 1)}°`],
        ['Radio del círculo', straight ? 'infinito (recta)' : `${fmt(radius, 2)} m`],
        ['Velocidad de giro', `${fmt(yawRate, 2)} rad/s (${fmt((yawRate * 180) / Math.PI, 0)}°/s)`],
        ['Una vuelta completa', straight ? 'no hay vuelta' : `${fmt((2 * Math.PI * radius) / speed, 1)} s`],
      ];
      rd.set(
        rows,
        straight
          ? `Ruedas rectas. El coche va recto a ${fmt(speed, 2)} metros por segundo.`
          : `Ruedas a ${fmt(steerDeg, 1)} grados. Radio ${fmt(radius, 2)} metros. Giro de ${fmt(yawRate, 2)} radianes por segundo.`,
      );
      status.textContent =
        Math.abs(steer) > STEER_LIMIT + 1e-6
          ? `Ojo: el servo del coche real solo llega a ${fmt(REAL_LOCK_DEG, 1)}° (radio ${fmt(WHEELBASE / Math.tan(STEER_LIMIT), 2)} m). El simulador admite hasta 25°.`
          : `Con el tope del coche real (${fmt(REAL_LOCK_DEG, 1)}°) el radio mínimo es ${fmt(WHEELBASE / Math.tan(STEER_LIMIT), 2)} m.`;
      svg.setAttribute(
        'aria-label',
        straight
          ? 'Vista desde arriba del coche con las ruedas rectas'
          : `Vista desde arriba del coche girando ${steerDeg > 0 ? 'a la izquierda' : 'a la derecha'} en un círculo de radio ${fmt(radius, 2)} metros`,
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

    const steerSlider = slider({
      label: 'Ángulo de las ruedas',
      min: -25,
      max: 25,
      step: 0.5,
      value: steerDeg,
      format: (v) => `${fmt(v, 1)}°`,
      onInput: (v) => {
        steerDeg = v;
        reset();
      },
    });
    const speedSlider = slider({
      label: 'Velocidad',
      min: 0.15,
      max: 0.6,
      step: 0.05,
      value: speed,
      format: (v) => `${fmt(v, 2)} m/s`,
      onInput: (v) => {
        speed = v;
        reset();
      },
    });
    const go = button('Dar una vuelta', lap, 'lw-btn-primary');
    const full = button('Tope del coche real', () => {
      steerSlider.set(Math.sign(steerDeg || 1) * Number(REAL_LOCK_DEG.toFixed(1)));
      steerDeg = steerSlider.get();
      reset();
    });
    const center = button('Ruedas rectas', () => {
      steerSlider.set(0);
      steerDeg = 0;
      reset();
    });

    root.append(
      h('div', { class: 'lw-figure' }, svg),
      h('div', { class: 'lw-controls' }, steerSlider.root, speedSlider.root),
      h('div', { class: 'lw-actions' }, go, full, center),
      rd.root,
      status,
    );
    reset();
  });
}
