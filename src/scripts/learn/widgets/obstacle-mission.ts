// Widget "obstacle-mission": the mission (mission.py). Top: the states of a real round of the course's strategy (the
// labels of the step 7 replay: SETUP, RUN, LOOK, BACKUP, STOP), as a timeline with the time spent in each. Bottom: the
// speed rules of Mission._speed: start at cruise_speed and only go down, with the rule that set it highlighted.
import { fmt, guarded, h, legend, readout, slider, svgEl, toggle } from './lib/common';

const COLORS: Record<string, string> = { SETUP: 'var(--lw-muted)', RUN: 'var(--lw-green)', LOOK: 'var(--lw-violet)', BACKUP: 'var(--lw-red)', STOP: 'var(--lw-blue)' };
const TEXT: Record<string, string> = {
  SETUP: 'quieto: calibra el giroscopio (0,3 s) y elige el sentido con los muros',
  RUN: 'sigue la línea planificada',
  LOOK: 'se para, retrocede girando y mira una señal sin color',
  BACKUP: 'retrocede en recta: la primera señal está demasiado cerca',
  STOP: 'tres vueltas y parado en la sección de salida',
};
const P = { cruise: 0.35, pillar: 0.3, finish: 0.15 };

/** Mission._speed: (speed, the rule that set it). */
export function speedRule(offset: boolean, signAhead: number, front: number, remaining: number): [number, string] {
  let speed = P.cruise, why = 'cruise_speed: carril libre';
  if (offset || signAhead < 0.8) { speed = Math.min(speed, P.pillar); why = 'pillar_speed: hay desplazamiento o una señal a menos de 0,8 unidades'; }
  if (front < 0.7 && 0.2 < speed) { speed = 0.2; why = 'la pared de enfrente está a menos de 0,7 m'; }
  const brake = Math.sqrt(Math.max(0, 1.2 * Math.max(remaining, 0)));
  if (brake < speed) { speed = brake; why = '√(1,2 · lo que falta): frenar a tiempo para parar'; }
  if (remaining < 1.2 && P.finish < speed) { speed = P.finish; why = 'finish_speed: los últimos 1,2 de progreso'; }
  if (speed < 0.02) { speed = 0; why = 'por debajo de 0,02 m/s: parado'; }
  return [speed, why];
}

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    const timeline = svgEl('svg', { viewBox: '0 0 640 70', class: 'lw-svg', role: 'img', 'aria-label': 'Los estados de la misión a lo largo de la ronda' });
    const states = readout();
    const caption = h('p', { class: 'lw-caption' }, 'Cargando la ronda…');
    fetch('/learn/assets/replays/obstacle-step-7.json').then((r) => r.json()).then((data) => {
      const labels: { t: number; state: string }[] = data.labels;
      const end = data.duration as number;
      const spent: Record<string, number> = {};
      let out = '';
      labels.forEach((l, i) => {
        const t1 = labels[i + 1]?.t ?? end;
        spent[l.state] = (spent[l.state] ?? 0) + (t1 - l.t);
        const x0 = (l.t / end) * 620 + 10, w = Math.max(1.5, ((t1 - l.t) / end) * 620);
        out += `<rect x="${x0.toFixed(1)}" y="12" width="${w.toFixed(1)}" height="26" fill="${COLORS[l.state] ?? 'var(--lw-amber)'}"><title>${l.state} · ${fmt(l.t, 1)} a ${fmt(t1, 1)} s</title></rect>`;
      });
      for (let t = 0; t <= end; t += 20) out += `<text class="lw-tick" x="${(t / end) * 620 + 10}" y="56" text-anchor="middle">${t} s</text>`;
      (data.events as { t: number; text: string }[]).filter((e) => /Vuelta|STOP/.test(e.text)).forEach((e) => {
        const x = (e.t / end) * 620 + 10;
        out += `<line x1="${x}" y1="6" x2="${x}" y2="44" stroke="var(--lw-text)" stroke-width="1.5"/>`;
      });
      timeline.innerHTML = out;
      states.set(Object.keys(TEXT).filter((s) => spent[s]).map((s) => [s, `${fmt(spent[s], 1)} s · ${TEXT[s]}`] as [string, string]),
        'Los estados de la ronda de referencia.');
      caption.textContent = `La ronda de la repetición del paso 7 (campo 4, antihorario): ${fmt(end, 1)} s. Las rayas marcan cada vuelta y la parada; pasa el ratón por un tramo para ver sus tiempos.`;
    }).catch(() => { caption.textContent = 'No se pudo cargar la ronda.'; });

    // ---- the speed rules
    let offset = false, signAhead = 2, front = 1.5, remaining = 10;
    const rd = readout();
    const bar = svgEl('svg', { viewBox: '0 0 640 60', class: 'lw-svg', role: 'img', 'aria-label': 'La velocidad que pide la misión' });
    function draw(): void {
      const [speed, why] = speedRule(offset, signAhead, front, remaining);
      const x = (v: number) => 10 + (v / 0.4) * 620;
      let out = `<rect x="10" y="14" width="620" height="18" fill="var(--lw-panel)"/>`;
      out += `<rect x="10" y="14" width="${x(speed) - 10}" height="18" fill="var(--lw-amber)"/>`;
      for (const [v, name] of [[P.cruise, 'cruise 0,35'], [P.pillar, 'pillar 0,30'], [0.2, 'pared 0,20'], [P.finish, 'finish 0,15']] as [number, string][]) {
        out += `<line x1="${x(v)}" y1="8" x2="${x(v)}" y2="38" stroke="var(--lw-muted)" stroke-dasharray="3 3"/><text class="lw-tick" x="${x(v)}" y="52" text-anchor="middle">${name}</text>`;
      }
      bar.innerHTML = out;
      rd.set([['velocidad pedida', `${fmt(speed, 3)} m/s`, 'amber'], ['la regla que manda', why]], `La misión pide ${fmt(speed, 2)} metros por segundo: ${why}.`);
    }
    const mk = (label: string, min: number, max: number, step: number, value: number, f: (v: number) => string, set: (v: number) => void) =>
      slider({ label, min, max, step, value, format: f, onInput: (v) => { set(v); draw(); } });
    const sSign = mk('Próxima señal a (unidades de progreso)', 0, 2, 0.05, signAhead, (v) => (v >= 1.8 ? 'ninguna cerca' : fmt(v, 2)), (v) => (signAhead = v));
    const sFront = mk('Pared de enfrente a (m)', 0.1, 1.5, 0.05, front, (v) => `${fmt(v, 2)} m`, (v) => (front = v));
    const sRem = mk('Falta para parar (unidades de progreso)', 0, 10, 0.05, remaining, (v) => fmt(v, 2), (v) => (remaining = v));
    const tOff = toggle('La línea tiene desplazamiento aquí (cambio de lado o junto a una señal)', offset, (v) => { offset = v; draw(); });

    root.append(
      h('p', { class: 'lw-replay-title' }, 'Los estados de una ronda'),
      h('div', { class: 'lw-figure' }, timeline),
      legend([['muted', 'SETUP'], ['green', 'RUN'], ['violet', 'LOOK'], ['red', 'BACKUP'], ['blue', 'STOP']]),
      caption,
      states.root,
      h('p', { class: 'lw-replay-title' }, 'La velocidad (Mission._speed)'),
      h('div', { class: 'lw-figure' }, bar),
      rd.root,
      h('div', { class: 'lw-controls' }, sSign.root, sFront.root, sRem.root, tOff.root),
      h('p', { class: 'lw-note' }, 'Empieza en cruise_speed y cada regla solo puede bajarla: pillar_speed junto a las señales o cambiando de lado, 0,2 m/s con la pared cerca, √(1,2 · lo que falta) para frenar a tiempo y finish_speed al final; por debajo de 2 cm/s, parado. Es _speed de mission.py.'),
    );
    draw();
  });
}
