// Widget "direction-vote": DirectionVote (step 8). Feed the length of the blue and orange lines frame by frame and watch
// the vote, the consecutive hits and the decision. Port of my_open/direction.py.
import { button, fmt, guarded, h, nextId, reducedMotion, slider, svgEl } from './lib/common';
import { CONFIRMATIONS, DirectionVote, MIN_CONFIDENCE, MIN_LENGTH, frameVote } from './lib/direction-model';

/** The 9-frame example of the step: a short line shows up in frame 4. */
const EXAMPLE: [number, number][] = [[300, 60], [305, 70], [300, 65], [20, 5], [310, 60], [300, 58], [305, 62], [300, 59], [307, 61]];
const MAX_LEN = 400;
const MAX_ROWS = 12;

interface Frame { n: number; blue: number; orange: number; vote: number; hits: number; decision: number; reason: string }

const signed = (v: number) => (v > 0 ? '+1' : v < 0 ? '−1' : '0');
const decisionText = (d: number) => (d > 0 ? '+1: vuelta antihoraria (ccw)' : d < 0 ? '−1: vuelta horaria (cw)' : '0: sin decisión todavía');

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let vote = new DirectionVote();
    const frames: Frame[] = [];
    let timer = 0;

    const sBlue = slider({ label: 'Línea azul', min: 0, max: MAX_LEN, step: 1, value: 300, format: (v) => `${fmt(v, 0)} px`, onInput: () => preview() });
    const sOrange = slider({ label: 'Línea naranja', min: 0, max: MAX_LEN, step: 1, value: 60, format: (v) => `${fmt(v, 0)} px`, onInput: () => preview() });

    // two bars: what the camera "sees"
    const BW = 360, BH = 90;
    const bars = svgEl('svg', { viewBox: `0 0 ${BW} ${BH}`, class: 'lw-svg', role: 'img' });
    const barsG = svgEl('g');
    bars.append(barsG);

    const preview$ = h('p', { class: 'lw-note' });
    const send = button('Enviar un fotograma', () => feed(sBlue.get(), sOrange.get()), 'lw-btn-primary');
    const example = button('Enviar la secuencia de ejemplo', () => playExample());
    const reset = button('Reiniciar', () => restart());

    // consecutive hits as a meter of CONFIRMATIONS cells
    const cells = Array.from({ length: CONFIRMATIONS }, () => h('span', { class: 'lw-cell' }));
    const meterLabel = nextId('lw-ml');
    const meter = h('div', { class: 'lw-meter', role: 'img' }, ...cells);
    const meterText = h('span', { class: 'lw-meter-text', id: meterLabel });
    const decision = h('p', { class: 'lw-decision' });
    const live = h('p', { class: 'lw-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });

    const tbody = h('tbody');
    const table = h(
      'table',
      { class: 'lw-table lw-table-small' },
      h('caption', { class: 'lw-sr' }, 'Fotogramas enviados: longitudes, voto, seguidas y decisión'),
      h(
        'thead',
        {},
        h('tr', {}, ...['N.º', 'Azul', 'Naranja', 'Vota', 'Seguidas', 'Decide'].map((t) => h('th', { scope: 'col' }, t))),
      ),
      tbody,
    );
    const empty = h('p', { class: 'lw-note' }, 'Aún no has enviado ningún fotograma.');

    function drawBars(blue: number, orange: number, voteNow: number | null): void {
      const scale = (BW - 130) / MAX_LEN;
      const row = (y: number, len: number, cls: string, name: string) =>
        `<text class="lw-tick" x="4" y="${y + 13}" fill="currentColor">${name}</text>` +
        `<g class="lw-c-${cls}"><rect x="64" y="${y}" width="${Math.max(1, len * scale)}" height="18" rx="3" fill="currentColor"/></g>` +
        `<text class="lw-tick" x="${64 + Math.max(1, len * scale) + 6}" y="${y + 13}" fill="currentColor">${fmt(len, 0)} px</text>`;
      const minX = 64 + MIN_LENGTH * scale;
      const mark = voteNow === null ? '' : `<text class="lw-tag lw-c-amber" x="4" y="${BH - 6}" fill="currentColor">${voteNow === 0 ? 'este fotograma no vota' : `este fotograma votaría ${signed(voteNow)}`}</text>`;
      barsG.innerHTML =
        row(6, blue, 'blue', 'azul') +
        row(30, orange, 'amber', 'naranja') +
        `<line x1="${minX}" y1="2" x2="${minX}" y2="52" stroke="currentColor" class="lw-c-muted" stroke-dasharray="3 3"/>` +
        `<text class="lw-tick" x="${minX + 3}" y="66" fill="currentColor">${MIN_LENGTH} px mínimo</text>` +
        mark;
    }

    function preview(): void {
      const b = sBlue.get(), o = sOrange.get();
      const f = frameVote(b, o);
      drawBars(b, o, f.vote);
      preview$.textContent =
        f.reason === 'short'
          ? `Con estos números el fotograma no vota: la línea más larga mide menos de ${MIN_LENGTH} px (ruido).`
          : f.reason === 'close'
            ? `Con estos números el fotograma no vota: la confianza es ${fmt(f.confidence, 2)} y hace falta ${fmt(MIN_CONFIDENCE, 2)}.`
            : `Con estos números el fotograma votaría ${signed(f.vote)} (confianza ${fmt(f.confidence, 2)}).`;
      bars.setAttribute('aria-label', `Línea azul de ${b} píxeles y línea naranja de ${o} píxeles. ${preview$.textContent}`);
    }

    function render(): void {
      const hits = vote.hits;
      cells.forEach((c, i) => c.classList.toggle('lw-cell-on', i < hits));
      const vtxt = vote.candidate === 0 ? 'ninguno' : signed(vote.candidate);
      meterText.textContent = `${hits} de ${CONFIRMATIONS} seguidas (último voto: ${vtxt})`;
      meter.setAttribute('aria-label', meterText.textContent);
      decision.textContent = `Decisión: ${decisionText(vote.direction)}`;
      decision.className = `lw-decision ${vote.direction > 0 ? 'lw-c-blue' : vote.direction < 0 ? 'lw-c-amber' : 'lw-c-muted'}`;
      const rows = frames.slice(-MAX_ROWS);
      tbody.replaceChildren(
        ...rows.map((f) =>
          h(
            'tr',
            { class: f.decision !== 0 ? 'lw-row-hit' : undefined },
            h('td', {}, String(f.n)),
            h('td', {}, fmt(f.blue, 0)),
            h('td', {}, fmt(f.orange, 0)),
            h('td', { title: f.reason || undefined }, signed(f.vote)),
            h('td', {}, String(f.hits)),
            h('td', {}, signed(f.decision)),
          ),
        ),
      );
      empty.hidden = frames.length > 0;
      table.hidden = frames.length === 0;
    }

    function feed(blue: number, orange: number): void {
      const f = frameVote(blue, orange);
      const decided = vote.update(blue, orange);
      frames.push({
        n: frames.length + 1,
        blue,
        orange,
        vote: f.vote,
        hits: vote.hits,
        decision: decided,
        reason: f.reason === 'short' ? 'línea corta' : f.reason === 'close' ? 'líneas parecidas' : '',
      });
      render();
      const why = f.reason === 'short' ? 'no vota: línea corta' : f.reason === 'close' ? 'no vota: líneas parecidas' : `vota ${signed(f.vote)}`;
      live.textContent = `Imagen ${frames.length}: ${why}. Seguidas ${vote.hits} de ${CONFIRMATIONS}. ${decisionText(decided)}.`;
    }

    function restart(): void {
      window.clearTimeout(timer);
      vote = new DirectionVote();
      frames.length = 0;
      render();
      live.textContent = 'Votación reiniciada.';
    }

    function playExample(): void {
      restart();
      let i = 0;
      const next = () => {
        const [b, o] = EXAMPLE[i];
        sBlue.set(b);
        sOrange.set(o);
        preview();
        feed(b, o);
        i++;
        if (i < EXAMPLE.length) timer = window.setTimeout(next, reducedMotion() ? 0 : 650);
      };
      next();
    }

    root.append(
      h('div', { class: 'lw-figure lw-square' }, bars),
      h('div', { class: 'lw-controls' }, sBlue.root, sOrange.root),
      preview$,
      h('div', { class: 'lw-actions' }, send, example, reset),
      h('div', { class: 'lw-meter-row' }, h('span', { class: 'lw-meter-title' }, 'Seguidas que votan igual'), meter, meterText),
      decision,
      empty,
      h('div', { class: 'lw-tablewrap', role: 'region', 'aria-label': 'Historial de fotogramas', tabindex: '0' }, table),
      live,
      h(
        'p',
        { class: 'lw-note' },
        `Un fotograma vota solo si la línea más larga mide al menos ${MIN_LENGTH} px y |azul − naranja| / la más larga llega a ${fmt(MIN_CONFIDENCE, 2)}. La decisión necesita ${CONFIRMATIONS} votos seguidos iguales; un fotograma que no vota o vota lo contrario reinicia la cuenta.`,
      ),
    );
    preview();
    render();
  });
}
