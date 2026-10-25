---
guide: "open-strategy"
order: 5
slug: "paso-5-la-esquina"
title: "La esquina"
summary: "Detecta y recorre una esquina del campo."
tag: "step-5"
compareFrom: "step-4"
---

Hasta ahora el coche sigue la pared de la isla y se detiene ante la pared de enfrente. En este paso le enseñas a **girar 90 grados a la izquierda** en esa pared y a seguir por el pasillo siguiente. Escribes `arc.py`, que decide el volante durante la esquina. `drive.py`, que la usa **una sola vez**, te lo damos hecho. Cuándo girar sigue siendo una regla fija (la pared de enfrente, `front_axis`, a 1,19 m o menos); decidirlo bien es el paso 6.

## Lo que vas a ver

En Gazebo el coche calibra el giroscopio 0,6 s, sigue la pared de la isla a 0,25 m y, cuando la pared de enfrente queda a 1,19 m o menos, gira a la izquierda: en la terminal del nodo aparece `Giro a la izquierda`. Entra en el pasillo del este, sigue la pared de la isla y se detiene ante la pared siguiente. En la referencia (con el modelo del coche real) el rumbo verdadero al terminar fue **π/2 + 0,019 rad**, 1,1 grados de más, y el límite de la prueba es 0,12 rad. No tocó ninguna pared.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-5.json"></div>

*Repetición del mini simulador con un servo lento (no es Gazebo): el fantasma rojo solo lleva rampa y se pasa del giro; el coche ámbar, con anticipación y amortiguamiento, no.*

## La idea

### Girar es mover la meta

Dos nombres que ya conoces del paso 2: `yaw` es el rumbo en el que va el coche (sale del giroscopio) y `goal` es el rumbo al que quieres ir. La ley de rumbo mueve el volante según `goal - yaw`. Girar a la izquierda 90 grados es sumar π/2 a `goal`; la ley de carril del paso 4 sigue igual, solo que ahora apunta a la meta nueva.

Lo difícil es **cómo** se llega a ella. Si `goal` salta de golpe, la ley pide el volante al tope hasta que el error se acaba. Un servo lento tarda en obedecer: cuando por fin enderezas el volante, el coche ya lleva velocidad de giro de sobra y **se pasa** de los 90 grados.

### Una rampa en vez de un salto

En lugar de seguir a `goal`, la ley sigue a una **referencia** (`ref`) que sube desde el rumbo viejo hasta la meta a la velocidad con la que el coche puede girar de verdad. Esa velocidad sale de la fórmula del paso 1 con el volante al tope (17,6 grados) y el comando de crucero (1,28 m/s, que el motor medido convierte en 0,60 m/s):

```text
rate = real_speed(1.28) * tan(STEER_LIMIT) / WHEELBASE = 0.60 * 0.317 / 0.1174 ≈ 1.62 rad/s
```

Girar 90 grados a 1,62 rad/s son 0,97 s en teoría. `ramp(ref, goal, rate, dt)` mueve `ref` hacia `goal` como mucho `rate * dt` por tick, por el camino corto (aunque cruce ±π). La ley de rumbo, con `KP = 0.8`, sigue a `ref`.

La rampa no evita sola el sobrepaso (las medidas están más abajo). Sirve para que la esquina y la recta usen la misma ley, y para saber qué velocidad de giro se espera en cada instante: ese dato lo usan los dos términos siguientes.

### Dos términos más: anticipar y amortiguar

**Feed-forward (acción anticipada).** Mientras `ref` sube, ya sabes que el volante tiene que ir al tope. No hace falta esperar a que el error crezca para pedirlo: se suma `steer_ff = sign * STEER_LIMIT` al volante (`sign` es +1 en una esquina a la izquierda y -1 a la derecha). Es como entrar a una curva girando el volante de golpe en vez de corregir poco a poco. Pero es una suposición: cuánto gira el coche depende de la batería y del suelo. Si gira más de lo que cree la estrategia, el volante al tope lo pasa de largo. Por eso se **afloja** (*fade*): a menos de `EXIT_ANGLE = 0.25` rad de la meta, el feed-forward se multiplica por `distancia restante / 0.25` y llega a 0 en la meta.

**Amortiguamiento (damping).** Es un freno sobre la velocidad de giro. Si el coche ya gira más rápido de lo que la esquina pide, hay que soltar el volante: se resta `DAMPING * (gyro - rate_ff)`, con `DAMPING = 0.1` rad por rad/s. `gyro` es la velocidad de giro medida y `rate_ff` la esperada (`sign * rate` mientras sube la referencia, también aflojada). Con el servo lento es lo que impide el sobrepaso.

La fórmula completa de un tick es

```text
steer = KP * wrap(ref - yaw) + steer_ff - DAMPING * (gyro - rate_ff)      (dentro del tope del volante)
```

### Pruébalo con el widget

El widget corre una esquina de 90 grados con el mismo banco de pruebas de Python (`run_arc`). Muestra el rumbo y el volante contra el tiempo, el sobrepaso y una tabla con los seis controladores de la tabla de más abajo. Tiene tres situaciones (servo real, servo lento y un coche que gira más rápido de lo que cree la estrategia), cuatro casillas para activar cada pieza y cinco intentos guiados. **Antes de pulsar un intento, predice el sobrepaso.**

<div data-widget="corner"></div>

Dos cosas para mirar tú mismo, con «Ver el volante»:

1. Con «2 Servo lento», quita y pon el amortiguamiento. ¿Cuándo cambia de signo el volante pedido, antes o después de llegar a 90°?
2. Con «3 Gira más rápido...» y el feed-forward activo, ¿qué pide el volante en el instante en que el coche llega a 90°? ¿Y con el aflojado?

<details>
<summary>Ver lo que sale</summary>

1. Sin amortiguamiento el volante cambia de signo cuando el coche ya pasó de 90° (a 92,8°), y por eso se pasa. Con amortiguamiento cambia de signo antes de la meta (a 81,7°).
2. Sin aflojado el volante todavía pide unos 12° a la izquierda al llegar a 90°. Con aflojado pide 0,1°.

</details>

Las cifras del widget son las mismas del laboratorio de Python de la sección siguiente.

### Qué enseña cada término (medido en el laboratorio de Python)

El mini simulador del curso (`course/tests/helpers.py`, función `run_arc`) corre una sola esquina a la izquierda con el modelo del servo real: 0,06 s de retraso y 0,05 s de inercia. Se comparan tres situaciones:

1. **Servo real.**
2. **Servo lento:** 0,15 s de retraso y 0,10 s de inercia.
3. **El coche gira más rápido de lo que cree la estrategia:** se le dice a la estrategia que el giro máximo es 0,7 del verdadero.

Sobrepaso máximo, en grados:

| Variante | 1) Servo real | 2) Servo lento | 3) Gira más rápido |
|---|---:|---:|---:|
| solo rampa | 0,2 | **10,7** | 0,1 |
| + feed-forward | 0,8 | **10,6** | **17,5** |
| + feed-forward + aflojado | 0,8 | **10,6** | 0,3 |
| + feed-forward + amortiguamiento (sin aflojado) | 0,4 | 0,2 | **17,3** |
| final: feed-forward + aflojado + amortiguamiento | 0,4 | **0,2** | **0,0** |
| sin rampa, solo amortiguar | 0,0 | 0,1 | 0,0 |

Cada pieza arregla **un** problema y no el otro:

- El amortiguamiento arregla el servo lento (10,6 a 0,2 grados), pero no el feed-forward equivocado (17,3).
- El aflojado arregla el feed-forward equivocado (17,5 a 0,3), pero no el servo lento (10,6).
- La rampa sola **no** evita el sobrepaso del servo lento (10,7 grados).

El tiempo hasta quedar a 0,12 rad de la meta también cambia. Con el servo real, la rampa sola tarda 1,14 s, la versión final 1,10 s y el salto de golpe 1,28 s. Si la estrategia cree que el coche gira menos de lo que gira (situación 3), la rampa sola tarda 1,52 s y la final 1,20 s: el feed-forward es lo que hace la esquina más rápida.

Con el servo real, **todas** las variantes quedan por debajo de 1 grado: la esquina es fácil. El laboratorio solo enseña por qué existen el aflojado y el amortiguamiento cuando el servo o la estimación son peores. En Gazebo con el coche real, las ablaciones del equipo sobre el v4 (tres rondas por prueba) dejaron inválidas las rondas sin amortiguamiento y las rondas sin aflojado. Esa medida no se repitió con este paquete.

## Escríbelo

> **En este paso**
> - **Escribes:** un solo archivo, `arc.py`, con 2 funciones pequeñas (`ramp` y `arc_steer`), en 5 mini pasos.
> - **Copias hecho:** `drive.py`, la parte de ROS (nodos, tópicos, temporizadores). No hace falta entenderlo todavía.
> - **Resultado:** el coche gira 90 grados a la izquierda sin pasarse.

Copia `drive.py` desde la raíz del repositorio (si no tienes las etiquetas, antes `git fetch --tags`):

```bash
git show step-5:src/my_open/my_open/drive.py > src/my_open/my_open/drive.py
```

Cada mini paso termina con una prueba (en macOS con RoboStack pon `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` delante de `python`). Un **tick** es cada ejecución del control: 50 por segundo, o sea `dt = 0,02 s`.

### Paso 5.1: la meta que se mueve (`ramp`)

Hacemos una función que acerca un número a otro poco a poco, como subir el volumen despacio en vez de pasar de 0 a 100 de golpe.

Crea `src/my_open/my_open/arc.py` y pega esto. Arriba van los imports (`wrap(a)`, del paso 2, deja un ángulo entre -π y π). `arc_steer` es un marcador para que las pruebas puedan importarlo: lo escribes en el 5.2. Abajo, el esqueleto de `ramp`, que aún no funciona.

```python
import math

from robotek_course.minisim import STEER_LIMIT, clamp, wrap
from .heading import KP


def arc_steer(*args, **kwargs):  # marcador, lo escribes en el 5.2
    ...


def ramp(ref, goal, rate, dt):
    """Move ref towards goal by at most rate * dt radians (the short way round)."""
    return ref  # TODO
```

- **Qué va dentro:** calcula lo que falta (`gap`: `goal - ref` con `wrap`, para ir por el camino corto). Si falta menos que `rate * dt`, devuelve `goal`. Si no, avanza `rate * dt` hacia el lado de `gap` (`math.copysign` pone el signo) y aplica `wrap`.
- **Compruébalo:** `python -m pytest course/tests/test_step_5.py -q -k reference` debe dar `2 passed`.

<details>
<summary>Ver la solución de este paso</summary>

```python
def ramp(ref, goal, rate, dt):
    """Move the reference heading ``ref`` towards ``goal`` by at most ``rate * dt`` radians (the short way round)."""
    gap = wrap(goal - ref)
    if abs(gap) <= rate * dt:
        return goal
    return wrap(ref + math.copysign(rate * dt, gap))
```

</details>

### Paso 5.2: el volante de la esquina

El coche no persigue la meta final sino `ref`, que se mueve: como seguir a un amigo en bici que va un poco por delante.

Borra el marcador y pega este esqueleto. `feed`, `fade` y `damping` aún no hacen nada.

```python
def arc_steer(goal, ref, yaw, gyro, rate, dt, sign=1, feed=True, fade=True, damping=0.0):
    """One tick of a corner. Returns (steer, ref)."""
    ref = ramp(ref, goal, rate, dt)
    return 0.0, ref  # TODO: el volante
```

- **Qué va dentro:** el volante es `KP` (0,8, paso 2) por el error de rumbo `ref - yaw`, con `wrap`. Límítalo con `clamp(steer, -STEER_LIMIT, STEER_LIMIT)`.
- **Compruébalo:** `python -m pytest course/tests/test_step_5.py -q -k "finished or wheels or also_mirrors"` debe dar `3 passed`.

<details>
<summary>Ver la solución de este paso</summary>

Versión parcial: las líneas de la referencia que ya toca escribir (la función completa está en el 5.5).

```python
def arc_steer(goal, ref, yaw, gyro, rate, dt, sign=1, feed=True, fade=True, damping=0.0):
    ref = ramp(ref, goal, rate, dt)
    steer = KP * wrap(ref - yaw)
    return clamp(steer, -STEER_LIMIT, STEER_LIMIT), ref
```

</details>

### Paso 5.3: anticipar (feed-forward)

Anticipar es pedir el volante al tope en cuanto empieza la esquina, como girar el manillar al entrar a una curva sin esperar a notar que te sales.

Cambia estas líneas de `arc_steer` (la primera va **antes** de mover `ref`):

```python
    ramping = ref != goal   # TODO
    ref = ramp(ref, goal, rate, dt)
    steer_ff = 0.0          # TODO
    steer = KP * wrap(ref - yaw) + steer_ff
```

- **Qué va dentro:** `ramping` es verdadero mientras `ref` no llegó a `goal`. `steer_ff` es `sign * STEER_LIMIT` si `ramping` y `feed`; si no, 0.0. `sign` es +1 a la izquierda y -1 a la derecha.
- **Compruébalo:** `python -m pytest course/tests/test_step_5.py -q -k feed_forward` debe dar `1 passed`. Las pruebas del 5.2 siguen pasando.

<details>
<summary>Ver la solución de este paso</summary>

Versión parcial (la completa está en el 5.5):

```python
    ramping = ref != goal
    ref = ramp(ref, goal, rate, dt)
    steer_ff = sign * STEER_LIMIT if (ramping and feed) else 0.0
    steer = KP * wrap(ref - yaw) + steer_ff
```

</details>

### Paso 5.4: soltar el volante al llegar (fade)

Si el coche gira más de lo esperado, el volante al tope lo pasa de largo. Se afloja el feed-forward al acercarse a la meta, como soltar el acelerador antes del semáforo.

Pega encima de `arc_steer` esta constante (0,25 rad son unos 14 grados: el tramo final del giro) y cambia la línea de `steer_ff`:

```python
EXIT_ANGLE = 0.25

    scale = 1.0  # TODO
    steer_ff = sign * STEER_LIMIT * scale if (ramping and feed) else 0.0
```

- **Qué va dentro:** si `fade`, `scale` es lo que falta (`sign * wrap(goal - yaw)`) dividido entre `EXIT_ANGLE` y limitado entre 0 y 1 (`min(1.0, max(0.0, ...))`). Si no, vale 1.0. Usa `yaw`, no `ref`.
- **Compruébalo:** `python -m pytest course/tests/test_step_5.py -q -k fade` debe dar `1 passed`.

<details>
<summary>Ver la solución de este paso</summary>

Versión parcial (la completa está en el 5.5):

```python
EXIT_ANGLE = 0.25    # rad: the feed-forward fades out over the last quarter radian

    scale = min(1.0, max(0.0, sign * wrap(goal - yaw)) / EXIT_ANGLE) if fade else 1.0
    steer_ff = sign * STEER_LIMIT * scale if (ramping and feed) else 0.0
```

</details>

### Paso 5.5: frenar el giro que sobra (amortiguamiento)

Es un freno sobre la velocidad de giro, como el amortiguador de una moto: si el coche ya gira más de lo que la esquina pide, se suelta el volante.

Pega `DAMPING` encima de `EXIT_ANGLE`, cambia `damping=0.0` de la firma por `damping=DAMPING` y cambia estas dos líneas:

```python
DAMPING = 0.1   # volante (rad) por cada rad/s de error en la velocidad de giro

    steer_ff, rate_ff = 0.0, 0.0                   # TODO
    steer = KP * wrap(ref - yaw) + steer_ff        # TODO
```

- **Qué va dentro:** `rate_ff` es el giro esperado (rad/s): `sign * rate * scale` en las mismas condiciones que `steer_ff`, y 0.0 si no. `gyro` es el giro medido. Al volante réstale `damping * (gyro - rate_ff)`.
- **Compruébalo:** `python -m pytest course/tests/test_step_5.py -q -k damping` debe dar `1 passed`.

<details>
<summary>Ver la solución de este paso</summary>

Es la función completa de la referencia (sin su docstring largo).

```python
DAMPING = 0.1        # steering (rad) per rad/s of yaw-rate error
EXIT_ANGLE = 0.25    # rad: the feed-forward fades out over the last quarter radian


def arc_steer(goal, ref, yaw, gyro, rate, dt, sign=1, feed=True, fade=True, damping=DAMPING):
    ramping = ref != goal
    ref = ramp(ref, goal, rate, dt)
    scale = min(1.0, max(0.0, sign * wrap(goal - yaw)) / EXIT_ANGLE) if fade else 1.0
    steer_ff, rate_ff = (sign * STEER_LIMIT * scale, sign * rate * scale) if (ramping and feed) else (0.0, 0.0)
    steer = KP * wrap(ref - yaw) + steer_ff - damping * (gyro - rate_ff)
    return clamp(steer, -STEER_LIMIT, STEER_LIMIT), ref
```

</details>

## Pruébalo en el simulador

```bash
python -m pytest course/tests/test_step_5.py -q
colcon build --symlink-install --packages-select my_open && source install/setup.bash && python3 course/verify_step.py 5
```

- **Qué debes ver:** `11 passed` y después `Paso 5: PASS` con `[OK] tras la primera esquina el rumbo es pi/2 ...` a menos de 0,12 rad (en la referencia, +0.019). Una línea `[FALLA]` dice qué condición no se cumplió.
- **En macOS** usa `source tools/macos_env.sh ~/robotek-ros/jazzy` en vez de `source install/setup.bash`.
- **Con ventana:** usa las tres terminales del paso 4 (simulador, tu nodo y Start). En la del nodo sale `Giro a la izquierda`.

### Rómpelo

**Predice** qué prueba falla, cambia `arc.py`, corre las pruebas y devuelve el cambio:

1. `DAMPING = 0.0`: fallan dos pruebas, la del servo lento y la del salto de golpe.
2. `fade=True` por `fade=False` en la firma: falla la del coche que gira más rápido de lo que cree la estrategia.

## Si algo falla

- **Gira a la derecha o nunca termina.** Una esquina a la izquierda usa `sign=1`; revisa `wrap` y el signo del volante.
- **Se pasa de 90 grados.** El amortiguamiento se **resta**, y el aflojado usa `yaw`, no `ref`.
- **`[FALLA]` y el coche no se mueve.** No llegó Start, o `drive.py` no es el de `step-5`: cópialo otra vez y recompila.

Para comparar tu `arc.py` con la referencia usa el cuadro «Compara» al final de la página.

## Resumen

- Girar es mover `goal` 90 grados, pero el coche sigue a `ref`, una rampa a la velocidad de giro real (1,62 rad/s).
- El feed-forward adelanta el volante, el aflojado lo suelta cerca de la meta y el amortiguamiento frena el giro que sobra.
- Cada pieza arregla un problema distinto; con el servo real, la esquina es fácil.

## Antes de seguir

- [ ] `python -m pytest course/tests/test_step_5.py -q` da `11 passed`.
- [ ] `python3 course/verify_step.py 5` da `PASS`.
- [ ] Puedes explicar qué pasa con el sobrepaso si quitas el amortiguamiento y qué si quitas el aflojado.

<details>
<summary>Para curiosos: cómo funciona drive.py</summary>

`drive.py` es un nodo de ROS: un programa pequeño que habla con otros por canales con nombre (tópicos).

- Se suscribe a `/scan` (LiDAR), `/imu` (giroscopio) y `start`, y publica la velocidad en `/cmd_vel_raw`.
- Un temporizador llama a `control` 50 veces por segundo. Tras Start espera 0,6 s quieto midiendo el sesgo del giroscopio.
- Sigue la isla con `lane_steer` (paso 4). Con la pared de enfrente a 1,19 m o menos (`TURN_FRONT`) y en la primera esquina, suma π/2 a `goal` y activa `arc`.
- Mientras `arc`, llama a `arc_steer` con `rate = real_speed(SPEED) * math.tan(STEER_LIMIT) / WHEELBASE`. Acaba a menos de 0,12 rad de la meta. En la segunda pared se detiene.

</details>
