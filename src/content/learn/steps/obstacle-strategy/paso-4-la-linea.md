---
guide: "obstacle-strategy"
order: 4
slug: "paso-4-la-linea"
title: "La línea: un lado por señal"
summary: "Convierte la memoria de señales en una línea: un desplazamiento lateral sostenido junto a cada señal y rampas entre ellas."
tag: "obstacle-step-4"
compareFrom: "obstacle-step-3"
---

Ya sabes dónde están las señales y de qué color son. Falta decidir **por dónde pasa el coche**. En este paso escribes `plan.py`: una línea descrita como un desplazamiento lateral respecto al carril en función del progreso. Junto a cada señal el desplazamiento la deja del lado correcto, y entre dos señales cambia en línea recta.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/QR3U1dgc5RE" title="Path Planning with A* and RRT | Autonomous Navigation, Part 4" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Path Planning with A* and RRT | Autonomous Navigation, Part 4</strong> · MATLAB (inglés, 18 min). Qué es planificar una trayectoria; la línea de este paso es una versión simple.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

El coche sigue sin conducirse solo. Conduces con `keyboard_drive` y miras `ros2 topic echo /obstacle/plan`: el desplazamiento planificado 0, 0,5, 1 y 1,5 unidades por delante del coche. Al acercarte a una roja interior lo verás bajar a −0,15; a una verde interior, subir a +0,35. Lo seguirás en el paso 6. Las pruebas comprueban el plan contra campos armados a mano.

<div data-widget="step-replay" data-src="/learn/assets/replays/obstacle-step-4.json"></div>

*Repetición del laboratorio del Obstacle (la copia de la web) con la solución del curso. Cada señal se pasa por su lado: los eventos dan el desplazamiento planificado al cruzarla y la fila de la señal.*

<div data-widget="obstacle-line"></div>

## La idea

### El desplazamiento de una señal

Una señal está a ±0,1 m del carril. Para pasarla por su lado con margen, el centro del coche va a una distancia de su fila igual a **el margen más medio coche**: 0,18 m (`pillar_clearance`) + 0,074 m (medio ancho del contorno medido) = **0,254 m**.

| Señal | Lado | Desplazamiento |
|---|---|---:|
| Roja, fila interior (+0,1) | derecha (hacia fuera) | −0,154 m |
| Roja, fila exterior (−0,1) | derecha | −0,354 m |
| Verde, fila interior | izquierda (hacia la isla) | +0,354 m |
| Verde, fila exterior | izquierda | +0,154 m |

Se limita a ±0,36 m: más allá el coche tocaría la isla o el muro (el pasillo deja 0,5 m a cada lado del carril y el coche ocupa 0,074 m).

**Color desconocido.** Si la cámara aún no vio la señal, el coche se **aparta 0,12 m** de su fila: −0,12 de una interior y +0,12 de una exterior. La primera versión se apartaba 0,18 m, y eso empeoraba el problema: más lejos de la señal, más ángulo y menos cámara. Con 0,12 m, el set de prueba pasó de 20 a 25 rondas válidas de 50.

### Sostener y rampas

El desplazamiento de cada señal se **sostiene** desde 0,15 unidades antes hasta 0,15 después: el coche mide 0,233 m y tiene que estar del lado correcto mientras la cruza. Entre dos tramos sostenidos el desplazamiento cambia en línea recta (una **rampa**). Antes de la primera señal y después de la última se queda constante.

La versión anterior usaba un *latch*: fijaba un desplazamiento al ver una señal y lo soltaba al pasarla. El cambio de lado hacia la siguiente señal empezaba **después** de la primera, cuando el punto bueno para empezar estaba 0,2 m antes. Con la línea planificada, la rampa empieza justo al terminar la señal anterior. Ese cambio, junto con la memoria del paso 3, llevó el set de prueba de 15 a 20 rondas válidas de 50.

### Cuánto cuesta cambiar de lado

Cambiar de lado lleva metros. Con 0,279 rad de dirección, dos arcos a fondo y el servo real:

| Cambio lateral (m) | Distancia necesaria (m) |
|---:|---:|
| 0,154 | 0,48 |
| 0,354 | 0,68 |
| 0,508 | 0,76 |
| 0,708 | 0,81 |

Súmale de 0,15 a 0,2 m por el retraso del servo (60 ms y 1,2 rad/s). Por eso **el color de una señal debe conocerse al menos 0,9–1,0 m antes**: ir más despacio no ayuda, solo verla antes.

### Mirar por adelantado

Si la señal sin color está al **inicio de la recta siguiente** (asiento 2k + 2, justo a la salida de una esquina), el plan añade un punto **1,5 unidades antes** con el coche a **+0,15 m** (hacia la isla) si la señal es interior, o al centro si es exterior. Desde ahí la cámara la ve en casi toda la recta anterior; desde el lado de fuera solo en los primeros 0,3–0,5 m. Si otra señal está a menos de 0,4 unidades de ese punto, no se añade. Con este punto el set pasó de 30 a 32 rondas válidas.

## Escríbelo

> **En este paso**
> - **Escribes:** `plan.py` con `side_offset`, `with_offsets`, `lookouts`, `sign_knots`, `offset_at` y `lot_zone`.
> - **Copias hecho:** `drive.py` de este paso.

```bash
git show obstacle-step-4:src/my_obstacle/my_obstacle/drive.py > src/my_obstacle/my_obstacle/drive.py
```

Crea `src/my_obstacle/my_obstacle/plan.py` con su cabecera y sus constantes (ya hechas):

```python
"""The line (step 4): one side offset per sign, held around it, straight ramps in between."""

from .lane import UNITS_PER_LAP, clamp

UNKNOWN_OFFSET = 0.12   # m away from a sign whose colour is still unknown
LOOKOUT = 0.15          # m to the island side to see an inner sign ahead
HOLD = 0.15             # track units before and after a sign the side offset is held
HORIZON = 3.0           # track units of remembered signs the plan covers
OFFSET_LIMIT = 0.36     # m from the lane centre (the car is 0.148 m wide, the lane 1 m)
LOT_OFFSET = -0.19      # m; beside the parking lot the car keeps off its limits
```

### Paso 4.1: el lado de una señal

El reglamento: las rojas por la derecha, las verdes por la izquierda. En el carril, «izquierda» es hacia la isla (positivo). El coche pasa a una distancia de la fila igual al margen más medio coche.

Y debajo, este esqueleto:

```python
def side_offset(lateral, colour, clearance):
    """Lateral offset (m, + island side) that passes a sign on its side; away from it if unknown."""
    ...  # TODO 4.1
```

**Qué va dentro:** Sin color: aléjate `UNKNOWN_OFFSET` de la fila (`−0,12` de una interior, `+0,12` de una exterior). Roja: `lateral − clearance`; verde: `lateral + clearance`. Limita a `±OFFSET_LIMIT`.

**Un ejemplo:** `clearance` = 0,18 + 0,074 = 0,254. Una roja interior (+0,1) pide −0,154; una verde exterior (−0,1), +0,154; una verde interior, +0,354 → limitado a +0,36.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_4.py -q -k "red_on_the_right or unknown_colour"
```

Debes ver `2 passed`: roja por la derecha, verde por la izquierda y el color desconocido.

<details>
<summary>Ver la solución de side_offset</summary>

```python
def side_offset(lateral, colour, clearance):
    """Lateral offset (m, + island side) that passes a sign on its side; away from it if unknown."""
    if colour is None:
        # Sign rows are 0.1 m off the centre and the car is 0.148 m wide.
        return -UNKNOWN_OFFSET if lateral >= 0.0 else UNKNOWN_OFFSET
    offset = lateral - clearance if colour == 'red' else lateral + clearance
    return clamp(offset, -OFFSET_LIMIT, OFFSET_LIMIT)
```

</details>

### Paso 4.2: nudos y rampas

La línea se describe con nudos (progreso, desplazamiento): uno 0,15 antes y otro 0,15 después de cada señal (el coche mide 0,233 m y tiene que estar de su lado mientras la cruza), y rampas rectas en medio.

Y debajo, este esqueleto:

```python
def with_offsets(signs, clearance):
    """{progress: (lateral, colour)} -> {progress: (lateral, colour, offset)}."""
    ...  # TODO 4.2


def sign_knots(signs, phi):
    """The knots of the signs (held offsets) and of the lookouts, not sorted."""
    ...  # TODO 4.2


def offset_at(knots, progress):
    """Planned offset at a progress value: linear between sorted knots, constant past the ends
    (0 without knots)."""
    ...  # TODO 4.2
```

**Qué va dentro:** `with_offsets` añade `side_offset` a cada señal de `{progreso: (lateral, color)}`. `sign_knots` da `(s − HOLD, d)` y `(s + HOLD, d)` por señal, más los de `lookouts`, sin ordenar. `offset_at` interpola entre nudos ordenados: antes del primero, el primero; después del último, el último; sin nudos, 0.

**Un ejemplo:** Una roja interior en 0,5 y una verde exterior en 1,0: −0,154 de 0,35 a 0,65, rampa hasta +0,154 en 0,85, y así hasta 1,15.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_4.py -q -k "held_around_a_sign"
```

Debes ver `1 passed`: el desplazamiento sostenido junto a una señal y las rampas.

<details>
<summary>Ver la solución de with_offsets, sign_knots, offset_at</summary>

```python
def with_offsets(signs, clearance):
    """{progress: (lateral, colour)} -> {progress: (lateral, colour, offset)}."""
    return {s: (lateral, colour, side_offset(lateral, colour, clearance)) for s, (lateral, colour) in signs.items()}


def sign_knots(signs, phi):
    """The knots of the signs (held offsets) and of the lookouts, not sorted."""
    knots = [(s + d, sign[2]) for s, sign in signs.items() for d in (-HOLD, HOLD)]
    return knots + lookouts(signs, phi)


def offset_at(knots, progress):
    """Planned offset at a progress value: linear between sorted knots, constant past the ends
    (0 without knots)."""
    if not knots:
        return 0.0
    if progress <= knots[0][0]:
        return knots[0][1]
    for (s0, d0), (s1, d1) in zip(knots, knots[1:]):
        if progress <= s1:
            return d0 + (d1 - d0) * (progress - s0) / max(s1 - s0, 1e-9)
    return knots[-1][1]
```

</details>

### Paso 4.3: mirar por adelantado

Una señal sin color al principio de la recta siguiente no entra en la cámara desde el lado de fuera. Si el coche pasa 1,5 unidades antes por el lado de la isla, la ve casi toda la recta.

Y debajo, este esqueleto:

```python
def lookouts(signs, phi):
    """Knots that bring a corner-exit sign of unknown colour into the camera's view.

    The camera sees a sign at the start of the next straight from the middle of the current one
    only from the island side of the lane (+0.15 m; 0 m for the outer row), so the line passes
    there 1.5 track units before the sign when no other sign is near.
    """
    ...  # TODO 4.3
```

**Qué va dentro:** Para cada señal sin color en una recta (progreso par) cuyo punto `s − 1,5` está al menos 0,1 por delante y sin otra señal a menos de 0,4: un nudo `(s − 1,5, LOOKOUT)` si es interior, o `(s − 1,5, 0)` si es exterior.

**Un ejemplo:** Una interior sin color en 2,0 con el coche en 0,2: un nudo en (0,5, +0,15).

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_4.py -q -k "lookout"
```

Debes ver `1 passed`: el nudo para mirar una señal de la recta siguiente.

<details>
<summary>Ver la solución de lookouts</summary>

```python
def lookouts(signs, phi):
    """Knots that bring a corner-exit sign of unknown colour into the camera's view.

    The camera sees a sign at the start of the next straight from the middle of the current one
    only from the island side of the lane (+0.15 m; 0 m for the outer row), so the line passes
    there 1.5 track units before the sign when no other sign is near.
    """
    out = []
    for s, (lateral, colour, _) in signs.items():
        look = s - 1.5
        if colour is not None or round(s) % 2 or look - phi < 0.1:
            continue
        if any(abs(other - look) < 0.4 for other in signs):
            continue
        out.append((look, LOOKOUT if lateral > 0.0 else 0.0))
    return out
```

</details>

### Paso 4.4: junto al aparcamiento

Los topes del aparcamiento sobresalen 20 cm del muro de la recta de salida: ahí la línea no puede ir pegada al muro.

Y debajo, este esqueleto:

```python
def lot_zone(progress, direction):
    """Whether a progress value is on the start straight beside the parking lot (track frame:
    x 0.13..0.48 in CCW, -0.48..-0.13 in CW, plus the car's length)."""
    ...  # TODO 4.4
```

**Qué va dentro:** Con `s = progress % 8`: en antihorario la zona va de 0,43 a 1,18; en horario, de −0,18 a 0,57 (también cuenta `s − 8`).

**Un ejemplo:** `lot_zone(0.6, "ccw")` es `True`; `lot_zone(1.5, "ccw")`, `False`.

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_4.py -q -k "lot_zone"
```

Debes ver `1 passed`: la zona del aparcamiento en los dos sentidos.

<details>
<summary>Ver la solución de lot_zone</summary>

```python
def lot_zone(progress, direction):
    """Whether a progress value is on the start straight beside the parking lot (track frame:
    x 0.13..0.48 in CCW, -0.48..-0.13 in CW, plus the car's length)."""
    s = progress % UNITS_PER_LAP
    low, high = (0.43, 1.18) if direction == 'ccw' else (-0.18, 0.57)
    return low <= s <= high or low <= s - UNITS_PER_LAP <= high
```

</details>

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_4.py -q        # 5 passed
```

### Prueba esto

- En el widget de la línea, elige **Cruzar el carril**: una verde interior y una roja exterior seguidas. Mira la rampa y los centímetros libres en cada señal; baja `pillar_clearance` y mira cómo cambian.
- Elige **Mirar por adelantado**: aparece un nudo 1,5 unidades antes de la señal sin color.
- En la **lección interactiva** de este paso, tu `plan.py` pasa cada señal en el simulador; el juez para el intento en la primera señal mal pasada.

### Rómpelo

1. En `side_offset`, cambia `'red'` por `'green'`: en la lección interactiva el juez para el coche en la primera señal, por el lado equivocado.
2. Cambia `HOLD` a 0: la línea ya no se sostiene junto a la señal y el coche la cruza todavía cambiando de lado.

## Si algo falla

- **Una rampa va hacia atrás.** `offset_at` necesita los nudos ordenados por progreso: ordénalos antes de usarlos (en el paso 5 lo hace `corner.merge`).
- **El coche roza una señal de la fila exterior.** Revisa el signo: una roja se pasa con desplazamiento menor que su fila.

## Resumen

- Un desplazamiento por señal: su fila ± (0,18 + 0,074) m, sostenido ±0,15 unidades.
- Rampas rectas entre señales, que empiezan al terminar la anterior.
- Un punto de vista adelantado para las señales sin color que vienen tras una esquina.

## Antes de seguir

- [ ] `test_obstacle_step_4.py` da `5 passed`.
- [ ] Puedes dibujar a mano la línea de una recta con dos señales.
