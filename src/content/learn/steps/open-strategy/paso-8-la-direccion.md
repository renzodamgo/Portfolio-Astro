---
guide: "open-strategy"
order: 8
slug: "paso-8-la-direccion"
title: "La dirección (cámara)"
summary: "Usa la cámara para decidir el sentido de giro."
tag: "step-8"
compareFrom: "step-7"
---

Hasta ahora el sentido de la vuelta iba fijo en `ccw`. En la prueba real el árbitro no avisa: el coche tiene que mirar el suelo y decidirlo solo. En este paso escribes `DirectionVote`, la votación que convierte lo que ve la cámara en una decisión, y la conectas a la misión y al nodo.

## Lo que vas a ver

Después de calibrar, la misión pasa a `DETECT_DIRECTION` y el coche espera con el motor parado. En cuanto la cámara decide, la misión pasa a `RUN`. Hay dos pruebas:

1. `direction:=ccw`: el coche aparece mirando hacia un lado, la cámara debe votar `+1` y da las tres vueltas hacia la izquierda.
2. `direction:=cw`: aparece mirando hacia el otro lado, la cámara debe votar `-1` y da las tres vueltas al revés.

Meta: **30 puntos en los dos sentidos**, con la misma estrategia y sin cambiar una línea entre una prueba y otra.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-8.json"></div>


## La idea

### Dos líneas de colores

En el tapete hay una línea azul y una naranja. La regla del curso es:

- **Azul más larga que naranja:** vuelta antihoraria (`ccw`), voto `+1`.
- **Naranja más larga que azul:** vuelta horaria (`cw`), voto `-1`.
- **No está claro:** `0`.

Un **voto** es lo que decide **una sola imagen**. La cámara solo tiene que medir, en cada imagen, cuántos píxeles mide cada línea. Eso lo hace `line_lengths(bgr)` de `robotek_course.vision`, que **ya te lo dan**. Es trabajo de OpenCV, no el objetivo del curso. Hace lo siguiente: pasa la imagen (640 × 480 px) a HSV, saca una máscara por color (los rangos son los del simulador), cierra huecos, ignora el 8 % superior de la imagen (ahí solo hay pared y sala), descarta manchas pequeñas o que no sean alargadas, y devuelve el largo de la línea más larga de cada color.

Tu parte es lo que viene después: decidir con esos dos números. Prueba la votación tú mismo: el dibujo es un esquema de una imagen con las dos líneas y su largo en píxeles. Mueve los deslizadores, envía fotogramas y mira cuántos seguidos hacen falta para decidir.

<div data-widget="direction-vote"></div>

### Una imagen puede mentir

Un reflejo, una sombra o una mano cambian los números de una sola imagen. Por eso `DirectionVote` no decide con una imagen, sino con cinco seguidas:

| Constante | Valor | Qué exige |
|---|---:|---|
| `MIN_LENGTH` | 40 px | la línea más larga debe medir al menos esto; menos es ruido |
| `MIN_CONFIDENCE` | 0,25 | `abs(azul - naranja) / la más larga` debe llegar a esto |
| `CONFIRMATIONS` | 5 | imágenes seguidas que nombran el mismo sentido |

La **confianza** mide cuánto más larga es una línea que la otra, de 0 (iguales) a 1 (la otra no existe). Con azul 300 y naranja 60 vale |300 − 60| / 300 = 0,80. Con 300 y 280 vale 0,07 y la imagen no vota.

Una imagen que no vota, o que vota otra cosa, **reinicia la cuenta**. Mira cómo se comporta con una secuencia de ejemplo (azul y naranja en píxeles; una línea corta aparece en la imagen 4):

| Imagen | Azul | Naranja | Vota | Seguidas | Decisión |
|---:|---:|---:|---:|---:|---:|
| 1 | 300 | 60 | `+1` | 1 | 0 |
| 2 | 305 | 70 | `+1` | 2 | 0 |
| 3 | 300 | 65 | `+1` | 3 | 0 |
| 4 | 20 | 5 | 0 | 0 | 0 |
| 5 | 310 | 60 | `+1` | 1 | 0 |
| 6 | 300 | 58 | `+1` | 2 | 0 |
| 7 | 305 | 62 | `+1` | 3 | 0 |
| 8 | 300 | 59 | `+1` | 4 | 0 |
| 9 | 307 | 61 | `+1` | 5 | `+1` |

La imagen 4 borra los tres votos que llevaba. La decisión llega hasta la imagen 9. Cuesta unas imágenes más, pero un cuadro malo no puede elegir mal. Como `on_image` descarta imágenes a menos de 0,09 s de la anterior, cinco seguidas necesitan al menos unos 0,36 s. En el Open lab la decisión llega 0,3 s después de Start; un comentario del código del lab dice que en Gazebo la cámara confirmaba el sentido antes de 0,44 s desde Start. Es un dato del código, no una medida nueva.

### Cómo usa la misión el sentido

La misión ya lo espera desde el paso 7. En `_setup`, con el giroscopio calibrado:

```python
if not self.direction and camera:
    self.direction = 'ccw' if camera > 0 else 'cw'
if self.direction:
    self.state, self.travelled = 'RUN', 0.0
elif self._time >= DIRECTION_TIMEOUT:
    self._stop('direction_fault')
```

Con `'auto'` la misión espera hasta 15 s a que `camera` sea distinto de 0. Si no llega, **se detiene** (`DIRECTION_FAULT`) en vez de apostar a un lado. Parar es mejor que adivinar. El sentido también decide en qué lado está la isla (`sign` en `_run`) y en qué dirección se gira cada esquina. Una vez decidido, la misión **no vuelve a mirar la cámara**: el sentido no cambia durante la ronda.

`StrategyBase` pone `camera = 0` si el último voto tiene más de 0,5 s: una cámara que se cae no deja un voto viejo vivo.

### El nodo: `on_image`

La cámara publica `/camera/image`. El nodo decide en `on_image`:

```python
def on_image(self, msg):
    stamp = msg.header.stamp.sec + msg.header.stamp.nanosec * 1e-9
    if self.image_stamp is not None and stamp - self.image_stamp < 0.09:
        return                                       # one frame in two is enough
    self.image_stamp, self.image_time = stamp, self.now()
    blue, orange = line_lengths(self.bridge.imgmsg_to_cv2(msg, desired_encoding='bgr8'))
    self.strategy.on_camera(self.vote.update(blue, orange))
```

Se descartan las imágenes que llegan a menos de 0,09 s de la anterior, para no gastar CPU de más. `image_time` guarda cuándo llegó la última, y `control` calcula su edad para pasársela a `strategy.control(dt, age)`.

## Escríbelo

Son dos cambios: un archivo nuevo y seis retoques en `drive.py`.

### Etapa 1: `direction.py`

Crea `src/my_open/my_open/direction.py` con la clase `DirectionVote`. Tiene `candidate` (por qué votó la última imagen), `hits` (cuántas seguidas), `direction` (la decisión) y `update(blue_length, orange_length)`, que devuelve `+1`, `-1` o `0`.

**Pistas para `update`.**

1. Calcula `longest = max(blue_length, orange_length)` y `confidence = abs(blue_length - orange_length) / max(longest, 1.0)`. El `max(..., 1.0)` evita dividir entre cero cuando no hay líneas.
2. La imagen vota `+1` si `blue_length > orange_length`, `-1` si no, pero solo cuando `longest >= MIN_LENGTH` y `confidence >= MIN_CONFIDENCE`. Si no, vota 0.
3. Si vota y coincide con `candidate`, suma 1 a `hits`; si vota algo distinto, `hits = 1`; si no vota, `hits = 0`. Después guarda `candidate = vote`.
4. `direction` es el voto si `hits >= CONFIRMATIONS` y 0 en otro caso. Devuélvelo.

Corre las pruebas antes de mirar la referencia:

```bash
python3 -m pytest course/tests/test_step_8.py -q
```

Esperado: `7 passed`.

<details>
<summary>Ver la referencia de direction.py</summary>

```python
"""Step 8 - The direction of the lap: which coloured line is longer, confirmed over several frames."""

MIN_LENGTH = 40.0        # px: shorter lines are noise
MIN_CONFIDENCE = 0.25    # how much longer one line must be than the other: |blue - orange| / the longest
CONFIRMATIONS = 5        # consecutive frames that must agree


class DirectionVote:
    """Turns the length of the blue and orange lines seen in each camera frame into a decision.

    Blue longer -> +1 (counter-clockwise lap); orange longer -> -1 (clockwise); unsure -> 0. A frame only counts when
    the longest line is at least ``MIN_LENGTH`` pixels and the lines differ by at least ``MIN_CONFIDENCE``; the
    decision needs ``CONFIRMATIONS`` such frames in a row that name the same direction.
    """

    def __init__(self):
        self.candidate = 0       # what the last frame voted for (0: nothing clear)
        self.hits = 0            # consecutive frames that voted for it
        self.direction = 0

    def update(self, blue_length, orange_length):
        """Feed one frame's two line lengths (pixels). Returns the decision so far: +1, -1 or 0."""
        longest = max(blue_length, orange_length)
        confidence = abs(blue_length - orange_length) / max(longest, 1.0)
        vote = 0
        if longest >= MIN_LENGTH and confidence >= MIN_CONFIDENCE:
            vote = 1 if blue_length > orange_length else -1
        self.hits = self.hits + 1 if vote and vote == self.candidate else (1 if vote else 0)
        self.candidate = vote
        self.direction = vote if self.hits >= CONFIRMATIONS else 0
        return self.direction
```

</details>

### Etapa 2: `drive.py`

Haz estos seis cambios sobre el `drive.py` del paso 7:

1. **Imports:** `CvBridge` (de `cv_bridge`), `Image` (junto a `Imu` y `LaserScan`), `line_lengths` (de `robotek_course.vision`) y `DirectionVote` (de `.direction`).
2. **El sentido:** cambia el valor por defecto del parámetro `direction` de `'ccw'` a `'auto'`, y borra el comentario que decía que la cámara llegaba en el paso 8.
3. **Atributos nuevos** en `__init__`: `self.vote = DirectionVote()`, `self.bridge = CvBridge()`, `self.image_time = None` y `self.image_stamp = None`.
4. **Suscripción** a `/camera/image` con `on_image` (calidad de servicio de sensor, como `/scan`).
5. **El método `on_image`** de arriba.
6. **`control`:** calcula la edad de la imagen (`age = self.now() - self.image_time`, o `math.inf` si no ha llegado ninguna) y pásala a `self.strategy.control(1.0 / CONTROL_RATE, age)`.

Sin imágenes la edad es infinita, el voto se anula y la misión espera. La referencia, además, agrupa en `main` las dos últimas líneas bajo `if rclpy.ok():`; es un cambio cosmético.

<details>
<summary>Ver la referencia de drive.py (versión de este paso, completa)</summary>

```python
"""The ROS node: sensors in, /cmd_vel_raw out. The decisions are in strategy.py."""
import math

from cv_bridge import CvBridge
from geometry_msgs.msg import Twist
import rclpy
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, qos_profile_sensor_data
from sensor_msgs.msg import Image, Imu, LaserScan
from std_msgs.msg import Bool, String

from robotek_common.vehicle import WHEELBASE
from robotek_course.watchdog import SensorWatchdog
from robotek_course.vision import line_lengths

from .direction import DirectionVote
from .strategy import Strategy

CONTROL_RATE = 50.0       # Hz, on the simulation clock


class Drive(Node):
    def __init__(self):
        super().__init__('strategy')
        self.strategy = Strategy(self.declare_parameter('direction', 'auto').value)
        self.watchdog = SensorWatchdog()                   # brake if the LiDAR or the gyroscope go quiet
        self.strategy.auto_start = False                 # the referee (or the button on the car) publishes /start
        self.vote = DirectionVote()
        self.bridge = CvBridge()
        self.image_time = None
        self.image_stamp = None
        self.cmd = self.create_publisher(Twist, '/cmd_vel_raw', 10)
        self.create_subscription(LaserScan, '/scan', self.on_scan, qos_profile_sensor_data)
        self.create_subscription(Imu, '/imu', self.on_imu, qos_profile_sensor_data)
        self.state = self.create_publisher(
            String, '/robotek/state', QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL))
        self.state_sent = None
        self.create_subscription(Image, '/camera/image', self.on_image, qos_profile_sensor_data)
        self.create_subscription(Bool, '/robotek/stop', self.on_stop, 10)      # the button again: stop the car
        self.create_subscription(Bool, 'start', self.on_start, 10)   # plain QoS: works with the referee and with the car's button
        self.create_timer(1.0 / CONTROL_RATE, self.control)

    def on_scan(self, msg):
        self.watchdog.scan(self.now())
        self.strategy.on_scan(msg)

    def on_imu(self, msg):
        self.watchdog.imu(self.now())
        self.strategy.on_imu(self.now(), msg.angular_velocity.z)

    def on_image(self, msg):
        stamp = msg.header.stamp.sec + msg.header.stamp.nanosec * 1e-9
        if self.image_stamp is not None and stamp - self.image_stamp < 0.09:
            return                                       # one frame in two is enough
        self.image_stamp, self.image_time = stamp, self.now()
        blue, orange = line_lengths(self.bridge.imgmsg_to_cv2(msg, desired_encoding='bgr8'))
        self.strategy.on_camera(self.vote.update(blue, orange))

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
            age = self.now() - self.image_time if self.image_time is not None else math.inf
            speed, steer = self.strategy.control(1.0 / CONTROL_RATE, age)
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
            node.cmd.publish(Twist())
            rclpy.shutdown()
```

</details>

## Pruébalo

Pruebas sin ROS ni Gazebo:

```bash
python3 -m pytest course/tests/test_step_8.py -q
```

Son 7 pruebas: cinco imágenes claras seguidas deciden, naranja es `cw`, líneas parecidas no deciden, líneas cortas no deciden, una imagen mala reinicia la cuenta, cambiar de opinión necesita cinco imágenes otra vez y sin líneas no hay decisión.

Ahora las dos direcciones en Gazebo, una tras otra:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=ccw
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=cw
```

El argumento `direction` de `round.launch.py` solo hace que el coche **aparezca** mirando a un lado u otro; el nodo no lo recibe, así que lo decide la cámara. Qué mirar en cada ronda: en la terminal, `Start`; con la ventana abierta, que el coche espera un instante quieto y luego arranca hacia el lado correcto; y al final el resultado del árbitro. La solución de referencia midió, en **Gazebo**:

| Sentido | Puntos | Tiempo desde Start | Vueltas (s) | Margen mínimo | Válida |
|---|---:|---:|---|---:|:---:|
| `ccw` | 30 de 30 | 34,80 s | 10,9 / 10,6 / 11,0 | 11,9 cm | sí |
| `cw` | 30 de 30 | 34,90 s | 10,9 / 10,6 / 11,0 | 11,1 cm | sí |

Son estimaciones de simulación, no puntuación oficial. Para el tiempo, lo importante es la diferencia entre sentidos: en Gazebo son 0,1 s; en el Open lab, 0 s en `square100` (32,58 s los dos). Si el coche va bien en un sentido y en el otro no, mira el apartado de abajo.

### Rómpelo

Antes de correr, **predice** y apunta tu respuesta. Pon `CONFIRMATIONS = 1` en `direction.py`.

1. Con la secuencia de la tabla de arriba, ¿en qué imagen decide ahora?
2. Envía `(300, 60)` tres veces, después **un solo cuadro** `(60, 300)` (naranja claro) y otra vez `(300, 60)` tres veces. ¿Qué decisión sale en cada imagen?
3. Corre `test_step_8.py`: ¿cuántas pruebas fallan?

Qué se mide con el `DirectionVote` de la referencia: con `CONFIRMATIONS = 1` la secuencia de la tabla decide ya en la imagen 1 (`+1, +1, +1, 0, +1, +1, +1, +1, +1`); con 5, hasta la imagen 9. En la segunda secuencia, con 1 la decisión salta a `-1` en ese cuadro y vuelve a `+1` (`+1, +1, +1, -1, +1, +1, +1`); con 5, la decisión se queda en `0` en las siete imágenes: el cuadro raro reinicia la cuenta y nunca llega a cinco. Y fallan 3 de las 7 pruebas (`test_five_clear_frames_in_a_row_decide`, `test_one_bad_frame_restarts_the_count` y `test_changing_its_mind_needs_five_frames_again`). En el coche, con 1 una imagen suelta sería un reflejo que empieza la ronda al revés.

Una pregunta abierta: con `CONFIRMATIONS` más alto el coche tarda más en decidir, y mientras tanto está parado y el reloj de la ronda corre. Cada imagen más son al menos 0,09 s. ¿Cuánto vale esa espera en una ronda de unos 35 s, y cuánta seguridad te compra?

## Si algo falla

- **Se queda en `DETECT_DIRECTION` y a los 15 s sale `DIRECTION_FAULT`.** La misión no recibe votos. Comprueba que llegan imágenes (`ros2 topic hz /camera/image`) y que `on_image` llama a `on_camera`. Imprime `blue, orange`: deben ser números grandes y distintos.
- **Da la vuelta al revés.** El signo del voto está invertido: azul más larga debe dar `+1`, y la misión traduce `+1` a `'ccw'`.
- **Decide mal solo en `cw`.** Revisa que usas `abs(...)` en la confianza y que el voto depende de qué línea es mayor, no del orden en que llegan.
- **Las pruebas pasan pero Gazebo no decide.** Las pruebas no usan imágenes. Revisa la conexión del nodo (la suscripción a `/camera/image`, el `Strategy(...)` con `'auto'`), no `DirectionVote`.

## Una advertencia sobre el coche real

Estos rangos de color son los del **simulador**. En la vida real la «naranja» es roja y la pared beige de la sala se confundía con ella. Según el registro del equipo, la primera ronda real del 8 de octubre chocó contra el muro a los 2,9 s: el color de la pared de la sala se confundió con una línea. El coche del equipo usa una máscara del suelo y rangos propios; este curso solo te hace escribir la votación. Más en el capítulo 10.

Algo parecido pasa con el Open lab (paso 9): su cámara simulada **no genera imágenes**, entrega el sentido directamente tras un retardo. Solo Gazebo prueba `line_lengths` y tu votación juntos.

## Resumen

- Una imagen vota (`+1`, `-1` o `0`) comparando el largo en píxeles de la línea azul y la naranja; para votar, la más larga mide 40 px o más y la confianza llega a 0,25.
- La decisión necesita cinco votos seguidos iguales; una imagen mala reinicia la cuenta. Sin decisión en 15 s, la misión se detiene en vez de adivinar.
- El sentido se decide una sola vez, en `SETUP`; el nodo solo traduce `/camera/image` a votos.

## Antes de seguir

- [ ] `python3 -m pytest course/tests/test_step_8.py -q` da `7 passed`.
- [ ] Hiciste una ronda `ccw` y otra `cw` en Gazebo y las dos dan 30 de 30.
- [ ] Sabes por qué con `CONFIRMATIONS = 1` el coche decide antes pero es más frágil.
- [ ] Sabes que el lab no prueba la cámara y Gazebo sí.

## Compara

```bash
bash tools/compare-step.sh 7 8     # qué añade la referencia
bash tools/compare-step.sh 8       # tu árbol contra el paso 8
```
