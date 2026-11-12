---
guide: "open-strategy"
order: 7
slug: "paso-7-la-mision"
title: "La misión"
summary: "Encadena las tres vueltas y el final de la prueba."
tag: "step-7"
compareFrom: "step-6"
---

Hasta ahora tienes piezas sueltas: el rumbo, la ley de carril, la esquina y la puerta que decide cuándo girar. En este paso las unes en una **máquina de estados**: un programa que en cada momento está en un solo estado y solo cambia de estado por transiciones que tú defines. La tuya espera Start, da las tres vueltas (12 esquinas) y se detiene en la sección de salida. Al terminar tienes un coche que puntúa en Gazebo.

<!-- step-video:start -->
<figure class="learn-step-video">
<video controls muted playsinline preload="none" poster="/learn/videos/open/paso-7-la-mision.jpg"><source src="/learn/videos/open/paso-7-la-mision.mp4" type="video/mp4"></video>
<figcaption>Lo que este capítulo añade a la estrategia, en 42 s de animación sin sonido.</figcaption>
</figure>
<!-- step-video:end -->

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/4XEK7OU2gIw" title="Finite State Machines: Part 1" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Finite State Machines: Part 1</strong> · Barry Brown (inglés). Qué es una máquina de estados, con un robot de limpieza de ejemplo.</figcaption>
</figure>
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/NTEHRjiAY2I" title="How to Code a State Machine | Embedded System Project Series #26" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>How to Code a State Machine | Embedded System Project Series #26</strong> · Artful Bytes (inglés). Cómo se programa la máquina de estados de un robot.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

Con Gazebo abierto, la ronda tiene cuatro momentos:

1. **Quieto, unos 0,3 s.** Start ya llegó, pero el coche calibra el giroscopio y mide la pared de enfrente.
2. **Tres vueltas.** Sigue la pared de la isla, frena un poco antes de cada esquina y gira 90° hacia la isla (a la izquierda en `ccw`). En total, 12 giros en unos 35 s.
3. **Final.** Tras la esquina 12 avanza despacio hasta que la pared de enfrente está como estaba en Start, y frena.
4. **Resultado.** Unos 31 s después, con el coche ya quieto, el árbitro cierra la ronda e imprime los puntos.

La meta es **30 de 30 puntos** en sentido antihorario (`ccw`). El sentido va fijo en este paso: la cámara que lo decide llega en el paso 8.

> **Qué son los 30 puntos.** El tapete tiene 8 secciones alrededor de la isla y una vuelta pasa por las 8. El juez da 1 punto por cada sección de la que sale el coche (24 en tres vueltas), 3 por las tres vueltas y 3 por parar con todo el coche dentro de la sección de salida: 24 + 3 + 3. El detalle y la regla de «ronda válida» están en el paso 9.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-7.json"></div>


## La idea

### Palabras que vas a usar

| Palabra | Qué significa aquí |
|---|---|
| **Start** | la señal `/start` que publica el árbitro; el tiempo de la ronda se cuenta desde ahí |
| **Esquina** | un giro de 90° alrededor de la isla; la vuelta tiene 4 |
| **Vuelta** | 4 esquinas, que pasan por las 8 secciones del tapete |
| **Sección** | cada uno de los 8 cuadrados del tapete alrededor de la isla; la de salida es donde empieza el coche |
| **Ronda** | el intento completo: tres vueltas y la parada, medido desde Start |
| **Estado** | lo que la misión «está haciendo»: decide qué calcula `step()` en cada tick (50 veces por segundo) |
| **`Scene`** | los cinco números que sacas de cada escaneo del LiDAR (paso 3): `left`, `right`, `front_axis`, `island_end` y `wall_heading` |
| **Voto de la cámara** | `+1` (antihorario), `-1` (horario) o `0` (no sabe); llega en el paso 8 y en este paso es la variable `camera` |

### Tres estados y dos datos

Recorre una ronda completa estado por estado. Usa «Paso» para avanzar un evento: verás qué transición se toma, qué líneas de `mission.py` se ejecutan y qué velocidad pide la misión.

<div data-widget="state-machine"></div>

- **`SETUP`**: quieto. Espera Start, calibra el giroscopio, mide la pared de enfrente y espera el sentido. Sale a `RUN` cuando hay sentido, o a `STOP` si pasan 15 s sin sentido.
- **`RUN`**: la ley de rumbo de los pasos 2 a 6. Sale a `STOP` tras la esquina 12 y la parada.
- **`STOP`**: parada definitiva. Guarda el motivo y nunca sale.

Dentro de `RUN` no hay más estados. Solo hay dos datos: `completed` (esquinas hechas) y `arc` (si hay una en curso). El nombre que ve el resto del sistema (`label`: `FOLLOW`, `TURN`, `FINISH`, `DONE`...) se calcula a partir de ellos. Menos estados son menos casos que probar.

### La lógica es Python puro; el nodo es una envoltura

Tu estrategia corre en tres sitios: dentro del nodo de ROS de Gazebo, dentro del Open lab y dentro de tus pruebas con `pytest`. Por eso está dividida en tres capas:

| Archivo | Qué contiene | Usa ROS |
|---|---|---|
| `mission.py` | la máquina de estados, solo números y `Scene` | no |
| `strategy.py` | une la misión con los sensores (`StrategyBase`) | no |
| `drive.py` | el nodo: suscribe tópicos, llama a la estrategia, publica `/cmd_vel_raw` | sí |

Las pruebas de este paso construyen escenas a mano y llaman a `MiniMission.step`, sin simulador y sin ROS. En el nodo no hay decisiones: si algo falla en Gazebo, casi siempre puedes reproducirlo en una prueba.

### Lo que te da `StrategyBase`

`StrategyBase` (en `robotek_course`) hace dos cosas que no son el objetivo del curso:

- **Escaneos repetidos**: el mismo escaneo puede llegar varias veces con la misma marca de tiempo. La base lo usa una sola vez; `self.new_scan` vale `True` solo en el primer tick tras uno nuevo.
- **Esperar Start**: `request_start()` pone `started = True`. El nodo desactiva el arranque automático (`auto_start = False`) porque en Gazebo Start lo publica el árbitro. (En el Open lab el primer escaneo hace de Start.)

También pone `camera = 0` si el último voto tiene más de 0,5 s: un voto viejo no cuenta.

### El árbitro y el tópico `/start`

Tu estrategia solo conduce; **no escribe nada de la puntuación**. El nodo `round_recorder` hace de árbitro:

1. Espera a que lleguen datos de la pose, el LiDAR y el IMU, y que pase 1 s más.
2. Publica `True` en `/start` y anota el evento de salida. Ese es el instante cero del tiempo.
3. Guarda la pose real del coche (la estrategia nunca la ve; solo la usa el juez).
4. Termina la ronda a los 180 s, a los 30 s sin entrar en una sección nueva, o cuando hubo las tres vueltas y el coche lleva 31 s quieto. Entonces puntúa (paso 9).

`/start` usa la calidad de servicio por defecto: el árbitro del simulador espera a que tu nodo esté suscrito antes de publicarlo, y el botón del coche publica del mismo modo, así que los dos funcionan.

### Frenar antes de cada esquina

En las rectas el coche pide 1,28 m/s y en las esquinas 1,0 (`CORNER_SPEED`). No cambia de golpe: a medida que la pared de enfrente se acerca a la distancia en la que puede empezar el giro, la velocidad baja hasta la de esquina.

```text
gap   = front_axis - TURN_FRONT - BRAKE_MARGIN          (metros que faltan para frenar del todo)
speed = min(CRUISE_SPEED, CORNER_SPEED + BRAKE_GAIN * gap)
```

Con `BRAKE_GAIN = 2.0` y `BRAKE_MARGIN = 0.15`, el coche empieza a frenar 0,29 m antes de la esquina y llega a 1,0 m/s pedidos 0,15 m antes de que la puerta pueda disparar. Es **la misma velocidad en las 12 esquinas**: así la esquina del paso 5 (soltar el tope a 17 grados) se midió para una sola velocidad, y el coche llega a la sección de salida despacio sin tratar distinta la última.

### El giroscopio se queda corto: la pared de la isla lo corrige

El rumbo sale de integrar el giroscopio, y un giroscopio real no mide perfecto: el del coche del equipo lee un 6 % de menos en cada esquina. Son 5 grados por giro; a las dos vueltas, el coche iba 35 a 40 grados torcido hacia la isla mientras la misión creía ir recto (4 nov 2026).

En las rectas hay una segunda fuente para el rumbo: `scene.wall_heading` (paso 3), el ángulo del coche respecto a la pared de la isla, que es recta y no deriva. Con cada escaneo nuevo se compara con lo que dice el giroscopio y se corrige **una parte** de la diferencia:

```text
diferencia = wall_heading - (yaw - goal)
yaw        = yaw + WALL_HEADING_GAIN * diferencia        (WALL_HEADING_GAIN = 0.3)
```

Tres cuidados: solo en las rectas (en la esquina no hay pared al lado), solo cuando el coche ya avanzó 0,25 m (justo al salir de la esquina la recta ajustada todavía mezcla dos paredes) y nunca si la diferencia pasa de 25 grados (eso es un mal ajuste, no deriva).

En el laboratorio, con un giroscopio que lee un 6 % de menos, ninguna de las 36 rondas termina sin la corrección (33 chocan en una recta) y 34 de 36 son válidas con ella; las otras dos paran fuera de la sección de salida.

### El final de la vuelta

La vuelta tiene 4 esquinas y la ronda 3 vueltas, así que `CORNERS = 12`. Tres detalles deciden si ganas los 3 puntos de la parada:

- **El freno usa la pared de enfrente.** En `SETUP` mides la distancia a esa pared (`_start_front`, mediana de los valores finitos). Al acabar la esquina 12 el coche avanza a 0,15 m/s hasta que la pared está tan cerca como al salir, y frena.
- **No frena mientras está torcido.** Al salir de la última esquina la pared de enfrente ya puede estar «en su sitio» con el coche todavía girando. Si frenara ahí, se quedaría con las ruedas giradas y rodaría hacia la isla. Por eso espera a estar a menos de `FINISH_STRAIGHT = 0.1` rad del rumbo.
- **El frenado se enclava** (`_braking`). Si un rayo con ruido hace que la pared parezca más lejos, el motor no se reinicia.

El comando 1,28 m/s no es la velocidad real: con el motor medido del coche del simulador, 1,28 llega a 0,60 m/s y 1,0 a 0,53.


> **Antes de escribirlo, juega un rato.** Da tres vueltas y para donde empezaste. El código lo hace en 35,6 s: a ver si le ganas sin chocar. ¿Cómo sabrías que ya completaste las tres vueltas?
>
> [Abrir el simulador con el reto de este paso](/learn/open-strategy/simulador/?paso=7)

## Escríbelo

> **En este paso**
> - **Escribes:** `mission.py`, en 7 trocitos y 5 funciones pequeñas: `_setup`, `_run`, `_straight_speed`, `_correct_heading` y `_finish`.
> - **Copias hecho:** `strategy.py`, `drive.py` y la cáscara de `mission.py` (la clase con sus datos); no hace falta entenderlos todavía.

Empieza copiando lo que ya está hecho. Ejecuta esto desde la raíz del repositorio:

```bash
git fetch --tags
git show step-7:src/my_open/my_open/strategy.py > src/my_open/my_open/strategy.py
git show step-7:src/my_open/my_open/drive.py > src/my_open/my_open/drive.py
git show step-7:src/my_open/my_open/mission.py | sed -n '1,12p;25,86p' > src/my_open/my_open/mission.py
```

El último comando copia solo la cáscara de `mission.py`: los imports, la clase y sus datos. Abre el archivo y mira `step`: según el estado llama a `self._setup` o a `self._run`. Antes de `_run` actualiza el rumbo con el giroscopio y, fuera de las esquinas, la distancia recorrida en la recta (`self.straight`, el `StraightDistance` del paso 6). Esas funciones las escribes tú, una a una. Después de cada trocito corres una prueba.

### Paso 7.1: esperar Start y calibrar

Mientras no llega Start, el coche se queda quieto. Cuando llega, espera 0,3 s sin moverse para medir dos cosas: lo que marca el giroscopio quieto (nunca es exactamente cero) y la distancia a la pared de enfrente. Es como poner la báscula a cero antes de pesarte.

Bajo la línea `CORNERS = 4 * LAPS` añade `CALIBRATE_SECONDS = 0.3`: los segundos que el coche se queda midiendo. Después pega este **esqueleto** al final de la clase y rellena el hueco:

```python
    def _setup(self, dt, scene, gyro_z, camera):
        if not self.started:
            return 0.0, 0.0
        self._time += dt
        ...                       # TU CÓDIGO: calibrar
        return 0.0, 0.0
```

**Pista.** Mientras `self._time` sea menor que `CALIBRATE_SECONDS`, guarda `gyro_z` en `self._samples` y `scene.front_axis` en `self._fronts`. Cuando pase ese tiempo, una sola vez (mira `self._calibrated`): llama a `self.heading.calibrate(self._samples)`, guarda en `self._start_front` la mediana (el valor del medio al ordenarlos) de las distancias finitas, y pon `self._calibrated = True` y `self._time = 0.0`.

```bash
python -m pytest course/tests/test_step_7.py -q -k waits_for_start
```

Debes ver `1 passed, 18 deselected`. Esta prueba solo mira que espere Start; la calibración la comprueba el paso 7.2.

<details>
<summary>Ver la solución de este paso</summary>

```python
    def _setup(self, dt, scene, gyro_z, camera):
        """Quiet: measure the gyroscope bias and the distance to the wall ahead, then wait for the camera."""
        if not self.started:
            return 0.0, 0.0
        self._time += dt
        if not self._calibrated and self._time < CALIBRATE_SECONDS:
            self._samples.append(gyro_z)
            self._fronts.append(scene.front_axis)
        elif not self._calibrated:
            self.heading.calibrate(self._samples)
            finite = [f for f in self._fronts if math.isfinite(f)]
            self._start_front = median(finite) if finite else math.inf
            self._calibrated, self._time = True, 0.0
```

</details>

### Paso 7.2: elegir el sentido

Con el coche calibrado, falta saber hacia dónde dar la vuelta. En el paso 8 lo decidirá la cámara; aquí la misión solo recibe su voto: `+1` es antihorario (`'ccw'`), `-1` horario (`'cw'`). Si pasan 15 s sin voto, es mejor parar que adivinar.

Añade `DIRECTION_TIMEOUT = 15.0` bajo las otras constantes: los segundos que espera un sentido. Después pega el `else:` **dentro de `_setup`**, al mismo nivel que el `if` y el `elif` del paso 7.1 y antes del último `return 0.0, 0.0`. Además pega el andamio de `_run` al final de la clase: lo escribes en el siguiente paso.

```python
        else:
            ...                   # TU CÓDIGO: elegir el sentido, pasar a RUN o parar

    def _run(self, dt, scene, gyro):
        return 0.0, 0.0           # andamio: lo escribes en 7.3
```

**Pista.** Si todavía no hay `self.direction` y `camera` no es 0, el sentido es `'ccw'` si `camera > 0` y `'cw'` si no. Si ya hay sentido, pon `self.state = 'RUN'`. Si no hay y `self._time` llegó a `DIRECTION_TIMEOUT`, llama a `self._stop('direction_fault')`.

```bash
python -m pytest course/tests/test_step_7.py -q -k "after_calibrating or blue_means or fixed_direction or 15_seconds or operator or heading_comes"
```

Debes ver `6 passed, 13 deselected`. Una de ellas (`heading_comes`) comprueba también tu calibración del paso 7.1.

<details>
<summary>Ver la solución de este paso</summary>

```python
        else:
            if not self.direction and camera:
                self.direction = 'ccw' if camera > 0 else 'cw'
            if self.direction:
                self.state = 'RUN'
            elif self._time >= DIRECTION_TIMEOUT:
                self._stop('direction_fault')
```

</details>

### Paso 7.3: ir recto

Ya hay sentido y el coche arranca. En una recta solo debe mantener su distancia a la isla: el desvío del paso 4 sumado al rumbo objetivo, con la ley con freno del paso 5. Es como ir pegado a una pared con la mano sin tocarla.

Añade `CRUISE_SPEED = 1.28`: la velocidad que le **pides** al motor, en m/s. El coche llega solo a 0,6. Después **sustituye el andamio de `_run`** por este esqueleto:

```python
    def _run(self, dt, scene, gyro):
        sign = 1.0 if self.direction == 'ccw' else -1.0
        inner = scene.left if sign > 0 else scene.right      # el lado de la isla
        keep = ...                # TU CÓDIGO: a qué distancia de la isla ir
        steer = damped_steer(self.goal + lateral_bias(keep, sign), self.yaw, gyro)
        return CRUISE_SPEED, steer
```

**Pista.** Si `inner` no se ve (no es finito, con `math.isfinite`) o es mayor que `ISLAND_OPEN` (la isla ya se abrió), mantén la distancia `GAP`: con ella `lateral_bias` da cero y el coche no se desvía hacia donde no hay isla. Si no, mantén `inner`: la distancia que mides.

```bash
python -m pytest course/tests/test_step_7.py -q -k cruises
```

Debes ver `1 passed, 18 deselected`.

La última línea (`return CRUISE_SPEED, steer`) es provisional: la cambias en el paso 7.5.

<details>
<summary>Ver la solución de este paso</summary>

```python
        island_open = math.isfinite(inner) and inner > ISLAND_OPEN
        keep = GAP if (not math.isfinite(inner) or island_open) else inner      # no lateral offset at a corner
        steer = damped_steer(self.goal + lateral_bias(keep, sign), self.yaw, gyro)
```

</details>

### Paso 7.4: una esquina

Una esquina es una pregunta y un giro. En cada tick le preguntas a la puerta del paso 6: «¿toca girar?». Si dice que sí, el rumbo objetivo gira 90° y el volante va a tope (paso 5) hasta que `arc_steer` avisa de que la esquina terminó.

Añade `CORNER_SPEED = 1.0`: los m/s que pides en todas las esquinas. Pega este esqueleto en `_run`, justo después de `inner = ...` y antes de `island_open`:

```python
        if self.gate.update(scene, inner, self.straight.travelled, self.arc):
            ...                              # TU CÓDIGO: empezar la esquina
        if self.arc:
            steer, done = arc_steer(self.goal, self.yaw, gyro)
            if done:
                ...                          # TU CÓDIGO: terminar la esquina
            return CORNER_SPEED, steer
```

**Pista.** Para empezar: suma `sign * math.pi / 2` a `self.goal` (dentro de `wrap`, que mantiene el ángulo entre -π y π) y pon `self.arc = True`. Para terminar: pon `self.arc = False`, llama a `self.straight.reset()` (la recta siguiente empieza de cero) y suma 1 a `self.completed`.

```bash
python -m pytest course/tests/test_step_7.py -q -k "corner_starts or other_way or full_lock or drive_again"
```

Debes ver `4 passed, 15 deselected`.

<details>
<summary>Ver la solución de este paso</summary>

```python
        if self.gate.update(scene, inner, self.straight.travelled, self.arc):
            self.goal = wrap(self.goal + sign * math.pi / 2)
            self.arc = True
        if self.arc:
            steer, done = arc_steer(self.goal, self.yaw, gyro)
            if done:                                         # the straight-line law finishes the turn
                self.arc = False
                self.straight.reset()
                self.completed += 1
            return CORNER_SPEED, steer
```

</details>

### Paso 7.5: frenar antes de cada esquina

El coche llega a la esquina a la velocidad de esquina, no a la de crucero: es como soltar el acelerador antes de la curva y no en medio.

Añade dos constantes: `BRAKE_GAIN = 2.0` (cuánto puede subir la velocidad por cada metro que falte para la esquina) y `BRAKE_MARGIN = 0.15` (m antes de la esquina en los que ya va a la velocidad de esquina). En `_run`, cambia el último `return` por `return self._straight_speed(scene), steer` y pega esta función al final de la clase:

```python
    def _straight_speed(self, scene):
        gap = scene.front_axis - self.gate.turn_front - BRAKE_MARGIN
        return CRUISE_SPEED               # TU CÓDIGO: más lento cuanto menos falte
```

**Pista.** La velocidad es `CORNER_SPEED + BRAKE_GAIN * max(0.0, gap)`, pero nunca más que `CRUISE_SPEED`: usa `min`. Si no se ve la pared (`front_axis` infinito), `gap` es infinito y sale la de crucero.

```bash
python -m pytest course/tests/test_step_7.py -q -k slows_down
```

Debes ver `1 passed, 18 deselected`.

<details>
<summary>Ver la solución de este paso</summary>

```python
    def _straight_speed(self, scene):
        """Cruise, slowing down to CORNER_SPEED as the wall ahead nears the distance where the corner may start."""
        gap = scene.front_axis - self.gate.turn_front - BRAKE_MARGIN
        return min(CRUISE_SPEED, CORNER_SPEED + BRAKE_GAIN * max(0.0, gap))
```

</details>

### Paso 7.6: corregir el rumbo con la pared de la isla

El giroscopio se va quedando corto esquina tras esquina. En cada recta, la pared de la isla te dice cuánto, y corriges una parte con cada escaneo: es como enderezar el paso mirando la línea del suelo en vez de fiarte solo de tu sentido del equilibrio.

Añade dos constantes: `WALL_HEADING_GAIN = 0.3` (la parte de la diferencia que se corrige con cada escaneo) y `WALL_HEADING_MAX = math.radians(25.0)` (una diferencia mayor es un mal ajuste, no deriva). En `_run`, pega `self._correct_heading(scene)` justo después de la línea `inner = ...`, y esta función al final de la clase:

```python
    def _correct_heading(self, scene):
        if (self.arc or self.straight.travelled < ARM_DISTANCE or scene is self._wall_scene
                or not math.isfinite(scene.wall_heading)):
            return
        self._wall_scene = scene
        difference = 0.0                  # TU CÓDIGO
        ...                               # TU CÓDIGO: corregir self.heading.yaw
```

**Pista.** El `if` del principio ya deja pasar solo lo que vale: en recta, con 0,25 m recorridos, un escaneo nuevo y una pared vista. `wrap(self.yaw - self.goal)` es cuánto cree el giroscopio que está torcido el coche; `scene.wall_heading` es cuánto lo está según la pared. `difference` es `wrap` de la resta (pared menos giroscopio). Si `abs(difference)` no pasa de `WALL_HEADING_MAX`, suma `WALL_HEADING_GAIN * difference` a `self.heading.yaw`.

```bash
python -m pytest course/tests/test_step_7.py -q -k "island_wall_corrects or runs_once or bad_fit"
```

Debes ver `3 passed, 16 deselected`.

<details>
<summary>Ver la solución de este paso</summary>

```python
    def _correct_heading(self, scene):
        """On a straight, pull the gyroscope's heading towards the one the island wall shows (once per scan)."""
        if (self.arc or self.straight.travelled < ARM_DISTANCE or scene is self._wall_scene
                or not math.isfinite(scene.wall_heading)):
            return
        self._wall_scene = scene
        difference = wrap(scene.wall_heading - wrap(self.yaw - self.goal))
        if abs(difference) <= WALL_HEADING_MAX:
            self.heading.yaw += WALL_HEADING_GAIN * difference
```

</details>

### Paso 7.7: contar 12 esquinas y parar donde empezaste

Tres vueltas son 12 esquinas. Después el coche avanza despacio hasta que la pared de enfrente está tan cerca como en Start, y frena: es como aparcar mirando la pared del garaje.

Añade cuatro constantes: `FINISH_SPEED = 0.15` (m/s), `FINISH_LEAD = 0.08` (m: frena cuando a la pared le falta esto para estar como en Start), `FINISH_STRAIGHT = 0.1` (rad: no frena hasta estar así de recto) y `STOP_WAIT = 0.9` (s quieto antes de dar la ronda por terminada). En `_run`, después de `self._correct_heading(scene)`, pega:

```python
        if self.completed >= CORNERS:
            return self._finish(dt, scene, gyro)
```

Y este esqueleto al final de la clase:

```python
    def _finish(self, dt, scene, gyro):
        steer = damped_steer(self.goal, self.yaw, gyro)
        if not self._braking:
            ...                       # TU CÓDIGO: avanzar despacio o empezar a frenar
        self._rest += dt
        ...                           # TU CÓDIGO: tras STOP_WAIT segundos quieto, parar
        return 0.0, 0.0
```

**Pista.** Si `scene.front_axis` no es finito, devuelve `0.0, steer`. El coche sigue avanzando (`FINISH_SPEED, steer`) en dos casos: si todavía está torcido (`abs(wrap(self.goal - self.yaw))` mayor que `FINISH_STRAIGHT`), o si `_start_front` es finito y la pared está más lejos que `_start_front + FINISH_LEAD`. Si no, pon `self._braking = True`: queda puesto para siempre, así un rayo con ruido no reinicia el motor. Al final, si `self._rest >= STOP_WAIT`, llama a `self._stop('done')`.

```bash
python -m pytest course/tests/test_step_7.py -q
```

Debes ver `19 passed`.

<details>
<summary>Ver la solución de este paso</summary>

```python
    def _finish(self, dt, scene, gyro):
        """Back at the start: creep until the wall ahead is as near as it was at Start, then stop."""
        steer = damped_steer(self.goal, self.yaw, gyro)
        if not self._braking:
            if not math.isfinite(scene.front_axis):
                return 0.0, steer
            turned = abs(wrap(self.goal - self.yaw)) > FINISH_STRAIGHT      # still coming out of the last corner
            if turned or (math.isfinite(self._start_front) and scene.front_axis > self._start_front + FINISH_LEAD):
                return FINISH_SPEED, steer
            self._braking = True                             # latched: range noise must not restart the motor
        self._rest += dt
        if self._rest >= STOP_WAIT:
            self._stop('done')
        return 0.0, 0.0
```

</details>

<details>
<summary>Para curiosos: qué hacen strategy.py y drive.py</summary>

`strategy.py` hereda de `StrategyBase`, convierte cada escaneo nuevo en una `Scene` (la percepción del paso 3) y se la da a la misión. El rumbo de la pista (`forward_yaw`) hace que la pared de enfrente se mida a lo largo de la pista y no hacia donde apunta el coche. La línea `self.yaw = self.mission.yaw` deja tu rumbo donde lo lee la telemetría.

`drive.py` es el nodo de ROS. Ya no calcula nada: reenvía los sensores a `Strategy` y publica su respuesta en `/cmd_vel_raw`. Antes de publicar convierte el volante en velocidad angular con `speed * tan(steer) / WHEELBASE`, el modelo de bicicleta del paso 1. El sentido sale del parámetro `direction`, que aquí vale `'ccw'` por defecto; en el paso 8 pasará a `'auto'` y llegará la cámara.

</details>

## Pruébalo en el simulador

Primero el laboratorio (Open lab), que corre una ronda en unos 5 s sin Gazebo:

```bash
python -m robotek_evaluation.open_lab --strategy my_open.strategy:Strategy --field square100 --direction ccw
```

Debes ver `square100-ccw  pts=30  t=33.78  valid=True` y debajo `1/1 valid, mean time 33.78 s`.

Después la ronda completa en Gazebo, con ventana:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=ccw
```

Debes ver `Start` en la terminal al empezar y, al final, el resultado del árbitro. En este paso corre solo `ccw`: el argumento `direction` del lanzador solo cambia hacia dónde **aparece** mirando el coche, no se lo pasa a tu nodo. La solución de referencia dio en **Gazebo**:

```text
Puntos: 30 de 30   (secciones 24 + vueltas 3 + parada 3)
Tiempo desde Start: 35.56 s simulados   (vueltas: 11.4 / 11.0 / 11.0 s)
Válida: sí   margen mínimo 17.7 cm
```

El laboratorio da 33,78 s y Gazebo 35,56 s: no son comparables, porque el laboratorio no modela el deslizamiento de las ruedas ni el plugin de Gazebo. Son estimaciones de simulación, no puntuación oficial. Si tu tiempo difiere unas décimas, no pasa nada: importan **30 puntos y ronda válida**.

### Rómpelo

Cambia una cosa, corre las 19 pruebas y el laboratorio, y vuelve a dejarla como estaba. Los números son de esta guía: las 12 rondas del laboratorio con las semillas 0, 1 y 2 (36 rondas por cambio). La base son 36 de 36 válidas.

| Cambio | Qué ves | Resultado medido |
|---|---|---|
| En `_setup`, `self.heading.calibrate(self._samples)` por `pass` | falla 1 prueba: `test_the_heading_comes_from_the_gyroscope_without_the_bias` | 36 de 36 válidas: la pared de la isla corrige el rumbo en cada recta y tapa el error |
| `WALL_HEADING_GAIN = 0.0` | fallan 2 pruebas, las de la corrección | 36 de 36 con el giroscopio del laboratorio, que no tiene error de escala. Con uno que lee un 6 % de menos (`--set robotek_evaluation.open_lab.GYRO_SCALE=0.94`), 0 de 36 |
| `LOOKAHEAD = 0.5` en `turn_gate.py` | las pruebas de los pasos 6 y 7 **pasan** | 27 de 36 válidas: en los campos con un pasillo estrecho el coche gira antes de tiempo y choca con la isla a los 3 s |

La lección: ninguna comprobación lo ve todo. Las pruebas con escenas a mano dejan pasar el último cambio (todas en verde), y el laboratorio deja pasar los dos primeros si el sensor simulado es mejor que el real. Por eso hay pruebas **y** laboratorio. Y aun así el laboratorio no es Gazebo (paso 9): decide Gazebo.

## Si algo falla

- **El coche no se mueve nunca.** No le llegó Start. Revisa que el nodo se llame `strategy` y que en la terminal salga `Start`; si no, mira `ros2 topic echo /start`.
- **Se mueve y a los 15 s se detiene sin dar vueltas.** Es `DIRECTION_FAULT`: la misión no tiene sentido. En este paso `drive.py` usa `'ccw'` por defecto; si lo cambiaste a `'auto'`, la cámara aún no existe.
- **Gira bien pero saca 27 puntos, o da vueltas de más.** Revisa el final (7.7) y que `_start_front` salga de la mediana de las distancias **finitas** (7.1). Si nunca llega a `FINISH`, mira que al terminar cada esquina sumes 1 a `completed` (7.4).
- **Gira una vez y no vuelve a girar.** Falta `self.straight.reset()` al terminar la esquina (7.4): la distancia recorrida se queda con la recta anterior.
- **Cada vuelta va más torcido.** Revisa el signo de `difference` en `_correct_heading` (7.6): es la pared menos el giroscopio.

## Resumen

- La misión es una máquina de tres estados (`SETUP`, `RUN`, `STOP`) con dos datos dentro de `RUN` (`completed`, `arc`).
- Toda la lógica es Python puro en `mission.py`, así que se prueba con escenas a mano; el nodo solo reenvía.
- El coche frena antes de cada esquina, y en cada recta la pared de la isla corrige el rumbo del giroscopio.
- Los 3 puntos de la parada dependen del freno por la pared de enfrente, de esperar a estar recto y de enclavarlo.

## Antes de seguir

- [ ] `python -m pytest course/tests/test_step_7.py -q` da `19 passed`.
- [ ] En Gazebo (`ccw`) el árbitro imprime `Puntos: 30 de 30` y `Válida: sí`.
- [ ] Sabes decir por qué 33,78 s y 35,56 s son tiempos de sitios distintos (laboratorio y Gazebo).
