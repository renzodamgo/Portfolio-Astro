// Interactive lessons of the Obstacle guide, steps 0 to 9 (Spanish text; code as in the course repository,
// solution tag obstacle-step-9). Each step's module starts as the course's solution with the step's pieces cut out
// (`gaps`); the 3D challenges run the course's whole strategy (strategy.py) with the student's modules inside, in the
// field of the rules (obstacle_runtime.py, a copy of the course's Obstacle lab).
import type { Lesson, LessonFile, Metrics, Task, World } from '../types';
import { LAYOUT_0_LOT, LAYOUT_3, LAYOUT_4 } from './obstacle-fields';
import { f, zone } from './worlds';

const G = '/learn/obstacle-strategy';
const MODULES: [string, number, string][] = [
  ['lane', 1, 'el carril y el progreso'], ['localizer', 2, 'ubicarse con los muros'], ['signs', 3, 'las señales'],
  ['plan', 4, 'la línea'], ['corner', 5, 'las esquinas'], ['follow', 6, 'seguir la línea'],
  ['mission', 7, 'la misión'], ['strategy', 7, 'la estrategia'], ['park', 8, 'aparcar'],
];

/** The package of step `step`: its own module (with gaps), drive.py, and the course's other modules read-only. */
function files(step: number, own: LessonFile[], drive = DRIVE): LessonFile[] {
  const mine = new Set(own.map((x) => x.name));
  const others = MODULES.filter(([m]) => !mine.has(`${m}.py`)).map(([m, s, what]): LessonFile => ({
    name: `${m}.py`, ref: m, readonly: true,
    note: s < step ? `Tu paso ${s}: ${what} (la solución del curso).` : s === step ? `Del paso ${s}: ${what} (la solución del curso).`
      : `Del paso ${s}: ${what}. Todavía no lo escribes: la estrategia lo necesita para correr.`,
  }));
  return [...own, { name: 'drive.py', starter: drive }, ...others];
}

const DRIVE = `"""El reto 3D: la estrategia del curso (strategy.py) con tus módulos dentro.

En el navegador no hay ROS: el simulador llama a make_strategy() y luego, como el nodo drive.py de Gazebo,
le pasa a la estrategia el LiDAR, el giroscopio y las señales que ve la cámara.
"""
from my_obstacle.strategy import Strategy

LAPS = 1        # vueltas antes de parar (la ronda del reglamento son 3)


def make_strategy(parking):
    params = {'stop_progress': 8 * LAPS + 0.7}     # 8 unidades de progreso por vuelta, y 0,7 para parar
    if parking:
        params['park_after'] = 8 * LAPS             # aparcar al terminar las vueltas
    return Strategy(parking=parking, params=params)
`;
const DRIVE_3 = DRIVE.replace('LAPS = 1 ', 'LAPS = 3 ');

const lapWorld = (signs = LAYOUT_4, direction: 'ccw' | 'cw' = 'ccw', speedup = 3): World =>
  ({ field: 'obstacle', signs, direction, view: 'top', speedup, trail: true });
const laps = (m: Metrics) => m.round?.laps ?? 0;

/** A 3D challenge: the strategy with the student's module drives `n` laps without touching anything and passing
 * every sign on its side (the runtime stops the attempt at the first wrong side). */
function lapTask(id: string, title: string, body: string, tests: { file: string; k?: string } | undefined,
  world: World = lapWorld(), n = 1, drive = DRIVE): Task {
  return {
    id, title, body, file: 'drive.py', files: { 'drive.py': drive },
    check: {
      kind: 'sim', world, tests,
      goal: {
        seconds: 60 + 50 * n, round: world.direction ?? 'ccw',
        done: (m) => laps(m) >= n && (m.status === 'STOP' || m.done),
        fail: (m) => (m.status === 'STOP' && laps(m) < n ? `La estrategia paró tras ${laps(m)} de ${n} vueltas.` : null),
        success: (m) => `${n === 1 ? 'Una vuelta' : `${n} vueltas`} sin tocar nada y con cada señal por su lado, en ${f(m.time, 1)} s.`,
      },
    },
  };
}

// ------------------------------------------------------------------------------------------------ step 0
const TEMPLATE_DRIVE = `def main():
    print('Hi from my_obstacle.')


if __name__ == '__main__':
    main()
`;

export const obstacle0: Lesson = {
  guide: 'obstacle-strategy', package: 'my_obstacle',
  step: 0, title: 'Preparar el paquete',
  summary: 'El entorno del Open sirve: pon el repositorio al día, abre el campo con señales, condúcelo y crea my_obstacle.',
  guideUrl: `${G}/paso-0-preparar/`,
  fresh: true,
  shellStart: { cloned: true },
  freeWorld: { field: 'obstacle', signs: LAYOUT_4, direction: 'ccw', view: 'chase', trail: false },
  files: [{ name: 'drive.py', starter: TEMPLATE_DRIVE }],
  tasks: [
    {
      id: 'pull',
      title: 'Pon el repositorio al día',
      body: `<p>Ya tienes el entorno del Open: el repositorio está clonado. Entra y trae lo último:</p>
<pre>cd robotek-learn
git pull</pre>`,
      check: { kind: 'command', match: (e, s) => s.cwd === 'robotek-learn' && e.argv[0] === 'git' && e.argv[1] === 'pull' && e.ok },
    },
    {
      id: 'build',
      title: 'Activa ROS y compila',
      body: `<p>Terminal nueva: activa ROS, compila y carga lo compilado (tres comandos que ya conoces del Open):</p>
<pre>source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash</pre>`,
      check: { kind: 'command', match: (e, s) => e.argv[0] === 'source' && s.built && s.wsSourced },
    },
    {
      id: 'launch',
      title: 'El campo del Obstacle',
      body: `<p>Abre el campo con las señales del reglamento (el campo 4):</p>
<pre>ros2 launch robotek_course obstacle_round.launch.py</pre>
<p>Rojas y verdes de 5 × 5 × 10 cm, en dos filas de cada recta.</p>`,
      check: { kind: 'command', match: (e) => e.argv[0] === 'ros2' && e.argv[1] === 'launch' && e.ok },
    },
    {
      id: 'rule',
      title: 'La regla de las señales',
      body: '<p>Antes de conducir, la regla que manda en todo el reto (reglamento 9.19), mirando en el sentido de la ronda.</p>',
      check: {
        kind: 'choice',
        question: 'Vas por la recta y tienes delante una señal ROJA. ¿Por dónde pasas?',
        options: ['Por la izquierda de la señal', 'Por la derecha de la señal: queda a la izquierda del coche', 'Por encima', 'Da igual si no la tocas'],
        answer: 1,
        why: 'Las rojas se pasan por la derecha y las verdes por la izquierda. Pasarla por el lado equivocado cuenta como falta.',
      },
    },
    {
      id: 'keyboard',
      title: 'Condúcelo tú',
      body: `<p>Conduce la recta de salida y la de la derecha hasta el <strong>círculo verde</strong>, sin tocar nada y pasando cada señal por su lado:</p>
<pre>ros2 run robotek_course keyboard_drive</pre>
<p><kbd>W</kbd> acelera, <kbd>S</kbd> frena, <kbd>A</kbd> y <kbd>D</kbd> giran. Haz clic en la vista 3D si no responde.</p>`,
      hint: 'En la recta de salida hay una roja (déjala a tu izquierda) y luego una verde (a tu derecha). En la recta de la derecha, una verde y una roja. Ve despacio.',
      check: {
        kind: 'keyboard',
        world: { field: 'obstacle', signs: LAYOUT_4, direction: 'ccw', view: 'chase', trail: true, marks: [zone(1.0, 1.05, 0.22)] },
        goal: { seconds: 150, done: (m) => Math.hypot(m.x - 1.0, m.y - 1.05) < 0.22, success: (m) => `¡Llegaste en ${f(m.time, 1)} s, con cada señal por su lado!` },
      },
    },
    {
      id: 'create',
      title: 'Crea my_obstacle',
      body: `<p>Tu estrategia del Obstacle va en un paquete nuevo, junto a <code>my_open</code>:</p>
<pre>cd src
ros2 pkg create --build-type ament_python my_obstacle --node-name drive
cd ..
colcon build --symlink-install --packages-select my_obstacle</pre>`,
      check: { kind: 'command', match: (e, s) => e.argv[0] === 'colcon' && e.ok && s.pkgBuilt },
    },
    {
      id: 'run',
      title: 'Ejecuta tu nodo',
      body: `<pre>source install/setup.bash
ros2 run my_obstacle drive</pre>
<p>Imprime <code>Hi from my_obstacle.</code>. En las lecciones siguientes escribirás los módulos de la estrategia.</p>`,
      check: { kind: 'command', match: (e) => e.argv.join(' ') === 'ros2 run my_obstacle drive' && e.ok },
    },
  ],
};

// ------------------------------------------------------------------------------------------------ step 1
const LANE_ROTATE = `    for _ in range(section // 2):
        x, y, heading = -y, x, heading + math.pi / 2
`;
const LANE_ADVANCE = `    section = int(progress) % 8
    scale = 1.0 if section % 2 == 0 else CORNER_UNITS
    return progress + metres / scale
`;
const LANE_UNWRAP = `    return previous + ((current - previous + 4.0) % 8.0 - 4.0)
`;

export const obstacle1: Lesson = {
  guide: 'obstacle-strategy', package: 'my_obstacle', packages: ['numpy'],
  step: 1, title: 'El campo y las reglas',
  summary: 'El carril (cuatro rectas y cuatro cuartos de círculo), el progreso de 8 unidades por vuelta y los asientos.',
  guideUrl: `${G}/paso-1-el-campo/`,
  files: files(1, [{
    name: 'lane.py', ref: 'lane', note: 'El carril del curso con tres huecos para ti (busca TODO).',
    gaps: [[LANE_ROTATE, '    pass   # TODO (tarea 1): gira el punto un cuarto de vuelta por cada recta que ya quedó atrás\n'],
      [LANE_ADVANCE, '    return progress   # TODO (tarea 2)\n'], [LANE_UNWRAP, '    return current   # TODO (tarea 3)\n']],
  }]),
  tasks: [
    {
      id: 'rotate',
      title: 'Las cuatro rectas son la misma',
      body: `<p><code>lane_pose(progress)</code> calcula el punto en la recta de abajo (y su esquina) y luego lo <strong>gira un cuarto de vuelta</strong> por cada recta que ya pasó: la de la derecha es la de abajo girada 90°.</p>
<p>Girar un punto 90° a la izquierda: <code>(x, y) → (−y, x)</code>, y el rumbo suma π/2. Hazlo <code>section // 2</code> veces.</p>`,
      file: 'lane.py',
      hint: 'for _ in range(section // 2):\n    x, y, heading = -y, x, heading + math.pi / 2',
      check: { kind: 'pytest', file: 'test_obstacle_step_1.py', k: 'starts_on_the_bottom or quarter_circle or closes or normal' },
    },
    {
      id: 'units',
      title: 'Unidades de progreso',
      body: '<p>Una vuelta son 8 unidades: 1 por recta y 1 por esquina.</p>',
      check: {
        kind: 'choice',
        question: 'En una recta una unidad es 1 m. ¿Cuánto mide una unidad en una esquina (un cuarto de círculo de 0,5 m de radio)?',
        options: ['1 m', '0,5 m', '0,785 m (π/4)', '1,57 m (π/2)'],
        answer: 2,
        why: 'Un cuarto de circunferencia de radio 0,5 m: 2π · 0,5 / 4 = π/4 ≈ 0,785 m.',
      },
    },
    {
      id: 'advance',
      title: 'Avanzar unos metros',
      body: `<p><code>advance(progress, metres)</code>: en una recta (sección par) un metro es una unidad; en una esquina, un metro es <code>1 / CORNER_UNITS</code> unidades.</p>`,
      file: 'lane.py',
      hint: 'section = int(progress) % 8\nscale = 1.0 if section % 2 == 0 else CORNER_UNITS\nreturn progress + metres / scale',
      check: { kind: 'pytest', file: 'test_obstacle_step_1.py', k: 'advance' },
    },
    {
      id: 'unwrap',
      title: 'Seguir contando vueltas',
      body: `<p><code>track_s</code> da un progreso entre 0 y 8. Para contar vueltas, <code>unwrap_s(previous, current)</code> mueve <code>current</code> vueltas enteras hasta quedar lo más cerca de <code>previous</code>:</p>
<pre>previous + ((current − previous + 4) mod 8 − 4)</pre>`,
      file: 'lane.py',
      hint: 'return previous + ((current - previous + 4.0) % 8.0 - 4.0)',
      check: { kind: 'pytest', file: 'test_obstacle_step_1.py' },
    },
    lapTask('lap-3d', 'Reto 3D: una vuelta con tu carril',
      '<p>La estrategia del curso usa tu <code>lane.py</code> para todo: dónde está el carril, el progreso, las señales. Si el carril está mal, el coche se pierde. Ejecuta y mira una vuelta entera en el campo 4.</p>',
      { file: 'test_obstacle_step_1.py' }),
  ],
};

// ------------------------------------------------------------------------------------------------ step 2
const SCAN_RETURN = `    return r[ok] * np.cos(a[ok]) + LIDAR_OFFSET_X, sign * r[ok] * np.sin(a[ok])
`;
const PREDICT = `        mid = self.th + 0.5 * wrap(heading - self.th)
        self.x += distance * math.cos(mid)
        self.y += distance * math.sin(mid)
        self.th = heading
`;

export const obstacle2: Lesson = {
  guide: 'obstacle-strategy', package: 'my_obstacle', packages: ['numpy'],
  step: 2, title: 'Ubicarse con los muros',
  summary: 'Los puntos del escaneo en el marco del coche, predecir con distancia y giroscopio, y el sentido con un solo escaneo.',
  guideUrl: `${G}/paso-2-ubicarse/`,
  files: files(2, [{
    name: 'localizer.py', ref: 'localizer', note: 'El localizador del curso con dos huecos para ti (busca TODO).',
    gaps: [[SCAN_RETURN, '    return r[ok] * 0.0, r[ok] * 0.0   # TODO (tarea 1)\n'], [PREDICT, '        pass   # TODO (tarea 2)\n']],
  }]),
  tasks: [
    {
      id: 'points',
      title: 'Los puntos del escaneo',
      body: `<p>Cada rayo válido es un punto en el marco del coche: <code>x = r·cos(a) + LIDAR_OFFSET_X</code> (el LiDAR está 12,8 cm delante del centro) e <code>y = r·sin(a)</code>.</p>
<p>En sentido horario todo se trabaja <strong>en espejo</strong>: multiplica la <code>y</code> por <code>sign</code> (−1 en horario).</p>`,
      file: 'localizer.py',
      hint: 'return r[ok] * np.cos(a[ok]) + LIDAR_OFFSET_X, sign * r[ok] * np.sin(a[ok])',
      check: { kind: 'pytest', file: 'test_obstacle_step_2.py', k: 'scan_points or direction_from_the_walls' },
    },
    {
      id: 'predict',
      title: 'Predecir',
      body: `<p>Entre escaneos el coche avanza a ciegas: <code>distance</code> metros (odometría del LiDAR) con el rumbo del giroscopio. Muévelo por el rumbo <strong>medio</strong> entre el viejo y el nuevo:</p>
<pre>mid = th + 0,5 · wrap(heading − th)
x += distance · cos(mid);  y += distance · sin(mid);  th = heading</pre>`,
      file: 'localizer.py',
      hint: 'mid = self.th + 0.5 * wrap(heading - self.th)\nself.x += distance * math.cos(mid)\nself.y += distance * math.sin(mid)\nself.th = heading',
      check: { kind: 'pytest', file: 'test_obstacle_step_2.py' },
    },
    {
      id: 'direction',
      title: 'El sentido con un escaneo',
      body: '<p>Al arrancar nadie le dice al coche el sentido de la ronda. <code>direction_from_scan</code> ajusta los muros con la isla a la izquierda y con la isla a la derecha.</p>',
      check: {
        kind: 'choice',
        question: '¿Por qué una sola hipótesis encaja claramente mejor que la otra?',
        options: ['Porque la cámara ve las líneas de colores', 'Porque la isla mide 1 m y el muro de fuera 3 m: los puntos solo caen sobre los muros en la buena', 'Porque el giroscopio ya giró', 'Por las señales rojas'],
        answer: 1,
        why: 'Con la hipótesis equivocada, la isla y el muro exterior quedan en lados cambiados y unos 20 % menos de puntos caen sobre un muro.',
      },
    },
    lapTask('cw-3d', 'Reto 3D: sentido horario',
      '<p>Ahora el coche sale mirando al oeste: ronda en <strong>sentido horario</strong>. Nadie se lo dice: lo decide el primer escaneo, y tu localizador (en espejo) lo ubica toda la vuelta. Campo 3.</p>',
      { file: 'test_obstacle_step_2.py' }, lapWorld(LAYOUT_3, 'cw')),
  ],
};

// ------------------------------------------------------------------------------------------------ step 3
const COLOUR_LOOP = `    for observation in observations:
        if math.hypot(observation['x'] - cluster['x'], observation['y'] - cluster['y']) < COLOUR_GATE:
            colour = observation.get('color')
            return colour if sign > 0 else SWAP.get(colour, colour)
    return None
`;

export const obstacle3: Lesson = {
  guide: 'obstacle-strategy', package: 'my_obstacle', packages: ['numpy'],
  step: 3, title: 'Ver las señales y recordarlas',
  summary: 'El LiDAR dice dónde está una señal y la cámara de qué color; una memoria por asiento las guarda toda la ronda.',
  guideUrl: `${G}/paso-3-ver-las-senales/`,
  files: files(3, [{
    name: 'signs.py', ref: 'signs', note: 'Las señales del curso con un hueco para ti (busca TODO).',
    gaps: [[COLOUR_LOOP, '    return None   # TODO (tarea 1): el color de la observación junto al clúster\n']],
  }]),
  tasks: [
    {
      id: 'colour',
      title: 'De qué color es',
      body: `<p>La cámara da observaciones <code>dict(x, y, color)</code> en el marco del coche. El color de un clúster del LiDAR es el de la observación que está a menos de <code>COLOUR_GATE</code> (12 cm) de él.</p>
<p>En horario el mundo va en espejo: una roja se pasa como si fuera verde. Devuelve <code>SWAP[colour]</code> cuando <code>sign</code> es −1.</p>`,
      file: 'signs.py',
      hint: "for observation in observations:\n    if math.hypot(observation['x'] - cluster['x'], observation['y'] - cluster['y']) < COLOUR_GATE:\n        colour = observation.get('color')\n        return colour if sign > 0 else SWAP.get(colour, colour)\nreturn None",
      check: { kind: 'pytest', file: 'test_obstacle_step_3.py' },
    },
    {
      id: 'memory',
      title: '¿Por qué una memoria?',
      body: '<p>La cámara ve solo 66,7°: una señal sale de la vista mucho antes de pasarla.</p>',
      check: {
        kind: 'choice',
        question: 'El reglamento dice que las señales no cambian durante la ronda. ¿Qué te permite eso?',
        options: ['Ir más rápido en las rectas', 'Recordar el color de cada asiento desde la vuelta 1 y no tener que volver a verlo', 'No usar el LiDAR', 'Saltarse la calibración'],
        answer: 1,
        why: 'Un color visto una vez, aunque sea una vuelta antes, sigue valiendo: la memoria por asiento lo guarda.',
      },
    },
    lapTask('lap-3d', 'Reto 3D: una vuelta viendo colores',
      '<p>Con tu <code>sign_colour</code> la estrategia sabe de qué lado pasar cada señal. Si devolviera siempre <code>None</code>, el coche tendría que pararse a mirar cada una. Ejecuta una vuelta en el campo 4.</p>',
      { file: 'test_obstacle_step_3.py' }),
  ],
};

// ------------------------------------------------------------------------------------------------ step 4
const SIDE = `    offset = lateral - clearance if colour == 'red' else lateral + clearance
    return clamp(offset, -OFFSET_LIMIT, OFFSET_LIMIT)
`;
const INTERP = `    for (s0, d0), (s1, d1) in zip(knots, knots[1:]):
        if progress <= s1:
            return d0 + (d1 - d0) * (progress - s0) / max(s1 - s0, 1e-9)
    return knots[-1][1]
`;

export const obstacle4: Lesson = {
  guide: 'obstacle-strategy', package: 'my_obstacle', packages: ['numpy'],
  step: 4, title: 'La línea: un lado por señal',
  summary: 'Un desplazamiento lateral por señal (roja por la derecha, verde por la izquierda), sostenido, con rampas entre ellas.',
  guideUrl: `${G}/paso-4-la-linea/`,
  files: files(4, [{
    name: 'plan.py', ref: 'plan', note: 'La línea del curso con dos huecos para ti (busca TODO).',
    gaps: [[SIDE, '    return 0.0   # TODO (tarea 1)\n'], [INTERP, '    return knots[0][1]   # TODO (tarea 2): interpola entre los nudos\n']],
  }]),
  tasks: [
    {
      id: 'side',
      title: 'Roja por la derecha, verde por la izquierda',
      body: `<p>El desplazamiento lateral es positivo hacia la isla (izquierda). Una señal está en la fila <code>lateral</code> (+0,1 o −0,1 m). Para pasarla por su lado con margen:</p>
<pre>roja:  lateral − clearance   (el coche queda a la derecha)
verde: lateral + clearance   (el coche queda a la izquierda)</pre>
<p>Y limítalo a <code>±OFFSET_LIMIT</code> con <code>clamp</code>.</p>`,
      file: 'plan.py',
      hint: "offset = lateral - clearance if colour == 'red' else lateral + clearance\nreturn clamp(offset, -OFFSET_LIMIT, OFFSET_LIMIT)",
      check: { kind: 'pytest', file: 'test_obstacle_step_4.py', k: 'red_on_the_right or unknown_colour' },
    },
    {
      id: 'interp',
      title: 'Rampas entre las señales',
      body: `<p>La línea son nudos <code>(progreso, desplazamiento)</code> ordenados. Entre dos nudos, una recta:</p>
<pre>d0 + (d1 − d0) · (progress − s0) / (s1 − s0)</pre>
<p>Recorre los pares de nudos seguidos y devuelve el del primer tramo que llega a <code>progress</code>; pasado el último, el último.</p>`,
      file: 'plan.py',
      hint: 'for (s0, d0), (s1, d1) in zip(knots, knots[1:]):\n    if progress <= s1:\n        return d0 + (d1 - d0) * (progress - s0) / max(s1 - s0, 1e-9)\nreturn knots[-1][1]',
      check: { kind: 'pytest', file: 'test_obstacle_step_4.py' },
    },
    lapTask('lap-3d', 'Reto 3D: cada señal por su lado',
      '<p>Tu <code>plan.py</code> decide de qué lado pasa el coche. Prueba primero a cambiar <code>\'red\'</code> por <code>\'green\'</code> en <code>side_offset</code>: el juez para el intento en la primera señal mal pasada. Luego déjalo bien y completa la vuelta.</p>',
      { file: 'test_obstacle_step_4.py' }),
  ],
};

// ------------------------------------------------------------------------------------------------ step 5
const MARGIN = `            margin = lateral - SIGN_HALF - high.max() if colour == 'red' else low.min() - lateral - SIGN_HALF
`;

export const obstacle5: Lesson = {
  guide: 'obstacle-strategy', package: 'my_obstacle', packages: ['numpy'],
  step: 5, title: 'Las esquinas: recta, arco, recta',
  summary: 'Cada esquina como recta, arco y recta, buscando la que deja más margen con las señales de los dos lados.',
  guideUrl: `${G}/paso-5-las-esquinas/`,
  files: files(5, [{
    name: 'corner.py', ref: 'corner', note: 'Las esquinas del curso con un hueco para ti (busca TODO).',
    gaps: [[MARGIN, '            margin = 1.0   # TODO (tarea 1): cuánto sobra (negativo: el lado equivocado)\n']],
  }]),
  tasks: [
    {
      id: 'shape',
      title: 'La forma de la esquina',
      body: '<p>Antes se giraba siguiendo el centro del carril y la esquina se comía las señales del final y del principio de las rectas.</p>',
      check: {
        kind: 'choice',
        question: '¿Qué tres números describen la línea de una esquina en este paso?',
        options: ['Velocidad, volante y tiempo', 'El desplazamiento antes (d_a), el de después (d_b) y el radio del arco (r)', 'La posición de las cuatro señales', 'El progreso de inicio y de fin'],
        answer: 1,
        why: 'Recta con d_a, un arco de radio r, recta con d_b. plan() prueba combinaciones y se queda con la de más margen.',
      },
    },
    {
      id: 'margin',
      title: 'El margen con el lado',
      body: `<p><code>clearance</code> mide lo más cerca que el contorno del coche pasa de todo. Para una señal con color, además, mira por dónde corta el contorno la línea de la señal: <code>low</code> y <code>high</code> son el punto más bajo y más alto de ese corte (lateral, + hacia la isla).</p>
<pre>roja:  lateral − SIGN_HALF − high.max()   (todo el coche por debajo: a la derecha)
verde: low.min() − lateral − SIGN_HALF     (todo el coche por encima: a la izquierda)</pre>
<p>Negativo quiere decir lado equivocado.</p>`,
      file: 'corner.py',
      hint: "margin = lateral - SIGN_HALF - high.max() if colour == 'red' else low.min() - lateral - SIGN_HALF",
      check: { kind: 'pytest', file: 'test_obstacle_step_5.py', k: 'wrong_side or passes_both' },
    },
    lapTask('lap-3d', 'Reto 3D: las cuatro esquinas',
      '<p>En el campo 4 hay señales al final y al principio de las rectas: justo donde la esquina no perdona. Con tu margen, <code>plan()</code> elige la línea de cada esquina. Una vuelta.</p>',
      { file: 'test_obstacle_step_5.py', k: 'wrong_side or passes_both or merge' }),
  ],
};

// ------------------------------------------------------------------------------------------------ step 6
const POINT = `    lx, ly, _ = lane.lane_pose(progress)
    nx, ny = lane.lane_normal(progress)
    d = offset(progress)
    return lx + d * nx, ly + d * ny
`;
const ANGLE = `    angle = (math.atan(WHEELBASE * kappa) - LATERAL_GAIN * error
             - kp * lane.wrap(th - heading) - kd * gyro)
`;

export const obstacle6: Lesson = {
  guide: 'obstacle-strategy', package: 'my_obstacle', packages: ['numpy'],
  step: 6, title: 'Seguir la línea',
  summary: 'Un volante que anticipa la curvatura y corrige la distancia y el rumbo respecto al punto de la línea que tiene al lado.',
  guideUrl: `${G}/paso-6-seguir-la-linea/`,
  files: files(6, [{
    name: 'follow.py', ref: 'follow', note: 'El seguidor del curso con dos huecos para ti (busca TODO).',
    gaps: [[POINT, '    return lane.lane_pose(progress)[:2]   # TODO (tarea 1): desplázalo por la normal\n'],
      [ANGLE, '    angle = math.atan(WHEELBASE * kappa)   # TODO (tarea 2): resta las tres correcciones\n']],
  }]),
  tasks: [
    {
      id: 'point',
      title: 'Un punto de la línea',
      body: `<p>La línea está <code>offset(progress)</code> metros a un lado del centro del carril, por la normal (hacia la isla):</p>
<pre>punto = lane_pose(s) + offset(s) · lane_normal(s)</pre>`,
      file: 'follow.py',
      hint: 'lx, ly, _ = lane.lane_pose(progress)\nnx, ny = lane.lane_normal(progress)\nd = offset(progress)\nreturn lx + d * nx, ly + d * ny',
      check: { kind: 'pytest', file: 'test_obstacle_step_6.py', k: 'reference_on_a_straight or reference_in_a_corner' },
    },
    {
      id: 'angle',
      title: 'El volante',
      body: `<p>Tres piezas: lo que pide la curva (anticipado 10 cm), menos la distancia a la línea, menos el error de rumbo, amortiguado con el giroscopio:</p>
<pre>atan(WHEELBASE · kappa) − LATERAL_GAIN · error − kp · wrap(th − heading) − kd · gyro</pre>`,
      file: 'follow.py',
      hint: 'angle = (math.atan(WHEELBASE * kappa) - LATERAL_GAIN * error\n         - kp * lane.wrap(th - heading) - kd * gyro)',
      check: { kind: 'pytest', file: 'test_obstacle_step_6.py' },
    },
    lapTask('lap-3d', 'Reto 3D: sobre la línea',
      '<p>Tu volante lleva el coche sobre la línea toda la vuelta. Prueba a poner <code>LATERAL_GAIN = 0</code>: el coche se va de la línea y acaba tocando algo. Luego déjalo en 6 y completa la vuelta.</p>',
      { file: 'test_obstacle_step_6.py', k: 'reference or feed_forward or left_of_the_line' }),
  ],
};

// ------------------------------------------------------------------------------------------------ step 7
const DISPATCH = `        if self.state == 'SETUP':
            return self._setup(dt, scan, new_scan, yaw, gyro)
        if self.state == 'STOP':
            return 0.0, 0.0, 'STOP'
        if self.state == 'PARK':
            return self._park(now, yaw, gyro, distance)
        return self._run(now, yaw, gyro, distance)
`;
const SPEED = `        speed = self.p.cruise_speed
        if offset or (self.pillar and self.pillar[1] - self.phi < 0.8):
            speed = min(speed, self.p.pillar_speed)
        if front < 0.7:
            speed = min(speed, 0.2)
        speed = min(speed, math.sqrt(max(0.0, 1.2 * max(remaining, 0.0))))
        if remaining < 1.2:
            speed = min(speed, self.p.finish_speed)
        if speed < 0.02:
            speed = 0.0
        return speed
`;

export const obstacle7: Lesson = {
  guide: 'obstacle-strategy', package: 'my_obstacle', packages: ['numpy'],
  step: 7, title: 'La misión: salir, mirar, tres vueltas',
  summary: 'Los estados de la misión y la velocidad; las tres vueltas del reglamento en 3D.',
  guideUrl: `${G}/paso-7-salir-y-mirar/`,
  files: files(7, [{
    name: 'mission.py', ref: 'mission', note: 'La misión del curso con dos huecos para ti (busca TODO).',
    gaps: [[DISPATCH, "        return 0.0, 0.0, self.state   # TODO (tarea 1): cada estado, su función\n"],
      [SPEED, '        return self.p.cruise_speed   # TODO (tarea 2)\n']],
  }], DRIVE_3),
  tasks: [
    {
      id: 'dispatch',
      title: 'Un estado, una función',
      body: `<p><code>step</code> reparte cada tick según el estado:</p>
<ul><li><code>SETUP</code> → <code>self._setup(dt, scan, new_scan, yaw, gyro)</code> (calibrar y elegir el sentido);</li>
<li><code>STOP</code> → <code>0.0, 0.0, 'STOP'</code>;</li>
<li><code>PARK</code> → <code>self._park(now, yaw, gyro, distance)</code>;</li>
<li>si no, <code>RUN</code>: <code>self._run(now, yaw, gyro, distance)</code>.</li></ul>`,
      file: 'mission.py',
      hint: "if self.state == 'SETUP':\n    return self._setup(dt, scan, new_scan, yaw, gyro)\nif self.state == 'STOP':\n    return 0.0, 0.0, 'STOP'\nif self.state == 'PARK':\n    return self._park(now, yaw, gyro, distance)\nreturn self._run(now, yaw, gyro, distance)",
      check: { kind: 'pytest', file: 'test_obstacle_step_7.py', k: 'setup_calibrates or stops_after' },
    },
    {
      id: 'speed',
      title: 'La velocidad',
      body: `<p><code>_speed</code> empieza en <code>cruise_speed</code> (0,35 m/s) y solo baja:</p>
<ul><li>a <code>pillar_speed</code> si hay desplazamiento o una señal a menos de 0,8 unidades;</li>
<li>a 0,2 m/s si la pared de enfrente está a menos de 0,7 m;</li>
<li>a <code>√(1,2 · remaining)</code> para frenar a tiempo, y a <code>finish_speed</code> en los últimos 1,2;</li>
<li>y a 0 por debajo de 0,02 m/s.</li></ul>
<p>Las pruebas de este paso corren rondas enteras en un campo pequeño: en el navegador pueden tardar medio minuto.</p>`,
      file: 'mission.py',
      hint: 'speed = self.p.cruise_speed\nif offset or (self.pillar and self.pillar[1] - self.phi < 0.8):\n    speed = min(speed, self.p.pillar_speed)\nif front < 0.7:\n    speed = min(speed, 0.2)\nspeed = min(speed, math.sqrt(max(0.0, 1.2 * max(remaining, 0.0))))\nif remaining < 1.2:\n    speed = min(speed, self.p.finish_speed)\nif speed < 0.02:\n    speed = 0.0\nreturn speed',
      check: { kind: 'pytest', file: 'test_obstacle_step_7.py' },
    },
    lapTask('round-3d', 'Reto 3D: la ronda de tres vueltas',
      '<p>La ronda del reglamento: tres vueltas en el campo 4 y parar en la sección de salida. Es la ronda que dio 40 puntos en Gazebo. Va a cuatro veces la velocidad real.</p>',
      { file: 'test_obstacle_step_7.py', k: 'setup_calibrates or stops_after' }, lapWorld(LAYOUT_4, 'ccw', 4), 3, DRIVE_3),
  ],
};

// ------------------------------------------------------------------------------------------------ step 8
const PARKED = `        return abs(wrap(th)) <= parallel and all(
            self.xa+inside <= px <= self.xb-inside and self.y0+inside <= py <= self.y1-inside
            for px, py in footprint(x, y, th))
`;
const MOVE = `    rx, ry = x+REAR_AXLE_X*math.cos(th), y+REAR_AXLE_X*math.sin(th)
    dth = ds*math.tan(steer)/WHEELBASE
    mid = th+dth/2
    rx, ry, th = rx+ds*math.cos(mid), ry+ds*math.sin(mid), th+dth
    return rx-REAR_AXLE_X*math.cos(th), ry-REAR_AXLE_X*math.sin(th), th
`;

export const obstacle8: Lesson = {
  guide: 'obstacle-strategy', package: 'my_obstacle', packages: ['numpy'],
  step: 8, title: 'Aparcar en paralelo',
  summary: 'Cuándo está aparcado, el modelo de bicicleta sobre el eje trasero y las maniobras de la búsqueda A*.',
  guideUrl: `${G}/paso-8-aparcar/`,
  files: files(8, [{
    name: 'park.py', ref: 'park', note: 'El aparcamiento del curso con dos huecos para ti (busca TODO).',
    gaps: [[PARKED, '        return False   # TODO (tarea 1)\n'], [MOVE, '    return x, y, th   # TODO (tarea 2)\n']],
  }]),
  tasks: [
    {
      id: 'parked',
      title: '¿Está aparcado?',
      body: `<p>Aparcado del todo y en paralelo: el rumbo a menos de <code>parallel</code> (3°) del muro y <strong>las cuatro esquinas</strong> del coche (<code>footprint(x, y, th)</code>) dentro del hueco, con <code>inside</code> de margen:</p>
<pre>xa + inside ≤ px ≤ xb − inside   y   y0 + inside ≤ py ≤ y1 − inside</pre>`,
      file: 'park.py',
      hint: 'return abs(wrap(th)) <= parallel and all(\n    self.xa+inside <= px <= self.xb-inside and self.y0+inside <= py <= self.y1-inside\n    for px, py in footprint(x, y, th))',
      check: { kind: 'pytest', file: 'test_obstacle_step_8.py', k: 'lot_of_the_rules or inside_and_parallel' },
    },
    {
      id: 'move',
      title: 'El coche gira sobre el eje trasero',
      body: `<p>La búsqueda prueba arcos cortos con <code>move(x, y, th, steer, ds)</code>. El modelo de bicicleta es exacto en el <strong>eje trasero</strong>, que está <code>REAR_AXLE_X</code> (negativo) del centro:</p>
<pre>eje = centro + REAR_AXLE_X·(cos th, sin th)
dth = ds · tan(steer) / WHEELBASE;  mid = th + dth/2
eje += ds·(cos mid, sin mid);  th += dth
centro = eje − REAR_AXLE_X·(cos th, sin th)</pre>`,
      file: 'park.py',
      hint: 'rx, ry = x+REAR_AXLE_X*math.cos(th), y+REAR_AXLE_X*math.sin(th)\ndth = ds*math.tan(steer)/WHEELBASE\nmid = th+dth/2\nrx, ry, th = rx+ds*math.cos(mid), ry+ds*math.sin(mid), th+dth\nreturn rx-REAR_AXLE_X*math.cos(th), ry-REAR_AXLE_X*math.sin(th), th',
      check: { kind: 'pytest', file: 'test_obstacle_step_8.py', k: 'not it_parks' },
    },
    {
      id: 'park-3d',
      title: 'Reto 3D: aparca',
      body: `<p>Campo 0 con el aparcamiento (los topes magenta, 35 cm). Una vuelta y a aparcar: el coche se acerca alineado, para, <strong>planifica</strong> las maniobras con la búsqueda A* (usa tu <code>move</code> y tu <code>parked</code>) y las ejecuta despacio.</p>
<p>Mientras planifica, el coche se queda quieto y abajo ves los segundos que lleva pensando. La búsqueda es la del curso: en tu ordenador tarda unos 20 s, pero <strong>en el navegador puede tardar dos minutos</strong>. Tocar un tope anula el aparcamiento.</p>`,
      file: 'drive.py',
      files: { 'drive.py': DRIVE },
      check: {
        kind: 'sim',
        tests: { file: 'test_obstacle_step_8.py', k: 'not it_parks' },
        world: { field: 'obstacle', signs: LAYOUT_0_LOT, direction: 'ccw', parking: true, view: 'top', speedup: 3, trail: true },
        goal: {
          seconds: 150, round: 'ccw',
          done: (m) => m.parked && m.still > 0.5,
          fail: (m) => (m.status === 'STOP' && !m.parked && m.still > 1 ? 'La estrategia terminó sin aparcar.' : null),
          success: (m) => `¡Aparcado del todo y en paralelo! (${f(m.time, 1)} s)`,
        },
      },
    },
  ],
};

// ------------------------------------------------------------------------------------------------ step 9
export const obstacle9: Lesson = {
  guide: 'obstacle-strategy', package: 'my_obstacle', packages: ['numpy'],
  step: 9, title: 'Puntuar y medir',
  summary: 'Los puntos del juez, cómo comparar versiones y la ronda completa en los dos sentidos.',
  guideUrl: `${G}/paso-9-medir-y-limites/`,
  files: files(10, [], DRIVE_3),
  tasks: [
    {
      id: 'points',
      title: '¿Cuántos puntos?',
      body: '<p>El juez del curso: 24 por secciones, 3 por vueltas, 3 por parar en la sección de salida, 10 por no mover ninguna señal y 15 por aparcar del todo y en paralelo.</p>',
      check: {
        kind: 'choice',
        question: 'Tres vueltas perfectas, para en la salida, no mueve ninguna señal y no aparca. ¿Cuántos puntos?',
        options: ['30', '40', '55', '62'],
        answer: 1,
        why: '24 + 3 + 3 + 10 = 40, los de la ronda de Gazebo del paso 9. Aparcando del todo, 55.',
      },
    },
    {
      id: 'compare',
      title: 'Comparar dos versiones',
      body: '<p>Una versión nueva cambia la velocidad en las rectas.</p>',
      check: {
        kind: 'choice',
        question: 'v1: 40 puntos en 116 s. v2: 37 puntos en 98 s. ¿Cuál se queda?',
        options: ['v2: es 18 s más rápida', 'v1: primero los puntos; el tiempo solo desempata', 'Ninguna', 'Depende del campo'],
        answer: 1,
        why: 'Primero los puntos, después el tiempo total desde Start. Y una sola ronda no basta: el laboratorio corre decenas de campos.',
      },
    },
    lapTask('ccw-3d', 'Reto 3D: tres vueltas antihorario', '<p>La estrategia completa en el campo 4, sentido antihorario, tres vueltas. Anota el tiempo.</p>',
      undefined, lapWorld(LAYOUT_4, 'ccw', 4), 3, DRIVE_3),
    lapTask('cw-3d', 'Reto 3D: tres vueltas horario', '<p>Y en el campo 3, sentido horario. Con los mismos puntos, gana el menor tiempo.</p>',
      undefined, lapWorld(LAYOUT_3, 'cw', 4), 3, DRIVE_3),
  ],
};

export const OBSTACLE_LESSONS = [obstacle0, obstacle1, obstacle2, obstacle3, obstacle4, obstacle5, obstacle6, obstacle7, obstacle8, obstacle9];
