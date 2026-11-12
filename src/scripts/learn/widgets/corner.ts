// Widget "corner": one 90 degree corner at the corner speed. Port of arc_steer / damped_steer (my_open/arc.py), of the MiniCar
// servo model (minisim.py) and of the bench run_arc (course/tests/helpers.py). The numbers are the ones the Python bench prints
// (lib/corner-model.ts was checked against Python for both servos, the five release angles and damping on and off).
import { animate, button, createPlot, fmt, guarded, h, legend, readout, reducedMotion, slider, svgEl, toggle } from './lib/common';
import {
  CLOSE_TOLERANCE, DAMPING, SERVO_DELAY, SERVO_TAU, STEER_LIMIT, TOLERANCES, TURN_TOLERANCE, fullLockRate, pythonCall, realSpeed, runArc, CORNER_SPEED,
  type ArcRun,
} from './lib/corner-model';

const DEG = 180 / Math.PI;
const VW = 300, VH = 300, K = 170; // viewBox and px/m
const X0 = 0.9, Y0 = 0.4; // metres left of and below the corner start that the window shows
const FRONT = 0.1477, REAR = 0.0852, HALF = 0.074;
const SECONDS = 4;
const CLEAN = 2; // degrees: the tests accept less than this

const INTRO = 'Elige el servo, a cuántos grados de la meta se suelta el tope y si hay amortiguamiento, o pulsa uno de los intentos. Antes de pulsar, predice el sobrepaso.';
const CUSTOM = 'Valores propios: la tabla de abajo muestra el sobrepaso con cada ángulo de soltar para este servo.';

interface Servo {
  label: string;
  delay: number;
  tau: number;
}
const SERVOS: Servo[] = [
  { label: '1 Servo real', delay: SERVO_DELAY, tau: SERVO_TAU },
  { label: '2 Servo lento', delay: 0.15, tau: 0.1 },
];

interface Attempt {
  label: string;
  servo: number;
  tolerance: number;
  damping: boolean;
  look: string;
}
const ATTEMPTS: Attempt[] = [
  {
    label: 'a) Servo real, suelta a 3°',
    servo: 0,
    tolerance: 0.05,
    damping: true,
    look: 'El volante sigue al tope hasta que faltan 3°. En ese momento el coche gira a 81° por segundo y el servo tarda en enderezar las ruedas. En «Ver el volante», las ruedas quedan rectas cuando el coche ya va por 102°. Se pasa 12,0° y tarda 2,10 s en quedar a 3° de la meta.',
  },
  {
    label: 'b) Servo real, suelta a 7°',
    servo: 0,
    tolerance: 0.12,
    damping: true,
    look: 'Suelta un poco antes y se pasa menos: 8,7°, y tarda 1,94 s. Todavía suelta tarde: las ruedas quedan rectas cuando el coche va por 98,7°.',
  },
  {
    label: 'c) Servo real, suelta a 17°',
    servo: 0,
    tolerance: 0.3,
    damping: true,
    look: 'Es el valor del curso (TURN_TOLERANCE = 0,3 rad). Suelta el tope a 73° y las ruedas quedan rectas justo al llegar a 90°. Sobrepaso de 0,0° y 1,36 s. Prueba a soltar a 29° o a 46°: tampoco se pasa, pero tarda más (1,70 s y 1,72 s).',
  },
  {
    label: 'd) Servo lento, 17°, sin amortiguamiento',
    servo: 1,
    tolerance: 0.3,
    damping: false,
    look: 'Con el servo lento el mismo ángulo ya no alcanza: se pasa 8,6°. Marca el amortiguamiento y baja a 6,0°. Ayuda, pero no basta: con este servo hay que soltar antes.',
  },
  {
    label: 'e) Servo lento, 29°, con amortiguamiento',
    servo: 1,
    tolerance: 0.5,
    damping: true,
    look: 'Soltando a 29° y con amortiguamiento el servo lento tampoco se pasa: 0,0° y 1,46 s. Quita el amortiguamiento y vuelve a pasarse 8,2°. Cada servo pide su ángulo de soltar.',
  },
];

const tolDeg = (t: number): string => `${fmt(t * DEG, 0)}°`;

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let delay = SERVO_DELAY, tau = SERVO_TAU;
    let tolerance = TURN_TOLERANCE;
    let damping = true;
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
      aria: 'Gráfico del rumbo del coche durante la esquina, con la meta de 90 grados y el rumbo en el que se suelta el tope',
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
      ['blue', 'aquí suelta el tope'],
      ['green', 'meta de 90° y llegada a 3° de la meta'],
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
      // where the full lock is released
      if (run.tLock !== null && i * run.dt >= run.tLock - 1e-9) {
        const k = Math.round(run.tLock / run.dt);
        const [mx, my] = P(run.x[k], run.y[k]);
        out += `<g class="lw-c-blue"><circle cx="${mx}" cy="${my}" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/></g>`;
      }
      // where the heading gets within 0.05 rad of the goal for good
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
        hlines: [
          { y: 90, label: 'meta 90°', color: 'green' },
          { y: 90 - tolerance * DEG, label: `suelta a ${fmt(90 - tolerance * DEG, 0)}°`, color: 'blue' },
        ],
        series: [
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
      { class: 'lw-tablewrap', tabindex: '0', role: 'region', 'aria-label': 'Sobrepaso y tiempo con cada ángulo de soltar para el servo elegido' },
      h(
        'table',
        { class: 'lw-table lw-table-small' },
        h('caption', { class: 'lw-corner-caption' }, 'Los cinco ángulos de la lección con el servo elegido: sobrepaso sin y con amortiguamiento, y tiempo hasta quedar a 3° de la meta con la opción marcada. Pulsa uno para probarlo.'),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Suelta el tope a'), h('th', { scope: 'col' }, 'Se pasa sin amortiguar'), h('th', { scope: 'col' }, 'Se pasa amortiguando'), h('th', { scope: 'col' }, 'Tarda'))),
        tableBody,
      ),
    );
    const lookEl = h('p', { class: 'lw-caption lw-corner-look', role: 'status', 'aria-live': 'polite' }, look);

    function numbers(): void {
      if (!run) return;
      const over = run.overshoot * DEG;
      const clean = over < CLEAN;
      const k = run.tLock === null ? -1 : Math.round(run.tLock / run.dt);
      const rows: [string, string, string?][] = [
        ['Sobrepaso máximo (pasarse de la meta)', `${fmt(over, 1)}°${clean ? '' : ' (más de 2°)'}`, clean ? 'green' : 'red'],
        [`Tiempo hasta quedar a 3° de la meta (±${fmt(CLOSE_TOLERANCE, 2)} rad)`, run.tClose === null ? 'no llega en 4 s' : `${fmt(run.tClose, 2)} s`],
        ['Tiempo con el volante al tope', run.tLock === null ? 'no lo suelta en 4 s' : `${fmt(run.tLock, 2)} s (lo suelta con el coche a ${fmt(run.yaw[k] * DEG, 1)}°)`],
        ['Suelta el tope a', `${tolDeg(tolerance)} de la meta (turn_tolerance = ${fmt(tolerance, 2)} rad)`],
        ['Amortiguamiento (damping)', damping ? fmt(DAMPING, 1) : '0'],
        ['Servo (delay / tau)', `${fmt(delay, 2)} s / ${fmt(tau, 2)} s`],
      ];
      rd.set(
        rows,
        `Sobrepaso de ${fmt(over, 1)} grados${clean ? ', esquina limpia' : ', más de 2 grados'}. ${run.tClose === null ? 'No llega a la meta en 4 segundos.' : `Queda a menos de 3 grados de la meta a los ${fmt(run.tClose, 2)} segundos.`}`,
      );
      code.textContent = pythonCall(tolerance, damping, delay, tau);
    }

    function variants(): void {
      tableBody.replaceChildren(
        ...TOLERANCES.map((tol) => {
          const off = runArc({ turnTolerance: tol, damping: 0, servoDelay: delay, servoTau: tau });
          const on = runArc({ turnTolerance: tol, damping: DAMPING, servoDelay: delay, servoTau: tau });
          const chosen = damping ? on : off;
          const hit = Math.abs(tol - tolerance) < 1e-9;
          const b = button(
            `${tolDeg(tol)} (${fmt(tol, 2)} rad)`,
            () => {
              tolerance = tol;
              look = CUSTOM;
              rerun();
            },
            'lw-sort',
          );
          const cell = (r: ArcRun) => h('td', { class: r.overshoot * DEG < CLEAN ? 'lw-c-green' : 'lw-c-red' }, `${fmt(r.overshoot * DEG, 1)}°`);
          return h(
            'tr',
            { class: hit ? 'lw-row-hit' : undefined, 'aria-current': hit ? 'true' : undefined },
            h('th', { scope: 'row' }, b),
            cell(off),
            cell(on),
            h('td', {}, chosen.tClose === null ? 'no llega' : `${fmt(chosen.tClose, 2)} s`),
          );
        }),
      );
    }

    function rerun(): void {
      cancel?.();
      cancel = null;
      run = runArc({ turnTolerance: tolerance, damping: damping ? DAMPING : 0, servoDelay: delay, servoTau: tau });
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
      pressButtons();
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

    const tDamp = toggle('Amortiguamiento (damping = 0,1; sin marcar, 0)', damping, (v) => {
      damping = v;
      look = CUSTOM;
      rerun();
    });

    const servoButtons = SERVOS.map((sv) =>
      button(sv.label, () => {
        setServo(sv.delay, sv.tau);
        look = CUSTOM;
        rerun();
      }),
    );
    const tolButtons = TOLERANCES.map((tol) =>
      button(tolDeg(tol), () => {
        tolerance = tol;
        look = CUSTOM;
        rerun();
      }),
    );
    function pressButtons(): void {
      SERVOS.forEach((sv, i) => {
        const on = Math.abs(delay - sv.delay) < 1e-9 && Math.abs(tau - sv.tau) < 1e-9;
        servoButtons[i].classList.toggle('lw-btn-on', on);
        servoButtons[i].setAttribute('aria-pressed', String(on));
      });
      TOLERANCES.forEach((tol, i) => {
        const on = Math.abs(tolerance - tol) < 1e-9;
        tolButtons[i].classList.toggle('lw-btn-on', on);
        tolButtons[i].setAttribute('aria-pressed', String(on));
      });
      tDamp.input.checked = damping;
    }

    const attemptButtons = ATTEMPTS.map((t) =>
      button(t.label, () => {
        setServo(SERVOS[t.servo].delay, SERVOS[t.servo].tau);
        tolerance = t.tolerance;
        damping = t.damping;
        look = t.look;
        rerun();
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
      setServo(SERVO_DELAY, SERVO_TAU);
      tolerance = TURN_TOLERANCE;
      damping = true;
      look = INTRO;
      view = 'yaw';
      showView();
      rerun();
    });

    const servo = h(
      'fieldset',
      { class: 'lw-group' },
      h('legend', {}, 'Servo'),
      h('div', { class: 'lw-actions' }, ...servoButtons),
      h('div', { class: 'lw-controls' }, delaySlider.root, tauSlider.root),
    );
    const release = h(
      'fieldset',
      { class: 'lw-group lw-radios' },
      h('legend', {}, 'Cuándo suelta el tope y cómo termina'),
      h('div', { class: 'lw-actions' }, h('span', { class: 'lw-meter-title lw-tg-label' }, 'Suelta el tope a (grados antes de la meta)'), ...tolButtons),
      tDamp.root,
    );

    root.append(
      h('div', { class: 'lw-pair' }, h('div', { class: 'lw-figure' }, svg), h('div', { class: 'lw-figure' }, yawPlot.svg, steerPlot.svg)),
      h('div', { class: 'lw-actions' }, ...viewButtons),
      yawLegend,
      steerLegend,
      servo,
      release,
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
        `Mismo banco que run_arc de los tests: ${fmt(SECONDS, 0)} s, paso de 0,02 s, velocidad de esquina de ${fmt(CORNER_SPEED, 1)} m/s pedidos (el coche llega a ${fmt(realSpeed(CORNER_SPEED), 2)}), giro de ${fmt(fullLockRate(), 2)} rad/s con el volante al tope (${fmt(STEER_LIMIT * DEG, 1)}°) y ruido del giroscopio del coche real. Cuando arc_steer dice que la esquina terminó, solo queda la ley de rumbo con amortiguamiento, como en la misión. En la vista de arriba, el anillo azul marca dónde suelta el tope y el verde dónde queda a 3° de la meta.`,
      ),
    );
    showView();
    rerun();
  });
}
