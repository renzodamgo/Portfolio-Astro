---
guide: "open-strategy"
order: 2
slug: "paso-2-el-rumbo"
title: "El rumbo (giroscopio)"
summary: "Estima hacia dónde apunta el coche integrando el giroscopio."
tag: "step-2"
compareFrom: "step-1"
---

El coche no tiene brújula. Para saber hacia dónde mira solo cuenta con el giroscopio, un sensor que dice a qué velocidad gira (en rad/s). En este paso escribes `GyroHeading`, que suma esas lecturas para obtener el **rumbo**, y `heading_steer`, que gira el volante para volver al rumbo que quieres. El giroscopio tiene un error constante, y verás por qué hay que medirlo antes de arrancar.

## Lo que vas a ver

En Gazebo, en un campo sin paredes, el coche espera Start, se queda quieto 0,6 s midiendo el giroscopio, y luego avanza intentando ir recto (rumbo 0) durante 10 s. La comprobación compara el rumbo **real** del coche al final, que tu nodo no ve. Con calibración, el error es de unas milésimas de radián. Sin calibrar (`calibrate:=false`), el coche cree ir recto pero termina torcido unos **0,06 rad (3,4°)**.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-2.json"></div>

*Repetición del mini simulador (Python, no Gazebo): la misma recta con y sin calibrar el giroscopio. El coche rojo, sin calibrar, se desvía hacia un lado mientras cree ir recto.*

## La idea

### El rumbo es una suma

El giroscopio mide la velocidad de giro `gyro` en rad/s. Si la sumas en cada instante multiplicada por el tiempo `dt`, obtienes cuánto ha girado el coche desde que empezó: el rumbo (`yaw`, en radianes, cero en Start, positivo hacia la izquierda). Es lo mismo que el cuentakilómetros, que suma velocidad por tiempo para dar distancia.

```text
yaw = yaw + gyro * dt
```

Es una integral. Cada lectura aporta un poquito, y los errores pequeños se acumulan.

### El sesgo del giroscopio

El giroscopio del coche tiene un **sesgo**: un error constante de unos 0,006 rad/s. Con el coche quieto dice «estoy girando 0,006 rad/s». Si lo sumas 10 s, el coche cree que ha girado 0,06 rad (3,4°) sin moverse. Además de ese sesgo hay **ruido** (unos 0,0019 rad/s) que cambia en cada lectura.

La solución es medir el sesgo cuando sabes que el coche está quieto y restarlo. Con el coche parado, la lectura **es** el sesgo (más ruido), así que basta el **promedio** de unas cuantas lecturas. Ese promedio también contiene algo de ruido, pero menos: con N lecturas el ruido del promedio baja unas √N veces. Con 30 lecturas (0,6 s a 50 por segundo) queda en unos 0,00035 rad/s, más de cinco veces menos que el ruido de una sola.

<div data-widget="gyro-drift"></div>

**Prueba esto** con la figura (los botones de arriba ponen los valores del coche real):

1. Con sesgo 0,006 y la calibración apagada, mira el rumbo real a los 10 s: unos −3,4° (0,06 rad). Mientras, la línea azul (lo que cree el coche) se queda cerca de 0.
2. Enciende la calibración: el error baja a décimas de grado.
3. Sube el **ruido** y pulsa **Otro ruido** varias veces: la calibración falla un poco más cuanto más ruido hay, y cambia de una semilla a otra.
4. Pon el sesgo en 0: no hay nada que corregir y calibrar da igual.

### Por qué el coche no se da cuenta

Sin calibrar, el rumbo que cree el coche (la línea azul de la figura) se separa cada vez más del real (la línea ámbar). La ley de control mantiene **el rumbo estimado** en 0, así que el coche corrige un error que no existe y deja que crezca el real. Esa es la razón de calibrar: nada dentro del coche te avisa del error. Con 0,06 rad de error, tras seguir una recta durante 6 m terminas a unos 0,35 m del camino.

### Volver al rumbo: una ley proporcional

Para ir a un rumbo `goal`, la ley más sencilla pone el volante **proporcional al error**:

```text
volante = KP * (goal - yaw)          KP = 0,8, y nunca más que el tope del volante (17,6°)
```

Si el error es de 0,1 rad el volante gira 0,08 rad; si el error es grande, el volante llega al tope y no pasa de él (`STEER_LIMIT = 0.30718`). Como `yaw` y `goal` son ángulos, un error positivo significa «la meta está a la izquierda» y el volante gira a la izquierda.

Hay un detalle con los ángulos. 3 rad y -3 rad parecen estar a 6 rad de distancia, pero en un círculo están a solo 0,28 rad, al otro lado de ±π. `wrap` (ya hecha en `robotek_course.minisim`) lleva la diferencia al intervalo de -π a π. Aplícala siempre a `goal - yaw`.

<div data-widget="heading-law"></div>

**Prueba esto**: pulsa **Meta 3 rad, coche en −3 rad**. Con `wrap` el volante gira un poco a la derecha (el camino corto, 0,28 rad). Quita la marca de `wrap`: el volante se va al tope hacia la izquierda y el coche daría casi una vuelta entera por el camino largo.

## Escríbelo

Dos archivos en `src/my_open/my_open/`:

- **`heading.py`** (nuevo): es el ejercicio. Importa `STEER_LIMIT`, `clamp` y `wrap` de `robotek_course.minisim`.
- **`drive.py`**: reemplázalo por el de abajo (el nodo, completo).

**Pistas, por partes.**

1. **`GyroHeading.__init__`.** Dos números: `bias = 0.0` y `yaw = 0.0`.
2. **`calibrate(samples)`.** El sesgo es el promedio de las lecturas: `sum(samples) / len(samples)`.
3. **`update(gyro, dt)`.** Suma `(gyro - self.bias) * dt` a `self.yaw` y devuelve `self.yaw`.
4. **`heading_steer(goal, yaw)`.** `KP * wrap(goal - yaw)`, recortado entre `-STEER_LIMIT` y `STEER_LIMIT` con `clamp`.

Antes de abrir la referencia, ejecuta las pruebas y mira cuáles pasan (`python3 -m pytest course/tests/test_step_2.py -q`).

<details>
<summary>Ver la referencia de heading.py</summary>

```python
"""Step 2 - The heading: integrate the gyroscope and steer back to a goal heading."""

from robotek_course.minisim import STEER_LIMIT, clamp, wrap

KP = 0.8     # steering (rad) per radian of heading error


class GyroHeading:
    """The car's heading, from the gyroscope alone (the car has no compass)."""

    def __init__(self):
        self.bias = 0.0      # the gyroscope's constant error (rad/s), measured while the car is still
        self.yaw = 0.0       # rad, zero at Start

    def calibrate(self, samples):
        """``samples``: gyroscope readings taken with the car standing still. Their mean is the bias."""
        self.bias = sum(samples) / len(samples)

    def update(self, gyro, dt):
        """Add the rotation of this tick (the reading without the bias) to the heading; returns the heading."""
        self.yaw += (gyro - self.bias) * dt
        return self.yaw


def heading_steer(goal, yaw):
    """Steering angle that brings the heading ``yaw`` towards ``goal``: proportional to the error, within full lock."""
    return clamp(KP * wrap(goal - yaw), -STEER_LIMIT, STEER_LIMIT)
```

</details>

<details>
<summary>Ver la referencia de drive.py (versión de este paso)</summary>

El nodo escucha el IMU (el sensor de movimiento del coche, que publica el giroscopio en `/imu`) y Start. Tiene tres fases:

```text
antes de Start: quieto  ->  tras Start, 0,6 s quieto guardando lecturas  ->  calibra una vez y conduce
```

En cada tick de conducción integra el giroscopio y manda `SPEED` con el volante que pide `heading_steer(0.0, yaw)`. El parámetro `calibrate` (por defecto `True`) permite saltarse la calibración para ver la deriva.

```python
"""Step 2: stand still to measure the gyroscope bias, then drive straight holding heading 0."""
import math

from geometry_msgs.msg import Twist
import rclpy
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import Imu
from std_msgs.msg import Bool

from robotek_common.vehicle import WHEELBASE

from .heading import GyroHeading, heading_steer

CONTROL_RATE = 50.0       # Hz, on the simulation clock
SPEED = 0.6               # m/s commanded
CALIBRATE_SECONDS = 0.6   # standing still after Start, measuring the gyroscope bias


class Drive(Node):
    def __init__(self):
        super().__init__('strategy')
        self.calibrate = self.declare_parameter('calibrate', True).value    # False: see the drift
        self.heading = GyroHeading()
        self.gyro = 0.0                      # the latest reading of the gyroscope, rad/s
        self.samples = []                    # readings taken while standing still
        self.time = None                     # seconds since Start (None before Start)
        self.cmd = self.create_publisher(Twist, '/cmd_vel_raw', 10)
        self.create_subscription(Imu, '/imu', self.on_imu, qos_profile_sensor_data)
        self.create_subscription(Bool, 'start', self.on_start, 10)   # plain QoS: works with the referee and with the car's button
        self.create_timer(1.0 / CONTROL_RATE, self.control)

    def on_imu(self, msg):
        self.gyro = msg.angular_velocity.z

    def on_start(self, msg):
        if msg.data and self.time is None:
            self.get_logger().info('Start: quieto %.1f s para medir el sesgo del giroscopio' % CALIBRATE_SECONDS)
            self.time = 0.0

    def control(self):
        dt = 1.0 / CONTROL_RATE
        speed, steer = 0.0, 0.0
        if self.time is not None:
            self.time += dt
            if self.time < CALIBRATE_SECONDS:
                self.samples.append(self.gyro)
            else:
                if self.samples:
                    if self.calibrate:
                        self.heading.calibrate(self.samples)
                    self.get_logger().info('Sesgo del giroscopio: %.4f rad/s' % self.heading.bias)
                    self.samples = []
                yaw = self.heading.update(self.gyro, dt)
                speed, steer = SPEED, heading_steer(0.0, yaw)
        cmd = Twist()
        cmd.linear.x = float(speed)
        cmd.angular.z = float(speed * math.tan(steer) / WHEELBASE)
        self.cmd.publish(cmd)


def main(args=None):
    rclpy.init(args=args)
    node = Drive()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, RuntimeError):
        pass
    finally:
        if rclpy.ok():
            node.cmd.publish(Twist())       # leave the car stopped
        rclpy.try_shutdown()
```

Los tópicos y el nodo son los del paso 1. El bucle de control va a 50 Hz con el reloj de simulación (`use_sim_time`), y por eso `dt` es fijo, `1/50`. La estrategia final espera solo 0,3 s en el paso 7; aquí son 0,6 s para tener unas 30 lecturas (el nodo guarda 29: el último tick cae justo en 0,6 s y ya no cuenta).

</details>

## Pruébalo

Primero las pruebas, sin ROS ni Gazebo:

```bash
python3 -m pytest course/tests/test_step_2.py -q
```

En macOS con RoboStack pon `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` delante. Debes ver `7 passed`. Las siete pruebas comprueban que:

- la calibración mide el sesgo;
- el rumbo es la integral del giroscopio sin el sesgo;
- sin calibrar, el sesgo se convierte en deriva (0,06 rad en 10 s quieto);
- el volante apunta a la meta con `KP = 0,8`;
- nunca pasa del tope y toma el camino corto al cruzar ±π;
- el coche vuelve al rumbo de la meta;
- la calibración es lo que lo mantiene recto en el mini simulador, con el servo y el giroscopio reales: sin calibrar termina a unos 3,3° del rumbo, calibrado a 0,1°.

Después, compila y comprueba el paso en Gazebo, sin ventana y con el campo vacío:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash        # en macOS: source tools/macos_env.sh ~/robotek-ros/jazzy
python3 course/verify_step.py 2 --compare
```

`--compare` corre el paso dos veces: con calibración (esa decide PASS o FAIL: el error de rumbo debe ser menor que 0,03 rad) y con `calibrate:=false` (solo informa la deriva). Los números de la referencia, con el rumbo **real** del coche al final de los 10 s:

| Caso | Error de rumbo real |
|---|---:|
| con calibración | menos de 0,005 rad (0,3°) |
| sin calibrar (`calibrate:=false`) | 0,053 a 0,060 rad (3,0° a 3,4°) |

Con calibración, el valor exacto cambia de una ejecución a otra porque el ruido del giroscopio no se repite (en cuatro ejecuciones: −0,0021, −0,0012, 0,0000 y +0,0045 rad). El signo de la deriva depende del signo del sesgo; lo que importa es su tamaño.

Cuando termines, compara con la referencia con la caja «Los cambios de este paso», al final de la página. Lo que importa comparar es `heading.py`; en `drive.py` es normal ver diferencias de formato, pero lo esencial es que el coche espere, calibre una sola vez y luego integre en cada tick.

### Rómpelo

1. **Pocas muestras.** En `course/tests/helpers.py`, dentro de `drive_straight`, cambia `resting_gyro(30)` por `resting_gyro(1)` y ejecuta `test_calibration_is_what_keeps_the_car_straight`. Con una sola lectura el error calibrado sube de 0,1° a 1,0° y la prueba **falla** (su límite es 0,01 rad, unos 0,57°). Con 3 lecturas pasa, pero el error medio con 8 semillas es de **0,46°** (máximo 0,91°) en lugar de **0,10°** (máximo 0,25°). Sigue siendo mucho mejor que sin calibrar (3,3°), pero 5 veces peor. ¿Por qué sale mejor cuantas más muestras? El ruido del giroscopio también entra en el promedio, y un promedio de más lecturas lo reduce. Deshaz el cambio al terminar.
2. **Sin `wrap`.** Quita `wrap` de `heading_steer` y corre `test_steering_never_exceeds_full_lock_and_takes_the_short_way_round`. Debe fallar en la última línea: con la meta en 3 rad y el coche en −3, sin `wrap` el volante gira al tope hacia la izquierda (el camino largo) en lugar de a la derecha. Es lo que viste en la figura de arriba.

## Si algo falla

- **El coche no se mueve nunca.** No le llegó Start. Revisa que el nodo se llame `strategy`, que `on_start` esté suscrito al tópico `start` y que en `drive.log` aparezca `Start: quieto 0.6 s...`.
- **Con calibración el error es grande (más de 0,03 rad).** Mira que `calibrate` use el promedio de las lecturas y que `update` **reste** el sesgo. También que el nodo guarde lecturas del IMU (`on_imu`) antes de calibrar: sin muestras no hay sesgo.
- **El coche gira en círculos en vez de ir recto.** Casi siempre es el signo: `heading_steer(goal, yaw)` debe ser `goal - yaw`, no al revés.
- **El registro dice `Sesgo del giroscopio: 0.0000`.** No llegan lecturas del IMU (o corriste con `calibrate:=false`). Revisa la suscripción a `/imu`.
- **`ya hay un gz sim en marcha`.** Cierra el otro simulador, o usa `--wait`.

## Resumen

- El rumbo es la suma de `(gyro - sesgo) * dt`; el sesgo del giroscopio (unos 0,006 rad/s) hace que el coche se tuerza unos 3° en 10 s si no lo restas.
- Se mide con el coche quieto, promediando unas 30 lecturas, y nada dentro del coche avisa si no se hizo.
- `heading_steer` pone el volante proporcional al error (`KP = 0,8`), con `wrap` para el camino corto y el tope del volante.

## Antes de seguir

- [ ] `pytest` marca `7 passed`.
- [ ] `verify_step.py 2 --compare` da PASS con calibración y una deriva cercana a 0,06 rad sin ella.
- [ ] Puedes explicar por qué el coche sin calibrar «cree» ir recto.
