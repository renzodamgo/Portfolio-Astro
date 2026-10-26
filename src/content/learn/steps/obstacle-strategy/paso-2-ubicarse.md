---
guide: "obstacle-strategy"
order: 2
slug: "paso-2-ubicarse"
title: "Ubicarse con los muros"
summary: "Estima la pose del coche ajustando el escaneo a los muros conocidos, y elige el sentido de la ronda con el primer escaneo."
tag: "obstacle-step-2"
compareFrom: "obstacle-step-1"
---

En el Open el coche no necesitaba saber dónde estaba: le bastaba con la pared de la isla. En el Obstacle sí lo necesita, porque cada señal está en un sitio concreto del carril y hay que llegar a ella por el lado correcto. En este paso escribes `localizer.py`: una pose (x, y, rumbo) que se predice con la distancia recorrida y el giroscopio y se corrige con el LiDAR contra los muros, que son siempre los mismos.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/QWDM4cFdKrE" title="Iterative Closest Point (ICP) - 5 Minutes with Cyrill" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Iterative Closest Point (ICP) - 5 Minutes with Cyrill</strong> · Cyrill Stachniss (inglés, 5 min). Cómo se alinean dos nubes de puntos del LiDAR: la idea detrás de ajustar el escaneo a los muros.</figcaption>
</figure>
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/8VJ-A9OlhAE" title="Robot Localization - An Overview (Cyrill Stachniss)" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Robot Localization - An Overview (Cyrill Stachniss)</strong> · Cyrill Stachniss (inglés). Panorama de la localización de robots (clase larga, para profundizar).</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

Hasta el paso 6 el coche no se conduce solo: el `drive.py` de los pasos 2 a 5 es un nodo **observador**. Tras Start calibra el giroscopio 0,3 s, elige el sentido con el primer escaneo (lo imprime: `Direction ccw`) y desde ahí publica en `/obstacle/pose` lo que entiende: x, y y rumbo en el campo espejado, y el progreso. Tú conduces con el teclado en otra terminal, con `ros2 run robotek_course keyboard_drive`, y miras con `ros2 topic echo /obstacle/pose` cómo el progreso avanza y la pose sigue al coche. En el laboratorio, contra la pose real, el error típico es de **2 a 6 mm** y el del rumbo de unas décimas de grado.

<div data-widget="step-replay" data-src="/learn/assets/replays/obstacle-step-2.json"></div>

*Repetición del laboratorio del Obstacle (la copia de la web) con la solución del curso. En azul, dónde cree el coche que está; en ámbar, dónde está de verdad. El sentido sale del primer escaneo (aquí horario) y el error se queda en un par de centímetros toda la vuelta.*

## La idea

### Predecir y corregir

Cada tick (50 por segundo) el localizador **predice**: avanza la distancia que da la odometría del LiDAR (la clase base la calcula por ti, una vez por escaneo) en la dirección del rumbo del giroscopio. Una predicción sola se desvía: la distancia tiene unos milímetros de error por escaneo y el giroscopio un sesgo pequeño.

<div data-widget="obstacle-localize"></div>

Por eso, con cada escaneo nuevo, **corrige**: pasa los puntos del escaneo al campo con la pose actual y mide cuánto se separan de los muros conocidos (los cuatro exteriores a ±1,5 m y los cuatro de la isla a ±0,5 m). Luego mueve un poco la pose (x, y y rumbo) para que esa separación sea mínima. Es un **ajuste por mínimos cuadrados** de tres números.

| Detalle | Valor | Por qué |
|---|---|---|
| Puertas (distancia máxima de un punto a su muro) | 0,08 m en la marcha; de 0,45 a 0,06 m al empezar | un punto lejos de todo muro es una señal o un tope, no un muro |
| Peso de cada punto | Huber: 1 hasta 2 cm, menos después | un punto raro no arrastra la pose |
| Ganancia | 0,5 | corrige la mitad del error por escaneo: suave pero rápido (10 escaneos por segundo) |
| Muro de la isla | solo la cara que el punto tiene enfrente | las esquinas de la isla confunden si se usan las dos caras |

### Empezar sin saber dónde

Al salir, el localizador no conoce la pose. Sí sabe que el coche está en la recta de salida mirando a lo largo. Prueba tres posiciones a lo largo (x = −0,35, 0 y 0,35), ajusta desde cada una con puertas que se van cerrando y se queda con la que deja más puntos sobre los muros.

### El sentido con un solo escaneo

El coche arranca mirando en el sentido de la ronda: en CCW la isla queda a su izquierda; en CW, a la derecha. `direction_from_scan` ajusta el escaneo con las dos hipótesis (el escaneo tal cual y espejado) y compara qué fracción de los puntos cae sobre los muros. La correcta gana por unas 0,15–0,18; la diferencia se llama **margen**.

Con el aparcamiento, los topes ensucian el muro exterior y en CCW el margen bajó a **0,05–0,13**. La solución acepta el sentido enseguida si el margen pasa de 0,10, y tras 1 s de escaneos se conforma con 0,03. Sin esa espera, en la semilla 2 con aparcamiento el coche nunca arrancaba.

### Espejar

Para CW, `scan_points(scan, sign)` cambia el signo de la `y` de cada punto: el escaneo espejado es el de un coche que va en CCW. Desde ahí, toda la estrategia trabaja en el campo espejado, y el volante se vuelve a espejar al final (`steer * sign`).

## Escríbelo

> **En este paso**
> - **Escribes:** `localizer.py` con `scan_points`, la clase `Localizer` (`predict`, `_fit`, `correct`, `initialize`) y `direction_from_scan`.
> - **Copias hecho:** `drive.py` de este paso.
> - **Resultado:** el coche sabe dónde está y en qué sentido va.

```bash
git show obstacle-step-2:src/my_obstacle/my_obstacle/drive.py > src/my_obstacle/my_obstacle/drive.py
```

Crea `src/my_obstacle/my_obstacle/localizer.py` con su cabecera y sus constantes (ya hechas):

```python
"""Where the car is (step 2): the known walls fitted to the LiDAR, predicted with distance + gyro."""

import math

import numpy as np

from robotek_common.vehicle import LIDAR_OFFSET_X

from .lane import INNER, OUTER, wrap
```

### Paso 2.1: los puntos del escaneo

El LiDAR da 306 distancias; para compararlas con los muros hay que convertirlas en puntos. En sentido horario todo se trabaja en espejo, así que los puntos también.

Y debajo, este esqueleto:

```python
def scan_points(scan, sign):
    """Valid LiDAR returns as points of the car frame (x ahead, y left), mirrored for CW (sign = -1)."""
    ...  # TODO 2.1
```

**Qué va dentro:** Ángulo de cada rayo: `angle_min + i · angle_increment`. Quédate con los válidos (finitos, entre 0,16 y 4 m). Cada punto es `x = r·cos(a) + LIDAR_OFFSET_X` (el LiDAR está 12,8 cm delante del centro) y `y = sign · r·sin(a)`.

**Un ejemplo:** Un rayo de 0,5 m a 90° (a la izquierda) da el punto (0,128, 0,5); en horario, (0,128, −0,5).

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_2.py -q -k "scan_points"
```

Debes ver `1 passed`: que los puntos están en el sistema del coche y en espejo en horario.

<details>
<summary>Ver la solución de scan_points</summary>

```python
def scan_points(scan, sign):
    """Valid LiDAR returns as points of the car frame (x ahead, y left), mirrored for CW (sign = -1)."""
    r = np.asarray(scan.ranges, dtype=float)
    a = scan.angle_min + np.arange(r.size) * scan.angle_increment
    ok = np.isfinite(r) & (r > 0.16) & (r < 4.0)
    return r[ok] * np.cos(a[ok]) + LIDAR_OFFSET_X, sign * r[ok] * np.sin(a[ok])
```

</details>

### Paso 2.2: predecir

Entre escaneo y escaneo el coche avanza a ciegas: sabe cuánto (la odometría del LiDAR) y hacia dónde (el giroscopio). Usar el rumbo **medio** del tramo evita que una curva se convierta en una recta torcida.

Y debajo, este esqueleto:

```python
class Localizer:
    def __init__(self):
        ...  # TODO 2.2

    def predict(self, distance, heading):
        """Move ``distance`` metres along the mean of the old and new heading."""
        ...  # TODO 2.2
```

**Qué va dentro:** `mid = th + 0.5 · wrap(heading − th)`; suma `distance · cos(mid)` a x y `distance · sin(mid)` a y; el rumbo nuevo es `heading`.

**Un ejemplo:** Desde (0, 0, 0), `predict(0.1, 0.2)` deja el coche en (0,0995, 0,0100, 0,2): 10 cm por el rumbo medio, 0,1 rad.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_2.py -q -k "predict"
```

Debes ver `1 passed`: un paso de 10 cm con el rumbo medio.

<details>
<summary>Ver la solución de __init__, predict</summary>

```python
    def __init__(self):
        self.x = self.y = self.th = 0.0
        self.ready = False
        self.inliers = 0
        self.rms = math.nan

    def predict(self, distance, heading):
        """Move ``distance`` metres along the mean of the old and new heading."""
        mid = self.th + 0.5 * wrap(heading - self.th)
        self.x += distance * math.cos(mid)
        self.y += distance * math.sin(mid)
        self.th = heading
```

</details>

### Paso 2.3: corregir con los muros

La predicción se desvía unos milímetros por escaneo. Cada escaneo la corrige: se mueve la pose hasta que los puntos caen sobre los muros que el campo tiene seguro (los cuatro de fuera y la isla), como encajar una plantilla sobre un dibujo.

Y debajo, este esqueleto:

```python
class Localizer:
    # ... (lo de los pasos anteriores)

    def _fit(self, bx, by, x, y, th, gate):
        """Scan points near a known wall: their positions, the wall normals and the residuals."""
        ...  # TODO 2.3

    def correct(self, bx, by, gain=1.0, gate=0.08, iterations=2, damping=2.0):
        """Pull the pose toward the wall fit by ``gain`` (1 = all the way). False if too few points."""
        ...  # TODO 2.3
```

**Qué va dentro:** `_fit`: pasa los puntos al campo con la pose; a cada punto le toca el muro exterior de su eje dominante (`|x| ≥ |y|` → muro de x) o la cara de la isla que tiene enfrente, la que esté más cerca; su error `r` es la distancia con signo a ese muro y su normal `(nx, ny)`; quédate con los de `|r| < gate`. `correct`: dos iteraciones de Gauss-Newton con `J = [nx, ny, nx·−(py − y) + ny·(px − x)]`, pesos de Huber `min(1, 0,02/|r|)` y `damping · I`; con menos de 20 puntos, no corrige. Mueve la pose `gain` veces la solución.

**Un ejemplo:** Con una pose 8 cm y 6° desviada, cinco correcciones la dejan a 2 mm (prueba el widget de arriba).

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_2.py -q -k "correct_pulls"
```

Debes ver `1 passed`: que una pose equivocada vuelve a los muros.

<details>
<summary>Ver la solución de _fit, correct</summary>

```python
    def _fit(self, bx, by, x, y, th, gate):
        """Scan points near a known wall: their positions, the wall normals and the residuals."""
        c, s = math.cos(th), math.sin(th)
        px, py = x + c * bx - s * by, y + s * bx + c * by
        ax, ay = np.abs(px), np.abs(py)
        # Outer walls: the dominant axis gives the nearest wall from inside.
        onx = np.where(ax >= ay, np.sign(px), 0.0)
        ony = np.where(ax < ay, np.sign(py), 0.0)
        r_out = onx * px + ony * py - OUTER
        # Island walls: only the face a point is directly beside.
        inx = (ay <= INNER) & (ax > INNER - 0.05)
        iny = (ax <= INNER) & (ay > INNER - 0.05)
        nx = np.where(inx, np.sign(px), np.where(iny, 0.0, onx))
        ny = np.where(inx, 0.0, np.where(iny, np.sign(py), ony))
        r_in = np.where(inx, ax - INNER, np.where(iny, ay - INNER, np.inf))
        use_in = np.abs(r_in) < np.abs(r_out)
        nx = np.where(use_in, nx, onx)
        ny = np.where(use_in, ny, ony)
        r = np.where(use_in, r_in, r_out)
        keep = np.abs(r) < gate
        return px[keep], py[keep], nx[keep], ny[keep], r[keep]

    def correct(self, bx, by, gain=1.0, gate=0.08, iterations=2, damping=2.0):
        """Pull the pose toward the wall fit by ``gain`` (1 = all the way). False if too few points."""
        x, y, th = self.x, self.y, self.th
        for _ in range(iterations):
            px, py, nx, ny, r = self._fit(bx, by, x, y, th, gate)
            if r.size < 20:
                return False
            w = np.minimum(1.0, 0.02 / np.maximum(np.abs(r), 1e-6))  # Huber
            J = np.stack([nx, ny, nx * -(py - y) + ny * (px - x)], axis=1)
            H = J.T @ (J * w[:, None]) + damping * np.eye(3)
            delta = -np.linalg.solve(H, J.T @ (w * r))
            x, y, th = x + delta[0], y + delta[1], wrap(th + delta[2])
        self.inliers = int(r.size)
        self.rms = float(np.sqrt(np.mean(r ** 2)))
        self.x += gain * (x - self.x)
        self.y += gain * (y - self.y)
        self.th = wrap(self.th + gain * wrap(th - self.th))
        return True
```

</details>

### Paso 2.4: empezar sin saber dónde

Al arrancar el coche no sabe en qué parte de la recta de salida está. Prueba tres sitios y se queda con el que mejor encaja.

Y debajo, este esqueleto:

```python
class Localizer:
    # ... (lo de los pasos anteriores)

    def initialize(self, bx, by, heading):
        """Global start in the bottom straight: try a few along-track guesses, keep the best fit."""
        ...  # TODO 2.4
```

**Qué va dentro:** Para `x0` en −0,35, 0 y 0,35: pose `(x0, −1, heading)` y `correct` con puertas cada vez más estrechas (0,45, 0,3, 0,2, 0,12, 0,08, 0,06; `gain` 1, `damping` 0,5). Puntúa cada una con `puntos − 2000 · rms` (con `_fit` a 5 cm) y quédate con la mejor.

**Un ejemplo:** Desde x = −0,3, 0, 0,2 en la recta, `initialize` encuentra la pose real a menos de 2 cm.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_2.py -q -k "initialize or cw_is_the_mirror"
```

Debes ver `5 passed`: el arranque en cuatro puntos de la recta de salida y el espejo en horario.

<details>
<summary>Ver la solución de initialize</summary>

```python
    def initialize(self, bx, by, heading):
        """Global start in the bottom straight: try a few along-track guesses, keep the best fit."""
        best = None
        for x0 in (-0.35, 0.0, 0.35):
            self.x, self.y, self.th = x0, -1.0, heading
            for gate in (0.45, 0.3, 0.2, 0.12, 0.08, 0.06):
                self.correct(bx, by, 1.0, gate, 2, 0.5)
            px, py, nx, ny, r = self._fit(bx, by, self.x, self.y, self.th, 0.05)
            score = r.size - 2000 * (float(np.sqrt(np.mean(r ** 2))) if r.size else 1.0)
            if best is None or score > best[0]:
                best = (score, self.x, self.y, self.th)
        _, self.x, self.y, self.th = best
        self.ready = True
```

</details>

### Paso 2.5: el sentido con un escaneo

Nadie le dice al coche el sentido de la ronda. Pero la isla mide 1 m y el muro de fuera 3 m: con la hipótesis equivocada, menos puntos caen sobre un muro.

Y debajo, este esqueleto:

```python
def direction_from_scan(scan):
    """Island on the left (CCW, +1) or on the right (CW, -1), assuming the car faces the way it
    will drive. Fits the walls under both hypotheses: the fraction of points on a wall differs by
    about 0.2 (the 1 m island against the 3 m outer wall). Returns (sign, margin)."""
    ...  # TODO 2.5
```

**Qué va dentro:** Para `sign` en +1 y −1: `scan_points(scan, sign)` (menos de 50 puntos: `(0, 0)`), un `Localizer` nuevo con `initialize(bx, by, 0)`, y la fracción de puntos a menos de 5 cm de un muro. Devuelve el signo con más fracción y la diferencia (el margen).

**Un ejemplo:** En la salida antihoraria: 100 % de puntos en un muro con la isla a la izquierda y 82 % a la derecha: margen 0,18.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_2.py -q -k "direction_from_the_walls"
```

Debes ver `1 passed`: antihorario y horario desde la salida, con margen de más de 0,10.

<details>
<summary>Ver la solución de direction_from_scan</summary>

```python
def direction_from_scan(scan):
    """Island on the left (CCW, +1) or on the right (CW, -1), assuming the car faces the way it
    will drive. Fits the walls under both hypotheses: the fraction of points on a wall differs by
    about 0.2 (the 1 m island against the 3 m outer wall). Returns (sign, margin)."""
    fractions = {}
    for sign in (1.0, -1.0):
        bx, by = scan_points(scan, sign)
        if bx.size < 50:
            return 0.0, 0.0
        loc = Localizer()
        loc.initialize(bx, by, 0.0)
        fractions[sign] = loc._fit(bx, by, loc.x, loc.y, loc.th, 0.05)[4].size / bx.size
    sign = max(fractions, key=fractions.get)
    return sign, fractions[sign] - fractions[-sign]
```

</details>

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_2.py -q        # 9 passed
colcon build --symlink-install --packages-select my_obstacle && source install/setup.bash
ros2 launch robotek_course obstacle_round.launch.py strategy:=my_obstacle seed:=0 direction:=cw gui:=true
```

En otra terminal, `ros2 run robotek_course keyboard_drive` para conducir y `ros2 topic echo /obstacle/pose` para mirar. En la terminal del lanzador verás `Direction cw`. Prueba los dos sentidos.

### Prueba esto

- En el widget de arriba, pulsa **Error de 20 cm** y luego **Corregir (una vez)**: mira cuántos puntos caen en un muro antes y después. Repite con **Torcido 20°**.
- Pulsa **Empezar sin saber dónde**: es `initialize`, que prueba tres sitios de la recta de salida.
- En la repetición, sigue la pose en azul (lo que cree el coche) contra la ámbar (la real): se quedan a un par de centímetros toda la vuelta.

### Rómpelo

1. En `scan_points`, olvida el `sign` de la `y`: las dos hipótesis de `direction_from_scan` ven los mismos puntos, el margen es 0 y la misión se queda en `SETUP` esperando un sentido.
2. Quita el `LIDAR_OFFSET_X`: los puntos se dibujan 12,8 cm por detrás de donde están; mira en el widget cómo se ponen rojos.

## Si algo falla

- **El sentido sale al revés.** Revisa el signo de `by` en `scan_points`.
- **La pose se va lejos en las esquinas.** La corrección está usando las dos caras de la isla: limita cada punto a la cara que tiene enfrente.
- **Nunca elige el sentido con aparcamiento.** Baja el margen después de esperar, como se explica arriba.

## Resumen

- Predicción con distancia y giroscopio, corrección contra los muros conocidos con mínimos cuadrados y pesos de Huber.
- El sentido sale del primer escaneo comparando el ajuste con y sin espejo.
- Desde aquí todo se calcula en el campo espejado (CCW).

## Antes de seguir

- [ ] `test_obstacle_step_2.py` da `9 passed`.
- [ ] En Gazebo el nodo elige bien el sentido en CCW y en CW, y la pose de `/obstacle/pose` sigue al coche mientras lo conduces.
