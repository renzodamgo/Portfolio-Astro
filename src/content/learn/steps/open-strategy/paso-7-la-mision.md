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

## Lo que vas a ver

Con Gazebo abierto, la ronda tiene cuatro momentos:

1. **Quieto, unos 0,3 s.** Start ya llegó, pero el coche calibra el giroscopio y mide la pared de enfrente.
2. **Tres vueltas.** Sigue la pared de la isla y en cada esquina gira 90° hacia ella (a la izquierda en `ccw`). En total, 12 giros en unos 35 s.
3. **Final.** En la última esquina va más lento; después avanza despacio hasta que la pared de enfrente está como estaba en Start, y frena.
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
| **`Scene`** | las cuatro distancias que sacas de cada escaneo del LiDAR (paso 3): `left`, `right`, `front_axis` e `island_end` |
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

`StrategyBase` (en `robotek_course`) hace tres cosas que no son el objetivo del curso:

- **Distancia con LiDAR** (`LidarOdometry`): en cada tick `self.travelled` son los metros avanzados desde el tick anterior. El coche no tiene encoder; la distancia sale de los escaneos.
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

### El final de la vuelta

La vuelta tiene 4 esquinas y la ronda 3 vueltas, así que `CORNERS = 12`. Tres detalles deciden si ganas los 3 puntos de la parada:

- **La última esquina va más lenta** (0,6 en vez de 1,28 m/s de comando). Con menos velocidad el coche llega a la sección de salida y puede parar con todo el cuerpo dentro.
- **El freno usa la pared de enfrente.** En `SETUP` mides la distancia a esa pared (`_start_front`, mediana de los valores finitos). Al acabar la esquina 12 el coche avanza a 0,15 m/s hasta que la pared está tan cerca como al salir, y frena.
- **El frenado se enclava** (`_braking`). Si un rayo con ruido hace que la pared parezca más lejos, el motor no se reinicia.

El comando 1,28 m/s no es la velocidad real: con el motor medido del coche, 1,28 llega a 0,60 m/s (`real_speed`).


## Escríbelo

> **En este paso**
> - **Escribes:** `mission.py`, en 6 trocitos y 5 funciones pequeñas: `_setup`, `_run`, `_corner`, `_finish` y `_straight_speed`.
> - **Copias hecho:** `strategy.py`, `drive.py` y la cáscara de `mission.py` (la clase con sus datos); no hace falta entenderlos todavía.

Empieza copiando lo que ya está hecho. Ejecuta esto desde la raíz del repositorio:

```bash
git fetch --tags
git show step-7:src/my_open/my_open/strategy.py > src/my_open/my_open/strategy.py
git show step-7:src/my_open/my_open/drive.py > src/my_open/my_open/drive.py
git show step-7:src/my_open/my_open/mission.py | sed -n '1,12p;24,83p' > src/my_open/my_open/mission.py
```

El último comando copia solo la cáscara de `mission.py`: los imports, la clase y sus datos. Abre el archivo y mira `step`: según el estado llama a `self._setup` o a `self._run`. Esas funciones las escribes tú, una a una. Después de cada trocito corres una prueba.

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

Debes ver `1 passed, 11 deselected`. Esta prueba solo mira que espere Start; la calibración la comprueba el paso 7.2.

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

**Pista.** Si todavía no hay `self.direction` y `camera` no es 0, el sentido es `'ccw'` si `camera > 0` y `'cw'` si no. Si ya hay sentido, pon `self.state = 'RUN'` y `self.travelled = 0.0`. Si no hay y `self._time` llegó a `DIRECTION_TIMEOUT`, llama a `self._stop('direction_fault')`.

```bash
python -m pytest course/tests/test_step_7.py -q -k "after_calibrating or blue_means or fixed_direction or 15_seconds or operator or heading_comes"
```

Debes ver `6 passed, 6 deselected`. Una de ellas (`heading_comes`) comprueba también tu calibración del paso 7.1.

<details>
<summary>Ver la solución de este paso</summary>

```python
        else:
            if not self.direction and camera:
                self.direction = 'ccw' if camera > 0 else 'cw'
            if self.direction:
                self.state, self.travelled = 'RUN', 0.0
            elif self._time >= DIRECTION_TIMEOUT:
                self._stop('direction_fault')
```

</details>

### Paso 7.3: ir recto

Ya hay sentido y el coche arranca. En una recta solo debe mantener su distancia a la isla, con la ley de carril del paso 4. Es como ir pegado a una pared con la mano sin tocarla.

Añade `CRUISE_SPEED = 1.28`: la velocidad que le **pides** al motor, en m/s. El coche real llega solo a 0,6. Después **sustituye el andamio de `_run`** por este esqueleto:

```python
    def _run(self, dt, scene, gyro):
        sign = 1.0 if self.direction == 'ccw' else -1.0
        inner = scene.left if sign > 0 else scene.right      # el lado de la isla
        keep = ...                # TU CÓDIGO: a qué distancia de la isla ir
        return CRUISE_SPEED, lane_steer(self.goal, self.yaw, keep, sign)
```

**Pista.** Si `inner` no se ve (no es finito, con `math.isfinite`) o es mayor que `ISLAND_OPEN` (la isla ya se abrió), mantén la distancia `GAP`. Si no, mantén `inner`: la distancia que ya tienes.

```bash
python -m pytest course/tests/test_step_7.py -q -k straight
```

Debes ver `1 passed, 11 deselected`.

La última línea (`return CRUISE_SPEED, ...`) es provisional: la cambias en el paso 7.6. La solución de este paso son las tres líneas que calculan `keep`:

<details>
<summary>Ver la solución de este paso</summary>

```python
        island_open = math.isfinite(inner) and inner > ISLAND_OPEN
        keep = GAP if (not math.isfinite(inner) or island_open) else inner      # no lateral offset at a corner
        steer = lane_steer(self.goal, self.yaw, keep, sign)
```

</details>

### Paso 7.4: una esquina

Una esquina es una pregunta y un giro. En cada tick le preguntas a la puerta del paso 6: «¿toca girar?». Si dice que sí, el rumbo objetivo gira 90° y el coche sigue el arco del paso 5 hasta quedar apuntando ahí.

Añade dos constantes: `TURN_TOLERANCE = 0.12` (los radianes, unos 7°, que pueden faltar para dar la esquina por terminada) y `LAST_TOLERANCE = 0.4` (lo mismo en la última esquina, unos 23°). Pega este esqueleto en `_run`, justo después de `inner = ...` y antes de `island_open`:

```python
        corner_speed = CRUISE_SPEED          # provisional: lo cambias en 7.6
        if self.gate.update(scene, inner, self.travelled, self.arc):
            ...                              # TU CÓDIGO: empezar la esquina
        if self.arc:
            return corner_speed, self._corner(dt, gyro, sign, corner_speed)
```

Y esta función nueva al final de la clase:

```python
    def _corner(self, dt, gyro, sign, corner_speed):
        rate = real_speed(corner_speed) * math.tan(STEER_LIMIT) / WHEELBASE   # lo que más rápido puede girar
        steer, self.ref = arc_steer(self.goal, self.ref, self.yaw, gyro, rate, dt, sign=sign)
        tolerance = LAST_TOLERANCE if self.completed == CORNERS - 1 else TURN_TOLERANCE
        ...                                  # TU CÓDIGO: terminar la esquina
        return steer
```

**Pista.** Para empezar: suma `sign * math.pi / 2` a `self.goal` (dentro de `wrap`, que mantiene el ángulo entre -π y π), pon `self.arc = True` y llama a `self.gate.corner_started()`. Para terminar: si `abs(wrap(self.goal - self.yaw))` es menor o igual que `tolerance`, pon `self.arc = False`, `self.ref = self.goal` y `self.travelled = 0.0`, y suma 1 a `self.completed`.

```bash
python -m pytest course/tests/test_step_7.py -q -k "corner_starts or other_way"
```

Debes ver `2 passed, 10 deselected`. Ninguna prueba mira que la esquina **termine**: si te equivocas ahí, lo verás en el simulador (el coche se queda girando).

<details>
<summary>Ver la solución de este paso</summary>

```python
        if self.gate.update(scene, inner, self.travelled, self.arc):
            self.goal = wrap(self.goal + sign * math.pi / 2)
            self.arc = True
            self.gate.corner_started()
        if self.arc:
            return corner_speed, self._corner(dt, gyro, sign, corner_speed)
```

```python
    def _corner(self, dt, gyro, sign, corner_speed):
        rate = real_speed(corner_speed) * math.tan(STEER_LIMIT) / WHEELBASE
        steer, self.ref = arc_steer(self.goal, self.ref, self.yaw, gyro, rate, dt, sign=sign)
        tolerance = LAST_TOLERANCE if self.completed == CORNERS - 1 else TURN_TOLERANCE
        if abs(wrap(self.goal - self.yaw)) <= tolerance:     # the corner is done
            self.arc, self.ref, self.travelled = False, self.goal, 0.0
            self.completed += 1
        return steer
```

</details>

### Paso 7.5: parar donde empezaste

Tras la esquina 12 el coche ya dio las tres vueltas. Ahora avanza muy despacio hasta que la pared de enfrente esté tan cerca como cuando salió (la mediana que guardaste en 7.1), frena y espera un momento. Es como aparcar: despacio hasta la marca.

Añade tres constantes: `FINISH_SPEED = 0.15` (m/s al acercarse), `FINISH_LEAD = 0.08` (m: frena cuando falta tan poco) y `STOP_WAIT = 0.9` (s quieto antes de terminar). Pega estas dos líneas en `_run`, justo después de `inner = ...`:

```python
        if self.completed >= CORNERS:
            return self._finish(dt, scene, gyro)
```

Y este esqueleto al final de la clase:

```python
    def _finish(self, dt, scene, gyro):
        steer = clamp(heading_steer(self.goal, self.yaw) - 0.1 * gyro, -STEER_LIMIT, STEER_LIMIT)
        if not self._braking:
            ...                       # TU CÓDIGO: avanzar despacio o empezar a frenar
        self._rest += dt
        ...                           # TU CÓDIGO: tras STOP_WAIT segundos quieto, parar
        return 0.0, 0.0
```

**Pista.** Si `scene.front_axis` no es finito, devuelve `0.0, steer`. Si `_start_front` es finito y la pared está más lejos que `_start_front + FINISH_LEAD`, devuelve `FINISH_SPEED, steer`. Si no, pon `self._braking = True`: queda puesto para siempre, así un rayo con ruido no reinicia el motor. Al final, si `self._rest >= STOP_WAIT`, llama a `self._stop('done')`.

```bash
python -m pytest course/tests/test_step_7.py -q -k "twelve_corners or does_not_restart"
```

Debes ver `2 passed, 10 deselected`.

<details>
<summary>Ver la solución de este paso</summary>

```python
        if self.completed >= CORNERS:
            return self._finish(dt, scene, gyro)
```

```python
    def _finish(self, dt, scene, gyro):
        """Back at the start: creep until the wall ahead is as near as it was at Start, then stop."""
        steer = clamp(heading_steer(self.goal, self.yaw) - 0.1 * gyro, -STEER_LIMIT, STEER_LIMIT)
        if not self._braking:
            if not math.isfinite(scene.front_axis):
                return 0.0, steer
            if math.isfinite(self._start_front) and scene.front_axis > self._start_front + FINISH_LEAD:
                return FINISH_SPEED, steer
            self._braking = True                             # latched: range noise must not restart the motor
        self._rest += dt
        if self._rest >= STOP_WAIT:
            self._stop('done')
        return 0.0, 0.0
```

</details>

### Paso 7.6: llegar despacio a la última esquina

Para ganar los 3 puntos de la parada, el coche debe frenar dentro de la sección de salida. Por eso la última esquina (la 12) se da más despacio, y la recta que lleva a ella se frena poco a poco. Es como soltar el acelerador antes de la curva y no en medio.

Añade tres constantes: `LAST_CORNER_SPEED = 0.6` (m/s pedidos en la última esquina), `BRAKE_GAIN = 2.0` (cuánto puede subir la velocidad por cada metro que falte para la esquina) y `BRAKE_MARGIN = 0.15` (m de margen). En `_run`, **sustituye** la línea `corner_speed = CRUISE_SPEED` por estas dos:

```python
        last = self.completed == CORNERS - 1          # ¿es la última esquina?
        corner_speed = LAST_CORNER_SPEED if last else CRUISE_SPEED
```

Y la última línea de `_run` por esta:

```python
        return self._straight_speed(scene, last, corner_speed), steer
```

Y escribe esta función nueva al final de la clase:

```python
    def _straight_speed(self, scene, last, corner_speed):
        speed = CRUISE_SPEED
        if last and math.isfinite(scene.front_axis):
            ...                       # TU CÓDIGO: frenar más cuanto más cerca está la esquina
        return speed
```

**Pista.** Calcula `gap`, los metros que faltan para el punto de giro: `scene.front_axis - self.gate.turn_front - BRAKE_MARGIN`. La velocidad es la menor entre `speed` y `corner_speed + BRAKE_GAIN * max(0.0, gap)`: sin distancia sobrante va a la velocidad de la esquina.

```bash
python -m pytest course/tests/test_step_7.py -q
```

Debes ver `12 passed`. Ninguna prueba mide esta rampa: la comprobarás con el simulador, en la parada.

<details>
<summary>Ver la solución de este paso</summary>

```python
        last = self.completed == CORNERS - 1
        corner_speed = LAST_CORNER_SPEED if last else CRUISE_SPEED
```

```python
        return self._straight_speed(scene, last, corner_speed), steer
```

```python
    def _straight_speed(self, scene, last, corner_speed):
        speed = CRUISE_SPEED
        if last and math.isfinite(scene.front_axis):         # slow down before the last corner
            gap = scene.front_axis - self.gate.turn_front - BRAKE_MARGIN
            speed = min(speed, corner_speed + BRAKE_GAIN * max(0.0, gap))
        return speed
```

</details>

<details>
<summary>Para curiosos: qué hacen strategy.py y drive.py</summary>

`strategy.py` hereda de `StrategyBase`, convierte cada escaneo nuevo en una `Scene` (la percepción del paso 3) y se la da a la misión. El rumbo de la pista (`forward_yaw`) hace que la pared de enfrente se mida a lo largo de la pista y no hacia donde apunta el coche. La línea `self.yaw = self.mission.yaw` no es decoración: la odometría de `StrategyBase` usa tu rumbo para proyectar el avance.

`drive.py` es el nodo de ROS. Ya no calcula nada: reenvía los sensores a `Strategy` y publica su respuesta en `/cmd_vel_raw`. Antes de publicar convierte el volante en velocidad angular con `speed * tan(steer) / WHEELBASE`, el modelo de bicicleta del paso 1. El sentido sale del parámetro `direction`, que aquí vale `'ccw'` por defecto; en el paso 8 pasará a `'auto'` y llegará la cámara.

</details>

## Pruébalo en el simulador

Primero el laboratorio (Open lab), que corre una ronda en unos 5 s sin Gazebo:

```bash
python -m robotek_evaluation.open_lab --strategy my_open.strategy:Strategy --field square100 --direction ccw
```

Debes ver `square100-ccw  pts=30  t=32.58  valid=True` y debajo `1/1 valid, mean time 32.58 s`.

Después la ronda completa en Gazebo, con ventana:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=ccw
```

Debes ver `Start` en la terminal al empezar y, al final, el resultado del árbitro. En este paso corre solo `ccw`: el argumento `direction` del lanzador solo cambia hacia dónde **aparece** mirando el coche, no se lo pasa a tu nodo. La solución de referencia dio en **Gazebo**:

```text
Puntos: 30 de 30   (secciones 24 + vueltas 3 + parada 3)
Tiempo desde Start: 34.80 s simulados   (vueltas: 10.9 / 10.6 / 11.0 s)
Válida: sí   margen mínimo 11.9 cm
```

El laboratorio da 32,58 s y Gazebo 34,80 s: no son comparables, porque el laboratorio no modela el deslizamiento de las ruedas ni el plugin de Gazebo. Son estimaciones de simulación, no puntuación oficial. Si tu tiempo difiere unas décimas, no pasa nada: importan **30 puntos y ronda válida**.

### Rómpelo

Cambia una cosa, corre las 12 pruebas y el laboratorio, y vuelve a dejarla como estaba. Los números son de esta guía: las 12 rondas del laboratorio con las semillas 0, 1 y 2 (36 rondas por cambio). La base son 36 de 36 válidas.

| Cambio | Qué ves | Resultado medido |
|---|---|---|
| En `_setup`, `self.heading.calibrate(self._samples)` por `pass` | falla 1 prueba: `test_the_heading_comes_from_the_gyroscope_without_the_bias` | 23 de 36 válidas; de las otras 13, 12 tocan un muro y quedan en 20 a 25 puntos, y 1 saca 30 pero pasa a menos de 1 cm de la isla |
| `LAST_CORNER_SPEED = 1.28` | las 12 pruebas **pasan** | 18 de 36 válidas; las otras 18 dan 27 puntos: el coche no consigue parar dentro de la sección de salida |

La lección: las pruebas con escenas a mano no lo detectan todo (el segundo cambio las deja todas en verde). Para eso está el laboratorio. Y aun así el laboratorio no es Gazebo (paso 9): decide Gazebo.

## Si algo falla

- **El coche no se mueve nunca.** No le llegó Start. Revisa que el nodo se llame `strategy` y que en la terminal salga `Start`; si no, mira `ros2 topic echo /start`.
- **Se mueve y a los 15 s se detiene sin dar vueltas.** Es `DIRECTION_FAULT`: la misión no tiene sentido. En este paso `drive.py` usa `'ccw'` por defecto; si lo cambiaste a `'auto'`, la cámara aún no existe.
- **Gira bien pero saca 27 puntos, o da vueltas de más.** Revisa la última esquina (7.6) y que `_start_front` salga de la mediana de las distancias **finitas** (7.1). Si nunca llega a `FINISH`, mira que `_corner` compare con `abs(wrap(...))` (7.4).

## Resumen

- La misión es una máquina de tres estados (`SETUP`, `RUN`, `STOP`) con dos datos dentro de `RUN` (`completed`, `arc`).
- Toda la lógica es Python puro en `mission.py`, así que se prueba con escenas a mano; el nodo solo reenvía.
- Los 3 puntos de la parada dependen de la última esquina lenta, del freno por la pared de enfrente y de enclavarlo.

## Antes de seguir

- [ ] `python -m pytest course/tests/test_step_7.py -q` da `12 passed`.
- [ ] En Gazebo (`ccw`) el árbitro imprime `Puntos: 30 de 30` y `Válida: sí`.
- [ ] Sabes decir por qué 32,58 s y 34,80 s son tiempos de sitios distintos (laboratorio y Gazebo).
