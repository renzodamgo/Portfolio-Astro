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

```python
UNKNOWN_OFFSET = 0.12   # m away from a sign whose colour is still unknown
LOOKOUT = 0.15          # m to the island side to see an inner sign ahead
HOLD = 0.15             # track units before and after a sign the side offset is held
HORIZON = 3.0           # track units of remembered signs the plan covers
OFFSET_LIMIT = 0.36     # m from the lane centre
LOT_OFFSET = -0.19      # m; beside the parking lot the car keeps off its limits
```

### Paso 4.1: `side_offset(lateral, colour, clearance)`

`clearance` ya incluye el medio coche: la misión le pasa `pillar_clearance + OUTLINE_HALF_WIDTH` (0,18 + 0,074). Devuelve `lateral − clearance` para una roja, `lateral + clearance` para una verde, limitado a ±`OFFSET_LIMIT`; con `colour` `None`, apartarse `UNKNOWN_OFFSET`.

### Paso 4.2: `with_offsets(signs, clearance)` y `lookouts(signs, phi)`

`with_offsets` toma el `{progreso: (lateral, color)}` de `SeatMemory.ahead` y añade el desplazamiento: `{progreso: (lateral, color, desplazamiento)}`. `lookouts` devuelve los nudos `(s − 1,5, LOOKOUT o 0)` de las señales sin color al inicio de una recta (progreso par), si ese punto queda por delante del coche y no hay otra señal a menos de 0,4 unidades.

### Paso 4.3: `sign_knots(signs, phi)` y `offset_at(knots, progress)`

`sign_knots` da dos nudos por señal, `(s − HOLD, d)` y `(s + HOLD, d)`, más los de `lookouts`, **sin ordenar** (el paso 5 mete las esquinas y ordena). `offset_at` interpola entre nudos ordenados; antes del primero, el primero; después del último, el último; sin nudos, 0.

<details>
<summary>Ver la solución de offset_at</summary>

```python
def offset_at(knots, progress):
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

### Paso 4.4: `lot_zone(progress, direction)`

Si hay aparcamiento, junto a él el desplazamiento no baja de `LOT_OFFSET`. `lot_zone` dice si un progreso está en esa zona de la recta de salida: de 0,43 a 1,18 en CCW y de −0,18 a 0,57 en CW (el aparcamiento más el largo del coche).

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_4.py -q        # 5 passed
```

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
