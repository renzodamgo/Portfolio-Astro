---
guide: "obstacle-strategy"
order: 8
slug: "paso-8-aparcar"
title: "Aparcar en paralelo"
summary: "Tras las tres vueltas: acercarse alineado, parar, planificar las maniobras con una búsqueda A* y ejecutarlas despacio, una a una."
tag: "obstacle-step-8"
compareFrom: "obstacle-step-7"
---

Tras las tres vueltas, el reglamento da 15 puntos por aparcar del todo dentro del hueco y en paralelo al muro (7 si queda dentro a medias o torcido). El hueco mide **0,35 × 0,20 m** y el coche **0,233 × 0,148 m**: sobran 11,7 cm a lo largo y 5,2 cm a lo ancho. En este paso escribes `park.py`.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/yw305Q0khyo" title="Hybrid A* path planning for autonomous parallel parking of a trailer truck" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Hybrid A* path planning for autonomous parallel parking of a trailer truck</strong> · Atsushi Sakai (inglés). Aparcamiento en paralelo con una búsqueda A* sobre arcos (del autor de PythonRobotics).</figcaption>
</figure>
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/Mo6hTUZ-B6Q" title="Hybrid A-Star Path Planning - Autonomous Car" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Hybrid A-Star Path Planning - Autonomous Car</strong> · Vimal Raj Ayyappan (inglés). Hybrid A* en RViz con obstáculos.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

Al terminar la tercera vuelta, el coche sigue por la recta de salida pegado a una línea paralela al aparcamiento, se para un poco después del tope del fondo, se queda quieto un momento (está planificando) y entra marcha atrás en varias maniobras cortas, parando entre una y otra para girar las ruedas. En el laboratorio, solo con el aparcamiento, aparca del todo en 7 a 9 de cada 10 intentos, en 35 a 70 s.

<div data-widget="step-replay" data-src="/learn/assets/replays/obstacle-step-8.json"></div>

*Repetición del laboratorio del Obstacle (la copia de la web) con la solución del curso. Una vuelta y a aparcar: se acerca, planifica con A*, maniobra y, si hace falta, vuelve a planificar desde donde quedó.*

<div data-widget="obstacle-park"></div>

## La idea

### Una maniobra no cabe

Para aparcar marcha atrás en una sola maniobra, la esquina delantera exterior tiene que librar el tope del fondo mientras la trasera entra. Con el radio mínimo del coche (0,37 m en el eje trasero) eso pide un hueco de unos **0,42 m**, y el reglamento da 0,35. Hacen falta varias maniobras: entrar de culata, enderezar, adelante y atrás a fondo hasta quedar paralelo. Lo que hace una persona en un hueco justo.

### Se puede parar

Ninguna regla obliga a moverse todo el tiempo: solo cuentan los 3 minutos. Así que el coche **para**, piensa y maniobra despacio:

1. **Acercarse:** sigue la línea a 4 cm del aparcamiento (`y = −1,3 + 0,074 + 0,04`) hasta quedar alineado (menos de 8 mm y 2° de error) y a 5 cm del tope del fondo. Si al alinearse se pasa, vuelve marcha atrás en recta. Si no se alinea en 0,4 m, sigue igual.
2. **Planificar:** con el coche quieto, una búsqueda **A\*** sobre arcos de 3 cm (volante a fondo a cada lado, a la mitad o recto; hacia delante o hacia atrás) con el contorno del coche y las ruedas giradas, a **1,5 cm** de los topes y del muro (si no encuentra, a 1 cm). La meta es estar dentro del hueco 1,5 cm por cada lado y paralelo. Como la pose de parada es casi siempre la misma, el primer plan se calcula **antes de la ronda**: tarda unos segundos y durante la ronda no cuesta nada.
3. **Ejecutar:** cada tramo de arcos iguales es una maniobra. Para cada una: quieto mientras el servo gira (0,2 s más 1 s por cada 1,2 rad de giro), luego a **0,06 m/s** hasta completar el giro previsto, medido con el giroscopio, o la distancia en los tramos rectos.
4. **Corregir:** si al terminar no está dentro y paralelo, planifica otra vez desde donde quedó. Esa búsqueda empieza cerca de la meta y suele tardar milisegundos. Como mucho 10 veces.

### Detalles que importaron

| Detalle | Sin él | Con él |
|---|---|---|
| Esperar al servo entre maniobras | el coche arrancaba con las ruedas a medio girar y el plan no servía | de 2 de 6 a 7 de 10 aparcados del todo |
| Parar 1,2 cm antes (el motor sigue rodando unos 150 ms tras la orden) | se pasaba en cada maniobra de 3 cm | de 7 a 9 de 10 |
| Guardia: el contorno 2 cm más adelante a menos de 8 mm de un tope termina la maniobra | tocar un tope anula el aparcamiento y para la ronda | — |

### Durante las vueltas

El aparcamiento está en la recta de salida y los topes sobresalen 20 cm del muro exterior. Durante las vueltas, junto a ellos el plan no deja ir más allá de **−0,19 m** del carril, y las líneas de las esquinas de al lado respetan ese límite. Por reglamento, las señales de esa sección pasan a la fila interior. Y después de las tres vueltas las señales se pueden pasar por cualquier lado: el juez del curso ya no cuenta el lado mientras aparcas.

## Escríbelo

> **En este paso**
> - **Escribes:** `park.py`, en dos mitades: el modelo y la búsqueda (`footprint`, `move`, `Lot`, `search`) y la conducción (`nominal_plan` y la clase `Parking` con `step(now, x, y, th) → (speed, steer)`).
> - **Puedes copiar hecha** la primera mitad si prefieres centrarte en la conducción: es la búsqueda A\* del aparcamiento del equipo. Copia el archivo de la referencia y borra la clase `Parking`:

Crea `src/my_obstacle/my_obstacle/park.py` con su cabecera y sus constantes (ya hechas):

```python
"""Parallel parking after the three laps: stop, plan, then drive the plan slowly, move by move."""

import heapq
import math
import time
from functools import lru_cache

from robotek_common.vehicle import (FRONT_TRACK, LENGTH, OUTLINE_FRONT, OUTLINE_HALF_WIDTH, OUTLINE_REAR,
                                    REAR_AXLE_X, WHEEL_RADIUS, WHEEL_WIDTH, WHEELBASE)

from .lane import OUTER, wrap

HW = OUTLINE_HALF_WIDTH
LOT_DEPTH = .20
LIMIT_THICKNESS = .02
LOT_LENGTH = 1.5*LENGTH
LOT_END = .48                 # m, inner face of the limit next to the section line
FRONT_AXLE_X, HALF_TRACK, WHEEL_HALF_WIDTH = WHEELBASE/2, FRONT_TRACK/2, WHEEL_WIDTH/2
STEP = .03                    # m per arc of the search
SUBSTEPS = 3
GEAR_CHANGE = .05             # m-equivalent cost of a direction change
SEARCH_LIMIT = 200000         # expansions per search
GOAL_INSIDE = .015            # m the search keeps inside every side of the lot
STEERS = (-1., -.5, 0., .5, 1.)  # fraction of the steering limit
REACH = math.hypot(max(OUTLINE_FRONT, OUTLINE_REAR), HW+.02)   # m, outline radius incl. steered wheels


# ---------------------------------------------------------------- geometry and search
```

### Paso 8.1: el hueco

Antes de buscar cómo entrar hay que saber qué es «estar dentro»: las cuatro esquinas del coche dentro del hueco y paralelo al muro.

Y debajo, este esqueleto:

```python
def footprint(x, y, th, front=OUTLINE_FRONT, half_width=HW, rear=OUTLINE_REAR):
    """Rectangle of the car: `front` ahead of the pose and `rear` behind it (default: the overall outline)."""
    ...  # TODO 8.1


class Lot:
    """Lot interior [xa, xb] x [-OUTER, -OUTER + LOT_DEPTH] in the track frame."""
    ...  # TODO 8.1
```

**Qué va dentro:** `footprint` da las cuatro esquinas del contorno. `Lot(sign)`: el hueco del reglamento en el campo espejado (x de 0,13 a 0,48 en antihorario; y de −1,5 a −1,3), con `limits`, `parked` (rumbo a menos de 3° y las cuatro esquinas dentro), `free` (contorno y ruedas giradas lejos de topes y muro) y `arc`.

**Un ejemplo:** El coche centrado en (0,30, −1,40) con rumbo 0 está aparcado; a 10° o en y = −1,2, no.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_8.py -q -k "lot_of_the_rules or inside_and_parallel"
```

Debes ver `2 passed`: el hueco del reglamento (1,5 coches por 0,20 m) y qué es aparcado.

<details>
<summary>Ver la solución de footprint, Lot</summary>

```python
def footprint(x, y, th, front=OUTLINE_FRONT, half_width=HW, rear=OUTLINE_REAR):
    """Rectangle of the car: `front` ahead of the pose and `rear` behind it (default: the overall outline)."""
    c, s = math.cos(th), math.sin(th)
    return [(x+c*u-s*v, y+s*u+c*v) for u, v in ((front, half_width), (front, -half_width),
                                                  (-rear, -half_width), (-rear, half_width))]


class Lot:
    """Lot interior [xa, xb] x [-OUTER, -OUTER + LOT_DEPTH] in the track frame."""

    def __init__(self, sign):
        if sign > 0:
            self.xa, self.xb = LOT_END-LOT_LENGTH, LOT_END
        else:
            self.xa, self.xb = -LOT_END, -LOT_END+LOT_LENGTH
        self.y0, self.y1 = -OUTER, -OUTER+LOT_DEPTH

    def limits(self, margin=0.):
        """Boxes of the two limits, grown by margin."""
        return [(self.xa-LIMIT_THICKNESS-margin, self.xa+margin, self.y0, self.y1+margin),
                (self.xb-margin, self.xb+LIMIT_THICKNESS+margin, self.y0, self.y1+margin)]

    def parked(self, x, y, th, inside=0., parallel=math.radians(3.)):
        return abs(wrap(th)) <= parallel and all(
            self.xa+inside <= px <= self.xb-inside and self.y0+inside <= py <= self.y1-inside
            for px, py in footprint(x, y, th))

    def free(self, x, y, th, steer, margin):
        # Quick accept: the whole car (radius REACH) clear of wall and limits.
        if y-REACH > self.y1+margin or (y-REACH > self.y0+margin and (
                x+REACH < self.xa-LIMIT_THICKNESS-margin or x-REACH > self.xb+LIMIT_THICKNESS+margin)):
            return True
        shapes = [footprint(x, y, th)]+(front_wheels(x, y, th, steer) if steer else [])
        boxes = self.limits(margin)
        for poly in shapes:
            if min(p[1] for p in poly) < self.y0+margin or any(_overlaps(poly, *box) for box in boxes):
                return False
        return True

    def arc(self, pose, steer, direction, margin, length=STEP):
        """End pose of an arc, or None if it collides."""
        x, y, th = pose
        steps = max(1, round(SUBSTEPS*length/STEP))
        for _ in range(steps):
            x, y, th = move(x, y, th, steer, direction*length/steps)
            if not self.free(x, y, th, steer, margin):
                return None
        return x, y, th
```

</details>

### Paso 8.2: moverse como el coche

La búsqueda prueba miles de arcos cortos. El modelo de bicicleta es exacto en el eje trasero, no en el centro.

Y debajo, este esqueleto:

```python
def move(x, y, th, steer, ds):
    """Bicycle model about the rear axle; (x, y) is base_link."""
    ...  # TODO 8.2
```

**Qué va dentro:** Pasa al eje trasero (`REAR_AXLE_X`, negativo), gira `dth = ds·tan(steer)/WHEELBASE`, avanza por el rumbo medio y vuelve a `base_link`.

**Un ejemplo:** `move(0, 0, 0, 0, 0.1)` = (0,1, 0, 0): recto, 10 cm.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_8.py -q -k "rear_axle"
```

Debes ver `1 passed`: el modelo de bicicleta sobre el eje trasero.

<details>
<summary>Ver la solución de move</summary>

```python
def move(x, y, th, steer, ds):
    """Bicycle model about the rear axle; (x, y) is base_link."""
    rx, ry = x+REAR_AXLE_X*math.cos(th), y+REAR_AXLE_X*math.sin(th)
    dth = ds*math.tan(steer)/WHEELBASE
    mid = th+dth/2
    rx, ry, th = rx+ds*math.cos(mid), ry+ds*math.sin(mid), th+dth
    return rx-REAR_AXLE_X*math.cos(th), ry-REAR_AXLE_X*math.sin(th), th
```

</details>

### Paso 8.3: buscar las maniobras

No cabe en una maniobra (haría falta un hueco de 0,42 m y hay 0,35). A* prueba arcos de 3 cm hacia delante y hacia atrás y encuentra la secuencia más corta, como una persona que va y viene en un hueco justo.

Y debajo, este esqueleto:

```python
def search(lot, pose, gear, steer_limit, margin, deadline, weight=3.):
    """Weighted A* over STEP arcs to a pose GOAL_INSIDE the lot -> ([(steer, dir)], expanded)."""
    ...  # TODO 8.3


@lru_cache(maxsize=4)
def nominal_plan(steer_limit):
    """Arcs from the planning pose, computed once before the round (the lot and the approach
    line are fixed by the rules; CW is the same lot shifted along x). A few seconds; the
    corrections planned during the round start close to the lot and take milliseconds."""
    ...  # TODO 8.3
```

**Qué va dentro:** Cola de prioridad con `(coste + peso · h, coste, pose, marcha, camino)`; `h` = distancia al centro del hueco + 0,1 · |rumbo|. Para cada nodo: si está aparcado con 1,5 cm por lado, devuelve el camino; si no, los 5 volantes × 2 sentidos con `lot.arc`; cambiar de marcha cuesta 5 cm. `nominal_plan` busca una vez desde la pose de planificar y lo guarda.

**Un ejemplo:** Desde la pose de planificar: 24 arcos en 14 maniobras, 19 719 nodos. Mira el widget de arriba.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_8.py -q -k "planning_pose"
```

Debes ver `1 passed`: un plan desde la pose de planificar.

<details>
<summary>Ver la solución de search, nominal_plan</summary>

```python
def search(lot, pose, gear, steer_limit, margin, deadline, weight=3.):
    """Weighted A* over STEP arcs to a pose GOAL_INSIDE the lot -> ([(steer, dir)], expanded)."""
    cx, cy = (lot.xa+lot.xb)/2, (lot.y0+lot.y1)/2
    queue = [(0., 0., pose, gear, ())]
    seen = set()
    while queue and len(seen) < SEARCH_LIMIT and time.monotonic() < deadline:
        _, cost, (x, y, th), last, path = heapq.heappop(queue)
        key = (round(x/.01), round(y/.01), round(th/math.radians(3.)), last)
        if key in seen:
            continue
        seen.add(key)
        if lot.parked(x, y, th, inside=GOAL_INSIDE):
            return list(path), len(seen)
        for fraction in STEERS:
            steer = fraction*steer_limit
            for direction in (1., -1.):
                end = lot.arc((x, y, th), steer, direction, margin)
                if end is None:
                    continue
                g = 0 if direction > 0 else 1
                step_cost = STEP+(GEAR_CHANGE if last is not None and last != g else 0.)
                h = math.hypot(end[0]-cx, end[1]-cy)+.1*abs(wrap(end[2]))
                heapq.heappush(queue, (cost+step_cost+weight*h, cost+step_cost, end, g,
                                       path+((steer, direction),)))
    return None, len(seen)


@lru_cache(maxsize=4)
def nominal_plan(steer_limit):
    """Arcs from the planning pose, computed once before the round (the lot and the approach
    line are fixed by the rules; CW is the same lot shifted along x). A few seconds; the
    corrections planned during the round start close to the lot and take milliseconds."""
    lot = Lot(1.0)
    pose = (lot.xb + AHEAD, lot.y1 + OUTLINE_HALF_WIDTH + GAP, 0.0)
    for margin in PLAN_MARGINS:
        path, _ = search(lot, pose, None, steer_limit, margin, time.monotonic() + 60.0, 2.0)
        if path:
            return tuple(path)
    return ()
```

</details>

### Paso 8.4: conducir el plan

Planificar es la mitad: después hay que ejecutar cada maniobra con el coche de verdad, parando entre una y otra para girar las ruedas, y volver a planificar si algo no sale.

Y debajo, este esqueleto:

```python
class Parking:
    """PARK_APPROACH -> PARK_PLAN -> (PARK_STEER -> PARK_MOVE)* -> PARKED or PARK_FAIL."""
    ...  # TODO 8.4
```

**Qué va dentro:** Estados `PARK_APPROACH` → `PARK_PLAN` → (`PARK_STEER` → `PARK_MOVE`)* → `PARKED` o `PARK_FAIL`. Acercarse siguiendo la línea a 4 cm del hueco; planificar quieto; cada tramo de arcos iguales es una maniobra: quieto mientras gira el servo, luego a 0,06 m/s hasta el giro previsto menos lo que rueda tras la orden (1,2 cm). Si no quedó aparcado, otro plan (como mucho 10).

**Un ejemplo:** En la repetición del paso 8: 14 maniobras, un segundo plan desde donde quedó y aparcado a los 88 s.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_8.py -q -k "it_parks"
```

Debes ver `2 passed`: que aparca de verdad en el laboratorio, en los dos sentidos (unos 40 s).

<details>
<summary>Ver la solución de Parking</summary>

```python
class Parking:
    """PARK_APPROACH -> PARK_PLAN -> (PARK_STEER -> PARK_MOVE)* -> PARKED or PARK_FAIL."""

    def __init__(self, mission, speed, margin):
        self.speed = speed
        self.steer_limit = mission.p.steer_limit
        self.lot = Lot(1.0 if mission.selected_direction == 'ccw' else -1.0)
        self.state = 'PARK_APPROACH'
        self.moves = []             # [(steer, direction, length)]
        self.current = None         # (steer, direction, length, start pose)
        self.since = None
        self.plans = 0
        self.gear = None
        self.log = []

    def step(self, now, x, y, th):
        """-> (speed, steer) in the track frame."""
        if self.state in ('PARK_APPROACH', 'PARK_BACK'):
            return self._approach(now, x, y, th)
        if self.state == 'PARK_PLAN':
            if now - self.since >= SETTLE_TIME:
                self._plan(now, (x, y, th))
            return 0.0, 0.0
        if self.state == 'PARK_STEER':
            if now - self.since >= self.wait:
                self.state = 'PARK_MOVE'
            return 0.0, self.current[0]
        if self.state == 'PARK_MOVE':
            return self._drive(now, x, y, th)
        return 0.0, 0.0

    # ------------------------------------------------------------- phases
    def _approach(self, now, x, y, th):
        """Forward along the line until aligned with it and past the planning pose; back
        straight to that pose if the line-up took the car beyond it."""
        line = self.lot.y1 + OUTLINE_HALF_WIDTH + GAP
        target = self.lot.xb + AHEAD
        aligned = abs(y - line) < 0.008 and abs(wrap(th)) < math.radians(2.0)
        if self.state == 'PARK_APPROACH' and x >= target and (aligned or x >= target + RUN_PAST):
            self.state = 'PARK_BACK'
        if self.state == 'PARK_BACK':
            if x <= target + 0.005:
                self.state, self.since = 'PARK_PLAN', now
                return 0.0, 0.0
            # Reversing: steer against the heading error to keep the line.
            steer = -2.0 * wrap(math.atan2(line - y, -0.30) - th - math.pi)
            return -self.speed, max(-self.steer_limit, min(self.steer_limit, steer))
        steer = 2.0 * wrap(math.atan2(line - y, 0.30) - th)
        speed = 2.0 * self.speed if target - x > 0.30 else self.speed
        return speed, max(-self.steer_limit, min(self.steer_limit, steer))

    def _plan(self, now, pose):
        if self.lot.parked(*pose, inside=INSIDE, parallel=PARALLEL):
            self.state = 'PARKED'
            return
        if self.plans >= MAX_PLANS:
            self.state = 'PARK_FAIL'
            return
        self.plans += 1
        path, expanded = None, 0
        if self.plans == 1:
            path = list(nominal_plan(self.steer_limit)) or None
        for margin in () if path else PLAN_MARGINS:
            while margin > 0.004 and not self.lot.free(*pose, 0.0, margin):
                margin -= 0.002      # overshoot: plan with what is left
            path, used = search(self.lot, pose, self.gear, self.steer_limit, margin,
                                time.monotonic() + PLAN_BUDGET, 2.0)
            expanded += used
            if path:
                break
        self.log.append(dict(event='park_plan', pose=list(pose), arcs=len(path or []), expanded=expanded))
        if not path:
            self.state = 'PARK_FAIL'
            return
        self.moves = []
        for steer, direction in path:
            if self.moves and self.moves[-1][:2] == (steer, direction):
                self.moves[-1] = (steer, direction, self.moves[-1][2] + STEP)
            else:
                self.moves.append((steer, direction, STEP))
        self._next(now, pose)

    def _next(self, now, pose):
        if not self.moves:
            self.state, self.since = 'PARK_PLAN', now
            return
        steer, direction, length = self.moves.pop(0)
        previous = self.current[0] if self.current else 0.0
        self.wait = STEER_TIME[0] + STEER_TIME[1] * abs(steer - previous)
        self.current = (steer, direction, length, pose)
        self.gear = 0 if direction > 0 else 1
        self.state, self.since = 'PARK_STEER', now

    def _drive(self, now, x, y, th):
        steer, direction, length, (x0, y0, th0) = self.current
        if abs(steer) > 1e-6:
            # Heading change of the arc: the gyro measures it better than the distance.
            done = abs(wrap(th - th0)) >= (length - COAST) * abs(math.tan(steer)) / WHEELBASE
        else:
            done = math.hypot(x - x0, y - y0) >= length - COAST
        ahead = move(x, y, th, steer, direction * GUARD_AHEAD)
        if done or not self.lot.free(*ahead, steer, GUARD_MARGIN):
            if not done:
                self.moves = []      # the plan no longer fits: plan again from here
            self._next(now, (x, y, th))
            return 0.0, steer
        return direction * self.speed, steer
```

</details>

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_8.py -q        # 6 passed, ~40 s (aparca de verdad en el laboratorio)
python3 -m robotek_evaluation.obstacle_lab --strategy my_obstacle.strategy:Strategy --parking --layouts 0-9
ros2 launch robotek_course obstacle_round.launch.py strategy:=my_obstacle seed:=4 direction:=ccw parking:=true gui:=true
python3 course/obstacle/verify_step.py 8          # Gazebo sin ventana: exige 55 puntos y ronda válida
```

### Prueba esto

- En el widget de aparcar, mueve la salida 6 cm hacia delante o tuércela 4° y pulsa **Planificar (A*)**: el plan cambia, a veces con más maniobras.
- Cambia el tope del volante a 25°: desde la pose del curso salen 19 arcos (10 290 nodos) en vez de 24 (19 719).
- Sube el margen a 3 cm: la búsqueda llega a las 200 000 expansiones sin plan. Por eso el curso usa 1,5 cm y, si no sale, 1 cm.

### Rómpelo

1. En `move`, gira alrededor del centro del coche en vez del eje trasero: la prueba del modelo de bicicleta falla y los planes dejan de servir al coche real.
2. Quita la espera del servo entre maniobras (`STEER_TIME`): el coche arranca con las ruedas a medio girar. En el laboratorio del equipo, sin esa espera aparcaban 2 de cada 6; con ella, 7 de cada 10.

## Si algo falla

- **Toca un tope al entrar.** Sube el margen del plan o la guardia; revisa que esperas al servo.
- **Se queda maniobrando sin terminar.** Tu coche rueda más de lo que crees tras la orden de parar: mide cuánto y ajusta el margen de parada.
- **En Gazebo se queda quieto varios segundos y después la ronda llega a 180 s.** Es el límite conocido del paso 9: una corrección larga bloquea el nodo.

## Resumen

- Una maniobra no cabe: hacen falta unas 14, cortas y despacio.
- Parar está permitido: se planifica con el coche quieto y se ejecuta maniobra a maniobra.
- Esperar al servo y descontar lo que rueda el coche llevaron el aparcamiento de 2 de 6 a 9 de 10.

## Antes de seguir

- [ ] `test_obstacle_step_8.py` da `6 passed` (tarda unos 40 s).
- [ ] En el laboratorio, con `--parking`, ves rondas de 55 puntos.
