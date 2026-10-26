// Widget "obstacle-score": the points of an Obstacle round as the course's judge counts them (step 1 of the guide):
// 1 per section (24), 1 per lap (3), 3 for stopping in the start section, 10 for signs not moved after the three laps,
// and 15 (fully parked and parallel) or 7 (partly) for the parking. And how two rounds compare: points first, then time.
import { fmt, guarded, h, readout, slider, svgEl, toggle } from './lib/common';

interface Round { sections: number; stop: boolean; signs: boolean; park: 0 | 7 | 15; time: number }
export function points(r: Round): { total: number; parts: [string, number][] } {
  const laps = Math.min(3, Math.floor(r.sections / 8));
  const parts: [string, number][] = [
    ['1.1 secciones', r.sections], ['1.2 vueltas', laps], ['1.3 parar en la salida', r.stop && r.sections >= 24 ? 3 : 0],
    ['1.4–1.7 señales sin mover', r.signs && laps === 3 ? 10 : 0], ['1.8 aparcamiento', r.sections >= 24 ? r.park : 0],
  ];
  return { total: parts.reduce((s, [, p]) => s + p, 0), parts };
}

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    const rounds: Round[] = [
      { sections: 24, stop: true, signs: true, park: 0, time: 115.6 },
      { sections: 24, stop: false, signs: true, park: 15, time: 168 },
    ];
    const bars = svgEl('svg', { viewBox: '0 0 640 120', class: 'lw-svg', role: 'img', 'aria-label': 'Los puntos de las dos rondas por apartado' });
    const verdict = readout();
    const COLORS = ['var(--lw-amber)', 'var(--lw-green)', 'var(--lw-blue)', 'var(--lw-violet)', 'var(--lw-red)'];

    function draw(): void {
      const scored = rounds.map(points);
      let out = '';
      scored.forEach((s, i) => {
        const y = 14 + i * 50;
        out += `<text class="lw-tag lw-c-cream" x="8" y="${y + 18}" fill="currentColor">Ronda ${i === 0 ? 'A' : 'B'}</text>`;
        let x = 80;
        s.parts.forEach(([name, p], k) => {
          const w = (p / 55) * 520;
          if (w > 0) out += `<rect x="${x}" y="${y}" width="${w}" height="26" fill="${COLORS[k]}"><title>${name}: ${p}</title></rect>`;
          if (w > 22) out += `<text class="lw-tick" x="${x + w / 2}" y="${y + 17}" text-anchor="middle" fill="#0c0a07">${p}</text>`;
          x += w;
        });
        out += `<text class="lw-tag lw-c-cream" x="${x + 6}" y="${y + 18}" fill="currentColor">${s.total} · ${fmt(rounds[i].time, 1)} s</text>`;
      });
      bars.innerHTML = out;
      const [a, b] = scored;
      const better = a.total !== b.total ? (a.total > b.total ? 'A' : 'B') : rounds[0].time === rounds[1].time ? null : rounds[0].time < rounds[1].time ? 'A' : 'B';
      const why = a.total !== b.total ? `más puntos (${Math.max(a.total, b.total)} contra ${Math.min(a.total, b.total)})` : better ? `los mismos ${a.total} puntos y menos tiempo` : 'empate en puntos y tiempo';
      verdict.set([
        ['Ronda A', `${a.total} de 55`],
        ['Ronda B', `${b.total} de 55`],
        ['la mejor', better ? `la ${better}: ${why}` : why, 'green'],
      ], better ? `La mejor es la ronda ${better}: ${why}.` : 'Empate.');
    }

    const editor = (i: number) => {
      const r = rounds[i];
      const sS = slider({ label: 'Secciones recorridas', min: 0, max: 24, step: 1, value: r.sections, format: (v) => `${v} (${Math.min(3, Math.floor(v / 8))} vueltas)`, onInput: (v) => { r.sections = v; draw(); } });
      const sT = slider({ label: 'Tiempo desde Start (s)', min: 60, max: 180, step: 0.5, value: r.time, format: (v) => `${fmt(v, 1)} s`, onInput: (v) => { r.time = v; draw(); } });
      const tStop = toggle('Para en la sección de salida', r.stop, (v) => { r.stop = v; draw(); });
      const tSigns = toggle('No mueve ninguna señal', r.signs, (v) => { r.signs = v; draw(); });
      const park = h('select', { id: `lw-sc-park-${i}` });
      park.append(h('option', { value: 0 }, 'no aparca'), h('option', { value: 7 }, 'aparcado en parte (7)'), h('option', { value: 15 }, 'aparcado del todo y en paralelo (15)'));
      park.value = String(r.park);
      park.addEventListener('change', () => { r.park = Number(park.value) as 0 | 7 | 15; draw(); });
      const f = h('fieldset', { class: 'lw-group' }, h('legend', {}, `Ronda ${i === 0 ? 'A' : 'B'}`));
      f.append(h('div', { class: 'lw-controls' }, sS.root, sT.root, h('div', { class: 'lw-field' }, h('label', { for: `lw-sc-park-${i}` }, 'Aparcamiento'), park), tStop.root, tSigns.root));
      return f;
    };
    root.append(
      h('div', { class: 'lw-figure' }, bars),
      verdict.root,
      editor(0), editor(1),
      h('p', { class: 'lw-note' }, 'Puntos del juez del curso (55 como máximo; el reglamento da 7 más por arrancar dentro del aparcamiento). Parar, las señales y el aparcamiento solo cuentan tras las tres vueltas. Entre dos rondas gana la de más puntos; con los mismos, la de menos tiempo desde Start. La ronda A es la de Gazebo del paso 9 (40 puntos, 115,6 s).'),
    );
    draw();
  });
}
