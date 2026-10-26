---
guide: "obstacle-strategy"
order: 6
slug: "paso-6-seguir-la-linea"
title: "Seguir la línea"
summary: "Un volante que anticipa la curvatura de la línea y corrige la distancia y el rumbo respecto al punto de la línea que tiene al lado."
tag: "obstacle-step-6"
compareFrom: "obstacle-step-5"
---

Con el plan de los pasos 4 y 5 el coche sabe por dónde quiere ir. En este paso escribes `follow.py`, el volante que lo lleva por ahí. Es el paso donde más cuenta el detalle: la misma línea seguida de dos formas distintas dio **77 o 88 rondas válidas de 100**.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/zMdoLO4kRKg" title="Vehicle Path Tracking Using Pure Pursuit Controller" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Vehicle Path Tracking Using Pure Pursuit Controller</strong> · MATLAB (inglés, 11 min). Pure pursuit con punto de anticipación: el controlador que el v2 tuvo que reemplazar.</figcaption>
</figure>
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/9Y7kVIJs_JI" title="Lesson 3: Geometric Lateral Control - Stanley - Introduction to Self-Driving Cars" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Lesson 3: Geometric Lateral Control - Stanley - Introduction to Self-Driving Cars</strong> · Ta Hai Dang (inglés). El controlador Stanley: error lateral y de rumbo respecto al punto más cercano, como el de este paso.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

Por fin el coche se conduce solo: con el `drive.py` de este paso da **una vuelta** siguiendo la línea a 0,25 m/s y se para (todavía sin salida especial, sin mirar señales desconocidas y sin aparcar; eso es el paso 7). Ya no hace falta `keyboard_drive`. Sigues pudiendo mirar `/obstacle/pose`, `/obstacle/signs` y `/obstacle/plan`.

<div data-widget="step-replay" data-src="/learn/assets/replays/obstacle-step-6.json"></div>

*Repetición del laboratorio del Obstacle (la copia de la web) con la solución del curso. Cuánto se aparta el coche de la línea en cada tramo: un par de centímetros en las rectas y en las esquinas.*

## La idea

### Lo que falló primero: perseguir un punto

La primera versión usaba un **pure pursuit**: apuntar a un punto de la línea 0,35 m por delante. En las curvas ese método **corta hacia dentro**: el error es de unos `L² / (2R)`, que con L = 0,35 m y R = 0,6 m son unos 10 cm. Medido en el laboratorio, el coche iba de media 3,4 a 7,2 cm por dentro de la línea en las esquinas, justo hacia la señal de la salida. Con L = 0,25 m mejoró algo (de 25 a 28 válidas de 50).

### Anticipar la curvatura

La línea del paso 5 dice, en cada punto, cuánto gira. Si la curva tiene curvatura κ (1/radio), el volante que la recorre exactamente es `atan(L κ)`, con L = 0,1174 m entre ejes. Ese término se llama **anticipación** (*feed-forward*): no espera a que haya error.

La curvatura se calcula con tres puntos de la línea a ±0,15 m: es el círculo que pasa por los tres. Se toma **0,10 m por delante** del coche, porque el servo tarda 60 ms en empezar a moverse y gira a 1,2 rad/s.

### Corregir respecto al punto de al lado

Sobre la anticipación se suman dos correcciones:

- **lateral:** `−6,0 · e`, con `e` la distancia con signo del coche al punto de la línea **que tiene al lado** (positiva si está a la izquierda);
- **de rumbo:** `−1,5 · (rumbo del coche − rumbo de la línea en ese mismo punto)`;
- y, como en el Open, el **amortiguamiento** del giróscopo: `−0,2 · gyro`.

<div data-widget="obstacle-follow"></div>

Todo se limita a ±0,307 rad (17,6°, la dirección del coche real tras compensar cada lado).

```text
steer = atan(L · κ(phi + 0,10 m)) − 6,0 · e − 1,5 · (θ − θ_línea) − 0,2 · gyro
```

### Por qué «al lado» y no «por delante»

La primera versión de este volante comparaba el rumbo con el de un punto 8 cm por delante. En una curva el rumbo de la línea cambia 2 rad por metro: 8 cm por delante ya son 17° más. El término de rumbo pedía siempre más giro hacia dentro y el coche entraba a la curva antes de tiempo. Midiendo error y rumbo contra el punto de al lado, y dejando el adelanto solo para la anticipación, el resultado en 100 campos pasó de **77 a 88** rondas válidas.

| Volante | Rondas válidas (100 campos, semilla 0) |
|---|---:|
| pure pursuit a 0,35 m | (25 de 50 en el set de prueba) |
| anticipación + corrección contra un punto 8 cm adelante | 77 |
| anticipación + corrección contra el punto de al lado | **88** |

## Escríbelo

> **En este paso**
> - **Escribes:** `follow.py` con `point`, `reference` y `steer`.
> - **Copias hecho:** `drive.py` de este paso.

```bash
git show obstacle-step-6:src/my_obstacle/my_obstacle/drive.py > src/my_obstacle/my_obstacle/drive.py
```

Crea `src/my_obstacle/my_obstacle/follow.py` con su cabecera y sus constantes (ya hechas):

```python
"""Following the line (step 6): curvature ahead, plus lateral and heading feedback beside the car."""

import math

from robotek_common.vehicle import WHEELBASE

from . import lane

PREVIEW = 0.10          # m ahead for the curvature feed-forward (servo and motor lag)
STENCIL = 0.15          # m between the points the line's heading and curvature come from
LATERAL_GAIN = 6.0      # rad of steer per metre off the planned line
```

### Paso 6.1: un punto de la línea

Para seguir la línea hay que saber, en cada sitio, dónde está, hacia dónde va y cuánto se curva. Tres puntos seguidos lo dicen todo, como tres estacas en una curva.

Y debajo, este esqueleto:

```python
def point(offset, progress):
    """Point of the planned line at a progress value; ``offset`` is a function of progress."""
    ...  # TODO 6.1


def reference(offset, progress):
    """(x, y, heading, curvature) of the planned line at a progress value."""
    ...  # TODO 6.1
```

**Qué va dentro:** `point(offset, s)` = `lane_pose(s) + offset(s) · lane_normal(s)`. `reference(offset, s)`: los puntos en `advance(s, −STENCIL)`, `s` y `advance(s, +STENCIL)`; el rumbo es el de la cuerda del primero al tercero y la curvatura `κ = 2 · cruz / (producto de los tres lados)`.

**Un ejemplo:** En la recta de salida con desplazamiento 0,15 la referencia es (x, −0,85, 0, 0); en una esquina del centro, κ = 2 (radio 0,5 m).

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_6.py -q -k "reference_on_a_straight or reference_in_a_corner"
```

Debes ver `2 passed`: la referencia en una recta desplazada y en una esquina.

<details>
<summary>Ver la solución de point, reference</summary>

```python
def point(offset, progress):
    """Point of the planned line at a progress value; ``offset`` is a function of progress."""
    lx, ly, _ = lane.lane_pose(progress)
    nx, ny = lane.lane_normal(progress)
    d = offset(progress)
    return lx + d * nx, ly + d * ny


def reference(offset, progress):
    """(x, y, heading, curvature) of the planned line at a progress value."""
    x0, y0 = point(offset, lane.advance(progress, -STENCIL))
    x1, y1 = point(offset, progress)
    x2, y2 = point(offset, lane.advance(progress, STENCIL))
    heading = math.atan2(y2 - y0, x2 - x0)
    cross = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
    sides = math.hypot(x1 - x0, y1 - y0) * math.hypot(x2 - x1, y2 - y1) * math.hypot(x2 - x0, y2 - y0)
    return x1, y1, heading, 2.0 * cross / max(sides, 1e-9)
```

</details>

### Paso 6.2: el volante

Tres piezas, como al conducir: girar lo que pide la curva antes de llegar (el servo tarda 0,1 s), corregir la distancia a la línea y corregir el ángulo, amortiguado con el giroscopio.

Y debajo, este esqueleto:

```python
def steer(pose, phi, gyro, offset, kp, kd, limit):
    """Steering angle (rad, + left, track frame) that follows the planned line."""
    ...  # TODO 6.2
```

**Qué va dentro:** La referencia en `phi` y la curvatura en `advance(phi, PREVIEW)`. Error lateral `−(x − px)·sin θ + (y − py)·cos θ`. Volante `atan(WHEELBASE · κ) − LATERAL_GAIN · error − kp · wrap(th − θ) − kd · gyro`, limitado a `±limit`.

**Un ejemplo:** En la esquina del centro, sin error, el volante es `atan(0,1174 · 2)` = 0,23 rad (13,2°): solo la anticipación.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_6.py -q -k "feed_forward or left_of_the_line"
```

Debes ver `2 passed`: que sobre la línea solo actúa la anticipación y que a la izquierda corrige a la derecha.

<details>
<summary>Ver la solución de steer</summary>

```python
def steer(pose, phi, gyro, offset, kp, kd, limit):
    """Steering angle (rad, + left, track frame) that follows the planned line."""
    x, y, th = pose
    px, py, heading, _ = reference(offset, phi)
    kappa = reference(offset, lane.advance(phi, PREVIEW))[3]
    error = -(x - px) * math.sin(heading) + (y - py) * math.cos(heading)
    angle = (math.atan(WHEELBASE * kappa) - LATERAL_GAIN * error
             - kp * lane.wrap(th - heading) - kd * gyro)
    return lane.clamp(angle, -limit, limit)
```

</details>

### La velocidad

El nodo de este paso va siempre a 0,25 m/s. La misión del paso 7 usa 0,35 m/s en recta y 0,30 m/s cerca de una señal o cambiando de lado, y 0,2 m/s si hay algo a menos de 0,7 m de frente. Más despacio no ayuda (el cambio de lado se mide en metros, no en segundos), y más rápido el servo se queda atrás.

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_6.py -q        # 6 passed
colcon build --symlink-install --packages-select my_obstacle && source install/setup.bash
ros2 launch robotek_course obstacle_round.launch.py strategy:=my_obstacle seed:=4 direction:=ccw parking:=false gui:=true
```

### Prueba esto

- En el widget de arriba, compara **La del curso** con **Sin feed-forward** y **LATERAL_GAIN 0**: en el escalón de 15 cm el error al final es 2,1, 8,1 y 4,3 cm; en la esquina, 2,7, 5,3 y 6,1 cm.
- En la repetición, salta por los eventos: cuánto se aparta el coche de la línea en cada tramo de la vuelta.

### Rómpelo

1. Mide el error contra un punto 8 cm por delante en vez del de al lado: en las esquinas, el coche se mete hacia la isla.
2. Quita la anticipación: el coche llega tarde a cada curva y el volante va a fondo.

## Si algo falla

- **El coche oscila en las rectas.** La ganancia lateral es demasiado alta para tu `dt`, o el error tiene el signo cambiado.
- **Gira al revés en CW.** `steer` trabaja en el campo espejado: el volante se espeja al final, `sign · steer`.

## Resumen

- Anticipa con la curvatura de la línea un poco por delante; corrige contra el punto de al lado.
- El pure pursuit corta las curvas unos 6–10 cm: justo hacia las señales.
- Con este volante: 88 de 100 campos con tres vueltas válidas en el laboratorio.

## Antes de seguir

- [ ] `test_obstacle_step_6.py` da `6 passed`.
- [ ] En Gazebo el coche da una vuelta solo siguiendo la línea, sin tocar señales, en el campo 4, y se para.
