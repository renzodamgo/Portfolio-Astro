---
guide: "open-strategy"
order: 6
slug: "paso-6-cuando-girar"
title: "Cuándo girar"
summary: "Decide el momento exacto de iniciar el giro."
tag: "step-6"
compareFrom: "step-5"
---

En el paso 5 la esquina empezaba con una regla fija: la pared de enfrente a 1,19 m. Una sola condición se equivoca con facilidad. En este paso escribes `TurnGate` (la puerta), que decide **cada tick** (cada ejecución del control, 50 veces por segundo) si es el momento de girar, y la conectas a `drive.py` junto con la distancia recorrida, que sale del LiDAR. Al terminar, el coche gira esquina tras esquina alrededor de la isla.

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

## Escríbelo

1. **Crea `src/my_open/my_open/turn_gate.py`** con las constantes de la tabla de arriba (más `END_CLEARANCE`) y la clase `TurnGate`, con `update(scene, inner, travelled, arc)` y `corner_started()`.
2. **Edita `drive.py`** para usar la puerta y la distancia recorrida.

**Pistas para `turn_gate.py`.**

1. `__init__(self, turn_front=TURN_FRONT, lookahead=LOOKAHEAD)` guarda los dos valores y arranca con `armed = True`, `hits = 0` y `_scene = None`.
2. En `update`, primero la cuenta: **solo si** `scene is not self._scene`, guarda la escena, calcula `limit` (con `inner` finito: `min(self.lookahead, max(0.0, inner - END_CLEARANCE))`; si no, `self.lookahead`) y haz `hits += 1` cuando `0.0 <= scene.island_end <= limit`, o `hits = 0` si no.
3. Después arma la puerta: `seen_again` es verdadero si `inner` es finito, menor que `ISLAND_OPEN` y `travelled >= ARM_DISTANCE`. Entonces `self.armed = self.armed or (seen_again and not arc)`.
4. `island_open` es `inner` finito y mayor que `ISLAND_OPEN`. Devuelve verdadero si la puerta está armada, no hay esquina en curso, `travelled >= ARM_DISTANCE`, `scene.front_axis <= self.turn_front` y (`island_open` o `hits >= CONFIRMATIONS`).
5. `corner_started` pone `armed = False`.

**Pistas para `drive.py`.**

- Quita la constante `TURN_FRONT` y el atributo `stopped`: ahora el coche no se detiene.
- Importa `LidarOdometry` (de `robotek_common.lidar_odometry`), `DISTANCE_MODEL_ACCEL` (de `robotek_common.vehicle`, junto a `WHEELBASE`) y `TurnGate` e `ISLAND_OPEN` (de `.turn_gate`). En `__init__` crea `self.gate = TurnGate()`, `self.odometry = LidarOdometry(accel=DISTANCE_MODEL_ACCEL)` y `self.travelled = 0.0`.
- `moved = self.odometry.read()` va **al principio** de `control`: la lectura se consume en cada tick y la distancia anterior a la calibración se descarta.
- La decisión es `self.gate.update(self.scene, inner, self.travelled, self.arc)` con `inner = self.scene.left` (la isla está a la izquierda). Si da verdadero: suma π/2 a la meta, `arc = True` y llama a `self.gate.corner_started()`.
- Al acabar la esquina, además de `arc = False` y `ref = goal`, pon `travelled = 0.0`.

Antes de abrir la referencia, corre las pruebas y mira cuáles pasan.

<details>
<summary>Ver la referencia de turn_gate.py</summary>

```python
import math

TURN_FRONT = 1.19        # m: the wall ahead (along the track) must be this near
LOOKAHEAD = 0.35         # m: the island's end must be this near (when it is visible)
END_CLEARANCE = 0.08     # m: in a narrow lane the look-ahead shrinks to (distance to the island - this)
CONFIRMATIONS = 2        # consecutive scans that must see the island's end close
ARM_DISTANCE = 0.25      # m driven after a corner before the next one may start
ISLAND_OPEN = 1.0        # m: an island wall farther than this beside the car means the island has ended


class TurnGate:
    """Decides, every tick, whether the car should start a corner.

    Feed it the latest ``Scene`` (a NEW object for every LiDAR scan), ``inner`` (the distance to the island wall:
    ``scene.left`` on a counter-clockwise lap, ``scene.right`` on a clockwise one), the metres driven since the last
    corner, and whether a corner is in progress. The corner is due when ALL of these hold:

    1. the gate is armed (a corner has not just been started, and the island has been seen again since);
    2. at least ``ARM_DISTANCE`` metres have been driven since the last corner;
    3. the wall ahead is near: ``scene.front_axis <= TURN_FRONT``;
    4. the island has ended: the side is open (``inner > ISLAND_OPEN``) or its end was seen close in
       ``CONFIRMATIONS`` different scans in a row.
    """

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

<details>
<summary>Ver la referencia de drive.py (versión de este paso)</summary>

Conserva del paso 5 los publicadores, `on_imu`, `on_start` y `main`. Estas son las partes que cambian.

Imports y constantes (`TURN_FRONT` ya no está en `drive.py`):

```python
from robotek_common.lidar_odometry import LidarOdometry
from robotek_common.vehicle import DISTANCE_MODEL_ACCEL, WHEELBASE
from robotek_course.minisim import STEER_LIMIT, Scene, real_speed, wrap

from .turn_gate import ISLAND_OPEN, TurnGate
```

En `__init__` (y se quita `self.stopped`):

```python
self.gate = TurnGate()               # decides when a corner starts
self.odometry = LidarOdometry(accel=DISTANCE_MODEL_ACCEL)      # how far the car has driven, from the scans
self.travelled = 0.0                 # m driven since the last corner
```

En `on_scan`, antes de comprobar la marca de tiempo:

```python
self.odometry.scan(msg, self.heading.yaw)
```

Y `control` queda así:

```python
def control(self):
    dt = 1.0 / CONTROL_RATE
    moved = self.odometry.read()          # metres driven since the previous tick
    speed, steer = 0.0, 0.0
    if self.time is not None:
        self.time += dt
        if self.time < CALIBRATE_SECONDS:
            self.samples.append(self.gyro)
        else:
            if self.samples:
                self.heading.calibrate(self.samples)
                self.samples = []
            yaw = self.heading.update(self.gyro, dt)
            gyro = self.gyro - self.heading.bias
            self.travelled += max(0.0, moved)
            inner = self.scene.left                                 # the island is on the left
            if self.gate.update(self.scene, inner, self.travelled, self.arc):
                self.goal = wrap(self.goal + math.pi / 2)
                self.arc = True
                self.gate.corner_started()
                self.get_logger().info('Giro a la izquierda (esquina %d)' % (self.corners + 1))
            if self.arc:
                rate = real_speed(SPEED) * math.tan(STEER_LIMIT) / WHEELBASE
                steer, self.ref = arc_steer(self.goal, self.ref, yaw, gyro, rate, dt, sign=1)
                speed = SPEED
                if abs(wrap(self.goal - yaw)) <= TURN_TOLERANCE:    # the corner is done
                    self.arc, self.ref, self.travelled = False, self.goal, 0.0
                    self.corners += 1
            else:
                island_open = math.isfinite(inner) and inner > ISLAND_OPEN
                keep = GAP if (not math.isfinite(inner) or island_open) else inner     # no offset at a corner
                speed, steer = SPEED, lane_steer(self.goal, yaw, keep, sign=1)
    cmd = Twist()
    cmd.linear.x = float(speed)
    cmd.angular.z = float(speed * math.tan(steer) / WHEELBASE)
    self.cmd.publish(cmd)
    self.odometry.command(speed, dt)
```

</details>

## Pruébalo

Primero las pruebas, sin ROS ni Gazebo (en macOS con RoboStack añade `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` delante):

```bash
python3 -m pytest course/tests/test_step_6.py -q
```

Debes ver `10 passed`. Son 10 pruebas con escenas armadas a mano. Cada una cambia una cosa y comprueba la respuesta de la puerta:

| Situación | Responde |
|---|---|
| todo se cumple, primer escaneo | `False` (el final de la isla se tiene que ver en 2 escaneos) |
| todo se cumple, segundo escaneo | `True` |
| el mismo escaneo repetido 5 veces | `False` las 5 veces |
| la pared de enfrente a 1,4 m | `False` |
| el final de la isla fuera de vista, o a 0,9 m | `False` |
| el lado de la isla abierto (1,6 m), sin ver el final | `True` |
| un escaneo sin ver el final entre dos que sí | la cuenta vuelve a empezar: `False` |
| recorridos solo 0,1 m desde la esquina | `False` |
| esquina en curso (`arc=True`) | `False` |
| tras `corner_started()` | cerrada hasta ver la isla de nuevo, y entonces `True` otra vez |
| isla a 0,30 m y final a 0,30 m, o a 0,20 m | `False` o `True` (límite de 0,22 m) |

Son once filas para diez pruebas: las dos primeras («todo se cumple») son una sola prueba con dos escaneos.

Después, compila y comprueba el paso en Gazebo, sin ventana:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash        # en macOS: source tools/macos_env.sh ~/robotek-ros/jazzy
python3 course/verify_step.py 6
```

Pasa si el coche da al menos 8 esquinas en 40 s de simulación sin tocar ninguna pared. Cada esquina se cuenta por el giro total del rumbo verdadero. En la referencia (Mac, coche real simulado, tres ejecuciones de tres) salió:

```text
Paso 6: PASS
  en 40 s: giro total ... = 14 esquinas (3.7 vueltas), 23.3 m recorridos
  [OK] da al menos 8 esquinas (da 14)
  [OK] no toca ninguna pared (distancia minima 0.220 m)
```

Son unas 14 esquinas (3,7 vueltas), 23,3 m recorridos y una distancia mínima a las paredes de 0,22 m, sin contacto.

Si prefieres ver el coche, lanza el simulador con ventana, tu nodo y Start en tres terminales (con `source` en cada una):

```bash
ros2 launch robotek_course sim.launch.py
ros2 run my_open drive --ros-args -p use_sim_time:=true
ros2 topic pub --once --qos-durability transient_local --qos-reliability reliable /start std_msgs/msg/Bool "{data: true}"
```

En la terminal del nodo aparece `Giro a la izquierda (esquina N)` en cada esquina.

### Rómpelo

Antes de cambiar nada, **predice** qué prueba falla. Después cámbialo en tu `turn_gate.py`, corre las pruebas y devuelve el cambio. Estos cambios se comprobaron con la referencia:

| Cambio | Prueba que falla |
|---|---|
| contar el escaneo en cada tick (`if True:` en vez de `scene is not self._scene`) | `test_the_same_scan_repeated_counts_once` |
| quitar `self.armed and` del `return` | `test_after_a_corner_the_gate_stays_shut_until_the_island_is_seen_again` |
| `ARM_DISTANCE = 0.0` | `test_the_car_must_have_driven_since_the_last_corner` |
| quitar el límite del pasillo estrecho (`limit = self.lookahead`) | `test_in_a_narrow_lane_the_lookahead_shrinks` |
| `CONFIRMATIONS = 1` | tres pruebas, entre ellas la de los dos escaneos |
| quitar la condición de la pared de enfrente | `test_the_wall_ahead_must_be_near` |

Tres de estos cambios están en el widget («Cambia la puerta»): contar en cada tick, quitar `armed` y `CONFIRMATIONS = 1`. Úsalos para ver **qué hace el coche** cuando falla cada una (por ejemplo, con «Contar en cada tick» gira un escaneo antes de tiempo).

Estas pruebas dicen que la puerta responde bien a escenas armadas a mano. No dicen que gire en el momento justo en Gazebo: eso lo comprueba `verify_step.py 6`.

## Si algo falla

- **Gira una vez y no vuelve a girar.** La puerta no se vuelve a armar. Revisa que `travelled` se ponga a 0 al acabar la esquina y luego suba (`odometry.read()` en cada tick, `odometry.scan` en `on_scan`), y que `inner` sea finito y menor que `ISLAND_OPEN` en la recta.
- **Gira dos veces seguidas o a destiempo.** Revisa que la cuenta sea por objeto (`scene is not self._scene`) y que llames a `gate.corner_started()` al empezar la esquina.
- **Choca con la pared de enfrente.** La pared se mide con `forward_yaw=wrap(self.goal - self.heading.yaw)`, como en el paso 5. Y revisa que `TurnGate` use `scene.front_axis`, no `scene.left`.
- **Se come la isla.** Mira la condición del final de la isla: el rango es `0.0 <= scene.island_end <= limit`, y `limit` baja en un pasillo estrecho.
- **En la esquina el coche se desvía hacia donde no hay nada.** Falta el `keep = GAP` cuando `inner` no es finito o es mayor que `ISLAND_OPEN`.
- **El coche no se mueve.** No le llegó Start. Revisa que `on_start` esté suscrito al tópico `start`.

## Compara

Lo que cambia la referencia respecto al paso 5, y tu árbol contra el paso 6:

```bash
bash tools/compare-step.sh 5 6
bash tools/compare-step.sh 6
```

Importa comparar `turn_gate.py`. En `drive.py` fíjate en que `self.travelled` se reinicia al acabar la esquina y en que `odometry.command` es lo último que se llama en `control`.

## Resumen

- Una sola medida no basta para girar: la puerta exige armada, recorrido, pared cerca e isla terminada, todo a la vez.
- Cada escaneo cuenta una vez (por objeto `Scene`), aunque el control lo vea 5 ticks; la isla terminada necesita lado abierto o 2 escaneos seguidos con el final cerca.
- Tras cada giro la puerta se cierra hasta ver la isla otra vez; la distancia recorrida sale del LiDAR.

## Antes de seguir

- [ ] `pytest course/tests/test_step_6.py` da `10 passed`.
- [ ] `python3 course/verify_step.py 6` da `PASS` (al menos 8 esquinas en 40 s, sin contacto).
- [ ] Puedes decir qué prueba falla si cuentas la escena en cada tick, y por qué.
