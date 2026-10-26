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

## Escríbelo

> **En este paso**
> - **Escribes:** `signs.py` con `sign_position`, `sign_colour` y la clase `SeatMemory` (`remember`, `colour`, `next_sign`, `ahead`).
> - **Copias hecho:** `drive.py` de este paso.

```bash
git show obstacle-step-3:src/my_obstacle/my_obstacle/drive.py > src/my_obstacle/my_obstacle/drive.py
```

### Paso 3.1: dónde está un clúster

```python
SECTOR = 0.2            # m from the lane centre a cluster may be and still be a sign
SEAT_SNAP = 0.15        # track units between a cluster and the seat it is filed under
SEAT_HITS = 2           # sightings before a seat counts as a sign
COLOUR_GATE = 0.12      # m between an observation and a cluster to give it the colour
COLOUR_AGE = 0.6        # s; older observations colour nothing
SWAP = {'red': 'green', 'green': 'red'}


def sign_position(cluster, pose, phi, sign, lookahead):
    """(progress, lateral) of a cluster on the lane, or None when it is behind the car or too far."""
    ...  # TODO 3.1
```

- **Qué va dentro:** pasa el clúster (sistema del coche real; multiplica su `y` por `sign` para CW) al campo con la pose. Descártalo si, medido a lo largo del carril desde `lane_pose(phi)`, está detrás (menos de −0,05 m) o más allá de `lookahead`, o si está a más de `lookahead + 0,5` m del coche. Su progreso es `progress_of(wx, wy, phi)` y su lateral la proyección sobre `lane_normal` en ese progreso.

### Paso 3.2: de qué color

`sign_colour(cluster, observations, observations_stamp, scan_stamp, sign)` devuelve el color de la observación a menos de `COLOUR_GATE` del clúster (en el sistema del coche, sin espejar), cambiado con `SWAP` en CW; `None` si no hay ninguna o si las observaciones tienen más de `COLOUR_AGE` respecto al escaneo.

### Paso 3.3: la memoria

```python
class SeatMemory:
    """Seats seen so far: half-unit seat index (0..15) -> [lateral, {colour: votes}, sightings]."""

    def __init__(self):
        self.seats = {}

    def remember(self, clusters, observations, observations_stamp, scan_stamp, pose, phi, sign, lookahead):
        """File the clusters of one scan under their seats and count the colours seen."""
        ...  # TODO 3.3
```

- **Qué va dentro:** para cada clúster, `sign_position`; descarta si es `None` o si `|lateral| > SECTOR`; `seat = round(progreso · 2) / 2`; descarta si está a más de `SEAT_SNAP` o si `seat % 2 > 1` (una esquina); la clave es `int(round(seat · 2)) % 16`; fila `±ROW`, una vista más y, si `sign_colour` da un color, un voto.

### Paso 3.4: leer la memoria

- `colour(key)`: el color más votado del asiento o `None`.
- `next_sign(phi, lookahead)`: la señal (vista al menos `SEAT_HITS` veces) más cercana por delante, `(lateral, progreso, color o None)`. Cada asiento se pasa a la vuelta actual con `origen + (seat - origen) % 8`, `origen = phi - 0,05`.
- `ahead(phi, behind, horizon)`: todas las señales desde `behind` unidades atrás hasta `horizon` delante, como `{progreso: (lateral, color)}` (el progreso cuenta vueltas). La usa el plan del paso 4.

<details>
<summary>Ver la solución de remember</summary>

```python
    def remember(self, clusters, observations, observations_stamp, scan_stamp, pose, phi, sign, lookahead):
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

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_3.py -q        # 7 passed
ros2 launch robotek_course obstacle_round.launch.py strategy:=my_obstacle seed:=3 direction:=ccw gui:=true
```

Conduce con `ros2 run robotek_course keyboard_drive` y compara `ros2 topic echo /obstacle/signs` con el campo de Gazebo: misma recta, misma fila, mismo color.

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
