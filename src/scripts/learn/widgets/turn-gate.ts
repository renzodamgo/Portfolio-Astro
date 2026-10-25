// Widget "turn-gate": drag the car along the south corridor and watch the conditions of TurnGate (my_open/turn_gate.py, step 6) light up.
// The gate is an exact port (lib/turn-gate-model.ts); the scenes are what perceive() gives on the course's mini simulator, one scan every 0.06 m.
import { button, fmt, guarded, h, legend, slider, svgEl, toggle } from './lib/common';
import {
  ARM_DISTANCE, CONFIRMATIONS, GAPS, ISLAND_OPEN, LIDAR_X, LOOKAHEAD, SCAN_COUNT, SCAN_STEP, TICKS_PER_SCAN, TURN_FRONT, X_START,
  trace, xOf, type GateOptions, type Row,
} from './lib/turn-gate-model';

const VW = 335, VH = 176, K = 100; // viewBox and px/m
const P = (x: number, y: number): [number, number] => [15 + (x + 1.55) * K, 20 + (-0.15 - y) * K];
const FRONT = 0.1477, REAR = 0.0852, HALF = 0.074;
const m2 = (v: number): string => fmt(v, 2);
const SIDE_LIMIT = 0.5; // m: x of the end of the island

interface State {
  gap: number;
  startClosed: boolean;
  lost: Set<number>;
  everyTick: boolean;
  oneConfirmation: boolean;
  noArmed: boolean;
  k: number;
}

interface Preset {
  label: string;
  state: Partial<State>;
  look: string;
}

const DEFAULTS = (): State => ({ gap: 0.25, startClosed: true, lost: new Set<number>(), everyTick: false, oneConfirmation: false, noArmed: false, k: 0 });

const PRESETS: Preset[] = [
  {
    label: 'Carril normal',
    state: { gap: 0.25 },
    look: 'El coche va a 0,25 m de la isla. El límite del final es min(0,35; 0,25 menos 0,08) = 0,17 m, tan corto que el final se ve cerca en un solo escaneo. La puerta gira cuando el lado se abre (inner pasa de 1,0 m), no por las confirmaciones. Retrocede un escaneo con el botón de la izquierda y mira qué faltaba.',
  },
  {
    label: 'Carril ancho',
    state: { gap: 0.6 },
    look: 'A 0,60 m el límite es 0,35 m y el final de la isla se ve cerca antes. En el mismo escaneo (x = 0,24 m) la pared de enfrente baja de 1,19 m y hits llega a 2 de 2: gira por confirmación, con el lado aún cerrado.',
  },
  {
    label: 'Se pierde un escaneo',
    state: { gap: 0.6, lost: new Set([22]) },
    look: 'En el escaneo 22 el final no se ve (cruz roja). hits vuelve a 0 y la puerta gira un escaneo más tarde (6 cm más allá) que en el carril ancho de antes. Un solo escaneo malo no dispara la esquina.',
  },
  {
    label: 'Rómpelo: contar por tick',
    state: { gap: 0.3, everyTick: true },
    look: 'La puerta cuenta la misma escena en cada tick: con 5 ticks por escaneo, hits sube de 0 a 2 en un solo escaneo y gira un escaneo antes (x = 0,30 m en vez de 0,36 m). Es el error de test_the_same_scan_repeated_counts_once.',
  },
];

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    const s: State = DEFAULTS();
    let rows: Row[] = [];
    let look = 'Arrastra el coche por el pasillo (o usa el deslizador) y mira cuándo se enciende cada condición.';
    let dragging = false;

    // ------------------------------------------------------------------ drawing
    const svg = svgEl('svg', {
      viewBox: `0 0 ${VW} ${VH}`,
      class: 'lw-svg lw-tg-svg',
      role: 'img',
      'aria-label': 'Vista desde arriba del pasillo sur: la isla arriba, el coche va hacia la pared del este. Arrastra el coche para moverlo.',
    });
    const scene = svgEl('g');
    svg.append(scene);

    const rect = (x1: number, y1: number, x2: number, y2: number, cls: string): string => {
      const [ax, ay] = P(x1, y1), [bx, by] = P(x2, y2);
      return `<rect class="${cls}" x="${Math.min(ax, bx).toFixed(1)}" y="${Math.min(ay, by).toFixed(1)}" width="${Math.abs(bx - ax).toFixed(1)}" height="${Math.abs(by - ay).toFixed(1)}"/>`;
    };
    const line = (x1: number, y1: number, x2: number, y2: number, extra = ''): string => {
      const [ax, ay] = P(x1, y1), [bx, by] = P(x2, y2);
      return `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="currentColor" ${extra}/>`;
    };

    function draw(): void {
      const r = rows[s.k];
      const x = r.x, yc = -0.5 - s.gap, lx = x + LIDAR_X;
      const c = r.conditions;
      let out = '';
      // walls: south, east, west, island (the island is open at the top of the picture)
      out += rect(-1.6, -1.5, 1.6, -1.65, 'lw-wall');
      out += rect(1.5, -1.5, 1.65, 0.4, 'lw-wall');
      out += rect(-1.5, -1.5, -1.65, 0.4, 'lw-wall');
      out += rect(-0.5, -0.5, 0.5, 0.4, 'lw-wall');
      // zone where front_axis <= TURN_FRONT, and the start of the corridor
      const [zx0, zy0] = P(1.5 - TURN_FRONT, -0.5), [zx1, zy1] = P(1.5, -1.5);
      out += `<g class="lw-c-amber"><rect x="${zx0.toFixed(1)}" y="${zy0.toFixed(1)}" width="${(zx1 - zx0).toFixed(1)}" height="${(zy1 - zy0).toFixed(1)}" fill="currentColor" opacity="${c.frontOk ? 0.22 : 0.09}"/>`;
      out += line(1.5 - TURN_FRONT, -0.5, 1.5 - TURN_FRONT, -1.5, 'stroke-width="1" stroke-dasharray="4 3"');
      const [tx, ty] = P(1.5 - TURN_FRONT + 0.04, -1.5 + 0.06);
      out += `<text class="lw-tick" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" fill="currentColor">front_axis ≤ 1,19</text></g>`;
      out += `<g class="lw-c-muted">${line(X_START, -0.5, X_START, -1.5, 'stroke-width="1" stroke-dasharray="3 3"')}</g>`;
      // how far the car has driven since the corner (bar) and the ARM_DISTANCE tick
      const [bx0, by0] = P(X_START, -1.36), [bx1] = P(x, -1.36), [bx2] = P(X_START + ARM_DISTANCE, -1.36);
      out += `<g class="${c.travelledOk ? 'lw-c-green' : 'lw-c-red'}"><line x1="${bx0.toFixed(1)}" y1="${by0.toFixed(1)}" x2="${bx1.toFixed(1)}" y2="${by0.toFixed(1)}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`;
      out += `<text class="lw-tick" x="${(bx0 + 2).toFixed(1)}" y="${(by0 - 6).toFixed(1)}" fill="currentColor">travelled ${m2(r.travelled)} m</text></g>`;
      out += `<g class="lw-c-muted"><line x1="${bx2.toFixed(1)}" y1="${(by0 - 5).toFixed(1)}" x2="${bx2.toFixed(1)}" y2="${(by0 + 5).toFixed(1)}" stroke="currentColor" stroke-width="1.5"/>`;
      out += `<text class="lw-tick" x="${bx2.toFixed(1)}" y="${(by0 + 16).toFixed(1)}" text-anchor="middle" fill="currentColor">0,25</text></g>`;
      // the scans seen so far, along the island wall: filled = end near enough, red cross = end lost, ring = end too far or not visible
      for (let j = 0; j <= s.k; j++) {
        const q = rows[j];
        const [dx, dy] = P(q.x + LIDAR_X, -0.5 - 0.075);
        if (s.lost.has(j)) {
          out += `<g class="lw-c-red"><path d="M ${dx - 2.2} ${dy - 2.2} l 4.4 4.4 m 0 -4.4 l -4.4 4.4" stroke="currentColor" stroke-width="1.6" fill="none"/></g>`;
        } else if (q.conditions.endNear) {
          out += `<g class="lw-c-green"><circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="2.6" fill="currentColor"/></g>`;
        } else {
          out += `<g class="lw-c-muted"><circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="1.8" fill="none" stroke="currentColor" stroke-width="1"/></g>`;
        }
      }
      // the end of the island and the look-ahead window of this scan
      const endVisible = Number.isFinite(c.islandEnd);
      const [ex, ey] = P(SIDE_LIMIT, -0.5);
      out += `<g class="${c.endNear ? 'lw-c-green' : 'lw-c-muted'}"><circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="4" fill="currentColor"/></g>`;
      if (Number.isFinite(c.inner) && c.inner < ISLAND_OPEN) {
        const from = Math.max(x, -0.5), to = Math.min(x + c.limit, 0.5);
        if (to > from) out += `<g class="lw-c-green">${line(from, -0.5, to, -0.5, 'stroke-width="4" stroke-linecap="round" opacity="0.85"')}</g>`;
      }
      const [lx0, ly0] = P(SIDE_LIMIT + 0.03, 0.18);
      const endText = s.lost.has(r.k) ? 'island_end: perdido' : endVisible ? `island_end ${m2(c.islandEnd)} m` : 'island_end: no se ve';
      out += `<g class="${s.lost.has(r.k) ? 'lw-c-red' : endVisible ? (c.endNear ? 'lw-c-green' : 'lw-c-muted') : 'lw-c-muted'}"><text class="lw-tag" x="${lx0.toFixed(1)}" y="${ly0.toFixed(1)}" fill="currentColor">${endText}</text></g>`;
      out += `<g class="lw-c-green"><text class="lw-tick" x="${lx0.toFixed(1)}" y="${(ly0 + 13).toFixed(1)}" fill="currentColor">límite ${m2(c.limit)} m</text></g>`;
      // beam to the island wall (left = inner) and beam to the wall ahead (front_axis)
      const [cx0, cy0] = P(lx, yc);
      const open = c.islandOpen || !Number.isFinite(c.inner) || c.inner >= ISLAND_OPEN;
      const [ix, iy] = P(lx, open ? 0.4 : -0.5);
      out += `<g class="${c.islandOpen ? 'lw-c-green' : 'lw-c-blue'}"><line x1="${cx0.toFixed(1)}" y1="${cy0.toFixed(1)}" x2="${ix.toFixed(1)}" y2="${iy.toFixed(1)}" stroke="currentColor" stroke-width="1.5"${open ? ' stroke-dasharray="5 4"' : ''}/>`;
      const innerLabelX = Math.min(Math.max(cx0 + 5, 4), VW - 118);
      out += `<text class="lw-tag" x="${innerLabelX.toFixed(1)}" y="${(open ? 14 : iy + 15).toFixed(1)}" fill="currentColor">inner ${m2(c.inner)} m${c.islandOpen ? ' (abierto)' : ''}</text></g>`;
      const [wx] = P(1.5, yc);
      out += `<g class="lw-c-blue"><line x1="${cx0.toFixed(1)}" y1="${cy0.toFixed(1)}" x2="${wx.toFixed(1)}" y2="${cy0.toFixed(1)}" stroke="currentColor" stroke-width="1.5"/>`;
      out += `<text class="lw-tag" x="${(wx - 4).toFixed(1)}" y="${(cy0 - 5).toFixed(1)}" text-anchor="end" fill="currentColor">front_axis ${m2(c.frontAxis)} m</text></g>`;
      // the car (the LiDAR sits LIDAR_X ahead of its centre)
      const [px, py] = P(x, yc);
      out += `<g class="lw-tg-car" transform="translate(${px.toFixed(1)} ${py.toFixed(1)}) scale(${K})">`;
      out += `<rect x="${-REAR}" y="${-HALF}" width="${FRONT + REAR}" height="${2 * HALF}" rx="0.012" class="lw-body"/>`;
      out += `<path d="M ${FRONT - 0.03} -0.03 L ${FRONT} 0 L ${FRONT - 0.03} 0.03 Z" class="lw-nose"/>`;
      out += `<circle cx="${LIDAR_X}" cy="0" r="0.022" class="lw-lidar"/></g>`;
      if (r.fired) {
        out += `<g class="lw-c-green"><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="17" fill="none" stroke="currentColor" stroke-width="2.5"/>`;
        out += `<text class="lw-tag" x="${(px - 22).toFixed(1)}" y="${(py + 4).toFixed(1)}" text-anchor="end" fill="currentColor">¡gira!</text></g>`;
      }
      scene.innerHTML = out;
    }

    // ------------------------------------------------------------------ the conditions
    const rowEl = (code: string) => {
      const badge = h('span', { class: 'lw-tg-badge' });
      const text = h('span', { class: 'lw-tg-text' });
      const li = h('li', { class: 'lw-tg-row' }, badge, h('span', { class: 'lw-tg-body' }, h('code', { class: 'lw-tg-code' }, code), text));
      return { li, badge, text, set(ok: boolean, msg: string) { li.dataset.ok = String(ok); badge.textContent = ok ? 'sí' : 'no'; text.textContent = msg; } };
    };
    const rArmed = rowEl('armed');
    const rDist = rowEl('travelled >= ARM_DISTANCE');
    const rFront = rowEl('front_axis <= TURN_FRONT');
    const rOpen = rowEl('inner > ISLAND_OPEN');
    const rHits = rowEl('hits >= CONFIRMATIONS');
    const sub = h('ul', { class: 'lw-tg-sub' }, rOpen.li, rHits.li);
    const orRow = h('li', { class: 'lw-tg-row lw-tg-group' }, h('span', { class: 'lw-tg-badge', 'aria-hidden': 'true' }, '4'), h('span', { class: 'lw-tg-body' }, h('span', { class: 'lw-tg-text' }, 'La isla terminó (una de las dos):'), sub));
    const pill = (name: string) => {
      const b = h('b', {});
      const e = h('span', { class: 'lw-tg-pill' }, b, ` ${name}`);
      return { e, set(ok: boolean) { e.dataset.ok = String(ok); b.textContent = ok ? 'sí' : 'no'; } };
    };
    const pArmed = pill('armed'), pDist = pill('recorrido'), pFront = pill('pared cerca'), pEnded = pill('isla terminada');
    const pills = h('div', { class: 'lw-tg-pills', role: 'group', 'aria-label': 'Las cuatro condiciones de la puerta' }, pArmed.e, pDist.e, pFront.e, pEnded.e);
    const verdict = h('p', { class: 'lw-tg-verdict lw-decision' });
    const meter = h('div', { class: 'lw-meter-row' });
    const meterTitle = h('span', { class: 'lw-meter-title' }, 'hits');
    const meterCells = h('span', { class: 'lw-meter', 'aria-hidden': 'true' });
    const meterText = h('span', { class: 'lw-meter-text' });
    meter.append(meterTitle, meterCells, meterText);
    const tickRow = h('div', { class: 'lw-meter-row' });
    const tickCells = h('span', { class: 'lw-meter', 'aria-hidden': 'true' });
    const tickText = h('span', { class: 'lw-meter-text' });
    tickRow.append(h('span', { class: 'lw-meter-title' }, 'ticks de este escaneo'), tickCells, tickText);
    const live = h('p', { class: 'lw-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    let liveTimer = 0;

    function conditionsView(): void {
      const r = rows[s.k];
      const c = r.conditions;
      const conf = s.oneConfirmation ? 1 : CONFIRMATIONS;
      rArmed.set(c.armed || s.noArmed, s.noArmed ? 'ignorada (la puerta no mira armed)' : c.armed ? 'armada' : 'cerrada: se arma al ver la isla otra vez (inner < 1,0 m) con 0,25 m recorridos');
      rDist.set(c.travelledOk, `${m2(c.travelled)} m recorridos desde la esquina anterior (hacen falta ${m2(ARM_DISTANCE)})`);
      rFront.set(c.frontOk, `pared de enfrente a ${m2(c.frontAxis)} m (debe ser ${m2(TURN_FRONT)} o menos)`);
      rOpen.set(c.islandOpen, `inner = ${m2(c.inner)} m (debe pasar de ${m2(ISLAND_OPEN)})`);
      const endText = s.lost.has(r.k) ? 'final perdido en este escaneo' : Number.isFinite(c.islandEnd) ? `island_end = ${m2(c.islandEnd)} m, límite = min(${m2(LOOKAHEAD)}; inner − 0,08) = ${m2(c.limit)} m` : 'el final no se ve';
      rHits.set(c.hitsOk, `${endText}; hits = ${c.hits} de ${conf}`);
      meterCells.replaceChildren(...Array.from({ length: conf }, (_, i) => h('span', { class: i < Math.min(c.hits, conf) ? 'lw-cell lw-cell-on' : 'lw-cell' })));
      meterText.textContent = `${c.hits} de ${conf} escaneos seguidos`;
      tickCells.replaceChildren(...r.answers.concat(Array(TICKS_PER_SCAN - r.answers.length).fill(null)).map((a) => h('span', { class: a === true ? 'lw-cell lw-cell-on' : 'lw-cell' })));
      tickText.textContent = r.fired ? `la puerta dijo que gire en el tick ${r.answers.length}` : `la puerta dijo que no en los ${TICKS_PER_SCAN}`;
      const ended = c.ended;
      pArmed.set(c.armed || s.noArmed);
      pDist.set(c.travelledOk);
      pFront.set(c.frontOk);
      pEnded.set(ended);
      verdict.dataset.fire = String(r.fired);
      verdict.textContent = r.fired
        ? `La puerta responde: gira (escaneo ${r.k}, x = ${m2(r.x)} m). Aquí el nodo suma 90° a la meta y llama a corner_started().`
        : `La puerta responde: no gira. ${!(c.armed || s.noArmed) ? 'Sigue cerrada.' : !c.travelledOk ? 'Falta recorrido.' : !c.frontOk ? 'La pared de enfrente aún está lejos.' : !ended ? 'La isla no terminó.' : ''}`;
      window.clearTimeout(liveTimer);
      liveTimer = window.setTimeout(() => {
        live.textContent = `Escaneo ${r.k}, x = ${m2(r.x)} metros. Puerta armada: ${c.armed || s.noArmed ? 'sí' : 'no'}. Recorrido suficiente: ${c.travelledOk ? 'sí' : 'no'}. Pared de enfrente cerca: ${c.frontOk ? 'sí' : 'no'}. Lado abierto: ${c.islandOpen ? 'sí' : 'no'}. Confirmaciones: ${c.hits} de ${conf}. ${r.fired ? 'La puerta gira.' : 'La puerta no gira.'}`;
      }, 500);
    }

    // ------------------------------------------------------------------ controls
    const pos = slider({
      label: 'Escaneo',
      min: 0,
      max: SCAN_COUNT - 1,
      step: 1,
      value: 0,
      format: (v) => `${v} · x = ${m2(xOf(v))} m`,
      onInput: (v) => {
        s.k = Math.min(v, rows.length - 1);
        update(false);
      },
    });
    const prev = button('◀ Escaneo anterior', () => step(-1));
    const next = button('Escaneo siguiente ▶', () => step(1));
    const jump = button('Ir al giro', () => {
      s.k = rows.length - 1;
      update();
    });
    function step(d: number): void {
      s.k = Math.max(0, Math.min(rows.length - 1, s.k + d));
      update();
    }

    const gapButtons = GAPS.map((g) => {
      const b = button(`${m2(g)} m`, () => {
        s.gap = g;
        rerun();
      });
      b.dataset.gap = String(g);
      return b;
    });
    const gapRow = h('div', { class: 'lw-actions' }, h('span', { class: 'lw-meter-title lw-tg-label' }, 'Distancia del coche a la isla (inner)'), ...gapButtons);

    const presetButtons = PRESETS.map((p, i) => button(p.label, () => applyPreset(i)));
    const lostButton = button('', () => {
      if (s.lost.has(s.k)) s.lost.delete(s.k);
      else s.lost.add(s.k);
      rerun();
    });
    const tClosed = toggle('La puerta empieza cerrada (acaba de pasar una esquina)', s.startClosed, (v) => {
      s.startClosed = v;
      rerun();
    });
    const tEvery = toggle('Contar en cada tick, no por escaneo', s.everyTick, (v) => {
      s.everyTick = v;
      rerun();
    });
    const tOne = toggle('CONFIRMATIONS = 1', s.oneConfirmation, (v) => {
      s.oneConfirmation = v;
      rerun();
    });
    const tArmed = toggle('Quitar la condición armed', s.noArmed, (v) => {
      s.noArmed = v;
      rerun();
    });
    const lookEl = h('p', { class: 'lw-caption lw-tg-look' }, look);
    const reset = button('Restablecer', () => {
      Object.assign(s, DEFAULTS());
      look = 'Arrastra el coche por el pasillo (o usa el deslizador) y mira cuándo se enciende cada condición.';
      syncControls();
      rerun();
    });

    function applyPreset(i: number): void {
      Object.assign(s, DEFAULTS(), PRESETS[i].state);
      look = PRESETS[i].look;
      syncControls();
      rows = build();
      s.k = rows.length - 1;
      update();
    }

    function syncControls(): void {
      tClosed.input.checked = s.startClosed;
      tEvery.input.checked = s.everyTick;
      tOne.input.checked = s.oneConfirmation;
      tArmed.input.checked = s.noArmed;
    }

    function options(): GateOptions {
      return { countEveryTick: s.everyTick, confirmations: s.oneConfirmation ? 1 : CONFIRMATIONS, ignoreArmed: s.noArmed };
    }
    function build(): Row[] {
      return trace({ gap: s.gap, startClosed: s.startClosed, lost: s.lost, gate: options() });
    }
    function rerun(): void {
      rows = build();
      s.k = Math.min(s.k, rows.length - 1);
      update();
    }

    function update(syncSlider = true): void {
      pos.input.max = String(rows.length - 1);
      if (syncSlider) pos.set(s.k);
      gapButtons.forEach((b) => {
        const on = Number(b.dataset.gap) === s.gap;
        b.classList.toggle('lw-btn-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      lostButton.textContent = s.lost.has(s.k) ? 'Recuperar el final en este escaneo' : 'Perder el final en este escaneo';
      prev.disabled = s.k === 0;
      next.disabled = s.k >= rows.length - 1;
      jump.disabled = !rows[rows.length - 1].fired || s.k === rows.length - 1;
      lookEl.textContent = look;
      draw();
      conditionsView();
    }

    // dragging the car
    const xFromEvent = (e: PointerEvent): number => {
      const box = svg.getBoundingClientRect();
      const vx = ((e.clientX - box.left) / box.width) * VW;
      return (vx - 15) / K - 1.55; // x of base_link in the field
    };
    const moveTo = (e: PointerEvent) => {
      const k = Math.round((xFromEvent(e) - X_START) / SCAN_STEP);
      const clamped = Math.max(0, Math.min(rows.length - 1, k));
      if (clamped !== s.k) {
        s.k = clamped;
        update();
      }
    };
    svg.addEventListener('pointerdown', (e) => {
      dragging = true;
      svg.setPointerCapture(e.pointerId);
      moveTo(e);
    });
    svg.addEventListener('pointermove', (e) => {
      if (dragging) moveTo(e);
    });
    const stop = () => {
      dragging = false;
    };
    svg.addEventListener('pointerup', stop);
    svg.addEventListener('pointercancel', stop);

    root.append(
      h('div', { class: 'lw-figure' }, svg),
      legend([
        ['amber', 'pared a 1,19 m o menos'],
        ['green', 'final de la isla cerca'],
        ['red', 'final perdido'],
      ]),
      pills,
      verdict,
      h('div', { class: 'lw-controls' }, pos.root),
      h('div', { class: 'lw-actions' }, prev, next, jump),
      gapRow,
      h('ul', { class: 'lw-tg-rows' }, rArmed.li, rDist.li, rFront.li, orRow),
      meter,
      tickRow,
      h('div', { class: 'lw-actions' }, h('span', { class: 'lw-meter-title lw-tg-label' }, 'Prueba esto'), ...presetButtons),
      lookEl,
      h('fieldset', { class: 'lw-group lw-radios' }, h('legend', {}, 'Cambia la puerta'), tClosed.root, lostButton, tEvery.root, tOne.root, tArmed.root),
      h('div', { class: 'lw-actions' }, reset),
      h(
        'p',
        { class: 'lw-note' },
        `TurnGate es el mismo código del paso (port exacto, comprobado contra Python). Los números de la escena (left, front_axis, island_end) son los de perceive() en el mini simulador, sin ruido: un escaneo cada ${fmt(SCAN_STEP, 2)} m (0,6 m/s por 0,1 s) y ${TICKS_PER_SCAN} ticks de control por escaneo. El coche sale de la esquina anterior en x = ${m2(X_START)} m (travelled = 0) y va recto.`,
      ),
      live,
    );
    rows = build();
    update();
  });
}
