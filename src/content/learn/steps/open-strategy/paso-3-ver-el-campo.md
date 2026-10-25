---
guide: "open-strategy"
order: 3
slug: "paso-3-ver-el-campo"
title: "Ver el campo (LiDAR)"
summary: "Convierte los rayos del LiDAR en distancias útiles."
tag: "step-3"
compareFrom: "step-2"
---

Hasta ahora el coche conduce a ciegas: sabe hacia dónde apunta (el giroscopio), pero no sabe dónde están las paredes. En este paso escribes `perceive`, que convierte un escaneo del LiDAR en cuatro números (la `Scene`) que el resto de la estrategia usará: a qué distancia están las paredes de los lados, la pared de enfrente y dónde termina la isla.

## Lo que vas a ver

El coche calibra el giroscopio, avanza recto y, mientras tanto, publica en `/scene` los cuatro números de cada escaneo. En RViz verás cuatro marcas dibujadas donde el coche las ve. Al llegar a 0,5 m de la pared de enfrente (medidos desde el LiDAR) se detiene y ya no arranca de nuevo. En Gazebo, `left`, `right` y `front_axis` coinciden con los valores ideales a 1,6 cm, 0,7 cm y 1 cm.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-3.json"></div>

*Repetición del mini simulador: activa «LiDAR» para ver el abanico de rayos y «Medidas laterales» para ver los números de la escena.*

## La idea

### Qué entrega el LiDAR

Cada escaneo del LD19 simulado trae 306 distancias en un abanico de ±110°, de 0,12 a 12 m. El ángulo 0 es hacia delante y +90° es la izquierda del coche. Entre un rayo y el siguiente hay 0,72°.

| Hecho | Valor | Qué implica |
|---|---|---|
| Rayos | 306 en ±110° | unos 63 rayos caen a cada lado en una ventana de ±25°; unos 8 hacia delante en ±3° |
| Rayos perdidos | 4,3 % al azar | de media 13 de 306 llegan como `inf`; tu código debe tolerarlo |
| Ruido | 8 mm por rayo | los números se mueven unos milímetros entre escaneos |
| Posición | 0,128 m delante de `base_link` | las distancias de pared se miden desde el LiDAR, no desde el centro del coche |
| Repeticiones | el mismo escaneo llega varias veces con la misma marca de tiempo | percibe una sola vez por marca |

La última fila no cambia los números (el mismo escaneo da lo mismo), pero evita gastar CPU y publicar copias.

### Cuatro números

| Número | Qué es | Cómo se calcula |
|---|---|---|
| `left` | distancia a la pared de la izquierda | mediana de los rayos alrededor de +90° |
| `right` | distancia a la pared de la derecha | mediana de los rayos alrededor de -90° |
| `front_axis` | pared de enfrente, a lo largo de la pista | rayos hacia donde debería ir el coche, proyectados |
| `island_end` | dónde termina la isla (m, en el eje x del coche) | recta ajustada a la pared de la isla; último rayo sobre ella |

Un número que no se ve vale `inf`. Todo el código que los use (pasos 4 a 7) debe tratar `inf` como «no hay pared».

### Mediana, no promedio

Con un rayo que se cuela por una abertura y da 9 m, el promedio se arruina y la mediana lo ignora. Midiendo desde (0, -0,75) con un rayo salvaje justo en el lado izquierdo, la pared está a 0,25 m: la mediana da 0,255 m y el promedio, 0,396 m. Eso lo calculé con el `perceive` de referencia; la prueba `test_a_median_ignores_a_beam_that_goes_through_a_gap` hace lo mismo.

### A lo largo de la pista

Tras una esquina el coche sigue un poco torcido. Una pared vista en diagonal parece más lejos, así que `front_axis` no mide hacia donde apunta el coche, sino hacia donde va la pista (`forward_yaw`, visto desde el coche). Cada rayo se proyecta con `range * cos(ángulo respecto a la pista)`.

Con el coche torcido 0,3 rad (17°) en el mismo punto, la referencia da 1,378 m midiendo a lo largo de la pista y 1,442 m si mides hacia donde apunta el coche. El valor correcto es `1,5 - 0,128 * cos(0,3) = 1,378`. En este paso `forward_yaw` vale 0 (el coche va recto); desde el paso 4 lo calcula el nodo a partir del giroscopio.

### El final de la isla

`island_end` es el número difícil. La pared de la isla junto al coche es una recta, y el final es un salto de distancia. El método:

1. Con `bearing = sign * angles` (positivo hacia el lado de la isla), toma los rayos válidos a ±20° de +90° y descarta los más lejanos que 1,5 veces su mediana (ya pasaron el final de la pared). Con menos de 10 rayos, devuelve `inf`.
2. Pasa cada rayo a puntos `x = r cos(bearing)`, `y = r sin(bearing)` y ajusta `y = pendiente * x + desfase` con `np.polyfit`. El coche casi nunca va paralelo a la pared: con 0,07 rad de inclinación, una distancia fija se equivocaría 5 cm a 0,7 m. Si la pendiente es demasiado grande o el desfase queda fuera de 0,15 a 0,90 m, eso no es una pared de isla a un lado: `inf`.
3. `on_wall` son los rayos válidos a menos de 3 cm de la recta.
4. Recorre los rayos desde el lado hacia el frente (de +90° a +20°) y recuerda el último que está sobre la pared. Se detiene cuando hay **más de 2** rayos seguidos fuera de ella: los rayos perdidos por azar no deben terminar la pared.
5. Si no hay ninguno, o el último está a menos de 0,05 rad del límite de +20° (la pared sigue hasta el borde de la vista), devuelve `inf`. Si no, `x[último] + LIDAR_X`: el LiDAR está 0,128 m delante del centro del coche.

Con la isla de 1 × 1 m y el coche en (0, -0,75), la pared termina en x = 0,5 y el número sale 0,48 con ruido y pérdidas, y 0,495 sin ellos. Cuando el coche pasa de x ≈ 0,4 m, `left` salta de 0,26 a 2,25 m (ahora ve la pared exterior del otro lado) e `island_end` vuelve a `inf`.

### El nodo

En `drive.py` solo cambian tres cosas. `on_scan` ignora una marca de tiempo ya usada, llama a `perceive` y publica los números en `/scene` (un `Float32MultiArray` con `left, right, front_axis, island_end`) y en `/scene_markers` (un `MarkerArray` que dibuja `robotek_course.viz.scene_markers`; ya te lo dan). Y `control` se detiene cuando `front_axis` baja de `STOP_FRONT`, con enclavamiento: un rayo con ruido no puede reiniciar el motor.

## Explora el escaneo

Este widget corre el mismo `perceive` (portado a JavaScript, da los mismos números que la versión de Python) sobre un escaneo simulado del campo.

<div data-widget="scan-explorer"></div>

Los controles son: el sentido de la vuelta, los deslizadores de posición (x, y) y de rumbo del coche, **Perder rayos** (0 a 15 %), **Ruido de la distancia** (0 a 30 mm), tres posiciones prediseñadas (**Recta**, **Antes de la esquina**, **En la esquina**), **Otro ruido**, y los interruptores **Mostrar el ajuste** y **Mostrar los rayos**. También puedes arrastrar el coche con el ratón o usar las flechas (Q y E lo giran).

Algo concreto para probar: pulsa **Antes de la esquina** y mira `island_end`: debe quedar cerca de 0,5 m. Sube **Perder rayos** a 15 % y **Ruido** a 30 mm y pulsa **Otro ruido** varias veces. En 100 escaneos con esos valores en el mini simulador de Python, `left` se mantuvo entre 0,245 y 0,268 m y `front_axis` entre 1,34 y 1,41 m (lo ideal es 0,25 y 1,37), pero `island_end` fue de 0,13 a 0,52 m (lo cierto es 0,50). El final de la isla es el número frágil: por eso en el paso 6 la puerta de giro exige verlo cerca en dos escaneos distintos seguidos.

## Escríbelo

1. **Crea `src/my_open/my_open/perception.py`** con `perceive`, `median_range`, `front_axis`, `island_end` y la ayuda `_near`. `perceive` y `_near` te los doy completos abajo; los tres ejercicios son los otros.
2. **Edita `drive.py`** (el del paso 2): importa `LaserScan`, `Float32MultiArray`, `MarkerArray`, `Scene`, `scene_markers` y `perceive`; crea `self.scene`, `self.stamp` y los dos publicadores; suscríbete a `/scan` con `on_scan`; y en `control` añade el enclavamiento de `STOP_FRONT`.

**Pistas para `median_range`.** `_near(angles, ok, centre, SIDE_HALF)` te dice qué rayos son válidos y están cerca del ángulo `centre`. Devuelve la mediana de `ranges[chosen]`, o `math.inf` si no hay ninguno.

**Pistas para `front_axis`.**

1. Elige los rayos con `_near(angles, ok, forward_yaw, AXIS_HALF)`.
2. Proyecta cada rango: `ranges[chosen] * np.cos(angles[chosen] - forward_yaw)`.
3. Devuelve la mediana de las proyecciones, o `inf` si no hay rayos.

**Pistas para `island_end`.** Sigue los cinco pasos de arriba, de uno en uno. Usa `np.errstate(invalid='ignore')` al calcular `x`, `y` y `on_wall`, porque los rayos perdidos son `inf`. Recorre los rayos con `np.argsort(-bearing)` y salta los que no estén entre `END_FROM` y 90°.

Antes de mirar la referencia, corre las pruebas.

<details>
<summary>Ver la referencia de perception.py: constantes, perceive, median_range y front_axis</summary>

```python
import math

import numpy as np

from robotek_course.minisim import LIDAR_X, Scene

SIDE_HALF = 0.44                  # rad around +-90 deg for the side walls
AXIS_HALF = math.radians(3.0)     # rad around the track axis for the wall ahead
FIT_HALF = math.radians(20.0)     # the island wall is fitted to the beams within this of the side bearing
END_FROM = math.radians(20.0)     # the island wall is followed from 90 deg down to this bearing
WALL_TOLERANCE = 0.03             # m: a beam is on the wall within this of the fitted line
MAX_GAP_BEAMS = 2                 # lost beams that do not end the wall
MAX_SLOPE = math.tan(0.30)        # a line steeper than this (rad) is not a wall beside the car
LATERAL_RANGE = (0.15, 0.90)      # m: plausible distance from the car to the island wall


def perceive(scan, forward_yaw=0.0, sign=1):
    """One scan -> Scene.

    ``forward_yaw``: the track direction seen from the car (rad), so the wall ahead is measured along the track, not
    along where the car happens to point. ``sign``: +1 when the island is on the left, -1 when it is on the right.
    """
    ranges = np.asarray(scan.ranges, dtype=float)
    angles = scan.angle_min + np.arange(ranges.size) * scan.angle_increment
    ok = np.isfinite(ranges) & (ranges >= scan.range_min) & (ranges <= scan.range_max)
    return Scene(left=median_range(angles, ranges, ok, math.pi / 2),
                 right=median_range(angles, ranges, ok, -math.pi / 2),
                 front_axis=front_axis(angles, ranges, ok, forward_yaw),
                 island_end=island_end(angles, ranges, ok, sign))


def _near(angles, ok, centre, half):
    """Which beams are valid and within ``half`` radians of the bearing ``centre``."""
    relative = np.arctan2(np.sin(angles - centre), np.cos(angles - centre))
    return ok & (np.abs(relative) <= half)


def median_range(angles, ranges, ok, centre):
    """Distance to the wall at the bearing ``centre``: the MEDIAN of the beams around it (inf when there are none)."""
    chosen = _near(angles, ok, centre, SIDE_HALF)
    return float(np.median(ranges[chosen])) if chosen.any() else math.inf


def front_axis(angles, ranges, ok, forward_yaw):
    """Distance to the wall ahead measured ALONG the track: each beam's range times cos(its angle off the track)."""
    chosen = _near(angles, ok, forward_yaw, AXIS_HALF)
    if not chosen.any():
        return math.inf
    return float(np.median(ranges[chosen] * np.cos(angles[chosen] - forward_yaw)))
```

</details>

<details>
<summary>Ver la referencia de island_end</summary>

```python
def island_end(angles, ranges, ok, sign):
    """x (m, in the car's frame) where the island wall beside the car ends, or inf when it does not end in view.

    Fit a straight line to the wall beside the car, follow it towards the front, and stop at the last beam on the
    line before the range jumps (a run of more than MAX_GAP_BEAMS beams off the line).
    """
    bearing = sign * angles                                  # positive towards the island side
    side = ok & (np.abs(bearing - math.pi / 2) <= FIT_HALF)
    if side.any():
        side &= ranges <= 1.5 * np.median(ranges[side])      # not the beams that already passed the wall's end
    if side.sum() < 10:
        return math.inf
    with np.errstate(invalid='ignore'):                      # lost beams are inf
        x, y = ranges * np.cos(bearing), ranges * np.sin(bearing)
    slope, offset = np.polyfit(x[side], y[side], 1)          # y = slope * x + offset
    if abs(slope) > MAX_SLOPE or not LATERAL_RANGE[0] < offset < LATERAL_RANGE[1]:
        return math.inf                                      # that is not an island wall beside the car
    with np.errstate(invalid='ignore'):
        on_wall = ok & (np.abs(y - (slope * x + offset)) <= WALL_TOLERANCE)
    last, missing = None, 0
    for i in np.argsort(-bearing):                           # from the side beams towards the front
        if not (END_FROM <= bearing[i] <= math.pi / 2):
            continue
        if on_wall[i]:
            last, missing = i, 0
        else:
            missing += 1
            if missing > MAX_GAP_BEAMS and last is not None:
                break
    if last is None or bearing[last] <= END_FROM + 0.05:
        return math.inf                                      # still on the wall at the limit of the view
    return float(x[last]) + LIDAR_X
```

</details>

<details>
<summary>Ver la referencia de los cambios en drive.py</summary>

Imports nuevos:

```python
from sensor_msgs.msg import Imu, LaserScan
from std_msgs.msg import Bool, Float32MultiArray
from visualization_msgs.msg import MarkerArray

from robotek_course.minisim import Scene
from robotek_course.viz import scene_markers

from .perception import perceive

STOP_FRONT = 0.5          # m: stop when the wall ahead is this near
```

En `__init__`, además de lo del paso 2:

```python
self.stopped = False                 # latched: a noisy reading must not restart the car
self.scene = Scene()                 # the latest Scene (nothing seen yet)
self.stamp = None                    # time stamp of the last scan we used
self.scene_pub = self.create_publisher(Float32MultiArray, '/scene', 10)      # left, right, front_axis, island_end
self.markers_pub = self.create_publisher(MarkerArray, '/scene_markers', 10)  # the same, to see it in RViz
self.create_subscription(LaserScan, '/scan', self.on_scan, qos_profile_sensor_data)
```

El método nuevo:

```python
def on_scan(self, msg):
    stamp = (msg.header.stamp.sec, msg.header.stamp.nanosec)
    if stamp == self.stamp:
        return                           # the same scan can arrive more than once: use each time stamp once
    self.stamp = stamp
    self.scene = perceive(msg, forward_yaw=0.0, sign=1)
    numbers = [self.scene.left, self.scene.right, self.scene.front_axis, self.scene.island_end]
    self.scene_pub.publish(Float32MultiArray(data=[float(n) for n in numbers]))
    self.markers_pub.publish(scene_markers(self.scene, msg.header.stamp, msg.header.frame_id))
```

Y en `control`, la última parte del paso 2 se envuelve en el enclavamiento:

```python
yaw = self.heading.update(self.gyro, dt)
self.stopped = self.stopped or self.scene.front_axis < STOP_FRONT
if not self.stopped:
    speed, steer = SPEED, heading_steer(0.0, yaw)
```

</details>

## Pruébalo

Pruebas sin ROS ni Gazebo:

```bash
python3 -m pytest course/tests/test_step_3.py -q
```

Son 9 pruebas: las distancias a los dos lados (0,25 y 0,75 m), la pared de enfrente, la pared de enfrente medida a lo largo de la pista con el coche torcido, el final de la isla en tres posiciones, que no haya final cuando no está a la vista o ya quedó atrás, que la vuelta horaria sea la imagen en espejo, que el ruido y los rayos perdidos muevan poco los números, que un escaneo vacío dé `inf` y que la mediana ignore un rayo salvaje.

Para ver los números sin Gazebo, desde la raíz del repositorio:

```bash
PYTHONPATH=src/my_open:src/robotek_course python3 -c "
from robotek_course.minisim import Field
from my_open.perception import perceive
for x in (-0.3, 0.0, 0.2, 0.8):
    s = perceive(Field().scan(x, -0.75, 0.0))
    print(f'x={x:+.1f} left={s.left:.2f} right={s.right:.2f} front={s.front_axis:.2f} island_end={s.island_end:.2f}')
"
```

La referencia imprime esto (el coche va al este por el pasillo sur; la verdad es `island_end = 0,5 - x`):

```text
x=-0.3 left=0.25 right=0.77 front=1.67 island_end=inf
x=+0.0 left=0.25 right=0.77 front=1.37 island_end=0.48
x=+0.2 left=0.25 right=0.77 front=1.17 island_end=0.30
x=+0.8 left=2.26 right=0.77 front=0.57 island_end=inf
```

Mira dos cosas. `right` da 0,77 y no 0,75: la mediana de rayos oblicuos, que son más largos, se pasa un 2 %; es normal. Y `island_end` es `inf` en los dos extremos: a x = -0,3 todavía está demasiado lejos y a x = 0,8 ya quedó atrás.

Ahora en Gazebo, sin ventana:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash
python3 course/verify_step.py 3
```

El comprobador lanza el simulador y tu nodo, publica Start, compara cada mensaje de `/scene` con el valor que daría el mismo `perceive` sobre un escaneo ideal (sin ruido ni rayos perdidos) tomado desde la pose real del coche, y comprueba que el coche se detiene ante la pared sin tocar nada. Debe terminar con `PASS`. La solución de referencia midió, en el campo normal:

| Número | Peor diferencia con el valor ideal | Límite del comprobador |
|---|---:|---:|
| `left` | 1,6 cm | 5 cm |
| `right` | 0,7 cm | 5 cm |
| `front_axis` | 1 cm | 5 cm |

`island_end` se compara solo cuando se ve a la vez en el nodo y en la geometría, con límite de 10 cm. No tengo una cifra medida de su error en Gazebo.

Para verlo con ventana y con las marcas de RViz:

```bash
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true rviz:=true
```

En RViz, añade un display `MarkerArray` en `/scene_markers` y pon el marco fijo en `lidar_link`. Verás líneas verdes a los lados (`left` y `right`), una línea roja delante (`front_axis`) y un punto amarillo donde termina la isla. También puedes leer los números: `ros2 topic echo /scene`. El árbitro puntuará la ronda; ignora esos puntos, en este paso el coche solo avanza hasta la pared y se para.

### Rómpelo

Cambia `np.median` por `np.mean` en `median_range` y corre las pruebas. En mi comprobación solo falla `test_a_median_ignores_a_beam_that_goes_through_a_gap`: con ruido y rayos perdidos normales el promedio y la mediana se parecen, y solo un rayo salvaje los separa.

Otra: en `front_axis`, usa `0.0` en lugar de `forward_yaw` y corre `test_the_wall_ahead_is_measured_along_the_track_when_the_car_is_crooked`. Falla: con el coche torcido 0,3 rad la diferencia es de unos 6 cm.

## Si algo falla

- **`left` o `right` dan siempre `inf`.** Revisa que `_near` reciba `SIDE_HALF` (0,44 rad) y que compares ángulos con `arctan2(sin, cos)` y no con una resta: cerca de ±180° una resta se equivoca.
- **`front_axis` es 0,128 m más corto de lo que esperas.** Es normal: se mide desde el LiDAR, no desde el centro del coche. `island_end` sí suma `LIDAR_X` para dar x en el sistema del coche.
- **Al correr las pruebas salen avisos de `invalid value`.** Falta `np.errstate(invalid='ignore')`: los rayos perdidos son `inf` y `inf * cos(...)` produce `nan`.
- **`island_end` da siempre `inf`.** Imprime `side.sum()` y la pendiente y el desfase del ajuste. El desfase debe estar entre 0,15 y 0,90 m; si no, lo estás rechazando por error.
- **`island_end` aparece y desaparece entre escaneos.** Con ruido y rayos perdidos es normal: es el número más frágil. Si ocurre también sin ruido ni pérdidas, mira que `missing` se reinicie a 0 cada vez que un rayo cae sobre la pared.
- **Pasan las pruebas pero `/scene` no sale en Gazebo.** Las pruebas no usan ROS. Revisa que `/scan` use `qos_profile_sensor_data` y que el nodo se llame `strategy`.
- **El coche no para ante la pared.** Revisa que `stopped` se quede en `True` y que uses `front_axis`, no `left`.

## Compara

```bash
bash tools/compare-step.sh 2 3     # qué añade la referencia
bash tools/compare-step.sh 3       # tu árbol contra el paso 3
```
