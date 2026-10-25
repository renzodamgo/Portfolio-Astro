---
guide: "open-strategy"
order: 7
slug: "paso-7-la-mision"
title: "La misión"
summary: "Encadena las tres vueltas y el final de la prueba."
tag: "step-7"
compareFrom: "step-6"
---

Hasta ahora tienes piezas sueltas: el rumbo, la ley de carril, la esquina y la puerta que decide cuándo girar. En este paso las unes en una **máquina de estados**: un programa que en cada momento está en un solo estado y solo cambia de estado por transiciones que tú defines. La tuya espera Start, da las tres vueltas (12 esquinas) y se detiene en la sección de salida. Al terminar tienes un coche que puntúa en Gazebo.

## Lo que vas a ver

Con Gazebo abierto, la ronda tiene cuatro momentos:

1. **Quieto, unos 0,3 s.** Start ya llegó, pero el coche calibra el giroscopio y mide la pared de enfrente.
2. **Tres vueltas.** Sigue la pared de la isla y en cada esquina gira 90° hacia ella (a la izquierda en `ccw`). En total, 12 giros en unos 35 s.
3. **Final.** En la última esquina va más lento; después avanza despacio hasta que la pared de enfrente está como estaba en Start, y frena.
4. **Resultado.** Unos 31 s después, con el coche ya quieto, el árbitro cierra la ronda e imprime los puntos.

La meta es **30 de 30 puntos** en sentido antihorario (`ccw`). El sentido va fijo en este paso: la cámara que lo decide llega en el paso 8.

> **Qué son los 30 puntos.** El tapete tiene 8 secciones alrededor de la isla y una vuelta pasa por las 8. El juez da 1 punto por cada sección de la que sale el coche (24 en tres vueltas), 3 por las tres vueltas y 3 por parar con todo el coche dentro de la sección de salida: 24 + 3 + 3. El detalle y la regla de «ronda válida» están en el paso 9.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-7.json"></div>


## La idea

### Palabras que vas a usar

| Palabra | Qué significa aquí |
|---|---|
| **Start** | la señal `/start` que publica el árbitro; el tiempo de la ronda se cuenta desde ahí |
| **Esquina** | un giro de 90° alrededor de la isla; la vuelta tiene 4 |
| **Vuelta** | 4 esquinas, que pasan por las 8 secciones del tapete |
| **Sección** | cada uno de los 8 cuadrados del tapete alrededor de la isla; la de salida es donde empieza el coche |
| **Ronda** | el intento completo: tres vueltas y la parada, medido desde Start |
| **Estado** | lo que la misión «está haciendo»: decide qué calcula `step()` en cada tick (50 veces por segundo) |
| **`Scene`** | las cuatro distancias que sacas de cada escaneo del LiDAR (paso 3): `left`, `right`, `front_axis` e `island_end` |
| **Voto de la cámara** | `+1` (antihorario), `-1` (horario) o `0` (no sabe); llega en el paso 8 y en este paso es la variable `camera` |

### Tres estados y dos datos

Recorre una ronda completa estado por estado. Usa «Paso» para avanzar un evento: verás qué transición se toma, qué líneas de `mission.py` se ejecutan y qué velocidad pide la misión.

<div data-widget="state-machine"></div>

- **`SETUP`**: quieto. Espera Start, calibra el giroscopio, mide la pared de enfrente y espera el sentido. Sale a `RUN` cuando hay sentido, o a `STOP` si pasan 15 s sin sentido.
- **`RUN`**: la ley de rumbo de los pasos 2 a 6. Sale a `STOP` tras la esquina 12 y la parada.
- **`STOP`**: parada definitiva. Guarda el motivo y nunca sale.

Dentro de `RUN` no hay más estados. Solo hay dos datos: `completed` (esquinas hechas) y `arc` (si hay una en curso). El nombre que ve el resto del sistema (`label`: `FOLLOW`, `TURN`, `FINISH`, `DONE`...) se calcula a partir de ellos. Menos estados son menos casos que probar.

### La lógica es Python puro; el nodo es una envoltura

Tu estrategia corre en tres sitios: dentro del nodo de ROS de Gazebo, dentro del Open lab y dentro de tus pruebas con `pytest`. Por eso está dividida en tres capas:

| Archivo | Qué contiene | Usa ROS |
|---|---|---|
| `mission.py` | la máquina de estados, solo números y `Scene` | no |
| `strategy.py` | une la misión con los sensores (`StrategyBase`) | no |
| `drive.py` | el nodo: suscribe tópicos, llama a la estrategia, publica `/cmd_vel_raw` | sí |

Las pruebas de este paso construyen escenas a mano y llaman a `MiniMission.step`, sin simulador y sin ROS. En el nodo no hay decisiones: si algo falla en Gazebo, casi siempre puedes reproducirlo en una prueba.

### Lo que te da `StrategyBase`

`StrategyBase` (en `robotek_course`) hace tres cosas que no son el objetivo del curso:

- **Distancia con LiDAR** (`LidarOdometry`): en cada tick `self.travelled` son los metros avanzados desde el tick anterior. El coche no tiene encoder; la distancia sale de los escaneos.
- **Escaneos repetidos**: el mismo escaneo puede llegar varias veces con la misma marca de tiempo. La base lo usa una sola vez; `self.new_scan` vale `True` solo en el primer tick tras uno nuevo.
- **Esperar Start**: `request_start()` pone `started = True`. El nodo desactiva el arranque automático (`auto_start = False`) porque en Gazebo Start lo publica el árbitro. (En el Open lab el primer escaneo hace de Start.)

También pone `camera = 0` si el último voto tiene más de 0,5 s: un voto viejo no cuenta.

### El árbitro y el tópico `/start`

Tu estrategia solo conduce; **no escribe nada de la puntuación**. El nodo `round_recorder` hace de árbitro:

1. Espera a que lleguen datos de la pose, el LiDAR y el IMU, y que pase 1 s más.
2. Publica `True` en `/start` y anota el evento de salida. Ese es el instante cero del tiempo.
3. Guarda la pose real del coche (la estrategia nunca la ve; solo la usa el juez).
4. Termina la ronda a los 180 s, a los 30 s sin entrar en una sección nueva, o cuando hubo las tres vueltas y el coche lleva 31 s quieto. Entonces puntúa (paso 9).

`/start` usa la calidad de servicio por defecto: el árbitro del simulador espera a que tu nodo esté suscrito antes de publicarlo, y el botón del coche publica del mismo modo, así que los dos funcionan.

### El final de la vuelta

La vuelta tiene 4 esquinas y la ronda 3 vueltas, así que `CORNERS = 12`. Tres detalles deciden si ganas los 3 puntos de la parada:

- **La última esquina va más lenta** (0,6 en vez de 1,28 m/s de comando). Con menos velocidad el coche llega a la sección de salida y puede parar con todo el cuerpo dentro.
- **El freno usa la pared de enfrente.** En `SETUP` mides la distancia a esa pared (`_start_front`, mediana de los valores finitos). Al acabar la esquina 12 el coche avanza a 0,15 m/s hasta que la pared está tan cerca como al salir, y frena.
- **El frenado se enclava** (`_braking`). Si un rayo con ruido hace que la pared parezca más lejos, el motor no se reinicia.

El comando 1,28 m/s no es la velocidad real: con el motor medido del coche, 1,28 llega a 0,60 m/s (`real_speed`).

## Escríbelo

Crea tres archivos en `src/my_open/my_open/`: `mission.py`, `strategy.py` y reemplaza `drive.py`. El ejercicio es **`mission.py`**, y lo escribes en cuatro etapas pequeñas. Después de cada una corres solo las pruebas que ya deberían pasar (`-k` elige pruebas por nombre). `strategy.py` y `drive.py` son pegamento y los tienes completos al final.

`MiniMission.step(dt, scene, gyro_z, travelled, camera=0)` devuelve `(speed, steer)`. Mira cómo lo llaman las pruebas en `course/tests/test_step_7.py`: es la mejor documentación.

### Etapa 1: el esqueleto y `SETUP`

Guarda `state`, `stop_reason`, `started`, `direction` (`'ccw'`, `'cw'` o vacío), el `GyroHeading`, `goal` y `ref`, `completed`, `arc`, `travelled` y un `TurnGate`, más los datos privados de la calibración y el final (`_calibrated`, `_samples`, `_fronts`, `_start_front`, `_time`, `_rest`, `_braking`). `label` es una cadena de `if`: en `STOP`, por el motivo; en `SETUP`, `WAIT_START`, `CALIBRATE` o `DETECT_DIRECTION`; en `RUN`, `FINISH`, `TURN` o `FOLLOW`. `step` reparte el trabajo: `SETUP` va a `_setup`, `STOP` devuelve `(0.0, 0.0)` y en `RUN` actualiza el rumbo y llama a `_run`.

Para `_setup`:

- Sin Start, devuelve `(0.0, 0.0)` y no cuentes tiempo.
- Durante `CALIBRATE_SECONDS`, acumula el giroscopio y `scene.front_axis`. Después llama a `heading.calibrate` y guarda la mediana de las distancias finitas.
- Luego espera un sentido (`camera > 0` es `'ccw'`, `camera < 0` es `'cw'`) y pasa a `RUN`. A los `DIRECTION_TIMEOUT` segundos sin sentido, `STOP` con motivo `direction_fault`.

Todavía no existe `_run`. Pon este andamio para que `step` funcione:

```python
    def _run(self, dt, scene, gyro):
        return 0.0, 0.0          # andamio: lo escribes en la etapa 2
```

```bash
python3 -m pytest course/tests/test_step_7.py -q -k "waits_for_start or after_calibrating or blue_means or fixed_direction or 15_seconds or operator or heading_comes"
```

Esperado: `7 passed, 5 deselected`.

<details>
<summary>Ver la referencia de mission.py: constantes, estado y step</summary>

```python
"""Step 7 - The mission: three states that put steps 2 to 6 together."""
import math
from statistics import median

from robotek_course.minisim import STEER_LIMIT, WHEELBASE, clamp, real_speed, wrap
from .heading import GyroHeading, heading_steer
from .lane import GAP, lane_steer
from .arc import arc_steer
from .turn_gate import ISLAND_OPEN, TurnGate

LAPS = 3
CORNERS = 4 * LAPS
CRUISE_SPEED = 1.28            # m/s commanded (the car really reaches 0.6)
LAST_CORNER_SPEED = 0.6        # the last corner is slower so the car can stop on the start section
FINISH_SPEED = 0.15
FINISH_LEAD = 0.08             # m: brake when the wall ahead is this close to the distance seen at Start
STOP_WAIT = 0.9                # s at rest before DONE
CALIBRATE_SECONDS = 0.3
DIRECTION_TIMEOUT = 15.0       # s without a direction from the camera: stop instead of guessing
TURN_TOLERANCE = 0.12          # rad: a corner is done within this of the goal heading (0.4 on the last one)
LAST_TOLERANCE = 0.4
BRAKE_GAIN = 2.0               # 1/s: the speed above the last corner's grows this much per metre of gap
BRAKE_MARGIN = 0.15            # m


class MiniMission:
    """SETUP -> RUN -> STOP. Inputs of ``step``: the time step, the latest Scene, the raw gyro reading, the metres driven
    since the last tick and the camera's vote (+1 counter-clockwise, -1 clockwise, 0 unknown). Output: (speed, steer)."""

    def __init__(self, direction='auto'):
        self.state = 'SETUP'
        self.stop_reason = ''
        self.started = False
        self.direction = direction if direction in ('ccw', 'cw') else ''
        self.heading = GyroHeading()
        self.goal = self.ref = 0.0           # the heading to hold, and the ramped reference of a corner
        self.completed = 0                   # corners finished
        self.arc = False
        self.travelled = 0.0                 # m since the last corner
        self.gate = TurnGate()
        self._calibrated = False
        self._samples, self._fronts = [], []
        self._start_front = math.inf
        self._time = self._rest = 0.0
        self._braking = False
```

</details>

<details>
<summary>Ver la referencia de mission.py: SETUP</summary>

```python
    # ----------------------------------------------------------------- API
    def request_start(self):
        self.started = True

    def operator_stop(self):
        self._stop('operator_stop')

    @property
    def yaw(self):
        return self.heading.yaw

    @property
    def label(self):
        """The name the rest of the system reads (telemetry, judge, LEDs)."""
        if self.state == 'STOP':
            return {'done': 'DONE', 'direction_fault': 'DIRECTION_FAULT', 'operator_stop': 'OPERATOR_STOP'}[self.stop_reason]
        if self.state == 'SETUP':
            return 'DETECT_DIRECTION' if self._calibrated else 'CALIBRATE' if self.started else 'WAIT_START'
        return 'FINISH' if self.completed >= CORNERS else 'TURN' if self.arc else 'FOLLOW'

    @property
    def forward_yaw(self):
        """The track heading in the car's frame: the wall ahead is measured along it, not along the car."""
        return wrap(self.goal - self.yaw) if self.state == 'RUN' else 0.0

    def _stop(self, reason):
        self.state, self.stop_reason = 'STOP', reason

    def step(self, dt, scene, gyro_z, travelled, camera=0):
        if self.state == 'SETUP':
            return self._setup(dt, scene, gyro_z, camera)
        if self.state == 'STOP':
            return 0.0, 0.0
        gyro = gyro_z - self.heading.bias
        self.heading.update(gyro_z, dt)
        self.travelled += max(0.0, travelled)
        return self._run(dt, scene, gyro)
```

</details>

### Etapa 2: `RUN` en recta

`sign` es +1 en `ccw`; la isla está en `scene.left` si `sign > 0` y en `scene.right` si no. En una recta usa la ley de carril del paso 4: mantén la distancia `inner` a la isla, salvo que la isla esté abierta o no se vea (`inner` infinito o mayor que `ISLAND_OPEN`): entonces mantén `GAP`, sin desvío lateral. Devuelve `(CRUISE_SPEED, lane_steer(self.goal, self.yaw, keep, sign))`.

Añade `or straight` al filtro de antes. Esperado: `8 passed, 4 deselected`.

### Etapa 3: las esquinas

Antes de la recta, pregunta a la puerta: si `gate.update(scene, inner, self.travelled, self.arc)` dice que toca girar, suma `sign * pi / 2` al `goal`, pon `arc = True` y llama a `gate.corner_started()`. Con `arc`, `_run` devuelve la velocidad de esquina y el volante de `_corner`; si no, sigue como en la etapa 2.

`_corner` calcula la velocidad angular máxima, `real_speed(v) * tan(STEER_LIMIT) / WHEELBASE`, y llama a `arc_steer` (paso 5). Cuando `|wrap(goal - yaw)|` baja de la tolerancia (0,12 rad; 0,4 en la última), cuenta la esquina y limpia `arc`, `ref` y `travelled`. Escribe ya la tolerancia de la última esquina: la usarás en la etapa 4. Por ahora la velocidad de esquina es siempre `CRUISE_SPEED`; en la etapa 4 la última esquina usará `LAST_CORNER_SPEED`.

Corre solo las pruebas de esquinas, junto con las anteriores (esperado: `10 passed, 2 deselected`):

```bash
python3 -m pytest course/tests/test_step_7.py -q -k "waits_for_start or after_calibrating or blue_means or fixed_direction or 15_seconds or operator or heading_comes or straight or corner_starts or clockwise"
```

<details>
<summary>Ver la referencia de mission.py: la esquina</summary>

```python
    def _corner(self, dt, gyro, sign, corner_speed):
        rate = real_speed(corner_speed) * math.tan(STEER_LIMIT) / WHEELBASE
        steer, self.ref = arc_steer(self.goal, self.ref, self.yaw, gyro, rate, dt, sign=sign)
        tolerance = LAST_TOLERANCE if self.completed == CORNERS - 1 else TURN_TOLERANCE
        if abs(wrap(self.goal - self.yaw)) <= tolerance:     # the corner is done
            self.arc, self.ref, self.travelled = False, self.goal, 0.0
            self.completed += 1
        return steer
```

</details>

### Etapa 4: el final y la última esquina

Dos piezas más:

- **`_finish`.** Avanza a `FINISH_SPEED` mientras la pared de enfrente esté más lejos que `_start_front + FINISH_LEAD`; entonces pon `_braking = True`. Frenando, cuenta `STOP_WAIT` segundos con el motor en 0 y pasa a `STOP` con motivo `done`.
- **La última esquina.** En `_run`, si `completed >= CORNERS` llama a `_finish`. `last` es `completed == CORNERS - 1`; en ese caso la velocidad de esquina es `LAST_CORNER_SPEED`, y `_straight_speed` baja el comando de forma gradual antes de la esquina (`BRAKE_GAIN`, `BRAKE_MARGIN`).

Ahora sí corre las 12 pruebas (esperado: `12 passed`). Antes de abrir la referencia, intenta que pasen solas.

<details>
<summary>Ver la referencia de mission.py: RUN completo</summary>

Este `_run` ya incluye lo de las etapas 2 y 3 más el final; compáralo con el tuyo.

```python
    # --------------------------------------------------------------- SETUP
    def _setup(self, dt, scene, gyro_z, camera):
        """Quiet: measure the gyroscope bias and the distance to the wall ahead, then wait for the camera."""
        if not self.started:
            return 0.0, 0.0
        self._time += dt
        if not self._calibrated and self._time < CALIBRATE_SECONDS:
            self._samples.append(gyro_z)
            self._fronts.append(scene.front_axis)
        elif not self._calibrated:
            self.heading.calibrate(self._samples)
            finite = [f for f in self._fronts if math.isfinite(f)]
            self._start_front = median(finite) if finite else math.inf
            self._calibrated, self._time = True, 0.0
        else:
            if not self.direction and camera:
                self.direction = 'ccw' if camera > 0 else 'cw'
            if self.direction:
                self.state, self.travelled = 'RUN', 0.0
            elif self._time >= DIRECTION_TIMEOUT:
                self._stop('direction_fault')
        return 0.0, 0.0

    # ----------------------------------------------------------------- RUN
    def _run(self, dt, scene, gyro):
        sign = 1.0 if self.direction == 'ccw' else -1.0
        inner = scene.left if sign > 0 else scene.right      # the island side
        if self.completed >= CORNERS:
            return self._finish(dt, scene, gyro)
        last = self.completed == CORNERS - 1
        corner_speed = LAST_CORNER_SPEED if last else CRUISE_SPEED
        if self.gate.update(scene, inner, self.travelled, self.arc):
            self.goal = wrap(self.goal + sign * math.pi / 2)
            self.arc = True
            self.gate.corner_started()
        if self.arc:
            return corner_speed, self._corner(dt, gyro, sign, corner_speed)
        island_open = math.isfinite(inner) and inner > ISLAND_OPEN
        keep = GAP if (not math.isfinite(inner) or island_open) else inner      # no lateral offset at a corner
        steer = lane_steer(self.goal, self.yaw, keep, sign)
        return self._straight_speed(scene, last, corner_speed), steer
```

```python
    def _straight_speed(self, scene, last, corner_speed):
        speed = CRUISE_SPEED
        if last and math.isfinite(scene.front_axis):         # slow down before the last corner
            gap = scene.front_axis - self.gate.turn_front - BRAKE_MARGIN
            speed = min(speed, corner_speed + BRAKE_GAIN * max(0.0, gap))
        return speed
```

</details>

<details>
<summary>Ver la referencia de mission.py: el final</summary>

```python
    def _finish(self, dt, scene, gyro):
        """Back at the start: creep until the wall ahead is as near as it was at Start, then stop."""
        steer = clamp(heading_steer(self.goal, self.yaw) - 0.1 * gyro, -STEER_LIMIT, STEER_LIMIT)
        if not self._braking:
            if not math.isfinite(scene.front_axis):
                return 0.0, steer
            if math.isfinite(self._start_front) and scene.front_axis > self._start_front + FINISH_LEAD:
                return FINISH_SPEED, steer
            self._braking = True                             # latched: range noise must not restart the motor
        self._rest += dt
        if self._rest >= STOP_WAIT:
            self._stop('done')
        return 0.0, 0.0
```

</details>

### Etapa 5: `strategy.py` y `drive.py`

`Strategy` hereda de `StrategyBase`, convierte cada escaneo nuevo en una `Scene` (la percepción del paso 3) y le da todo a la misión. El rumbo de la pista (`forward_yaw`) hace que la pared de enfrente se mida a lo largo de la pista y no hacia donde apunta el coche.

<details>
<summary>Ver la referencia de strategy.py</summary>

```python
"""The strategy: plain Python, no ROS. ``drive.py`` feeds it the sensors and sends its answer to the car."""
from robotek_course.base import StrategyBase
from robotek_course.minisim import Scene

from .mission import MiniMission
from .perception import perceive


class Strategy(StrategyBase):
    def __init__(self, direction='auto'):
        super().__init__()
        self.mission = MiniMission(direction)
        self.scene = Scene()

    def request_start(self):
        super().request_start()
        self.mission.request_start()

    def operator_stop(self):
        self.mission.operator_stop()

    def update(self, dt):
        if self.new_scan:
            sign = -1 if self.mission.direction == 'cw' else 1
            self.scene = perceive(self.scan, self.mission.forward_yaw, sign)
        speed, steer = self.mission.step(dt, self.scene, self.gyro, self.travelled, self.camera)
        self.yaw = self.mission.yaw
        return speed, steer

    @property
    def label(self):
        return self.mission.label

    @property
    def turns(self):
        return self.mission.completed

    @property
    def done(self):
        return self.mission.state == 'STOP'

    @property
    def stop_label(self):
        return self.mission.label if self.done else None
```

`self.yaw = self.mission.yaw` no es decoración: la odometría de `StrategyBase` usa tu rumbo para proyectar el avance.

</details>

`drive.py` se reemplaza entero: el nodo ya no calcula nada, solo reenvía sensores a `Strategy` y la respuesta a `/cmd_vel_raw`. La conversión final, `speed * tan(steer) / WHEELBASE`, es el modelo de bicicleta del paso 1: el nodo publica una velocidad angular, no un ángulo de volante. El sentido sale del parámetro `direction` y vale `'ccw'` por defecto: en el paso 8 cambiarás ese valor a `'auto'` y añadirás la cámara.

<details>
<summary>Ver la referencia de drive.py (versión de este paso, completa)</summary>

```python
"""The ROS node: sensors in, /cmd_vel_raw out. The decisions are in strategy.py."""
import math

from geometry_msgs.msg import Twist
import rclpy
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, qos_profile_sensor_data
from sensor_msgs.msg import Imu, LaserScan
from std_msgs.msg import Bool, String

from robotek_common.vehicle import WHEELBASE
from robotek_course.watchdog import SensorWatchdog

from .strategy import Strategy

CONTROL_RATE = 50.0       # Hz, on the simulation clock


class Drive(Node):
    def __init__(self):
        super().__init__('strategy')
        self.strategy = Strategy(self.declare_parameter('direction', 'ccw').value)       # step 8 adds the camera: 'auto'
        self.watchdog = SensorWatchdog()                   # brake if the LiDAR or the gyroscope go quiet
        self.strategy.auto_start = False                 # the referee (or the button on the car) publishes /start
        self.cmd = self.create_publisher(Twist, '/cmd_vel_raw', 10)
        self.create_subscription(LaserScan, '/scan', self.on_scan, qos_profile_sensor_data)
        self.create_subscription(Imu, '/imu', self.on_imu, qos_profile_sensor_data)
        self.state = self.create_publisher(
            String, '/robotek/state', QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL))
        self.state_sent = None
        self.create_subscription(Bool, '/robotek/stop', self.on_stop, 10)      # the button again: stop the car
        self.create_subscription(Bool, 'start', self.on_start, 10)   # plain QoS: works with the referee and with the car's button
        self.create_timer(1.0 / CONTROL_RATE, self.control)

    def on_scan(self, msg):
        self.watchdog.scan(self.now())
        self.strategy.on_scan(msg)

    def on_imu(self, msg):
        self.watchdog.imu(self.now())
        self.strategy.on_imu(self.now(), msg.angular_velocity.z)

    def on_start(self, msg):
        if msg.data and not self.strategy.started:
            self.get_logger().info('Start')
            self.strategy.request_start()

    def on_stop(self, msg):
        if msg.data:
            self.get_logger().info('Operator stop')
            self.strategy.operator_stop()

    def now(self):
        return self.get_clock().now().nanoseconds * 1e-9

    def control(self):
        if self.watchdog.stale(self.now()):
            self.get_logger().warning('A sensor went quiet: braking until it is back', throttle_duration_sec=2.0)
            speed, steer = 0.0, 0.0
        else:
            speed, steer = self.strategy.control(1.0 / CONTROL_RATE)
        cmd = Twist()
        cmd.linear.x = float(speed)
        cmd.angular.z = float(speed * math.tan(steer) / WHEELBASE)
        self.cmd.publish(cmd)
        if self.strategy.label != self.state_sent:
            self.state_sent = self.strategy.label
            self.state.publish(String(data=self.state_sent))


def main(args=None):
    rclpy.init(args=args)
    node = Drive()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, RuntimeError):
        pass
    finally:
        if rclpy.ok():
            node.cmd.publish(Twist())       # leave the car stopped
        rclpy.try_shutdown()
```

</details>

## Pruébalo

Primero las 12 pruebas, sin ROS ni Gazebo:

```bash
python3 -m pytest course/tests/test_step_7.py -q
```

Esperado: `12 passed`. Cubren: espera Start quieto, calibra, elige sentido con el voto de la cámara, ignora la cámara si el sentido es fijo, se detiene a los 15 s sin sentido, mantiene la distancia en recta, gira solo cuando se cumple todo (y al revés en `cw`), hace 12 esquinas y se detiene donde empezó, no reinicia el motor tras frenar, obedece al operador y calcula el rumbo sin el sesgo del giroscopio.

Después, compila y corre una ronda completa con ventana:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=ccw
```

En este paso corre solo `ccw`: el argumento `direction` del lanzador solo cambia hacia dónde **aparece** mirando el coche, no se lo pasa a tu nodo, y tu nodo tiene `'ccw'` por defecto. El sentido `cw` lo cubren las pruebas y, en Gazebo, la cámara del paso 8.

La ronda termina sola. En la terminal verás `Start` al empezar y, al final, el resultado del árbitro. La solución de referencia dio en **Gazebo**:

```text
Puntos: 30 de 30   (secciones 24 + vueltas 3 + parada 3)
Tiempo desde Start: 34.80 s simulados   (vueltas: 10.9 / 10.6 / 11.0 s)
Válida: sí   margen mínimo 11.9 cm
```

| Dónde | Tiempo desde Start (`ccw`) | Vueltas |
|---|---:|---|
| Gazebo (la autoridad) | 34,80 s | 10,9 / 10,6 / 11,0 s |
| Open lab (la repetición de arriba) | 32,58 s | 10,4 / 9,7 / 10,3 s |

Las vueltas no suman el total: después de la tercera hay que frenar, avanzar despacio y parar. Y las dos columnas no son comparables: el laboratorio no modela el deslizamiento de las ruedas ni la dinámica del plugin de Gazebo. Son estimaciones de simulación con las reglas publicadas, no una puntuación oficial. Si tu tiempo difiere unas décimas, no pasa nada: lo que importa es **30 puntos y ronda válida**.

### Rómpelo

Quitar una pieza enseña para qué sirve. Cambia una cosa, corre las pruebas **y** el Open lab (con el espacio de trabajo cargado, `source install/setup.bash`: `python3 -m robotek_evaluation.open_lab --strategy my_open.strategy:Strategy --seed 0`) y compara con la línea base: 12 de 12 válidas con 30 puntos. Los números siguientes son de esta guía: las 12 rondas del lab con 3 semillas (0, 1 y 2), es decir, 36 rondas por cambio.

| Cambio | Qué observar | Resultado medido |
|---|---|---|
| Sin calibrar: en `_setup`, cambia `self.heading.calibrate(self._samples)` por `pass` | las 12 pruebas **pasan**; mira el lab: en varias rondas los puntos bajan y en la lista de motivos aparece `no_contacts` | 23 de 36 válidas; de las otras 13, 12 tocan un muro y quedan en 20 a 25 puntos, y 1 saca 30 pero pasa a menos de 1 cm de la isla |
| La última esquina igual de rápida: `LAST_CORNER_SPEED = 1.28` | las 12 pruebas **pasan**; en el lab, `pts=27` y `rule_maximum` en la mitad de las rondas | 18 de 36 válidas; las otras 18 dan 27 puntos: el coche no consigue parar dentro de la sección de salida |
| Sin enclavar el freno: en `_finish`, cambia `self._braking = True` por `pass` | falla `test_the_motor_does_not_restart_after_braking` (`assert 0.15 == 0.0`) | 11 pruebas pasan y 1 falla |

Dos lecciones. Primero, las pruebas con escenas a mano no lo detectan todo: los dos primeros cambios rompen la ronda y las 12 pruebas siguen en verde. Para eso está el lab. Segundo, aun así, el lab no es Gazebo (paso 9): el resultado final lo decide una ronda en Gazebo con GUI.

## Si algo falla

- **El coche no se mueve nunca.** No le llegó Start. Revisa que el nodo se llame `strategy`, que `auto_start = False` y que `on_start` esté suscrito al tópico `start`. En la terminal debe salir `Start`; si no, mira `ros2 topic echo /start`.
- **Se mueve y se detiene a los 15 s sin dar vueltas.** Es `DIRECTION_FAULT`: tu misión no tiene sentido. En este paso el parámetro `direction` vale `'ccw'` por defecto; si dejaste `'auto'`, la cámara aún no existe.
- **Gira bien pero saca 27 puntos o no para dentro de la sección de salida.** Revisa la última esquina: `LAST_CORNER_SPEED` y la rampa de `_straight_speed`. También que `_start_front` salga de la mediana de las distancias **finitas**.
- **Da vueltas de más o nunca llega a `FINISH`.** `completed` solo sube cuando termina `_corner`; mira que la tolerancia compare con `abs(wrap(...))`.
- **Las pruebas de una etapa fallan por `AttributeError`.** Te falta algún atributo del esqueleto o el andamio de `_run` de la etapa 1.

## Resumen

- La misión es una máquina de tres estados (`SETUP`, `RUN`, `STOP`) con dos datos dentro de `RUN` (`completed`, `arc`); el nombre `label` se calcula.
- Toda la lógica es Python puro en `mission.py`, así que se prueba con escenas a mano; el nodo solo reenvía.
- Los 3 puntos de la parada dependen de la última esquina lenta, del freno por la pared de enfrente y de enclavarlo.

## Antes de seguir

- [ ] `python3 -m pytest course/tests/test_step_7.py -q` da `12 passed`.
- [ ] En Gazebo (`ccw`) el árbitro imprime `Puntos: 30 de 30` y `Válida: sí`.
- [ ] Sabes decir por qué 32,58 s y 34,80 s son tiempos de sitios distintos (lab y Gazebo).
- [ ] Probaste al menos un «Rómpelo» y viste que las pruebas no lo detectan todo.

## Compara

Lo que cambia la referencia respecto al paso 6, y tu árbol contra el paso 7:

```bash
bash tools/compare-step.sh 6 7
bash tools/compare-step.sh 7
```

La referencia guarda un `drive.py` por paso, así que aquí `drive.py` debería quedar casi igual al tuyo; lo que importa comparar es `mission.py`.
