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

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/Q0IPYlIK-4A" title="Detecting colors (Hsv Color Space) - Opencv with Python" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Detecting colors (Hsv Color Space) - Opencv with Python</strong> · Pysource (inglés). El espacio HSV, inRange y máscaras en Python: lo que usa la votación de la cámara.</figcaption>
</figure>
</div>
<!-- videos:end -->

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

> **Antes de escribirlo, juega un rato.** Aquí la dirección es una sorpresa, porque es aleatoria, y el código no sabe hacia dónde mira el coche: solo ve las líneas. Abre la cámara (tecla **C**), mira qué color es más largo y adivina el sentido antes de arrancar: el coche no se mueve hasta que eliges. ¿Acertaste?
>
> [Abrir el simulador con el reto de este paso](/learn/open-strategy/simulador/?paso=8)

## Escríbelo

> **En este paso**
> - **Escribes:** `direction.py`, un archivo nuevo con la clase `DirectionVote` y una sola función, `update`, en 2 trocitos.
> - **Copias hecho:** `drive.py` (el nodo que lee la cámara y le pasa los dos números a `DirectionVote`); no hace falta entenderlo todavía.

Primero copia el nodo. Ejecuta esto desde la raíz del repositorio:

```bash
git fetch --tags
git show step-8:src/my_open/my_open/drive.py > src/my_open/my_open/drive.py
```

Ahora crea el archivo vacío `src/my_open/my_open/direction.py` y sigue con los dos trocitos.

### Paso 8.1: una imagen vota

Cada imagen de la cámara llega convertida en dos números: el largo en píxeles de la línea azul y de la naranja. Si una es claramente más larga, la imagen vota por ella. Es una votación de una sola persona: puede equivocarse, y por eso en 8.2 pedirás cinco.

Escribe este **esqueleto** en `direction.py`. Las dos constantes son: `MIN_LENGTH`, el largo mínimo para que una línea cuente (menos es ruido), y `MIN_CONFIDENCE`, cuánto más larga debe ser una línea que la otra.

```python
MIN_LENGTH = 40.0        # px
MIN_CONFIDENCE = 0.25


class DirectionVote:
    def update(self, blue_length, orange_length):
        ...                  # TU CÓDIGO: calcular longest, confidence y vote
        return vote          # provisional: el voto de esta imagen
```

**Pista.** `longest` es el mayor de los dos largos. La confianza es la diferencia entre los dos largos (sin signo, con `abs`) dividida entre `max(longest, 1.0)`; el `max` evita dividir entre cero cuando no hay líneas. `vote` empieza en 0, y solo si `longest >= MIN_LENGTH` y la confianza llega a `MIN_CONFIDENCE` vale `1` (azul más larga) o `-1` (naranja más larga).

```bash
python -m pytest course/tests/test_step_8.py -q -k "orange_means or similar_lines or short_lines or no_lines"
```

Debes ver `4 passed, 3 deselected`.

<details>
<summary>Ver la solución de este paso</summary>

```python
MIN_LENGTH = 40.0        # px: shorter lines are noise
MIN_CONFIDENCE = 0.25    # how much longer one line must be than the other: |blue - orange| / the longest
```

```python
        longest = max(blue_length, orange_length)
        confidence = abs(blue_length - orange_length) / max(longest, 1.0)
        vote = 0
        if longest >= MIN_LENGTH and confidence >= MIN_CONFIDENCE:
            vote = 1 if blue_length > orange_length else -1
```

</details>

### Paso 8.2: cinco votos seguidos

Un reflejo o una sombra pueden engañar a una sola imagen. Por eso la decisión necesita cinco imágenes seguidas que voten lo mismo. Si una falla, la cuenta vuelve a empezar. Es como un jurado: hasta que cinco seguidos no dicen lo mismo, no hay veredicto.

Añade `CONFIRMATIONS = 5` (las imágenes seguidas que deben coincidir) bajo las otras constantes. Pega este `__init__` dentro de la clase, antes de `update`: son tres datos que la clase recuerda.

```python
    def __init__(self):
        self.candidate = 0       # por qué votó la última imagen
        self.hits = 0            # cuántas seguidas votaron lo mismo
        self.direction = 0       # la decisión: +1, -1 o 0
```

En `update`, **sustituye** la línea `return vote` por este esqueleto:

```python
        ...                      # TU CÓDIGO: contar las seguidas y decidir
        return self.direction
```

**Pista.** Si la imagen votó y su voto es igual a `self.candidate`, suma 1 a `self.hits`. Si votó otra cosa, `hits` vale 1. Si no votó, vale 0. Guarda `self.candidate = vote`. Por último, `self.direction` es el voto si `hits >= CONFIRMATIONS` y 0 si no.

```bash
python -m pytest course/tests/test_step_8.py -q
```

Debes ver `7 passed`.

<details>
<summary>Ver la solución de este paso</summary>

```python
CONFIRMATIONS = 5        # consecutive frames that must agree
```

```python
    def __init__(self):
        self.candidate = 0       # what the last frame voted for (0: nothing clear)
        self.hits = 0            # consecutive frames that voted for it
        self.direction = 0
```

```python
        self.hits = self.hits + 1 if vote and vote == self.candidate else (1 if vote else 0)
        self.candidate = vote
        self.direction = vote if self.hits >= CONFIRMATIONS else 0
        return self.direction
```

</details>

<details>
<summary>Para curiosos: qué cambió en drive.py</summary>

El `drive.py` del paso 8 es el del paso 7 con seis cambios. Importa `CvBridge`, `Image`, `line_lengths` y `DirectionVote`. El parámetro `direction` pasa de `'ccw'` a `'auto'`. Crea `self.vote`, `self.bridge`, `self.image_time` y `self.image_stamp`. Se suscribe a `/camera/image`. Añade `on_image` (el método de «La idea»). Y `control` calcula la edad de la última imagen y se la pasa a `self.strategy.control(1.0 / CONTROL_RATE, age)`; sin imágenes la edad es infinita, el voto se anula y la misión espera. Además, la referencia agrupa en `main` las dos últimas líneas bajo `if rclpy.ok():`: es un cambio cosmético.

</details>

## Pruébalo en el simulador

Primero las pruebas, sin ROS ni Gazebo:

```bash
python -m pytest course/tests/test_step_8.py -q
```

Debes ver `7 passed`. Ahora las dos direcciones en Gazebo, una tras otra:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=ccw
```

Debes ver `Start` en la terminal, el coche quieto un instante y luego arrancando hacia la izquierda; al final, el resultado del árbitro. Después repite con `direction:=cw`: el coche debe arrancar hacia el otro lado.

El argumento `direction` de `round.launch.py` solo hace que el coche **aparezca** mirando a un lado u otro; el nodo no lo recibe, así que lo decide la cámara. La solución de referencia midió, en **Gazebo**:

| Sentido | Puntos | Tiempo desde Start | Vueltas (s) | Margen mínimo | Válida |
|---|---:|---:|---|---:|:---:|
| `ccw` | 30 de 30 | 34,80 s | 10,9 / 10,6 / 11,0 | 11,9 cm | sí |
| `cw` | 30 de 30 | 34,90 s | 10,9 / 10,6 / 11,0 | 11,1 cm | sí |

Son estimaciones de simulación, no puntuación oficial. Entre sentidos solo cambian 0,1 s en Gazebo; en el Open lab, 0 s en `square100` (32,58 s los dos).

### Rómpelo

Antes de correr, **predice** y apunta tu respuesta. Pon `CONFIRMATIONS = 1` en `direction.py` y mira la secuencia de la tabla de «La idea». ¿En qué imagen decide ahora? Y si envías `(300, 60)` tres veces, un solo cuadro `(60, 300)` y otra vez `(300, 60)` tres veces, ¿qué decisión sale en cada imagen? Corre también `test_step_8.py`.

Lo que se mide con el `DirectionVote` de referencia: con `CONFIRMATIONS = 1` la secuencia de la tabla decide ya en la imagen 1 (`+1, +1, +1, 0, +1, +1, +1, +1, +1`), y con 5, hasta la imagen 9. En la segunda secuencia, con 1 la decisión salta a `-1` en ese cuadro (`+1, +1, +1, -1, +1, +1, +1`); con 5 se queda en `0` las siete veces. Fallan 3 de las 7 pruebas (`test_five_clear_frames_in_a_row_decide`, `test_one_bad_frame_restarts_the_count` y `test_changing_its_mind_needs_five_frames_again`). En el coche, una imagen suelta sería un reflejo que empieza la ronda al revés.

## Si algo falla

- **Se queda en `DETECT_DIRECTION` y a los 15 s sale `DIRECTION_FAULT`.** La misión no recibe votos. Comprueba que llegan imágenes (`ros2 topic hz /camera/image`) y que `on_image` llama a `on_camera`.
- **Da la vuelta al revés.** El signo del voto está invertido: azul más larga debe dar `+1`, y la misión traduce `+1` a `'ccw'`.
- **Las pruebas pasan pero Gazebo no decide.** Las pruebas no usan imágenes. Revisa que copiaste `drive.py` del paso 8 (la suscripción a `/camera/image` y el `'auto'`), no `DirectionVote`.

## Una advertencia sobre el coche real

Estos rangos de color son los del **simulador**. En la vida real la «naranja» es roja y la pared beige de la sala se confundía con ella. Según el registro del equipo, la primera ronda real del 8 de octubre chocó contra el muro a los 2,9 s: el color de la pared de la sala se confundió con una línea. El coche del equipo usa una máscara del suelo y rangos propios; este curso solo te hace escribir la votación. Más en el capítulo 10.

Algo parecido pasa con el Open lab (paso 9): su cámara simulada **no genera imágenes**, entrega el sentido directamente tras un retardo. Solo Gazebo prueba `line_lengths` y tu votación juntos.


## Resumen

- Una imagen vota `+1`, `-1` o `0` según qué línea sea más larga (40 px o más y confianza de 0,25 o más).
- La decisión necesita cinco votos seguidos iguales; sin decisión en 15 s, la misión se detiene en vez de adivinar.
- El sentido se decide una sola vez, en `SETUP`; el nodo solo traduce `/camera/image` a votos.

## Antes de seguir

- [ ] `python -m pytest course/tests/test_step_8.py -q` da `7 passed`.
- [ ] Hiciste una ronda `ccw` y otra `cw` en Gazebo y las dos dan 30 de 30.
- [ ] Sabes por qué con `CONFIRMATIONS = 1` el coche decide antes pero es más frágil.
