// Widget "imu-axes": which board axis points forward, left and up (imu_adapter, step 11). Pick how the RRC Lite is mounted
// (the reality) and what robot.yaml says (the configuration) and see what the strategy reads when you turn the car by hand.
// Port of axes_matrix / remap_vector of robotek_hardware/mapping.py. No 3D: a top view of the car, with the axes that point
// up or down drawn as a circle with a dot or a cross.
import { button, guarded, h, legend, nextId, svgEl } from './lib/common';

type Vec = [number, number, number];
type Mat = [Vec, Vec, Vec]; // rows: forward, left, up, each written in board axes (as in mapping.axes_matrix)

const AXIS_OPTIONS = ['+x', '-x', '+y', '-y', '+z', '-z'];
const NAMES = ['x', 'y', 'z'];

interface Mounting { label: string; axes: [string, string, string] }
const MOUNTINGS: Mounting[] = [
  { label: 'Plana, como el 8 de octubre', axes: ['+y', '-x', '+z'] },
  { label: 'Plana, girada 180 grados sobre la vertical', axes: ['-y', '+x', '+z'] },
  { label: 'Plana, boca abajo', axes: ['+y', '+x', '-z'] },
  { label: 'De canto, con la cara de la placa hacia la izquierda', axes: ['+y', '+z', '+x'] },
  { label: 'De canto, del otro lado (la cara hacia la derecha)', axes: ['+y', '-z', '-x'] },
];
const DEFAULT_REALITY = 4;
const DEFAULT_CONFIG: [string, string, string] = ['+y', '-x', '+z']; // what robot.yaml says in the repository

const parse = (spec: string): Vec => {
  const v: Vec = [0, 0, 0];
  v['xyz'.indexOf(spec[1])] = spec[0] === '-' ? -1 : 1;
  return v;
};
const det = (m: Mat): number =>
  m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
  m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
  m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
const matrix = (a: readonly string[]): Mat => [parse(a[0]), parse(a[1]), parse(a[2])];
/** board -> car, as remap_vector */
const toCar = (m: Mat, v: Vec): Vec => [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]) as Vec;
/** car -> board (the transpose: the matrix is orthonormal) */
const toBoard = (m: Mat, v: Vec): Vec => [0, 1, 2].map((j) => m[0][j] * v[0] + m[1][j] * v[1] + m[2][j] * v[2]) as Vec;
const valid = (m: Mat): boolean => Math.abs(det(m) - 1) < 1e-9;

const sign = (v: number): string => (v > 0.5 ? '+1' : v < -0.5 ? '-1' : '0');
const triple = (v: Vec): string => `(${v.map(sign).join(', ')})`;

/** Where the board axis i points, seen from the car: the column i of the matrix. */
function direction(c: Vec): string {
  const [f, l, u] = c;
  if (Math.abs(u) > 0.5) return u > 0 ? 'arriba' : 'abajo';
  if (Math.abs(f) > 0.5) return f > 0 ? 'adelante' : 'atrás';
  return l > 0 ? 'a la izquierda' : 'a la derecha';
}

const TESTS: { label: string; omega: Vec; key: number; hint: string }[] = [
  { label: 'Giras el coche a la izquierda', omega: [0, 0, 1], key: 2, hint: 'z positivo' },
  { label: 'Bajas el morro', omega: [0, 1, 0], key: 1, hint: 'y positivo' },
  { label: 'Inclinas el coche a la derecha', omega: [1, 0, 0], key: 0, hint: 'x positivo' },
];

const COLORS = ['blue', 'green', 'violet'];
const CX = 90, CY = 100, LEN = 52;

function panel(ox: number, title: string, m: Mat | null): string {
  let out = `<text class="lw-tag lw-c-cream" x="${ox + 90}" y="14" text-anchor="middle" fill="currentColor">${title}</text>`;
  if (!m) return out + `<text class="lw-tick" x="${ox + 90}" y="${CY}" text-anchor="middle" fill="currentColor">configuración no válida</text>`;
  const x = ox + CX;
  out +=
    `<g class="lw-c-muted"><rect x="${x - 20}" y="${CY - 38}" width="40" height="76" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>` +
    `<polygon points="${x - 8},${CY - 38} ${x + 8},${CY - 38} ${x},${CY - 50}" fill="currentColor"/>` +
    `<text class="lw-tick" x="${x + 24}" y="${CY - 42}" fill="currentColor">adelante</text>` +
    `<text class="lw-tick" x="${x - 26}" y="${CY + 4}" text-anchor="end" fill="currentColor">izq.</text></g>`;
  for (let i = 0; i < 3; i++) {
    const c: Vec = [m[0][i], m[1][i], m[2][i]]; // board axis i in car coordinates (forward, left, up)
    const cls = `lw-c-${COLORS[i]}`;
    if (Math.abs(c[2]) > 0.5) {
      // pointing up or down: circle with a dot (towards you) or a cross (away)
      out += `<g class="${cls}"><circle cx="${x}" cy="${CY}" r="10" fill="none" stroke="currentColor" stroke-width="2"/>`;
      out += c[2] > 0
        ? `<circle cx="${x}" cy="${CY}" r="3" fill="currentColor"/>`
        : `<path d="M ${x - 5} ${CY - 5} L ${x + 5} ${CY + 5} M ${x + 5} ${CY - 5} L ${x - 5} ${CY + 5}" stroke="currentColor" stroke-width="2"/>`;
      out += `<text class="lw-tag" x="${x + 15}" y="${CY - 8}" fill="currentColor">${NAMES[i]}${c[2] > 0 ? ' arriba' : ' abajo'}</text></g>`;
    } else {
      const ex = x - c[1] * LEN, ey = CY - c[0] * LEN; // car forward is up the page, car left is left on the page
      const dx = -c[1], dy = -c[0];
      const px = -dy, py = dx; // perpendicular, for the arrow head
      out +=
        `<g class="${cls}"><line x1="${x}" y1="${CY}" x2="${ex}" y2="${ey}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>` +
        `<polygon points="${ex},${ey} ${ex - dx * 9 + px * 5},${ey - dy * 9 + py * 5} ${ex - dx * 9 - px * 5},${ey - dy * 9 - py * 5}" fill="currentColor"/>` +
        `<text class="lw-tag" x="${ex + dx * 10 + (dx === 0 ? 8 : 0)}" y="${ey + dy * 10 + 4}" text-anchor="middle" fill="currentColor">${NAMES[i]}</text></g>`;
    }
  }
  return out;
}

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let reality = MOUNTINGS[DEFAULT_REALITY].axes;
    const config: [string, string, string] = [...DEFAULT_CONFIG];

    const select = (id: string, options: string[], labels: string[] | null, value: string, onChange: (v: string) => void) => {
      const s = h('select', { id });
      options.forEach((o, i) => s.append(h('option', { value: o }, labels ? labels[i] : o)));
      s.value = value;
      s.addEventListener('change', () => onChange(s.value));
      return s;
    };
    const field = (label: string, id: string, control: HTMLElement) => h('div', { class: 'lw-field' }, h('label', { for: id }, label), control);

    const idReality = nextId('lw-sel');
    const selReality = select(idReality, MOUNTINGS.map((_, i) => String(i)), MOUNTINGS.map((x) => x.label), String(DEFAULT_REALITY), (v) => {
      reality = MOUNTINGS[Number(v)].axes;
      render();
    });
    const cfgSelects = ['forward_axis', 'left_axis', 'up_axis'].map((name, i) => {
      const id = nextId('lw-sel');
      const s = select(id, AXIS_OPTIONS, null, config[i], (v) => {
        config[i] = v;
        render();
      });
      return { name, id, s };
    });

    const controls = h('div', { class: 'lw-controls' }, field('Cómo está montada la placa (la realidad)', idReality, selReality),
      ...cfgSelects.map(({ name, id, s }) => field(name, id, s)));

    const svg = svgEl('svg', { viewBox: '0 0 380 170', class: 'lw-svg lw-imu-svg', role: 'img' });
    const g = svgEl('g');
    svg.append(g);

    const yaml = h('pre', { class: 'lw-imu-yaml' });
    const message = h('p', { class: 'lw-imu-verdict' });
    const live = h('p', { class: 'lw-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const tbody = h('tbody');
    const table = h('table', { class: 'lw-table lw-table-small' },
      h('caption', { class: 'lw-sr' }, 'Lo que lee la placa y lo que lee tu estrategia en tres giros a mano'),
      h('thead', {}, h('tr', {}, ...['Giro a mano', 'Lee la placa (x, y, z)', 'Lee tu estrategia (x, y, z)', 'Resultado'].map((t) => h('th', { scope: 'col' }, t)))),
      tbody);

    const fix = button('Poner la configuración correcta', () => {
      reality.forEach((v, i) => {
        config[i] = v;
        cfgSelects[i].s.value = v;
      });
      render();
    });

    function render(): void {
      const mReal = matrix(reality);
      const mCfg = matrix(config);
      const ok = valid(mCfg);
      g.innerHTML = panel(0, 'Realidad (vista desde arriba)', mReal) + panel(190, 'Lo que dice robot.yaml', ok ? mCfg : null);
      const dirs = [0, 1, 2].map((i) => `${NAMES[i]} ${direction([mReal[0][i], mReal[1][i], mReal[2][i]])}`).join(', ');
      svg.setAttribute('aria-label', `Ejes de la placa en el coche: ${dirs}.`);
      yaml.textContent = `imu_adapter:\n  ros__parameters:\n    forward_axis: '${config[0]}'\n    left_axis: '${config[1]}'\n    up_axis: '${config[2]}'`;
      const rows: HTMLElement[] = [];
      let yawVerdict = '';
      if (!ok) {
        message.className = 'lw-imu-verdict lw-c-red';
        message.textContent = 'imu_adapter no arrancaría: "is not a right-handed frame". Los tres ejes tienen que ser distintos y adelante por izquierda tiene que dar arriba. Cambia el signo de un eje, o el eje.';
        tbody.replaceChildren();
        table.hidden = true;
        live.textContent = message.textContent;
        return;
      }
      table.hidden = false;
      let allOk = true;
      for (const t of TESTS) {
        const board = toBoard(mReal, t.omega);
        const car = toCar(mCfg, board);
        const v = car[t.key];
        let verdict: string, cls: string;
        if (Math.abs(v - 1) < 1e-9 && car.every((c, i) => i === t.key || Math.abs(c) < 1e-9)) {
          verdict = 'Correcto';
          cls = 'lw-c-green';
        } else if (Math.abs(v + 1) < 1e-9) {
          verdict = `Signo invertido: ${NAMES[t.key]} sale negativo`;
          cls = 'lw-c-red';
        } else if (Math.abs(v) < 1e-9) {
          const other = car.findIndex((c) => Math.abs(c) > 0.5);
          verdict = other >= 0 ? `Responde otro eje (${NAMES[other]}), ${NAMES[t.key]} no se mueve` : `${NAMES[t.key]} no se mueve`;
          cls = 'lw-c-red';
        } else {
          verdict = 'Otro eje';
          cls = 'lw-c-red';
        }
        if (cls === 'lw-c-red') allOk = false;
        if (t.key === 2) yawVerdict = verdict;
        rows.push(h('tr', {}, h('td', {}, `${t.label} (espera ${t.hint})`), h('td', {}, triple(board)), h('td', {}, triple(car)), h('td', { class: cls }, verdict)));
      }
      tbody.replaceChildren(...rows);
      message.className = `lw-imu-verdict ${allOk ? 'lw-c-green' : 'lw-c-red'}`;
      message.textContent = allOk
        ? 'La configuración coincide con la realidad: tu estrategia lee los giros con el signo y el eje correctos.'
        : yawVerdict.startsWith('Signo')
          ? 'Al girar a la izquierda tu estrategia lee z negativo: cree que el coche gira a la derecha y el control de rumbo realimenta al revés.'
          : yawVerdict.startsWith('Responde') || yawVerdict.endsWith('no se mueve')
            ? 'Al girar el coche, z de tu estrategia no se mueve: el rumbo no cambia y la esquina nunca se da por terminada.'
            : 'Algún giro sale mal: revisa la tabla.';
      live.textContent = message.textContent;
    }

    root.append(
      controls,
      svg,
      legend([['blue', 'eje x de la placa'], ['green', 'eje y de la placa'], ['violet', 'eje z de la placa']]),
      yaml,
      h('div', { class: 'lw-actions' }, fix),
      h('div', { class: 'lw-tablewrap' }, table),
      message,
      live,
      h('p', { class: 'lw-note' }, 'El ejemplo de la realidad usa la placa con el eje y hacia adelante. En tu coche los ejes pueden ser otros: mídelos con imu_axes.'),
    );
    render();
  });
}
