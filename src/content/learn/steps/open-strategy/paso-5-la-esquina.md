---
guide: "open-strategy"
order: 5
slug: "paso-5-la-esquina"
title: "La esquina"
summary: "Detecta y recorre una esquina del campo."
tag: "step-5"
compareFrom: "step-4"
---

Hasta ahora el coche sigue la pared de la isla y se detiene ante la pared de enfrente. En este paso le enseñas a **girar 90 grados a la izquierda** en esa pared y a seguir por el pasillo siguiente. Escribes `arc.py`, que decide el volante durante la esquina: **a tope hasta quedar cerca del rumbo nuevo, y después una ley de rumbo con freno**. `drive.py`, que la usa **una sola vez**, te lo damos hecho. Cuándo girar sigue siendo una regla fija (la pared de enfrente, `front_axis`, a 1,19 m o menos); decidirlo bien es el paso 6.

<!-- step-video:start -->
<figure class="learn-step-video">
<video controls muted playsinline preload="none" poster="/learn/videos/open/paso-5-la-esquina.jpg"><source src="/learn/videos/open/paso-5-la-esquina.mp4" type="video/mp4"></video>
<figcaption>Lo que este capítulo añade a la estrategia, en 38 s de animación sin sonido.</figcaption>
</figure>
<!-- step-video:end -->

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/7dUVdrs1e18" title="Noise Filtering in PID Control | Understanding PID Control, Part 3" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Noise Filtering in PID Control | Understanding PID Control, Part 3</strong> · MATLAB (inglés, 12 min). El término derivativo (el freno sobre la velocidad de giro de este paso) y por qué hay que filtrar su ruido.</figcaption>
</figure>
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/XfAt6hNV8XM" title="Simple Examples of PID Control" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Simple Examples of PID Control</strong> · Brian Douglas (inglés). Cómo cambia la respuesta con cada término.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

En Gazebo el coche calibra el giroscopio 0,6 s, sigue la pared de la isla a 0,25 m y, cuando la pared de enfrente queda a 1,19 m o menos, gira a la izquierda: en la terminal del nodo aparece `Giro a la izquierda`. Entra en el pasillo del este, sigue la pared de la isla y se detiene ante la pared siguiente. En la referencia (con el modelo del coche real) el rumbo verdadero al terminar fue **π/2, con menos de 0,001 rad de diferencia**, y el límite de la prueba es 0,12 rad. No tocó ninguna pared.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-5.json"></div>

*Repetición del mini simulador (no es Gazebo): los dos coches giran con el volante a tope. El fantasma lo suelta a 3 grados del rumbo nuevo y se pasa 12 grados; el coche ámbar lo suelta a 17 grados y no se pasa.*

## La idea

### Girar es mover la meta

Dos nombres que ya conoces del paso 2: `yaw` es el rumbo en el que va el coche (sale del giroscopio) y `goal` es el rumbo al que quieres ir. La ley de rumbo mueve el volante según `goal - yaw`. Girar a la izquierda 90 grados es sumar π/2 a `goal`; la ley de carril del paso 4 sigue igual, solo que ahora apunta a la meta nueva.

Con un error de 90 grados la ley de rumbo pide mucho más volante del que hay (`0,8 × 1,57 = 1,26 rad`, y el tope es 0,307), así que durante casi toda la esquina el volante va **a tope**. No hace falta nada más fino para esa parte: se escribe tal cual.

```text
lejos de la meta:  steer = tope del volante, hacia el lado del giro
```

### Lo difícil es soltar a tiempo

El servo no obedece al instante: tarda 0,06 s en empezar a moverse y luego va a 1,2 rad/s, así que enderezar las ruedas desde el tope le lleva unas tres décimas de segundo. En ese tiempo el coche **sigue girando**. Si esperas a estar casi en el rumbo nuevo para soltar el volante, cuando las ruedas quedan rectas el coche ya se pasó.

La solución es soltar **antes**: el tramo a tope termina cuando faltan `TURN_TOLERANCE = 0.3` rad (17 grados) para la meta. Esos 17 grados que faltan los gira el coche mientras el servo endereza.

```text
si |goal - yaw| > TURN_TOLERANCE:   a tope
si no:                              la esquina terminó; sigue la ley de rumbo
```

A la velocidad de esquina (1,0 m/s pedidos, que el motor convierte en 0,53 m/s) el coche gira a tope a unos 1,4 rad/s: los 73 grados a tope duran poco más de un segundo.

### Un freno para terminar: el amortiguamiento

Al soltar, el coche todavía gira rápido y la ley de rumbo solo mira cuánto falta, no a qué velocidad se acerca. Se le añade un freno: cuanto más rápido gira el coche, menos volante pide.

```text
steer = KP * wrap(goal - yaw) - DAMPING * gyro      (dentro del tope del volante)
```

`gyro` es la velocidad de giro medida (rad/s, ya sin el sesgo) y `DAMPING = 0.1` rad de volante por cada rad/s. Con el coche girando a la izquierda a 1,4 rad/s, el freno quita 0,14 rad de volante: casi la mitad del tope. En las rectas el coche apenas gira y el freno no se nota.

Esta ley con freno es la que usa el coche **siempre que no está a tope**: para terminar la esquina y para toda la recta.

### Pruébalo con el widget

El widget corre una esquina de 90 grados con el mismo banco de pruebas de Python (`run_arc`). Muestra el rumbo y el volante contra el tiempo y el sobrepaso. Puedes elegir el servo (el real o uno lento), a cuántos grados de la meta se suelta el volante y si hay amortiguamiento, y trae cinco intentos guiados. **Antes de pulsar un intento, predice el sobrepaso.**

<div data-widget="corner"></div>

Dos cosas para mirar tú mismo, con «Ver el volante»:

1. Con el servo real, suelta a 3 grados y después a 17. ¿Dónde está el coche cuando las ruedas quedan rectas en cada caso?
2. Con el servo lento y soltando a 17 grados, quita y pon el amortiguamiento. ¿Cuánto cambia el sobrepaso?

<details>
<summary>Ver lo que sale</summary>

1. Soltando a 3 grados las ruedas quedan rectas cuando el coche ya pasó de los 90 (llega a 102). Soltando a 17 quedan rectas justo al llegar: no se pasa.
2. Sin amortiguamiento se pasa 8,6 grados; con él, 6,0. Para ese servo, además, hay que soltar antes: a 29 grados y con amortiguamiento no se pasa.

</details>

Las cifras del widget son las mismas del laboratorio de Python de la sección siguiente.

### Cuándo soltar (medido en el laboratorio de Python)

El mini simulador del curso (`course/tests/helpers.py`, función `run_arc`) corre una sola esquina a la izquierda a la velocidad de esquina. Con el **servo real** (0,06 s de retraso y 0,05 s de inercia):

| Suelta el tope a | Se pasa | Tarda en quedar a 3° de la meta |
|---|---:|---:|
| 3° (0,05 rad) | **12,0°** | 2,10 s |
| 7° (0,12 rad) | **8,7°** | 1,94 s |
| **17° (0,30 rad)** | **0,0°** | **1,36 s** |
| 29° (0,50 rad) | 0,0° | 1,70 s |
| 46° (0,80 rad) | 0,0° | 1,72 s |

Soltar tarde se paga con sobrepaso; soltar demasiado pronto, con tiempo: la ley de rumbo, que pide menos que el tope, tiene que girar lo que falta. 17 grados es el punto en que el coche llega justo.

Con un **servo lento** (0,15 s de retraso y 0,10 s de inercia), sobrepaso en grados:

| Suelta el tope a | Sin amortiguamiento | Con amortiguamiento |
|---|---:|---:|
| 17° (0,30 rad) | 8,6 | 6,0 |
| 29° (0,50 rad) | 8,2 | **0,0** |

Dos cosas se ven aquí:

- Cuánto antes hay que soltar **depende del servo**. Si cambias de servo, este número se vuelve a medir (paso 12).
- El amortiguamiento no cambia nada con el servo real soltando a 17 grados (0,0 en los dos casos), pero es lo que quita el sobrepaso cuando el servo es peor.

> **Antes de escribirlo, juega un rato.** Toma las 4 esquinas de una vuelta sin tocar la pared. Fíjate en cuándo empiezas a girar y en cuándo vuelves a poner el volante recto. ¿Qué haces con el volante justo antes de terminar la esquina?
>
> [Abrir el simulador con el reto de este paso](/learn/open-strategy/simulador/?paso=5)

## Escríbelo

> **En este paso**
> - **Escribes:** un solo archivo, `arc.py`, con 2 funciones pequeñas (`damped_steer` y `arc_steer`), en 3 mini pasos.
> - **Copias hecho:** `drive.py`, la parte de ROS (nodos, tópicos, temporizadores). No hace falta entenderlo todavía.
> - **Resultado:** el coche gira 90 grados a la izquierda sin pasarse.

Copia `drive.py` desde la raíz del repositorio (si no tienes las etiquetas, antes `git fetch --tags`):

```bash
git show step-5:src/my_open/my_open/drive.py > src/my_open/my_open/drive.py
```

Cada mini paso termina con una prueba (en macOS con RoboStack pon `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` delante de `python`). Un **tick** es cada ejecución del control: 50 por segundo, o sea `dt = 0,02 s`.

### Paso 5.1: la ley de rumbo con freno (`damped_steer`)

Es la ley del paso 2 con un término más: se resta volante según lo rápido que ya gira el coche, como el amortiguador de una moto.

Crea `src/my_open/my_open/arc.py` y pega esto. Arriba van los imports (`wrap(a)`, del paso 2, deja un ángulo entre -π y π; `clamp(v, a, b)` deja `v` entre `a` y `b`). `arc_steer` es un marcador para que las pruebas puedan importarlo: lo escribes en el 5.2.

```python
import math

from robotek_course.minisim import STEER_LIMIT, clamp, wrap
from .heading import KP

TURN_TOLERANCE = 0.3     # rad (17 grados): el tramo a tope termina cuando falta esto para la meta
DAMPING = 0.1            # volante (rad) que se quita por cada rad/s que gira el coche


def damped_steer(goal, yaw, gyro, damping=DAMPING):
    steer = KP * wrap(goal - yaw)      # TODO: réstale el freno
    return clamp(steer, -STEER_LIMIT, STEER_LIMIT)


def arc_steer(*args, **kwargs):  # marcador, lo escribes en el 5.2
    ...
```

- **Qué va dentro:** al volante réstale `damping * gyro`. `gyro` es la velocidad de giro medida, positiva si el coche gira a la izquierda.
- **Compruébalo:** `python -m pytest course/tests/test_step_5.py -q -k damping_takes` debe dar `1 passed`.

<details>
<summary>Ver la solución de este paso</summary>

```python
def damped_steer(goal, yaw, gyro, damping=DAMPING):
    return clamp(KP * wrap(goal - yaw) - damping * gyro, -STEER_LIMIT, STEER_LIMIT)
```

</details>

### Paso 5.2: a tope hacia la meta (`arc_steer`)

Durante la esquina el volante va al tope, hacia el lado al que hay que girar. `arc_steer` devuelve **dos** cosas: el volante y si la esquina ya terminó. En este mini paso todavía no termina nunca.

Cambia el marcador de `arc_steer` por esto:

```python
def arc_steer(goal, yaw, gyro, turn_tolerance=TURN_TOLERANCE, damping=DAMPING):
    error = wrap(goal - yaw)
    steer = 0.0                        # TODO: el tope, con el signo de error
    return steer, False
```

- **Qué va dentro:** `math.copysign(STEER_LIMIT, error)` da el tope con el signo de `error`: positivo (izquierda) si la meta está a la izquierda, negativo si está a la derecha. Gracias a `wrap`, el coche gira por el camino corto aunque el rumbo cruce ±π.
- **Compruébalo:** `python -m pytest course/tests/test_step_5.py -q -k "far_from or short_way"` debe dar `2 passed`.

<details>
<summary>Ver la solución de este paso</summary>

```python
def arc_steer(goal, yaw, gyro, turn_tolerance=TURN_TOLERANCE, damping=DAMPING):
    error = wrap(goal - yaw)
    return math.copysign(STEER_LIMIT, error), False
```

</details>

### Paso 5.3: soltar a tiempo

Cuando faltan `turn_tolerance` radianes o menos, la esquina terminó: se suelta el tope y el volante lo decide la ley con freno del 5.1.

Deja `arc_steer` así y completa la condición:

```python
def arc_steer(goal, yaw, gyro, turn_tolerance=TURN_TOLERANCE, damping=DAMPING):
    error = wrap(goal - yaw)
    if True:                           # TODO: solo si falta más que turn_tolerance
        return math.copysign(STEER_LIMIT, error), False
    return damped_steer(goal, yaw, gyro, damping), True
```

- **Qué va dentro:** la condición es `abs(error) > turn_tolerance`.
- **Compruébalo:** `python -m pytest course/tests/test_step_5.py -q` debe dar `11 passed`.

<details>
<summary>Ver la solución de este paso</summary>

Es el archivo completo de la referencia (sin sus docstrings).

```python
import math

from robotek_course.minisim import STEER_LIMIT, clamp, wrap
from .heading import KP

TURN_TOLERANCE = 0.3     # rad (17 deg): the full-lock part ends this short of the goal heading
DAMPING = 0.1            # steering (rad) taken off per rad/s the car is turning


def damped_steer(goal, yaw, gyro, damping=DAMPING):
    return clamp(KP * wrap(goal - yaw) - damping * gyro, -STEER_LIMIT, STEER_LIMIT)


def arc_steer(goal, yaw, gyro, turn_tolerance=TURN_TOLERANCE, damping=DAMPING):
    error = wrap(goal - yaw)
    if abs(error) > turn_tolerance:
        return math.copysign(STEER_LIMIT, error), False
    return damped_steer(goal, yaw, gyro, damping), True
```

</details>

## Pruébalo en el simulador

```bash
python -m pytest course/tests/test_step_5.py -q
colcon build --symlink-install --packages-select my_open && source install/setup.bash && python3 course/verify_step.py 5
```

- **Qué debes ver:** `11 passed` y después `Paso 5: PASS` con `[OK] tras la primera esquina el rumbo es pi/2 ...` a menos de 0,12 rad (en la referencia, -0.000). Una línea `[FALLA]` dice qué condición no se cumplió.
- **En macOS** usa `source tools/macos_env.sh ~/robotek-ros/jazzy` en vez de `source install/setup.bash`.
- **Con ventana:** usa las tres terminales del paso 4 (simulador, tu nodo y Start). En la del nodo sale `Giro a la izquierda`.

### Rómpelo

**Predice** qué pruebas fallan, cambia `arc.py`, corre las pruebas y devuelve el cambio:

1. `TURN_TOLERANCE = 0.05`: fallan 7 de las 11 pruebas. La más clara es `test_a_left_corner_is_finished_and_not_overshot`: el coche se pasa 12 grados.
2. `DAMPING = 0.0`: fallan 3: la del freno, la del servo lento y la de soltar demasiado pronto.

## Si algo falla

- **Gira a la derecha o nunca termina.** El tope lleva el signo de `wrap(goal - yaw)`; revisa que no esté al revés y que la condición compare `abs(error)`.
- **Se pasa de 90 grados.** Mira `TURN_TOLERANCE` (0,3) y que el freno se **reste**.
- **Culebrea al salir de la esquina.** `drive.py` debe dejar de llamar a `arc_steer` cuando esta devuelve que terminó; si vuelve a entrar, el volante salta de tope a tope.
- **`[FALLA]` y el coche no se mueve.** No llegó Start, o `drive.py` no es el de `step-5`: cópialo otra vez y recompila.

Para comparar tu `arc.py` con la referencia usa el cuadro «Compara» al final de la página.

## Resumen

- Girar es sumar 90 grados a `goal` y llevar el volante a tope hacia la meta.
- El tope se suelta 17 grados antes (`TURN_TOLERANCE`), porque el servo tarda en enderezar las ruedas; soltar tarde es pasarse.
- Después manda la ley de rumbo con freno (`damped_steer`), la misma que lleva el coche en las rectas.

## Antes de seguir

- [ ] `python -m pytest course/tests/test_step_5.py -q` da `11 passed`.
- [ ] `python3 course/verify_step.py 5` da `PASS`.
- [ ] Puedes explicar por qué el coche se pasa si suelta el tope a 3 grados de la meta, y qué habría que cambiar con un servo más lento.

<details>
<summary>Para curiosos: cómo funciona drive.py</summary>

`drive.py` es un nodo de ROS: un programa pequeño que habla con otros por canales con nombre (tópicos).

- Se suscribe a `/scan` (LiDAR), `/imu` (giroscopio) y `start`, y publica la velocidad en `/cmd_vel_raw`.
- Un temporizador llama a `control` 50 veces por segundo. Tras Start espera 0,6 s quieto midiendo el sesgo del giroscopio.
- Sigue la isla a 1,28 m/s pedidos con la ley con freno y el desvío del paso 4: `damped_steer(goal + lateral_bias(inner), yaw, gyro)`. Con la pared de enfrente a 1,19 m o menos (`TURN_FRONT`) y en la primera esquina, suma π/2 a `goal` y activa `arc`.
- Mientras `arc`, pide 1,0 m/s y llama a `arc_steer`; cuando esta devuelve que terminó, apaga `arc` y vuelve a la recta. En la segunda pared se detiene.

</details>
