---
guide: "open-strategy"
order: 1
slug: "paso-1-el-coche"
title: "El coche (modelo de bicicleta)"
summary: "Modela cómo gira un coche con dirección Ackermann."
tag: "step-1"
compareFrom: "step-0"
---

Antes de que el coche mire nada, necesita saber qué hace su propio volante. En este paso escribes el **modelo de bicicleta**: tres funciones que convierten un ángulo de dirección en un giro. Con él predices el radio del círculo que dibuja el coche, y después lo comparas con el coche en Gazebo.

## Lo que vas a ver

En Gazebo, en un campo sin paredes, el coche espera Start, fija el volante a un ángulo (0,25 rad por defecto) y avanza en círculos. La comprobación ajusta una circunferencia a la trayectoria real y la compara con lo que predice tu `turn_radius`. La meta es una diferencia **menor que el 4 %**; en la referencia sale por debajo del 1 %.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-1.json"></div>

*Repetición del mini simulador: el coche da vueltas con la dirección fija. El fantasma es el modelo ideal, sin el retraso del servo.*

## La idea

### Un coche con dirección Ackermann es una bicicleta

El coche tiene dos ruedas delanteras que giran y dos traseras que no. Para calcular el giro se simplifica a una bicicleta: **una rueda trasera fija y una delantera que gira un ángulo `δ`** (en el código, `steer`, en radianes, positivo hacia la izquierda). La distancia entre los dos ejes es `L = 0,1174 m` (`WHEELBASE`).

<div data-widget="bicycle"></div>

Mueve el control **Ángulo de las ruedas** y mira el radio del círculo. Prueba cuánto vale para que el radio sea de 0,46 m (la referencia usa 0,25 rad, unos 14,3°) y pulsa **Dar una vuelta**.

Con el coche a velocidad `v` y las ruedas delanteras a `δ`, las fórmulas son:

```text
velocidad de giro (rad/s) = v * tan(δ) / L
radio del círculo (m)     = L / tan(δ)
```

Con las ruedas rectas (`δ = 0`) el radio es infinito: el coche va recto. Un coche parado (`v = 0`) no gira, aunque tenga el volante a tope.

### Por qué la estrategia lo necesita

Tu estrategia decide un **ángulo de volante**. Pero el coche no recibe ángulos: recibe un mensaje `Twist` con una velocidad `linear.x` y una velocidad de giro `angular.z`. La conversión es la primera fórmula:

```python
cmd.linear.x = speed
cmd.angular.z = speed * math.tan(steer) / WHEELBASE
```

Cada paso del curso termina con esa línea en `drive.py`. El simulador hace lo contrario: de la velocidad de giro que le pides saca el ángulo de las ruedas.

### Avanzar un instante: primero el rumbo, luego la posición

`bicycle_step` hace avanzar el coche `dt` segundos. El orden importa: primero se actualiza el rumbo con la velocidad de giro, y la posición se mueve **a lo largo del rumbo nuevo**. Si usas el rumbo viejo sale un resultado ligeramente distinto, y la prueba que compara con el mini simulador falla.

### El límite del volante real

El servo del coche real no llega a los 25° del simulador. Su tope son **17,6°** (`REAL_STEER_LIMIT = 0.30718` rad, en `robotek_common/vehicle.py`). Con ese ángulo el radio mínimo es `0,1174 / tan(0,30718) = 0,370 m`. Es el círculo más cerrado que puede hacer el coche; una esquina no se puede girar más estrecha que eso. En el widget, el botón **Tope del coche real** te lleva a ese ángulo.

Por eso el parámetro `steer` del nodo vale 0,25 rad por defecto y no 0,3. En Gazebo, con 0,3 rad el radio medido sale un **13 % mayor** que el del modelo (0,43 m frente a 0,38 m). El modelo de actuadores del simulador convierte la velocidad de giro que le pides en un ángulo con su propia distancia entre ejes (0,13 m), lo que multiplica el ángulo por 1,107, y después lo recorta a 0,307 rad. Por eso el recorte empieza a notarse desde unos 0,278 rad y no desde 0,307. A plena dirección el radio real en Gazebo es de unos 0,42 a 0,43 m, no los 0,370 m del modelo. No es un fallo de tu modelo: es el tope del servo. Con 0,25 rad queda por debajo y el modelo acierta.

## Escríbelo

Crea dos archivos en `src/my_open/my_open/`: `model.py` y, en lugar del `drive.py` que creó `ros2 pkg create`, el de abajo. El ejercicio es **`model.py`**; `drive.py` es el nodo y lo tienes completo.

`model.py` tiene tres funciones. Importa la distancia entre ejes con `from robotek_course.minisim import WHEELBASE`.

**Pistas, función por función.**

1. **`yaw_rate(speed, steer)`.** Es la primera fórmula: `speed * tan(steer) / WHEELBASE`. Con `steer` negativo sale negativa (giro a la derecha).
2. **`bicycle_step(x, y, yaw, speed, steer, dt)`.** Calcula primero el rumbo nuevo: `yaw + yaw_rate * dt`. Luego suma a `x` el avance `speed * cos(yaw) * dt` y a `y` el avance `speed * sin(yaw) * dt`, usando el rumbo **nuevo**. Devuelve `(x, y, yaw)`.
3. **`turn_radius(steer)`.** Es la segunda fórmula, con el valor absoluto del ángulo: el círculo a la izquierda y a la derecha tiene el mismo radio.

Antes de abrir la referencia, ejecuta las pruebas y mira cuáles pasan.

<details>
<summary>Ver la referencia de model.py</summary>

```python
"""Step 1 - The car: how the steering angle becomes a turn (the bicycle model)."""
import math

from robotek_course.minisim import WHEELBASE


def yaw_rate(speed, steer):
    """How fast the car rotates (rad/s) when it drives at ``speed`` (m/s) with the front wheels at ``steer`` (rad)."""
    return speed * math.tan(steer) / WHEELBASE


def bicycle_step(x, y, yaw, speed, steer, dt):
    """Advance the car dt seconds: first the heading, then the position along the new heading."""
    yaw = yaw + yaw_rate(speed, steer) * dt
    return x + speed * math.cos(yaw) * dt, y + speed * math.sin(yaw) * dt, yaw


def turn_radius(steer):
    """Radius (m) of the circle the car draws with the wheels fixed at ``steer`` (rad)."""
    return WHEELBASE / math.tan(abs(steer))
```

</details>

<details>
<summary>Ver la referencia de drive.py (versión de este paso)</summary>

El nodo se llama `strategy` (así lo buscan las herramientas del curso), publica en `/cmd_vel_raw` y espera Start en el tópico `start`. Al recibir Start escribe en el registro el radio que predice tu modelo, y desde ese momento manda `SPEED` con el volante fijo. El tópico `start` usa calidad de servicio `TRANSIENT_LOCAL`: si el nodo arranca un poco tarde, igual recibe el último mensaje.

```python
"""Step 1: drive a circle with the wheels fixed and compare it with the bicycle model."""
import math

from geometry_msgs.msg import Twist
import rclpy
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile
from std_msgs.msg import Bool

from robotek_common.vehicle import WHEELBASE

from .model import turn_radius

CONTROL_RATE = 50.0       # Hz, on the simulation clock
SPEED = 0.6               # m/s commanded (the real car reaches 0.42 m/s with this command)


class Drive(Node):
    def __init__(self):
        super().__init__('strategy')
        self.steer = self.declare_parameter('steer', 0.25).value      # rad, positive = left
        self.started = False
        self.cmd = self.create_publisher(Twist, '/cmd_vel_raw', 10)
        self.create_subscription(Bool, 'start', self.on_start,
                                 QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL))
        self.create_timer(1.0 / CONTROL_RATE, self.control)

    def on_start(self, msg):
        if msg.data and not self.started:
            self.started = True
            self.get_logger().info('Start: con el volante a %.2f rad el modelo espera un circulo de radio %.3f m'
                                   % (self.steer, turn_radius(self.steer)))

    def control(self):
        cmd = Twist()
        if self.started:
            cmd.linear.x = SPEED
            cmd.angular.z = SPEED * math.tan(self.steer) / WHEELBASE
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

`SPEED = 0.6` es la velocidad **ordenada**. Con el motor medido del coche real, 0,6 llega a 0,42 m/s. El parámetro `steer` se puede cambiar al lanzar el nodo (`-p steer:=0.2`).

</details>

## Pruébalo

Primero las pruebas, sin ROS ni Gazebo:

```bash
python3 -m pytest course/tests/test_step_1.py -q
```

En macOS con RoboStack añade `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` delante del comando. Son 5 pruebas: sin volante el coche va recto, la velocidad de giro con el volante a tope (entre 1,6 y 1,65 rad/s a 0,6 m/s), el círculo más pequeño (0,370 m), un círculo completo que vuelve al punto de partida (a menos de 3 cm) y el acuerdo con el coche del mini simulador.

Después, compila y comprueba el paso en Gazebo, sin ventana y con el campo vacío:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash
python3 course/verify_step.py 1
```

Arranca el simulador y tu nodo, publica Start, graba la pose real del coche (tu nodo no la ve), ajusta un círculo y escribe `PASS` o `FAIL` con los números. El campo va sin paredes porque un círculo no cabe en un pasillo de 1 m. Puedes cambiar el volante con `--param steer:=0.2`. En la referencia midió, con el modelo de actuadores del coche real:

| Volante (rad) | Radio del modelo | Radio medido | Diferencia |
|---:|---:|---:|---:|
| 0,10 | 1,170 m | 1,172 m | menos del 1 % |
| 0,20 | 0,579 m | 0,582 m | menos del 1 % |
| 0,25 | 0,460 m | 0,463 m | menos del 1 % |
| 0,30 | 0,380 m | 0,43 m | +13 % (el tope del servo, ver arriba) |

Si prefieres ver el coche, lanza el simulador con ventana sobre el campo vacío, tu nodo y Start en tres terminales:

```bash
python3 course/verify_step.py --empty-world /tmp/empty_field.sdf
ros2 launch robotek_course sim.launch.py world:=/tmp/empty_field.sdf
ros2 run my_open drive --ros-args -p use_sim_time:=true -p steer:=0.2
ros2 topic pub --once --qos-durability transient_local --qos-reliability reliable /start std_msgs/msg/Bool "{data: true}"
```

El primer comando escribe el mundo; los otros tres van cada uno en su terminal.

### Rómpelo

Cambia `math.tan(steer)` por `steer` en `yaw_rate` y en `turn_radius`. Con ángulos pequeños casi no se nota (a 0,1 rad el radio pasa de 1,169 m a 1,174 m). Con el volante a tope, el radio mínimo pasa de 0,370 m a 0,382 m, un 3 % más. ¿Qué prueba te avisa?

Otro: en `bicycle_step`, mueve la posición con el rumbo **viejo**. Todas las pruebas pasan menos `test_agrees_with_the_mini_car`: la diferencia es de unos milímetros en 1 s, pero el coche del simulador usa el rumbo nuevo.

## Si algo falla

- **`ModuleNotFoundError: my_open`.** Ejecuta pytest desde la raíz del repositorio; el archivo `course/tests/conftest.py` encuentra los paquetes en `src/`.
- **El coche no se mueve nunca.** No le llegó Start. Revisa que el nodo se llame `strategy`, que `on_start` use `TRANSIENT_LOCAL` y que en `drive.log` aparezca la línea `Start: ...`.
- **`FALLA` con un radio un 13 % mayor.** Estás usando `steer:=0.3` o más: es el tope del servo, no un error tuyo. Baja a 0,25.
- **`FALLA` con un radio distinto al esperado, con un volante pequeño.** Revisa `turn_radius`: debe usar `tan` y el valor absoluto, y `WHEELBASE` es 0,1174 m.
- **`ya hay un gz sim en marcha`.** Cierra el otro simulador, o usa `--wait` para esperar a que termine.

## Compara

Lo que cambia la referencia respecto al paso 0, y tu árbol contra el paso 1:

```bash
bash tools/compare-step.sh 0 1
bash tools/compare-step.sh 1
```

Lo que importa comparar es `model.py`. En `drive.py` es normal ver diferencias de formato, pero el cálculo `speed * tan(steer) / WHEELBASE` debe ser el mismo.
