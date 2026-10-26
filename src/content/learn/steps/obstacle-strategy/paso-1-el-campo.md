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

Crea `src/my_obstacle/my_obstacle/lane.py` con su cabecera y sus constantes (ya hechas):

```python
"""The field and the lane the car drives (step 1)."""

import math
from functools import lru_cache

import numpy as np

INNER = 0.5                    # m, half side of the island
OUTER = 1.5                    # m, half side of the field
UNITS_PER_LAP = 8.0
CORNER_UNITS = math.pi / 4.0   # m of lane in a corner (a 0.5 m quarter circle)
ROW = 0.1                      # m from the lane centre to a row of seats (+ island side, - outer side)
SEATS = tuple(2.0 * k + along for k in range(4) for along in (0.0, 0.5, 1.0))   # progress of the 12 seats
```

### Paso 1.1: el carril

El carril son cuatro piezas iguales: una recta y un cuarto de círculo, giradas. Como un reloj: basta saber dibujar las 3 en punto y girar el resultado para las 6, las 9 y las 12. `lane_pose` resuelve la recta de abajo y su esquina, y gira el punto un cuarto de vuelta por cada recta que ya quedó atrás.

Debajo de las constantes, este esqueleto:

```python
def lane_pose(progress):
    """(x, y, heading) of the lane centre at a progress value (units, any sign)."""
    ...  # TODO 1.1
```

**Qué va dentro:** Toma `progress % 8`: la sección es la parte entera y `frac` lo que sobra. En una sección par (recta), `x = -0.5 + frac`, `y = -1.0`, rumbo 0. En una impar (esquina), el ángulo `theta = -π/2 + frac·π/2` alrededor de la esquina de la isla (0,5, −0,5): `x = 0.5 + 0.5·cos(theta)`, `y = -0.5 + 0.5·sin(theta)`, rumbo `theta + π/2`. Después gira `(x, y) → (−y, x)` y suma π/2 al rumbo `section // 2` veces.

**Un ejemplo:** `lane_pose(0)` = (−0,5, −1,0, 0): el principio de la recta de salida. `lane_pose(1,5)` = (0,85, −0,85, 0,79): la mitad de la primera esquina, rumbo 45°. `lane_pose(2)` = (1,0, −0,5, π/2) y `lane_pose(8)` vuelve al principio.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_1.py -q -k "starts_on_the_bottom or quarter_circle or closes"
```

Debes ver `3 passed`: la recta de salida, un cuarto de círculo de 0,5 m y el carril que se cierra tras 8 unidades.

<details>
<summary>Ver la solución de lane_pose</summary>

```python
def lane_pose(progress):
    """(x, y, heading) of the lane centre at a progress value (units, any sign)."""
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

### Paso 1.2: la normal

Para pasar una señal por un lado hay que poder decir «0,15 m a la izquierda del carril». La normal es la flecha que apunta a la izquierda del sentido de avance: siempre hacia la isla.

Y debajo, este esqueleto:

```python
def lane_normal(progress):
    """Unit vector to the left of travel: toward the island."""
    ...  # TODO 1.2
```

**Qué va dentro:** La normal a la izquierda de un rumbo `h` es `(−sin h, cos h)`; `h` es el tercer número de `lane_pose`.

**Un ejemplo:** En la recta de salida (rumbo 0) la normal es (0, 1): hacia arriba, hacia la isla. Un punto con desplazamiento `d` es `lane_pose + d · lane_normal`: con `d = −0,1`, la fila exterior.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_1.py -q -k "normal"
```

Debes ver `1 passed`: que la normal apunta a la isla en las cuatro rectas.

<details>
<summary>Ver la solución de lane_normal</summary>

```python
def lane_normal(progress):
    """Unit vector to the left of travel: toward the island."""
    heading = lane_pose(progress)[2]
    return -math.sin(heading), math.cos(heading)
```

</details>

### Paso 1.3: avanzar unos metros

El volante mira 10 o 15 cm por delante, pero el progreso no se mide en metros: en una esquina una unidad son 0,785 m. `advance` convierte metros en unidades según dónde está el coche.

Y debajo, este esqueleto:

```python
def advance(progress, metres):
    """Progress after driving ``metres`` along the lane at the local scale (1 m per unit on a
    straight, 0.785 m per unit on a corner)."""
    ...  # TODO 1.3
```

**Qué va dentro:** La sección es `int(progress) % 8`. En una recta (par) la escala es 1; en una esquina, `CORNER_UNITS` (π/4). Devuelve `progress + metres / escala`.

**Un ejemplo:** `advance(0.5, 0.1)` = 0,6. `advance(1.5, 0.1)` = 1,5 + 0,1 / 0,785 = 1,627: en la esquina, 10 cm son más progreso.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_1.py -q -k "advance"
```

Debes ver `1 passed`: los metros a la escala de una recta y de una esquina.

<details>
<summary>Ver la solución de advance</summary>

```python
def advance(progress, metres):
    """Progress after driving ``metres`` along the lane at the local scale (1 m per unit on a
    straight, 0.785 m per unit on a corner)."""
    section = int(progress) % 8
    scale = 1.0 if section % 2 == 0 else CORNER_UNITS
    return progress + metres / scale
```

</details>

### Paso 1.4: el progreso de un punto

El coche sabe su posición (x, y); para saber qué señal tiene delante necesita su progreso. `progress_of` busca el punto del carril más cercano, pero solo hacia delante de donde ya iba: así nunca salta a la recta de enfrente.

Y debajo, este esqueleto:

```python
@lru_cache(maxsize=8)
def _offsets(span, step):
    ...  # TODO 1.4


def _lane_points(progress):
    """``lane_pose`` for an array of progress values, without the heading: (x, y) arrays."""
    ...  # TODO 1.4


def progress_of(x, y, start, span=3.0, step=0.02):
    """Progress of the lane point nearest to (x, y), searching forward from ``start`` (a 2 cm grid)."""
    ...  # TODO 1.4
```

**Qué va dentro:** Prueba los progresos de `start` a `start + span` cada `step` (2 cm), calcula sus puntos del carril y devuelve el de menor distancia a (x, y). Con NumPy, todos a la vez: `_lane_points` es `lane_pose` para un arreglo (sin el rumbo) y `_offsets` guarda la lista de saltos (con `lru_cache`, porque siempre es la misma).

**Un ejemplo:** Un coche en (0, −0,95) con `start = 0` da 0,5: la mitad de la recta de salida, aunque esté 5 cm a un lado.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_1.py -q -k "progress_of"
```

Debes ver `1 passed`: el punto más cercano por delante, en una recta y en una esquina.

<details>
<summary>Ver la solución de _offsets, _lane_points, progress_of</summary>

```python
@lru_cache(maxsize=8)
def _offsets(span, step):
    offsets, offset = [], 0.0
    while offset <= span:
        offsets.append(offset)
        offset += step
    return np.array(offsets)


def _lane_points(progress):
    """``lane_pose`` for an array of progress values, without the heading: (x, y) arrays."""
    progress = np.mod(progress, UNITS_PER_LAP)
    section = progress.astype(int)
    frac = progress - section
    theta = -math.pi / 2 + frac * math.pi / 2
    straight = section % 2 == 0
    x = np.where(straight, -INNER + frac, INNER + INNER * np.cos(theta))
    y = np.where(straight, -1.0, -INNER + INNER * np.sin(theta))
    for turns in range(1, 4):
        mask = section // 2 == turns
        for _ in range(turns):
            x[mask], y[mask] = -y[mask], x[mask].copy()
    return x, y


def progress_of(x, y, start, span=3.0, step=0.02):
    """Progress of the lane point nearest to (x, y), searching forward from ``start`` (a 2 cm grid)."""
    s = start + _offsets(span, step)
    lx, ly = _lane_points(s)
    return float(s[int(np.argmin(np.hypot(x - lx, y - ly)))])
```

</details>

### Paso 1.5: el progreso desde cualquier sitio

El localizador (paso 2) necesita el progreso de la pose sin un punto de partida, y el progreso tiene que seguir contando vueltas: 7,99 → 8,01, no 7,99 → 0,01.

Y debajo, este esqueleto:

```python
def track_s(x, y):
    """Progress of any point of the field, lane or not: along the straight beside it, or the
    angle around the island corner it is in front of. Works on arrays."""
    ...  # TODO 1.5


def unwrap_s(previous, current):
    """``current`` (0 to 8) moved by whole laps to the value nearest ``previous``: progress that
    keeps counting laps."""
    ...  # TODO 1.5
```

**Qué va dentro:** `track_s(x, y)`: para cada uno de los cuatro giros, en una recta el progreso es `2k + x_girada + 0,5`; delante de una esquina, `2k + 1 + ángulo/(π/2)`. Funciona con arreglos (`np.where`). `unwrap_s(previous, current)` es `previous + ((current − previous + 4) % 8 − 4)`: mueve `current` vueltas enteras hasta quedar cerca de `previous`.

**Un ejemplo:** `unwrap_s(7.9, 0.1)` = 8,1: el coche acaba de empezar la segunda vuelta.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_1.py -q -k "track_s or unwrap"
```

Debes ver `2 passed`: el progreso de cualquier punto del campo y que sigue contando vueltas.

<details>
<summary>Ver la solución de track_s, unwrap_s</summary>

```python
def track_s(x, y):
    """Progress of any point of the field, lane or not: along the straight beside it, or the
    angle around the island corner it is in front of. Works on arrays."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    out = np.zeros(np.broadcast(x, y).shape)
    for k in range(4):
        c, s = math.cos(-k * math.pi / 2), math.sin(-k * math.pi / 2)
        xr, yr = c * x - s * y, s * x + c * y
        straight = (yr <= -INNER) & (np.abs(xr) <= INNER)
        corner = (xr > INNER) & (yr <= -INNER)
        out = np.where(straight, 2 * k + xr + INNER, out)
        angle = np.arctan2(yr + INNER, xr - INNER)
        out = np.where(corner, 2 * k + 1 + (angle + math.pi / 2) / (math.pi / 2), out)
    return out


def unwrap_s(previous, current):
    """``current`` (0 to 8) moved by whole laps to the value nearest ``previous``: progress that
    keeps counting laps."""
    return previous + ((current - previous + 4.0) % 8.0 - 4.0)
```

</details>

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_1.py -q
```

Debes ver `9 passed`.

### Prueba esto

- En el widget del campo, lleva el progreso a 1,5: el coche está en la mitad de la primera esquina, con rumbo 45°, y ahí una unidad son 0,785 m. Pulsa **Recorrer una vuelta** y mira los números de 0 a 7.
- Cambia el sentido a horario: es el mismo carril visto en un espejo. Así lo trabaja la estrategia.
- En la **lección interactiva** de este paso, tu `lane.py` mueve el coche del simulador una vuelta entera en el campo 4.

### Rómpelo

1. En `lane_normal`, devuelve `(sin h, −cos h)`: la flecha apunta al muro de fuera. La prueba de la normal falla y, en la lección interactiva, el coche pasa las señales por el lado contrario.
2. En `advance`, usa siempre la escala 1: la prueba de `advance` falla, porque en una esquina 10 cm son 0,127 unidades y no 0,1.

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
