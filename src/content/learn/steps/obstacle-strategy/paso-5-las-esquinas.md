---
guide: "obstacle-strategy"
order: 5
slug: "paso-5-las-esquinas"
title: "Las esquinas: recta, arco, recta"
summary: "Planifica cada esquina como una recta, un arco y otra recta, y busca la que deja más margen con las señales de los dos lados."
tag: "obstacle-step-5"
compareFrom: "obstacle-step-4"
---

En una recta, la línea del paso 4 funciona. En una esquina no: un desplazamiento de +0,354 m hacia la isla dentro de la curva pide un radio de 0,146 m, y el coche no gira por debajo de unos 0,41 m. En este paso escribes `corner.py`: cada esquina se planifica como **recta, arco, recta** y se elige, entre muchas, la que deja más margen con las señales de los dos extremos.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/gIVNggpYuXA" title="Dubins path examples" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Dubins path examples</strong> · Kyler Laird (inglés). Caminos de Dubins: rectas y arcos de radio mínimo, como la línea de cada esquina.</figcaption>
</figure>
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/tjUVE3jto98" title="Coding a Dubins Car Optimal Path Planner" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Coding a Dubins Car Optimal Path Planner</strong> · Aaron Becker (inglés). Un profesor programa el planificador de Dubins paso a paso.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

Conduciendo con `keyboard_drive`, `/obstacle/plan` ya muestra la línea de cada esquina en vez de las rampas del paso 4. `corner.plan` devuelve, para cada par de señales en los extremos de una esquina, el margen y la línea. Los 25 casos posibles (4 tipos de señal o ninguna, en cada extremo) tienen línea con **al menos 3,4 cm** de margen sobre el papel. Las pruebas lo comprueban.

<div data-widget="step-replay" data-src="/learn/assets/replays/obstacle-step-5.json"></div>

*Repetición del laboratorio del Obstacle (la copia de la web) con la solución del curso. En cada esquina, la línea es la que eligió el plan de este paso para las señales de los dos extremos.*

<div data-widget="obstacle-corner"></div>

## La idea

### Qué fallaba

Con la línea del paso 4 en las esquinas, cuatro campos de prueba fallaban incluso dándole a la estrategia los colores perfectos desde 1,8 m:

1. **Un desplazamiento interior en la curva es imposible:** el coche se abre, el volante se queda a fondo unos 2 s y llega mal a la señal siguiente.
2. **El seguidor corta la curva hacia la señal siguiente:** apunta a un punto que pasa por encima de ella.
3. **Se decide una señal a la vez:** el cambio hacia la señal de la recta siguiente empieza tarde.

### La forma: recta, arco, recta

En el sistema de la primera esquina (recta de abajo hacia la de la derecha, esquina de la isla en (0,5, −0,5)), la línea:

1. va por la recta de abajo con desplazamiento `d_a`: `y = −1 + d_a`;
2. gira a la izquierda por un **arco de radio r**;
3. sigue por la recta de la derecha con desplazamiento `d_b`: `x = 1 − d_b`.

El centro del arco queda en `(1 − d_b − r, −1 + d_a + r)`. Con `d_a`, `d_b` y `r` la línea está entera. Las demás esquinas son esta girada, así que el resultado se da en progreso y desplazamiento y vale para las cuatro.

### Buscar la mejor

Las señales de una esquina son la del **último asiento** de la recta anterior (progreso 2k + 1) y la del **primero** de la siguiente (2k + 2). Para cada una, `d` solo puede estar del lado correcto: una roja admite de −0,36 hasta su fila − 0,099; una verde, desde su fila + 0,099 hasta +0,36 (0,099 = medio cuadro de señal + medio coche). Un extremo sin señal usa el desplazamiento de la señal vecina, con un margen de ±0,1 m.

`plan` prueba todas las combinaciones (pasos de 2 cm en `d`, radios 0,5, 0,6 y 0,75 m) y mide el **margen** de cada línea: la distancia mínima del contorno del coche (147,7 mm delante, 85,2 mm detrás, 74 mm de medio ancho) a las dos señales, la isla y el muro exterior. Si una señal se cruzaría por el lado equivocado (medido como el juez: dónde corta el contorno la línea de la señal), el margen es negativo.

- Si una línea deja **11 cm o más**, entre ellas elige la más cercana al centro del carril: cambios de lado más cortos y señales más fáciles de ver.
- Si ninguna llega, la de más margen.

El radio mínimo es **0,5 m**, no los 0,41 m del coche a fondo. Con arcos más cerrados, al seguidor (paso 6) no le quedaba volante para corregir. Medido en el laboratorio: permitiendo arcos desde 0,45 m, 20 de 50 rondas válidas en el set de prueba y 28 de 40 en campos nuevos; desde 0,5 m, 30 de 50 y 31 de 40.

### Los casos difíciles

| Señal al final de la recta | Señal al inicio de la siguiente | Margen | `d_a` | `d_b` | `r` |
|---|---|---:|---:|---:|---:|
| verde interior | roja exterior | 3,4 cm | +0,24 | −0,34 | 0,5 |
| roja exterior | verde interior | 4,0 cm | −0,36 | +0,24 | 0,5 |
| verde interior | roja interior | 8,0 cm | +0,28 | −0,30 | 0,5 |
| roja interior | verde interior | 8,2 cm | −0,32 | +0,30 | 0,5 |
| sin señal | sin señal | 22,8 cm | 0 | 0 | 0,75 |


Los dos primeros cruzan el carril de un lado al otro en la misma esquina: el coche tiene que pasar la primera señal pegado a la isla y salir de la curva pegado al muro. Son el **límite conocido** de esta estrategia (paso 9).

## Escríbelo

> **En este paso**
> - **Escribes:** `corner.py` con `path`, `clearance`, `plan`, `knots`, `corner_line` y `merge`.
> - **Copias hecho:** `drive.py` de este paso.

```bash
git show obstacle-step-5:src/my_obstacle/my_obstacle/drive.py > src/my_obstacle/my_obstacle/drive.py
```

Crea `src/my_obstacle/my_obstacle/corner.py` con su cabecera y sus constantes (ya hechas):

```python
"""The corners (step 5): a line of straight, one left arc, straight, searched for clearance."""

import math
from functools import lru_cache

import numpy as np

from robotek_common.vehicle import OUTLINE_FRONT, OUTLINE_HALF_WIDTH, OUTLINE_REAR, WHEELBASE

from .plan import LOT_OFFSET

SIGN_HALF = 0.025           # m, half of a 50 mm sign
STEP = 0.02                 # m between path samples
RADII = (0.5, 0.6, 0.75)     # m; tighter arcs leave the tracker no steering to correct with
OFFSET_LIMIT = 0.36         # m from the lane centre
OFFSET_GRID = 0.02          # m between candidate offsets
FREE_SHIFT = 0.1            # m an end without a sign may move from the neighbouring sign's offset
ENOUGH = 0.11               # m; past this clearance the line stays near the centre
BEFORE = 0.15               # track units before the corner the plan starts (a sign's hold)
AFTER = 0.15                # track units into the next straight it ends at the latest
```

### Paso 5.1: la forma de la esquina

Una esquina es recta, arco y recta, como gira una persona en bicicleta. Tres números la describen: el desplazamiento antes (`d_a`), el radio (`r`) y el desplazamiento después (`d_b`).

Y debajo, este esqueleto:

```python
def path(d_a, d_b, r):
    """Samples (x, y, body yaw) of the line in the first corner's frame, or None if it does not fit."""
    ...  # TODO 5.1
```

**Qué va dentro:** Recta A en `y = −1 + d_a`, recta B en `x = 1 − d_b`, centro del arco `(1 − d_b − r, −1 + d_a + r)`. Muestras cada 2 cm: la recta A desde `min(0,35, cx)`, el arco de −π/2 a 0 y la recta B hasta `max(−0,35, cy)`. En el arco el cuerpo apunta un poco hacia fuera: `slip = atan2(WHEELBASE/2, √(r² − (WHEELBASE/2)²))`. Si la recta A empieza antes de −0,3 o el centro pasa de 0,3, no cabe: `None`.

**Un ejemplo:** `path(0, 0, 0.5)` es el centro del carril: un cuarto de círculo de 0,5 m alrededor de (0,5, −0,5).

Esta función la comprueba el sub-paso siguiente.

<details>
<summary>Ver la solución de path</summary>

```python
def path(d_a, d_b, r):
    """Samples (x, y, body yaw) of the line in the first corner's frame, or None if it does not fit."""
    y_a, x_b = -1.0 + d_a, 1.0 - d_b
    cx, cy = x_b - r, y_a + r
    x_start = min(0.5 - BEFORE, cx)
    y_end = max(-0.5 + AFTER, cy)
    if x_start < -0.3 or cy > 0.3:
        return None
    # base_link sits half a wheelbase ahead of the rear axle: on an arc its body points
    # slightly outside the tangent.
    slip = math.atan2(WHEELBASE / 2.0, math.sqrt(max(r * r - (WHEELBASE / 2.0) ** 2, 1e-9)))
    line_a = np.arange(x_start, cx, STEP)
    angles = np.arange(-math.pi / 2, 0.0, STEP / r)
    line_b = np.arange(cy, y_end + 1e-9, STEP)
    x = np.concatenate([line_a, cx + r * np.cos(angles), np.full(line_b.size, x_b)])
    y = np.concatenate([np.full(line_a.size, y_a), cy + r * np.sin(angles), line_b])
    yaw = np.concatenate([np.zeros(line_a.size), angles + math.pi / 2 - slip, np.full(line_b.size, math.pi / 2)])
    return x, y, yaw
```

</details>

### Paso 5.2: el margen

Una línea vale lo que su punto más justo: la menor distancia del contorno del coche a las señales, la isla y el muro. Y si pasa una señal por el lado equivocado, el margen es negativo.

Y debajo, este esqueleto:

```python
def _outline():
    """Perimeter points of the car in base_link (x ahead, y left)."""
    ...  # TODO 5.2


def _box_distance(px, py, bx, by):
    ...  # TODO 5.2


def clearance(samples, sign_a, sign_b):
    """Smallest distance (m) of the outline to the signs, the island and the outer wall along the
    samples; negative when a sign is passed on the wrong side. ``sign_a``/``sign_b`` are
    (lateral, colour) or None."""
    ...  # TODO 5.2


def _cut(along, side):
    """Lateral interval where each sample's outline cuts the sign's line (along = 0), as the
    judge measures the side; only samples that straddle the line."""
    ...  # TODO 5.2
```

**Qué va dentro:** Mueve el contorno (147,7 mm delante, 85,2 detrás, 74 de medio ancho) a cada muestra y mide la distancia a la isla, al muro y a la caja de cada señal. Para el lado, `_cut` corta el contorno con la línea de la señal y da el intervalo lateral `[low, high]`: una roja exige todo el coche por debajo (`lateral − SIGN_HALF − high`), una verde todo por encima (`low − lateral − SIGN_HALF`).

**Un ejemplo:** La línea del centro del carril con una verde interior al principio de la recta siguiente da −0,23: el coche la pasaría por la derecha, el lado equivocado.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_5.py -q -k "wrong_side"
```

Debes ver `1 passed`: que un lado equivocado da margen negativo.

<details>
<summary>Ver la solución de _outline, _box_distance, clearance, _cut</summary>

```python
def _outline():
    """Perimeter points of the car in base_link (x ahead, y left)."""
    xs = np.linspace(-OUTLINE_REAR, OUTLINE_FRONT, 7)
    ys = np.linspace(-OUTLINE_HALF_WIDTH, OUTLINE_HALF_WIDTH, 3)
    points = [(x, y) for x in xs for y in (ys[0], ys[-1])] + [(x, y) for x in (xs[0], xs[-1]) for y in ys[1:-1]]
    return np.array(points)


def _box_distance(px, py, bx, by):
    dx = np.maximum(np.abs(px - bx) - SIGN_HALF, 0.0)
    dy = np.maximum(np.abs(py - by) - SIGN_HALF, 0.0)
    return np.hypot(dx, dy)


def clearance(samples, sign_a, sign_b):
    """Smallest distance (m) of the outline to the signs, the island and the outer wall along the
    samples; negative when a sign is passed on the wrong side. ``sign_a``/``sign_b`` are
    (lateral, colour) or None."""
    x, y, yaw = samples
    c, s = np.cos(yaw)[:, None], np.sin(yaw)[:, None]
    px = x[:, None] + c * OUTLINE[:, 0] - s * OUTLINE[:, 1]
    py = y[:, None] + s * OUTLINE[:, 0] + c * OUTLINE[:, 1]
    qx = x[:, None] + c * CORNERS[:, 0] - s * CORNERS[:, 1]
    qy = y[:, None] + s * CORNERS[:, 0] + c * CORNERS[:, 1]
    island = np.maximum(np.abs(px), np.abs(py)) - 0.5
    outer = 1.5 - np.maximum(np.abs(px), np.abs(py))
    worst = min(float(island.min()), float(outer.min()))
    signs = []
    if sign_a is not None:
        # Last seat of the bottom straight: along x, lateral (to the island) along y.
        signs.append((sign_a, 0.5, -1.0 + sign_a[0], qx - 0.5, qy + 1.0))
    if sign_b is not None:
        # First seat of the right straight: along y, lateral along -x.
        signs.append((sign_b, 1.0 - sign_b[0], -0.5, qy + 0.5, 1.0 - qx))
    for (lateral, colour), bx, by, along, side in signs:
        worst = min(worst, float(_box_distance(px, py, bx, by).min()))
        if colour is None:
            continue
        low, high = _cut(along, side)
        if low.size:
            margin = lateral - SIGN_HALF - high.max() if colour == 'red' else low.min() - lateral - SIGN_HALF
            worst = min(worst, float(margin))
    return worst


def _cut(along, side):
    """Lateral interval where each sample's outline cuts the sign's line (along = 0), as the
    judge measures the side; only samples that straddle the line."""
    a0, a1 = along, np.roll(along, -1, axis=1)
    s0, s1 = side, np.roll(side, -1, axis=1)
    hits = (a0 <= 0.0) != (a1 <= 0.0)
    with np.errstate(divide='ignore', invalid='ignore'):
        cut = np.where(hits, s0 + (s1 - s0) * a0 / (a0 - a1), np.nan)
    rows = hits.any(axis=1)
    return np.nanmin(cut[rows], axis=1), np.nanmax(cut[rows], axis=1)
```

</details>

### Paso 5.3: buscar la mejor

Con las dos señales de la esquina, se prueban todas las líneas posibles y se elige la de más margen; si varias dejan 11 cm o más, la más cercana al centro (cambios de lado más cortos).

Y debajo, este esqueleto:

```python
def _band(sign, fixed):
    """Candidate offsets for the straight next to a corner."""
    ...  # TODO 5.3


@lru_cache(maxsize=256)
def plan(sign_a, sign_b, fixed_a, fixed_b, low_a=-1.0, low_b=-1.0):
    """Best (clearance, d_a, d_b, r) for a corner. ``fixed_*`` is the offset used on a side
    without a sign of known colour (the neighbouring sign's offset, or the default);
    ``low_*`` the smallest offset allowed on that side (beside the parking lot)."""
    ...  # TODO 5.3


@lru_cache(maxsize=256)
def knots(d_a, d_b, r):
    """The line as (progress from the corner start, lateral offset) pairs."""
    ...  # TODO 5.3
```

**Qué va dentro:** `_band` da los desplazamientos permitidos de un extremo (del lado correcto de su señal, cada 2 cm; sin señal, ±0,1 alrededor del vecino). `plan` prueba radios 0,5, 0,6 y 0,75 con todas las combinaciones y puntúa `(1, −distancia al centro, r)` si el margen llega a `ENOUGH`, o `(0, margen, r)`; con `lru_cache`. `knots` pasa la línea a (progreso desde la esquina, desplazamiento).

**Un ejemplo:** Verde interior al final y roja exterior al principio de la siguiente: margen 3,4 cm con `d_a` = +0,24, `d_b` = −0,34, r = 0,5. Pruébalo en el widget de arriba.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_5.py -q -k "every_corner or passes_both"
```

Debes ver `26 passed`: los 25 casos de señales (al menos 3 cm de margen y radio de 0,5 m o más) y que la línea pasa cada señal por su lado.

<details>
<summary>Ver la solución de _band, plan, knots</summary>

```python
def _band(sign, fixed):
    """Candidate offsets for the straight next to a corner."""
    if sign is None:
        # No sign at this end of the corner: the line may leave the neighbouring sign's offset.
        return [d for d in np.arange(fixed - FREE_SHIFT, fixed + FREE_SHIFT + 1e-9, 0.05)
                if abs(d) <= 0.3]
    if sign[1] is None:
        return [fixed]
    lateral, colour = sign
    edge = SIGN_HALF + OUTLINE_HALF_WIDTH
    low, high = (-OFFSET_LIMIT, lateral - edge) if colour == 'red' else (lateral + edge, OFFSET_LIMIT)
    return list(np.arange(low, high + 1e-9, OFFSET_GRID)) or [fixed]


@lru_cache(maxsize=256)
def plan(sign_a, sign_b, fixed_a, fixed_b, low_a=-1.0, low_b=-1.0):
    """Best (clearance, d_a, d_b, r) for a corner. ``fixed_*`` is the offset used on a side
    without a sign of known colour (the neighbouring sign's offset, or the default);
    ``low_*`` the smallest offset allowed on that side (beside the parking lot)."""
    best = None
    # A free end stays near its neighbour's offset; an end with a sign near the centre.
    pref_a = fixed_a if sign_a is None else 0.0
    pref_b = fixed_b if sign_b is None else 0.0
    for r in RADII:
        for d_a in [d for d in _band(sign_a, fixed_a) if d >= low_a] or [max(fixed_a, low_a)]:
            for d_b in [d for d in _band(sign_b, fixed_b) if d >= low_b] or [max(fixed_b, low_b)]:
                samples = path(d_a, d_b, r)
                if samples is None:
                    continue
                gap = clearance(samples, sign_a, sign_b)
                # Enough clearance: stay near the lane centre (shorter shifts, signs stay in
                # the camera's view), then prefer a wide arc. Otherwise: the most clearance.
                if gap >= ENOUGH:
                    score = (1, -abs(d_a - pref_a) - abs(d_b - pref_b), r)
                else:
                    score = (0, gap, r)
                if best is None or score > best[0]:
                    best = (score, gap, float(d_a), float(d_b), r)
    if best is None:
        return None
    return best[1:]


@lru_cache(maxsize=256)
def knots(d_a, d_b, r):
    """The line as (progress from the corner start, lateral offset) pairs."""
    x, y, _ = path(d_a, d_b, r)
    out = []
    for px, py in zip(x, y):
        if px <= 0.5:
            out.append((px - 0.5, py + 1.0))
        elif py >= -0.5:
            out.append((1.0 + py + 0.5, 1.0 - px))
        else:
            angle = math.atan2(py + 0.5, px - 0.5)
            out.append((1.0 + angle / (math.pi / 2), 0.5 - math.hypot(px - 0.5, py + 0.5)))
    return tuple(out)
```

</details>

### Paso 5.4: la esquina en el plan

El plan del paso 4 tiene nudos para todas las señales; en cada esquina hay que cambiar los suyos por la línea de la esquina.

Y debajo, este esqueleto:

```python
def corner_line(start, signs, low_a=-1.0, low_b=-1.0):
    """(progress, offset) knots of the line through the corner that starts at progress ``start``
    (an odd number: 1, 3, 5, ...). ``signs`` is {progress: (lateral, colour, offset)}; the sign at
    ``start`` (last seat of the straight) and at ``start + 1`` (first seat of the next one) shape
    the line; without them, the end keeps the neighbouring sign's offset (or 0)."""
    ...  # TODO 5.4


def merge(sign_knots, signs, phi, horizon, lot_direction=None):
    """The sign knots with every corner from 1.3 units behind the car to ``horizon`` ahead replaced
    by its line; sorted. ``lot_direction`` ('ccw'/'cw') keeps the lines off the parking lot: before
    corner 1 in CCW, after corner 7 in CW."""
    ...  # TODO 5.4
```

**Qué va dentro:** `corner_line(start, signs, low_a, low_b)`: la señal del último asiento de la recta (progreso `start`) y la del primero de la siguiente (`start + 1`) dan la línea; un extremo sin señal usa el desplazamiento vecino. `merge` recorre las esquinas desde 1,3 atrás hasta `horizon` delante, **sustituye** los nudos de dentro de cada esquina por su línea y lo ordena todo. Con `lot_direction`, junto al aparcamiento nunca baja de `LOT_OFFSET`.

**Un ejemplo:** Con una roja exterior en 1,0 (el último asiento de la recta de salida) la esquina 1 empieza a −0,30 del carril, pegada al muro, y sale a −0,10 con un arco de 0,6 m (9,8 cm de margen). Con el aparcamiento, junto a él nunca baja de −0,19.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_5.py -q -k "keep_off_the_parking_lot or merge"
```

Debes ver `2 passed`: la línea densa de la esquina en el plan y el límite del aparcamiento.

<details>
<summary>Ver la solución de corner_line, merge</summary>

```python
def corner_line(start, signs, low_a=-1.0, low_b=-1.0):
    """(progress, offset) knots of the line through the corner that starts at progress ``start``
    (an odd number: 1, 3, 5, ...). ``signs`` is {progress: (lateral, colour, offset)}; the sign at
    ``start`` (last seat of the straight) and at ``start + 1`` (first seat of the next one) shape
    the line; without them, the end keeps the neighbouring sign's offset (or 0)."""
    def fixed(seats):
        near = [signs[s] for s in seats if s in signs]
        return near[0][2] if near else 0.0

    sign_a, sign_b = signs.get(float(start)), signs.get(float(start + 1))
    fixed_a = sign_a[2] if sign_a else fixed((start - 0.5, start - 1.0))
    fixed_b = sign_b[2] if sign_b else fixed((start + 1.5, start + 2.0))
    planned = plan(sign_a and sign_a[:2], sign_b and sign_b[:2], round(fixed_a, 2), round(fixed_b, 2), low_a, low_b)
    if planned is None:
        return []
    return [(start + s, d) for s, d in knots(*planned[1:])]


def merge(sign_knots, signs, phi, horizon, lot_direction=None):
    """The sign knots with every corner from 1.3 units behind the car to ``horizon`` ahead replaced
    by its line; sorted. ``lot_direction`` ('ccw'/'cw') keeps the lines off the parking lot: before
    corner 1 in CCW, after corner 7 in CW."""
    knots_out = list(sign_knots)
    first = 2 * math.floor((phi - 1.3 - 1.0) / 2.0) + 1
    for start in range(first, int(phi + horizon) + 1, 2):
        low_a = LOT_OFFSET if lot_direction == 'ccw' and start % 8 == 1 else -1.0
        low_b = LOT_OFFSET if lot_direction == 'cw' and start % 8 == 7 else -1.0
        line = corner_line(start, signs, low_a, low_b)
        if line:
            knots_out = [k for k in knots_out if not line[0][0] <= k[0] <= line[-1][0]] + line
    return sorted(knots_out)
```

</details>

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_5.py -q
```

Da `29 passed`: 25 son los casos de esquina (exigen un margen de al menos 3 cm y un radio de al menos 0,5 m) y 4 comprueban el lado, `merge` y el aparcamiento.

### Prueba esto

- En el widget de la esquina, elige **Verde int. → roja ext.**: 3,4 cm de margen con un arco de 0,5 m. Fuerza el radio a 0,6 m (margen 0) y a 0,75 m (−7,2 cm: toca o pasa una señal por el lado equivocado).
- Fuerza 0,41 m, el coche a fondo: da 4,0 cm, más que 0,5 m, pero `plan()` no lo usa: con el volante a fondo no queda margen para corregir (el paso 6 lo necesita).

### Rómpelo

1. En `plan`, quita el `lru_cache`: la misión llama al plan en cada tick y la ronda se vuelve mucho más lenta.
2. Cambia `ENOUGH` a 0: cualquier línea que no toque «basta», y `plan()` elige la más cercana al centro aunque pase a milímetros de una señal.

## Si algo falla

- **Un caso da margen negativo.** Revisa el lado: rojo a la derecha (desplazamiento menor que la fila), verde a la izquierda.
- **La búsqueda tarda.** Usa `lru_cache`: en una ronda hay pocas combinaciones distintas.

## Resumen

- Cada esquina es recta-arco-recta con tres números: `d_a`, `d_b` y `r`.
- Se elige la de más margen, y si hay de sobra, la más centrada.
- Dos cruces de lado a lado dejan solo 3–4 cm: el límite conocido.

## Antes de seguir

- [ ] `test_obstacle_step_5.py` da `29 passed`.
- [ ] Sabes por qué no basta el desplazamiento del paso 4 dentro de una curva.
