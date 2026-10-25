// Widget "state-machine": the mission of step 7 as an animated diagram (SETUP, RUN with FOLLOW / TURN / FINISH, STOP).
// It follows the transitions of my_open/mission.py (MiniMission) along a scripted round. No physics: it explains the logic.
// Next to the diagram: the lines of mission.py that run in the current state, the lap counter and the speed the mission asks for.
import { button, createPlot, fmt, guarded, h, nextId, slider, svgEl } from './lib/common';

type Sub = 'WAIT_START' | 'CALIBRATE' | 'DETECT_DIRECTION' | 'FOLLOW' | 'TURN' | 'FINISH' | 'DONE' | 'DIRECTION_FAULT' | 'OPERATOR_STOP';
type EdgeId = 'start' | 'calibrated' | 'direction' | 'turn' | 'corner' | 'finish' | 'rest' | 'fault';
type Group = 'SETUP' | 'RUN' | 'STOP';

interface Ev { t: number; sub: Sub; corners: number; edge: EdgeId | null; speed: number; caption: string; code?: CodeId }

/** Lines of my_open/mission.py (step 7) that run in each state. Every line is copied from the file ('# ...' marks skipped lines). */
type CodeId = Sub | 'BRAKE';
const CODE: Record<CodeId, { fn: string; lines: string[] }> = {
  WAIT_START: { fn: '_setup', lines: ['if not self.started:', '    return 0.0, 0.0'] },
  CALIBRATE: { fn: '_setup', lines: ['self._time += dt', 'if not self._calibrated and self._time < CALIBRATE_SECONDS:', '    self._samples.append(gyro_z)', '    self._fronts.append(scene.front_axis)'] },
  DETECT_DIRECTION: { fn: '_setup', lines: ['if not self.direction and camera:', "    self.direction = 'ccw' if camera > 0 else 'cw'", 'if self.direction:', "    self.state, self.travelled = 'RUN', 0.0"] },
  FOLLOW: { fn: '_run', lines: ['steer = lane_steer(self.goal, self.yaw, keep, sign)', 'return self._straight_speed(scene, last, corner_speed), steer'] },
  TURN: { fn: '_run', lines: ['if self.gate.update(scene, inner, self.travelled, self.arc):', '    self.goal = wrap(self.goal + sign * math.pi / 2)', '    self.arc = True', '# ...', 'if self.arc:', '    return corner_speed, self._corner(dt, gyro, sign, corner_speed)'] },
  FINISH: { fn: '_finish', lines: ['if math.isfinite(self._start_front) and scene.front_axis > self._start_front + FINISH_LEAD:', '    return FINISH_SPEED, steer', 'self._braking = True'] },
  BRAKE: { fn: '_finish', lines: ['self._rest += dt', 'if self._rest >= STOP_WAIT:', "    self._stop('done')", 'return 0.0, 0.0'] },
  DONE: { fn: '_stop', lines: ['self.state, self.stop_reason = \'STOP\', reason'] },
  DIRECTION_FAULT: { fn: '_setup', lines: ['elif self._time >= DIRECTION_TIMEOUT:', "    self._stop('direction_fault')"] },
  OPERATOR_STOP: { fn: 'operator_stop', lines: ["self._stop('operator_stop')"] },
};

const CORNERS = 12;
const GROUP: Record<Sub, Group> = {
  WAIT_START: 'SETUP', CALIBRATE: 'SETUP', DETECT_DIRECTION: 'SETUP',
  FOLLOW: 'RUN', TURN: 'RUN', FINISH: 'RUN',
  DONE: 'STOP', DIRECTION_FAULT: 'STOP', OPERATOR_STOP: 'STOP',
};
const CRUISE = 1.28, LAST = 0.6, CREEP = 0.15;

// ------------------------------------------------------------------------------ the scripted rounds
function setupEvents(): Ev[] {
  return [
    { t: 0, sub: 'WAIT_START', corners: 0, edge: null, speed: 0, caption: 'SETUP / WAIT_START: antes de Start el coche está quieto y no mide nada. step() devuelve velocidad 0 y dirección 0.' },
    { t: 0, sub: 'CALIBRATE', corners: 0, edge: 'start', speed: 0, caption: 'Start (request_start). Durante 0,3 s quieto: guarda lecturas del giroscopio y la distancia a la pared de enfrente.' },
    { t: 0.3, sub: 'DETECT_DIRECTION', corners: 0, edge: 'calibrated', speed: 0, caption: 'Pasaron 0,3 s: calcula el sesgo del giroscopio y la distancia de Start (start_front, la mediana). Sigue quieto esperando el voto de la cámara.' },
  ];
}

function normalRound(): Ev[] {
  const ev = setupEvents();
  ev.push({ t: 0.44, sub: 'FOLLOW', corners: 0, edge: 'direction', speed: CRUISE, caption: 'Sentido conocido (en este paso va fijo; desde el paso 8 lo decide la cámara): SETUP pasa a RUN. FOLLOW sigue el rumbo meta a lo largo de la pared de la isla, a 1,28 m/s pedidos.' });
  for (let k = 1; k <= CORNERS; k++) {
    const t0 = 1.1 + 2.6 * (k - 1);
    if (k === CORNERS) {
      ev.push({ t: t0 - 0.9, sub: 'FOLLOW', corners: k - 1, edge: null, speed: LAST, caption: 'Falta la última esquina: antes de girar, FOLLOW frena de 1,28 a 0,6 m/s para poder parar luego sobre la sección de Start.' });
    }
    ev.push({
      t: t0, sub: 'TURN', corners: k - 1, edge: 'turn', speed: k === CORNERS ? LAST : CRUISE,
      caption: k === CORNERS
        ? 'Esquina 12 (la última): la puerta abre, la meta gira 90° y arc_steer lleva el giro, más lento (0,6 m/s).'
        : `Esquina ${k}: la puerta abre (pared de enfrente cerca, isla terminada, distancia recorrida). La meta gira 90° y arc_steer lleva el giro.`,
    });
    const last = k === CORNERS;
    ev.push({
      t: t0 + 1.1, sub: last ? 'FINISH' : 'FOLLOW', corners: k, edge: last ? 'finish' : 'corner', speed: last ? CREEP : CRUISE,
      caption: last
        ? 'Esquina 12 hecha (tolerancia 0,4 rad en la última): con 12 esquinas contadas, RUN pasa a FINISH. Avanza a 0,15 m/s hasta que la pared de enfrente esté a menos de 0,08 m de la distancia que tenía en Start.'
        : `Esquina ${k} hecha: el rumbo está a menos de 0,12 rad de la meta. El contador sube a ${k} y vuelve FOLLOW.`,
    });
  }
  ev.push({ t: 33.9, sub: 'FINISH', code: 'BRAKE', corners: CORNERS, edge: null, speed: 0, caption: 'La pared de enfrente ya está a la distancia de Start: el freno se engancha (el ruido no puede arrancar el motor otra vez). Cuenta 0,9 s quieto.' });
  ev.push({ t: 34.8, sub: 'DONE', corners: CORNERS, edge: 'rest', speed: 0, caption: 'Pasaron 0,9 s: STOP con razón done, etiqueta DONE. La ronda de referencia dura unos 34,8 s desde Start en Gazebo (32,58 s en el laboratorio).' });
  return ev;
}

function faultRound(): Ev[] {
  return [
    ...setupEvents(),
    { t: 8, sub: 'DETECT_DIRECTION', corners: 0, edge: null, speed: 0, caption: 'La cámara no vota (no hay imágenes o las líneas no se distinguen). La misión sigue quieta: no apuesta por un lado.' },
    { t: 15.3, sub: 'DIRECTION_FAULT', corners: 0, edge: 'fault', speed: 0, caption: 'Pasaron 15 s en DETECT_DIRECTION sin sentido: STOP con razón direction_fault. Parar es mejor que adivinar.' },
  ];
}

function operatorRound(): Ev[] {
  const n = normalRound();
  const upto = n.findIndex((e) => e.sub === 'TURN' && e.corners === 4);
  return [
    ...n.slice(0, upto + 1),
    { t: n[upto].t + 0.5, sub: 'OPERATOR_STOP', corners: 4, edge: null, speed: 0, caption: 'El operador pulsa parar en mitad de la esquina 5: operator_stop() lleva a STOP desde cualquier estado. Velocidad 0 y la etiqueta es OPERATOR_STOP.' },
  ];
}

const SCENARIOS: Record<string, { label: string; build: () => Ev[] }> = {
  normal: { label: 'Una ronda normal (3 vueltas)', build: normalRound },
  fault: { label: 'La cámara no decide el sentido', build: faultRound },
  operator: { label: 'El operador para el coche', build: operatorRound },
};

// -------------------------------------------------------------------------------------- the diagram
const W = 370, H = 392;
const NODES: Record<Sub, { x: number; y: number; w: number }> = {
  WAIT_START: { x: 14, y: 36, w: 88 },
  CALIBRATE: { x: 116, y: 36, w: 88 },
  DETECT_DIRECTION: { x: 218, y: 36, w: 110 },
  FOLLOW: { x: 218, y: 150, w: 110 },
  TURN: { x: 14, y: 150, w: 100 },
  FINISH: { x: 110, y: 236, w: 110 },
  DONE: { x: 14, y: 336, w: 64 },
  DIRECTION_FAULT: { x: 90, y: 336, w: 120 },
  OPERATOR_STOP: { x: 222, y: 336, w: 106 },
};
const NODE_H = 28;
const BOXES: Record<Group, { x: number; y: number; w: number; h: number; title: string }> = {
  SETUP: { x: 6, y: 6, w: 330, h: 96, title: 'SETUP: quieto, el motor no se mueve' },
  RUN: { x: 6, y: 118, w: 330, h: 166, title: 'RUN: tres vueltas, 12 esquinas' },
  STOP: { x: 6, y: 312, w: 330, h: 72, title: 'STOP' },
};

/** An arrow head with its tip at (x, y) pointing towards `dir` degrees (0 = right, 90 = down). */
function head(x: number, y: number, dir: number): string {
  const a = (dir * Math.PI) / 180;
  const p = (da: number, len: number) => `${(x - len * Math.cos(a + da)).toFixed(1)},${(y - len * Math.sin(a + da)).toFixed(1)}`;
  return `<polygon points="${x},${y} ${p(0.45, 7)} ${p(-0.45, 7)}"/>`;
}

const EDGES: Record<EdgeId, { path: string; head: [number, number, number]; label: string; lx: number; ly: number; anchor?: string; rotate?: boolean }> = {
  start: { path: 'M 102 50 L 112 50', head: [116, 50, 0], label: 'Start', lx: 109, ly: 80, anchor: 'middle' },
  calibrated: { path: 'M 204 50 L 214 50', head: [218, 50, 0], label: '0,3 s', lx: 211, ly: 80, anchor: 'middle' },
  direction: { path: 'M 273 64 L 273 146', head: [273, 150, 90], label: 'sentido conocido', lx: 266, ly: 112, anchor: 'end' },
  turn: { path: 'M 218 158 L 122 158', head: [114, 158, 180], label: 'puerta: girar', lx: 166, ly: 150, anchor: 'middle' },
  corner: { path: 'M 114 174 L 210 174', head: [218, 174, 0], label: 'hecha: +1', lx: 166, ly: 190, anchor: 'middle' },
  finish: { path: 'M 64 180 L 64 251 L 102 251', head: [110, 251, 0], label: '12.ª hecha', lx: 70, ly: 226 },
  rest: { path: 'M 165 266 L 165 300 L 46 300 L 46 332', head: [46, 336, 90], label: '0,9 s quieto', lx: 56, ly: 294 },
  fault: { path: 'M 328 50 L 348 50 L 348 374 L 150 374 L 150 368', head: [150, 364, -90], label: '15 s sin sentido', lx: 361, ly: 200, rotate: true },
};

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let scenario = 'normal';
    let events = SCENARIOS[scenario].build();
    let pos = 0;
    let timer = 0;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'lw-svg', role: 'img' });
    const boxG: Record<string, SVGGElement> = {};
    const nodeG = {} as Record<Sub, SVGGElement>;
    const edgeG = {} as Record<EdgeId, SVGGElement>;

    for (const [g, b] of Object.entries(BOXES)) {
      const grp = svgEl('g', { class: 'lw-sm-box-g' });
      grp.innerHTML = `<rect class="lw-sm-box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="8"/><text class="lw-sm-title" x="${b.x + 8}" y="${b.y + 15}">${b.title}</text>`;
      svg.append(grp);
      boxG[g] = grp;
    }
    for (const [id, e] of Object.entries(EDGES) as [EdgeId, (typeof EDGES)[EdgeId]][]) {
      const grp = svgEl('g', { class: 'lw-sm-edge' });
      const t = e.rotate ? ` transform="rotate(-90 ${e.lx} ${e.ly})"` : '';
      grp.innerHTML = `<path d="${e.path}"/>${head(...e.head)}<text class="lw-sm-lbl" x="${e.lx}" y="${e.ly}"${e.anchor ? ` text-anchor="${e.anchor}"` : ''}${e.rotate ? ' text-anchor="middle"' : ''}${t}>${e.label}</text>`;
      svg.append(grp);
      edgeG[id] = grp;
    }
    for (const [name, n] of Object.entries(NODES) as [Sub, (typeof NODES)[Sub]][]) {
      const grp = svgEl('g', { class: 'lw-sm-node' });
      grp.innerHTML = `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${NODE_H}" rx="6"/><text x="${n.x + n.w / 2}" y="${n.y + 18}" text-anchor="middle">${name}</text>`;
      svg.append(grp);
      nodeG[name] = grp;
    }
    const any = svgEl('text', { class: 'lw-sm-lbl', x: 222, y: 327 });
    any.textContent = 'desde cualquier estado';
    svg.append(any);

    const dots = Array.from({ length: CORNERS }, (_, i) => h('span', { class: i % 4 === 3 && i < CORNERS - 1 ? 'lw-cell lw-cell-lapend' : 'lw-cell' }));
    const counter = h('span', { class: 'lw-meter-text' });
    const lapText = h('p', { class: 'lw-sm-lap' });
    const codeHead = h('p', { class: 'lw-code-head' });
    const codeText = h('code', {});
    const code = h('pre', { class: 'lw-code', tabindex: '0', 'aria-label': 'Líneas de mission.py que se ejecutan en este estado' }, codeText);
    const horizonOf = (list: Ev[]) => Math.max(10, Math.ceil(list[list.length - 1].t / 5) * 5);
    const makePlot = (list: Ev[]) => createPlot({ xmin: 0, xmax: horizonOf(list), xlabel: 's desde Start (orientativo)', ylabel: 'm/s pedidos', aria: 'Velocidad que pide la misión a lo largo de la ronda', digitsY: 1 });
    let plot = makePlot(events);
    const plotBox = h('div', { class: 'lw-figure lw-square' }, plot.svg);
    const caption = h('p', { class: 'lw-caption', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const facts = h('dl', { class: 'lw-readout-list' });

    const scrub = slider({
      label: 'Evento',
      min: 0,
      max: events.length - 1,
      step: 1,
      value: 0,
      format: (v) => `${fmt(v + 1, 0)} de ${events.length}`,
      onInput: (v) => {
        pause();
        pos = v;
        render();
      },
    });

    const bStep = button('Paso', () => {
      pause();
      if (pos < events.length - 1) pos++;
      render();
    }, 'lw-btn-primary');
    const bBack = button('Atrás', () => {
      pause();
      if (pos > 0) pos--;
      render();
    });
    const bPlay = button('Reproducir', () => (timer ? pause() : play()));
    const bReset = button('Reiniciar', () => {
      pause();
      pos = 0;
      render();
    });
    const bLast = button('Ir a la última esquina', () => {
      pause();
      const i = events.findIndex((e) => e.sub === 'TURN' && e.corners === CORNERS - 1);
      pos = Math.max(0, i - 1);
      render();
    });

    function pause(): void {
      window.clearTimeout(timer);
      timer = 0;
      bPlay.textContent = 'Reproducir';
    }
    function play(): void {
      if (pos >= events.length - 1) pos = 0;
      bPlay.textContent = 'Pausar';
      const tick = () => {
        render();
        if (pos < events.length - 1) {
          pos++;
          timer = window.setTimeout(tick, events[pos].sub === 'FOLLOW' || events[pos].sub === 'TURN' ? 900 : 1500);
        } else {
          pause();
        }
      };
      tick();
    }

    function render(): void {
      const ev = events[pos];
      const group = GROUP[ev.sub];
      (Object.keys(boxG) as Group[]).forEach((g) => boxG[g].classList.toggle('lw-sm-box-on', g === group));
      (Object.keys(nodeG) as Sub[]).forEach((n) => nodeG[n].classList.toggle('lw-sm-node-on', n === ev.sub));
      (Object.keys(edgeG) as EdgeId[]).forEach((id) => edgeG[id].classList.toggle('lw-sm-edge-on', id === ev.edge));
      dots.forEach((d, i) => d.classList.toggle('lw-cell-on', i < ev.corners));
      counter.textContent = `${ev.corners} de ${CORNERS}`;
      lapText.textContent = ev.corners >= CORNERS
        ? 'Las 3 vueltas están hechas (12 esquinas contadas).'
        : `Vuelta ${Math.floor(ev.corners / 4) + 1} de 3 · va por la esquina ${(ev.corners % 4) + 1} de 4 (cada vuelta tiene 4).`;
      const snippet = CODE[ev.code ?? ev.sub];
      codeHead.textContent = `Extracto de mission.py (sin comentarios), método ${snippet.fn}`;
      codeText.textContent = snippet.lines.join('\n');
      const horizon = horizonOf(events);
      const stepLine: [number, number][] = [];
      events.forEach((e, i) => {
        if (i > 0) stepLine.push([e.t, events[i - 1].speed]);
        stepLine.push([e.t, e.speed]);
      });
      stepLine.push([horizon, events[events.length - 1].speed]);
      plot.update({
        ymin: 0,
        ymax: 1.5,
        series: [{ points: stepLine, color: 'blue' }],
        hlines: [{ y: CRUISE, label: 'crucero 1,28', color: 'muted' }, { y: LAST, label: 'última esquina 0,6', color: 'muted' }],
        marker: { x: ev.t, y: ev.speed, color: 'amber' },
      });
      caption.textContent = ev.caption;
      scrub.set(pos);
      facts.replaceChildren(
        ...(
          [
            ['Estado', `${group} / ${ev.sub}`],
            ['Velocidad pedida', ev.speed === 0 ? 'parado' : `${fmt(ev.speed, 2)} m/s`],
            ['Tiempo desde Start (orientativo)', `${fmt(ev.t, 1)} s`],
          ] as [string, string][]
        ).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]),
      );
      svg.setAttribute('aria-label', `Diagrama de estados de la misión. Estado actual: ${group}, ${ev.sub}. ${ev.corners} de ${CORNERS} esquinas contadas.`);
      bStep.disabled = pos >= events.length - 1;
      bBack.disabled = pos <= 0;
      bLast.disabled = scenario !== 'normal';
    }

    function setScenario(name: string): void {
      pause();
      scenario = name;
      events = SCENARIOS[name].build();
      plot = makePlot(events);
      plotBox.replaceChildren(plot.svg);
      pos = 0;
      scrub.input.max = String(events.length - 1);
      render();
    }

    const pick = h('select', { id: nextId('lw-sel') }, ...Object.entries(SCENARIOS).map(([k, s]) => h('option', { value: k }, s.label)));
    pick.addEventListener('change', () => setScenario(pick.value));
    const field = h('div', { class: 'lw-field' }, h('label', { for: pick.id }, 'Qué pasa'), pick);

    root.append(
      h('div', { class: 'lw-figure lw-square' }, svg),
      h('div', { class: 'lw-meter-row' }, h('span', { class: 'lw-meter-title' }, 'Esquinas'), h('div', { class: 'lw-meter lw-meter-12', 'aria-hidden': 'true' }, ...dots), counter),
      lapText,
      caption,
      codeHead,
      code,
      plotBox,
      h('div', { class: 'lw-controls' }, field, scrub.root),
      h('div', { class: 'lw-actions' }, bBack, bStep, bPlay, bReset, bLast),
      facts,
      h(
        'p',
        { class: 'lw-note' },
        'Sigue las transiciones de MiniMission. Los tiempos son orientativos (la ronda de referencia dura 34,8 s en Gazebo; el laboratorio da 32,58 s); la lógica es la del código: SETUP calibra y espera el sentido, RUN alterna FOLLOW y TURN y pasa a FINISH con 12 esquinas, y STOP se alcanza con done, direction_fault u operator_stop.',
      ),
    );
    render();
  });
}
