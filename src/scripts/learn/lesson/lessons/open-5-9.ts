// Interactive lessons of the Open guide, steps 5 to 9 (Spanish text; code as in the course repository).
import type { Lesson, LessonFile, Metrics } from '../types';
import { FIELD_START, GREEN, f } from './worlds';

const G = '/learn/open-strategy';
const ref = (name: string, step: number): LessonFile => ({ name: `${name}.py`, ref: name, readonly: true, note: `Tu paso ${step} (la solución del curso).` });
const pointsOf = (m: Metrics) => m.round?.result?.points ?? 0;
const roundLine = (m: Metrics) => {
  const r = m.round?.result;
  return r ? `${r.points} de 30 puntos en ${f(r.time, 1)} s (vueltas: ${r.lapTimes.map((t, i) => f(t - (r.lapTimes[i - 1] ?? 0), 1)).join(' / ')} s).` : '';
};

// ------------------------------------------------------------------------------------------------ step 5
const ARC_STARTER = `"""Step 5 - The corner: full lock until the heading is close to the new goal, then a damped heading law finishes it."""
import math

from robotek_course.minisim import STEER_LIMIT, clamp, wrap
from .heading import KP

TURN_TOLERANCE = 0.3     # rad (17 deg): the full-lock part ends this short of the goal heading
DAMPING = 0.1            # steering (rad) taken off per rad/s the car is turning


def damped_steer(goal, yaw, gyro, damping=DAMPING):
    """The heading law of step 2 with a brake on the turning speed: the faster the car turns, the less it steers."""
    steer = KP * wrap(goal - yaw)      # TODO (tarea 1): réstale el freno
    return clamp(steer, -STEER_LIMIT, STEER_LIMIT)


def arc_steer(goal, yaw, gyro, turn_tolerance=TURN_TOLERANCE, damping=DAMPING):
    """One tick of a corner: returns (steering angle, whether the corner is done).

    Farther than \`\`turn_tolerance\`\` from the goal heading: the wheels at full lock towards it. Closer: the corner is done
    and the damped heading law takes the car the rest of the way.
    """
    error = wrap(goal - yaw)
    if True:                           # TODO (tarea 4): solo si falta más que turn_tolerance
        return 0.0, False              # TODO (tarea 2): el tope del volante, con el signo de error
    return damped_steer(goal, yaw, gyro, damping), True
`;

const CORNER_DRIVE = `"""Reto: la esquina sureste. Recta, giro de 90 grados a la izquierda con tu arc_steer, y recta al norte."""
import math

from robotek_course.minisim import wrap
from my_open.arc import arc_steer, damped_steer
from my_open.heading import GyroHeading
from my_open.lane import lateral_bias
from my_open.perception import perceive

SPEED = 1.0           # m/s pedidos: la velocidad de esquina (el coche real llega a 0,53)
TURN_FRONT = 1.19     # m: la esquina empieza con la pared de enfrente a esta distancia
heading = GyroHeading()
samples = []
scene = None
last_scan = None
goal = 0.0
arc = done = False
status = ''


def drive(s):
    global scene, last_scan, goal, arc, done, status
    if s.time < 0.6:
        samples.append(s.gyro)
        return 0.0, 0.0
    if samples:
        heading.calibrate(samples)
        samples.clear()
    if s.scan is not last_scan:
        last_scan = s.scan
        scene = perceive(s.scan, forward_yaw=wrap(goal - heading.yaw))
    yaw = heading.update(s.gyro, s.dt)
    gyro = s.gyro - heading.bias
    if not arc and not done and scene.front_axis <= TURN_FRONT:
        goal, arc, status = math.pi / 2, True, 'TURN'          # empieza la esquina
    if arc:
        steer, finished = arc_steer(goal, yaw, gyro)
        if finished:                                            # tu arc_steer avisa: soltó el tope
            arc, done, status = False, True, 'FOLLOW'
        return SPEED, steer
    inner = scene.left if math.isfinite(scene.left) and scene.left < 1.0 else 0.25
    return SPEED, damped_steer(goal + lateral_bias(inner), yaw, gyro)   # la ley con freno, también en la recta
`;

export const step5: Lesson = {
  step: 5,
  title: 'La esquina',
  summary: 'Girar 90° con el volante a tope, soltarlo 17° antes de la meta y terminar con la ley de rumbo con freno.',
  guideUrl: `${G}/paso-5-la-esquina/`,
  packages: ['numpy'],
  files: [
    { name: 'arc.py', starter: ARC_STARTER },
    { name: 'drive.py', starter: CORNER_DRIVE },
    ref('lane', 4), ref('perception', 3), ref('heading', 2), ref('model', 1),
  ],
  tasks: [
    {
      id: 'damped',
      title: 'La ley de rumbo con freno',
      body: `<p>Es la ley del paso 2 con un término más: cuanto más rápido gira ya el coche, menos volante pide. Así no llega a la meta girando a toda velocidad.</p>
<pre>steer = KP · wrap(goal − yaw) − damping · gyro</pre>
<p><code>gyro</code> es la velocidad de giro medida (rad/s), positiva si el coche gira a la izquierda. Completa <code>damped_steer</code>.</p>`,
      file: 'arc.py',
      hint: 'steer = KP * wrap(goal - yaw) - damping * gyro',
      check: { kind: 'pytest', file: 'test_step_5.py', k: 'damping_takes' },
    },
    {
      id: 'lock',
      title: 'A tope hacia la meta',
      body: `<p>Girar a la izquierda es sumar π/2 a la meta. Con 90° de error la ley de rumbo pide mucho más volante del que hay, así que en la esquina el volante va <strong>a tope</strong>, hacia el lado de la meta.</p>
<pre>math.copysign(STEER_LIMIT, error)</pre>
<p>Da el tope con el signo de <code>error</code>. Ponlo en <code>arc_steer</code> en lugar del <code>0.0</code>. Por ahora la esquina no termina nunca.</p>`,
      file: 'arc.py',
      hint: 'return math.copysign(STEER_LIMIT, error), False',
      check: { kind: 'pytest', file: 'test_step_5.py', k: 'far_from or short_way' },
    },
    {
      id: 'release-question',
      title: '¿Cuándo soltar el volante?',
      body: '<p>El servo tarda unas tres décimas de segundo en enderezar las ruedas desde el tope. En ese tiempo el coche sigue girando.</p>',
      check: {
        kind: 'choice',
        question: 'Si sueltas el tope cuando faltan solo 3° para la meta, ¿qué pasa?',
        options: ['El coche queda justo en la meta', 'El coche se pasa unos 12°: las ruedas quedan rectas tarde', 'El coche no llega a la meta', 'El giroscopio pierde la cuenta'],
        answer: 1,
        why: 'Mientras el servo endereza, el coche sigue girando. Soltando a 3° se pasa 12°; soltando a 17° (0,3 rad) llega justo.',
      },
    },
    {
      id: 'release',
      title: 'Soltar a tiempo',
      body: `<p>El tope se suelta <strong>antes</strong> de llegar: cuando faltan <code>turn_tolerance</code> radianes o menos, la esquina terminó y el volante lo decide tu ley con freno.</p>
<pre>si |error| &gt; turn_tolerance: a tope, no terminada
si no: damped_steer(...), terminada</pre>
<p>Cambia el <code>if True</code> de <code>arc_steer</code> por esa condición.</p>`,
      file: 'arc.py',
      hint: 'if abs(error) > turn_tolerance:',
      solution: `    error = wrap(goal - yaw)
    if abs(error) > turn_tolerance:
        return math.copysign(STEER_LIMIT, error), False
    return damped_steer(goal, yaw, gyro, damping), True`,
      check: { kind: 'pytest', file: 'test_step_5.py' },
    },
    {
      id: 'corner-3d',
      title: 'Reto 3D: la esquina sureste',
      body: `<p>Tu <code>arc_steer</code> en el campo: el coche sigue la isla, gira 90° a la izquierda en la esquina y sube por la recta del este.</p>
<p>Pasa si tu <code>arc_steer</code> da la esquina por terminada y el coche llega a la mitad de la recta sin chocar.</p>`,
      file: 'drive.py',
      files: { 'drive.py': CORNER_DRIVE },
      check: {
        kind: 'sim',
        tests: { file: 'test_step_5.py', k: 'far_from or left_corner' },
        world: { field: 'field', start: [-0.6, -0.75, 0], view: 'chase', marks: [{ x: 0.75, y: 0.3, r: 0.12, color: GREEN }] },
        goal: {
          seconds: 9,
          done: (m) => m.status === 'FOLLOW' && m.y > 0.3,
          success: (m) => `Esquina en ${f(m.time, 1)} s, sin chocar.`,
        },
      },
    },
  ],
};

// ------------------------------------------------------------------------------------------------ step 6
const GATE_STARTER = `"""Step 6 - When to turn: three conditions at once, and the distance driven without an encoder."""
import math

TURN_FRONT = 1.19        # m: the wall ahead (along the track) must be this near
LOOKAHEAD = 0.35         # m: the island's end must be this near (when it is visible)
END_CLEARANCE = 0.08     # m: in a narrow lane the look-ahead shrinks to (distance to the island - this)
CONFIRMATIONS = 2        # consecutive scans that must see the island's end close
ARM_DISTANCE = 0.25      # m driven after a corner before the next one may start
ISLAND_OPEN = 1.0        # m: an island wall farther than this beside the car means the island has ended


class StraightDistance:
    """Metres driven on this straight, with no encoder: how much nearer the wall ahead is than when it began."""

    def __init__(self):
        self.start = None        # the wall ahead when the straight began (m)
        self.travelled = 0.0

    def update(self, front_axis):
        """Feed the wall ahead of the latest scan (not during a corner). Returns the metres driven so far."""
        if math.isfinite(front_axis):
            if self.start is None:
                self.start = front_axis
            self.travelled = 0.0   # TODO (tarea 3): lo que se acercó la pared de enfrente, sin bajar nunca
        return self.travelled

    def reset(self):
        """Call it when a corner ends: the next straight starts from zero."""
        self.start, self.travelled = None, 0.0


class TurnGate:
    """Decides, every tick, whether the car should start a corner (see the guide, step 6)."""

    def __init__(self, turn_front=TURN_FRONT, lookahead=LOOKAHEAD):
        self.turn_front, self.lookahead = turn_front, lookahead
        self.hits = 0
        self._scene = None

    def update(self, scene, inner, travelled, arc):
        """Returns True when the corner should start now."""
        if scene is not self._scene:                 # one count per scan, however often the tick repeats
            self._scene = scene
            limit = min(self.lookahead, max(0.0, inner - END_CLEARANCE)) if math.isfinite(inner) else self.lookahead
            self.hits = 0   # TODO (tarea 1): +1 si 0 <= scene.island_end <= limit, si no vuelve a 0
        island_open = math.isfinite(inner) and inner > ISLAND_OPEN
        return False   # TODO (tarea 2): las tres condiciones a la vez
`;

const LAP_DRIVE = `"""Reto: una vuelta entera. La recta (paso 4), la esquina (paso 5) y tu TurnGate decidiendo cuándo."""
import math

from robotek_course.minisim import wrap
from my_open.arc import arc_steer, damped_steer
from my_open.heading import GyroHeading
from my_open.lane import GAP, lateral_bias
from my_open.perception import perceive
from my_open.turn_gate import ISLAND_OPEN, StraightDistance, TurnGate

SPEED = 1.0           # m/s pedidos: la velocidad de esquina, en toda la vuelta
heading = GyroHeading()
gate = TurnGate()
straight = StraightDistance()
samples = []
scene = None
last_scan = None
goal = 0.0
arc = False
status = ''


def drive(s):
    global scene, last_scan, goal, arc, status
    if s.time < 0.6:
        samples.append(s.gyro)
        return 0.0, 0.0
    if samples:
        heading.calibrate(samples)
        samples.clear()
    if s.scan is not last_scan:
        last_scan = s.scan
        scene = perceive(s.scan, forward_yaw=wrap(goal - heading.yaw), sign=1)
    yaw = heading.update(s.gyro, s.dt)
    gyro = s.gyro - heading.bias
    if not arc:
        straight.update(scene.front_axis)               # metros de esta recta: lo que se acercó la pared de enfrente
    inner = scene.left                                  # la isla, a la izquierda
    if gate.update(scene, inner, straight.travelled, arc):   # ¿toca girar?
        goal = wrap(goal + math.pi / 2)
        arc = True
    if arc:
        status = 'TURN'
        steer, finished = arc_steer(goal, yaw, gyro)
        if finished:                                    # la esquina terminó: la recta siguiente empieza de cero
            arc = False
            straight.reset()
        return SPEED, steer
    status = 'FOLLOW'
    island_open = math.isfinite(inner) and inner > ISLAND_OPEN
    keep = GAP if (not math.isfinite(inner) or island_open) else inner
    return SPEED, damped_steer(goal + lateral_bias(keep, 1), yaw, gyro)
`;

export const step6: Lesson = {
  step: 6,
  title: 'Cuándo girar',
  summary: 'La puerta de las esquinas: haber avanzado, la pared cerca y la isla terminada. Y la distancia recorrida sin encoder.',
  guideUrl: `${G}/paso-6-cuando-girar/`,
  packages: ['numpy'],
  files: [
    { name: 'turn_gate.py', starter: GATE_STARTER },
    { name: 'drive.py', starter: LAP_DRIVE },
    ref('arc', 5), ref('lane', 4), ref('perception', 3), ref('heading', 2), ref('model', 1),
  ],
  tasks: [
    {
      id: 'hits',
      title: 'Cuenta los avistamientos',
      body: `<p>El fin de la isla se cree cuando se ve cerca en <strong>dos escaneos seguidos</strong>. Cada escaneo nuevo: si <code>0 ≤ scene.island_end ≤ limit</code>, suma 1 a <code>self.hits</code>; si no, vuelve a 0.</p>`,
      file: 'turn_gate.py',
      hint: 'self.hits = self.hits + 1 if 0.0 <= scene.island_end <= limit else 0',
      check: {
        kind: 'python',
        code: `from robotek_course.minisim import Scene
from my_open.turn_gate import TurnGate

def scan(end):
    return Scene(left=0.3, right=0.8, front_axis=1.0, island_end=end)

gate = TurnGate()
first = scan(0.2)
gate.update(first, 0.3, 1.0, False)
assert gate.hits == 1, f'Tras un escaneo con el fin de la isla a 0,2 m, hits = {gate.hits} (debería ser 1)'
gate.update(first, 0.3, 1.0, False)
assert gate.hits == 1, 'El MISMO escaneo repetido no debe contar dos veces'
gate.update(scan(0.2), 0.3, 1.0, False)
assert gate.hits == 2, f'Dos escaneos seguidos: hits = {gate.hits} (debería ser 2)'
gate.update(scan(float('inf')), 0.3, 1.0, False)
assert gate.hits == 0, 'Un escaneo sin ver el fin de la isla vuelve hits a 0'
print('hits: bien')
`,
      },
    },
    {
      id: 'conditions',
      title: 'Las tres condiciones a la vez',
      body: `<p>La esquina toca cuando <strong>todo</strong> esto se cumple:</p>
<ul><li>no hay una esquina en curso (<code>not arc</code>) y recorriste al menos <code>ARM_DISTANCE</code> desde la anterior (<code>travelled</code>);</li>
<li>la pared de enfrente está cerca: <code>scene.front_axis &lt;= self.turn_front</code>;</li>
<li>la isla terminó: <code>island_open</code> o <code>self.hits &gt;= CONFIRMATIONS</code>.</li></ul>
<p>Escribe el <code>return</code> de <code>update</code>.</p>`,
      file: 'turn_gate.py',
      hint: 'return (not arc and travelled >= ARM_DISTANCE\n        and scene.front_axis <= self.turn_front\n        and (island_open or self.hits >= CONFIRMATIONS))',
      check: { kind: 'pytest', file: 'test_step_6.py', k: 'not distance and not reading' },
    },
    {
      id: 'distance',
      title: 'La distancia recorrida, sin encoder',
      body: `<p>La puerta necesita <code>travelled</code>: los metros de esta recta. El coche no tiene encoder, pero en una recta <strong>lo que avanza el coche es lo que se acerca la pared de enfrente</strong>. Si al empezar estaba a 2,40 m y ahora está a 2,10 m, avanzó 0,30 m.</p>
<pre>travelled = max(travelled, start − front_axis)</pre>
<p>El <code>max</code> hace que la distancia nunca baje: el ruido del LiDAR puede dar una lectura 3 cm más lejos, y el coche no fue marcha atrás. Completa <code>StraightDistance.update</code>.</p>`,
      file: 'turn_gate.py',
      hint: 'self.travelled = max(self.travelled, self.start - front_axis)',
      check: { kind: 'pytest', file: 'test_step_6.py' },
    },
    {
      id: 'lap-3d',
      title: 'Reto 3D: una vuelta',
      body: `<p>Con tu puerta decidiendo y tu <code>StraightDistance</code> contando los metros, el coche da una vuelta entera a la isla en sentido antihorario. Pasa al completar las 8 secciones de una vuelta sin chocar.</p>`,
      file: 'drive.py',
      files: { 'drive.py': LAP_DRIVE },
      check: {
        kind: 'sim',
        world: { field: 'field', start: FIELD_START, speedup: 2, view: 'top' },
        goal: {
          seconds: 25, round: 'ccw',
          done: (m) => (m.round?.laps ?? 0) >= 1,
          success: (m) => `Vuelta completa en ${f((m.round?.lapTimes[0] ?? m.time), 1)} s.`,
        },
      },
    },
  ],
};

// ------------------------------------------------------------------------------------------------ step 7
const MISSION_DRIVE = (direction: string, vote: boolean) => `"""La ronda completa: tu MiniMission con los sensores del coche${vote ? ' y el voto de la cámara (paso 8)' : ''}."""
from robotek_course.minisim import Scene
from my_open.mission import MiniMission
from my_open.perception import perceive
${vote ? 'from my_open.direction import DirectionVote\n' : ''}
DIRECTION = '${direction}'   # 'ccw', 'cw' o 'auto' (la cámara decide)
mission = None
${vote ? 'vote = None\n' : ''}scene = Scene()
last_scan = None
status = ''


def start():
    global mission${vote ? ', vote' : ''}
    mission = MiniMission(DIRECTION)
${vote ? '    vote = DirectionVote()\n' : ''}    mission.request_start()            # el botón de Start


def drive(s):
    global scene, last_scan, status
    if s.scan is not last_scan:        # un escaneo nuevo: una Scene nueva
        last_scan = s.scan
        sign = -1 if mission.direction == 'cw' else 1
        scene = perceive(s.scan, mission.forward_yaw, sign)
${vote ? '    camera = vote.update(*s.camera)      # (azul, naranja) en píxeles -> +1, -1 o 0\n' : '    camera = 0\n'}    speed, steer = mission.step(s.dt, scene, s.gyro, camera)
    status = mission.label
    return speed, steer
`;

// Exact pieces of the reference mission.py (public/learn/py/ref/mission.py): the gaps the student fills.
const MISSION_REF_CORNER = `        if self.gate.update(scene, inner, self.straight.travelled, self.arc):
            self.goal = wrap(self.goal + sign * math.pi / 2)
            self.arc = True
`;
const MISSION_REF_DONE = `            if done:                                         # the straight-line law finishes the turn
                self.arc = False
                self.straight.reset()
                self.completed += 1
`;
const MISSION_REF_BRAKE = `        return min(CRUISE_SPEED, CORNER_SPEED + BRAKE_GAIN * max(0.0, gap))
`;
const MISSION_REF_WALL = `        difference = wrap(scene.wall_heading - wrap(self.yaw - self.goal))
        if abs(difference) <= WALL_HEADING_MAX:
            self.heading.yaw += WALL_HEADING_GAIN * difference
`;

export const step7: Lesson = {
  step: 7,
  title: 'La misión',
  summary: 'SETUP, RUN y STOP: las piezas de los pasos 2 a 6 juntas en tres vueltas que terminan paradas.',
  guideUrl: `${G}/paso-7-la-mision/`,
  packages: ['numpy'],
  files: [
    {
      name: 'mission.py', ref: 'mission', note: 'La misión del curso con cuatro huecos para ti (busca TODO).',
      gaps: [
        [MISSION_REF_CORNER, '        pass   # TODO (tarea 1): si la puerta dice que toca, empieza la esquina\n'],
        [MISSION_REF_DONE, '            pass   # TODO (tarea 2): si done, termina la esquina\n'],
        [MISSION_REF_BRAKE, '        return CRUISE_SPEED   # TODO (tarea 3): más lento cuanto menos falte para la esquina\n'],
        [MISSION_REF_WALL, '        pass   # TODO (tarea 4): corrige self.heading.yaw con la pared de la isla\n'],
      ],
    },
    { name: 'drive.py', starter: MISSION_DRIVE('ccw', false) },
    ref('turn_gate', 6), ref('arc', 5), ref('lane', 4), ref('perception', 3), ref('heading', 2), ref('model', 1),
  ],
  tasks: [
    {
      id: 'trigger',
      title: 'Empieza las esquinas',
      body: `<p>En <code>_run</code>, cuando la puerta del paso 6 dice que toca, la esquina empieza: la meta gira un cuarto de vuelta en el sentido de la ronda y se activa <code>arc</code>. Los metros de la recta salen de <code>self.straight</code>, tu <code>StraightDistance</code>.</p>
<pre>si self.gate.update(scene, inner, self.straight.travelled, self.arc):
    goal = wrap(goal + sign · π/2); arc = True</pre>`,
      file: 'mission.py',
      solution: MISSION_REF_CORNER,
      check: { kind: 'pytest', file: 'test_step_7.py', k: 'corner_starts or other_way' },
    },
    {
      id: 'done',
      title: 'Termina las esquinas',
      body: `<p>Durante la esquina manda <code>arc_steer</code> (paso 5), a la velocidad de esquina. Cuando avisa con <code>done</code>, la esquina terminó: apaga <code>arc</code>, llama a <code>self.straight.reset()</code> (la recta siguiente empieza de cero) y suma una a <code>completed</code>.</p>
<p>Tras 12 esquinas, la misión vuelve despacio a la sección de salida y para.</p>`,
      file: 'mission.py',
      solution: MISSION_REF_DONE,
      check: { kind: 'pytest', file: 'test_step_7.py', k: 'corner_starts or other_way or full_lock or drive_again' },
    },
    {
      id: 'brake',
      title: 'Frena antes de cada esquina',
      body: `<p>El coche debe llegar a la esquina a <code>CORNER_SPEED</code>, no a la de crucero: suelta el acelerador antes de la curva, no en medio. En <code>_straight_speed</code>, <code>gap</code> son los metros que faltan para que la esquina pueda empezar (menos un margen).</p>
<pre>velocidad = CORNER_SPEED + BRAKE_GAIN · max(0, gap), pero nunca más que CRUISE_SPEED</pre>`,
      file: 'mission.py',
      hint: 'Usa min para el tope de crucero y max para que gap no reste.',
      solution: MISSION_REF_BRAKE,
      check: { kind: 'pytest', file: 'test_step_7.py', k: 'slows_down' },
    },
    {
      id: 'wall-heading',
      title: 'La pared de la isla corrige al giroscopio',
      body: `<p>El giroscopio se queda corto esquina tras esquina. En cada recta, <code>scene.wall_heading</code> (paso 3) dice cuánto está girado el coche según la pared. <code>wrap(self.yaw − self.goal)</code> es cuánto cree el giroscopio.</p>
<pre>difference = wrap(wall_heading − wrap(yaw − goal))
si |difference| ≤ WALL_HEADING_MAX: heading.yaw += WALL_HEADING_GAIN · difference</pre>
<p>Una diferencia mayor es un mal ajuste de la recta, no deriva: no se corrige. Completa <code>_correct_heading</code>.</p>`,
      file: 'mission.py',
      solution: MISSION_REF_WALL,
      check: { kind: 'pytest', file: 'test_step_7.py' },
    },
    {
      id: 'round-3d',
      title: 'Reto 3D: la ronda',
      body: `<p>¡La ronda completa! Tres vueltas antihorarias y parar en la sección de salida. El juez cuenta secciones, vueltas y el bonus de parar (30 puntos como máximo).</p>
<p>Va a triple velocidad para no esperar tanto.</p>`,
      file: 'drive.py',
      files: { 'drive.py': MISSION_DRIVE('ccw', false) },
      check: {
        kind: 'sim',
        world: { field: 'field', start: FIELD_START, speedup: 3, view: 'top' },
        goal: {
          seconds: 50, round: 'ccw',
          done: (m) => pointsOf(m) >= 30,
          fail: (m) => (m.round?.finished && pointsOf(m) < 30 ? `La ronda terminó con ${pointsOf(m)} puntos.` : null),
          success: roundLine,
        },
      },
    },
  ],
};

// ------------------------------------------------------------------------------------------------ step 8
const DIRECTION_STARTER = `"""Step 8 - The direction of the lap: which coloured line is longer, confirmed over several frames."""

MIN_LENGTH = 40.0        # px: shorter lines are noise
MIN_CONFIDENCE = 0.25    # how much longer one line must be than the other: |blue - orange| / the longest
CONFIRMATIONS = 5        # consecutive frames that must agree


class DirectionVote:
    """Blue longer -> +1 (counter-clockwise lap); orange longer -> -1 (clockwise); unsure -> 0."""

    def __init__(self):
        self.candidate = 0       # what the last frame voted for (0: nothing clear)
        self.hits = 0            # consecutive frames that voted for it
        self.direction = 0

    def update(self, blue_length, orange_length):
        """Feed one frame's two line lengths (pixels). Returns the decision so far: +1, -1 or 0."""
        longest = max(blue_length, orange_length)
        confidence = abs(blue_length - orange_length) / max(longest, 1.0)
        vote = 0   # TODO (tarea 1): el voto de este fotograma
        # TODO (tarea 2): cuenta los fotogramas seguidos que votan lo mismo y decide con CONFIRMATIONS
        return self.direction
`;

export const step8: Lesson = {
  step: 8,
  title: 'La dirección',
  summary: 'La cámara decide el sentido: la línea más larga, confirmada en cinco fotogramas seguidos.',
  guideUrl: `${G}/paso-8-la-direccion/`,
  packages: ['numpy'],
  files: [
    { name: 'direction.py', starter: DIRECTION_STARTER },
    { name: 'drive.py', starter: MISSION_DRIVE('auto', true) },
    ref('mission', 7), ref('turn_gate', 6), ref('arc', 5), ref('lane', 4), ref('perception', 3), ref('heading', 2), ref('model', 1),
  ],
  tasks: [
    {
      id: 'vote',
      title: 'El voto de un fotograma',
      body: `<p>Un fotograma vota solo si la línea más larga mide al menos <code>MIN_LENGTH</code> (40) píxeles y la diferencia es clara: <code>confidence = |azul − naranja| / la más larga</code> debe ser al menos <code>MIN_CONFIDENCE</code> (0,25). Entonces: azul más larga → +1 (antihorario), naranja → −1 (horario).</p>`,
      file: 'direction.py',
      check: {
        kind: 'choice',
        question: 'Un fotograma ve azul = 200 px y naranja = 170 px. ¿Qué vota?',
        options: ['+1: el azul es más largo', '−1', '0: la diferencia es poca (0,15 < 0,25)', '0: las líneas son cortas'],
        answer: 2,
        why: 'confidence = 30 / 200 = 0,15, menos que 0,25: el fotograma no está seguro y no vota.',
      },
    },
    {
      id: 'confirm',
      title: 'Cinco seguidos',
      body: `<p>Escribe el voto del fotograma (<code>vote</code>, como en la pregunta). Y como un fotograma suelto puede mentir, cuenta cuántos seguidos votan lo mismo:</p>
<pre>hits = hits + 1 si vote y vote == candidate, si no (1 si vote, si no 0)
candidate = vote
direction = vote si hits >= CONFIRMATIONS, si no 0</pre>`,
      file: 'direction.py',
      hint: 'if longest >= MIN_LENGTH and confidence >= MIN_CONFIDENCE:\n    vote = 1 if blue_length > orange_length else -1\nself.hits = self.hits + 1 if vote and vote == self.candidate else (1 if vote else 0)\nself.candidate = vote\nself.direction = vote if self.hits >= CONFIRMATIONS else 0',
      check: { kind: 'pytest', file: 'test_step_8.py' },
    },
    {
      id: 'cw-3d',
      title: 'Reto 3D: el sentido lo decide la cámara',
      body: `<p>Esta vez el coche sale mirando al oeste: la ronda es en <strong>sentido horario</strong>, pero nadie se lo dice. <code>DIRECTION = 'auto'</code>: tu <code>DirectionVote</code> lee las líneas de la cámara (en esta web, largos de líneas simulados con fotogramas borrosos) y decide.</p>`,
      file: 'drive.py',
      files: { 'drive.py': MISSION_DRIVE('auto', true) },
      check: {
        kind: 'sim',
        world: { field: 'field', start: [0, -1.0, Math.PI], camera: 'cw', speedup: 3, view: 'top', seed: 3 },
        goal: {
          seconds: 50, round: 'cw',
          done: (m) => pointsOf(m) >= 30,
          fail: (m) => (m.status === 'DIRECTION_FAULT' ? 'La cámara no decidió en 15 s: el coche se quedó parado.'
            : m.round?.finished && pointsOf(m) < 30 ? `La ronda terminó con ${pointsOf(m)} puntos.` : null),
          success: roundLine,
        },
      },
    },
  ],
};

// ------------------------------------------------------------------------------------------------ step 9
export const step9: Lesson = {
  step: 9,
  title: 'Puntuar y medir',
  summary: 'El juez: secciones, vueltas y parada; elegir entre rondas por puntos y después por tiempo.',
  guideUrl: `${G}/paso-9-puntuar-y-medir/`,
  packages: ['numpy'],
  files: [
    { name: 'drive.py', starter: MISSION_DRIVE('ccw', true) },
    ref('direction', 8), ref('mission', 7), ref('turn_gate', 6), ref('arc', 5), ref('lane', 4), ref('perception', 3), ref('heading', 2), ref('model', 1),
  ],
  tasks: [
    {
      id: 'points',
      title: '¿Cuántos puntos?',
      body: '<p>El reto Open da 1 punto por sección (8 por vuelta), 1 por vuelta completa y 3 por parar en la sección de salida.</p>',
      check: {
        kind: 'choice',
        question: 'Un coche hace 3 vueltas perfectas pero no para en la sección de salida. ¿Cuántos puntos?',
        options: ['24', '27', '30', '33'],
        answer: 1,
        why: '24 secciones + 3 vueltas = 27. Parar en la sección de salida suma los 3 que faltan para 30.',
      },
    },
    {
      id: 'best',
      title: '¿Cuál es mejor?',
      body: '<p>Dos rondas de la misma estrategia, en el mismo campo.</p>',
      check: {
        kind: 'choice',
        question: 'Ronda A: 30 puntos en 36 s. Ronda B: 27 puntos en 31 s. ¿Cuál es la mejor?',
        options: ['B: es más rápida', 'A: primero cuentan los puntos', 'Empate', 'Ninguna: hay que repetir'],
        answer: 1,
        why: 'Primero los puntos; el tiempo solo desempata rondas con los mismos puntos.',
      },
    },
    {
      id: 'ccw-3d',
      title: 'Reto 3D: 30 puntos antihorario',
      body: '<p>Tu estrategia completa en sentido antihorario. Necesitas los 30 puntos. Anota el tiempo.</p>',
      file: 'drive.py',
      files: { 'drive.py': MISSION_DRIVE('ccw', true) },
      check: {
        kind: 'sim',
        world: { field: 'field', start: FIELD_START, speedup: 3, view: 'top' },
        goal: { seconds: 50, round: 'ccw', done: (m) => pointsOf(m) >= 30, fail: (m) => (m.round?.finished && pointsOf(m) < 30 ? `${pointsOf(m)} puntos.` : null), success: roundLine },
      },
    },
    {
      id: 'cw-3d',
      title: 'Reto 3D: 30 puntos horario',
      body: `<p>Y en sentido horario, con la cámara decidiendo: cambia <code>DIRECTION</code> a <code>'auto'</code> en <code>drive.py</code>. Compara el tiempo con el de antes: con la misma puntuación, gana el menor.</p>`,
      file: 'drive.py',
      hint: "DIRECTION = 'auto'",
      check: {
        kind: 'sim',
        world: { field: 'field', start: [0, -1.0, Math.PI], camera: 'cw', speedup: 3, view: 'top', seed: 5 },
        goal: {
          seconds: 50, round: 'cw', done: (m) => pointsOf(m) >= 30,
          fail: (m) => (m.status === 'DIRECTION_FAULT' ? "El coche esperó a la cámara: ¿pusiste DIRECTION = 'auto'?"
            : m.time > 4 && m.status === 'WAIT_START' ? 'No arrancó.'
              : m.round?.finished && pointsOf(m) < 30 ? `${pointsOf(m)} puntos.` : null),
          success: roundLine,
        },
      },
    },
  ],
};

