---
guide: "open-strategy"
order: 3
slug: "paso-3-ver-el-campo"
title: "Ver el campo (LiDAR)"
summary: "Convierte los rayos del LiDAR en distancias útiles."
tag: "step-3"
compareFrom: "step-2"
---

Hasta ahora el coche conduce a ciegas: sabe hacia dónde apunta (el giroscopio), pero no sabe dónde están las paredes. El **LiDAR** es un sensor láser que gira y mide la distancia al primer obstáculo en cada dirección; una vuelta de rayos es un **escaneo**. En este paso escribes `perceive`, que convierte un escaneo en cuatro números (la `Scene`) que usará el resto de la estrategia: a qué distancia están las paredes de los lados, la pared de enfrente y dónde termina la isla.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/EYbhNSUnIdU" title="How Does LiDAR Remote Sensing Work? Light Detection and Ranging" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>How Does LiDAR Remote Sensing Work? Light Detection and Ranging</strong> · NEON Science (inglés). El tiempo de vuelo de la luz, breve y claro.</figcaption>
</figure>
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/eJZXRncGaGM" title="How do we add LIDAR to a ROS robot?" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>How do we add LIDAR to a ROS robot?</strong> · Articulated Robotics (inglés, 23 min). El mensaje LaserScan de ROS y el LiDAR real frente al de Gazebo.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

El coche espera Start, se queda quieto 0,6 s calibrando el giroscopio y avanza recto a 0,42 m/s (el comando 0,6). Mientras tanto publica en `/scene` los cuatro números de cada escaneo; los lees con `ros2 topic echo /scene`.

- **Al salir**, en el centro del pasillo sur, deben ser más o menos `left` 0,51 m, `right` 0,51 m, `front_axis` 1,37 m e `island_end` 0,49 m. Son los valores del mini simulador, que corre el mismo código; Gazebo da los mismos con unos centímetros de diferencia.
- **Al llegar a la esquina de la isla**, `island_end` baja hacia 0,2 m y enseguida `left` salta de 0,5 a unos 2,5 m: ya no hay isla al lado.
- **Cerca de la pared de enfrente**, cuando `front_axis` baja de 0,5 m (medido desde el LiDAR), el coche manda parar y no vuelve a arrancar. En Gazebo todavía rueda unos 0,36 m y queda a unos 0,14 m de la pared (el mini simulador de la repetición frena casi en seco).

<div data-widget="step-replay" data-src="/learn/assets/replays/step-3.json"></div>

*Repetición del mini simulador: activa «LiDAR» para ver el abanico de rayos y «Medidas laterales» para ver los números de la escena.*

## La idea

### Qué entrega el LiDAR

Cada escaneo del LD19 simulado trae 306 distancias en un abanico de ±110°, de 0,12 a 12 m. El ángulo 0 es hacia delante y +90° es la izquierda del coche. Entre un rayo y el siguiente hay 0,72°.

| Hecho | Valor | Qué implica |
|---|---|---|
| Rayos | 306 en ±110° | unos 63 rayos caen a cada lado en una ventana de ±25°; unos 8 hacia delante en ±3° |
| Rayos perdidos | 4,3 % al azar | de media 13 de 306 llegan como `inf` (infinito: «no volvió nada»); tu código debe tolerarlo |
| Ruido | 8 mm por rayo | los números se mueven unos milímetros entre escaneos |
| Posición | 0,128 m delante de `base_link` | las distancias de pared se miden desde el LiDAR, no desde el centro del coche |
| Repeticiones | el mismo escaneo llega varias veces con la misma marca de tiempo | percibe una sola vez por marca: así no gastas CPU ni publicas copias |

### Cuatro números

`perceive` devuelve una `Scene` (la clase ya está en `robotek_course.minisim`) con cuatro números, todos en metros:

| Número | Qué es | Cómo se calcula |
|---|---|---|
| `left` | distancia a la pared de la izquierda | mediana de los rayos alrededor de +90° |
| `right` | distancia a la pared de la derecha | mediana de los rayos alrededor de -90° |
| `front_axis` | pared de enfrente, a lo largo de la pista | rayos hacia donde debería ir el coche, proyectados |
| `island_end` | dónde termina la isla (m, en el eje x del coche) | recta ajustada a la pared de la isla; último rayo sobre ella |

Un número que no se ve vale `inf`. Todo el código que los use (pasos 4 a 7) debe tratar `inf` como «no hay pared».

### Mediana, no promedio

La mediana es el valor del medio cuando ordenas los rayos; el promedio los suma todos. Los 63 rayos del lado izquierdo miden casi lo mismo, pero a veces uno se cuela por una abertura y vuelve con 9 m. El promedio se arrastra hacia ese rayo y la mediana no se entera.

Midiendo desde (0, -0,75) con un rayo salvaje justo en el lado izquierdo, la pared está a 0,25 m: la mediana da 0,255 m y el promedio 0,396 m, 14 cm de error por un solo rayo entre 63. Eso lo calculé con el `perceive` de referencia; la prueba `test_a_median_ignores_a_beam_that_goes_through_a_gap` hace lo mismo. Con el ruido y las pérdidas normales, promedio y mediana se parecen: solo un rayo salvaje los separa. Lo verás en el widget de abajo (botón «Un rayo salvaje»).

### A lo largo de la pista

Tras una esquina el coche sigue un poco torcido, y una pared vista en diagonal parece más lejos. Por eso `front_axis` no mide hacia donde apunta el coche, sino hacia donde va la pista. `forward_yaw` es esa dirección vista desde el coche: si el coche está girado 17° a la izquierda de la pista, `forward_yaw` vale -17°. Cada rayo cercano a esa dirección se proyecta con `range * cos(ángulo respecto a la pista)`.

Con el coche torcido 0,3 rad (17°) en (0, -0,75), la referencia da 1,378 m midiendo a lo largo de la pista y 1,442 m si mides hacia donde apunta el coche. El valor correcto es `1,5 - 0,128 * cos(0,3) = 1,378`: la pared está a 1,5 m y el LiDAR ya recorrió `0,128 * cos(0,3)` de esa distancia. En este paso `forward_yaw` vale 0 (el coche va recto); desde el paso 4 lo calcula el nodo a partir del giroscopio. En el widget, botón «Coche torcido 17°».

### El final de la isla

`island_end` es el número difícil. La pared de la isla junto al coche es una recta, y su final es donde los rayos dejan de caer sobre ella. La idea: ajusta una recta a la pared que tienes al lado, recórrela hacia delante y quédate con el último rayo que sigue sobre ella. El método, en cinco pasos:

1. Con `bearing = sign * angles` (positivo hacia el lado de la isla; `sign` es +1 con la isla a la izquierda), toma los rayos válidos a ±20° de +90° y descarta los más lejanos que 1,5 veces su mediana (ya pasaron el final de la pared). Con menos de 10 rayos, devuelve `inf`.
2. Pasa cada rayo a un punto, `x = r cos(bearing)` e `y = r sin(bearing)`, y ajusta `y = pendiente * x + desfase` con `np.polyfit`. Una recta y no una distancia fija porque el coche casi nunca va paralelo a la pared: con 0,07 rad de inclinación, una distancia fija se equivocaría 5 cm a 0,7 m. Si la pendiente es demasiado grande (más de 0,30 rad) o el desfase queda fuera de 0,15 a 0,90 m, eso no es una pared de isla a un lado: `inf`.
3. `on_wall` son los rayos válidos a menos de 3 cm de la recta.
4. Recorre los rayos desde el lado hacia el frente (de +90° a +20°) y recuerda el último que está sobre la pared. Se detiene cuando hay **más de 2** rayos seguidos fuera de ella: los rayos perdidos por azar no deben terminar la pared.
5. Si no hay ninguno, o el último está a menos de 0,05 rad del límite de +20° (la pared sigue hasta el borde de la vista), devuelve `inf`. Si no, `x[último] + LIDAR_X`: el LiDAR está 0,128 m delante del centro del coche y `island_end` se da en el sistema del coche.

Con la isla de 1 × 1 m y el coche en (0, -0,75), la pared termina en x = 0,5 y el número sale 0,48 con ruido y pérdidas, y 0,495 sin ellos. Cuando el coche pasa de x ≈ 0,37 m, `left` salta de 0,27 a 2,25 m (ahora ve la pared exterior del otro lado) e `island_end` vuelve a `inf`.

### El nodo

En `drive.py` cambian tres cosas. `on_scan` ignora una marca de tiempo ya usada, llama a `perceive` y publica los números en `/scene` (un `Float32MultiArray` con `left, right, front_axis, island_end`) y en `/scene_markers` (un `MarkerArray` que dibuja `robotek_course.viz.scene_markers`; ya te lo dan). Y `control` se detiene cuando `front_axis` baja de `STOP_FRONT`, con enclavamiento: un rayo con ruido no puede reiniciar el motor. La referencia también quita el parámetro `calibrate` del paso 2 (ya cumplió su función); tú puedes conservarlo.

## Explora el escaneo

Este widget corre el mismo `perceive` (portado a JavaScript, da los mismos números que la versión de Python) sobre un escaneo simulado del campo. Los cuatro números aparecen escritos en la isla y, en la lista, cada uno con su valor «sin ruido» al lado.

<div data-widget="scan-explorer"></div>

Prueba, en este orden:

1. **Antes de la esquina**: `island_end` debe quedar cerca de 0,5 m.
2. Pulsa **Repetir 20 veces** y mira la tira de abajo. Con el ruido normal, `left` y `front_axis` son una línea casi plana y `island_end` también, salvo algún escaneo suelto: en 500 escaneos del mini simulador de Python, 2 se equivocaron más de 10 cm (uno dio 0,22 m en vez de 0,5).
3. **Perder 15 % de rayos**: ahora `island_end` falla más: 70 de 500 escaneos (14 %), porque a veces caen tres rayos perdidos seguidos sobre la pared y el recorrido cree que terminó.
4. **Ruido de 30 mm**: el ajuste admite 3 cm de distancia a la recta (`WALL_TOLERANCE`); con ese ruido muchos rayos se salen de la pared sin que la pared cambie, y `island_end` sale casi siempre muy por debajo de 0,5 m (386 de 500 escaneos con más de 10 cm de error; con 15 mm fueron 11 y con 20 mm, 107). Aun así `left` queda entre 0,24 y 0,27 m y `front_axis` entre 1,34 y 1,42 m (lo ideal es 0,25 y 1,37).
5. **Un rayo salvaje** y **Coche torcido 17°**: la mediana contra el promedio, y `front_axis` con y sin `forward_yaw`.

Por eso `island_end` es el número frágil, y por eso en el paso 6 la puerta de giro no se fía de un solo escaneo: exige ver el final cerca en dos escaneos distintos seguidos. El LD19 simulado mide con 8 mm de ruido, muy por debajo de esos 3 cm, y falla pocas veces; pero una sola lectura mala bastaría para girar antes de tiempo.

> **Antes de escribirlo, juega un rato.** Conduce con el abanico del LiDAR encendido (tecla **L**) y fíjate solo en los números de izquierda, derecha y frente. Eso es todo lo que sabrá el código. ¿Podrías conducir mirando solo esos tres números?
>
> [Abrir el simulador con el reto de este paso](/learn/open-strategy/simulador/?paso=3)

## Escríbelo

> **En este paso**
> Escribes: `perception.py` (un archivo, 5 funciones pequeñas), con una prueba después de cada pasito.
> Copias hecho: `drive.py`, el nodo que habla con ROS; no hace falta entenderlo todavía.

Todos los comandos se corren desde la raíz del repositorio. Copia el nodo de la referencia del paso 3 (necesitas el `git fetch --tags` del paso 0) y dile a Python dónde están los paquetes, para los `python -c`:

```bash
git show step-3:src/my_open/my_open/drive.py > src/my_open/my_open/drive.py
export PYTHONPATH=src/my_open:src/robotek_course      # una vez por terminal
```

### Paso 3.1: del escaneo a la escena

`perceive` recibe un escaneo y devuelve la `Scene`. Hoy solo prepara los datos y llama a tres ayudantes que escribirás después.

Crea `src/my_open/my_open/perception.py` y pega esto (imports y marcadores, ya hechos):

```python
"""Step 3 - Perception: from one LiDAR scan to the four numbers of a Scene."""
import math

import numpy as np

from robotek_course.minisim import LIDAR_X, Scene


def median_range(angles, ranges, ok, centre): return math.inf  # marcador
def front_axis(angles, ranges, ok, forward_yaw): return math.inf  # marcador
def island_end(angles, ranges, ok, sign): return math.inf  # marcador
```

Y debajo, este esqueleto:

```python
def perceive(scan, forward_yaw=0.0, sign=1):
    """One scan -> Scene."""
    ranges = ...   # la distancia de cada rayo
    angles = ...   # el ángulo de cada rayo
    ok = ...       # verdadero en los rayos con una distancia válida
    return Scene(left=..., right=..., front_axis=..., island_end=...)
```

**Qué va dentro:** `ranges` es `scan.ranges` como array de NumPy (`np.asarray`, decimales). El ángulo del rayo `i` es `scan.angle_min + i * scan.angle_increment`. Un rayo es válido si es finito y está entre `scan.range_min` y `scan.range_max`. `left` y `right` llaman a `median_range` con `math.pi / 2` y `-math.pi / 2`; los otros dos reciben `forward_yaw` y `sign`.

```bash
python -m pytest course/tests/test_step_3.py -q -k an_empty_scan
```

Debes ver `1 passed`. Todo vale `inf` todavía: solo comprobamos que `perceive` corre sin romperse.

<details>
<summary>Ver la solución de este paso</summary>

```python
def perceive(scan, forward_yaw=0.0, sign=1):
    """One scan -> Scene.

    ``forward_yaw``: the track direction seen from the car (rad), so the wall ahead is measured along the track, not
    along where the car happens to point. ``sign``: +1 when the island is on the left, -1 on the right.
    """
    ranges = np.asarray(scan.ranges, dtype=float)
    angles = scan.angle_min + np.arange(ranges.size) * scan.angle_increment
    ok = np.isfinite(ranges) & (ranges >= scan.range_min) & (ranges <= scan.range_max)
    return Scene(left=median_range(angles, ranges, ok, math.pi / 2),
                 right=median_range(angles, ranges, ok, -math.pi / 2),
                 front_axis=front_axis(angles, ranges, ok, forward_yaw),
                 island_end=island_end(angles, ranges, ok, sign))
```

</details>

### Paso 3.2: la distancia a una pared del lado

Para `left` y `right`: toma los rayos que apuntan a ese lado y quédate con el valor del medio (la mediana). Si un rayo se cuela por un hueco y mide 9 m, el valor del medio ni se entera. Los ángulos van en radianes (rad): 3,14 rad son 180°. Reemplaza el marcador `median_range` por:

```python
SIDE_HALF = 0.44    # rad (unos 25°): cuánto te abres a cada lado

def _near(angles, ok, centre, half):
    ...     # rayos válidos a `half` rad o menos de `centre`

def median_range(angles, ranges, ok, centre):
    ...     # la mediana de los rayos cercanos a `centre`
```

**Qué va dentro:** en `_near`, resta `centre` a cada ángulo con `np.arctan2(np.sin(...), np.cos(...))` (así la resta no se rompe cerca de 180°) y devuelve `ok` junto con que el valor absoluto de esa diferencia sea menor o igual que `half`. En `median_range`, guarda en `chosen` los rayos de `_near(..., SIDE_HALF)`; si hay alguno, devuelve la mediana de `ranges[chosen]` como `float`, y si no, `math.inf`.

```bash
python -m pytest course/tests/test_step_3.py -q -k "distances_to_the_walls or a_median"
```

Debes ver `2 passed`: `left` da 0,25 m, `right` 0,75 m, y la mediana ignora un rayo salvaje de 9 m.

<details>
<summary>Ver la solución de este paso</summary>

```python
SIDE_HALF = 0.44                  # rad around +-90 deg for the side walls


def _near(angles, ok, centre, half):
    """Which beams are valid and within ``half`` radians of the bearing ``centre``."""
    relative = np.arctan2(np.sin(angles - centre), np.cos(angles - centre))
    return ok & (np.abs(relative) <= half)


def median_range(angles, ranges, ok, centre):
    """Distance to the wall at the bearing ``centre``: the MEDIAN of the beams around it (inf when there are none)."""
    chosen = _near(angles, ok, centre, SIDE_HALF)
    return float(np.median(ranges[chosen])) if chosen.any() else math.inf
```

</details>

### Paso 3.3: la pared de enfrente, a lo largo de la pista

Para `front_axis`: toma solo los rayos que apuntan hacia donde va la pista y corrige cada distancia con el coseno de su ángulo, así una pared vista en diagonal no parece más lejos. `forward_yaw` es la dirección de la pista vista desde el coche (aquí vale 0). Reemplaza el marcador `front_axis` por:

```python
AXIS_HALF = math.radians(3.0)     # rad: solo los rayos a 3° o menos de la pista


def front_axis(angles, ranges, ok, forward_yaw):
    """Distance to the wall ahead measured ALONG the track: each beam's range times cos(its angle off the track)."""
    ...
```

**Qué va dentro:** elige los rayos con `_near` alrededor de `forward_yaw` y `AXIS_HALF`. Si no hay ninguno, `math.inf`. Si hay, multiplica cada distancia por el coseno de (su ángulo menos `forward_yaw`) y devuelve la mediana.

```bash
python -m pytest course/tests/test_step_3.py -q -k wall_ahead
```

Debes ver `2 passed`: la pared de enfrente a 1,372 m, y la misma con el coche torcido 17°.

<details>
<summary>Ver la solución de este paso</summary>

```python
AXIS_HALF = math.radians(3.0)     # rad around the track axis for the wall ahead


def front_axis(angles, ranges, ok, forward_yaw):
    """Distance to the wall ahead measured ALONG the track: each beam's range times cos(its angle off the track)."""
    chosen = _near(angles, ok, forward_yaw, AXIS_HALF)
    if not chosen.any():
        return math.inf
    return float(np.median(ranges[chosen] * np.cos(angles[chosen] - forward_yaw)))
```

</details>

### Paso 3.4: los rayos de la pared de la isla

`island_end` es la parte difícil: dónde termina la pared de la isla. La haremos en cinco pasitos (3.4 a 3.8); hasta el último devuelve un número provisional, para poder comprobar cada uno. Primero, qué rayos caen en la pared que tienes al lado. Reemplaza el marcador `island_end` por:

```python
FIT_HALF = math.radians(20.0)     # solo los rayos a 20° o menos del lado


def island_end(angles, ranges, ok, sign):
    """x (m) where the island wall beside the car ends."""
    bearing = ...
    side = ...
    ...
    return float(side.sum())  # provisional
```

**Qué va dentro:** `bearing` es `sign * angles` (así el lado de la isla queda siempre en +90°; `sign` es +1 con la isla a la izquierda). `side` son los rayos válidos a `FIT_HALF` o menos de `math.pi / 2`. Si hay alguno, quita los que midan más de 1,5 veces la mediana de `ranges[side]` (ya pasaron el final de la pared). Si quedan menos de 10 rayos, devuelve `math.inf`.

```bash
python -c "
from robotek_course.minisim import Field
from my_open.perception import perceive
for x in (0.0, 0.9):
    print(x, round(perceive(Field().scan(x, -0.75, 0.0, noise=False, dropouts=False)).island_end, 2))"
```

Pone el coche en x = 0 y en x = 0,9; lo reutilizas hasta el 3.8. Debes ver `0.0 56.0` y `0.9 56.0`: los rayos con los que se ajustará la recta.

<details>
<summary>Ver la solución de este paso</summary>

```python
FIT_HALF = math.radians(20.0)     # the island wall is fitted to the beams within this of the side bearing
```

Debajo de estas líneas sigue tu `return` provisional.

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
```

</details>

### Paso 3.5: una recta por esos rayos

Cada rayo es un punto: `x` hacia delante e `y` hacia el lado de la isla. Por los puntos de la pared pasamos una recta, y así da igual que el coche vaya un poco torcido. Cambia el `return` provisional por:

```python
    x, y = ...
    slope, offset = ...
    return float(offset)  # provisional
```

**Qué va dentro:** `x` es la distancia por el coseno de `bearing` e `y` por el seno. Los rayos perdidos valen `inf`: envuelve esa cuenta en `with np.errstate(invalid='ignore'):` para que NumPy no avise. La recta `y = slope * x + offset` sale de `np.polyfit(x[side], y[side], 1)`; `offset` es lo lejos que está la pared en x = 0.

Corre otra vez el comando del 3.4. Debes ver `0.0 0.25` (la pared está a 0,25 m) y `0.9 2.12` (ya pasaste la isla y la recta se ajusta a la pared lejana).

<details>
<summary>Ver la solución de este paso</summary>

```python
    with np.errstate(invalid='ignore'):                      # lost beams are inf
        x, y = ranges * np.cos(bearing), ranges * np.sin(bearing)
    slope, offset = np.polyfit(x[side], y[side], 1)          # y = slope * x + offset
```

</details>

### Paso 3.6: ¿de verdad es una pared de la isla?

A veces la recta no es una pared a tu lado (como en x = 0,9). Si está muy inclinada o muy lejos, devolvemos `inf`. Pega las constantes arriba de `island_end` y el `if` antes del `return` provisional:

```python
MAX_SLOPE = math.tan(0.30)        # más inclinada que 0,30 rad (17°) no es una pared a un lado
LATERAL_RANGE = (0.15, 0.90)      # m: entre estas distancias puede estar la pared de la isla

    if ...:
        return math.inf
```

**Qué va dentro:** la condición es verdadera si `abs(slope)` pasa de `MAX_SLOPE`, o si `offset` no está entre `LATERAL_RANGE[0]` y `LATERAL_RANGE[1]`.

Corre otra vez el comando del 3.4. Debes ver `0.0 0.25` y `0.9 inf`.

<details>
<summary>Ver la solución de este paso</summary>

```python
MAX_SLOPE = math.tan(0.30)        # a line steeper than this (rad) is not a wall beside the car
LATERAL_RANGE = (0.15, 0.90)      # m: plausible distance from the car to the island wall
```

```python
    if abs(slope) > MAX_SLOPE or not LATERAL_RANGE[0] < offset < LATERAL_RANGE[1]:
        return math.inf                                      # that is not an island wall beside the car
```

</details>

### Paso 3.7: qué rayos caen sobre la recta

Marcamos los rayos que están sobre la recta; los que quedan a más de 3 cm no son pared. Pega la constante arriba de `island_end` y cambia el `return` provisional por:

```python
WALL_TOLERANCE = 0.03             # m: hasta esta distancia a la recta, el rayo cuenta como pared

    on_wall = ...
    return float(on_wall.sum())  # provisional
```

**Qué va dentro:** un rayo está en `on_wall` si es válido (`ok`) y la distancia entre su `y` y la recta (`slope * x + offset`) es de `WALL_TOLERANCE` o menos. Envuélvelo otra vez en `np.errstate(invalid='ignore')`.

Corre otra vez el comando del 3.4. Debes ver `0.0 109.0` (los rayos que caen sobre la pared) y `0.9 inf`.

<details>
<summary>Ver la solución de este paso</summary>

```python
WALL_TOLERANCE = 0.03             # m: a beam is on the wall within this of the fitted line
```

```python
    with np.errstate(invalid='ignore'):
        on_wall = ok & (np.abs(y - (slope * x + offset)) <= WALL_TOLERANCE)
```

</details>

### Paso 3.8: seguir la pared hasta que se acaba

Recorre los rayos desde el lado hacia el frente. Recuerda el último que sigue sobre la pared y para cuando fallan más de 2 seguidos (uno o dos rayos perdidos al azar no deben pararte). Pega las constantes arriba de `island_end` y cambia el `return` provisional por:

```python
END_FROM = math.radians(20.0)     # recorremos de 90° hasta este ángulo
MAX_GAP_BEAMS = 2                 # rayos seguidos fuera de la pared que aguantamos

    last, missing = None, 0       # el último rayo sobre la pared; cuántos fallan seguidos
    for i in ...:
        ...
    return ...
```

**Qué va dentro:** recorre los índices con `np.argsort(-bearing)` (de mayor a menor ángulo) y salta los que no estén entre `END_FROM` y `math.pi / 2`. Si el rayo está en `on_wall`, guárdalo en `last` y pon `missing` en 0. Si no, suma 1 a `missing` y, si pasa de `MAX_GAP_BEAMS` y ya hay un `last`, sal con `break`. Al final, si no hay `last` o `bearing[last]` está a 0,05 rad o menos de `END_FROM` (la pared sigue hasta el borde de la vista), devuelve `math.inf`. Si no, devuelve `x[last] + LIDAR_X` como `float` (el LiDAR va 0,128 m delante del centro del coche).

```bash
python -m pytest course/tests/test_step_3.py -q
```

Debes ver `9 passed`. En x = 0 el comando del 3.4 ahora da `0.0 0.5`: el final de la isla está a 0,5 m menos lo que avanzó el coche.

<details>
<summary>Ver la solución de este paso</summary>

```python
END_FROM = math.radians(20.0)     # the island wall is followed from 90 deg down to this bearing
MAX_GAP_BEAMS = 2                 # lost beams that do not end the wall
```

```python
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

## Pruébalo en el simulador

Ya tienes `9 passed` sin ROS. Ahora con Gazebo, sin ventana (en macOS mira el paso 0 para el prefijo de `colcon` y el `source`):

```bash
colcon build --symlink-install --packages-select my_open && source install/setup.bash
```

Debe terminar sin errores. Luego:

```bash
python3 course/verify_step.py 3
```

Debe terminar con `PASS`: compara cada `/scene` con los números ideales (sin ruido) y mira que el coche se pare ante la pared sin tocarla. La referencia quedó a menos de 2 cm del ideal en `left`, `right` y `front_axis`, y a menos de 1,2 cm en `island_end` (límites: 5 cm, y 10 cm para `island_end`). Con tu nodo en marcha, `ros2 topic echo /scene` muestra los números en vivo.

### Rómpelo

1. En `median_range`, cambia `np.median` por `np.mean` y corre las pruebas. Solo falla `test_a_median_ignores_a_beam_that_goes_through_a_gap`: `left` da 0,396 en vez de 0,25.
2. Deshaz el cambio. En `front_axis`, usa `0.0` en lugar de `forward_yaw` en la línea del coseno. Falla `test_the_wall_ahead_is_measured_along_the_track_when_the_car_is_crooked`: con el coche torcido da 1,315 m en vez de 1,378 m.

## Si algo falla

- **`left` o `right` dan siempre `inf`.** Revisa que `_near` reciba `SIDE_HALF` y que compare ángulos con `arctan2(sin, cos)` y no con una simple resta.
- **`island_end` da siempre `inf`, o salen avisos de `invalid value`.** Corre el comando del 3.4 después de cada pasito para ver cuál lo rompe. Los avisos significan que falta `np.errstate(invalid='ignore')`.
- **`verify_step.py` dice que ya hay un `gz sim` en marcha.** Cierra el otro simulador o usa `--wait 60` para esperar a que termine.

## Resumen

- `perceive` convierte un escaneo de 306 rayos en cuatro números: `left`, `right`, `front_axis` e `island_end`. Lo que no se ve vale `inf`.
- Usa la mediana y no el promedio, porque un rayo salvaje arruina el promedio. `island_end` es el número frágil: depende de una recta ajustada a pocos rayos.
- Para comparar tu `perception.py` con la referencia: `bash tools/compare-step.sh 3`.

## Antes de seguir

- [ ] `pytest` marca `9 passed` y `verify_step.py 3` termina en `PASS`.
- [ ] Sabes decir por qué `left` resiste un rayo salvaje y un promedio no.
- [ ] Viste en el widget que `island_end` baila más que `left` cuando subes el ruido o los rayos perdidos.

<details>
<summary>Para curiosos: cómo funciona drive.py</summary>

`drive.py` es el nodo de ROS (se llama `strategy`). Lo del paso 2 sigue igual: calibrar el giroscopio y avanzar recto. Lo nuevo es esto, y lo explica la sección «El nodo» de arriba:

- Se suscribe a `/scan`. En `on_scan` ignora una marca de tiempo ya usada, llama a `perceive` y publica los cuatro números en `/scene` (y las marcas de RViz en `/scene_markers`).
- En `control`, que corre 50 veces por segundo, se detiene cuando `front_axis` baja de `STOP_FRONT` (0,5 m). Con enclavamiento: una vez parado, un rayo con ruido no lo arranca otra vez.
- Publica la orden de marcha en `/cmd_vel_raw`.

Para leerlo, abre `src/my_open/my_open/drive.py`; es el mismo que ya tenías con esas tres piezas añadidas.

</details>
