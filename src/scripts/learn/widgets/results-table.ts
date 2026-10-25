// Widget "results-table": the rounds of the reference solution (2 in Gazebo, 12 in the Open lab), sortable.
// The rule of the challenge: points first, total time from Start second. Data: lib/open-results.ts.
import { button, fmt, guarded, h, nextId } from './lib/common';
import { OPEN_LAB_SUMMARY, RESULTS, byRule, rankings, type Dir, type Env, type RoundResult } from './lib/open-results';

type Key = 'rank' | 'test' | 'dir' | 'points' | 'time';
type Order = 'asc' | 'desc';

const COLUMNS: { key: Key; label: string; first: Order; hint: string }[] = [
  { key: 'test', label: 'Prueba', first: 'asc', hint: 'entorno y campo' },
  { key: 'dir', label: 'Sentido', first: 'asc', hint: 'sentido de la vuelta' },
  { key: 'points', label: 'Puntos', first: 'desc', hint: 'puntos estimados (sobre 30)' },
  { key: 'time', label: 'Tiempo', first: 'asc', hint: 'tiempo desde Start hasta la parada' },
];
const ORDER_TEXT: Record<Order, string> = { asc: 'de menor a mayor', desc: 'de mayor a menor' };

function radios<T extends string>(legend: string, options: [T, string][], value: T, onChange: (v: T) => void): HTMLElement {
  const name = nextId('lw-rg');
  return h(
    'fieldset',
    { class: 'lw-group lw-radios' },
    h('legend', {}, legend),
    ...options.map(([v, label]) => {
      const id = nextId('lw-rd');
      const input = h('input', { type: 'radio', name, id, value: v });
      input.checked = v === value;
      input.addEventListener('change', () => input.checked && onChange(v));
      return h('div', { class: 'lw-check' }, input, h('label', { for: id }, label));
    }),
  );
}

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let sortKey: Key = 'rank', order: Order = 'asc';
    let dirFilter: 'all' | Dir = 'all', envFilter: 'all' | Env = 'all';
    const ranks = rankings(RESULTS);
    const maxTime = Math.max(...RESULTS.map((r) => r.time));

    const live = h('p', { class: 'lw-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const status = h('p', { class: 'lw-note' });
    const tbody = h('tbody');
    const headers = new Map<Key, { th: HTMLTableCellElement; btn: HTMLButtonElement; arrow: HTMLElement }>();

    const head = h('tr');
    for (const c of COLUMNS) {
      const arrow = h('span', { class: 'lw-sort-arrow', 'aria-hidden': 'true' });
      const btn = h('button', { type: 'button', class: 'lw-sort', title: `Ordenar por ${c.hint}` }, c.label, arrow);
      btn.addEventListener('click', () => {
        if (sortKey === c.key) order = order === 'asc' ? 'desc' : 'asc';
        else {
          sortKey = c.key;
          order = c.first;
        }
        render(true);
      });
      const th = h('th', { scope: 'col', class: c.key === 'time' ? 'lw-th-time' : undefined }, btn);
      headers.set(c.key, { th, btn, arrow });
      head.append(th);
    }

    const cmp = (a: RoundResult, b: RoundResult): number => {
      switch (sortKey) {
        case 'rank':
          return a.env === b.env ? byRule(a, b) : a.env === 'Gazebo' ? -1 : 1; // Gazebo is the authority: first, then the Open lab
        case 'test':
          return a.env.localeCompare(b.env) || a.field.localeCompare(b.field);
        case 'dir':
          return a.dir.localeCompare(b.dir);
        case 'points':
          return a.points - b.points;
        case 'time':
          return a.time - b.time;
      }
    };

    function render(announce = false): void {
      const rows = RESULTS.map((r, i) => ({ r, i }))
        .filter(({ r }) => (dirFilter === 'all' || r.dir === dirFilter) && (envFilter === 'all' || r.env === envFilter))
        .sort((a, b) => cmp(a.r, b.r) * (order === 'asc' ? 1 : -1) || a.i - b.i)
        .map(({ r }) => r);

      for (const c of COLUMNS) {
        const hd = headers.get(c.key) as { th: HTMLTableCellElement; btn: HTMLButtonElement; arrow: HTMLElement };
        const on = c.key === sortKey;
        hd.th.setAttribute('aria-sort', on ? (order === 'asc' ? 'ascending' : 'descending') : 'none');
        hd.arrow.textContent = on ? (order === 'asc' ? ' ▲' : ' ▼') : '';
      }
      rule.setAttribute('aria-pressed', String(sortKey === 'rank'));
      rule.classList.toggle('lw-btn-on', sortKey === 'rank');

      tbody.replaceChildren(
        ...rows.map((r) => {
          const test = r.env === 'Gazebo' ? 'Gazebo' : `Open lab · ${r.field}`;
          const detail = r.laps && r.margin !== undefined ? `vueltas ${r.laps.map((v) => fmt(v, 1)).join(' / ')} s · margen ${fmt(r.margin, 1)} cm` : '';
          const cls = r.env === 'Gazebo' ? 'blue' : 'amber';
          return h(
            'tr',
            {},
            h('td', {}, h('span', { class: 'lw-rank', title: 'Puesto según la regla dentro de su prueba' }, `#${ranks.get(r)}`), ` ${test}`, detail ? h('span', { class: 'lw-sub' }, detail) : null),
            h('td', {}, r.dir),
            h('td', { class: 'lw-num' }, `${r.points}/${r.max}`),
            h(
              'td',
              { class: 'lw-time' },
              h('span', { class: 'lw-num' }, `${fmt(r.time, 2)} s`),
              h('span', { class: `lw-bar lw-c-${cls}`, 'aria-hidden': 'true', style: `width:${((r.time / maxTime) * 100).toFixed(1)}%` }),
            ),
          );
        }),
      );

      const col = sortKey === 'rank' ? { label: 'la regla (puntos y luego tiempo)' } : COLUMNS.find((c) => c.key === sortKey)!;
      const best = [...rows].sort(byRule)[0];
      status.textContent = rows.length
        ? `Mejor de la selección: ${best.env === 'Gazebo' ? 'Gazebo' : `Open lab, ${best.field}`}, ${best.dir}, ${best.points} puntos en ${fmt(best.time, 2)} s.`
        : 'Ninguna ronda cumple el filtro.';
      if (announce || rows.length === 0) {
        live.textContent = `Ordenado por ${col.label.toLowerCase()}${sortKey === 'rank' ? '' : ', ' + ORDER_TEXT[order]}. ${rows.length} ${rows.length === 1 ? 'ronda' : 'rondas'}. ${status.textContent}`;
      }
    }

    const rule = button('Ordenar por la regla: puntos y luego tiempo', () => {
      sortKey = 'rank';
      order = 'asc';
      render(true);
    });
    const filters = h(
      'div',
      { class: 'lw-controls' },
      radios<'all' | Env>('Prueba', [['all', 'Todas'], ['Gazebo', 'Gazebo'], ['Open lab', 'Open lab']], envFilter, (v) => {
        envFilter = v;
        render(true);
      }),
      radios<'all' | Dir>('Sentido', [['all', 'Los dos'], ['ccw', 'ccw'], ['cw', 'cw']], dirFilter, (v) => {
        dirFilter = v;
        render(true);
      }),
    );

    const table = h(
      'table',
      { class: 'lw-table' },
      h('caption', { class: 'lw-sr' }, 'Rondas de la solución de referencia: puntos y tiempo desde Start'),
      h('thead', {}, head),
      tbody,
    );

    root.append(
      filters,
      h('div', { class: 'lw-actions' }, rule),
      h('div', { class: 'lw-tablewrap', role: 'region', 'aria-label': 'Tabla de resultados, con desplazamiento horizontal si no cabe', tabindex: '0' }, table),
      status,
      live,
      h(
        'p',
        { class: 'lw-note' },
        `Regla: gana quien tiene más puntos y, a igual puntuación, menos tiempo desde Start. El puesto cuenta dentro de cada prueba: el Open lab es un filtro rápido con el modelo del coche en Python y la autoridad es Gazebo, así que no compares tiempos entre las dos. Open lab: ${OPEN_LAB_SUMMARY.valid} de ${OPEN_LAB_SUMMARY.total} rondas válidas, tiempo medio ${fmt(OPEN_LAB_SUMMARY.meanTime, 2)} s. Estimaciones de simulación, no puntuación oficial.`,
      ),
    );
    render();
  });
}
