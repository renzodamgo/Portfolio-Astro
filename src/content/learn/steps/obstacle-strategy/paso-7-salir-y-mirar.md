---
guide: "obstacle-strategy"
order: 7
slug: "paso-7-salir-y-mirar"
title: "La misión: salir, mirar, tres vueltas"
summary: "Une las piezas en la estrategia: la salida con una señal encima, mirar las señales cuyo color falta, tres vueltas y parar."
tag: "obstacle-step-7"
compareFrom: "obstacle-step-6"
---

Tienes la pose, las señales, la línea y el volante. Falta la **misión**: qué hace el coche en cada momento de la ronda. En este paso escribes `mission.py` y `strategy.py`, la subclase de `ObstacleStrategyBase` que une todo. Aquí entran dos maniobras que no se ven en el Open: **retroceder en la salida** y **mirar** una señal cuyo color falta.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/NTEHRjiAY2I" title="How to Code a State Machine | Embedded System Project Series #26" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>How to Code a State Machine | Embedded System Project Series #26</strong> · Artful Bytes (inglés). La misión es una máquina de estados: así se programa una.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

La primera ronda completa: tres vueltas y parada en la sección de salida, 40 puntos. En el laboratorio, el set de prueba (5 campos × 2 sentidos × 5 semillas de ruido) pasa de 30 a **44 rondas válidas de 50** al añadir «mirar». En Gazebo, la referencia hizo **40 puntos, ronda válida, en 115,6 s** en el campo 4 CCW.

<div data-widget="step-replay" data-src="/learn/assets/replays/obstacle-step-7.json"></div>

*Repetición del laboratorio del Obstacle (la copia de la web) con la solución del curso. La ronda del reglamento: se para a mirar dos señales sin color, da tres vueltas y para en la sección de salida.*

## La idea

### Estados

| Estado | Qué hace | Cuándo termina |
|---|---|---|
| `SETUP` | 0,3 s quieto calibrando el sesgo del giroscopio; elige el sentido (paso 2) | con el sentido y la pose inicial |
| `RUN` | memoria de señales, plan, volante y velocidad | progreso ≥ 24,7 (o ≥ 24 si aparca, paso 8) |
| `STOP` | parado | fin de la ronda |

La salida y «mirar» son fases dentro de `RUN`: devuelven velocidad y volante propios mientras duran.

### La salida: retroceder si la primera señal está encima

El coche arranca en el progreso 0,25. Si hay una señal en el asiento 0,5, la tiene 0,25 m delante. Si además le toca pasarla por el otro lado (por ejemplo una roja exterior, que pide −0,354 m), ningún camino hacia delante llega: necesita moverse 0,2 m de lado en 0,1 m de avance.

La misión se queda quieta **0,25 s** para archivar las primeras señales (hasta 1 s si la de delante aún no tiene color) y calcula cuánto le falta: `0,55 + 0,8 · |cambio de lado| − distancia hasta la señal`. Si falta, **retrocede en recta** a 0,15 m/s esa distancia, como mucho 0,5 m.

Pero el LiDAR no ve detrás del coche (±110°), y un retroceso a ciegas puede chocar con una señal del asiento 0. La regla del sorteo resuelve esto: **una carta con dos señales usa siempre los dos extremos de la recta, nunca el medio**. Si hay una señal en el asiento central (0,5), la recta tiene una sola señal y el asiento de detrás está vacío. Solo en ese caso se retrocede. Así se salvó el campo 2 CW, que antes chocaba al segundo.

### Mirar: cuando el color no llega

En CW el lado de la isla de la cámara llega solo a 28,9°. Una señal interior justo tras una esquina queda a 31–40° hasta que es tarde para cambiar de lado: el coche la pasaba por el lado equivocado en los campos 3 y 4 CW.

Cuando la próxima señal **no tiene color** y está entre **0,6 y 1,4 unidades** delante, el coche se para, **retrocede con el volante a fondo hacia el lado contrario** hasta que el morro gira **15°** hacia la señal y espera **0,5 s** (tres cuadros de la cámara). Luego sigue: el plan ya tiene el color y el volante del paso 6 recupera la línea. Se hace una sola vez por asiento. Dura unos 2 s y el reglamento lo permite (9.21: ir hacia atrás dentro de la misma sección).

| Versión | Set de prueba (50 rondas) |
|---|---:|
| todo lo anterior y la salida con retroceso, sin parar a mirar | 30 |
| + parar a mirar las señales sin color | **44** |

Los campos 3 y 4 CW pasaron de 0 a 5 de 5 semillas.

### Parar

Tras 24,7 unidades (tres vueltas y 0,7 m dentro de la recta de salida) frena: a 1,2 unidades del final baja a 0,15 m/s y se detiene dentro de la sección de salida. El juez exige 30 s parado.

### Cuando hay algo delante

Si algo queda a menos de 0,16 m al frente, retrocede 0,8 s a 0,15 m/s y vuelve a intentar. Y si el último escaneo tiene más de 0,35 s, frena: con datos viejos no se conduce.

## Escríbelo

> **En este paso**
> - **Escribes:** `mission.py` (`Params`, `make_params` y la clase `Mission` con `observe` y `step`) y `strategy.py` (`Strategy(ObstacleStrategyBase)` con `update`).
> - **Copias hecho:** el `drive.py` final.

```bash
git show obstacle-step-7:src/my_obstacle/my_obstacle/drive.py > src/my_obstacle/my_obstacle/drive.py
```

### Paso 7.1: los parámetros

`Params` es un `dataclass` con todo lo que se puede ajustar sin tocar el código: `cruise_speed` 0,35, `pillar_speed` 0,30, `finish_speed` 0,15, `pillar_clearance` 0,18, `pillar_lookahead` 1,80, `steer_kp` 1,5, `steer_kd` 0,2, `steer_limit` 0,307, `stop_progress` 24,7, `park` 0, `park_after` 24, `park_speed` 0,06, `park_margin` 0,015 y `scan_max_age` 0,35. `make_params(values)` **rechaza los nombres que no conoce** (`ValueError`): un parámetro mal escrito no puede pasar en silencio.

### Paso 7.2: `Mission.observe` y `Mission.step`

- `observe(observations, stamp)`: guarda las observaciones de la cámara para la memoria de señales.
- `step(now, scan, scan_stamp, clusters, yaw, gyro, distance) → (speed, steer, state)`: `clusters` son los de `scan` (`scan_clusters`, de `robotek_course.obstacle_vision`), `yaw` el giroscopio integrado, `gyro` la velocidad de giro con sesgo y `distance` la odometría desde el tick anterior. `state` es `SETUP`, `RUN`, `PARK` (paso 8) o `STOP`: la misión termina en **`STOP`**, no en `DONE`.

En `RUN`, cada escaneo nuevo pasa por `memory.remember`; luego la siguiente señal (`next_sign`), el plan (`plan.with_offsets(memory.ahead(...))`, `plan.sign_knots`, `corner.merge`), la salida, mirar, el volante (`follow.steer` con `self.offset_at`) y la velocidad.

### Paso 7.3: la salida y mirar

Dos métodos que devuelven `None` cuando no les toca actuar, o `(speed, steer, 'RUN')` mientras actúan; `_run` los consulta antes del volante con `self._start(now) or self._look(now, th)`.

- `_start(now)`: quieto `START_LOOK` (0,25 s, hasta 1 s si la señal de delante no tiene color); después retrocede a 0,15 m/s hasta `phi ≤ _backup_to`, con lo que diga `_backup()`.
- `_look(now, th)`: la máquina `back` → `look` → fin, con el conjunto de asientos ya mirados.

### Paso 7.4: la estrategia

<details>
<summary>Ver la solución de strategy.py</summary>

```python
class Strategy(ObstacleStrategyBase):
    def __init__(self, direction='auto', parking=False, params=None):
        super().__init__()
        values = dict(params or {})
        if parking:
            values.setdefault('park', 1.0)
        self.direction = direction          # the mission reads it from the walls; kept for the record
        self.mission = Mission(values)
        self._clusters = []
        self._clusters_stamp = None

    def update(self, now, dt):
        if self.new_scan and self.scan_stamp != self._clusters_stamp:
            self._clusters, self._clusters_stamp = scan_clusters(self.scan), self.scan_stamp
        self.mission.observe(self.signs, self.signs_stamp)
        speed, steer, state = self.mission.step(now, self.scan, self.scan_stamp, self._clusters,
                                                self.yaw, self.gyro, self.travelled)
        self.gyro_bias = self.mission.gyro_bias
        self.label = state
        self.done = state == 'STOP'
        self.parked = self.mission.parking is not None and self.mission.parking.state == 'PARKED'
        return speed, steer
```

</details>

<details>
<summary>Ver la solución de _backup</summary>

```python
    def _backup(self):
        """Metres to back up so the side change to the first sign fits (0.55 m + 0.8 m per metre
        of shift). A sign in the middle seat comes from a one-sign card, so the seat behind is empty
        (rules, fig. 8c); with a sign at the end seat it may not be, and the car does not back up."""
        if self.pillar is None or self.pillar[1] % 2.0 != 0.5:
            return 0.0
        hold = self.pillar[1] - plan.HOLD
        need = 0.55 + 0.8 * abs(self.offset_at(hold)) - (hold - self.phi)
        return lane.clamp(need, 0.0, BACKUP_LIMIT)
```

</details>

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_7.py -q        # 10 passed
python3 -m robotek_evaluation.obstacle_lab --strategy my_obstacle.strategy:Strategy --layouts 0-4 --seeds 0-4 --workers 8
ros2 launch robotek_course obstacle_round.launch.py strategy:=my_obstacle seed:=4 direction:=ccw parking:=false gui:=true
python3 course/obstacle/verify_step.py 7          # Gazebo sin ventana: exige 40 puntos y ronda válida
```

El laboratorio imprime una línea por ronda (puntos, tiempo, válida, margen, fallo) y el total. Gazebo imprime la puntuación del árbitro al terminar.

### Rómpelo

1. Quita la condición del asiento central y retrocede siempre: en el campo 4 el coche choca con la señal del asiento 0 al salir.
2. Desactiva «mirar»: los campos 3 y 4 CW vuelven a fallar por lado.

## Si algo falla

- **No arranca.** Sin `/start` no hay ronda: lo publica el árbitro (o el botón del coche real).
- **`ValueError: Unsupported parameters`.** Un nombre de parámetro mal escrito: `make_params` no lo acepta.
- **Se pasa de la sección de salida.** Revisa el progreso de parada (24,7) y la rampa de frenado.

## Resumen

- Tres estados; la salida y mirar son fases cortas dentro de `RUN`.
- Retroceder en la salida solo cuando el reglamento garantiza que no hay nada detrás.
- Parar a mirar una señal sin color: de 30 a 44 rondas válidas de 50.

## Antes de seguir

- [ ] `test_obstacle_step_7.py` da `10 passed`.
- [ ] Una ronda completa en Gazebo con 40 puntos.
