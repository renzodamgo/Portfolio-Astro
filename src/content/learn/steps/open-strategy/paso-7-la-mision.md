---
guide: "open-strategy"
order: 7
slug: "paso-7-la-mision"
title: "La misión"
summary: "Encadena las tres vueltas y el final de la prueba."
tag: "step-7"
compareFrom: "step-6"
---

Hasta ahora tienes piezas sueltas: el rumbo, la ley de carril, la esquina y la puerta que decide cuándo girar. En este paso las unes en una **máquina de estados** de tres estados que espera Start, da las tres vueltas (12 esquinas) y se detiene en la sección de salida. Al terminar tienes un coche que puntúa en Gazebo.

## Lo que vas a ver

En Gazebo el coche se queda quieto hasta que el árbitro publica Start. Calibra el giroscopio durante 0,3 s, da tres vueltas, frena en la última esquina y avanza despacio hasta quedar donde empezó. La meta es **30 de 30 puntos** en sentido antihorario (`ccw`). El sentido va fijo en este paso: la cámara que lo decide llega en el paso 8.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-7.json"></div>

*Repetición de una ronda antihoraria completa en el laboratorio de Python: calibra, da tres vueltas, frena en la última esquina y se detiene.*

## La idea

### Tres estados y dos datos

Recorre una ronda completa estado por estado. Usa «Paso» para avanzar un evento y mira qué transición se toma:

<div data-widget="state-machine"></div>

| Estado | Qué hace | Sale cuando |
|---|---|---|
| `SETUP` | quieto: espera Start, calibra el giroscopio, mide la pared de enfrente y espera el sentido | hay sentido, pasa a `RUN` (a los 15 s sin sentido, a `STOP`) |
| `RUN` | la ley de rumbo de los pasos 2 a 6 | tras la esquina 12 y la parada, pasa a `STOP` |
| `STOP` | parada definitiva; guarda el motivo | nunca |

Dentro de `RUN` no hay más estados. Solo hay dos datos: `completed` (esquinas hechas) y `arc` (si hay una en curso). El nombre que ve el resto del sistema (`label`: `FOLLOW`, `TURN`, `FINISH`, `DONE`...) se calcula a partir de ellos. Menos estados son menos casos que probar.

### La lógica es Python puro; el nodo es una envoltura

Tu estrategia vive en tres lugares: dentro del nodo de ROS de Gazebo, dentro del Open lab (un simulador rápido sin Gazebo) y dentro de tus pruebas con `pytest`. Por eso está dividida en tres capas:

| Archivo | Qué contiene | Usa ROS |
|---|---|---|
| `mission.py` | la máquina de estados, solo números y `Scene` | no |
| `strategy.py` | une la misión con los sensores (`StrategyBase`) | no |
| `drive.py` | el nodo: suscribe tópicos, llama a la estrategia, publica `/cmd_vel_raw` | sí |

Las pruebas de este paso construyen escenas a mano y llaman a `MiniMission.step`, sin simulador y sin ROS. En el nodo no hay decisiones: si algo falla en Gazebo, casi siempre puedes reproducirlo en una prueba.

### Lo que te da `StrategyBase`

`StrategyBase` (en `robotek_course`) hace tres cosas que no son el objetivo del curso:

- **Odometría con LiDAR** (`LidarOdometry`): en cada tick `self.travelled` son los metros avanzados desde el tick anterior. El coche no tiene encoder; la distancia sale de los escaneos.
- **Escaneos repetidos**: el mismo escaneo puede llegar varias veces con la misma marca de tiempo. La base lo usa una sola vez; `self.new_scan` vale `True` solo en el primer tick tras uno nuevo. En el paso 6 el nodo repetía la comparación a mano para crear la escena una sola vez por escaneo.
- **Esperar Start**: `request_start()` pone `started = True`. El nodo desactiva el arranque automático (`auto_start = False`) porque en Gazebo Start lo publica el árbitro.

También pone `camera = 0` si el último voto tiene más de 0,5 s: un voto viejo no cuenta.

### El árbitro y el tópico `/start`

Tu estrategia solo conduce; **no escribe nada de la puntuación**. El nodo `round_recorder` hace de árbitro:

1. Espera a que lleguen datos de la pose, el LiDAR y el IMU, y que pase 1 s más.
2. Publica `True` en `/start` y anota el evento de salida. Ese es el instante cero del tiempo.
3. Guarda la pose real del coche (la estrategia nunca la ve; solo la usa el juez).
4. Termina la ronda a los 180 s, a los 30 s sin entrar en una sección nueva, o cuando hubo las tres vueltas y el coche queda quieto. Entonces puntúa (paso 9).

`/start` usa calidad de servicio `TRANSIENT_LOCAL`: si el nodo arranca un poco tarde, igual recibe el último mensaje.

### El final de la vuelta

La vuelta tiene 4 esquinas y la ronda 3 vueltas, así que `CORNERS = 12`. Tres detalles deciden si ganas los puntos del final:

- **La última esquina va más lenta** (0,6 en vez de 1,28 m/s de comando). Con menos velocidad el coche llega a la sección de salida y puede parar con todo el cuerpo dentro. Es la pieza que más puntos protege.
- **El freno usa la pared de enfrente.** En `SETUP` mides la distancia a esa pared (`_start_front`, mediana de los valores finitos). Al acabar la esquina 12 el coche avanza a 0,15 m/s hasta que la pared está tan cerca como al salir, y frena.
- **El frenado se enclava** (`_braking`). Si un rayo con ruido hace que la pared parezca más lejos, el motor no se reinicia.

El comando 1,28 m/s no es la velocidad real: con el motor medido del coche, 1,28 llega a 0,60 m/s (`real_speed`).

## Escríbelo

Crea tres archivos en `src/my_open/my_open/`: `mission.py`, `strategy.py` y reemplaza `drive.py`. El ejercicio principal es **`mission.py`**. Los otros dos son pegamento corto y los tienes completos abajo.

`MiniMission` ya te dice qué recibe y qué devuelve en la prueba: `step(dt, scene, gyro_z, travelled, camera=0)` devuelve `(speed, steer)`. Intenta primero con estas pistas.

**Pistas, método por método.**

1. **El esqueleto.** Guarda `state`, `stop_reason`, `started`, `direction` (`'ccw'`, `'cw'` o vacío), el `GyroHeading`, `goal` y `ref`, `completed`, `arc`, `travelled` y un `TurnGate`. `label` es una cadena de `if`: en `STOP`, por el motivo; en `SETUP`, `WAIT_START`, `CALIBRATE` o `DETECT_DIRECTION`; en `RUN`, `FINISH`, `TURN` o `FOLLOW`.
2. **`_setup`.** Devuelve `(0.0, 0.0)`. Sin Start no cuentes tiempo. Durante `CALIBRATE_SECONDS` acumula el giroscopio y `scene.front_axis`; después llama a `heading.calibrate` y guarda la mediana de las distancias finitas. Luego espera un sentido (`camera > 0` es `'ccw'`, `camera < 0` es `'cw'`) y pasa a `RUN`. A los `DIRECTION_TIMEOUT` segundos sin sentido, `STOP` con motivo `direction_fault`.
3. **`_run`.** `sign` es +1 en `ccw`; la isla está en `scene.left` si `sign > 0` y en `scene.right` si no. Si `gate.update` dice que toca girar, suma `sign * pi / 2` al `goal`, pon `arc = True` y llama a `gate.corner_started()`. Con `arc` sigues la esquina; si no, la ley de carril del paso 4 (`GAP` si la isla está abierta o no se ve).
4. **`_corner`.** Velocidad angular máxima: `real_speed(v) * tan(STEER_LIMIT) / WHEELBASE`. Llama a `arc_steer` (paso 5). Cuando `|wrap(goal - yaw)|` baja de la tolerancia (0,12 rad; 0,4 en la última), cuenta la esquina y limpia `arc`, `ref` y `travelled`.
5. **`_finish`.** Avanza a `FINISH_SPEED` mientras la pared de enfrente esté más lejos que `_start_front + FINISH_LEAD`; entonces pon `_braking = True`. Frenando, cuenta `STOP_WAIT` segundos con el motor en 0 y pasa a `STOP` con motivo `done`.

Antes de abrir la referencia, ejecuta las pruebas y mira cuáles pasan.

<details>
<summary>Ver la referencia de mission.py: constantes y estado</summary>

```python
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
LAST_CORNER_SPEED = 0.6        # slower, so the car can stop on the start section
FINISH_SPEED = 0.15
FINISH_LEAD = 0.08             # m: brake when the wall ahead is this close to the distance seen at Start
STOP_WAIT = 0.9                # s at rest before DONE
CALIBRATE_SECONDS = 0.3
DIRECTION_TIMEOUT = 15.0       # s without a direction: stop instead of guessing
TURN_TOLERANCE = 0.12          # rad (0.4 on the last corner)
LAST_TOLERANCE = 0.4
BRAKE_GAIN = 2.0               # 1/s: the speed above the last corner's grows this much per metre of gap
BRAKE_MARGIN = 0.15            # m


class MiniMission:
    """SETUP -> RUN -> STOP. step(dt, scene, gyro_z, travelled, camera) returns (speed, steer)."""

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

    def request_start(self):
        self.started = True

    def operator_stop(self):
        self._stop('operator_stop')

    @property
    def yaw(self):
        return self.heading.yaw

    @property
    def label(self):
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

<details>
<summary>Ver la referencia de mission.py: SETUP</summary>

```python
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
```

</details>

<details>
<summary>Ver la referencia de mission.py: RUN y la esquina</summary>

```python
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

    def _straight_speed(self, scene, last, corner_speed):
        speed = CRUISE_SPEED
        if last and math.isfinite(scene.front_axis):         # slow down before the last corner
            gap = scene.front_axis - self.gate.turn_front - BRAKE_MARGIN
            speed = min(speed, corner_speed + BRAKE_GAIN * max(0.0, gap))
        return speed

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

<details>
<summary>Ver la referencia de strategy.py</summary>

`Strategy` hereda de `StrategyBase`, convierte cada escaneo nuevo en una `Scene` (la percepción del paso 3) y le da todo a la misión. El rumbo de la pista (`forward_yaw`) hace que la pared de enfrente se mida a lo largo de la pista y no hacia donde apunta el coche.

```python
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

<details>
<summary>Ver la referencia de drive.py (versión de este paso)</summary>

El nodo solo reenvía. Esta versión no tiene cámara: el sentido va fijo (`'ccw'`) y en el paso 8 cambiarás esa línea y añadirás `on_image`. Conserva del paso 6 los imports y `main`; estas son las partes que cambian.

```python
CONTROL_RATE = 50.0       # Hz, on the simulation clock


class Drive(Node):
    def __init__(self):
        super().__init__('strategy')
        self.strategy = Strategy('ccw')                  # step 8: the camera decides
        self.strategy.auto_start = False                 # the referee publishes /start
        self.cmd = self.create_publisher(Twist, '/cmd_vel_raw', 10)
        self.create_subscription(LaserScan, '/scan', self.on_scan, qos_profile_sensor_data)
        self.create_subscription(Imu, '/imu', self.on_imu, qos_profile_sensor_data)
        self.state = self.create_publisher(
            String, '/robotek/state', QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL))
        self.state_sent = None
        self.create_subscription(Bool, '/robotek/stop', self.on_stop, 10)      # the button again: stop
        self.create_subscription(Bool, 'start', self.on_start,
                                 QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL))
        self.create_timer(1.0 / CONTROL_RATE, self.control)

    def on_scan(self, msg):
        self.strategy.on_scan(msg)

    def on_imu(self, msg):
        self.strategy.on_imu(self.now(), msg.angular_velocity.z)

    def on_start(self, msg):
        if msg.data and not self.strategy.started:
            self.strategy.request_start()

    def on_stop(self, msg):
        if msg.data:
            self.strategy.operator_stop()

    def now(self):
        return self.get_clock().now().nanoseconds * 1e-9

    def control(self):
        speed, steer = self.strategy.control(1.0 / CONTROL_RATE)
        cmd = Twist()
        cmd.linear.x = float(speed)
        cmd.angular.z = float(speed * math.tan(steer) / WHEELBASE)
        self.cmd.publish(cmd)
        if self.strategy.label != self.state_sent:
            self.state_sent = self.strategy.label
            self.state.publish(String(data=self.state_sent))
```

Los imports nuevos son `Bool` y `String` (`std_msgs.msg`), `Strategy` (`.strategy`) y `WHEELBASE` (`robotek_common.vehicle`). La conversión final, `speed * tan(steer) / WHEELBASE`, es el modelo de bicicleta del paso 1: el nodo publica una velocidad angular, no un ángulo de volante.

</details>

## Pruébalo

Primero las pruebas, sin ROS ni Gazebo:

```bash
python3 -m pytest course/tests/test_step_7.py -q
```

Son 12 pruebas con escenas armadas a mano: espera Start quieto, calibra, elige sentido con el voto de la cámara, ignora la cámara si el sentido es fijo, se detiene a los 15 s sin sentido, mantiene la distancia en recta, gira solo cuando se cumple todo (y al revés en `cw`), hace 12 esquinas y se detiene donde empezó, no reinicia el motor tras frenar, obedece al operador y calcula el rumbo sin el sesgo del giroscopio.

Después, compila y corre una ronda completa con ventana:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=ccw
```

La ronda termina sola y el árbitro imprime el resultado. En la solución de referencia midió:

```text
Puntos: 30 de 30   (secciones 24 + vueltas 3 + parada 3)
Tiempo desde Start: 34.80 s simulados   (vueltas: 10.9 / 10.6 / 11.0 s)
Válida: sí   margen mínimo 11.9 cm
```

Esas cifras son una estimación de simulación con las reglas publicadas, no una puntuación oficial. Si tu tiempo difiere unas décimas no pasa nada; lo que importa es **30 puntos y ronda válida**.

### Rómpelo

Quitar una pieza enseña para qué sirve. Estas medidas son del Open lab de la guía anterior (6 rondas por caso, no repetidas en Gazebo con este paquete). Sin calibrar el giroscopio, 4 de 6 rondas válidas (22 y 25 puntos en las otras). Con la última esquina igual de rápida, 2 de 6 (27 puntos en 4 rondas: el coche no consigue parar en la salida). Línea base: 6 de 6 con 30 puntos.

Para probar tú el enclavamiento: en `_finish`, quita `self._braking = True` y corre `test_the_motor_does_not_restart_after_braking`. ¿Qué haría el coche con un rayo ruidoso?

## Si algo falla

- **El coche no se mueve nunca.** No le llegó Start. Revisa que el nodo se llame `strategy`, que `auto_start = False` y que `on_start` use `TRANSIENT_LOCAL`. En la terminal debe salir `Start`; si no, mira `ros2 topic echo /start`.
- **Se mueve y se detiene a los 15 s sin dar vueltas.** Es `DIRECTION_FAULT`: tu misión no tiene sentido. En este paso `Strategy('ccw')` lo fija; si dejaste `'auto'`, la cámara aún no existe.
- **Gira bien pero saca 27 puntos o no para dentro de la sección de salida.** Revisa la última esquina: `LAST_CORNER_SPEED` y la rampa de `_straight_speed`. También que `_start_front` salga de la mediana de las distancias **finitas**.
- **Da vueltas de más o nunca llega a `FINISH`.** `completed` solo sube cuando termina `_corner`; mira que la tolerancia compare con `abs(wrap(...))`.

## Compara

Lo que cambia la referencia respecto al paso 6, y tu árbol contra el paso 7:

```bash
bash tools/compare-step.sh 6 7
bash tools/compare-step.sh 7
```

La referencia guarda un solo `drive.py` para el final del curso, así que en `drive.py` es normal ver diferencias (la cámara llega en el paso 8). Lo que importa comparar es `mission.py`.
