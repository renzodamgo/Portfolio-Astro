---
guide: "open-strategy"
order: 5
slug: "paso-5-la-esquina"
title: "La esquina"
summary: "Detecta y recorre una esquina del campo."
tag: "step-5"
compareFrom: "step-4"
---

Hasta ahora el coche sigue la pared de la isla. En este paso le enseñas a **girar 90 grados** al llegar a la esquina y a seguir por el pasillo siguiente. Escribes `arc.py`, que decide el volante durante la esquina, y cambias `drive.py` para usarlo una vez. Cuándo girar sigue siendo una regla fija (la pared de enfrente a 1,19 m); la decisión de verdad llega en el paso 6.

## Lo que vas a ver

En Gazebo el coche calibra el giroscopio 0,6 s, sigue la pared de la isla a 0,25 m, y cuando la pared de enfrente queda a 1,19 m o menos gira a la izquierda. Entra en el pasillo del este, sigue la pared de la isla y se detiene ante la pared siguiente. En la referencia, con el modelo de actuadores del coche real, el rumbo verdadero al terminar fue **π/2 + 0,019 rad** (1,1 grados de más) y el coche no tocó ninguna pared.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-5.json"></div>

*Repetición del mini simulador con el servo lento: el coche azul solo con rampa se pasa del giro; el ámbar con anticipación y amortiguamiento no.*

## La idea

### Girar es mover la meta

El rumbo del coche (`yaw`) sale del giroscopio, y la ley del paso 2 lleva el coche hacia un rumbo meta (`goal`). Girar a la izquierda 90 grados es sumar π/2 a esa meta. La ley de carril del paso 4 sigue funcionando: ahora apunta a la meta nueva.

Lo difícil es **cómo** se llega a ella. Si la meta salta de golpe, la ley pide el volante al tope hasta que el error se acaba. Con un servo lento, el volante llega tarde, el coche sigue girando cuando ya debería enderezar y se pasa.

### Una rampa en vez de un salto

En lugar de que la ley siga la meta, sigue una **referencia** (`ref`) que sube desde el rumbo viejo hasta la meta a la velocidad con la que el coche puede girar de verdad. Con el volante al tope (17,6 grados) y el comando de crucero (1,28 m/s, que el motor medido convierte en 0,60 m/s), el coche gira a

```text
rate = real_speed(1.28) * tan(STEER_LIMIT) / WHEELBASE = 0.60 * 0.317 / 0.1174 ≈ 1.62 rad/s
```

Girar 90 grados a esa velocidad son 0,97 s en teoría. `ramp(ref, goal, rate, dt)` mueve `ref` hacia `goal` como mucho `rate * dt` por tick, por el camino corto (aunque cruce ±π). La ley de rumbo, con `KP = 0.8`, sigue a `ref` y no a `goal`.

La rampa no es una mejora por sí sola. Hace que la esquina y la recta usen la misma ley de rumbo, y dice qué velocidad de giro se espera en cada instante, un dato que usan los dos términos siguientes. Más abajo hay medidas.

### Dos términos más: anticipar y amortiguar

**Feed-forward (acción anticipada).** Mientras la referencia sube sabemos que el volante tiene que ir al tope. En vez de esperar a que el error crezca, se suma `sign * STEER_LIMIT` al volante (`sign` es +1 en una esquina a la izquierda y -1 a la derecha). Es una suposición: cuánto gira el coche depende de la batería y del suelo. Si el coche gira más de lo que cree la estrategia, el volante al tope lo pasa de largo. Por eso se **afloja** (*fade*): a menos de `EXIT_ANGLE = 0.25` rad de la meta, el feed-forward se multiplica por `distancia restante / 0.25`, hasta llegar a 0.

**Amortiguamiento.** Un servo contesta tarde. Si el coche ya gira más rápido de lo que la esquina pide, hay que soltar el volante: se resta `DAMPING * (gyro - rate_ff)`, con `DAMPING = 0.1` rad por rad/s. `gyro` es la velocidad de giro medida y `rate_ff` la esperada (`sign * rate` mientras sube la referencia, también aflojada).

La fórmula completa de un tick es

```text
steer = KP * wrap(ref - yaw) + steer_ff - DAMPING * (gyro - rate_ff)      (dentro del tope del volante)
```

### Pruébalo con el widget

El widget dibuja el rumbo contra el tiempo en una esquina de 90 grados y muestra el sobrepaso. Tiene controles para el retraso del servo, el feed-forward, el aflojado y el amortiguamiento. Antes de moverlos, predice qué va a pasar.

<div data-widget="corner"></div>

Las cifras de abajo no salen del widget sino del laboratorio de Python del curso, así que si no coinciden al milímetro, manda el laboratorio.

### Qué enseña cada término (medido en el laboratorio de Python)

El mini simulador del curso (`course/tests/helpers.py`, función `run_arc`) corre una sola esquina a la izquierda con el modelo del servo real: 0,06 s de retraso y 0,05 s de inercia. Se comparan tres situaciones:

1. **Servo real.**
2. **Servo lento:** 0,15 s de retraso y 0,10 s de inercia.
3. **El coche gira más rápido de lo que cree la estrategia:** se le dice a la estrategia que el giro máximo es 0,7 del verdadero.

Sobrepaso máximo, en grados, medido en el laboratorio de Python:

| Variante | 1) Servo real | 2) Servo lento | 3) Gira más rápido |
|---|---:|---:|---:|
| solo rampa | 0,2 | **10,7** | 0,1 |
| + feed-forward | 0,8 | **10,6** | **17,5** |
| + feed-forward + aflojado | 0,8 | **10,6** | 0,3 |
| + amortiguamiento | 0,4 | 0,2 | **17,3** |
| + aflojado + amortiguamiento (final) | 0,4 | **0,2** | **0,0** |
| sin rampa, solo amortiguar | 0,0 | 0,1 | 0,0 |

Cada término arregla **un** problema y no el otro:

- El amortiguamiento arregla el servo lento (10,6 a 0,2 grados), pero no el feed-forward equivocado (17,3).
- El aflojado arregla el feed-forward equivocado (17,5 a 0,3), pero no el servo lento (10,6).
- La rampa sola **no** evita el sobrepaso del servo lento (10,7 grados).

También cambia el tiempo hasta quedar a 0,12 rad de la meta. Con el servo real, la rampa sola tarda 1,14 s, el final 1,10 s y el salto de golpe 1,28 s. Si la estrategia cree que el coche gira menos de lo que gira (caso 3), la rampa sola tarda 1,52 s y el final 1,20 s: el feed-forward es lo que hace la esquina más rápida.

Con el servo real, **todas** las variantes quedan por debajo de 1 grado: la esquina es fácil. El laboratorio solo muestra por qué existen el aflojado y el amortiguamiento con un servo o una estimación peores. Según la guía anterior del equipo, en 27 rondas de ablación en Gazebo quitar uno de los dos sí rompió rondas; esa cifra viene de su registro y no la repetí con este paquete.

## Escríbelo

1. **Crea `src/my_open/my_open/arc.py`** con `ramp`, las constantes `DAMPING` y `EXIT_ANGLE` y `arc_steer`.
2. **Edita `drive.py`** para dar una esquina a la izquierda y parar ante la pared siguiente.

**Pistas para `arc.py`.** Importa `STEER_LIMIT`, `clamp` y `wrap` de `robotek_course.minisim`, y `KP` de `.heading`.

1. `ramp(ref, goal, rate, dt)`: calcula `gap = wrap(goal - ref)`. Si `abs(gap) <= rate * dt`, devuelve `goal` (llega y se detiene). Si no, avanza `rate * dt` hacia el lado de `gap` (`math.copysign`) y aplica `wrap`.
2. La firma de `arc_steer` es `arc_steer(goal, ref, yaw, gyro, rate, dt, sign=1, feed=True, fade=True, damping=DAMPING)` y devuelve `(steer, ref)`. Las pruebas apagan piezas con `feed=False`, `fade=False` y `damping=0.0`, así que tienen que estar.
3. Primero solo la rampa: `ramping = ref != goal` (**antes** de mover `ref`), `ref = ramp(...)` y `steer = KP * wrap(ref - yaw)` dentro del tope. Con eso pasan las primeras pruebas.
4. Feed-forward: mientras `ramping` y `feed`, `steer_ff = sign * STEER_LIMIT` y `rate_ff = sign * rate`; si no, los dos valen 0.
5. Aflojado: `scale = min(1.0, max(0.0, sign * wrap(goal - yaw)) / EXIT_ANGLE)` si `fade`, y 1.0 si no. Multiplica `steer_ff` y `rate_ff` por `scale`.
6. Amortiguamiento: resta `damping * (gyro - rate_ff)` y limita el resultado con `clamp(steer, -STEER_LIMIT, STEER_LIMIT)`.

**Pistas para `drive.py`.**

- Estado nuevo: `goal`, `ref` (los dos en 0), `arc` (hay una esquina en curso) y `corners` (esquinas hechas).
- La escena se mide **a lo largo de la pista**: en `on_scan` pasa `forward_yaw=wrap(self.goal - self.heading.yaw)` a `perceive`. Así, con la meta nueva, la pared de enfrente es la del pasillo siguiente.
- El giroscopio para amortiguar es `self.gyro - self.heading.bias`: el sesgo ya medido se quita.
- Cuando `not arc` y la pared de enfrente está a `TURN_FRONT` o menos: si `corners == 0`, suma π/2 a la meta y pon `arc = True`; si no, el coche se detiene.
- En `arc`, llama a `arc_steer` con `rate` y velocidad `SPEED`. Cuando `abs(wrap(goal - yaw)) <= TURN_TOLERANCE`, la esquina acaba: `arc = False`, `ref = goal` y `corners += 1`.
- Fuera de la esquina y sin detenerse, la ley de carril del paso 4, pero apuntando a `self.goal` y no a 0.

Antes de abrir la referencia, corre las pruebas y mira cuáles pasan con solo la rampa.

<details>
<summary>Ver la referencia de arc.py</summary>

```python
import math

from robotek_course.minisim import STEER_LIMIT, clamp, wrap
from .heading import KP


def ramp(ref, goal, rate, dt):
    """Move the reference heading ``ref`` towards ``goal`` by at most ``rate * dt`` radians (the short way round)."""
    gap = wrap(goal - ref)
    if abs(gap) <= rate * dt:
        return goal
    return wrap(ref + math.copysign(rate * dt, gap))


DAMPING = 0.1        # steering (rad) per rad/s of yaw-rate error
EXIT_ANGLE = 0.25    # rad: the feed-forward fades out over the last quarter radian


def arc_steer(goal, ref, yaw, gyro, rate, dt, sign=1, feed=True, fade=True, damping=DAMPING):
    """One tick of a corner: the ramp plus two terms. ``sign`` is +1 for a left turn, -1 for a right one.

    * feed-forward: while the reference is still climbing, add full lock (``sign * STEER_LIMIT``) and expect the yaw
      rate ``sign * rate``; with ``fade`` both shrink to zero over the last ``EXIT_ANGLE`` before the goal;
    * damping: subtract ``damping`` times how far the measured yaw rate is from the expected one.
    """
    ramping = ref != goal
    ref = ramp(ref, goal, rate, dt)
    scale = min(1.0, max(0.0, sign * wrap(goal - yaw)) / EXIT_ANGLE) if fade else 1.0
    steer_ff, rate_ff = (sign * STEER_LIMIT * scale, sign * rate * scale) if (ramping and feed) else (0.0, 0.0)
    steer = KP * wrap(ref - yaw) + steer_ff - damping * (gyro - rate_ff)
    return clamp(steer, -STEER_LIMIT, STEER_LIMIT), ref
```

`ramping` se calcula antes de mover `ref`: en el tick en que la referencia llega a la meta todavía cuenta como rampa. El aflojado usa el rumbo **verdadero** (`yaw`), no la referencia, porque lo que importa es cuánto falta de verdad.

</details>

<details>
<summary>Ver la referencia de drive.py (versión de este paso)</summary>

Conserva del paso 4 los publicadores, `on_imu`, `on_start` y `main`. Estas son las partes que cambian.

Imports y constantes:

```python
from robotek_course.minisim import STEER_LIMIT, Scene, real_speed, wrap

from .arc import arc_steer

TURN_FRONT = 1.19         # m: the corner starts when the wall ahead is this near
TURN_TOLERANCE = 0.12     # rad: the corner is done within this of the goal heading
```

En `__init__`, junto al estado del paso 4:

```python
self.goal = self.ref = 0.0           # the heading to hold, and the ramped reference of the corner
self.arc = False                     # True while the corner is in progress
self.corners = 0                     # corners finished
```

En `on_scan`, la escena se mide a lo largo de la meta:

```python
self.scene = perceive(msg, forward_yaw=wrap(self.goal - self.heading.yaw), sign=1)
```

Y en `control`, dentro de la rama que ya calibró el giroscopio, después de `yaw = self.heading.update(self.gyro, dt)`:

```python
gyro = self.gyro - self.heading.bias
if not self.arc and self.scene.front_axis <= TURN_FRONT:
    if self.corners == 0:
        self.goal = wrap(self.goal + math.pi / 2)        # a left corner: the goal turns 90 degrees
        self.arc = True
        self.get_logger().info('Giro a la izquierda')
    else:
        self.stopped = True
if self.arc:
    rate = real_speed(SPEED) * math.tan(STEER_LIMIT) / WHEELBASE      # yaw rate at full lock
    steer, self.ref = arc_steer(self.goal, self.ref, yaw, gyro, rate, dt, sign=1)
    speed = SPEED
    if abs(wrap(self.goal - yaw)) <= TURN_TOLERANCE:                  # the corner is done
        self.arc, self.ref = False, self.goal
        self.corners += 1
elif not self.stopped:
    inner = self.scene.left if math.isfinite(self.scene.left) else GAP
    speed, steer = SPEED, lane_steer(self.goal, yaw, inner, sign=1)
```

La velocidad ordenada es `SPEED = 1.28`, la misma de la esquina y de la recta. En la recta, `lane_steer` apunta a `self.goal`: tras la esquina el coche mantiene el rumbo nuevo.

</details>

## Pruébalo

Primero las pruebas, sin ROS ni Gazebo (en macOS con RoboStack añade `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` delante):

```bash
python3 -m pytest course/tests/test_step_5.py -q
```

Son 10 pruebas sobre una esquina del mini simulador:

- La referencia sube a la velocidad dada, llega y se detiene; baja o cruza ±π por el camino corto.
- Con solo la rampa, la esquina izquierda cierra en menos de 1,6 s con menos de 3 grados de sobrepaso; la derecha es el espejo.
- El volante nunca pasa del tope (0,30718 rad).
- Con el servo real, la esquina final se pasa menos de 2 grados y no es más lenta que con solo la rampa.
- Con el servo lento, sin amortiguar el sobrepaso supera 5 grados y con amortiguar baja de 2.
- Si el coche gira más rápido de lo que cree la estrategia, sin aflojado el sobrepaso supera 10 grados y con aflojado baja de 2.
- El feed-forward cierra la esquina antes que la rampa sola.
- La rampa no es lo que evita el sobrepaso (sin rampa también baja de 2 grados), pero no hace la esquina más lenta.

Después, compila y comprueba el paso en Gazebo, sin ventana:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash
python3 course/verify_step.py 5
```

Arranca el simulador y tu nodo, publica Start, graba la pose real del coche (tu nodo no la ve) y escribe `PASS` o `FAIL`. El rumbo verdadero debe quedar a menos de 0,12 rad de π/2. En la referencia midió:

```text
  [OK] tras la primera esquina el rumbo es pi/2 +0.019 rad (limite +-0.12)
Paso 5: PASS
```

Las otras líneas `[OK]` dicen que el coche está en el pasillo del este, que se detuvo y que no tocó ninguna pared. Una línea `[FALLA]` te dice cuál de esas condiciones no se cumplió. Si prefieres ver el coche, lanza el simulador con ventana, tu nodo y Start en tres terminales:

```bash
ros2 launch robotek_course sim.launch.py
ros2 run my_open drive --ros-args -p use_sim_time:=true
ros2 topic pub --once --qos-durability transient_local --qos-reliability reliable /start std_msgs/msg/Bool "{data: true}"
```

### Rómpelo

Antes de correr, **predice**. Esta prueba de laboratorio (desde la raíz del repositorio) quita el amortiguamiento con el servo lento:

```bash
PYTHONPATH=course/tests:src/my_open:src/robotek_course:src/robotek_common python3 - <<'EOF'
import math
from functools import partial
from helpers import run_arc
from my_open.arc import arc_steer

slow = dict(servo_delay=0.15, servo_tau=0.10)
for name, fn in [('sin amortiguar', partial(arc_steer, damping=0.0)), ('completo', arc_steer)]:
    r = run_arc(fn, **slow)
    print(name, round(math.degrees(r['overshoot']), 1), 'grados', round(r['t_close'], 2), 's')
EOF
```

Con la referencia salió `sin amortiguar 10.6 grados 1.2 s` y `completo 0.2 grados 1.2 s`. Repite con `partial(arc_steer, fade=False, damping=0.0)` y `rate_factor=0.7` en `run_arc` y compara: salen 17,5 grados. ¿Qué pieza lo arregla?

Otro intento: pon `DAMPING = 0.0` en tu `arc.py` y corre las pruebas. Fallan dos: la del servo lento y la que compara con el salto de golpe. Y si pones `EXIT_ANGLE = 0`, `arc_steer` divide entre cero; para apagar el aflojado usa `fade=False`.

## Si algo falla

- **El coche gira a la derecha o nunca termina la esquina.** El signo: una esquina a la izquierda suma π/2 a la meta y llama a `arc_steer` con `sign=1`. Revisa que `wrap` se aplique a `goal - yaw` y que la tolerancia use `abs`.
- **Gira, pero se pasa de 90 grados y roza la isla.** Revisa el signo del amortiguamiento: se **resta** `damping * (gyro - rate_ff)`. Y que el aflojado use `sign * wrap(goal - yaw)`, no la referencia.
- **Gira antes de tiempo o no gira.** Mira `front_axis` en la escena: debe medirse con `forward_yaw=wrap(self.goal - self.heading.yaw)`. Si usas siempre 0, tras la esquina el coche mide la pared equivocada.
- **Tras la esquina el coche se va de lado.** `lane_steer` debe apuntar a `self.goal`, no a 0.
- **`[FALLA] no hay poses` o el coche no se mueve.** No le llegó Start. Revisa que `on_start` use `TRANSIENT_LOCAL`, como en el paso 1.
- **`[FALLA]` con el rumbo lejos de π/2 pero sin contacto.** Mira el rumbo que imprime el comprobador y compara con la tabla de arriba: un sobrepaso grande apunta al amortiguamiento (servo lento) o al aflojado (el coche gira más de lo esperado).

## Compara

Lo que cambia la referencia respecto al paso 4, y tu árbol contra el paso 5:

```bash
bash tools/compare-step.sh 4 5
bash tools/compare-step.sh 5
```

Importa comparar `arc.py`. En `drive.py` el bloque de la esquina debe ser equivalente; las diferencias de nombres o de formato no importan.
