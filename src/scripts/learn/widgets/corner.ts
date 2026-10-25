// Widget "corner": one 90 degree corner at cruising speed. Port of arc_steer / ramp (my_open/arc.py), of the MiniCar servo
// model (minisim.py) and of the bench run_arc (course/tests/helpers.py). The numbers are the ones the Python bench prints.
import { animate, button, createPlot, fmt, guarded, h, legend, readout, reducedMotion, slider, svgEl, toggle } from './lib/common';
import { CLOSE_TOLERANCE, SERVO_DELAY, SERVO_TAU, STEER_LIMIT, controllerFor, runArc, type ArcRun, type CornerConfig } from './lib/corner-model';

const DEG = 180 / Math.PI;
const VW = 300, VH = 300, K = 170; // viewBox and px/m
const X0 = 0.9, Y0 = 0.4; // metres left of and below the corner start that the window shows
const FRONT = 0.1477, REAR = 0.0852, HALF = 0.074;
const SECONDS = 4;

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    const cfg: CornerConfig = { ramp: true, feed: false, fade: true, damping: false };
    let delay = SERVO_DELAY, tau = SERVO_TAU, fast = false;
    let run: ArcRun | null = null;
    let index = 0, last = 0;
    let cancel: (() => void) | null = null;

    const svg = svgEl('svg', {
      viewBox: `0 0 ${VW} ${VH}`,
      class: 'lw-svg',
      role: 'img',
      'aria-label': 'Vista desde arriba: el coche llega recto desde la izquierda y gira 90 grados a la izquierda',
    });
    const scene = svgEl('g');
    svg.append(scene);
    const plot = createPlot({
      xmin: 0,
      xmax: SECONDS,
      xlabel: 'tiempo (s)',
      ylabel: 'rumbo (grados)',
      aria: 'Gráfico del rumbo del coche y del rumbo de referencia durante la esquina, con la meta de 90 grados',
      digitsY: 0,
    });
    const rd = readout();
    const P = (x: number, y: number): [number, number] => [(x + X0) * K, VH - (y + Y0) * K];

    const scrub = slider({
      label: 'Instante',
      min: 0,
      max: SECONDS,
      step: 0.02,
      value: 0,
      format: (v) => `${fmt(v, 2)} s`,
      onInput: (v) => {
        cancel?.();
        cancel = null;
        index = Math.min(last, Math.round(v / 0.02));
        draw();
      },
    });

    function draw(): void {
      if (!run) return;
      const i = Math.min(index, run.t.length - 1);
      let out = '';
      for (let gx = -0.5; gx <= 0.8; gx += 0.5) {
        const [px] = P(gx, 0);
        out += `<line class="lw-grid" x1="${px}" y1="0" x2="${px}" y2="${VH}"/>`;
      }
      for (let gy = 0; gy <= 1.3; gy += 0.5) {
        const [, py] = P(0, gy);
        out += `<line class="lw-grid" x1="0" y1="${py}" x2="${VW}" y2="${py}"/>`;
      }
      // the straight the car comes along, and the goal heading
      const [sx, sy] = P(-X0, 0), [ex, ey] = P(0, 0);
      out += `<line class="lw-c-muted" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 5"/>`;
      const [gx0, gy0] = P(0.72, 0.9), [gx1, gy1] = P(0.72, 1.25);
      out += `<g class="lw-c-green"><line x1="${gx0}" y1="${gy0}" x2="${gx1}" y2="${gy1}" stroke="currentColor" stroke-width="2" stroke-dasharray="6 4"/>`;
      out += `<path d="M ${gx1 - 5} ${gy1 + 8} L ${gx1} ${gy1} L ${gx1 + 5} ${gy1 + 8} Z" fill="currentColor"/>`;
      out += `<text class="lw-tag" x="${gx0}" y="${gy0 + 16}" text-anchor="middle" fill="currentColor">meta 90°</text></g>`;
      // trail
      const pts: string[] = [];
      for (let k = 0; k <= i; k += 2) pts.push(P(run.x[k], run.y[k]).map((v) => v.toFixed(1)).join(','));
      if (i % 2 === 1) pts.push(P(run.x[i], run.y[i]).map((v) => v.toFixed(1)).join(','));
      if (pts.length > 1) out += `<polyline class="lw-c-amber" points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      // where the heading first gets within 0.12 rad of the goal
      if (run.tClose !== null && i * run.dt >= run.tClose - 1e-9) {
        const k = Math.round(run.tClose / run.dt);
        const [mx, my] = P(run.x[k], run.y[k]);
        out += `<g class="lw-c-green"><circle cx="${mx}" cy="${my}" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/></g>`;
      }
      // car
      const [cx, cy] = P(run.x[i], run.y[i]);
      out += `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${(-run.yaw[i] * DEG).toFixed(2)}) scale(${K})">`;
      out += `<rect x="${-REAR}" y="${-HALF}" width="${FRONT + REAR}" height="${2 * HALF}" rx="0.012" class="lw-body"/>`;
      out += `<path d="M ${FRONT - 0.03} -0.03 L ${FRONT} 0 L ${FRONT - 0.03} 0.03 Z" class="lw-nose"/></g>`;
      out += `<g class="lw-c-cream"><line x1="12" y1="${VH - 14}" x2="${12 + 0.5 * K}" y2="${VH - 14}" stroke="currentColor" stroke-width="2"/><text class="lw-tick" x="12" y="${VH - 20}" fill="currentColor">0,5 m</text></g>`;
      scene.innerHTML = out;
      scrub.set(run.t[i]);

      const yawDeg = run.yaw.map((v) => v * DEG);
      const top = Math.max(100, Math.ceil((Math.max(...yawDeg) + 5) / 10) * 10);
      const r = run;
      plot.update({
        ymin: -10,
        ymax: top,
        hlines: [{ y: 90, label: 'meta 90°', color: 'green' }],
        series: [
          { color: 'muted', dashed: true, points: r.t.map((t, k) => [t, r.ref[k] * DEG] as [number, number]).filter((_, k) => k % 3 === 0) },
          { color: 'amber', points: r.t.map((t, k) => [t, yawDeg[k]] as [number, number]).filter((_, k) => k <= i && (k % 3 === 0 || k === i)) },
        ],
        marker: { x: run.t[i], y: yawDeg[i], color: 'blue' },
      });
    }

    function numbers(): void {
      if (!run) return;
      const over = run.overshoot * DEG;
      const clean = over < 2;
      const rows: [string, string, string?][] = [
        ['Sobrepaso (se pasa de la meta)', `${fmt(over, 1)}°`, clean ? 'green' : 'red'],
        [`Tiempo hasta ±${fmt(CLOSE_TOLERANCE, 2)} rad de la meta`, run.tClose === null ? 'no llega en 4 s' : `${fmt(run.tClose, 2)} s`],
        ['Retardo / lag del servo', `${fmt(delay, 2)} s / ${fmt(tau, 2)} s`],
        ['Creencia sobre la velocidad de giro', fast ? '70 % de la real' : 'la real'],
      ];
      rd.set(
        rows,
        `Sobrepaso de ${fmt(over, 1)} grados${clean ? ', esquina limpia' : ''}. ${run.tClose === null ? 'No llega a la meta en 4 segundos.' : `Llega a menos de 0,12 radianes de la meta a los ${fmt(run.tClose, 2)} segundos.`}`,
      );
    }

    function rerun(): void {
      cancel?.();
      cancel = null;
      run = runArc(controllerFor(cfg), { servoDelay: delay, servoTau: tau, rateFactor: fast ? 0.7 : 1 });
      last = run.t.length - 1;
      for (let k = 0; k < run.t.length; k++) {
        const [px, py] = P(run.x[k], run.y[k]);
        if (py < 40 || px > VW + 10) {
          last = k;
          break;
        }
      }
      scrub.input.max = String(run.t[last]);
      index = last;
      numbers();
      draw();
    }

    function play(): void {
      if (!run) return;
      cancel?.();
      if (reducedMotion()) {
        index = last;
        draw();
        return;
      }
      index = 0;
      draw();
      cancel = animate(
        Math.max(900, (last * 20) / 1.5),
        (t) => {
          index = Math.round(t * last);
          draw();
        },
        () => {
          cancel = null;
        },
      );
    }

    // controls
    const delaySlider = slider({
      label: 'Retardo del servo',
      min: 0.06,
      max: 0.2,
      step: 0.01,
      value: delay,
      format: (v) => `${fmt(v, 2)} s`,
      onInput: (v) => {
        delay = v;
        rerun();
      },
    });
    const tauSlider = slider({
      label: 'Suavidad del servo',
      min: 0.05,
      max: 0.15,
      step: 0.01,
      value: tau,
      format: (v) => `${fmt(v, 2)} s`,
      onInput: (v) => {
        tau = v;
        rerun();
      },
    });
    const setServo = (d: number, t: number) => {
      delay = d;
      tau = t;
      delaySlider.set(d);
      tauSlider.set(t);
    };

    const tRamp = toggle('Rampa', cfg.ramp, (v) => {
      cfg.ramp = v;
      sync();
    });
    const tFeed = toggle('Anticipación (feed-forward)', cfg.feed, (v) => {
      cfg.feed = v;
      sync();
    });
    const tFade = toggle('Desvanecer al final (fade)', cfg.fade, (v) => {
      cfg.fade = v;
      sync();
    });
    const tDamp = toggle('Amortiguación (damping)', cfg.damping, (v) => {
      cfg.damping = v;
      sync();
    });
    const tFast = toggle('El coche gira más rápido de lo esperado', fast, (v) => {
      fast = v;
      rerun();
    });
    function sync(): void {
      tFeed.input.disabled = !cfg.ramp;
      tFade.input.disabled = !cfg.ramp || !cfg.feed;
      tRamp.input.checked = cfg.ramp;
      tFeed.input.checked = cfg.feed;
      tFade.input.checked = cfg.fade;
      tDamp.input.checked = cfg.damping;
      rerun();
    }
    const recipe = (label: string, c: CornerConfig) =>
      button(label, () => {
        Object.assign(cfg, c);
        sync();
      });

    const checks = h(
      'fieldset',
      { class: 'lw-group lw-radios' },
      h('legend', {}, 'Qué lleva el controlador'),
      tRamp.root,
      tFeed.root,
      tFade.root,
      tDamp.root,
    );

    root.append(
      h('div', { class: 'lw-pair' }, h('div', { class: 'lw-figure' }, svg), h('div', { class: 'lw-figure' }, plot.svg)),
      legend([
        ['amber', 'rumbo del coche'],
        ['muted', 'referencia (la rampa)'],
        ['green', 'meta de 90° y llegada a ±0,12 rad'],
      ]),
      h('div', { class: 'lw-controls' }, delaySlider.root, tauSlider.root),
      checks,
      h('div', { class: 'lw-actions' }, tFast.root),
      h(
        'div',
        { class: 'lw-actions' },
        recipe('Solo rampa', { ramp: true, feed: false, fade: true, damping: false }),
        recipe('+ anticipación', { ramp: true, feed: true, fade: false, damping: false }),
        recipe('+ desvanecer', { ramp: true, feed: true, fade: true, damping: false }),
        recipe('+ amortiguación', { ramp: true, feed: true, fade: true, damping: true }),
        button('Servo real', () => {
          setServo(SERVO_DELAY, SERVO_TAU);
          rerun();
        }),
        button('Servo lento (0,15 / 0,10)', () => {
          setServo(0.15, 0.1);
          rerun();
        }),
      ),
      h('div', { class: 'lw-controls' }, scrub.root),
      h('div', { class: 'lw-actions' }, button('Reproducir la esquina', play, 'lw-btn-primary')),
      rd.root,
      h(
        'p',
        { class: 'lw-note' },
        `Mismo banco que run_arc de los tests: ${fmt(SECONDS, 0)} s, paso de 0,02 s, velocidad de crucero 1,28 m/s pedidos (el coche llega a 0,6), tope de dirección ${fmt(STEER_LIMIT * DEG, 1)}° y ruido del giroscopio del coche real. Sin rampa se usa jump_with_damping: la meta es la referencia desde el primer instante.`,
      ),
    );
    sync();
  });
}
