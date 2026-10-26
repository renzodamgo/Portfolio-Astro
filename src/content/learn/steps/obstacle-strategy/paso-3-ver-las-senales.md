---
guide: "obstacle-strategy"
order: 3
slug: "paso-3-ver-las-senales"
title: "Ver las señales y recordarlas"
summary: "El LiDAR dice dónde está una señal y la cámara de qué color es; una memoria por asiento guarda las dos cosas toda la ronda."
tag: "obstacle-step-3"
compareFrom: "obstacle-step-2"
---

El LiDAR ve las señales como grupos pequeños de puntos, pero no sabe de qué color son. La cámara ve el color, pero solo en un ángulo estrecho delante del coche. En este paso escribes `signs.py`: una **memoria por asiento** que archiva cada señal que ve el LiDAR en uno de los 24 asientos del reglamento y le suma votos de color cada vez que la cámara la ve.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/3D7O_kZi8-o" title="OpenCV Python Tutorial For Beginners 13 - Object Detection and Object Tracking Using HSV Color Space" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>OpenCV Python Tutorial For Beginners 13 - Object Detection and Object Tracking Using HSV Color Space</strong> · ProgrammingKnowledge (inglés). Detectar objetos por color con HSV, como las señales rojas y verdes.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

Conduces con `keyboard_drive` como en el paso 2 y miras `ros2 topic echo /obstacle/signs`: la memoria de asientos (asiento, fila, color y veces visto) crece a medida que recorres la primera vuelta. En la segunda vuelta ya no aparecen asientos nuevos: el campo no cambia durante la ronda.

<div data-widget="step-replay" data-src="/learn/assets/replays/obstacle-step-3.json"></div>

*Repetición del laboratorio del Obstacle (la copia de la web) con la solución del curso. Cada señal que el LiDAR ve dos veces entra en la memoria por asiento; la cámara le pone color, a veces mucho después (la del centro de la recta de arriba se ve sin color en el segundo 9 y roja en el 19).*

## La idea

### Dónde: clústeres del LiDAR

Una señal es una caja de 5 cm. El LiDAR la ve como unos pocos puntos seguidos separados del muro. `scan_clusters(scan)` (te lo da `robotek_course.obstacle_vision`) agrupa los puntos consecutivos que están a menos de 7 cm entre sí y se queda con los grupos de **1,5 a 12 cm** de diámetro a menos de 2,5 m; un muro es mucho más largo. Mueve el centro 2,5 cm hacia atrás (el LiDAR ve la cara frontal y el centro está detrás).

### De qué color: la cámara

La cámara busca manchas rojas y verdes con umbrales HSV y estima el ángulo de cada una. `associate(blocks, clusters)` le pone a cada clúster el color de la mancha que cae en su dirección. El resultado llega a tu estrategia por `on_signs(observations, stamp)` como una lista de `dict(x, y, color)` en el sistema del coche.

La cámara del coche real tiene **66,7°** de campo y está **girada 4,4° a la izquierda**. Mirando hacia delante ve de −29° a +37,8°. En CW, con el campo espejado, el lado de la isla solo llega hasta **28,9°**. Esto importa en el paso 7.

### Un asiento por señal

Con la pose del paso 2, cada clúster se pasa al campo y se mide su progreso con `progress_of` y su desplazamiento lateral respecto al carril. Como las señales solo pueden estar en los asientos:

- el progreso se redondea al **medio punto** más cercano (2k, 2k + 0,5 o 2k + 1) si está a menos de **0,15** unidades;
- el lateral se redondea a la **fila**: +0,1 si es positivo, −0,1 si no;
- se descartan los clústeres a más de **0,2 m** del carril y los de las esquinas (asientos 2k + 1,5). Los topes del aparcamiento sobresalen hasta −0,3 m: con un sector más ancho (la primera versión usaba 0,45 m) la memoria archivó un tope como señal, y el coche retrocedió contra la señal de atrás.

Cada asiento guarda su fila, los **votos** de cada color y cuántas veces se vio. Cuenta como señal a partir de **2 vistas**. El color es el más votado.

### Por qué una memoria y no la vista del momento

La primera versión decidía el lado con la cámara del momento y la señal más cercana. Fallaba en 4 de los 10 campos de prueba por la misma razón: las señales de la fila interior justo después de una esquina **no entran nunca en la cámara** antes de que el coche tenga que decidir. Una de ellas se vio en 15 cuadros, pero en el momento de decidir la cámara miraba otra cosa. Con la memoria, lo que se vio una vez sirve para el resto de la ronda, también en las vueltas 2 y 3.

<div data-widget="obstacle-signs"></div>

## Escríbelo

> **En este paso**
> - **Escribes:** `signs.py` con `sign_position`, `sign_colour` y la clase `SeatMemory` (`remember`, `colour`, `next_sign`, `ahead`).
> - **Copias hecho:** `drive.py` de este paso.

```bash
git show obstacle-step-3:src/my_obstacle/my_obstacle/drive.py > src/my_obstacle/my_obstacle/drive.py
```

Crea `src/my_obstacle/my_obstacle/signs.py` con su cabecera y sus constantes (ya hechas):

```python
"""The signs (step 3): find them with the LiDAR, colour them with the camera, remember them by seat."""

import math

from . import lane

SECTOR = 0.2            # m from the lane centre a cluster may be and still be a sign (rows at +-0.1;
                        # the parking lot limits stick out to -0.3)
SEAT_SNAP = 0.15        # track units between a cluster and the seat it is filed under
SEAT_HITS = 2           # sightings before a seat counts as a sign
COLOUR_GATE = 0.12      # m between an observation and a cluster to give it the colour
COLOUR_AGE = 0.6        # s; older observations colour nothing
SWAP = {'red': 'green', 'green': 'red'}
```

### Paso 3.1: dónde está un clúster

El LiDAR ve una señal como un grupito de puntos separado de los muros (un clúster). Para guardarla hay que decir dónde está **en el carril**: su progreso y su lado.

Y debajo, este esqueleto:

```python
def sign_position(cluster, pose, phi, sign, lookahead):
    """(progress, lateral) of a cluster on the lane, or None when it is behind the car or too far.

    ``cluster`` is in the car frame (x ahead, y left) of the real car; ``sign`` mirrors it for CW.
    """
    ...  # TODO 3.1
```

**Qué va dentro:** Pasa el clúster al campo con la pose (su `y` por `sign` en horario). Descártalo si, medido a lo largo del carril desde `lane_pose(phi)`, está detrás (menos de −0,05 m) o más allá de `lookahead`, o a más de `lookahead + 0,5` m del coche. Su progreso es `progress_of(wx, wy, phi)` y su lateral, la proyección sobre `lane_normal` en ese progreso.

**Un ejemplo:** El coche en (−0,5, −1,0) mira al este y ve un clúster en (1,0, 0,1) del coche: progreso 1,0, lateral +0,1 (fila interior).

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_3.py -q -k "a_sign_ahead or behind_or_too_far"
```

Debes ver `2 passed`: una señal por delante sobre el carril, y nada detrás o demasiado lejos.

<details>
<summary>Ver la solución de sign_position</summary>

```python
def sign_position(cluster, pose, phi, sign, lookahead):
    """(progress, lateral) of a cluster on the lane, or None when it is behind the car or too far.

    ``cluster`` is in the car frame (x ahead, y left) of the real car; ``sign`` mirrors it for CW.
    """
    x, y, th = pose
    c, s = math.cos(th), math.sin(th)
    lx, ly, lane_heading = lane.lane_pose(phi)
    tangent = (math.cos(lane_heading), math.sin(lane_heading))
    cluster_y = sign * cluster['y']
    wx = x + c * cluster['x'] - s * cluster_y
    wy = y + s * cluster['x'] + c * cluster_y
    along = (wx - lx) * tangent[0] + (wy - ly) * tangent[1]
    if not (-0.05 < along < lookahead):
        return None
    if math.hypot(cluster['x'], cluster_y) > lookahead + 0.5:
        return None
    sign_progress = lane.progress_of(wx, wy, phi)
    px, py, _ = lane.lane_pose(sign_progress)
    nx, ny = lane.lane_normal(sign_progress)
    lateral = (wx - px) * nx + (wy - py) * ny
    return sign_progress, lateral
```

</details>

### Paso 3.2: de qué color

La cámara da bloques de color con su posición; la señal es del color del bloque que está justo encima del clúster. Una foto vieja no vale: el coche ya se movió.

Y debajo, este esqueleto:

```python
def sign_colour(cluster, observations, observations_stamp, scan_stamp, sign):
    """Colour of the observation next to the cluster (mirrored for CW), or None."""
    ...  # TODO 3.2
```

**Qué va dentro:** Si las observaciones tienen más de `COLOUR_AGE` (0,6 s) respecto al escaneo, `None`. Si no, el color de la primera observación a menos de `COLOUR_GATE` (12 cm) del clúster; en horario, cambiado con `SWAP` (en el espejo una roja se pasa como una verde).

**Un ejemplo:** Un clúster en (1,0, 0,1) y una observación roja en (1,05, 0,12): está a 5,4 cm, es roja; en horario devuelve verde.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_3.py -q -k "old_observations or cw_mirrors"
```

Debes ver `2 passed`: que una foto vieja no colorea y el espejo de horario.

<details>
<summary>Ver la solución de sign_colour</summary>

```python
def sign_colour(cluster, observations, observations_stamp, scan_stamp, sign):
    """Colour of the observation next to the cluster (mirrored for CW), or None."""
    if observations_stamp < scan_stamp - COLOUR_AGE:
        return None
    for observation in observations:
        if math.hypot(observation['x'] - cluster['x'], observation['y'] - cluster['y']) < COLOUR_GATE:
            colour = observation.get('color')
            return colour if sign > 0 else SWAP.get(colour, colour)
    return None
```

</details>

### Paso 3.3: la memoria

La cámara ve solo 66,7°: una señal sale de su vista mucho antes de pasarla. Pero las señales no se mueven en toda la ronda y solo hay 24 sitios posibles. Así que se guardan por **asiento**, con sus votos de color, como un casillero.

Y debajo, este esqueleto:

```python
class SeatMemory:
    def __init__(self):
        ...  # TODO 3.3

    def remember(self, clusters, observations, observations_stamp, scan_stamp, pose, phi, sign, lookahead):
        """File the clusters of one scan under their seats and count the colours seen."""
        ...  # TODO 3.3
```

**Qué va dentro:** Para cada clúster: `sign_position`; descártalo si es `None` o si `|lateral| > SECTOR`; el asiento es `round(progreso · 2) / 2`; descártalo si está a más de `SEAT_SNAP` o si `seat % 2 > 1` (eso es una esquina). La clave es `int(round(seat · 2)) % 16`; guarda la fila (`±ROW`), una vista más y, si `sign_colour` da un color, un voto.

**Un ejemplo:** Un clúster en progreso 0,52 y lateral 0,09 va al asiento 0,5 (clave 1), fila +0,1.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_3.py -q -k "memory_files or clusters_off_the_rows"
```

Debes ver `2 passed`: los asientos con votos, y que lo que no está en una fila o un asiento no entra.

<details>
<summary>Ver la solución de __init__, remember</summary>

```python
    def __init__(self):
        self.seats = {}

    def remember(self, clusters, observations, observations_stamp, scan_stamp, pose, phi, sign, lookahead):
        """File the clusters of one scan under their seats and count the colours seen."""
        for cluster in clusters:
            position = sign_position(cluster, pose, phi, sign, lookahead)
            if position is None or abs(position[1]) > SECTOR:
                continue
            seat = round(position[0] * 2.0) / 2.0
            if abs(position[0] - seat) > SEAT_SNAP or seat % 2.0 > 1.0:
                continue                      # between seats, or in a corner: not a sign
            entry = self.seats.setdefault(int(round(seat * 2.0)) % 16, [0.0, {}, 0])
            entry[0] = lane.ROW if position[1] >= 0.0 else -lane.ROW
            entry[2] += 1
            colour = sign_colour(cluster, observations, observations_stamp, scan_stamp, sign)
            if colour is not None:
                entry[1][colour] = entry[1].get(colour, 0) + 1
```

</details>

### Paso 3.4: leer la memoria

El resto de la estrategia pregunta dos cosas: cuál es la próxima señal y qué señales hay en los próximos metros.

Y debajo, este esqueleto:

```python
class SeatMemory:
    # ... (lo de los pasos anteriores)

    def colour(self, key):
        ...  # TODO 3.4

    def next_sign(self, phi, lookahead):
        """Nearest sign ahead (seen twice or more): (lateral m, progress units, colour or None)."""
        ...  # TODO 3.4

    def ahead(self, phi, behind, horizon):
        """Signs from ``behind`` units back to ``horizon`` ahead, by progress (counting laps):
        {progress: (lateral, colour)}."""
        ...  # TODO 3.4
```

**Qué va dentro:** `colour(key)`: el más votado o `None`. `next_sign(phi, lookahead)`: la señal vista al menos `SEAT_HITS` veces más cercana por delante, `(lateral, progreso, color)`; cada asiento se lleva a esta vuelta con `origen + (seat − origen) % 8`, `origen = phi − 0,05`. `ahead(phi, behind, horizon)`: `{progreso: (lateral, color)}` desde `behind` atrás hasta `horizon` delante, con el progreso contando vueltas.

**Un ejemplo:** Con phi = 8,2 (segunda vuelta), una roja guardada en el asiento 0,5 sale en el progreso 8,5.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_3.py -q -k "remembered_a_lap_later"
```

Debes ver `1 passed`: que un color visto en la vuelta 1 vale en la vuelta 2.

<details>
<summary>Ver la solución de colour, next_sign, ahead</summary>

```python
    def colour(self, key):
        votes = self.seats[key][1]
        return max(votes, key=votes.get) if votes else None

    def next_sign(self, phi, lookahead):
        """Nearest sign ahead (seen twice or more): (lateral m, progress units, colour or None)."""
        best = None
        origin = phi - 0.05
        for key, (lateral, votes, hits) in self.seats.items():
            if hits < SEAT_HITS:
                continue
            progress = origin + (key / 2.0 - origin) % lane.UNITS_PER_LAP
            if progress - phi > lookahead:
                continue
            if best is None or progress < best[1]:
                colour = max(votes, key=votes.get) if votes else None
                best = (lateral, progress, colour)
        return best

    def ahead(self, phi, behind, horizon):
        """Signs from ``behind`` units back to ``horizon`` ahead, by progress (counting laps):
        {progress: (lateral, colour)}."""
        out = {}
        origin = phi - behind
        for key, (lateral, votes, hits) in self.seats.items():
            if hits < SEAT_HITS:
                continue
            progress = round(origin + (key / 2.0 - origin) % lane.UNITS_PER_LAP, 2)
            if progress - phi <= horizon:
                out[progress] = (lateral, max(votes, key=votes.get) if votes else None)
        return out
```

</details>

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_3.py -q        # 7 passed
ros2 launch robotek_course obstacle_round.launch.py strategy:=my_obstacle seed:=3 direction:=ccw gui:=true
```

Conduce con `ros2 run robotek_course keyboard_drive` y compara `ros2 topic echo /obstacle/signs` con el campo de Gazebo: misma recta, misma fila, mismo color.

### Prueba esto

- En el widget de las señales, pulsa **Recorrer una vuelta**: con la cámara real (66,7°) algunas señales entran en la memoria grises, sin color, y lo reciben mucho después. Ensancha la cámara a 100° y repite: los colores llegan antes.
- En la repetición, salta de evento en evento: cada uno es una señal que entra en la memoria o que recibe su color.

### Rómpelo

1. Pon `COLOUR_AGE = 5.0`: una foto vieja puede dar color a un clúster que ya no es el mismo. Mira qué pruebas fallan.
2. Quita el espejo (`SWAP`) de `sign_colour`: la prueba del sentido horario falla, porque en el espejo una roja se pasa como una verde.

## Si algo falla

- **Aparecen asientos donde no hay señal.** Revisa el sector y descarta las esquinas.
- **Los colores salen cambiados en CW.** En el campo espejado rojo y verde se intercambian.

## Resumen

- LiDAR para el dónde, cámara para el color, y los asientos del reglamento para unir las dos cosas.
- La memoria dura toda la ronda: lo visto en la vuelta 1 vale en las vueltas 2 y 3.
- Un sector estrecho (0,2 m) evita archivar los topes del aparcamiento.

## Antes de seguir

- [ ] `test_obstacle_step_3.py` da `7 passed`.
- [ ] En la segunda vuelta la memoria ya no cambia de asientos.
