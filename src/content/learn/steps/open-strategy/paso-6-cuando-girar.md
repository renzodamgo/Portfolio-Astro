---
guide: "open-strategy"
order: 6
slug: "paso-6-cuando-girar"
title: "Cuándo girar"
summary: "Decide el momento exacto de iniciar el giro."
tag: "step-6"
compareFrom: "step-5"
---

En el paso 5 la esquina empezaba con una regla fija: la pared de enfrente a 1,19 m. Una sola condición se equivoca con facilidad. En este paso escribes `TurnGate` (la puerta), que decide **cada tick** (cada ejecución del control, 50 veces por segundo) si es el momento de girar. La conexión con `drive.py` y con la distancia recorrida, que sale del LiDAR, te la damos hecha. Al terminar, el coche gira esquina tras esquina alrededor de la isla.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/Ht48vv0rQYk" title="EEVblog #941 - Schmitt Trigger Tutorial" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>EEVblog #941 - Schmitt Trigger Tutorial</strong> · EEVblog (inglés). Histéresis y dos umbrales contra el ruido: es electrónica, pero la puerta de giro usa la misma idea.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

En Gazebo el coche sigue la pared de la isla, gira a la izquierda en cada esquina y vuelve a seguir la pared, sin parar. En la terminal del nodo aparece `Giro a la izquierda (esquina N)` en cada giro. El sentido sigue fijo, antihorario: la cámara que lo decide llega en el paso 8. El comprobador lo deja correr 40 s de simulación y exige **al menos 8 esquinas** (dos vueltas) sin tocar ninguna pared.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-6.json"></div>

*Repetición del mini simulador (no es Gazebo): en cada esquina la puerta dispara y el coche sigue dando vueltas. Los textos de abajo dicen qué vio la puerta en cada una.*

## La idea

### Girar a destiempo es el error más caro

Si el coche gira demasiado pronto, se come la isla. Si gira demasiado tarde, choca con la pared de enfrente. Una sola medida no distingue bien: la pared de enfrente puede estar cerca mientras la isla todavía no terminó, y un rayo suelto del LiDAR puede engañar a cualquier medida. Por eso el coche gira solo cuando se cumplen **todas** estas condiciones a la vez:

| # | Condición | Valor | Para qué |
|---|---|---|---|
| 1 | La puerta está **armada** (`armed`) | ver abajo | no girar dos veces seguidas |
| 2 | El coche avanzó desde la esquina anterior (`travelled`) | `ARM_DISTANCE = 0.25` m o más | no girar dos veces seguidas |
| 3 | La pared de enfrente, medida **a lo largo de la pista** (`scene.front_axis`), está cerca | `TURN_FRONT = 1.19` m o menos | no girar demasiado pronto |
| 4 | La isla **terminó**, de una de dos maneras: el lado de la isla está abierto (`inner` más lejos que `ISLAND_OPEN = 1.0` m), o se vio su final cerca (`scene.island_end` entre 0 y `LOOKAHEAD = 0.35` m) en `CONFIRMATIONS = 2` escaneos distintos seguidos | ver abajo | no comerse la isla, y no fiarse de un solo escaneo |
| 5 | No hay una esquina en curso | `arc` es `False` | una esquina a la vez |

`inner` es la distancia al lado de la isla (`scene.left` cuando la isla está a la izquierda) y `island_end` es dónde termina la pared de la isla, medido hacia delante desde el coche (paso 3).

Dos detalles de la condición 4:

- Si el lado de la isla está abierto, no hace falta ver su final: ya terminó.
- En un pasillo estrecho el final de la isla tiene que estar más cerca que `LOOKAHEAD`. El límite pasa a ser `min(LOOKAHEAD, inner - END_CLEARANCE)`, con `END_CLEARANCE = 0.08` m. Con la isla a 0,30 m el límite baja a 0,22 m, así que un final visto a 0,30 m no cuenta. Con el coche a 0,25 m de la isla (la distancia normal del carril) el límite es 0,17 m.

### Armar y desarmar la puerta

Al empezar una esquina, el nodo llama a `corner_started()` y la puerta queda **cerrada** (`armed = False`). Se vuelve a armar cuando el coche ya no está en una esquina, recorrió al menos 0,25 m desde la anterior y ve la isla de nuevo (`inner` es finito y menor que `ISLAND_OPEN`). Es decir: hasta que el coche no está otra vez en una recta junto a la isla, no puede girar. La primera vez la puerta está armada.

### Un escaneo cuenta una vez

El control corre a 50 Hz y el LiDAR entrega 10 escaneos por segundo, así que el mismo escaneo llega 5 ticks seguidos. Si la puerta contara 5 veces el mismo escaneo, creería que vio el final de la isla en 5 escaneos distintos y la confirmación de 2 escaneos no serviría de nada.

La puerta cuenta una vez por **objeto** `Scene`, no por valor: `perceive` crea una escena nueva por escaneo y el nodo solo la crea cuando cambia la marca de tiempo. La puerta lo comprueba con `scene is not self._scene`.

### Pruébalo con el widget

El widget lleva el coche por el pasillo sur y alimenta a `TurnGate` (el mismo código del paso) con lo que `perceive` ve en cada escaneo. Arrastra el coche, o avanza escaneo por escaneo, y mira cuándo se enciende cada condición. Cuatro intentos guiados reproducen lo de arriba: el carril normal y el ancho, un escaneo perdido y el error de contar por tick. **Antes de pulsar cada intento, predice en qué escaneo girará.**

<div data-widget="turn-gate"></div>

Para mirar tú mismo:

1. ¿Qué decide el giro en el carril normal (0,25 m)? ¿Y en el carril ancho (0,60 m)?
2. En el carril ancho, pierde el final de la isla en el escaneo 22 (ve a él con el deslizador y pulsa «Perder el final»). ¿Cuánto se retrasa el giro? ¿Y si lo pierdes en el 23?

<details>
<summary>Ver lo que sale</summary>

1. En el carril normal decide el lado abierto (`inner > ISLAND_OPEN`, en x = 0,42 m): el límite de 0,17 m deja ver el final cerca en un solo escaneo, no en dos. En el carril ancho decide la confirmación: en x = 0,24 m la pared baja de 1,19 m y `hits` llega a 2 en el mismo escaneo, antes de que el lado se abra.
2. Perdido en el 22, gira un escaneo más tarde (6 cm), porque `hits` vuelve a 0 y necesita dos escaneos buenos más. Perdido en el 23, gira dos escaneos más tarde (12 cm).

</details>

### La distancia recorrida: LiDAR, no encoder

La condición 2 necesita saber cuántos metros avanzó el coche, y el coche no tiene encoder. `LidarOdometry` (de `robotek_common`, ya hecha) lo calcula alineando escaneos consecutivos: la rotación sale del giroscopio y la traslación se ajusta contra las paredes, que son rectas. Si un escaneo no se puede alinear, usa la velocidad ordenada con un límite de aceleración (`DISTANCE_MODEL_ACCEL = 2.0`). En el nodo se usa así:

- en `on_scan`: `self.odometry.scan(msg, self.heading.yaw)`;
- en cada tick: `moved = self.odometry.read()` (metros desde la lectura anterior) y `self.travelled += max(0.0, moved)`;
- al final del tick: `self.odometry.command(speed, dt)`;
- al acabar una esquina, `self.travelled = 0.0`.

### Sin offset en la esquina

En el paso 4 la ley de carril empuja al coche hacia la isla si está más lejos de 0,25 m. Cuando la isla termina, el lado queda abierto o sin pared, y esa ley pediría girar hacia donde no hay nada. Por eso, si `inner` no es finito o es mayor que `ISLAND_OPEN`, se usa `GAP` como distancia: error cero y sin desvío.

> **Antes de escribirlo, juega un rato.** Gira cuando tú creas que toca, mirando el número de frente. El código usa 1,19 m. Prueba a girar antes y después, y mira qué pasa con la esquina. ¿Qué distancia te da mejor resultado?
>
> [Abrir el simulador con el reto de este paso](/learn/open-strategy/simulador/?paso=6)

## Escríbelo

> **En este paso**
> - **Escribes:** un solo archivo, `turn_gate.py`, con una clase `TurnGate` (la puerta) y 2 métodos pequeños, en 6 mini pasos.
> - **Copias hecho:** `drive.py`, la parte de ROS, que ya conecta la puerta con la distancia recorrida. No hace falta entenderlo todavía.
> - **Resultado:** el coche gira esquina tras esquina alrededor de la isla.

Copia `drive.py` desde la raíz del repositorio (si no tienes las etiquetas, antes `git fetch --tags`):

```bash
git show step-6:src/my_open/my_open/drive.py > src/my_open/my_open/drive.py
```

Cada mini paso termina con una prueba (en macOS con RoboStack pon `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` delante de `python`). La puerta es una clase: un objeto que recuerda cosas entre un tick y el siguiente. Su método `update` responde `True` cuando toca girar. Recibe `scene` (lo que el coche ve en un escaneo), `inner` (distancia a la isla), `travelled` (metros desde la última esquina) y `arc` (hay una esquina en curso).

### Paso 6.1: las tres preguntas fáciles

Primero lo más simple: tres preguntas de sí o no, como mirar a los dos lados y la distancia antes de cruzar. Son las condiciones 2, 3 y 5 de la tabla.

Crea `src/my_open/my_open/turn_gate.py` y pega esto. La primera constante es la distancia a la pared de enfrente que dispara el giro; la segunda, lo que debe avanzar el coche tras una esquina.

```python
TURN_FRONT = 1.19        # m
ARM_DISTANCE = 0.25      # m


class TurnGate:
    def __init__(self, turn_front=TURN_FRONT):
        self.turn_front = turn_front

    def update(self, scene, inner, travelled, arc):
        """Returns True when the corner should start now."""
        return False  # TODO
```

- **Qué va dentro:** devuelve verdadero si no hay esquina en curso (`not arc`), `travelled` es al menos `ARM_DISTANCE` y `scene.front_axis` (la pared de enfrente) es como mucho `self.turn_front`. Une las tres con `and`.
- **Compruébalo:** `python -m pytest course/tests/test_step_6.py -q -k "wall_ahead or driven or in_progress or open_side"` debe dar `4 passed`.

<details>
<summary>Ver la solución de este paso</summary>

Versión parcial: las líneas de la referencia que ya toca escribir (la clase completa está en el 6.6).

```python
        return (not arc and travelled >= ARM_DISTANCE
                and scene.front_axis <= self.turn_front)
```

</details>

### Paso 6.2: la isla terminó (lado abierto)

Si la pared de la isla queda a más de 1 m, a tu lado ya no hay isla: es como llegar al final de una valla. Es la primera manera de cumplir la condición 4.

Pon `import math` al principio del archivo, la constante después de `ARM_DISTANCE`, y una línea nueva en `update`:

```python
ISLAND_OPEN = 1.0        # m

        island_open = False  # TODO (antes del return)
```

- **Qué va dentro:** `island_open` es verdadero si `inner` es un número finito (`math.isfinite`) y mayor que `ISLAND_OPEN`. Añádelo con `and` al final del `return`.
- **Compruébalo:** `python -m pytest course/tests/test_step_6.py -q -k "open_side or wall_ahead"` debe dar `2 passed`.

<details>
<summary>Ver la solución de este paso</summary>

Versión parcial (la clase completa está en el 6.6):

```python
        island_open = math.isfinite(inner) and inner > ISLAND_OPEN
        return (not arc and travelled >= ARM_DISTANCE
                and scene.front_axis <= self.turn_front
                and island_open)
```

</details>

### Paso 6.3: ver el final de la isla dos veces

La otra manera de saber que la isla terminó es verle el final cerca. Un rayo del LiDAR puede equivocarse, así que se exige verlo en **2 escaneos seguidos**, como confirmar una duda antes de actuar.

Añade dos constantes junto a las otras, cambia el `__init__` y pon la primera línea de `update`:

```python
LOOKAHEAD = 0.35         # m: el final de la isla debe estar a esta distancia o menos
CONFIRMATIONS = 2        # escaneos seguidos que deben verlo

    def __init__(self, turn_front=TURN_FRONT, lookahead=LOOKAHEAD):
        self.turn_front, self.lookahead = turn_front, lookahead
        self.hits = 0
        self.hits = ...  # TODO (primera línea de update)
```

- **Qué va dentro:** `hits` cuenta los escaneos seguidos con el final cerca. Sube 1 si `0.0 <= scene.island_end <= self.lookahead` (`island_end` es dónde termina la isla, hacia delante); si no, vuelve a 0. El último `and` del `return` pasa a `(island_open or self.hits >= CONFIRMATIONS)`.
- **Compruébalo:** `python -m pytest course/tests/test_step_6.py -q -k "all_conditions or lost_sighting or island_must"` debe dar `3 passed`. La prueba `same_scan` falla ahora: es normal, la arregla el 6.4.

<details>
<summary>Ver la solución de este paso</summary>

Versión parcial (la clase completa está en el 6.6):

```python
        self.turn_front, self.lookahead = turn_front, lookahead
        self.hits = 0

        self.hits = self.hits + 1 if 0.0 <= scene.island_end <= self.lookahead else 0
                and (island_open or self.hits >= CONFIRMATIONS))
```

</details>

### Paso 6.4: un escaneo cuenta una vez

El control corre a 50 Hz y el LiDAR da 10 escaneos por segundo: el mismo escaneo llega 5 ticks seguidos. Si lo cuentas 5 veces, "2 escaneos" se cumplen con uno solo. Es como contar goles viendo la repetición.

Añade una línea al `__init__` y mete la cuenta de `hits` dentro de un `if`:

```python
        self._scene = None

        if True:  # TODO: la cuenta de hits va aquí dentro
            self._scene = scene
```

- **Qué va dentro:** cada escaneo es un objeto `Scene` nuevo. La condición es `scene is not self._scene` (pregunta si es *otro objeto*, no si tiene otros números). Dentro del `if`, guarda la escena y deja la línea de `hits`.
- **Compruébalo:** `python -m pytest course/tests/test_step_6.py -q -k same_scan` debe dar `1 passed`.

<details>
<summary>Ver la solución de este paso</summary>

Versión parcial (la clase completa está en el 6.6):

```python
        self._scene = None

        if scene is not self._scene:                 # one count per scan, however often the tick repeats
            self._scene = scene
            self.hits = self.hits + 1 if 0.0 <= scene.island_end <= self.lookahead else 0
```

</details>

### Paso 6.5: el pasillo estrecho

Si la isla está muy cerca del coche, un final "lejano" ya no vale: el coche se la comería. El límite baja: con la isla a 0,30 m es de 0,22 m.

Añade la constante junto a las otras y una línea nueva antes de la cuenta de `hits`:

```python
END_CLEARANCE = 0.08     # m: se resta a la distancia a la isla

            limit = self.lookahead  # TODO
```

- **Qué va dentro:** si `inner` es finito, `limit` es `min(self.lookahead, max(0.0, inner - END_CLEARANCE))`; si no, `self.lookahead`. Usa `limit` en lugar de `self.lookahead` en la línea de `hits`.
- **Compruébalo:** `python -m pytest course/tests/test_step_6.py -q -k narrow` debe dar `1 passed`.

<details>
<summary>Ver la solución de este paso</summary>

Versión parcial (la clase completa está en el 6.6):

```python
            limit = min(self.lookahead, max(0.0, inner - END_CLEARANCE)) if math.isfinite(inner) else self.lookahead
            self.hits = self.hits + 1 if 0.0 <= scene.island_end <= limit else 0
```

</details>

### Paso 6.6: armar y desarmar la puerta

Tras girar, la puerta se cierra para no girar dos veces. Se vuelve a abrir cuando el coche está otra vez en una recta junto a la isla, como un torniquete. Es la condición 1.

Cambia el `__init__`, la parte de arriba del `return`, y añade el método `corner_started`:

```python
        self.armed = True

        seen_again = False   # TODO (en update, antes del return)
        self.armed = self.armed  # TODO

    def corner_started(self):
        """Call it when the corner starts."""
        pass  # TODO
```

- **Qué va dentro:** `seen_again` es verdadero si `inner` es finito, menor que `ISLAND_OPEN` y `travelled >= ARM_DISTANCE`. Entonces `self.armed = self.armed or (seen_again and not arc)`. El `return` empieza ahora con `self.armed and`. `corner_started` pone `armed = False`.
- **Compruébalo:** `python -m pytest course/tests/test_step_6.py -q -k after_a_corner` debe dar `1 passed`.

<details>
<summary>Ver la solución de este paso</summary>

Es la clase completa de la referencia (sin su docstring largo).

```python
class TurnGate:
    def __init__(self, turn_front=TURN_FRONT, lookahead=LOOKAHEAD):
        self.turn_front, self.lookahead = turn_front, lookahead
        self.armed = True
        self.hits = 0
        self._scene = None

    def update(self, scene, inner, travelled, arc):
        """Returns True when the corner should start now."""
        if scene is not self._scene:                 # one count per scan, however often the tick repeats
            self._scene = scene
            limit = min(self.lookahead, max(0.0, inner - END_CLEARANCE)) if math.isfinite(inner) else self.lookahead
            self.hits = self.hits + 1 if 0.0 <= scene.island_end <= limit else 0
        seen_again = math.isfinite(inner) and inner < ISLAND_OPEN and travelled >= ARM_DISTANCE
        self.armed = self.armed or (seen_again and not arc)
        island_open = math.isfinite(inner) and inner > ISLAND_OPEN
        return (self.armed and not arc and travelled >= ARM_DISTANCE
                and scene.front_axis <= self.turn_front
                and (island_open or self.hits >= CONFIRMATIONS))

    def corner_started(self):
        """Call it when the corner starts: the gate stays shut until the island is seen again."""
        self.armed = False
```

</details>

## Pruébalo en el simulador

```bash
python -m pytest course/tests/test_step_6.py -q
colcon build --symlink-install --packages-select my_open && source install/setup.bash && python3 course/verify_step.py 6
```

- **Qué debes ver:** `10 passed` y después `Paso 6: PASS`, con `[OK] da al menos 8 esquinas` y `[OK] no toca ninguna pared`. La referencia dio unas 14 esquinas (3,7 vueltas) en 40 s.
- **En macOS** usa `source tools/macos_env.sh ~/robotek-ros/jazzy` en vez de `source install/setup.bash`.
- **Con ventana:** usa las tres terminales del paso 4 (simulador, tu nodo y Start). En la del nodo sale `Giro a la izquierda (esquina N)` en cada giro.

### Rómpelo

**Predice** qué prueba falla, cambia `turn_gate.py`, corre las pruebas y devuelve el cambio:

1. Cambia `if scene is not self._scene:` por `if True:`. Falla `test_the_same_scan_repeated_counts_once`. En el widget es «Contar en cada tick»: mira cómo gira un escaneo antes de tiempo.
2. Quita `self.armed and` del `return`. Falla la prueba de después de una esquina. En el widget es «Quitar armed».

## Si algo falla

- **Gira una vez y no vuelve a girar.** La puerta no se rearma. Mira que `seen_again` use `inner < ISLAND_OPEN` y que `travelled` vuelva a subir.
- **Gira dos veces seguidas o a destiempo.** Revisa que la cuenta use `scene is not self._scene` y que `corner_started` ponga `armed = False`.
- **`ImportError` al correr el nodo.** `drive.py` importa `TurnGate` e `ISLAND_OPEN` de `turn_gate.py`: los dos nombres deben existir.

Para comparar tu `turn_gate.py` con la referencia usa el cuadro «Compara» al final de la página.

## Resumen

- Una sola medida no basta para girar: la puerta exige armada, recorrido, pared cerca, isla terminada y ninguna esquina en curso, todo a la vez.
- Cada escaneo cuenta una vez (por objeto `Scene`); la isla terminada necesita lado abierto o 2 escaneos seguidos con el final cerca.
- Tras cada giro la puerta se cierra hasta ver la isla otra vez; la distancia recorrida sale del LiDAR.

## Antes de seguir

- [ ] `python -m pytest course/tests/test_step_6.py -q` da `10 passed`.
- [ ] `python3 course/verify_step.py 6` da `PASS`.
- [ ] Puedes decir qué prueba falla si cuentas la escena en cada tick, y por qué.

<details>
<summary>Para curiosos: cómo funciona drive.py</summary>

Es el nodo de ROS del paso 5 con tres cambios.

- Crea `TurnGate` y `LidarOdometry` (de `robotek_common`, ya hecha) y suma los metros avanzados en `self.travelled`, que vuelve a 0 al acabar cada esquina.
- Cada tick pregunta `self.gate.update(self.scene, inner, self.travelled, self.arc)` con `inner = self.scene.left`. Si da `True`, suma π/2 a `goal`, activa `arc` y llama a `corner_started()`.
- Si `inner` no es finito o es mayor que `ISLAND_OPEN`, la ley de carril usa `GAP` como distancia: así no se desvía hacia donde ya no hay isla. `odometry.command(speed, dt)` es lo último que se llama en `control`.

</details>
