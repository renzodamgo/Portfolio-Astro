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

Después de calibrar, el estado pasa a `DETECT_DIRECTION` y el coche espera con el motor parado. En cuanto la cámara decide, la misión pasa a `RUN`. Con `direction:=cw` el coche aparece mirando hacia el otro lado del campo, la cámara debe votar `-1` y el coche da las tres vueltas al revés. Meta: **30 puntos en los dos sentidos**.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-8.json"></div>

*Repetición de una ronda con la cámara decidiendo el sentido. El fantasma es la misma ronda en sentido horario.*

## La idea

### Dos líneas de colores

Prueba la votación tú mismo. Envía fotogramas con la línea azul más larga y mira cuántos seguidos hacen falta para decidir:

<div data-widget="direction-vote"></div>

En el tapete hay una línea azul y una naranja. La regla del curso es:

- **Azul más larga que naranja:** vuelta antihoraria (`ccw`), voto `+1`.
- **Naranja más larga que azul:** vuelta horaria (`cw`), voto `-1`.
- **No está claro:** `0`.

La cámara solo tiene que medir, en cada imagen, cuántos píxeles mide cada línea. Eso lo hace `line_lengths(bgr)` de `robotek_course.vision`, que **ya te lo dan**. Es trabajo de OpenCV, no el objetivo del curso. Hace lo siguiente: pasa la imagen a HSV, saca una máscara por color (los rangos son los del simulador), cierra huecos, ignora el 8 % superior de la imagen (ahí solo hay pared y sala), descarta manchas pequeñas o que no sean alargadas, y devuelve el largo de la línea más larga de cada color.

Tu parte es lo que viene después: decidir con esos dos números.

### Una imagen puede mentir

Un reflejo, una sombra o una mano cambian los números de una sola imagen. Por eso `DirectionVote` no decide con una imagen, sino con cinco seguidas:

| Constante | Valor | Qué exige |
|---|---:|---|
| `MIN_LENGTH` | 40 px | la línea más larga debe medir al menos esto; menos es ruido |
| `MIN_CONFIDENCE` | 0,25 | `abs(azul - naranja) / la más larga` debe llegar a esto |
| `CONFIRMATIONS` | 5 | imágenes seguidas que nombran el mismo sentido |

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

La imagen 4 borra los tres votos que llevaba. La decisión llega hasta la imagen 9. Cuesta unas imágenes más, pero un cuadro malo no puede elegir mal. Como `on_image` descarta imágenes a menos de 0,09 s de la anterior, cinco seguidas necesitan al menos unos 0,36 s. Un comentario del Open lab dice que en Gazebo la cámara confirmaba el sentido antes de 0,44 s desde Start; es un dato del código, no una medida nueva.

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

Con `'auto'` la misión espera hasta 15 s a que `camera` sea distinto de 0. Si no llega, **se detiene** (`DIRECTION_FAULT`) en vez de apostar a un lado. Parar es mejor que adivinar. El sentido también decide en qué lado está la isla (`sign` en `_run`) y en qué dirección se gira cada esquina.

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

1. **Crea `src/my_open/my_open/direction.py`** con la clase `DirectionVote`. Tiene `candidate` (por qué votó la última imagen), `hits` (cuántas seguidas), `direction` (la decisión) y `update(blue_length, orange_length)`, que devuelve `+1`, `-1` o `0`.
2. **Edita `drive.py`**: importa `CvBridge`, `Image` y `line_lengths`; crea `self.vote = DirectionVote()`, `self.bridge`, `self.image_time` y `self.image_stamp`; suscríbete a `/camera/image` con `on_image`; cambia `Strategy('ccw')` por `Strategy(self.declare_parameter('direction', 'auto').value)`; y en `control` calcula la edad de la imagen y pásala.

**Pistas para `update`.**

1. Calcula `longest = max(blue_length, orange_length)` y `confidence = abs(blue_length - orange_length) / max(longest, 1.0)`. El `max(..., 1.0)` evita dividir entre cero cuando no hay líneas.
2. La imagen vota `+1` si `blue_length > orange_length`, `-1` si no, pero solo cuando `longest >= MIN_LENGTH` y `confidence >= MIN_CONFIDENCE`. Si no, vota 0.
3. Si vota y coincide con `candidate`, suma 1 a `hits`; si vota algo distinto, `hits = 1`; si no vota, `hits = 0`. Después guarda `candidate = vote`.
4. `direction` es el voto si `hits >= CONFIRMATIONS` y 0 en otro caso. Devuélvelo.

Antes de mirar la referencia, corre las pruebas.

<details>
<summary>Ver la referencia de direction.py</summary>

```python
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
        vote = 0
        if longest >= MIN_LENGTH and confidence >= MIN_CONFIDENCE:
            vote = 1 if blue_length > orange_length else -1
        self.hits = self.hits + 1 if vote and vote == self.candidate else (1 if vote else 0)
        self.candidate = vote
        self.direction = vote if self.hits >= CONFIRMATIONS else 0
        return self.direction
```

</details>

<details>
<summary>Ver la referencia de los cambios en drive.py</summary>

```python
from cv_bridge import CvBridge
from sensor_msgs.msg import Image, Imu, LaserScan
from robotek_course.vision import line_lengths

from .direction import DirectionVote
from .strategy import Strategy
```

En `__init__`:

```python
self.strategy = Strategy(self.declare_parameter('direction', 'auto').value)
self.strategy.auto_start = False
self.vote = DirectionVote()
self.bridge = CvBridge()
self.image_time = None
self.image_stamp = None
# ... los publicadores y suscriptores del paso 7, y además:
self.create_subscription(Image, '/camera/image', self.on_image, qos_profile_sensor_data)
```

`on_image` es el método de arriba. Y `control` ahora pasa la edad de la imagen:

```python
def control(self):
    age = self.now() - self.image_time if self.image_time is not None else math.inf
    speed, steer = self.strategy.control(1.0 / CONTROL_RATE, age)
    # ... el resto igual que en el paso 7
```

Sin imágenes, la edad es infinita, el voto se anula y la misión espera.

</details>

## Pruébalo

Pruebas sin ROS ni Gazebo:

```bash
python3 -m pytest course/tests/test_step_8.py -q
```

Son 7 pruebas: cinco imágenes claras seguidas deciden, naranja es `cw`, líneas parecidas no deciden, líneas cortas no deciden, una imagen mala reinicia la cuenta, cambiar de opinión necesita cinco imágenes otra vez y sin líneas no hay decisión.

Ahora las dos direcciones en Gazebo:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=ccw
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=cw
```

El argumento `direction` de `round.launch.py` solo hace que el coche **aparezca** mirando a un lado u otro; el nodo no lo recibe, así que lo decide la cámara. La solución de referencia midió:

| Sentido | Puntos | Tiempo | Vueltas (s) | Margen mínimo | Válida |
|---|---:|---:|---|---:|:---:|
| `ccw` | 30 de 30 | 34,80 s | 10,9 / 10,6 / 11,0 | 11,9 cm | sí |
| `cw` | 30 de 30 | 34,90 s | 10,9 / 10,6 / 11,0 | 11,1 cm | sí |

Estimaciones de simulación, no puntuación oficial. Si el coche va bien en un sentido y en el otro no, mira el apartado de abajo.

### Rómpelo

Antes de correr, **predice**. Pon `CONFIRMATIONS = 1`. Con la secuencia de la tabla, ¿en qué imagen decide ahora? Después mete **un solo cuadro** `(60, 300)` (naranja claro) entre azules: con `CONFIRMATIONS = 1` la decisión pasa a `-1` en ese cuadro; con 5, no cambia. Estos dos casos se comprobaron con el `DirectionVote` de la referencia. Con `CONFIRMATIONS = 1` decide ya en la imagen 1, y en el coche una imagen suelta sería un reflejo que empieza la ronda al revés.

## Si algo falla

- **Se queda en `DETECT_DIRECTION` y a los 15 s sale `DIRECTION_FAULT`.** La misión no recibe votos. Comprueba que llegan imágenes (`ros2 topic hz /camera/image`) y que `on_image` llama a `on_camera`. Imprime `blue, orange`: deben ser números grandes y distintos.
- **Da la vuelta al revés.** El signo del voto está invertido: azul más larga debe dar `+1`, y la misión traduce `+1` a `'ccw'`.
- **Decide mal solo en `cw`.** Revisa que usas `abs(...)` en la confianza y que el voto depende de qué línea es mayor, no del orden en que llegan.
- **Las pruebas pasan pero Gazebo no decide.** Las pruebas no usan imágenes. Revisa la conexión del nodo, no `DirectionVote`.

## Una advertencia sobre el coche real

Estos rangos de color son los del **simulador**. En la vida real la «naranja» es roja y la pared beige de la sala se confundía con ella. Según el registro del equipo, la primera ronda real del 8 de octubre chocó de frente porque la cámara eligió mal el sentido. El coche del equipo usa una máscara del suelo y rangos propios; este curso solo te hace escribir la votación.

Algo parecido pasa con el Open lab (paso 9): su cámara simulada **no genera imágenes**, entrega el sentido directamente tras un retardo. Solo Gazebo prueba `line_lengths` y tu votación juntos.

## Compara

```bash
bash tools/compare-step.sh 7 8     # qué añade la referencia
bash tools/compare-step.sh 8       # tu árbol contra el paso 8
```
