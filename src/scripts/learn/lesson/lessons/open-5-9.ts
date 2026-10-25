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
const ARC_STARTER = `"""Step 5 - The corner: turn 90 degrees by moving the reference heading in a ramp, with a feed-forward and damping."""
import math

from robotek_course.minisim import STEER_LIMIT, clamp, wrap
from .heading import KP


def ramp(ref, goal, rate, dt):
    """Move the reference heading \`\`ref\`\` towards \`\`goal\`\` by at most \`\`rate * dt\`\` radians (the short way round)."""
    return goal   # TODO (tarea 1)


DAMPING = 0.1        # steering (rad) per rad/s of yaw-rate error
EXIT_ANGLE = 0.25    # rad: the feed-forward fades out over the last quarter radian


def arc_steer(goal, ref, yaw, gyro, rate, dt, sign=1, feed=True, fade=True, damping=DAMPING):
    """One tick of a corner: the ramp plus two terms. \`\`sign\`\` is +1 for a left turn, -1 for a right one.

    * feed-forward: while the reference is still climbing, add full lock (\`\`sign * STEER_LIMIT\`\`) and expect the yaw
      rate \`\`sign * rate\`\`; with \`\`fade\`\` both shrink to zero over the last \`\`EXIT_ANGLE\`\` before the goal;
    * damping: subtract \`\`damping\`\` times how far the measured yaw rate is from the expected one.
    """
    ramping = ref != goal
    ref = ramp(ref, goal, rate, dt)
    steer = KP * wrap(ref - yaw)   # TODO (tarea 3): feed-forward con fade y amortiguamiento
    return clamp(steer, -STEER_LIMIT, STEER_LIMIT), ref
`;

const CORNER_DRIVE = `"""Reto: la esquina sureste. Recta, giro de 90 grados a la izquierda con tu arc_steer, y recta al norte."""
import math

from robotek_course.minisim import STEER_LIMIT, WHEELBASE, real_speed, wrap
from my_open.arc import arc_steer
from my_open.heading import GyroHeading
from my_open.lane import lane_steer
from my_open.perception import perceive

SPEED = 1.28          # m/s pedidos (el coche real llega a 0,6)
TURN_FRONT = 1.19     # m: la esquina empieza con la pared de enfrente a esta distancia
heading = GyroHeading()
samples = []
scene = None
last_scan = None
goal = ref = 0.0
arc = done = False
status = ''


def drive(s):
    global scene, last_scan, goal, ref, arc, done, status
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
        rate = real_speed(SPEED) * math.tan(STEER_LIMIT) / WHEELBASE
        steer, ref = arc_steer(goal, ref, yaw, gyro, rate, s.dt, sign=1)
        if abs(wrap(goal - yaw)) <= 0.12:                       # terminada
            arc, done, status = False, True, 'FOLLOW'
        return SPEED, steer
    inner = scene.left if math.isfinite(scene.left) and scene.left < 1.0 else 0.25
    return SPEED, lane_steer(goal, yaw, inner)
`;

export const step5: Lesson = {
  step: 5,
  title: 'La esquina',
  summary: 'Girar 90° moviendo la referencia en rampa, con feed-forward, fade y amortiguamiento.',
  guideUrl: `${G}/paso-5-la-esquina/`,
  packages: ['numpy'],
  files: [
    { name: 'arc.py', starter: ARC_STARTER },
    { name: 'drive.py', starter: CORNER_DRIVE },
    ref('lane', 4), ref('perception', 3), ref('heading', 2), ref('model', 1),
  ],
  tasks: [
    {
      id: 'ramp',
      title: 'La rampa',
      body: `<p>Girar a la izquierda es sumar π/2 a la meta. Pero si la meta salta de golpe, el coche se pasa. La <strong>referencia</strong> sube poco a poco, a <code>rate</code> rad/s, hasta la meta:</p>
<pre>gap = wrap(goal − ref)
si |gap| ≤ rate·dt: devuelve goal
si no: wrap(ref + copysign(rate·dt, gap))</pre>
<p>Escribe <code>ramp</code>.</p>`,
      file: 'arc.py',
      hint: 'gap = wrap(goal - ref)\nif abs(gap) <= rate * dt:\n    return goal\nreturn wrap(ref + math.copysign(rate * dt, gap))',
      check: { kind: 'pytest', file: 'test_step_5.py', k: 'climbs or goes_down' },
    },
    {
      id: 'ff-question',
      title: '¿Por qué el feed-forward?',
      body: '<p>Con solo la rampa, el volante se mueve en proporción al error, que al principio es pequeño.</p>',
      check: {
        kind: 'choice',
        question: '¿Qué hace el feed-forward (sumar el tope del volante mientras la rampa sube)?',
        options: ['Frena el coche en la curva', 'Gira desde el principio sin esperar a que el error crezca', 'Corrige el sesgo del giroscopio', 'Mide la distancia a la isla'],
        answer: 1,
        why: 'Ya sabes que hay que girar a tope: no hace falta esperar a que el error lo pida. La esquina sale más rápida.',
      },
    },
    {
      id: 'arc',
      title: 'El controlador de la esquina',
      body: `<p>Completa <code>arc_steer</code> con las dos piezas:</p>
<pre>scale = min(1, max(0, sign·wrap(goal − yaw)) / EXIT_ANGLE) si fade, si no 1
steer_ff, rate_ff = (sign·STEER_LIMIT·scale, sign·rate·scale) si (ramping y feed), si no (0, 0)
steer = KP·wrap(ref − yaw) + steer_ff − damping·(gyro − rate_ff)</pre>
<p>El <strong>fade</strong> apaga el feed-forward en el último cuarto de radián; el <strong>amortiguamiento</strong> frena si gira más rápido de lo esperado.</p>`,
      file: 'arc.py',
      hint: 'Mira las tres líneas de arriba: van entre «ref = ramp(...)» y el return.',
      solution: `    scale = min(1.0, max(0.0, sign * wrap(goal - yaw)) / EXIT_ANGLE) if fade else 1.0
    steer_ff, rate_ff = (sign * STEER_LIMIT * scale, sign * rate * scale) if (ramping and feed) else (0.0, 0.0)
    steer = KP * wrap(ref - yaw) + steer_ff - damping * (gyro - rate_ff)`,
      check: { kind: 'pytest', file: 'test_step_5.py' },
    },
    {
      id: 'corner-3d',
      title: 'Reto 3D: la esquina sureste',
      body: `<p>Tu <code>arc_steer</code> en el campo: el coche sigue la isla, gira 90° a la izquierda en la esquina y sube por la recta del este.</p>
<p>Pasa si termina la esquina (a 0,12 rad del norte) y llega a la mitad de la recta sin chocar.</p>`,
      file: 'drive.py',
      files: { 'drive.py': CORNER_DRIVE },
      check: {
        kind: 'sim',
        tests: { file: 'test_step_5.py', k: 'climbs or left_corner' },
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
const GATE_STARTER = `"""Step 6 - When to turn: three conditions at once."""
import math

TURN_FRONT = 1.19        # m: the wall ahead (along the track) must be this near
LOOKAHEAD = 0.35         # m: the island's end must be this near (when it is visible)
END_CLEARANCE = 0.08     # m: in a narrow lane the look-ahead shrinks to (distance to the island - this)
CONFIRMATIONS = 2        # consecutive scans that must see the island's end close
ARM_DISTANCE = 0.25      # m driven after a corner before the next one may start
ISLAND_OPEN = 1.0        # m: an island wall farther than this beside the car means the island has ended


class TurnGate:
    """Decides, every tick, whether the car should start a corner (see the guide, step 6)."""

    def __init__(self, turn_front=TURN_FRONT, lookahead=LOOKAHEAD):
        self.turn_front, self.lookahead = turn_front, lookahead
        self.armed = True
        self.hits = 0
        self._scene = None

    def update(self, scene, inner, travelled, arc):
        """Returns True when the corner should start now."""
        if scene is not self._scene:                 # one count per scan, however often the tick repeats
            self._scene = scene
            limit = min(self.lookahead, max(0.0, inner - END_CLEARANCE)) if math.isfinite(inner) else self.lookahead
            self.hits = 0   # TODO (tarea 1): +1 si 0 <= scene.island_end <= limit, si no vuelve a 0
        seen_again = math.isfinite(inner) and inner < ISLAND_OPEN and travelled >= ARM_DISTANCE
        self.armed = self.armed or (seen_again and not arc)
        island_open = math.isfinite(inner) and inner > ISLAND_OPEN
        return False   # TODO (tarea 2): las condiciones a la vez

    def corner_started(self):
        """Call it when the corner starts: the gate stays shut until the island is seen again."""
        pass   # TODO (tarea 3)
`;

const LAP_DRIVE = `"""Reto: una vuelta entera. La recta (paso 4), la esquina (paso 5) y tu TurnGate decidiendo cuándo."""
import math

from robotek_course.minisim import STEER_LIMIT, WHEELBASE, real_speed, wrap
from my_open.arc import arc_steer
from my_open.heading import GyroHeading
from my_open.lane import GAP, lane_steer
from my_open.perception import perceive
from my_open.turn_gate import ISLAND_OPEN, TurnGate

SPEED = 1.28
heading = GyroHeading()
gate = TurnGate()
samples = []
scene = None
last_scan = None
goal = ref = 0.0
arc = False
travelled = 0.0
status = ''


def drive(s):
    global scene, last_scan, goal, ref, arc, travelled, status
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
    travelled += s.moved
    inner = scene.left                                  # la isla, a la izquierda
    if gate.update(scene, inner, travelled, arc):       # ¿toca girar?
        goal = wrap(goal + math.pi / 2)
        arc = True
        gate.corner_started()
    if arc:
        status = 'TURN'
        rate = real_speed(SPEED) * math.tan(STEER_LIMIT) / WHEELBASE
        steer, ref = arc_steer(goal, ref, yaw, gyro, rate, s.dt, sign=1)
        if abs(wrap(goal - yaw)) <= 0.12:
            arc, ref, travelled = False, goal, 0.0
        return SPEED, steer
    status = 'FOLLOW'
    island_open = math.isfinite(inner) and inner > ISLAND_OPEN
    keep = GAP if (not math.isfinite(inner) or island_open) else inner
    return SPEED, lane_steer(goal, yaw, keep, sign=1)
`;

export const step6: Lesson = {
  step: 6,
  title: 'Cuándo girar',
  summary: 'La puerta de las esquinas: la pared cerca, la isla terminada, armada y con distancia recorrida.',
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
      title: 'Las condiciones a la vez',
      body: `<p>La esquina toca cuando <strong>todo</strong> esto se cumple:</p>
<ul><li>la puerta está armada y no hay una esquina en curso (<code>not arc</code>);</li>
<li>recorriste al menos <code>ARM_DISTANCE</code> desde la anterior;</li>
<li>la pared de enfrente está cerca: <code>scene.front_axis &lt;= self.turn_front</code>;</li>
<li>la isla terminó: <code>island_open</code> o <code>self.hits &gt;= CONFIRMATIONS</code>.</li></ul>
<p>Y en <code>corner_started</code> desarma la puerta (<code>self.armed = False</code>).</p>`,
      file: 'turn_gate.py',
      hint: 'return (self.armed and not arc and travelled >= ARM_DISTANCE\n        and scene.front_axis <= self.turn_front\n        and (island_open or self.hits >= CONFIRMATIONS))',
      check: { kind: 'pytest', file: 'test_step_6.py' },
    },
    {
      id: 'lap-3d',
      title: 'Reto 3D: una vuelta',
      body: `<p>Con tu puerta decidiendo, el coche da una vuelta entera a la isla en sentido antihorario. Pasa al completar las 8 secciones de una vuelta sin chocar.</p>`,
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
${vote ? '    camera = vote.update(*s.camera)      # (azul, naranja) en píxeles -> +1, -1 o 0\n' : '    camera = 0\n'}    speed, steer = mission.step(s.dt, scene, s.gyro, s.moved, camera)
    status = mission.label
    return speed, steer
`;

const MISSION_REF_CORNER = `        if self.gate.update(scene, inner, self.travelled, self.arc):
            self.goal = wrap(self.goal + sign * math.pi / 2)
            self.arc = True
            self.gate.corner_started()
`;
const MISSION_REF_DONE = `        if abs(wrap(self.goal - self.yaw)) <= tolerance:     # the corner is done
            self.arc, self.ref, self.travelled = False, self.goal, 0.0
            self.completed += 1
`;

export const step7: Lesson = {
  step: 7,
  title: 'La misión',
  summary: 'SETUP, RUN y STOP: las piezas de los pasos 2 a 6 juntas en tres vueltas que terminan paradas.',
  guideUrl: `${G}/paso-7-la-mision/`,
  packages: ['numpy'],
  files: [
    {
      name: 'mission.py', ref: 'mission', note: 'La misión del curso con dos huecos para ti (busca TODO).',
      gaps: [
        [MISSION_REF_CORNER, '        pass   # TODO (tarea 1): si la puerta dice que toca, empieza la esquina\n'],
        [MISSION_REF_DONE, '        pass   # TODO (tarea 2): si el rumbo llegó a la meta, termina la esquina\n'],
      ],
    },
    { name: 'drive.py', starter: MISSION_DRIVE('ccw', false) },
    ref('turn_gate', 6), ref('arc', 5), ref('lane', 4), ref('perception', 3), ref('heading', 2), ref('model', 1),
  ],
  tasks: [
    {
      id: 'trigger',
      title: 'Empieza las esquinas',
      body: `<p>En <code>_run</code>, cuando la puerta del paso 6 dice que toca, la esquina empieza: la meta gira un cuarto de vuelta en el sentido de la ronda, se activa <code>arc</code> y se avisa a la puerta.</p>
<pre>si self.gate.update(scene, inner, self.travelled, self.arc):
    goal = wrap(goal + sign · π/2); arc = True; gate.corner_started()</pre>`,
      file: 'mission.py',
      solution: MISSION_REF_CORNER,
      check: { kind: 'pytest', file: 'test_step_7.py', k: 'corner_starts or clockwise_corner' },
    },
    {
      id: 'done',
      title: 'Termina las esquinas',
      body: `<p>En <code>_corner</code>, la esquina termina cuando el rumbo está a menos de <code>tolerance</code> de la meta: apaga <code>arc</code>, deja la referencia en la meta, pon <code>travelled</code> a 0 y suma una a <code>completed</code>.</p>
<p>Tras 12 esquinas, la misión vuelve despacio a la sección de salida y para.</p>`,
      file: 'mission.py',
      solution: MISSION_REF_DONE,
      check: { kind: 'pytest', file: 'test_step_7.py' },
    },
    {
      id: 'round-3d',
      title: 'Reto 3D: la ronda',
      body: `<p>¡La ronda completa! Tres vueltas antihorarias y parar en la sección de salida. El juez cuenta secciones, vueltas y el bonus de parar (30 puntos como máximo).</p>
<p>Va a doble velocidad para no esperar tanto.</p>`,
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

