// Widget "obstacle-localize": where the car is, from the walls (localizer.py). The scan is drawn where the car BELIEVES
// it is: with a wrong guess the points miss the walls. "Corregir" runs Localizer.correct (two Gauss-Newton iterations
// with a Huber weight) and pulls the guess onto the walls; "Empezar sin saber dónde" runs initialize. The direction of
// the round comes from one scan: the share of points on a wall with the island on the left or on the right.
import { button, fmt, guarded, h, legend, mulberry32, readout, slider, svgEl, toggle } from './lib/common';
import { INNER, Localizer, OUTER, directionFromScan, fieldBoxes, fitWalls, lanePose, scanAt, scanPoints, wrap } from './lib/obstacle';

const VW = 400, K = 120;
const deg = (r: number) => (r * 180) / Math.PI;

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    // the true pose: on the lane at a progress, shifted sideways and turned
    let progress = 0.25, lateral = 0, turn = 0, noise = true;
    const loc = new Localizer();
    let truth: [number, number, number] = [0, 0, 0];
    let ranges: number[] = [];
    let history: [number, number][] = [];
    const P = (x: number, y: number): [number, number] => [VW / 2 + x * K, VW / 2 - y * K];
    const svg = svgEl('svg', { viewBox: `0 0 ${VW} ${VW}`, class: 'lw-svg lw-square', role: 'img' });
    const scene = svgEl('g');
    svg.append(scene);
    const rd = readout();
    const status = h('p', { class: 'lw-caption', role: 'status' }, '');

    function place(): void {
      const [x, y, heading] = lanePose(progress);
      const nx = -Math.sin(heading), ny = Math.cos(heading);
      truth = [x + lateral * nx, y + lateral * ny, wrap(heading + (turn * Math.PI) / 180)];
      ranges = scanAt(truth[0], truth[1], truth[2], fieldBoxes(), noise ? 0.008 : 0, mulberry32(7));
    }
    function guess(dx: number, dy: number, dth: number): void {
      loc.x = truth[0] + dx; loc.y = truth[1] + dy; loc.th = wrap(truth[2] + dth);
      history = [[loc.x, loc.y]];
    }
    const car = (x: number, y: number, th: number, cls: string, opacity = 1) =>
      `<g transform="translate(${P(x, y).map((v) => v.toFixed(1)).join(' ')}) rotate(${(-deg(th)).toFixed(1)}) scale(${K})" opacity="${opacity}">` +
      `<rect x="-0.0852" y="-0.074" width="0.2329" height="0.148" rx="0.012" class="${cls}"/><path d="M 0.118 -0.03 L 0.148 0 L 0.118 0.03 Z" class="lw-nose"/></g>`;

    function draw(): void {
      let out = '';
      const [ox, oy] = P(-OUTER, OUTER), [ix, iy] = P(-INNER, INNER);
      out += `<rect class="lw-wall" x="${ox - 6}" y="${oy - 6}" width="${3 * K + 12}" height="${3 * K + 12}"/>`;
      out += `<rect x="${ox}" y="${oy}" width="${3 * K}" height="${3 * K}" fill="var(--lw-bg)"/>`;
      out += `<rect class="lw-wall" x="${ix}" y="${iy}" width="${K}" height="${K}"/>`;
      // the scan, drawn from the BELIEVED pose: on the walls when the guess is right
      const [bx, by] = scanPoints(ranges, 1);
      const c = Math.cos(loc.th), s = Math.sin(loc.th);
      const fit = fitWalls(bx, by, loc.x, loc.y, loc.th, 0.05);
      const on = new Set(fit.px.map((px, i) => `${px.toFixed(5)},${fit.py[i].toFixed(5)}`));
      for (let i = 0; i < bx.length; i++) {
        const px = loc.x + c * bx[i] - s * by[i], py = loc.y + s * bx[i] + c * by[i];
        const hit = on.has(`${px.toFixed(5)},${py.toFixed(5)}`);
        const [qx, qy] = P(px, py);
        out += `<circle cx="${qx.toFixed(1)}" cy="${qy.toFixed(1)}" r="1.8" fill="${hit ? 'var(--lw-green)' : 'var(--lw-red)'}"/>`;
      }
      if (history.length > 1) out += `<polyline points="${history.map(([x, y]) => P(x, y).join(',')).join(' ')}" fill="none" stroke="var(--lw-blue)" stroke-width="1.5" stroke-dasharray="3 3"/>`;
      out += car(truth[0], truth[1], truth[2], 'lw-body', 0.55);
      out += car(loc.x, loc.y, loc.th, 'lw-body-blue');
      scene.innerHTML = out;
      const err = Math.hypot(loc.x - truth[0], loc.y - truth[1]);
      const dir = directionFromScan(ranges);
      rd.set([
        ['error de la pose que cree', `${fmt(err * 100, 1)} cm y ${fmt(deg(wrap(loc.th - truth[2])), 1)}°`, err < 0.02 ? 'green' : 'red'],
        ['puntos sobre un muro (a 5 cm)', `${fit.r.length} de ${bx.length}`],
        ['sentido con este escaneo', dir.sign === 0 ? 'pocos puntos' : `${dir.sign > 0 ? 'antihorario' : 'horario'}: ${fmt((dir.fractions['1'] ?? 0) * 100, 0)} % de puntos en un muro con la isla a la izquierda, ${fmt((dir.fractions['-1'] ?? 0) * 100, 0)} % a la derecha`],
      ], `El coche cree estar a ${fmt(err * 100, 1)} centímetros de su pose real.`);
    }

    function correct(times: number): void {
      const [bx, by] = scanPoints(ranges, 1);
      let ok = true;
      for (let k = 0; k < times && ok; k++) { ok = loc.correct(bx, by); history.push([loc.x, loc.y]); }
      status.textContent = ok ? `Corregido: ${loc.inliers} puntos sobre los muros, error medio ${fmt(loc.rms * 1000, 1)} mm.` : 'Menos de 20 puntos a 8 cm de un muro: la corrección no se fía (el error es demasiado grande).';
      draw();
    }
    const mk = (label: string, min: number, max: number, step: number, value: number, f: (v: number) => string, set: (v: number) => void) =>
      slider({ label, min, max, step, value, format: f, onInput: (v) => { set(v); place(); guess(0.08, 0.05, 0.1); status.textContent = 'Nueva pose: el coche cree estar 9 cm y 6° desviado. Pulsa Corregir.'; draw(); } });
    const sP = mk('Pose real: progreso', 0, 8, 0.05, progress, (v) => fmt(v, 2), (v) => (progress = v));
    const sL = mk('Pose real: a un lado del carril (m)', -0.3, 0.3, 0.01, lateral, (v) => `${fmt(v, 2)} m`, (v) => (lateral = v));
    const sT = mk('Pose real: torcido (°)', -30, 30, 1, turn, (v) => `${fmt(v, 0)}°`, (v) => (turn = v));
    const noiseToggle = toggle('Ruido del LiDAR (8 mm)', noise, (v) => { noise = v; place(); draw(); });
    const wrong = (label: string, dx: number, dy: number, dth: number) => button(label, () => { guess(dx, dy, (dth * Math.PI) / 180); status.textContent = `El coche cree estar ${fmt(Math.hypot(dx, dy) * 100, 0)} cm y ${fmt(dth, 0)}° desviado: los puntos rojos no caen en ningún muro.`; draw(); });
    root.append(
      h('div', { class: 'lw-figure' }, svg),
      legend([['blue', 'donde cree estar el coche (y el camino de la corrección)'], ['amber', 'donde está de verdad'], ['green', 'puntos que caen en un muro'], ['red', 'puntos que no']]),
      status,
      rd.root,
      h('div', { class: 'lw-actions' },
        button('Corregir (una vez)', () => correct(1), 'lw-btn-primary'),
        button('Corregir 5 veces', () => correct(5)),
        button('Empezar sin saber dónde', () => {
          const [bx, by] = scanPoints(ranges, 1);
          loc.initialize(bx, by, truth[2]);
          history = [[loc.x, loc.y]];
          status.textContent = 'initialize: prueba tres posiciones en la recta de salida y se queda con la que mejor encaja.';
          draw();
        }),
      ),
      h('div', { class: 'lw-actions' }, wrong('Error de 9 cm y 6°', 0.08, 0.05, 6), wrong('Error de 20 cm', 0.15, -0.12, 0), wrong('Torcido 20°', 0, 0, 20)),
      h('div', { class: 'lw-controls' }, sP.root, sL.root, sT.root, noiseToggle.root),
      h('p', { class: 'lw-note' }, 'Localizer.correct del curso: cada punto del escaneo se compara con el muro conocido más cercano (los cuatro de fuera y la isla), dos iteraciones de Gauss-Newton con un peso de Huber de 2 cm y amortiguadas. En la ronda se corrige una vez por escaneo (10 por segundo), así que el error nunca llega a crecer.'),
    );
    svg.setAttribute('aria-label', 'El campo con dos coches: el real y el que cree el coche; el escaneo dibujado desde la pose que cree, verde donde cae en un muro y rojo donde no');
    place();
    guess(0.08, 0.05, 0.1);
    status.textContent = 'El coche cree estar 9 cm y 6° desviado: los puntos rojos no caen en ningún muro. Pulsa Corregir.';
    draw();
  });
}
