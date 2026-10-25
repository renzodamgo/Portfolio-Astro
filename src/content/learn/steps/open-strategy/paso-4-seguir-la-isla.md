---
guide: "open-strategy"
order: 4
slug: "paso-4-seguir-la-isla"
title: "Seguir la isla"
summary: "Sigue la pared interior con un controlador."
tag: "step-4"
compareFrom: "step-3"
---

Con el rumbo y la percepción ya puedes mantener al coche a una distancia fija de la isla. A esa distancia (la que mide `scene.left`) la llamaremos **hueco**. En este paso escribes la ley de carril: `lateral_bias` y `lane_steer`. La idea cabe en una línea, pero tiene una decisión de diseño que importa: el coche no corrige el hueco con el volante, corrige el **rumbo** al que apunta.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/wkfEZmsQqiA" title="What Is PID Control? | Understanding PID Control, Part 1" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>What Is PID Control? | Understanding PID Control, Part 1</strong> · MATLAB (inglés, 12 min). Realimentación y los términos P, I y D sin fórmulas: la ley de carril es un control P.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

El coche calibra el giroscopio, avanza junto a la pared de la isla (a su izquierda) y se acerca poco a poco a 0,25 m de ella. Cuando la pared de enfrente llega a 1,19 m (medidos a lo largo de la pista), manda parar y frena. Meta en Gazebo: al dar la orden de parar, un hueco entre 0,20 y 0,31 m, sin tocar nada. La referencia midió 0,270, 0,241 y 0,265 m en tres ejecuciones.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-4.json"></div>

*Repetición del mini simulador en un campo con una isla larga: el hueco a la pared baja de 0,5 m hacia 0,25 m.*

Una advertencia antes de seguir. La comprobación de Gazebo de este paso **no corre en el campo normal**, sino en uno generado por `verify_step.py` con una isla de **9 m**. La isla normal mide 1 m: a 0,6 m/s el coche pasa junto a ella en menos de 2 s, y la ley tarda unos 5 s en cerrar el error. En el campo normal el hueco de 0,5 m no llega a converger. La estrategia real corrige el hueco a lo largo de la primera recta y de las esquinas; este paso solo enseña que la ley converge.

## La idea

### Corregir el rumbo, no el hueco

Si estás más lejos de lo debido, apunta un poco hacia la isla. Si estás más cerca, un poco hacia fuera. En vez de mover el volante según el hueco, mueves la **meta** del rumbo, y la ley de rumbo del paso 2 hace el resto:

```text
desvío = clamp(sign * GAIN * (inner - GAP),
               -LIMIT, LIMIT)
volante = ley de rumbo (meta + desvío)
```

```text
isla   ####################
                  ↗ meta + desvío
coche  ---------->  meta (rumbo 0)
pared  ====================
```

¿Por qué no el volante directo? El volante cambia el rumbo y el rumbo cambia la posición: son dos «sumas» seguidas, y con una cadena así es fácil que el coche zigzaguee. Con la meta del rumbo, solo queda una: el hueco baja cada vez más despacio y sin pasarse. (Es una explicación de diseño; lo que sí está medido es que el banco no oscila.)

| Constante | Valor | Qué es |
|---|---:|---|
| `GAP` | 0,25 m | el hueco que se busca |
| `GAIN` | 0,3 rad por metro | cuánto se desvía el rumbo por cada metro de error |
| `LIMIT` | 0,4 rad (23°) | el desvío nunca pide más que esto |

`inner` es el hueco medido (`scene.left` del paso 3). `sign` vale +1 si la isla está a la izquierda (vuelta antihoraria) y -1 si está a la derecha. La ley de rumbo es la del paso 2; no la reescribes, solo le cambias la meta.

Un ejemplo: el coche está a 0,45 m de la isla, el error es 0,20 m y el desvío es `0,3 * 0,20 = 0,06 rad` (3,4°) hacia la isla. A 0,25 m el desvío es 0 y el coche sigue recto. Si el hueco fuera de 5 m (un error de lectura, por ejemplo), pediría `0,3 * 4,75 = 1,4 rad` (82°): para eso está `LIMIT`.

### Por qué converge sin oscilar

Con ángulos pequeños, el coche se acerca a la isla a `v * desvío`, es decir, `v * GAIN * error`. Eso es una caída exponencial: el error se divide entre `e` (2,718) cada `1 / (v * GAIN)` segundos. Con la velocidad real de 0,42 m/s (comando 0,6) son unos 7,9 s; con 0,60 m/s (comando 1,28, el de Gazebo en este paso) son unos 5,6 s. En el banco el hueco solo baja y nunca se pasa del objetivo (la última prueba lo exige).

Es lenta, y es a propósito: una ganancia pequeña es segura. En el banco de pruebas de Python (mini simulador, velocidad 0,6 de comando, hueco inicial 0,45 m, el hueco se lee exacto) la referencia da:

| Tiempo | 0 s | 2 s | 5 s | 10 s | 14 s |
|---|---:|---:|---:|---:|---:|
| Hueco | 0,450 | 0,412 | 0,360 | 0,309 | 0,287 |

Nunca baja de 0,287 m: se acerca desde fuera y no se pasa.

### Cambia `GAIN` y mide

Mismo banco, hueco inicial 0,45 m, hueco a los 5 s, a los 14 s y el mínimo:

| `GAIN` | a los 5 s | a los 14 s | mínimo | Comentario |
|---:|---:|---:|---:|---|
| 0 | 0,450 m | 0,456 m | 0,450 m | nunca corrige |
| **0,3** | 0,360 m | 0,287 m | 0,287 m | lento y sin pasarse |
| 1,0 | 0,272 m | 0,252 m | 0,252 m | llega mucho antes |
| 3,0 | 0,250 m | 0,251 m | 0,249 m | llega casi al instante |

En el mini, más ganancia es mejor. La guía anterior probó en el Open lab (6 rondas por caso, no repetidas en Gazebo con este curso) `GAIN = 1,0` con 6 de 6 rondas válidas y tiempos casi iguales, y `GAIN = 3,0` con 5 de 6, una inválida porque el coche rozó la isla. El mini lee el hueco exacto y el laboratorio usa el LiDAR con ruido; no he aislado si eso explica la diferencia. Entonces, ¿por qué 0,3? Nadie midió otras ganancias en Gazebo con el coche completo: es un valor probado, no el mejor.

### Qué hace el nodo con esto

Dos detalles de `drive.py`. Si la isla no se ve (`left` es `inf`), el nodo usa `GAP` como medida y el desvío es 0: sin dato, no se corrige. Y `perceive` recibe ahora un `forward_yaw` real: `wrap(0.0 - heading.yaw)`, la dirección de la pista (rumbo 0) vista desde el coche. Así `front_axis` mide a lo largo de la pista aunque el coche vaya un poco torcido por la corrección. El paro es el del paso 3, pero a 1,19 m (`TURN_FRONT`, el valor con el que la puerta de giro del paso 6 decidirá cuándo empezar una esquina) y con el comando 1,28, que es lo que el coche usará en la ronda.

## Prueba la ley

Este widget es el mismo banco de Python portado a JavaScript, con el servo real del coche, a velocidad de comando 0,6. La línea violeta del dibujo es hacia dónde apunta la ley (`meta + lateral_bias`); la segunda gráfica muestra ese desvío en grados a lo largo del tiempo, con la línea de `LIMIT`.

<div data-widget="lane"></div>

Los botones de **Prueba esto** cargan los valores de cada experimento. En este orden:

1. **GAIN 0**: el desvío es 0 siempre y el coche se queda donde salió.
2. **GAIN 1,0**: el hueco entra en ±2 cm en unos 5 s (el banco de Python da 5,2 s; el widget tiene su propio ruido de giroscopio y puede diferir un poco). Con 0,3 no llega a ±2 cm en 14 s.
3. **Lejos, LIMIT 0,40**: con el hueco inicial en 0,80 m, la ley pide `0,3 * 0,55 = 0,165 rad` y no llega al límite de 0,4, así que `LIMIT` no actúa. A los 14 s el hueco es unos 0,35 m.
4. **Lejos, LIMIT 0,05**: el límite recorta el desvío (la línea roja es lo que pediría la ley y la violeta lo que se aplica) y a los 14 s el hueco sigue en unos 0,52 m. Esas dos cifras, 0,35 y 0,52, salen del banco de Python.

También puedes mover los cuatro deslizadores a mano y el instante con **Instante**.

> **Antes de escribirlo, juega un rato.** Ve pegado a la isla, a 25 cm. El simulador muestra el hueco y una banda verde de 20 a 30 cm: intenta no salirte de ella. ¿Cuánto y hacia dónde corriges el volante cada vez que el hueco cambia?
>
> [Abrir el simulador con el reto de este paso](/learn/open-strategy/simulador/?paso=4)

## Escríbelo

> **En este paso**
> Escribes: `lane.py` (un archivo, 2 funciones pequeñas: `lateral_bias` y `lane_steer`).
> Copias hecho: `drive.py`, el nodo que habla con ROS; no hace falta entenderlo todavía.

Desde la raíz del repositorio, copia el nodo de la referencia del paso 4 (necesitas el `git fetch --tags` del paso 0):

```bash
git show step-4:src/my_open/my_open/drive.py > src/my_open/my_open/drive.py
```

### Paso 4.1: cuánto desviar la meta

Es como una cuesta: cuanto más lejos estás del hueco buscado, más apuntas hacia la isla, pero con un tope para no dar un volantazo. `inner` es el hueco medido (`scene.left`) y `sign` vale +1 con la isla a la izquierda y -1 a la derecha.

Crea `src/my_open/my_open/lane.py` y pega esto (imports y un marcador, ya hechos):

```python
"""Step 4 - The lane: stay at a fixed distance from the island wall."""
from robotek_course.minisim import clamp
from .heading import heading_steer


def lane_steer(goal, yaw, inner, sign=1): return 0.0  # marcador
```

Y debajo, este esqueleto con sus tres constantes:

```python
GAP = 0.25     # m: el hueco que se busca
GAIN = 0.3     # rad de desvío por cada metro de error
LIMIT = 0.4    # rad (23°): el desvío nunca pide más que esto

def lateral_bias(inner, sign=1, gap=GAP):
    ...
```

**Qué va dentro:** el error es `inner - gap` (positivo si estás más lejos de la isla de lo debido). Multiplícalo por `GAIN` y por `sign`, y limita el resultado entre `-LIMIT` y `LIMIT` con `clamp`.

```bash
python -m pytest course/tests/test_step_4.py -q -k "no_offset_at_the_wanted_gap or too_far or offset_is_limited"
```

Debes ver `3 passed`: sin desvío en el hueco buscado, más lejos apunta hacia la isla, y con el hueco en 5 m el desvío se queda en 0,4 rad.

<details>
<summary>Ver la solución de este paso</summary>

```python
GAP = 0.25            # m kept from the island wall
GAIN = 0.3            # rad of heading offset per metre of gap error
LIMIT = 0.4           # rad: the offset never asks for more than this


def lateral_bias(inner, sign=1, gap=GAP):
    """Heading offset that moves the car to ``gap`` from the island wall.

    ``inner`` is the measured distance to the island wall; ``sign`` is +1 when the island is on the left (counter-
    clockwise lap) and -1 when it is on the right. Farther than ``gap``: aim a little towards the island.
    """
    return clamp(sign * GAIN * (inner - gap), -LIMIT, LIMIT)
```

</details>

### Paso 4.2: girar hacia la meta desplazada

Ya tienes la ley de rumbo del paso 2, que sabe llevar el coche a un rumbo meta. Solo le cambias la meta: la de siempre más el desvío. Reemplaza el marcador `lane_steer` por:

```python
def lane_steer(goal, yaw, inner, sign=1):
    """The heading law of step 2, aimed at the goal heading plus the lateral offset."""
    ...
```

**Qué va dentro:** llama a `heading_steer` con la meta `goal + lateral_bias(inner, sign)` y el rumbo actual `yaw`.

```bash
python -m pytest course/tests/test_step_4.py -q -k "steering_adds or mirrors"
```

Debes ver `2 passed`: con el hueco en el valor buscado el volante vale 0, y con la isla a la derecha todo es el espejo.

<details>
<summary>Ver la solución de este paso</summary>

```python
def lane_steer(goal, yaw, inner, sign=1):
    """The heading law of step 2, aimed at the goal heading plus the lateral offset."""
    return heading_steer(goal + lateral_bias(inner, sign), yaw)
```

</details>

## Pruébalo en el simulador

Primero todas las pruebas, que incluyen un banco de 14 s donde el coche se acerca al hueco sin oscilar:

```bash
python -m pytest course/tests/test_step_4.py -q
```

Debes ver `6 passed`. Ahora con Gazebo, sin ventana (en macOS mira el paso 0 para el prefijo de `colcon` y el `source`):

```bash
colcon build --symlink-install --packages-select my_open && source install/setup.bash
```

Debe terminar sin errores. Luego:

```bash
python3 course/verify_step.py 4
```

Debe terminar con `PASS`. Usa el campo de la isla de 9 m, publica Start y mide el hueco cuando llega la orden de parar: debe estar entre 0,20 y 0,31 m, sin tocar ninguna pared. La referencia midió 0,270, 0,241 y 0,265 m; el tuyo puede variar unos milímetros por el ruido.

### Rómpelo

1. Predice: con `GAIN = 0`, ¿qué hueco tendrá el coche a los 14 s si sale a 0,45 m? Compruébalo con el botón **GAIN 0** del widget: no corrige y se queda en 0,456 m.
2. En `lateral_bias`, quita el `clamp` y corre las pruebas. Solo falla `test_the_offset_is_limited`: con el hueco en 5 m pide `0,3 * 4,75 = 1,4 rad` (82°). Deshaz el cambio.

## Si algo falla

- **El coche se acerca a la isla cuando debería alejarse, o al revés.** Revisa el signo: con el coche más lejos de lo debido (`inner > gap`) y `sign = +1`, el desvío debe ser positivo.
- **En el campo normal el hueco no llega a 0,25 m.** Es lo esperado: la isla normal mide 1 m y la ley necesita metros. Usa `verify_step.py 4`.
- **Pasan las pruebas pero el coche choca en Gazebo, o `verify_step.py` dice que ya hay un `gz sim` en marcha.** Las pruebas leen el hueco exacto y Gazebo lo da el LiDAR: revisa la percepción del paso 3. Si hay otro simulador abierto, ciérralo o usa `--wait 60`.

## Resumen

- La ley de carril no gira el volante según el hueco: desplaza la meta del rumbo `GAIN * (inner - GAP)` radianes, limitada a `LIMIT`, y la ley de rumbo del paso 2 la sigue.
- Con `GAIN = 0,3` el hueco baja de forma exponencial, lenta y sin pasarse. Más ganancia llega antes en el mini, pero no está medida en Gazebo.
- Esta comprobación usa una isla larga de 9 m; para comparar tu `lane.py` con la referencia: `bash tools/compare-step.sh 4`.

## Antes de seguir

- [ ] `pytest` marca `6 passed` y `verify_step.py 4` termina en `PASS` con un hueco entre 0,20 y 0,31 m.
- [ ] Sabes decir qué hace `LIMIT` y qué verías sin él.
- [ ] Predijiste el hueco con `GAIN = 0` y lo comprobaste en el widget.

<details>
<summary>Para curiosos: cómo funciona drive.py</summary>

`drive.py` es el mismo nodo del paso 3 con cuatro cambios, que explica la sección «Qué hace el nodo con esto» de arriba:

- `on_scan` pasa a `perceive` el `forward_yaw` real, `wrap(0.0 - self.heading.yaw)`, para medir `front_axis` a lo largo de la pista aunque el coche vaya torcido.
- En `control`, la isla está a la izquierda: si `left` es finito, `inner = self.scene.left`; si no, usa `GAP` y el desvío es 0. Conduce con `lane_steer(0.0, yaw, inner, sign=1)`.
- Se detiene cuando `front_axis` baja de `TURN_FRONT` (1,19 m), con enclavamiento como en el paso 3.
- La velocidad sube a `SPEED = 1.28` (comando; el coche real alcanza 0,6 m/s) y el nodo ya no publica `/scene`.

Para leerlo, abre `src/my_open/my_open/drive.py`.

</details>
