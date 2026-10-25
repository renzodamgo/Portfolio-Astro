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

## Escríbelo

1. **Crea `src/my_open/my_open/lane.py`** con las constantes `GAP`, `GAIN` y `LIMIT`, y las dos funciones `lateral_bias(inner, sign=1, gap=GAP)` y `lane_steer(goal, yaw, inner, sign=1)`.
2. **Edita `drive.py`** (el del paso 3): importa `wrap`, `GAP` y `lane_steer`; cambia `STOP_FRONT` por `TURN_FRONT = 1.19` y `SPEED` a 1,28; pasa a `perceive` el `forward_yaw` real; y en `control` conduce con `lane_steer`.

**Pistas para `lateral_bias`.**

1. El error es `inner - gap`: positivo si estás más lejos de la isla de lo debido.
2. Multiplícalo por `GAIN` y por `sign`.
3. Limita el resultado a `[-LIMIT, LIMIT]` con `clamp` (de `robotek_course.minisim`).

**Pista para `lane_steer`.** Es la ley de rumbo `heading_steer` del paso 2, con la meta desplazada: `goal + lateral_bias(inner, sign)`.

**Pistas para `drive.py`.**

1. En `on_scan`, el `forward_yaw` es `wrap(0.0 - self.heading.yaw)`.
2. En `control`, la isla está a la izquierda: `inner = self.scene.left` si es finito y `GAP` si no.
3. El paro es `self.stopped or self.scene.front_axis <= TURN_FRONT`, con enclavamiento como en el paso 3.

Antes de mirar la referencia, corre las pruebas.

<details>
<summary>Ver la referencia de lane.py</summary>

```python
"""Step 4 - The lane: stay at a fixed distance from the island wall."""
from robotek_course.minisim import clamp
from .heading import heading_steer

GAP = 0.25            # m kept from the island wall
GAIN = 0.3            # rad of heading offset per metre of gap error
LIMIT = 0.4           # rad: the offset never asks for more than this


def lateral_bias(inner, sign=1, gap=GAP):
    """Heading offset that moves the car to ``gap`` from the island wall.

    ``inner`` is the measured distance to the island wall; ``sign`` is +1 when the island is on the left (counter-
    clockwise lap) and -1 when it is on the right. Farther than ``gap``: aim a little towards the island.
    """
    return clamp(sign * GAIN * (inner - gap), -LIMIT, LIMIT)


def lane_steer(goal, yaw, inner, sign=1):
    """The heading law of step 2, aimed at the goal heading plus the lateral offset."""
    return heading_steer(goal + lateral_bias(inner, sign), yaw)
```

</details>

<details>
<summary>Ver la referencia de los cambios en drive.py (solo lo que cambia)</summary>

La referencia de este paso deja de publicar `/scene` y `/scene_markers` (ya cumplieron su función; puedes conservarlos si te sirven). Los cambios que importan:

```python
from robotek_course.minisim import Scene, wrap
from .lane import GAP, lane_steer

SPEED = 1.28              # m/s commanded (the real car reaches 0.6 m/s with this command)
TURN_FRONT = 1.19         # m: where a corner will start (step 6); for now the car stops here
```

`on_scan` usa el rumbo estimado:

```python
def on_scan(self, msg):
    stamp = (msg.header.stamp.sec, msg.header.stamp.nanosec)
    if stamp != self.stamp:              # each scan once
        self.stamp = stamp
        self.scene = perceive(msg, forward_yaw=wrap(0.0 - self.heading.yaw), sign=1)
```

Y en `control`, la parte final:

```python
yaw = self.heading.update(self.gyro, dt)
self.stopped = self.stopped or self.scene.front_axis <= TURN_FRONT
if not self.stopped:
    inner = self.scene.left if math.isfinite(self.scene.left) else GAP     # the island is on the left
    speed, steer = SPEED, lane_steer(0.0, yaw, inner, sign=1)
```

</details>

## Pruébalo

Pruebas sin ROS ni Gazebo:

```bash
python3 -m pytest course/tests/test_step_4.py -q
```

Son 6 pruebas: sin desvío cuando el hueco es el buscado; más lejos apunta hacia la isla y más cerca apunta hacia fuera; el desvío tiene límite; con la isla a la derecha todo es el espejo; el volante suma el desvío al rumbo meta; y en un banco de 14 s el coche se acerca al hueco buscado (termina por debajo de 0,31 m), nunca baja de 0,20 m y solo se acerca, sin oscilar.

Si cambias `GAIN` en `lane.py` para probar otras ganancias, `test_a_car_too_far_aims_towards_the_island_and_one_too_close_aims_away` falla: comprueba el valor `0,3 * 0,20`. Es esperado; devuelve `GAIN` a 0,3 cuando termines.

Ahora en Gazebo, sin ventana:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash        # en macOS: source tools/macos_env.sh ~/robotek-ros/jazzy
python3 course/verify_step.py 4
```

El comprobador genera el campo con la isla de 9 m (la isla va de x = -0,5 a 9,0 m y la pared del este está a 10 m), lanza el simulador y tu nodo, publica Start y registra la pose real del coche, que tu nodo nunca ve. Mide el hueco cuando llega la orden de parar y exige:

- que el coche se pare antes de la pared de enfrente;
- que el hueco esté entre 0,20 y 0,31 m (la ley pide 0,25 m);
- que desde la mitad del recorrido hasta el final nunca baje de 0,20 m;
- que no toque ninguna pared.

Debe terminar con `PASS`. La referencia midió un hueco de 0,270, 0,241 y 0,265 m en tres ejecuciones, tras recorrer unos 8,7 m (unos 15 s de simulación a 0,6 m/s, tiempo suficiente para que la ley cierre el error). El banco de Python, con el mismo comando 1,28 y 0,5 m de hueco inicial, da 0,271 m a los 15 s y 0,265 m a los 20 s (ahí el hueco se lee exacto, no por LiDAR). Los dos coinciden: entre 0,24 y 0,27 m.

¿Por qué no probarlo en el campo normal? Con la geometría del campo, el coche arranca con la pared de enfrente a `1,5 - 0,128 = 1,372 m` del LiDAR y recibe la orden de parar a 1,19 m, es decir, tras 18 cm. Luego todavía rueda de 0,7 a 1 m hasta detenerse. Es normal: no hay forma de ver aquí la convergencia sin la isla larga.

### Rómpelo

Antes de tocar nada, **predice**: con `GAIN = 0`, ¿qué hueco tendrá el coche a los 14 s si sale a 0,45 m? Pruébalo con el botón **GAIN 0** del widget. El coche no corrige y se queda donde salió (0,456 m en el banco).

Para probarlo en el código:

1. En `lateral_bias`, quita el `clamp` y corre las pruebas. Falla solo `test_the_offset_is_limited`: con el hueco en 5 m pide `0,3 * 4,75 = 1,4 rad` (82°) y el coche daría un volantazo hacia la isla.
2. Deshaz el cambio. Invierte el signo del error (`gap - inner` en vez de `inner - gap`). Fallan cuatro pruebas, entre ellas la del banco de 14 s: el coche huiría de la isla en vez de acercarse.

## Si algo falla

- **El coche se acerca a la isla en vez de alejarse (o al revés).** Revisa el signo: si el coche está más lejos de lo debido (`inner > gap`), el desvío debe ser positivo con `sign = +1`, y la ley de rumbo gira a la izquierda con un `goal` positivo.
- **El coche no corrige nunca.** Mira que el nodo pase `inner` y no un valor fijo. Si `left` es `inf` el nodo usa `GAP` y el desvío es 0: comprueba con `ros2 topic echo /scene` (si conservas la publicación del paso 3) que `left` sea finito.
- **El coche corrige, pero en el campo normal no llega a 0,25 m.** Es lo esperado: con `GAIN = 0,3` hacen falta metros y la isla normal tiene 1 m. Usa `verify_step.py 4`.
- **El coche oscila.** Con `GAIN` entre 0,3 y 1,0 el banco no oscila. Si te oscila, sospecha de `forward_yaw` o del signo, no de la ganancia.
- **Tu hueco final no es exactamente 0,270 m.** No es un fallo si queda dentro de 0,20 a 0,31 m y el coche no toca nada: el ruido del LiDAR y del giroscopio cambia unos milímetros de una ejecución a otra (la referencia dio 0,241 en una).
- **`verify_step.py` dice que ya hay un `gz sim` en marcha.** Cierra el otro Gazebo o usa `--wait 60` para esperar a que termine.
- **Pasan las pruebas pero el coche choca en Gazebo.** Las pruebas leen el hueco exacto; en Gazebo lo da el LiDAR. Revisa la percepción del paso 3.

## Compara

```bash
bash tools/compare-step.sh 3 4     # qué añade la referencia
bash tools/compare-step.sh 4       # tu árbol contra el paso 4
```

## Resumen

- La ley de carril no gira el volante según el hueco: desplaza la meta del rumbo `GAIN * (inner - GAP)` radianes (limitada a `LIMIT`) y deja que la ley de rumbo del paso 2 la siga.
- Con `GAIN = 0,3` el hueco baja de forma exponencial con una constante de unos 5,6 s a la velocidad real: es lenta y no se pasa. Más ganancia llega antes en el mini, pero no está medida en Gazebo.
- Esta comprobación usa una isla larga de 9 m; en el campo normal la isla es demasiado corta para ver la convergencia.

## Antes de seguir

- [ ] `pytest` marca `6 passed` y `verify_step.py 4` termina en `PASS` con un hueco entre 0,20 y 0,31 m.
- [ ] Sabes decir qué hace `LIMIT` y qué verías sin él.
- [ ] Predijiste el hueco con `GAIN = 0` y lo comprobaste en el widget.
