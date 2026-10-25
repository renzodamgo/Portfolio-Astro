// Interactive lessons of the Open guide, steps 0 to 4 (Spanish text; code as in the course repository).
import type { Lesson } from '../types';
import { AMBER, CAR_FRONT, f, GREEN, corridorX, corridorY, inside, ring, zone } from './worlds';

const G = '/learn/open-strategy';

// ------------------------------------------------------------------------------------------------ step 0
const TEMPLATE_DRIVE = `def main():
    print('Hi from my_open.')


if __name__ == '__main__':
    main()
`;

export const step0: Lesson = {
  step: 0,
  title: 'Instalar y preparar',
  summary: 'La terminal de Ubuntu del curso: clonar, activar ROS, compilar, lanzar el simulador y crear tu paquete.',
  guideUrl: `${G}/paso-0-instalar-y-preparar/`,
  fresh: true,
  files: [{ name: 'drive.py', starter: TEMPLATE_DRIVE }],
  tasks: [
    {
      id: 'clone',
      title: 'Clona el repositorio',
      body: `<p>Esta terminal es un Ubuntu de mentira, pero los comandos son los de verdad. Empieza como en tu ordenador: descarga el curso y entra en su carpeta.</p>
<pre>git clone https://github.com/renzodamgo/robotek-learn.git
cd robotek-learn</pre>
<p>Después escribe <code>ls</code> para ver qué hay dentro.</p>`,
      hint: 'Escribe los dos comandos, uno por línea, y pulsa Enter después de cada uno. Puedes copiarlos.',
      check: { kind: 'command', match: (e, s) => s.cloned && s.cwd === 'robotek-learn' && e.ok },
    },
    {
      id: 'source-ros',
      title: 'Activa ROS 2 en esta terminal',
      body: `<p>Prueba primero <code>ros2</code>: la terminal todavía no lo conoce. ROS está instalado, pero cada terminal nueva tiene que <strong>activarlo</strong> con <code>source</code>:</p>
<pre>source /opt/ros/jazzy/setup.bash</pre>
<p>Vuelve a escribir <code>ros2</code> y verás la diferencia.</p>`,
      hint: 'source /opt/ros/jazzy/setup.bash (con la barra inicial: es una ruta absoluta).',
      check: { kind: 'command', match: (e, s) => e.argv[0] === 'source' && s.rosSourced },
    },
    {
      id: 'why-source',
      title: 'Pregunta rápida',
      body: '<p>Antes de seguir, asegúrate de entender esto, porque es el error más común del curso.</p>',
      check: {
        kind: 'choice',
        question: 'Abres una terminal nueva y ros2 dice «orden no encontrada». ¿Qué falta?',
        options: ['Reinstalar ROS 2', 'Hacer source en esa terminal', 'Reiniciar el ordenador', 'Compilar con colcon'],
        answer: 1,
        why: 'source activa ROS solo en la terminal donde lo escribes. Cada terminal nueva lo necesita otra vez.',
      },
    },
    {
      id: 'build',
      title: 'Compila el workspace',
      body: `<p>Desde la raíz del repositorio (<code>~/robotek-learn</code>), compila todos los paquetes del curso:</p>
<pre>colcon build --symlink-install</pre>
<p><code>--symlink-install</code> hace que <code>install/</code> apunte a tus archivos: al editar Python no hace falta recompilar.</p>`,
      hint: 'Si dice que no encuentra paquetes, haz cd ~/robotek-learn. Si dice ament_cmake, te falta el source de ROS.',
      check: { kind: 'command', match: (e, s) => e.argv[0] === 'colcon' && e.ok && s.built },
    },
    {
      id: 'source-ws',
      title: 'Carga lo que compilaste',
      body: `<p>Compilar crea la carpeta <code>install/</code>. Para que ROS vea esos paquetes, actívala también:</p>
<pre>source install/setup.bash</pre>`,
      check: { kind: 'command', match: (e, s) => e.argv[0] === 'source' && s.wsSourced },
    },
    {
      id: 'pkg-list',
      title: '¿Están los paquetes del curso?',
      body: `<p>Comprueba que ROS ve los seis paquetes del curso:</p>
<pre>ros2 pkg list | grep robotek</pre>
<p>Deben salir <code>robotek_common</code>, <code>robotek_course</code>, <code>robotek_description</code>, <code>robotek_evaluation</code>, <code>robotek_gazebo</code> y <code>robotek_hardware</code>.</p>`,
      check: { kind: 'command', match: (e, s) => e.argv[0] === 'ros2' && e.argv[1] === 'pkg' && e.grep === 'robotek' && s.wsSourced && e.ok },
    },
    {
      id: 'launch',
      title: 'Lanza el simulador',
      body: `<p>Abre el campo del reto Open con el coche:</p>
<pre>ros2 launch robotek_course sim.launch.py</pre>
<p>Arriba aparece la vista 3D (aquí hace de Gazebo). La línea naranja es el LiDAR: la «vista» del coche.</p>`,
      check: { kind: 'command', match: (e) => e.argv[0] === 'ros2' && e.argv[1] === 'launch' && e.ok },
    },
    {
      id: 'keyboard',
      title: 'Conduce hasta la meta',
      body: `<p>Ahora conduce tú. Escribe:</p>
<pre>ros2 run robotek_course keyboard_drive</pre>
<p>Lleva el coche hasta el <strong>círculo verde</strong> de la esquina de arriba a la derecha <strong>sin chocar</strong>. Teclas: <kbd>W</kbd> acelera, <kbd>S</kbd> frena, <kbd>A</kbd> y <kbd>D</kbd> giran. Haz clic en la vista 3D si las teclas no responden.</p>
<p>Si chocas, vuelve a escribir el comando.</p>`,
      hint: 'Ve recto hasta pasar la isla, gira a la izquierda en la esquina y sube por el pasillo de la derecha. Despacio en las curvas: el volante solo gira 17,6°.',
      check: {
        kind: 'keyboard',
        world: { field: 'field', start: [0, -1.0, 0], marks: [zone(1.0, 1.0, 0.25)], view: 'chase', trail: true },
        goal: {
          seconds: 120,
          done: (m) => inside(m, 1.0, 1.0, 0.25),
          success: (m) => `¡Meta en ${f(m.time, 1)} s sin chocar!`,
        },
      },
    },
    {
      id: 'create',
      title: 'Crea tu paquete',
      body: `<p>Tu estrategia vivirá en un paquete de Python llamado <code>my_open</code>, dentro de <code>src/</code>:</p>
<pre>cd src
ros2 pkg create --build-type ament_python my_open --node-name drive</pre>
<p>(En tu ordenador añadirás licencia, autor y dependencias, como dice la guía.)</p>`,
      hint: 'Primero cd src. El nombre tiene que ser my_open y el tipo ament_python.',
      check: { kind: 'command', match: (e, s) => s.pkgCreated && e.argv[0] === 'ros2' },
    },
    {
      id: 'build-mine',
      title: 'Compila solo tu paquete',
      body: `<p>Vuelve a la raíz y compila solo <code>my_open</code> (mucho más rápido que todo):</p>
<pre>cd ..
colcon build --symlink-install --packages-select my_open</pre>
<p>En el editor ya ves <code>drive.py</code>, el nodo que creó ROS.</p>`,
      file: 'drive.py',
      check: { kind: 'command', match: (e, s) => e.argv[0] === 'colcon' && e.ok && s.pkgBuilt },
    },
    {
      id: 'run-mine',
      title: 'Ejecuta tu nodo',
      body: `<p>Carga lo compilado y ejecuta tu nodo:</p>
<pre>source install/setup.bash
ros2 run my_open drive</pre>
<p>Debe imprimir <code>Hi from my_open.</code></p>`,
      check: { kind: 'command', match: (e) => e.argv.join(' ') === 'ros2 run my_open drive' && e.ok },
    },
    {
      id: 'edit',
      title: 'Tu primer cambio',
      body: `<p>En el editor, cambia el texto de <code>print</code> por <code>'Hola desde my_open'</code>. Guarda con <kbd>Ctrl</kbd>+<kbd>S</kbd> y vuelve a ejecutar <code>ros2 run my_open drive</code>.</p>
<p>No hace falta recompilar: por eso usaste <code>--symlink-install</code>.</p>`,
      file: 'drive.py',
      solution: `def main():\n    print('Hola desde my_open')`,
      check: { kind: 'command', match: (e, _s, f) => e.argv.join(' ') === 'ros2 run my_open drive' && e.ok && /Hola desde my_open/.test(f['drive.py'] ?? '') },
    },
  ],
};

// ------------------------------------------------------------------------------------------------ step 1
const MODEL_STARTER = `"""Step 1 - The car: how the steering angle becomes a turn (the bicycle model)."""
import math

from robotek_course.minisim import WHEELBASE   # 0.1174 m between the axles


def yaw_rate(speed, steer):
    """How fast the car rotates (rad/s) when it drives at \`\`speed\`\` (m/s) with the front wheels at \`\`steer\`\` (rad)."""
    return 0.0   # TODO (tarea 1)


def turn_radius(steer):
    """Radius (m) of the circle the car draws with the wheels fixed at \`\`steer\`\` (rad)."""
    return 0.0   # TODO (tarea 2)


def bicycle_step(x, y, yaw, speed, steer, dt):
    """Advance the car dt seconds: first the heading, then the position along the new heading."""
    return x, y, yaw   # TODO (tarea 3)
`;

const CIRCLE_DRIVE = `"""Reto: dibuja un círculo de 0,5 m alrededor de la roca, sin tocar el anillo de piedras."""
import math

from robotek_course.minisim import WHEELBASE
from my_open.model import turn_radius

RADIUS = 0.5    # m: el círculo que debe dibujar el coche
SPEED = 0.6     # m/s
STEER = 0.0     # TODO: el ángulo de las ruedas (rad) que da RADIUS


def drive(s):
    """Cada 0,02 s: devuelve (velocidad, ángulo del volante)."""
    return SPEED, STEER
`;

const GARAGE_DRIVE = `"""Reto: gira exactamente 90 grados a la izquierda y entra recto al garaje."""
import math

from robotek_course.minisim import STEER_LIMIT   # 0.307 rad: el tope del volante real
from my_open.model import yaw_rate

SPEED = 0.5         # m/s
TURN_TIME = 0.0     # TODO: segundos con el volante a tope para girar 90 grados (pi / 2 rad)


def drive(s):
    if s.time < 0.5:                       # medio segundo recto
        return SPEED, 0.0
    if s.time < 0.5 + TURN_TIME:           # el giro, con el volante a tope a la izquierda
        return SPEED, STEER_LIMIT
    if s.time < 0.5 + TURN_TIME + 2.2:     # recto hacia el garaje
        return SPEED, 0.0
    return 0.0, 0.0                        # parado dentro
`;

const C1 = { x: 0, y: -0.35 };
const GX = -0.65 + 0.3696;   // where the ideal 90 degree turn comes out

export const step1: Lesson = {
  step: 1,
  title: 'El coche',
  summary: 'El modelo de bicicleta: del ángulo del volante a la velocidad de giro y al radio, y probarlo en 3D.',
  guideUrl: `${G}/paso-1-el-coche/`,
  files: [{ name: 'model.py', starter: MODEL_STARTER }, { name: 'drive.py', starter: CIRCLE_DRIVE }],
  tasks: [
    {
      id: 'yaw-rate',
      title: 'La velocidad de giro',
      body: `<p>Un coche con las ruedas giradas un ángulo δ gira sobre sí mismo a</p>
<pre>velocidad de giro = v · tan(δ) / L</pre>
<p>donde <code>L = WHEELBASE</code> es la distancia entre ejes (0,1174 m). Escribe <code>yaw_rate(speed, steer)</code> en <code>model.py</code> y pulsa <strong>Comprobar</strong> (o escribe la prueba en la terminal).</p>`,
      file: 'model.py',
      hint: 'return speed * math.tan(steer) / WHEELBASE',
      solution: 'def yaw_rate(speed, steer):\n    return speed * math.tan(steer) / WHEELBASE',
      check: { kind: 'pytest', file: 'test_step_1.py', k: 'yaw_rate' },
    },
    {
      id: 'radius',
      title: 'El radio del círculo',
      body: `<p>Con el volante fijo, el coche dibuja un círculo. Su radio no depende de la velocidad:</p>
<pre>radio = L / tan(|δ|)</pre>
<p>Escribe <code>turn_radius(steer)</code>. Usa el valor absoluto: girar a la derecha (δ negativo) da el mismo círculo.</p>`,
      file: 'model.py',
      hint: 'return WHEELBASE / math.tan(abs(steer))',
      solution: 'def turn_radius(steer):\n    return WHEELBASE / math.tan(abs(steer))',
      check: { kind: 'pytest', file: 'test_step_1.py', k: 'smallest_circle' },
    },
    {
      id: 'speed-question',
      title: 'Piensa antes de programar',
      body: '<p>Una pregunta sobre lo que acabas de escribir.</p>',
      check: {
        kind: 'choice',
        question: 'Con el volante fijo, el coche duplica su velocidad. ¿Qué pasa con el círculo?',
        options: ['Se hace el doble de grande', 'Se queda igual: solo lo recorre más rápido', 'Se reduce a la mitad', 'Depende del giroscopio'],
        answer: 1,
        why: 'El radio es L / tan(δ): no aparece la velocidad. Lo que cambia es la velocidad de giro, v · tan(δ) / L.',
      },
    },
    {
      id: 'circle',
      title: 'Reto 3D: rodea la roca',
      body: `<p>En <code>drive.py</code> el coche va a <code>SPEED</code> con las ruedas en <code>STEER</code>. Hay una roca en el centro y un anillo de piedras afuera: el único círculo que pasa es el de <strong>0,5 m de radio</strong>.</p>
<p>Calcula <code>STEER</code> con la fórmula del radio <em>al revés</em> (despeja δ). Pulsa <strong>▶ Ejecutar en 3D</strong> o escribe <code>ros2 run my_open drive</code>. Si chocas, corrige y repite.</p>`,
      file: 'drive.py',
      files: { 'drive.py': CIRCLE_DRIVE },
      hint: 'radio = L / tan(δ)  →  tan(δ) = L / radio  →  δ = atan(L / radio).',
      solution: 'STEER = math.atan(WHEELBASE / RADIUS)   # 0,23 rad',
      check: {
        kind: 'sim',
        world: {
          field: 'floor', start: [C1.x, C1.y - 0.5, 0], realistic: false,
          rocks: [[C1.x, C1.y, 0.34, 0.34], ...ring(C1.x, C1.y, 0.8, 12, 0.12)],
          marks: [{ x: C1.x, y: C1.y, r: 0.5, color: GREEN, ring: true }],
        },
        goal: {
          seconds: 12,
          done: (m) => Math.abs(m.turned) >= 2 * Math.PI,
          fail: (m) => (m.time > 2 && Math.abs(m.turned) < 0.3 ? 'El coche va recto: STEER sigue en 0.' : null),
          success: (m) => `¡Vuelta completa en ${f(m.time, 1)} s! Ese es el círculo de 0,5 m.`,
        },
      },
    },
    {
      id: 'garage',
      title: 'Reto 3D: el garaje',
      body: `<p>Ahora la velocidad de giro. El coche va a 0,5 m/s, gira con el volante <strong>a tope</strong> durante <code>TURN_TIME</code> segundos y luego sigue recto hacia el garaje.</p>
<p>Para entrar tiene que girar <strong>exactamente 90°</strong> (π/2 rad). Si giras de menos o de más, chocas con las paredes del garaje. Calcula <code>TURN_TIME</code> con tu <code>yaw_rate</code>:</p>
<pre>tiempo = ángulo / velocidad de giro</pre>`,
      file: 'drive.py',
      files: { 'drive.py': GARAGE_DRIVE },
      hint: 'TURN_TIME = (math.pi / 2) / yaw_rate(SPEED, STEER_LIMIT)',
      solution: 'TURN_TIME = (math.pi / 2) / yaw_rate(SPEED, STEER_LIMIT)   # 1,16 s',
      check: {
        kind: 'sim',
        tests: { file: 'test_step_1.py', k: 'yaw_rate' },
        world: {
          field: 'floor', start: [-0.9, -1.15, 0], realistic: false,
          rocks: [...corridorY(-0.55, 0.41, GX, 0.24), [GX, 0.62, 0.4, 0.1]],
          marks: [{ x: GX, y: 0.32, r: 0, w: 0.3, h: 0.3, color: GREEN }],
        },
        goal: {
          seconds: 8,
          done: (m) => Math.abs(m.x - GX) < 0.12 && m.y > 0.2 && m.y < 0.45 && m.still > 0.3,
          fail: (m) => (m.time > 1.2 && Math.abs(m.turned) < 0.05 ? 'No giró nada: TURN_TIME sigue en 0.' : null),
          success: (m) => `Dentro del garaje: giraste ${f((Math.abs(m.turned) * 180 / Math.PI), 0)}°.`,
        },
      },
    },
    {
      id: 'bicycle',
      title: 'Simula el coche tú',
      body: `<p>La última pieza del paso: <code>bicycle_step</code> avanza el coche <code>dt</code> segundos. Primero actualiza el rumbo con la velocidad de giro; después mueve <code>x</code> e <code>y</code> en la dirección del rumbo nuevo:</p>
<pre>yaw = yaw + yaw_rate(speed, steer) * dt
x = x + speed * cos(yaw) * dt
y = y + speed * sin(yaw) * dt</pre>
<p>Con esto pasan todas las pruebas del paso 1.</p>`,
      file: 'model.py',
      solution: 'def bicycle_step(x, y, yaw, speed, steer, dt):\n    yaw = yaw + yaw_rate(speed, steer) * dt\n    return x + speed * math.cos(yaw) * dt, y + speed * math.sin(yaw) * dt, yaw',
      check: { kind: 'pytest', file: 'test_step_1.py' },
    },
  ],
};

// ------------------------------------------------------------------------------------------------ step 2
const HEADING_STARTER = `"""Step 2 - The heading: integrate the gyroscope and steer back to a goal heading."""

from robotek_course.minisim import STEER_LIMIT, clamp, wrap

KP = 0.8     # steering (rad) per radian of heading error


class GyroHeading:
    """The car's heading, from the gyroscope alone (the car has no compass)."""

    def __init__(self):
        self.bias = 0.0      # the gyroscope's constant error (rad/s), measured while the car is still
        self.yaw = 0.0       # rad, zero at Start

    def calibrate(self, samples):
        """\`\`samples\`\`: gyroscope readings taken with the car standing still. Their mean is the bias."""
        pass   # TODO (tarea 1)

    def update(self, gyro, dt):
        """Add the rotation of this tick (the reading without the bias) to the heading; returns the heading."""
        return self.yaw   # TODO (tarea 2)


def heading_steer(goal, yaw):
    """Steering angle that brings the heading \`\`yaw\`\` towards \`\`goal\`\`: proportional to the error, within full lock."""
    return 0.0   # TODO (tarea 3)
`;

const CALIB_DRIVE = `"""Reto: recto por el pasillo de piedras con un giroscopio con mucho sesgo."""
from my_open.heading import GyroHeading, heading_steer

GOAL = 0.0          # rad: hacia el este, el rumbo del Start
heading = GyroHeading()
samples = []


def drive(s):
    if s.time < 0.6:                 # parado tras Start: junta lecturas del giroscopio
        samples.append(s.gyro)
        return 0.0, 0.0
    if samples:                      # una sola vez, al terminar de juntar
        pass                         # TODO: calibra el rumbo con las lecturas
        samples.clear()
    yaw = heading.update(s.gyro, s.dt)
    return 0.6, heading_steer(GOAL, yaw)
`;

const WRAP_DRIVE = `"""Reto: el coche mira casi al oeste (pi - 0,3 rad) y la meta es -pi: casi lo mismo."""
import math

from my_open.heading import GyroHeading, heading_steer

heading = GyroHeading()
heading.yaw = math.pi - 0.3      # dónde empieza mirando
GOAL = -math.pi                  # el oeste, escrito con el otro signo


def drive(s):
    yaw = heading.update(s.gyro, s.dt)
    return 0.6, heading_steer(GOAL, yaw)
`;

export const step2: Lesson = {
  step: 2,
  title: 'El rumbo',
  summary: 'El giroscopio: calibrar el sesgo, integrar el rumbo y volver a una meta por el camino corto.',
  guideUrl: `${G}/paso-2-el-rumbo/`,
  files: [
    { name: 'heading.py', starter: HEADING_STARTER },
    { name: 'drive.py', starter: CALIB_DRIVE },
    { name: 'model.py', ref: 'model', readonly: true, note: 'Tu paso 1 (la solución del curso).' },
  ],
  tasks: [
    {
      id: 'calibrate',
      title: 'Mide el sesgo',
      body: `<p>Un giroscopio parado no marca 0: marca su <strong>sesgo</strong> (más ruido). Con el coche quieto, el promedio de varias lecturas es el sesgo.</p>
<p>Escribe <code>calibrate(samples)</code>: guarda en <code>self.bias</code> el promedio de <code>samples</code>.</p>`,
      file: 'heading.py',
      hint: 'self.bias = sum(samples) / len(samples)',
      check: { kind: 'pytest', file: 'test_step_2.py', k: 'calibration_measures' },
    },
    {
      id: 'update',
      title: 'Integra el giroscopio',
      body: `<p>El giroscopio da la velocidad de giro (rad/s). El rumbo es su suma en el tiempo, sin el sesgo:</p>
<pre>yaw = yaw + (gyro - bias) · dt</pre>
<p>Escribe <code>update(gyro, dt)</code>: suma y devuelve <code>self.yaw</code>.</p>`,
      file: 'heading.py',
      hint: 'self.yaw += (gyro - self.bias) * dt   y luego   return self.yaw',
      check: { kind: 'pytest', file: 'test_step_2.py', k: 'integral or drift' },
    },
    {
      id: 'steer',
      title: 'Vuelve a la meta',
      body: `<p>Para mantener un rumbo, gira el volante proporcional al error, pero nunca más que el tope:</p>
<pre>steer = clamp(KP · wrap(goal - yaw), -STEER_LIMIT, STEER_LIMIT)</pre>
<p><code>wrap</code> deja el ángulo entre -π y π: así el coche gira por el <strong>camino corto</strong>.</p>`,
      file: 'heading.py',
      hint: 'return clamp(KP * wrap(goal - yaw), -STEER_LIMIT, STEER_LIMIT)',
      check: { kind: 'pytest', file: 'test_step_2.py', k: 'steering or comes_back' },
    },
    {
      id: 'calib-3d',
      title: 'Reto 3D: el pasillo',
      body: `<p>Este giroscopio tiene un sesgo de 0,06 rad/s, diez veces el del coche real. Si no lo restas, el coche «cree» que gira y se va contra las piedras.</p>
<p>En <code>drive.py</code> falta una línea: llama a la calibración con las lecturas que juntó parado. Ejecuta y llega al final del pasillo.</p>`,
      file: 'drive.py',
      files: { 'drive.py': CALIB_DRIVE },
      hint: 'heading.calibrate(samples)',
      check: {
        kind: 'sim',
        world: { field: 'floor', start: [-1.25, -1.0, 0], bias: 0.06, rocks: corridorX(-0.95, 1.26, -1.0, 0.22), marks: [zone(1.3, -1.0, 0.15)] },
        goal: { seconds: 12, done: (m) => m.x > 1.2, success: (m) => `Recto de punta a punta en ${f(m.time, 1)} s.` },
      },
    },
    {
      id: 'wrap-3d',
      title: 'Reto 3D: el camino corto',
      body: `<p>El coche mira casi al oeste (π − 0,3) y la meta es −π, que es <em>el mismo</em> oeste. La diferencia sin <code>wrap</code> es −6 rad: el coche daría casi una vuelta entera y chocaría.</p>
<p>Si tu <code>heading_steer</code> usa <code>wrap</code>, solo corrige 0,3 rad. Ejecútalo y compruébalo.</p>`,
      file: 'drive.py',
      files: { 'drive.py': WRAP_DRIVE },
      check: {
        kind: 'sim',
        world: { field: 'floor', start: [1.1, -1.0, Math.PI - 0.3], bias: 0, rocks: corridorX(0.95, -1.09, -1.0, 0.27), marks: [zone(-1.25, -1.0, 0.15)] },
        goal: { seconds: 10, done: (m) => m.x < -1.1, success: () => 'Solo corrigió 0,3 rad: el camino corto.' },
      },
    },
  ],
};

// ------------------------------------------------------------------------------------------------ step 3
const PERCEPTION_STARTER = `"""Step 3 - Perception: from one LiDAR scan to the four numbers of a Scene."""
import math

import numpy as np

from robotek_course.minisim import LIDAR_X, Scene

SIDE_HALF = 0.44                  # rad around +-90 deg for the side walls
AXIS_HALF = math.radians(3.0)     # rad around the track axis for the wall ahead
FIT_HALF = math.radians(20.0)     # the island wall is fitted to the beams within this of the side bearing
END_FROM = math.radians(20.0)     # the island wall is followed from 90 deg down to this bearing
WALL_TOLERANCE = 0.03             # m: a beam is on the wall within this of the fitted line
MAX_GAP_BEAMS = 2                 # lost beams that do not end the wall
MAX_SLOPE = math.tan(0.30)        # a line steeper than this (rad) is not a wall beside the car
LATERAL_RANGE = (0.15, 0.90)      # m: plausible distance from the car to the island wall


def perceive(scan, forward_yaw=0.0, sign=1):
    """One scan -> Scene."""
    ranges = np.asarray(scan.ranges, dtype=float)
    angles = scan.angle_min + np.arange(ranges.size) * scan.angle_increment
    ok = np.isfinite(ranges) & (ranges >= scan.range_min) & (ranges <= scan.range_max)
    return Scene(left=median_range(angles, ranges, ok, math.pi / 2),
                 right=median_range(angles, ranges, ok, -math.pi / 2),
                 front_axis=front_axis(angles, ranges, ok, forward_yaw),
                 island_end=island_end(angles, ranges, ok, sign))


def _near(angles, ok, centre, half):
    """Which beams are valid and within \`\`half\`\` radians of the bearing \`\`centre\`\`."""
    relative = np.arctan2(np.sin(angles - centre), np.cos(angles - centre))
    return ok & (np.abs(relative) <= half)


def median_range(angles, ranges, ok, centre):
    """Distance to the wall at the bearing \`\`centre\`\`: the MEDIAN of the beams around it (inf when there are none)."""
    chosen = _near(angles, ok, centre, SIDE_HALF)
    return math.inf   # TODO (tarea 1)


def front_axis(angles, ranges, ok, forward_yaw):
    """Distance to the wall ahead measured ALONG the track: each beam's range times cos(its angle off the track)."""
    chosen = _near(angles, ok, forward_yaw, AXIS_HALF)
    return math.inf   # TODO (tarea 2)


def island_end(angles, ranges, ok, sign):
    """x (m, in the car's frame) where the island wall beside the car ends (ya hecho: lo usarás en el paso 6)."""
    bearing = sign * angles
    side = ok & (np.abs(bearing - math.pi / 2) <= FIT_HALF)
    if side.any():
        side &= ranges <= 1.5 * np.median(ranges[side])
    if side.sum() < 10:
        return math.inf
    with np.errstate(invalid='ignore'):
        x, y = ranges * np.cos(bearing), ranges * np.sin(bearing)
    slope, offset = np.polyfit(x[side], y[side], 1)
    if abs(slope) > MAX_SLOPE or not LATERAL_RANGE[0] < offset < LATERAL_RANGE[1]:
        return math.inf
    with np.errstate(invalid='ignore'):
        on_wall = ok & (np.abs(y - (slope * x + offset)) <= WALL_TOLERANCE)
    last, missing = None, 0
    for i in np.argsort(-bearing):
        if not (END_FROM <= bearing[i] <= math.pi / 2):
            continue
        if on_wall[i]:
            last, missing = i, 0
        else:
            missing += 1
            if missing > MAX_GAP_BEAMS and last is not None:
                break
    if last is None or bearing[last] <= END_FROM + 0.05:
        return math.inf
    return float(x[last]) + LIDAR_X
`;

const STOP_DRIVE = `"""Reto: frena con el LiDAR antes de la pared de enfrente."""
from my_open.perception import perceive

STOP_AT = 0.0   # TODO: distancia (m) a la pared, medida por el LiDAR, a la que cortas el motor


def drive(s):
    scene = perceive(s.scan)
    if scene.front_axis <= STOP_AT:
        return 0.0, 0.0
    return 0.6, 0.0
`;

export const step3: Lesson = {
  step: 3,
  title: 'Ver el campo',
  summary: 'Del escaneo del LiDAR a una Scene: las paredes a cada lado (mediana) y la de enfrente a lo largo de la pista.',
  guideUrl: `${G}/paso-3-ver-el-campo/`,
  packages: ['numpy'],
  files: [
    { name: 'perception.py', starter: PERCEPTION_STARTER },
    { name: 'drive.py', starter: STOP_DRIVE },
    { name: 'heading.py', ref: 'heading', readonly: true, note: 'Tu paso 2 (la solución del curso).' },
    { name: 'model.py', ref: 'model', readonly: true, note: 'Tu paso 1 (la solución del curso).' },
  ],
  tasks: [
    {
      id: 'median',
      title: 'Las paredes de los lados',
      body: `<p>El LiDAR da 306 distancias. Para la pared de la izquierda se toman los rayos a ±0,44 rad de los 90° (<code>chosen</code>, ya calculado) y se usa la <strong>mediana</strong>: un rayo que se cuela por un hueco no la mueve.</p>
<p>Completa <code>median_range</code>: devuelve <code>float(np.median(ranges[chosen]))</code> si hay algún rayo elegido, y <code>math.inf</code> si no.</p>`,
      file: 'perception.py',
      hint: 'return float(np.median(ranges[chosen])) if chosen.any() else math.inf',
      check: { kind: 'pytest', file: 'test_step_3.py', k: 'distances_to_the_walls or median_ignores or empty_scan' },
    },
    {
      id: 'mean-vs-median',
      title: '¿Por qué la mediana?',
      body: '<p>Piensa en un rayo que pasa por un hueco y vuelve con 9 m.</p>',
      check: {
        kind: 'choice',
        question: '63 rayos miden 0,25 m y uno mide 9 m. ¿Qué número da mejor la distancia a la pared?',
        options: ['El promedio: 0,39 m', 'La mediana: 0,25 m', 'El máximo: 9 m', 'El primero de la lista'],
        answer: 1,
        why: 'La mediana ignora el rayo raro; el promedio lo mezcla y te aleja 14 cm de la verdad.',
      },
    },
    {
      id: 'front',
      title: 'La pared de enfrente',
      body: `<p>La pared de enfrente se mide <strong>a lo largo de la pista</strong>, no hacia donde apunta el coche: cada rayo cuenta su distancia por el coseno de su ángulo con la pista.</p>
<pre>median(ranges[chosen] · cos(angles[chosen] − forward_yaw))</pre>
<p>Completa <code>front_axis</code> (con <code>math.inf</code> si no hay rayos).</p>`,
      file: 'perception.py',
      hint: 'if not chosen.any(): return math.inf\nreturn float(np.median(ranges[chosen] * np.cos(angles[chosen] - forward_yaw)))',
      check: { kind: 'pytest', file: 'test_step_3.py', k: 'wall_ahead or noise' },
    },
    {
      id: 'stop-3d',
      title: 'Reto 3D: frena a tiempo',
      body: `<p>El coche va recto hacia la pared del este. Corta el motor cuando <code>scene.front_axis</code> llegue a <code>STOP_AT</code>.</p>
<p>Tiene que quedar parado con el morro dentro de la <strong>franja verde</strong> (entre 15 y 40 cm de la pared). Ojo: el coche tarda en frenar y el LiDAR mide desde 13 cm delante del centro.</p>`,
      file: 'drive.py',
      files: { 'drive.py': STOP_DRIVE },
      hint: 'Prueba valores entre 0,3 y 0,45 m y mira dónde se para.',
      check: {
        kind: 'sim',
        world: { field: 'floor', start: [-1.2, -1.0, 0], marks: [{ x: 1.5 - 0.275, y: -1.0, r: 0, w: 0.25, h: 0.5, color: GREEN }], view: 'chase' },
        goal: {
          seconds: 10,
          done: (m) => { const gap = 1.5 - (m.x + CAR_FRONT); return m.still > 0.5 && gap >= 0.15 && gap <= 0.4; },
          fail: (m) => {
            const gap = 1.5 - (m.x + CAR_FRONT);
            if (m.still > 0.5 && m.time > 1 && gap > 0.4) return `Paraste lejos: a ${f((gap * 100), 0)} cm de la pared. Baja STOP_AT.`;
            if (m.still > 0.5 && m.time > 1 && gap < 0.15) return `Paraste muy cerca: a ${f((gap * 100), 0)} cm. Sube STOP_AT.`;
            return null;
          },
          success: (m) => `Parado a ${f(((1.5 - (m.x + CAR_FRONT)) * 100), 0)} cm de la pared.`,
        },
      },
    },
  ],
};

// ------------------------------------------------------------------------------------------------ step 4
const LANE_STARTER = `"""Step 4 - The lane: stay at a fixed distance from the island wall."""
from robotek_course.minisim import clamp
from .heading import heading_steer

GAP = 0.25            # m kept from the island wall
GAIN = 0.3            # rad of heading offset per metre of gap error
LIMIT = 0.4           # rad: the offset never asks for more than this


def lateral_bias(inner, sign=1, gap=GAP):
    """Heading offset that moves the car to \`\`gap\`\` from the island wall.

    \`\`inner\`\` is the measured distance to the island wall; \`\`sign\`\` is +1 when the island is on the left (counter-
    clockwise lap) and -1 when it is on the right. Farther than \`\`gap\`\`: aim a little towards the island.
    """
    return 0.0   # TODO (tarea 1)


def lane_steer(goal, yaw, inner, sign=1):
    """The heading law of step 2, aimed at the goal heading plus the lateral offset."""
    return heading_steer(goal, yaw)   # TODO (tarea 2): suma el offset a la meta
`;

const LANE_DRIVE = `"""Reto: recorre la recta sur a 25 cm de la isla (franja verde)."""
from my_open.heading import GyroHeading
from my_open.lane import lane_steer
from my_open.perception import perceive

heading = GyroHeading()
samples = []
scene = None
last_scan = None


def drive(s):
    global scene, last_scan
    if s.time < 0.6:                       # calibración, como en el paso 2
        samples.append(s.gyro)
        return 0.0, 0.0
    if samples:
        heading.calibrate(samples)
        samples.clear()
    if s.scan is not last_scan:            # un escaneo nuevo cada 0,1 s
        last_scan = s.scan
        scene = perceive(s.scan)
    yaw = heading.update(s.gyro, s.dt)
    return 0.6, lane_steer(0.0, yaw, scene.left)   # la isla está a la izquierda
`;

export const step4: Lesson = {
  step: 4,
  title: 'Seguir la isla',
  summary: 'Mover la meta del rumbo según la distancia a la isla, con un límite, y verlo en la recta.',
  guideUrl: `${G}/paso-4-seguir-la-isla/`,
  packages: ['numpy'],
  files: [
    { name: 'lane.py', starter: LANE_STARTER },
    { name: 'drive.py', starter: LANE_DRIVE },
    { name: 'perception.py', ref: 'perception', readonly: true, note: 'Tu paso 3 (la solución del curso).' },
    { name: 'heading.py', ref: 'heading', readonly: true, note: 'Tu paso 2 (la solución del curso).' },
    { name: 'model.py', ref: 'model', readonly: true, note: 'Tu paso 1 (la solución del curso).' },
  ],
  tasks: [
    {
      id: 'bias',
      title: 'El desvío hacia la isla',
      body: `<p>En vez de girar el volante según el hueco, se <strong>mueve la meta del rumbo</strong>: si estás lejos de la isla, apunta un poco hacia ella.</p>
<pre>desvío = clamp(sign · GAIN · (inner − gap), −LIMIT, LIMIT)</pre>
<p><code>sign</code> es +1 con la isla a la izquierda y −1 a la derecha. Escribe <code>lateral_bias</code>.</p>`,
      file: 'lane.py',
      hint: 'return clamp(sign * GAIN * (inner - gap), -LIMIT, LIMIT)',
      check: { kind: 'pytest', file: 'test_step_4.py', k: 'no_offset or too_far or limited' },
    },
    {
      id: 'limit-question',
      title: '¿Para qué el límite?',
      body: '<p>Imagina que el LiDAR no ve la isla y mide 5 m.</p>',
      check: {
        kind: 'choice',
        question: 'Con un hueco de 5 m, sin LIMIT el desvío sería 0,3 · 4,75 = 1,4 rad. ¿Qué pasaría?',
        options: ['Nada: el volante ya tiene tope', 'El coche apuntaría 82° hacia la isla y chocaría', 'El coche frenaría', 'El giroscopio se descalibra'],
        answer: 1,
        why: 'La meta giraría 82°: el coche se lanzaría contra la isla. LIMIT deja como mucho 0,4 rad (23°).',
      },
    },
    {
      id: 'steer',
      title: 'Súmalo a la meta',
      body: `<p><code>lane_steer</code> es la ley del paso 2 apuntada a la meta <strong>más</strong> el desvío:</p>
<pre>heading_steer(goal + lateral_bias(inner, sign), yaw)</pre>`,
      file: 'lane.py',
      hint: 'return heading_steer(goal + lateral_bias(inner, sign), yaw)',
      check: { kind: 'pytest', file: 'test_step_4.py' },
    },
    {
      id: 'lane-3d',
      title: 'Reto 3D: la recta sur',
      body: `<p>El coche sale a 45 cm de la isla. Con tu <code>lane.py</code> debe acercarse y recorrer la <strong>franja verde</strong> (la segunda mitad de la recta) pegado a la isla, sin tocarla.</p>
<p>Pasa si está dentro de la franja al menos el 80 % del tiempo que la recorre.</p>`,
      file: 'drive.py',
      files: { 'drive.py': LANE_DRIVE },
      check: {
        kind: 'sim',
        world: {
          field: 'field', start: [-1.15, -0.95, 0], view: 'chase',
          marks: [{ x: 0.275, y: -0.5 - 0.21, r: 0, w: 0.55, h: 0.18, color: GREEN }, { x: -0.6, y: -0.95, r: 0.05, color: AMBER }],
        },
        goal: {
          seconds: 9,
          track: (m, dt) => {
            if (m.x < 0 || m.x > 0.55) return;
            const gap = -0.5 - m.y;
            m.memo.total = (m.memo.total ?? 0) + dt;
            if (gap >= 0.12 && gap <= 0.30) m.memo.inBand = (m.memo.inBand ?? 0) + dt;
          },
          done: (m) => m.x > 0.55 && (m.memo.inBand ?? 0) >= 0.8 * (m.memo.total ?? 1),
          fail: (m) => (m.x > 0.55 && (m.memo.inBand ?? 0) < 0.8 * (m.memo.total ?? 1)
            ? `Solo estuviste en la franja el ${Math.round(100 * (m.memo.inBand ?? 0) / (m.memo.total ?? 1))} % del tiempo. ¿El signo y GAIN están bien?` : null),
          success: (m) => `En la franja el ${Math.round(100 * (m.memo.inBand ?? 0) / (m.memo.total ?? 1))} % del tiempo.`,
        },
      },
    },
  ],
};
