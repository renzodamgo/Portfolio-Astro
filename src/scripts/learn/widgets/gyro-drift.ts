// Widget "gyro-drift": a gyroscope bias makes the heading drift; the start calibration removes most of it.
// Same closed loop as drive_straight() in course/tests/helpers.py (GyroHeading + heading_steer from my_open/heading.py,
// KP 0.8, real servo and motor). Variables and units are the ones of the page: bias and noise in rad/s, yaw in rad.
import { button, createPlot, fmt, guarded, h, legend, mulberry32, readout, slider, svgEl, toggle } from './lib/common';
import { GyroHeading, MiniCar, headingSteer } from './lib/sim';

const SECONDS = 10, DT = 0.02, SPEED_CMD = 0.6, LOOK_AHEAD = 6.0;
const DEG = 180 / Math.PI;
const REAL_BIAS = 0.006, REAL_NOISE = 0.0019; // rad/s, GYRO_BIAS and GYRO_NOISE of the real car

interface Run {
  t: number[];
  trueDeg: number[];
  estDeg: number[];
  path: [number, number][];
  yaw: number; // true heading at the end (rad)
  est: number; // heading the car believes at the end (rad)
  calBias: number;
}

function simulate(bias: number, noise: number, calibrated: boolean, seed: number): Run {
  const car = new MiniCar(0, 0, 0, { bias, noise, rng: mulberry32(seed) });
  const heading = new GyroHeading();
  if (calibrated) heading.calibrate(car.restingGyro(30)); // 0.6 s standing still
  const run: Run = { t: [], trueDeg: [], estDeg: [], path: [], yaw: 0, est: 0, calBias: heading.bias };
  const n = Math.round(SECONDS / DT);
  for (let k = 0; k < n; k++) {
    const est = heading.update(car.gyro(), DT);
    car.step(SPEED_CMD, headingSteer(0, est), DT);
    if (k % 5 === 0 || k === n - 1) {
      run.t.push((k + 1) * DT);
      run.trueDeg.push(car.yaw * DEG);
      run.estDeg.push(est * DEG);
      run.path.push([car.x, car.y]);
    }
  }
  run.yaw = car.yaw;
  run.est = heading.yaw;
  return run;
}

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let bias = REAL_BIAS, noise = REAL_NOISE, calibrated = false, seed = 1;

    const plot = createPlot({
      xmin: 0,
      xmax: SECONDS,
      xlabel: 'tiempo (s)',
      ylabel: 'rumbo (grados)',
      aria: 'Gráfico del rumbo estimado y del rumbo real del coche durante 10 segundos',
      digitsY: 0,
    });

    // top view of the path: 6 m long, drawn at the same scale on both axes
    const PW = 360, PH = 130, PS = 52, PX = 16; // px per metre
    const path = svgEl('svg', { viewBox: `0 0 ${PW} ${PH}`, class: 'lw-svg', role: 'img' });
    const pathG = svgEl('g');
    path.append(pathG);

    const rd = readout();
    const note = h('p', { class: 'lw-note' });

    function update(): void {
      const run = simulate(bias, noise, calibrated, seed);
      const peak = Math.max(...run.trueDeg.map(Math.abs), ...run.estDeg.map(Math.abs), 1);
      const ymax = Math.max(2, Math.ceil(peak * 1.25));
      plot.update({
        ymin: -ymax,
        ymax,
        hlines: [{ y: 0, label: 'recto', color: 'muted' }],
        series: [
          { color: 'blue', points: run.t.map((t, i) => [t, run.estDeg[i]]) },
          { color: 'amber', points: run.t.map((t, i) => [t, run.trueDeg[i]]) },
        ],
      });

      const sideways = Math.abs(Math.sin(run.yaw)) * LOOK_AHEAD;
      const P = (x: number, y: number) => [PX + x * PS, PH / 2 - y * PS] as const;
      const last = run.path[run.path.length - 1];
      const [ex, ey] = [LOOK_AHEAD * Math.cos(run.yaw), LOOK_AHEAD * Math.sin(run.yaw)];
      const pts = [[0, 0] as [number, number], ...run.path].map(([x, y]) => P(x, y).map((v) => v.toFixed(1)).join(',')).join(' ');
      const [x0, y0] = P(0, 0), [xe, ye] = P(ex, ey), [xl, yl] = P(last[0], last[1]), [xr] = P(LOOK_AHEAD, 0);
      pathG.innerHTML =
        `<line class="lw-grid" x1="${x0}" y1="${y0}" x2="${xr}" y2="${y0}"/>` +
        `<g class="lw-c-muted"><line x1="${xr}" y1="${y0 - 40}" x2="${xr}" y2="${y0 + 40}" stroke="currentColor" stroke-dasharray="3 3"/>` +
        `<text class="lw-tick" x="${xr - 4}" y="${PH - 6}" text-anchor="end" fill="currentColor">a 6 m</text></g>` +
        `<g class="lw-c-amber"><line x1="${xl}" y1="${yl}" x2="${xe.toFixed(1)}" y2="${ye.toFixed(1)}" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4"/>` +
        `<polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>` +
        `<circle cx="${xe.toFixed(1)}" cy="${ye.toFixed(1)}" r="4" fill="currentColor"/></g>` +
        `<g class="lw-c-cream"><text class="lw-tag" x="${PX}" y="14" fill="currentColor">salida</text></g>` +
        `<rect class="lw-body" x="${x0 - 3}" y="${y0 - 5}" width="9" height="10" rx="2"/>`;
      path.setAttribute(
        'aria-label',
        `Vista desde arriba: tras 6 metros el coche queda a ${fmt(sideways, 2)} metros de la recta que quería seguir`,
      );

      const learned = calibrated ? `${fmt(run.calBias, 4)} rad/s (real ${fmt(bias, 4)})` : '0 (sin calibrar)';
      const real = `${fmt(run.yaw, 3)} rad (${fmt(run.yaw * DEG, 1)}°)`;
      rd.set(
        [
          ['Sesgo que cree el coche, heading.bias', learned],
          ['Rumbo real a los 10 s', real],
          ['Rumbo que cree el coche a los 10 s', `${fmt(run.est, 3)} rad (${fmt(run.est * DEG, 1)}°)`],
          ['Error lateral en 6 m', `${fmt(sideways, 2)} m`],
        ],
        `${calibrated ? 'Con calibración' : 'Sin calibrar'}: a los 10 segundos el rumbo real es de ${fmt(run.yaw * DEG, 1)} grados y en 6 metros el coche se desvía ${fmt(sideways, 2)} metros.`,
      );
      if (bias === 0) {
        note.textContent = 'Sin sesgo no hay deriva que corregir: calibrar o no da casi igual. Lo que queda es el ruido.';
      } else if (!calibrated) {
        note.textContent = `Sin calibrar, el coche cree ir recto (la línea azul acaba en ${fmt(run.est * DEG, 1)}°) mientras el real acaba en ${fmt(run.yaw * DEG, 1)}°: nada dentro del coche avisa del error.`;
      } else {
        const miss = run.calBias - bias;
        note.textContent = `Con 30 lecturas el promedio se equivoca en ${fmt(miss, 4)} rad/s; ese pequeño resto es lo único que se acumula. Pulsa «Otro ruido» para ver cuánto cambia.`;
      }
    }

    const biasS = slider({
      label: 'Sesgo real del giroscopio (bias)',
      min: 0,
      max: 0.02,
      step: 0.0005,
      value: bias,
      format: (v) => `${fmt(v, 4)} rad/s`,
      onInput: (v) => {
        bias = v;
        update();
      },
    });
    const noiseS = slider({
      label: 'Ruido del giroscopio (cambia en cada lectura)',
      min: 0,
      max: 0.01,
      step: 0.0001,
      value: noise,
      format: (v) => `${fmt(v, 4)} rad/s`,
      onInput: (v) => {
        noise = v;
        update();
      },
    });
    const cal = toggle('Calibrar con el coche quieto (0,6 s, 30 lecturas)', calibrated, (v) => {
      calibrated = v;
      update();
    });
    const reseed = button('Otro ruido', () => {
      seed += 1;
      update();
    });
    const noBias = button('Sin sesgo', () => {
      bias = 0;
      biasS.set(0);
      update();
    });
    const again = button('Reiniciar (coche real)', () => {
      bias = REAL_BIAS;
      noise = REAL_NOISE;
      seed = 1;
      calibrated = false;
      biasS.set(bias);
      noiseS.set(noise);
      cal.input.checked = false;
      update();
    });

    root.append(
      h('div', { class: 'lw-figure' }, plot.svg),
      legend([
        ['blue', 'rumbo que cree el coche (integra el giroscopio)'],
        ['amber', 'rumbo real del coche'],
      ]),
      h('div', { class: 'lw-figure' }, path),
      h('div', { class: 'lw-controls' }, biasS.root, noiseS.root),
      h('div', { class: 'lw-actions' }, cal.root, reseed, noBias, again),
      rd.root,
      note,
    );
    update();
  });
}
