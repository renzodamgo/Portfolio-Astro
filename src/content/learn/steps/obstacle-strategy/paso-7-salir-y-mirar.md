---
guide: "obstacle-strategy"
order: 7
slug: "paso-7-salir-y-mirar"
title: "La misión: salir, mirar, tres vueltas"
summary: "Une las piezas en la estrategia: la salida con una señal encima, mirar las señales cuyo color falta, tres vueltas y parar."
tag: "obstacle-step-7"
compareFrom: "obstacle-step-6"
---

Tienes la pose, las señales, la línea y el volante. Falta la **misión**: qué hace el coche en cada momento de la ronda. En este paso escribes `mission.py` y `strategy.py`, la subclase de `ObstacleStrategyBase` que une todo. Aquí entran dos maniobras que no se ven en el Open: **retroceder en la salida** y **mirar** una señal cuyo color falta.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/NTEHRjiAY2I" title="How to Code a State Machine | Embedded System Project Series #26" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>How to Code a State Machine | Embedded System Project Series #26</strong> · Artful Bytes (inglés). La misión es una máquina de estados: así se programa una.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

La primera ronda completa: tres vueltas y parada en la sección de salida, 40 puntos. En el laboratorio, el set de prueba (5 campos × 2 sentidos × 5 semillas de ruido) pasa de 30 a **44 rondas válidas de 50** al añadir «mirar». En Gazebo, la referencia hizo **40 puntos, ronda válida, en 115,6 s** en el campo 4 CCW.

<div data-widget="step-replay" data-src="/learn/assets/replays/obstacle-step-7.json"></div>

*Repetición del laboratorio del Obstacle (la copia de la web) con la solución del curso. La ronda del reglamento: se para a mirar dos señales sin color, da tres vueltas y para en la sección de salida.*

## La idea

### Estados

| Estado | Qué hace | Cuándo termina |
|---|---|---|
| `SETUP` | 0,3 s quieto calibrando el sesgo del giroscopio; elige el sentido (paso 2) | con el sentido y la pose inicial |
| `RUN` | memoria de señales, plan, volante y velocidad | progreso ≥ 24,7 (o ≥ 24 si aparca, paso 8) |
| `STOP` | parado | fin de la ronda |

<div data-widget="obstacle-mission"></div>

La salida y «mirar» son fases dentro de `RUN`: devuelven velocidad y volante propios mientras duran.

### La salida: retroceder si la primera señal está encima

El coche arranca en el progreso 0,25. Si hay una señal en el asiento 0,5, la tiene 0,25 m delante. Si además le toca pasarla por el otro lado (por ejemplo una roja exterior, que pide −0,354 m), ningún camino hacia delante llega: necesita moverse 0,2 m de lado en 0,1 m de avance.

La misión se queda quieta **0,25 s** para archivar las primeras señales (hasta 1 s si la de delante aún no tiene color) y calcula cuánto le falta: `0,55 + 0,8 · |cambio de lado| − distancia hasta la señal`. Si falta, **retrocede en recta** a 0,15 m/s esa distancia, como mucho 0,5 m.

Pero el LiDAR no ve detrás del coche (±110°), y un retroceso a ciegas puede chocar con una señal del asiento 0. La regla del sorteo resuelve esto: **una carta con dos señales usa siempre los dos extremos de la recta, nunca el medio**. Si hay una señal en el asiento central (0,5), la recta tiene una sola señal y el asiento de detrás está vacío. Solo en ese caso se retrocede. Así se salvó el campo 2 CW, que antes chocaba al segundo.

### Mirar: cuando el color no llega

En CW el lado de la isla de la cámara llega solo a 28,9°. Una señal interior justo tras una esquina queda a 31–40° hasta que es tarde para cambiar de lado: el coche la pasaba por el lado equivocado en los campos 3 y 4 CW.

Cuando la próxima señal **no tiene color** y está entre **0,6 y 1,4 unidades** delante, el coche se para, **retrocede con el volante a fondo hacia el lado contrario** hasta que el morro gira **15°** hacia la señal y espera **0,5 s** (tres cuadros de la cámara). Luego sigue: el plan ya tiene el color y el volante del paso 6 recupera la línea. Se hace una sola vez por asiento. Dura unos 2 s y el reglamento lo permite (9.21: ir hacia atrás dentro de la misma sección).

| Versión | Set de prueba (50 rondas) |
|---|---:|
| todo lo anterior y la salida con retroceso, sin parar a mirar | 30 |
| + parar a mirar las señales sin color | **44** |

Los campos 3 y 4 CW pasaron de 0 a 5 de 5 semillas.

### Parar

Tras 24,7 unidades (tres vueltas y 0,7 m dentro de la recta de salida) frena: a 1,2 unidades del final baja a 0,15 m/s y se detiene dentro de la sección de salida. El juez exige 30 s parado.

### Cuando hay algo delante

Si algo queda a menos de 0,16 m al frente, retrocede 0,8 s a 0,15 m/s y vuelve a intentar. Y si el último escaneo tiene más de 0,35 s, frena: con datos viejos no se conduce.

## Escríbelo

> **En este paso**
> - **Escribes:** `mission.py` (`Params`, `make_params` y la clase `Mission` con `observe` y `step`) y `strategy.py` (`Strategy(ObstacleStrategyBase)` con `update`).
> - **Copias hecho:** el `drive.py` final.

```bash
git show obstacle-step-7:src/my_obstacle/my_obstacle/drive.py > src/my_obstacle/my_obstacle/drive.py
```

Crea `src/my_obstacle/my_obstacle/mission.py` con su cabecera y sus constantes (ya hechas):

```python
"""The mission (step 7): SETUP -> RUN -> (PARK) -> STOP."""

from dataclasses import dataclass, fields
import math

import numpy as np

from robotek_common.vehicle import OUTLINE_HALF_WIDTH

from . import corner, follow, lane, plan
from .localizer import Localizer, direction_from_scan, scan_points
from .signs import SeatMemory

CALIBRATE_SECONDS = 0.3
DIRECTION_MARGIN = (0.10, 0.03)  # wall-fit margin to pick the direction: at once, and after the wait
DIRECTION_WAIT = 1.0        # s of scans (the parking lot limits clutter the outer wall in CCW)
SIDE_CENTER = math.pi / 2
SIDE_HALF_WIDTH = 0.44
FRONT_HALF_WIDTH = 0.35
RECOVER_SPEED = 0.15
RECOVER_SECONDS = 0.8
START_LOOK = (0.25, 1.0)    # s stopped at Start to file the first signs; at most, for a near colour
BACKUP_LIMIT = 0.5          # m the car may back up at Start
PEEK_AT = (0.6, 1.4)        # track units to an unknown sign where the car stops to look at it
PEEK_TURN = math.radians(15.0)  # rad the nose turns toward the sign, backing up at full lock
PEEK_LOOK = 0.5             # s stopped looking
```

### Paso 7.1: los parámetros

Todo lo que se ajusta sin tocar el código va en un solo sitio, y un nombre mal escrito no puede pasar en silencio.

Y debajo, este esqueleto:

```python
@dataclass
class Params:
    ...  # TODO 7.1


def make_params(values=None):
    ...  # TODO 7.1
```

**Qué va dentro:** `Params` es un `dataclass` con los valores de la tabla de arriba. `make_params(values)` compara los nombres con los campos y lanza `ValueError` si alguno no existe; si no, crea `Params` con los valores en `float`.

**Un ejemplo:** `make_params({'cruise_sped': 0.4})` falla: el nombre está mal escrito.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_7.py -q -k "unknown_parameters"
```

Debes ver `1 passed`: que un parámetro desconocido se rechaza.

<details>
<summary>Ver la solución de Params, make_params</summary>

```python
@dataclass
class Params:
    cruise_speed: float = 0.35      # m/s on a clear lane
    pillar_speed: float = 0.30      # m/s while passing a sign or changing side
    finish_speed: float = 0.15      # m/s on the last metres and the stop
    pillar_clearance: float = 0.18  # m from a sign to the car's side on a straight
    pillar_lookahead: float = 1.80  # m ahead a sign is looked for
    steer_kp: float = 1.5           # rad of steer per rad of heading error to the planned line
    steer_kd: float = 0.2           # gyro damping
    steer_limit: float = 0.307      # rad, the real car after per-side compensation (17.6 deg)
    stop_progress: float = 24.7     # track units: 3 laps + 0.7 into the start straight
    park: float = 0.0               # 1: park in the lot after the three laps
    park_after: float = 24.0        # track units driven before parking (3 laps; 0 in parking-only tests)
    park_speed: float = 0.06        # m/s while manoeuvring in the lot
    park_margin: float = 0.015      # m kept from the limits and the wall by the parking search
    scan_max_age: float = 0.35      # s; an older scan brakes


def make_params(values=None):
    known = {f.name for f in fields(Params)}
    unknown = set(values or {}) - known
    if unknown:
        raise ValueError('Unsupported parameters: ' + ', '.join(sorted(unknown)))
    return Params(**{k: float(v) for k, v in (values or {}).items()})
```

</details>

### Paso 7.2: los estados

La misión es un repartidor: según el estado, cada tick va a una función. `SETUP` calibra y elige el sentido, `RUN` conduce, `PARK` aparca (paso 8) y `STOP` se queda quieto.

Y debajo, este esqueleto:

```python
class Mission:
    # ... (lo de los pasos anteriores)

    def observe(self, observations, stamp):
        """Camera observations paired with LiDAR clusters: dict(x, y, color) in the car frame."""
        ...  # TODO 7.2

    def step(self, now, scan, scan_stamp, clusters, yaw, gyro, distance):
        """One tick -> (speed, steer, state). ``clusters`` are those of ``scan``; ``yaw`` is the
        integrated gyro, ``gyro`` the raw rate, ``distance`` the LiDAR odometry since last tick."""
        ...  # TODO 7.2
```

**Qué va dentro:** `observe` guarda las observaciones de la cámara. `step` calcula `dt` (entre 0 y 0,1 s), quita el sesgo del giroscopio, guarda el escaneo si es nuevo y reparte: `SETUP` → `_setup`, `STOP` → `(0, 0, "STOP")`, `PARK` → `_park`, si no `_run`.

**Un ejemplo:** Los primeros 0,3 s devuelve `(0, 0, "SETUP")`; con el primer escaneo bueno elige el sentido y pasa a `RUN`.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_7.py -q -k "setup_calibrates or stops_after"
```

Debes ver `3 passed`: la calibración y el sentido en los dos sentidos, y que para tras tres vueltas.

<details>
<summary>Ver la solución de observe, step</summary>

```python
    def observe(self, observations, stamp):
        """Camera observations paired with LiDAR clusters: dict(x, y, color) in the car frame."""
        self._observations = observations or []
        self._obs_stamp = stamp

    def step(self, now, scan, scan_stamp, clusters, yaw, gyro, distance):
        """One tick -> (speed, steer, state). ``clusters`` are those of ``scan``; ``yaw`` is the
        integrated gyro, ``gyro`` the raw rate, ``distance`` the LiDAR odometry since last tick."""
        dt = 0.0 if self._last_now is None else max(0.0, min(0.1, now - self._last_now))
        self._last_now = now
        gyro -= self.gyro_bias
        new_scan = scan is not None and scan_stamp > self._scan_stamp
        if new_scan:
            self._scan = scan
            self._scan_stamp = scan_stamp
            self._clusters = clusters
        if self.state == 'SETUP':
            return self._setup(dt, scan, new_scan, yaw, gyro)
        if self.state == 'STOP':
            return 0.0, 0.0, 'STOP'
        if self.state == 'PARK':
            return self._park(now, yaw, gyro, distance)
        return self._run(now, yaw, gyro, distance)
```

</details>

### Paso 7.3: la salida

Si la primera señal está justo delante, el coche no tiene metros para cambiar de lado. Retroceder un poco en recta se los da (el reglamento deja ir hacia atrás en la sección de salida).

Y debajo, este esqueleto:

```python
class Mission:
    # ... (lo de los pasos anteriores)

    def _start(self, now):
        """At Start: stop to read the first signs, then back up straight when the first sign is
        too close to reach its side going forward (a sign 0.25 m ahead, say)."""
        ...  # TODO 7.3

    def _backup(self):
        """Metres to back up so the side change to the first sign fits (0.55 m + 0.8 m per metre
        of shift, measured with the real servo). The LiDAR cannot see the seat behind the car;
        a sign in the middle seat comes from a one-sign card, so that seat is empty (rules,
        fig. 8c); with a sign at the end seat it may not be, and the car does not back up."""
        ...  # TODO 7.3
```

**Qué va dentro:** `_start`: quieto `START_LOOK` (0,25 s, hasta 1 s si la señal de delante no tiene color); después, retrocede a 0,15 m/s hasta `_backup_to`. `_backup`: solo con una señal en el asiento central (`progreso % 2 == 0,5`), `0,55 + 0,8 · |desplazamiento| − lo que ya hay`, entre 0 y 0,5 m.

**Un ejemplo:** Una roja interior en 0,5 con el coche en 0,25: hacen falta 0,55 + 0,8 · 0,154 − 0,1 = 0,57 m; retrocede 0,5 (el máximo).

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_7.py -q -k "backing_up"
```

Debes ver `1 passed`: que retrocede solo con una señal en el asiento central.

<details>
<summary>Ver la solución de _start, _backup</summary>

```python
    def _start(self, now):
        """At Start: stop to read the first signs, then back up straight when the first sign is
        too close to reach its side going forward (a sign 0.25 m ahead, say)."""
        if self._backup_to == -math.inf:
            return None
        if self._run_since is None:
            self._run_since = now
        if self._backup_to is None:
            waited = now - self._run_since
            near = self.pillar is not None and self.pillar[1] - self.phi < 0.5
            if waited < START_LOOK[0] or (near and self.pillar[2] is None and waited < START_LOOK[1]):
                return 0.0, 0.0, 'RUN'
            self._backup_to = self.phi - self._backup()
        if self.phi > self._backup_to:
            self.speed = -RECOVER_SPEED
            return -RECOVER_SPEED, 0.0, 'RUN'
        self._backup_to = -math.inf
        return None

    def _backup(self):
        """Metres to back up so the side change to the first sign fits (0.55 m + 0.8 m per metre
        of shift, measured with the real servo). The LiDAR cannot see the seat behind the car;
        a sign in the middle seat comes from a one-sign card, so that seat is empty (rules,
        fig. 8c); with a sign at the end seat it may not be, and the car does not back up."""
        if self.pillar is None or self.pillar[1] % 2.0 != 0.5:
            return 0.0
        hold = self.pillar[1] - plan.HOLD
        need = 0.55 + 0.8 * abs(self.offset_at(hold)) - (hold - self.phi)
        return lane.clamp(need, 0.0, BACKUP_LIMIT)
```

</details>

### Paso 7.4: mirar

Si el color no llega a tiempo, el coche para, retrocede girando para que el morro (y la cámara) apunten a la señal, y espera un cuadro. Lento, pero mejor que adivinar.

Y debajo, este esqueleto:

```python
class Mission:
    # ... (lo de los pasos anteriores)

    def _look(self, now, th):
        """Stop short of a sign whose colour is still unknown, back up at full lock so the nose
        (and the camera, 66.7 deg wide) turns toward it, and wait for a frame. In CW the island
        side of the camera only reaches 28.9 deg, so an inner sign just after a corner is
        otherwise never seen before the car must commit to a side."""
        ...  # TODO 7.4
```

**Qué va dentro:** Si la próxima señal no tiene color, no se miró antes y está entre 0,6 y 1,4 unidades: fase `back` (retrocede a fondo hacia el lado contrario hasta girar 15° o 3 s), fase `look` (quieto `PEEK_LOOK`, 0,5 s). En cuanto llega el color, termina.

**Un ejemplo:** En la ronda del paso 7 mira dos veces: a los 12 s y a los 31 s.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_7.py -q -k "stops_to_look"
```

Debes ver `1 passed`: que se para a mirar una señal sin color.

<details>
<summary>Ver la solución de _look</summary>

```python
    def _look(self, now, th):
        """Stop short of a sign whose colour is still unknown, back up at full lock so the nose
        (and the camera, 66.7 deg wide) turns toward it, and wait for a frame. In CW the island
        side of the camera only reaches 28.9 deg, so an inner sign just after a corner is
        otherwise never seen before the car must commit to a side."""
        if self._peek is None:
            pillar = self.pillar
            if pillar is None or pillar[2] is not None:
                return None
            seat = int(round(pillar[1] * 2.0)) % 16
            if seat in self._peeked or not PEEK_AT[0] <= pillar[1] - self.phi <= PEEK_AT[1]:
                return None
            self._peeked.add(seat)
            self._peek = [seat, 'back', th, now, 1.0 if pillar[0] > 0.0 else -1.0]
        seat, phase, start_th, since, side = self._peek
        if self.pillar is not None and self.pillar[2] is not None:
            self._peek = None
            return None
        if phase == 'back':
            if abs(lane.wrap(th - start_th)) < PEEK_TURN and now - since < 3.0:
                self.speed = -RECOVER_SPEED
                return -RECOVER_SPEED, -side * self.p.steer_limit * self.sign(), 'RUN'
            self._peek = [seat, 'look', start_th, now, side]
        elif now - since >= PEEK_LOOK:
            self._peek = None
            return None
        self.speed = 0.0
        return 0.0, 0.0, 'RUN'
```

</details>

### Paso 7.5: la estrategia

La misión no sabe de ROS. `Strategy` la conecta con la clase base del curso, que le da los sensores ya preparados (escaneo, giroscopio integrado, distancia, señales).

Y debajo, este esqueleto:

```python
class Strategy(ObstacleStrategyBase):
    ...  # TODO 7.5
```

**Qué va dentro:** En `update`: si hay un escaneo nuevo, sus clústeres (`scan_clusters`, una vez por escaneo); `mission.observe(self.signs, self.signs_stamp)`; `mission.step(...)`; copia el sesgo, la etiqueta, `done` (`STOP`) y `parked`.

**Un ejemplo:** Es lo que corren Gazebo, el laboratorio y las pruebas: la misma clase en los tres.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_7.py -q -k "is_a_course_strategy or each_scan_stamp"
```

Debes ver `2 passed`: que es una estrategia del curso y que cada escaneo se usa una vez.

<details>
<summary>Ver la solución de Strategy</summary>

```python
class Strategy(ObstacleStrategyBase):
    def __init__(self, direction='auto', parking=False, params=None):
        super().__init__()
        values = dict(params or {})
        if parking:
            values.setdefault('park', 1.0)
        self.direction = direction          # the mission reads it from the walls; kept for the record
        self.mission = Mission(values)
        self._clusters = []
        self._clusters_stamp = None

    def update(self, now, dt):
        if self.new_scan and self.scan_stamp != self._clusters_stamp:
            self._clusters, self._clusters_stamp = scan_clusters(self.scan), self.scan_stamp
        self.mission.observe(self.signs, self.signs_stamp)
        speed, steer, state = self.mission.step(now, self.scan, self.scan_stamp, self._clusters,
                                                self.yaw, self.gyro, self.travelled)
        self.gyro_bias = self.mission.gyro_bias
        self.label = state
        self.done = state == 'STOP'
        self.parked = self.mission.parking is not None and self.mission.parking.state == 'PARKED'
        return speed, steer
```

</details>

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_7.py -q        # 10 passed
python3 -m robotek_evaluation.obstacle_lab --strategy my_obstacle.strategy:Strategy --layouts 0-4 --seeds 0-4 --workers 8
ros2 launch robotek_course obstacle_round.launch.py strategy:=my_obstacle seed:=4 direction:=ccw parking:=false gui:=true
python3 course/obstacle/verify_step.py 7          # Gazebo sin ventana: exige 40 puntos y ronda válida
```

El laboratorio imprime una línea por ronda (puntos, tiempo, válida, margen, fallo) y el total. Gazebo imprime la puntuación del árbitro al terminar.

### Prueba esto

- En el widget de la misión, mira la ronda entera: cuánto tiempo pasa en `SETUP`, cuándo se para a mirar (`LOOK`) y cuándo para del todo.
- Mueve los deslizadores de la velocidad: acerca la señal a menos de 0,8 unidades (0,30 m/s), la pared a menos de 0,7 m (0,20 m/s) y lo que falta para parar a menos de 1,2 (0,15 m/s).
- La **lección interactiva** de este paso corre tu misión tres vueltas en el campo 4.

### Rómpelo

1. Quita la condición del asiento central y retrocede siempre: en el campo 4 el coche choca con la señal del asiento 0 al salir.
2. Desactiva «mirar»: los campos 3 y 4 CW vuelven a fallar por lado.

## Si algo falla

- **No arranca.** Sin `/start` no hay ronda: lo publica el árbitro (o el botón del coche real).
- **`ValueError: Unsupported parameters`.** Un nombre de parámetro mal escrito: `make_params` no lo acepta.
- **Se pasa de la sección de salida.** Revisa el progreso de parada (24,7) y la rampa de frenado.

## Resumen

- Tres estados; la salida y mirar son fases cortas dentro de `RUN`.
- Retroceder en la salida solo cuando el reglamento garantiza que no hay nada detrás.
- Parar a mirar una señal sin color: de 30 a 44 rondas válidas de 50.

## Antes de seguir

- [ ] `test_obstacle_step_7.py` da `10 passed`.
- [ ] Una ronda completa en Gazebo con 40 puntos.
