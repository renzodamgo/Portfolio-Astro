// Widget "corner": one 90 degree corner at cruising speed. Port of arc_steer / ramp (my_open/arc.py), of the MiniCar servo
// model (minisim.py) and of the bench run_arc (course/tests/helpers.py). The numbers are the ones the Python bench prints
// (lib/corner-model.ts was checked against Python for the six rows of the lesson's table in four situations).
import { animate, button, createPlot, fmt, guarded, h, legend, readout, reducedMotion, slider, svgEl, toggle } from './lib/common';
import {
  CLOSE_TOLERANCE, SERVO_DELAY, SERVO_TAU, STEER_LIMIT, VARIANTS, controllerFor, fullLockRate, pythonCall, runArc, variantKey,
  type ArcRun, type CornerConfig,
} from './lib/corner-model';

const DEG = 180 / Math.PI;
const VW = 300, VH = 300, K = 170; // viewBox and px/m
const X0 = 0.9, Y0 = 0.4; // metres left of and below the corner start that the window shows
const FRONT = 0.1477, REAR = 0.0852, HALF = 0.074;
const SECONDS = 4;
const CLEAN = 2; // degrees: the tests accept less than this

const BASE: CornerConfig = { ramp: true, feed: false, fade: true, damping: false };
const INTRO = 'Elige una situación y un controlador, o pulsa uno de los intentos. Antes de pulsar, predice el sobrepaso.';
const CUSTOM = 'Valores propios: la tabla de abajo muestra cómo cambia cada controlador con esta situación.';

interface Situation {
  label: string;
  delay: number;
  tau: number;
  fast: boolean;
}
const SITUATIONS: Situation[] = [
  { label: '1 Servo real', delay: SERVO_DELAY, tau: SERVO_TAU, fast: false },
  { label: '2 Servo lento', delay: 0.15, tau: 0.1, fast: false },
  { label: '3 Gira más rápido de lo que cree la estrategia', delay: SERVO_DELAY, tau: SERVO_TAU, fast: true },
];

interface Attempt {
  label: string;
  cfg: CornerConfig;
  sit: number;
  look: string;
}
const ATTEMPTS: Attempt[] = [
  {
    label: 'Servo lento, solo rampa',
    cfg: VARIANTS[0].cfg,
    sit: 1,
    look: 'La referencia (línea gris) llega a 90° en 1 s, pero el servo tarda en responder: el coche sigue girando cuando ya debería enderezar y se pasa unos 10°. En «Ver el volante», el volante pedido solo cambia de signo cuando el coche ya pasó de 90° (a 92,8°).',
  },
  {
    label: 'Añade amortiguamiento',
    cfg: VARIANTS[4].cfg,
    sit: 1,
    look: 'El mismo servo lento, pero ahora se resta damping por la velocidad de giro que sobra: el volante cambia de signo antes de llegar a la meta (a 81,7°) y el sobrepaso baja a 0,2°.',
  },
  {
    label: 'Gira más rápido, sin aflojar',
    cfg: VARIANTS[1].cfg,
    sit: 2,
    look: 'La estrategia cree que el coche gira menos de lo que gira: la referencia sube más despacio que el coche. El feed-forward sigue sumando casi todo el volante, así que al llegar a 90° el volante aún pide unos 12° a la izquierda y el coche se pasa unos 17°. El servo es el real: el fallo no viene del servo.',
  },
  {
    label: 'Con aflojado',
    cfg: VARIANTS[2].cfg,
    sit: 2,
    look: 'Igual, pero el feed-forward se apaga en el último cuarto de radián antes de la meta (EXIT_ANGLE): al llegar a 90° el volante pide 0° y el sobrepaso baja a 0,3°.',
  },
  {
    label: 'Sin rampa',
    cfg: VARIANTS[5].cfg,
    sit: 1,
    look: 'Sin rampa, la meta es la referencia desde el primer instante y solo se amortigua. Con servo lento también queda limpio (0,1°), pero tarda más en llegar (1,22 s contra 1,20 s). La rampa no es lo que evita el sobrepaso; el amortiguamiento sí.',
  },
];

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    const cfg: CornerConfig = { ...BASE };
    let delay = SERVO_DELAY, tau = SERVO_TAU, fast = false;
    let run: ArcRun | null = null;
    let index = 0, last = 0;
    let cancel: (() => void) | null = null;
    let view: 'yaw' | 'steer' = 'yaw';
    let look = INTRO;

    const svg = svgEl('svg', {
      viewBox: `0 0 ${VW} ${VH}`,
      class: 'lw-svg',
      role: 'img',
      'aria-label': 'Vista desde arriba: el coche llega recto desde la izquierda y gira 90 grados a la izquierda',
    });
    const scene = svgEl('g');
    svg.append(scene);
    const yawPlot = createPlot({
      xmin: 0,
      xmax: SECONDS,
      xlabel: 'tiempo (s)',
      ylabel: 'rumbo (grados)',
      aria: 'Gráfico del rumbo del coche y del rumbo de referencia durante la esquina, con la meta de 90 grados',
      digitsY: 0,
    });
    const steerPlot = createPlot({
      xmin: 0,
      xmax: SECONDS,
      xlabel: 'tiempo (s)',
      ylabel: 'volante (grados)',
      aria: 'Gráfico del volante pedido por el controlador y del volante que alcanza el servo durante la esquina, con el tope de 17,6 grados',
      digitsY: 0,
    });
    steerPlot.svg.setAttribute('hidden', '');
    const yawLegend = legend([
      ['amber', 'rumbo del coche (yaw)'],
      ['muted', 'referencia (ref, la rampa)'],
      ['green', 'meta de 90° y llegada a ±0,12 rad'],
    ]);
    const steerLegend = legend([
      ['amber', 'volante pedido (steer)'],
      ['blue', 'volante que alcanza el servo'],
      ['green', 'tope del volante (17,6°)'],
    ]);
    steerLegend.setAttribute('hidden', '');
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

      const r = run;
      const yawDeg = r.yaw.map((v) => v * DEG);
      const top = Math.max(100, Math.ceil((Math.max(...yawDeg) + 5) / 10) * 10);
      yawPlot.update({
        ymin: -10,
        ymax: top,
        hlines: [{ y: 90, label: 'meta 90°', color: 'green' }],
        series: [
          { color: 'muted', dashed: true, points: r.t.map((t, k) => [t, r.ref[k] * DEG] as [number, number]).filter((_, k) => k % 3 === 0) },
          { color: 'amber', points: r.t.map((t, k) => [t, yawDeg[k]] as [number, number]).filter((_, k) => k <= i && (k % 3 === 0 || k === i)) },
        ],
        marker: { x: r.t[i], y: yawDeg[i], color: 'blue' },
      });
      const lock = STEER_LIMIT * DEG;
      const edge = Math.ceil((lock + 4) / 5) * 5;
      steerPlot.update({
        ymin: -edge,
        ymax: edge,
        hlines: [
          { y: lock, label: 'tope', color: 'green' },
          { y: -lock, label: 'tope', color: 'green' },
        ],
        series: [
          { color: 'blue', points: r.t.map((t, k) => [t, r.steer[k] * DEG] as [number, number]).filter((_, k) => k <= i && (k % 3 === 0 || k === i)) },
          { color: 'amber', points: r.t.map((t, k) => [t, r.cmd[k] * DEG] as [number, number]).filter((_, k) => k <= i && (k % 3 === 0 || k === i)) },
        ],
        marker: { x: r.t[i], y: r.cmd[i] * DEG, color: 'amber' },
      });
    }

    const code = h('code', { class: 'lw-corner-code' });
    const tableBody = h('tbody');
    const table = h(
      'div',
      { class: 'lw-tablewrap', tabindex: '0', role: 'region', 'aria-label': 'Sobrepaso y tiempo de cada controlador con la situación elegida' },
      h(
        'table',
        { class: 'lw-table lw-table-small' },
        h('caption', { class: 'lw-corner-caption' }, 'Los seis controladores de la lección con la situación elegida: sobrepaso y tiempo hasta quedar a ±0,12 rad de la meta. Pulsa uno para probarlo.'),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Controlador'), h('th', { scope: 'col' }, 'Sobrepaso'), h('th', { scope: 'col' }, 'Tiempo'))),
        tableBody,
      ),
    );
    const lookEl = h('p', { class: 'lw-caption lw-corner-look', role: 'status', 'aria-live': 'polite' }, look);

    function numbers(): void {
      if (!run) return;
      const over = run.overshoot * DEG;
      const clean = over < CLEAN;
      const peak = Math.max(...run.cmd.map((v) => Math.abs(v))) * DEG;
      const rows: [string, string, string?][] = [
        ['Sobrepaso máximo (pasarse de la meta)', `${fmt(over, 1)}°${clean ? '' : ' (más de 2°)'}`, clean ? 'green' : 'red'],
        [`Tiempo hasta ±${fmt(CLOSE_TOLERANCE, 2)} rad de la meta`, run.tClose === null ? 'no llega en 4 s' : `${fmt(run.tClose, 2)} s`],
        ['Volante máximo pedido', `${fmt(peak, 1)}°${peak >= STEER_LIMIT * DEG - 0.05 ? ' (el tope)' : ''}`],
        ['Servo (delay / tau)', `${fmt(delay, 2)} s / ${fmt(tau, 2)} s`],
        ['La estrategia cree que el giro máximo es', fast ? '0,7 del real' : 'el real'],
      ];
      rd.set(
        rows,
        `Sobrepaso de ${fmt(over, 1)} grados${clean ? ', esquina limpia' : ', más de 2 grados'}. ${run.tClose === null ? 'No llega a la meta en 4 segundos.' : `Llega a menos de 0,12 radianes de la meta a los ${fmt(run.tClose, 2)} segundos.`}`,
      );
      code.textContent = pythonCall(cfg, delay, tau, fast);
    }

    function variants(): void {
      const key = variantKey(cfg);
      tableBody.replaceChildren(
        ...VARIANTS.map((v) => {
          const r = runArc(controllerFor(v.cfg), { servoDelay: delay, servoTau: tau, rateFactor: fast ? 0.7 : 1 });
          const o = r.overshoot * DEG;
          const b = button(
            v.label,
            () => {
              Object.assign(cfg, v.cfg);
              look = CUSTOM;
              sync();
            },
            'lw-sort',
          );
          return h(
            'tr',
            { class: v.key === key ? 'lw-row-hit' : undefined, 'aria-current': v.key === key ? 'true' : undefined },
            h('th', { scope: 'row' }, b),
            h('td', { class: o < CLEAN ? 'lw-c-green' : 'lw-c-red' }, `${fmt(o, 1)}°`),
            h('td', {}, r.tClose === null ? 'no llega' : `${fmt(r.tClose, 2)} s`),
          );
        }),
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
      variants();
      pressSituations();
      lookEl.textContent = look;
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
      label: 'Retraso del servo (servo_delay)',
      min: 0.06,
      max: 0.2,
      step: 0.01,
      value: delay,
      format: (v) => `${fmt(v, 2)} s`,
      onInput: (v) => {
        delay = v;
        look = CUSTOM;
        rerun();
      },
    });
    const tauSlider = slider({
      label: 'Inercia del servo (servo_tau)',
      min: 0.05,
      max: 0.15,
      step: 0.01,
      value: tau,
      format: (v) => `${fmt(v, 2)} s`,
      onInput: (v) => {
        tau = v;
        look = CUSTOM;
        rerun();
      },
    });
    const setServo = (d: number, t: number) => {
      delay = d;
      tau = t;
      delaySlider.set(d);
      tauSlider.set(t);
    };

    const tRamp = toggle('Rampa (la ley sigue a ref, no a goal)', cfg.ramp, (v) => {
      cfg.ramp = v;
      look = CUSTOM;
      sync();
    });
    const tFeed = toggle('Feed-forward (feed=True)', cfg.feed, (v) => {
      cfg.feed = v;
      look = CUSTOM;
      sync();
    });
    const tFade = toggle('Aflojado (fade=True)', cfg.fade, (v) => {
      cfg.fade = v;
      look = CUSTOM;
      sync();
    });
    const tDamp = toggle('Amortiguamiento (damping=0,1)', cfg.damping, (v) => {
      cfg.damping = v;
      look = CUSTOM;
      sync();
    });
    const tFast = toggle('La estrategia cree que el coche gira menos (rate_factor=0,7)', fast, (v) => {
      fast = v;
      look = CUSTOM;
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

    const sitButtons = SITUATIONS.map((s) =>
      button(s.label, () => {
        setSituation(s);
        look = CUSTOM;
        rerun();
      }),
    );
    function setSituation(s: Situation): void {
      setServo(s.delay, s.tau);
      fast = s.fast;
      tFast.input.checked = fast;
    }
    function pressSituations(): void {
      SITUATIONS.forEach((s, i) => {
        const on = Math.abs(delay - s.delay) < 1e-9 && Math.abs(tau - s.tau) < 1e-9 && fast === s.fast;
        sitButtons[i].classList.toggle('lw-btn-on', on);
        sitButtons[i].setAttribute('aria-pressed', String(on));
      });
    }

    const attemptButtons = ATTEMPTS.map((t) =>
      button(t.label, () => {
        Object.assign(cfg, t.cfg);
        setSituation(SITUATIONS[t.sit]);
        look = t.look;
        sync();
        play();
      }),
    );

    const viewButtons = (['yaw', 'steer'] as const).map((v) =>
      button(v === 'yaw' ? 'Ver el rumbo' : 'Ver el volante', () => {
        view = v;
        showView();
      }),
    );
    function showView(): void {
      yawPlot.svg.toggleAttribute('hidden', view !== 'yaw');
      yawLegend.toggleAttribute('hidden', view !== 'yaw');
      steerPlot.svg.toggleAttribute('hidden', view !== 'steer');
      steerLegend.toggleAttribute('hidden', view !== 'steer');
      viewButtons.forEach((b, i) => {
        const on = (i === 0) === (view === 'yaw');
        b.classList.toggle('lw-btn-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }

    const reset = button('Restablecer', () => {
      Object.assign(cfg, BASE);
      setSituation(SITUATIONS[0]);
      look = INTRO;
      view = 'yaw';
      showView();
      sync();
    });

    const checks = h('fieldset', { class: 'lw-group lw-radios' }, h('legend', {}, 'Qué lleva el controlador'), tRamp.root, tFeed.root, tFade.root, tDamp.root);
    const situation = h(
      'fieldset',
      { class: 'lw-group' },
      h('legend', {}, 'Situación'),
      h('div', { class: 'lw-actions' }, ...sitButtons),
      h('div', { class: 'lw-controls' }, delaySlider.root, tauSlider.root),
      tFast.root,
    );

    root.append(
      h('div', { class: 'lw-pair' }, h('div', { class: 'lw-figure' }, svg), h('div', { class: 'lw-figure' }, yawPlot.svg, steerPlot.svg)),
      h('div', { class: 'lw-actions' }, ...viewButtons),
      yawLegend,
      steerLegend,
      situation,
      checks,
      rd.root,
      h('p', { class: 'lw-note' }, 'Equivale a este banco de Python: ', code),
      table,
      h('div', { class: 'lw-actions' }, h('span', { class: 'lw-meter-title lw-tg-label' }, 'Prueba esto (predice el sobrepaso antes de pulsar)'), ...attemptButtons),
      lookEl,
      h('div', { class: 'lw-controls' }, scrub.root),
      h('div', { class: 'lw-actions' }, button('Reproducir la esquina', play, 'lw-btn-primary'), reset),
      h(
        'p',
        { class: 'lw-note' },
        `Mismo banco que run_arc de los tests: ${fmt(SECONDS, 0)} s, paso de 0,02 s, velocidad de crucero 1,28 m/s pedidos (el coche llega a 0,6), giro máximo de ${fmt(fullLockRate(), 2)} rad/s con el volante al tope (${fmt(STEER_LIMIT * DEG, 1)}°) y ruido del giroscopio del coche real. Sin rampa se usa jump_with_damping: la meta es la referencia desde el primer instante.`,
      ),
    );
    showView();
    setSituation(SITUATIONS[0]);
    sync();
  });
}
