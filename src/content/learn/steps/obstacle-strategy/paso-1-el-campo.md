---
guide: "obstacle-strategy"
order: 1
slug: "paso-1-el-campo"
title: "El campo y las reglas"
summary: "Qué pide el reglamento y cómo describir el carril, el progreso y los asientos de las señales con unas pocas funciones."
tag: "obstacle-step-1"
compareFrom: "obstacle-step-0"
---

Antes de mover el coche hay que poder decir **dónde está todo**: el carril, cuánto ha avanzado el coche y en qué sitios pueden estar las señales. En este paso escribes `lane.py`, la geometría del campo que usarán todos los pasos siguientes. Es Python puro: no hay ROS ni sensores todavía.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/Ojf7OwXbp6w" title="WRO 2023 Future Engineers" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>WRO 2023 Future Engineers</strong> · World Robot Olympiad (inglés). La categoría y sus dos retos, contados por la WRO.</figcaption>
</figure>
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/Z6zT3QnwcCs" title="2025 WRO Future Engineers - Obstacle Challenge | WeMaker" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>2025 WRO Future Engineers - Obstacle Challenge | WeMaker</strong> · Uchiha Itachi 宇智撥柚 (inglés). Un equipo de la temporada 2025, con el aparcamiento.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

Nada se mueve en Gazebo. Al terminar, `pytest course/tests/obstacle/test_obstacle_step_1.py` da `9 passed`, y puedes preguntar en Python, por ejemplo, dónde está el centro del carril a mitad de la primera esquina:

<div data-widget="step-replay" data-src="/learn/assets/replays/obstacle-step-1.json"></div>

*Repetición del laboratorio del Obstacle (la copia de la web) con la solución del curso. La estrategia completa del curso (la tendrás en el paso 7) dando una vuelta: los eventos marcan cada unidad de progreso. Activa las medidas o el LiDAR, cambia la cámara o la velocidad, y salta entre eventos.*

```python
>>> from my_obstacle.lane import lane_pose
>>> lane_pose(1.5)
(0.853..., -0.853..., 0.785...)     # x, y en metros y rumbo en rad (45°)
```

## La idea

### Lo que pide el reglamento

El campo es el mismo del Open (3 × 3 m, isla de 1 × 1 m, pasillo de 1 m), pero con **señales**: pilares de 50 × 50 × 100 mm, rojos o verdes. El coche debe pasar **las rojas por la derecha y las verdes por la izquierda**, mirando en el sentido de la ronda (reglamento 9.19). Tras las tres vueltas tiene que **aparcar en paralelo** en un hueco de la sección de salida.

| Regla | Qué significa para el código |
|---|---|
| Asientos: 3 por recta (al inicio, al medio y al final) y 2 filas (a 0,4 y 0,6 m del muro interior) | solo hay 24 sitios posibles: basta con saber en cuál está cada señal |
| Sorteo: una recta con una sola señal; las otras tres sacan una de 35 cartas | una carta pone una señal (en cualquiera de los 3 asientos) o dos (al inicio y al final de la recta, nunca al medio) |
| El campo **no cambia** durante la ronda (9.4, 9.5) | el color que ves en la vuelta 1 sigue valiendo en las vueltas 2 y 3 |
| Aparcamiento: 1,5 × el largo del coche (0,35 m) por 0,20 m, contra el muro exterior de la sección de salida; las señales de esa sección pasan a la fila interior | en la recta de salida no puedes ir pegado al muro exterior |
| Tocar los topes del aparcamiento detiene la ronda y anula el aparcamiento | el aparcamiento se planifica con margen |
| 3 minutos por ronda (9.2) | las vueltas (~110 s) dejan poco más de un minuto para aparcar |
| Ir hacia atrás: solo en la sección donde cambió el sentido y en la vecina (9.21) | retrocesos cortos sí; dar media vuelta, no |

Los puntos que cuenta el juez del curso:

| Ítem | Puntos |
|---|---:|
| 1.1 Secciones (una por cada sección recorrida en el sentido de la ronda) | 24 |
| 1.2 Vueltas | 3 |
| 1.3 Parar en la sección de salida | 3 |
| 1.4–1.7 Señales sin mover tras las tres vueltas | 10 |
| 1.8.2 Aparcado del todo y en paralelo (1.8.3: parcial, 7) | 15 |
| **Total en este curso** | **55** |

El reglamento da 7 más por **arrancar dentro del aparcamiento** (1.8.1, máximo 62): no lo hacemos en esta guía.

<div data-widget="obstacle-field"></div>

### El carril y el progreso

El **carril** es la línea que va por el medio del pasillo, a 0,5 m de la isla: cuatro rectas de 1 m unidas por cuatro cuartos de circunferencia de radio 0,5 m alrededor de las esquinas de la isla. Todo lo que hace el coche se mide contra él.

El **progreso** dice cuánto ha avanzado el coche por el carril: **1 unidad por recta y 1 por esquina**, 8 por vuelta, empezando al principio de la recta de salida. Una recta mide 1 m, así que ahí una unidad es un metro; una esquina mide π/4 ≈ 0,785 m, así que ahí una unidad son 0,785 m. Tras tres vueltas el progreso vale 24.

Con el progreso los asientos son fáciles de nombrar: en la recta *k* (0 a 3) están en **2k**, **2k + 0,5** y **2k + 1**. Y la fila es el **desplazamiento lateral** respecto al carril: **+0,1 m** la interior (hacia la isla) y **−0,1 m** la exterior.

### Siempre en sentido antihorario

En las rondas en sentido horario (CW) **se espeja el campo**: se cambia el signo de x, y el coche cree que va en sentido antihorario (CCW). Así toda la estrategia se escribe una vez. Al espejar hay que cambiar también el color de las señales (una roja «a la derecha» en CW es una verde en el campo espejado) y el signo del volante. Lo hace el localizador (paso 2) y la memoria de señales (paso 3); en este paso todo es CCW.

## Escríbelo

> **En este paso**
> - **Escribes:** `lane.py`, con 8 funciones cortas (`wrap`, `clamp`, `lane_pose`, `lane_normal`, `advance`, `progress_of`, `track_s`, `unwrap_s`).
> - **Resultado:** `python -m pytest course/tests/obstacle/test_obstacle_step_1.py -q` da `9 passed`.

Crea `src/my_obstacle/my_obstacle/lane.py` con las constantes y los esqueletos:

```python
"""The lane of the Obstacle field: progress, lane pose and the sign seats."""
import math

import numpy as np

INNER = 0.5            # m, half the island
OUTER = 1.5            # m, half the field
UNITS_PER_LAP = 8.0    # one unit per straight and per corner
CORNER_UNITS = math.pi / 4.0   # m of lane in a corner (quarter circle of 0.5 m)
ROW = 0.1              # m from the lane centre to a row of seats (+ island side, - outer side)
SEATS = tuple(2.0 * k + along for k in range(4) for along in (0.0, 0.5, 1.0))   # progress of the 12 seats


def wrap(angle):
    return math.atan2(math.sin(angle), math.cos(angle))


def clamp(value, low, high):
    return max(low, min(high, value))


def lane_pose(progress):
    """(x, y, heading) of the lane centre at a progress value (any lap)."""
    ...  # TODO 1.1


def lane_normal(progress):
    """Unit vector to the left of travel (toward the island)."""
    ...  # TODO 1.2


def advance(progress, metres):
    """Progress after driving `metres` at the local scale (1 m per unit on a straight, 0.785 m in a corner)."""
    ...  # TODO 1.3


def progress_of(x, y, start, span=3.0, step=0.02):
    """Progress of the lane point nearest to (x, y), searching forward from `start`."""
    ...  # TODO 1.4
```

### Paso 1.1: el carril

`lane_pose` resuelve la primera recta y la primera esquina, y gira el resultado un cuarto de vuelta por cada par de secciones:

- Toma `progress % 8`; la sección es la parte entera y `frac` la fracción.
- **Sección par (recta):** `x = -0.5 + frac`, `y = -1.0`, rumbo 0.
- **Sección impar (esquina):** el ángulo `theta = -π/2 + frac·π/2` alrededor de la esquina de la isla (0,5, −0,5): `x = 0.5 + 0.5 cos(theta)`, `y = -0.5 + 0.5 sin(theta)`, rumbo `theta + π/2`.
- Gira `(x, y) → (-y, x)` y suma π/2 al rumbo `sección // 2` veces.

**Compruébalo:** `lane_pose(0)` es `(-0.5, -1.0, 0)`, `lane_pose(2)` es `(1.0, -0.5, π/2)`, `lane_pose(4)` es `(0.5, 1.0, π)` y `lane_pose(8)` vuelve al principio.

### Paso 1.2: la normal

La normal a la izquierda del rumbo `h` es `(-sin h, cos h)`. En la recta de salida apunta a +y, hacia la isla. Un punto con desplazamiento lateral `d` es `lane_pose + d · lane_normal`.

### Paso 1.3: avanzar unos metros

`advance(progress, metres)` divide los metros por la escala de la sección donde está `progress`: 1 en una recta, π/4 en una esquina. No hace falta cruzar secciones con precisión: se usa para mirar 10 o 15 cm por delante.

### Paso 1.4: el progreso de un punto

`progress_of` busca, desde `start` hacia delante hasta `start + span`, el punto del carril más cercano a `(x, y)` en pasos de 0,02 unidades, y devuelve su progreso. Hazlo con NumPy: calcula los puntos del carril de todos los candidatos de una vez y toma `argmin` de la distancia. En la referencia esa versión es 2,7 veces más rápida que el bucle y da exactamente lo mismo en 20 000 puntos al azar.

<details>
<summary>Ver la solución de lane_pose</summary>

```python
def lane_pose(progress):
    progress %= UNITS_PER_LAP
    section = int(progress)
    frac = progress - section
    if section % 2 == 0:
        x, y, heading = -INNER + frac, -1.0, 0.0
    else:
        theta = -math.pi / 2 + frac * math.pi / 2
        x, y = INNER + INNER * math.cos(theta), -INNER + INNER * math.sin(theta)
        heading = theta + math.pi / 2
    for _ in range(section // 2):
        x, y, heading = -y, x, heading + math.pi / 2
    return x, y, wrap(heading)
```

</details>

### Paso 1.5: el progreso desde una posición cualquiera

El localizador (paso 2) necesita el progreso de la pose del coche sin una pista de partida. `track_s(x, y)` lo da por secciones: en una recta, la coordenada a lo largo; en una esquina, el ángulo alrededor de la esquina de la isla. `unwrap_s(previous, current)` lo hace creciente vuelta a vuelta (`previous + ((current - previous + 4) % 8 - 4)`). Con eso el progreso pasa de 7,99 a 8,01 y no de 7,99 a 0,01.

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_1.py -q
```

## Si algo falla

- **El carril no cierra tras una vuelta.** Revisa que el giro se aplique `sección // 2` veces y que el rumbo pase por `wrap`.
- **`progress_of` salta a la vuelta siguiente.** Busca solo hacia delante y como mucho `span` unidades.

## Resumen

- 24 asientos posibles: progreso 2k, 2k + 0,5 y 2k + 1, filas a ±0,1 m del carril.
- El progreso cuenta 8 unidades por vuelta; 24 son tres vueltas.
- Las rondas CW se espejan: la estrategia se escribe una vez, en CCW.

## Antes de seguir

- [ ] `test_obstacle_step_1.py` da `9 passed`.
- [ ] Sabes dónde están los asientos de la recta 2 (progreso 4, 4,5 y 5).
