---
guide: "open-strategy"
order: 11
slug: "paso-11-solucion-de-problemas"
title: "Solución de problemas del coche real"
summary: "Qué hacer si el coche se estrella al arrancar, vuelca, el giroscopio está invertido o no hay datos de un sensor."
tag: "step-9"
compareFrom: "step-9"
---

Este capítulo es el que abres cuando el coche real **no hace lo que esperabas**. No hace falta leerlo en orden: busca tu síntoma en la tabla, salta al caso y sigue la receta. Cada caso tiene la misma forma:

1. **Cómo se ve**: lo que observas desde fuera.
2. **Causas**, de la más a la menos probable.
3. **Diagnostica**: comandos exactos, qué número esperar y una prueba a mano con el coche en el aire.
4. **Arréglalo**: qué clave de `src/robotek_hardware/config/robot.yaml` o qué constante de tu código cambia, y qué efecto tiene.
5. **Comprueba que quedó**: la prueba que te dice que ya está.

> **Cuánto te puedes fiar de cada arreglo.** Pongo una etiqueta en cada hecho importante:
>
> - `[coche]`: el equipo lo vio o lo midió en el coche real.
> - `[sim]`: se probó en el simulador o con pruebas sin hardware, no en el coche.
> - `[código]`: lo deduzco leyendo el código o con cuentas. Es razonable, pero **nadie lo ha comprobado en el coche**. Trátalo como una hipótesis y mídelo.
>
> Los comandos y los scripts de este capítulo están escritos a partir del código del coche y de las notas del equipo, pero **no se han ejecutado en el coche real**. Si algo no sale como lo cuento, dímelo.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/E-9Dan5Tjb4" title="ROS2 Basics #14 - ROS2 tools - RQt and Ros2bag" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>ROS2 Basics #14 - ROS2 tools - RQt and Ros2bag</strong> · BotBuilder (inglés). rqt_graph, rqt_console, rqt_plot y ros2 bag para ver qué pasa dentro del sistema.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Tres reglas antes de tocar nada

1. **Primero con el coche en el aire.** Apóyalo sobre una caja para que las ruedas no toquen la mesa. Casi todo lo de aquí (sentido del servo, sentido del motor, ejes del giroscopio) se comprueba sin que el coche se mueva del sitio.
2. **Primeras rondas con el motor limitado.** `motor_max_pct` en `robot.yaml` es el tope de potencia. Con 40 por ciento el coche del equipo completó una ronda; con 90 por ciento se estrelló `[coche]`. Empieza en 30 o 40 y sube de cinco en cinco.
3. **Un cambio cada vez, y anota la batería.** La velocidad del coche depende de la carga (caso 5). Si cambias dos cosas y la ronda mejora, no sabrás cuál fue.

**Ten siempre la mano lista para parar.** Una segunda pulsación del botón de la placa publica `/robotek/stop`: el motor se corta al instante y no vuelve hasta relanzar `[coche]` (se añadió porque en la primera ronda el coche chocó y no había forma de detenerlo). Ojo con el antirrebote: una segunda pulsación en menos de 1,5 s se ignora. En una ronda oficial, qué cuenta como parar el coche lo decide el reglamento y el árbitro: pregúntalo antes.

## Lo que le pasó al coche del equipo

Estos son los ocho intentos con la estrategia completa del equipo en el coche real, en una tarde. Sirven de mapa: casi todos los casos de abajo salieron de aquí. Los puntos son estimaciones a partir de lo que vio el operador, sin juez.

| Intento | Qué pasó | Causa | Caso |
|---|---|---|---|
| 1 | Se estrelló de frente a los 2,9 s, antes de la primera esquina | La cámara decidió mal el sentido: la pared beige de la sala, sobre el muro negro, entró en el rango naranja | 2, 10 |
| 2 | Completó las tres vueltas en 47,1 s, unos 27 puntos | Motor al 40 por ciento, batería muy baja (6,66 V) | 5, 13 |
| 3 y 4 | No se movió; la estrategia se detuvo sola (`STALLED`) | Cable del motor suelto. El intento 3 además tuvo un Start que nadie pidió | 1, 8 |
| 5 | Se reinició el Pi a los 73 s | Motor al 80 por ciento con la batería en 6,5 V; causa no aislada | 12 |
| 6 | No se movió; el sentido tardó 12,4 s | Cable suelto y una línea naranja corta a la vista | 8, 10 |
| 7 | Mucho más rápido que antes y chocó con un muro | Motor al 90 por ciento con la batería cargada; el operador paró el coche cortando la alimentación y se perdieron los datos | 5, 12 |
| 8 | Completó en 40,4 s, unos 27 puntos, con dos roces a la isla | Motor al 50 por ciento, batería en 7,4 V | 14 |

## Índice de síntomas

| Lo que ves | Caso |
|---|---|
| Pulso el botón y no pasa nada | [1](#caso-1-no-pasa-nada-al-pulsar-el-botón) |
| Arranca solo, sin que nadie pulse | [1](#caso-1-no-pasa-nada-al-pulsar-el-botón) |
| Choca con el muro en los primeros segundos | [2](#caso-2-se-estrella-nada-más-arrancar) |
| Gira al lado contrario, da círculos o va hacia la isla | [3](#caso-3-gira-al-lado-contrario-da-círculos-o-va-hacia-la-isla) |
| Gira al lado contrario solo en las esquinas, o la esquina nunca acaba | [4](#caso-4-el-giroscopio-está-invertido-o-con-los-ejes-mal) |
| Se levanta de morro, derrapa o vuelca | [5](#caso-5-se-encabrita-derrapa-o-vuelca) |
| No gira lo suficiente, o gira demasiado | [6](#caso-6-no-gira-lo-suficiente-o-gira-demasiado) |
| El servo vibra, zumba, se calienta o va lento | [7](#caso-7-el-servo-vibra-zumba-se-calienta-o-va-lento) |
| El motor no mueve, va a tirones, gira al revés o va más lento de lo pedido | [8](#caso-8-el-motor) |
| No hay LiDAR, va rotado, espejado o con huecos | [9](#caso-9-lidar) |
| No hay imagen, los colores salen cambiados o el sentido se decide mal o tarde | [10](#caso-10-cámara-y-sentido-de-la-vuelta) |
| El rumbo se desvía solo, mucho ruido o unidades raras | [11](#caso-11-giroscopio-sesgo-ruido-y-unidades) |
| La placa o el Pi se reinicia, o un USB se cae | [12](#caso-12-reinicios-y-usb-que-se-caen) |
| Se para antes de acabar, no para o se pasa de la sección de salida | [13](#caso-13-paradas-y-final-de-la-ronda) |
| Roza la isla o el muro exterior en las esquinas | [14](#caso-14-roza-la-isla-o-el-muro-exterior-en-las-esquinas) |
| Funciona en el simulador y no en el coche | [15](#caso-15-funciona-en-el-simulador-y-no-en-el-coche) |
| No veo los tópicos desde mi portátil, o llegan tarde | [16](#caso-16-red-latencia-y-ros_domain_id) |
| Un nodo se cae con un error | [17](#caso-17-un-nodo-se-cae) |
| Los LED parpadean en rojo | [18](#caso-18-aviso-de-batería-baja) |

## Herramientas que usarás todo el rato

Con el coche lanzado (`ros2 launch robotek_course car.launch.py strategy:=my_open`) y el entorno cargado en **cada** terminal:

```bash
ros2 node list                         # qué nodos viven
ros2 topic hz /robotek/imu             # a cuántos hercios llega
ros2 topic echo /robotek/state         # en qué estado está tu estrategia
ros2 topic echo /cmd_vel_raw           # lo que pide tu estrategia (angular.z > 0 es a la izquierda)
ros2 topic info -v /start              # quién publica y quién escucha, con su QoS
ros2 topic echo --field angular_velocity.z /robotek/imu
```

El tópico `/robotek/state` es el más útil. Una ronda sana pasa por `WAIT_START`, `CALIBRATE`, `DETECT_DIRECTION`, `FOLLOW`, `TURN`, `FOLLOW`... y acaba en `FINISH` y `DONE`. Dónde se queda atascado te dice a qué caso ir.

Dos scripts pequeños para medir lo que `ros2 topic echo` no da bien. Guárdalos en tu portátil o en el Pi y córrelos con `python3`, con el entorno de ROS cargado.

<details>
<summary>imu_probe.py: giro acumulado en los tres ejes y media en reposo</summary>

```python
import math
from collections import deque

import rclpy
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import Imu


class ImuProbe(Node):
    def __init__(self):
        super().__init__('imu_probe')
        self.angle = [0.0, 0.0, 0.0]        # giro acumulado en x, y, z (rad)
        self.recent = deque(maxlen=100)     # últimas 100 lecturas (unos 2 s)
        self.last = None
        self.count = 0
        self.create_subscription(Imu, '/robotek/imu', self.on_imu, qos_profile_sensor_data)

    def on_imu(self, m):
        w = (m.angular_velocity.x, m.angular_velocity.y, m.angular_velocity.z)
        t = m.header.stamp.sec + m.header.stamp.nanosec * 1e-9
        if self.last is not None:
            for i in range(3):
                self.angle[i] += w[i] * (t - self.last)
        self.last = t
        self.recent.append(w)
        self.count += 1
        if self.count % 25 == 0:
            mean = [sum(r[i] for r in self.recent) / len(self.recent) for i in range(3)]
            a = [math.degrees(v) for v in self.angle]
            print(f'giro acumulado x={a[0]:+7.1f} y={a[1]:+7.1f} z={a[2]:+7.1f} grados | '
                  f'media 2 s x={mean[0]:+.4f} y={mean[1]:+.4f} z={mean[2]:+.4f} rad/s')


rclpy.init()
try:
    rclpy.spin(ImuProbe())
except KeyboardInterrupt:
    pass
```

Con el coche quieto, la parte de la derecha debe estar cerca de cero (el sesgo del caso 11). Con el coche en tus manos, la de la izquierda es el ángulo que has girado en cada eje del coche.

</details>

<details>
<summary>scan_probe.py: el punto más cercano del LiDAR, con su ángulo</summary>

```python
import math

import rclpy
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import LaserScan


class ScanProbe(Node):
    def __init__(self):
        super().__init__('scan_probe')
        self.create_subscription(LaserScan, '/robotek/scan', self.on_scan, qos_profile_sensor_data)

    def on_scan(self, m):
        valid, inside = [], 0
        for i, r in enumerate(m.ranges):
            a = m.angle_min + i * m.angle_increment
            a = math.degrees(math.atan2(math.sin(a), math.cos(a)))
            if abs(a) > 110.0:
                continue                          # scan_adapter descarta lo de fuera de +-110 grados
            inside += 1
            if m.range_min < r < m.range_max:
                valid.append((r, a))
        if not valid:
            print('ningún rayo válido')
            return
        r, a = min(valid)
        lost = 100.0 * (inside - len(valid)) / max(1, inside)
        print(f'más cercano: {r:.2f} m a {a:+4.0f} grados | rayos dentro de +-110: {inside} | sin dato {lost:.0f} %')


rclpy.init()
try:
    rclpy.spin(ScanProbe())
except KeyboardInterrupt:
    pass
```

Pon la mano a 30 cm delante del LiDAR: debe salir un ángulo cerca de 0. A la izquierda del coche, cerca de +90. El porcentaje "sin dato" cuenta solo los rayos dentro de ±110 grados. En el coche del equipo faltan al azar unos 4,3 por ciento de los rayos en cada vuelta `[coche]`; mucho más que eso es un problema (caso 9).

</details>

## Caso 1: no pasa nada al pulsar el botón

**Cómo se ve.** Pulsas el botón de la placa y los LED no pasan a azul, el coche no se mueve y `/robotek/state` sigue en `WAIT_START`. (El coche del equipo no pita: el zumbador de la placa está quemado `[coche]`.) El caso contrario también existe: el coche arranca **sin que nadie pulse** (ver abajo).

**Causas, de más a menos probable.**

1. Alguna pieza de la cadena no está viva: `botón de la placa -> /rrc/button -> start_button -> /start -> tu estrategia`.
2. La estrategia está corriendo, pero no recibe `/start` (QoS incompatible, otro `ROS_DOMAIN_ID`, nodo duplicado).
3. Pulsaste dos veces: la segunda pulsación es el **Stop**, y deja el coche parado hasta relanzar.
4. Los paquetes `rrc_lite_msgs` o `robotek_hardware` no están cargados en esa terminal.
5. El driver de la placa no puede abrir el puerto serie.

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

**Diagnostica.** Sigue la cadena de izquierda a derecha y para en el primer eslabón roto.

```bash
ros2 node list                        # debes ver rrc_driver, start_button, strategy, base_adapter...
ros2 topic echo /rrc/button           # pulsa K1: sale "id: 1" y "state: 1", un mensaje por pulsación
ros2 topic echo /start                # (en otra terminal, ANTES de pulsar) sale "data: true"
ros2 topic info -v /start             # quién publica (start_button) y quién escucha (strategy)
ros2 topic echo /robotek/state        # WAIT_START -> CALIBRATE -> DETECT_DIRECTION -> FOLLOW
```

- **No hay nodo `start_button` o `rrc_driver`.** Mira el principio de la salida del launch. Si dice `rrc_lite_msgs missing`, ese paquete no se compiló o no cargaste su `install/setup.bash`. Comprueba con `ros2 pkg prefix rrc_lite_msgs`. Si el nodo `start_button` está pero no publica, mira ese mismo aviso: sin el paquete de mensajes no puede leer el botón y avisa de que hay que publicar `/start` a mano.
- **`/rrc/button` no sale al pulsar.** El problema está en la placa o en el driver. Mira `ls -l /dev/serial/by-id/` (la placa debe aparecer) y que tu usuario esté en el grupo `dialout` (`groups`). Si usas la ruta `/dev/ttyACM0` y cambió el número, usa la ruta `by-id`, que no cambia `[coche]`. Cada pulsación de K1 o K2 genera un solo mensaje `[coche]`; `start_button` acepta cualquiera de los dos, porque no mira el `id`.
- **`/start` sale, pero la estrategia no arranca.** Corre `ros2 topic info -v /start`. Mira el QoS de cada extremo, en concreto **Durability**. `start_button` publica con la durabilidad por defecto (`VOLATILE`). El `drive.py` del curso se suscribe con la durabilidad por defecto, así que con él el botón sí arranca `[sim]`. Pero si tu propio nodo se suscribe con `TRANSIENT_LOCAL` (por ejemplo, porque copiaste una versión antigua de esta guía), un publicador volátil **no es compatible** con un suscriptor transitorio, y los mensajes no llegan jamás. Se reconoce porque el log de tu estrategia dice algo como `New publisher discovered on topic '/start', offering incompatible QoS ... DURABILITY_QOS_POLICY` `[código]`. La estrategia del equipo se suscribe con la durabilidad por defecto, y por eso con ella el botón funcionó en el coche `[coche]`.
- **El botón funciona una vez y luego "se muere".** Es el Stop. `start_button` toma la **primera** pulsación como Start y las siguientes (con 1,5 s de antirrebote) como `/robotek/stop`, que se enclava `[coche]`. Relanza el launch.
- **Todo cuadra pero tu portátil no ve nada.** `ROS_DOMAIN_ID` distinto, o el demonio de ROS con la configuración vieja: `echo $ROS_DOMAIN_ID` en cada terminal y `ros2 daemon stop` (caso 16).

**Arréglalo.**

| Si... | Haz |
|---|---|
| Falta `rrc_lite_msgs` | Compílalo y carga el workspace (`source install/setup.bash`), en **cada** terminal nueva. Con `ros2 pkg list \| grep rrc` debe salir |
| QoS incompatible | Haz que los dos extremos sean compatibles. Lo más corto: en tu `drive.py`, suscríbete a `start` con la durabilidad por defecto (`self.create_subscription(Bool, 'start', self.on_start, 10)`), como hace el `drive.py` del curso. Un suscriptor volátil acepta a los dos publicadores, y el árbitro del simulador espera a que haya un suscriptor antes de publicar. La alternativa es crear el publicador de `start_button.py` con `QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL)`; así el Start también llega a un nodo que arranque tarde `[código]` |
| Para probar sin botón | Publica el Start tú, con la durabilidad que pide tu nodo: `ros2 topic pub -r 2 /start std_msgs/msg/Bool "{data: true}" --qos-durability transient_local --qos-reliability reliable` y corta con Ctrl+C cuando veas `Start` en el log |
| Sin permiso en el puerto | `sudo usermod -aG dialout $USER` y vuelve a entrar en la sesión |
| Dos copias de un nodo | Mata los hijos del launch viejo (caso 16) |

**El coche arranca solo.** En el intento 3 el `start_button` publicó `/start` unos 10 s después del launch sin que el operador pulsara nada `[coche]`; no se aisló la causa. Mantén el coche en el aire o la mano cerca del stop hasta que sepas qué lo provocó. Como la calibración y la decisión del sentido tardan cerca de 1 s (0,9 a 1,1 s en las rondas del equipo `[coche]`), tienes alrededor de un segundo para la segunda pulsación.

**Comprueba que quedó.** Con los LED en verde, pulsas una vez y ves: azul unos 0,3 s (`CALIBRATE`), luego apagado, y `/robotek/state` recorre `CALIBRATE`, `DETECT_DIRECTION` y `FOLLOW`. Los LED van a brillo 2 de 255 para no reflejarse en la cámara `[coche]`: míralos de cerca y con poca luz.

</details>

## Caso 2: se estrella nada más arrancar

**Cómo se ve.** El coche sale recto, no gira donde debe y choca con el muro de enfrente en los primeros 3 a 5 s. A veces sigue empujando contra el muro.

Este es el síntoma que más causas distintas tiene, así que primero **mira qué dice `/robotek/state` y `/cmd_vel_raw` justo antes del golpe**:

| Qué ves | Qué significa | Ve a |
|---|---|---|
| Nunca pasó de `DETECT_DIRECTION` y el coche no se movió | No es un choque: no se decidió el sentido | caso 10 |
| `FOLLOW` y llegó a la esquina sin girar | El sentido decidido es falso, o la puerta del giro no se abrió | casos 10 y 14 |
| `TURN`, y el coche giró al lado contrario de la esquina | Signo del giroscopio, del servo o del LiDAR invertido | casos 3 y 4 |
| `FOLLOW`, pero el coche se fue torciendo en la primera recta | El giroscopio realimenta con el signo contrario, o el servo no está centrado | casos 4 y 3 |
| Todo parece bien pero va mucho más rápido que otras veces | Batería cargada o tope del motor demasiado alto | caso 5 |
| El LiDAR da `inf` por todas partes | El coche va a ciegas | caso 9 |

**Causas, de más a menos probable.**

1. **Sentido equivocado.** Es lo que pasó en el intento 1: el coche decidió "horario" cuando la esquina abierta era antihoraria. Siguió recto, el frente cayó de 0,99 m a 0,12 m y chocó a los 2,9 s, y **siguió mandando velocidad contra el muro** hasta que se le paró a mano `[coche]`.
2. **Velocidad mayor que la del modelo.** Con 90 por ciento de motor y la batería cargada, el coche "iba mucho más rápido que antes" y chocó (intento 7) `[coche]`. Las distancias de giro se afinaron para unos 0,6 m/s como máximo.
3. **Giroscopio con el signo cambiado o eje equivocado** (caso 4): el control de rumbo empuja a favor del error en vez de en contra `[código]`.
4. **Calibración del sesgo con el coche en movimiento** `[código]`. La estrategia mide el sesgo del giroscopio en los 0,3 s siguientes al Start (`CALIBRATE_SECONDS`). Si todavía tienes los dedos en la placa (el botón está **en la placa**), o el coche rueda, esas muestras no son el sesgo. Un sesgo mal medido de solo 0,02 rad/s son unos 45 grados de rumbo falso en 40 s.
5. **Servo sin centrar o con el signo al revés** (caso 3).
6. **LiDAR rotado, espejado o ciego** (caso 9): la pared de enfrente no existe para el coche, así que nunca gira.
7. **Datos de sensor congelados**: si el LiDAR o la IMU dejan de publicar, un nodo sin vigilante sigue ejecutando el último escenario y el coche sigue recto (el `drive.py` del curso desde el paso 7 frena; ver "frenos de seguridad" abajo).
8. **Sale a fondo y se encabrita** (caso 5): con el morro en el aire la dirección no actúa.

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

**Diagnostica con el coche en el aire**, antes de volver al suelo:

1. Lanza el launch y espera los LED verdes. Pulsa y mira `/robotek/state`: debe llegar a `FOLLOW` en 1 a 2 s. Las ruedas deben girar hacia delante y la dirección quedar casi recta.
2. Gira el coche a mano 90 grados a la izquierda mientras corre `imu_probe.py`: debe dar `z` cerca de +90 (caso 4).
3. Con `scan_probe.py`, tu mano delante da ángulo 0 y a la izquierda da +90 (caso 9).
4. Mira cómo se mueve la dirección al girar el coche a mano: si el coche cree que se desvía a la izquierda, las ruedas deben girar a la derecha para corregir. Si no, el signo de algo está invertido.

**Frenos de seguridad: lo que la estrategia del equipo tiene y la del curso no.** `[coche]` en el equipo, `[código]` en el curso:

- **Sensor viejo = frenar.** En el nodo del equipo, si el último LiDAR tiene más de 0,35 s o la última IMU más de 0,2 s (`scan_max_age`, `imu_max_age` en `open_realcar_v4.yaml`), el comando es velocidad 0 hasta que se recuperen. El `drive.py` del curso (desde el paso 7) ya lo hace con `SensorWatchdog` (`robotek_course/watchdog.py`): si un sensor lleva más de 0,35 s (LiDAR) o 0,2 s (IMU) sin mensajes, envía velocidad 0 y avisa en el log `A sensor went quiet`. Si escribes tu propio nodo, copia esa idea.
- **A ciegas = no avanzar.** Si `scene.left` y `scene.right` son los dos `inf`, el nodo del equipo publica velocidad 0. Sin el LiDAR, tu `perceive` devuelve `inf` y la misión sigue recto.
- **Atasco = parar.** El equipo detecta que el coche no avanza y se recupera o se detiene. Ojo: su odometría del LiDAR **suma distancia aunque el coche esté quieto** si hay ruido entre escaneos (3,6 m "recorridos" en 15,8 s con el frente cambiando solo 9 cm), y la detección de atasco tardó o no saltó `[coche]`. Si escribes la tuya, mide el cambio de la distancia al frente, no `travelled`.
- **Parada del operador.** Segunda pulsación del botón (arriba).

**Arréglalo.** Primero baja `motor_max_pct` a 30 o 40, y arranca siempre con la batería cargada y anotada. Después, según el síntoma, el caso que corresponda. Mientras tanto, revisa los tres frenos de seguridad (el del sensor viejo ya está en el `drive.py` del curso): son pocas líneas y convierten un choque en una parada.

**Comprueba que quedó.** Tres rondas seguidas a velocidad baja en cada sentido, sin tocar un muro, y la primera esquina con el coche girando a tiempo. Sube el tope del motor solo después.

</details>

## Caso 3: gira al lado contrario, da círculos o va hacia la isla

**Cómo se ve.** En vez de corregir hacia el centro del pasillo, el coche se desvía más y más hacia un muro. O gira siempre hacia un lado y dibuja un círculo. O en la esquina gira a la derecha cuando toca a la izquierda.

Hay **tres** signos que pueden estar invertidos y los tres dan el mismo síntoma desde fuera: el del servo, el del giroscopio y el del LiDAR. Sepáralos antes de tocar nada:

| Prueba, con el coche en el aire | Esperado | Si falla |
|---|---|---|
| Servo: publicas `/steer` positivo | Las ruedas giran a la **izquierda** | Servo (este caso) |
| Giroscopio: giras el coche a mano a la izquierda | `angular_velocity.z` positivo en `/robotek/imu` | Giroscopio (caso 4) |
| LiDAR: pones la mano a la izquierda del coche | `scan_probe.py` da un ángulo cerca de +90 | LiDAR (caso 9) |

Si las tres pasan y el coche aun así gira mal, el culpable es el sentido decidido (caso 10) o tu propia lógica.

**Causas del lado del servo, de más a menos probable.**

1. **`servo_sign` invertido.** Con un montaje del servo nuevo o girado, la misma orden mueve las ruedas al otro lado. El equipo lo midió en el montaje anterior y estaba bien `[coche]`: +20 grados (1879 µs) iban a la izquierda y -20 grados (1155 µs) a la derecha, mirando desde atrás, con las ruedas rectas en 1500 µs. **Pero en el montaje nuevo (21 oct 2026) el servo cambió de sitio y giró 90 grados, y esos valores no están medidos**: por eso `robot.yaml` trae `servo_measured: false` y `base_adapter` lo avisa en cada arranque.
2. **Centro (`servo_center_us`) desplazado.** Con las ruedas rectas no sale 1500 µs. El coche se va siempre al mismo lado. Un grado de error son unos 19 µs (la ganancia es 18,97 µs por grado en un lado y 17,24 en el otro).
3. **Tabla de ruedas (`wheel_table_*`) del montaje viejo.** Con el montaje nuevo, el ángulo real de la rueda para cada ángulo de servo es otro. Con la tabla equivocada, un lado gira más que el otro (caso 6).
4. **Signo cruzado en tu código.** `angular.z` positivo es izquierda en todo el sistema. Si cambiaste un signo en `drive.py`, deshazlo.

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

**Diagnostica (servo).** Apoya el coche con las ruedas delanteras libres y lanza **solo** el driver de la placa y la herramienta de banco, sin `base_adapter` ni el motor:

```bash
ros2 run robotek_hardware servo_steer
ros2 topic pub -r 5 /steer std_msgs/msg/Float32 "{data: 0.0}"     # ruedas rectas
ros2 topic pub -r 5 /steer std_msgs/msg/Float32 "{data: 0.30}"    # unos 17 grados a la IZQUIERDA
ros2 topic pub -r 5 /steer std_msgs/msg/Float32 "{data: -0.30}"   # a la DERECHA
```

Hace falta `-r 5`: `servo_steer` centra las ruedas si pasa medio segundo sin recibir un ángulo, a propósito `[código]`. Mira desde arriba y detrás. Con ±0,30 rad (17 grados) se ve bien; con 10 grados casi no se aprecia `[coche]`.

Para probar la cadena entera hasta el motor, con las ruedas **en el aire** porque el motor gira:

```bash
ros2 topic pub -r 10 /cmd_vel_raw geometry_msgs/msg/Twist "{linear: {x: 0.2}, angular: {z: 0.5}}"
```

`base_adapter` calcula el ángulo de la dirección como `atan(angular.z * wheelbase / linear.x)`, que aquí son unos 16 grados a la izquierda, y el motor gira hacia delante a un 21 por ciento `[código]`.

**Arréglalo (servo).** Los valores están en `src/robotek_hardware/config/robot.yaml`, bajo `base_adapter`. Los parámetros se leen una sola vez al arrancar el nodo: edita y relanza (si compilaste con `--symlink-install` no hace falta recompilar; si no, recompila).

| Quieres... | Cambia | Efecto |
|---|---|---|
| Ruedas rectas en 0 | `servo_center_us`, de diez en diez µs, hasta que queden rectas | Quita la deriva permanente a un lado |
| Que `+steer` vaya a la izquierda | `servo_sign: -1.0` a `1.0` (o al revés) | Invierte el lado de todo el recorrido. Las dos ganancias cambian de lado, así que vuelve a medir la tabla |
| Probar un centro sin editar | `ros2 run robotek_hardware servo_steer --ros-args -p servo_center_us:=1510.0` | Solo en banco |
| Ángulo real de rueda correcto | `wheel_table_servo_deg`, `wheel_table_left_deg`, `wheel_table_right_deg`, `wheel_limit_deg` | Mide el ángulo de **cada** rueda delantera con un transportador o con una foto desde arriba para 10, 15, 20 y 25 grados de servo y rellena la tabla. `wheel_limit_deg` es el menor de los máximos de los dos lados |
| Quitar el aviso | `servo_measured: true` | Solo cuando hayas hecho lo de arriba |

Recuerda que **la distancia entre ejes cambió de 0,13 a 0,1174 m**. Los ángulos de rueda que salen de dar círculos dependen de ella: `ángulo = atan(L / radio)`. Si mediste con 0,13, recalcula con `tan(nuevo) = tan(viejo) * 0,1174 / 0,13`. Con eso, los 25 grados de servo pasan de 19,7 a unos 17,9 a la izquierda, y de 17,6 a unos 16,0 a la derecha `[código]`.

**Comprueba que quedó.** Con `/steer` en 0 las ruedas quedan rectas y el coche, en el suelo, a 0,2 m/s sobre una recta de 2 m con paredes, no se desvía más que unos centímetros. Con +0,30 van a la izquierda y con -0,30 a la derecha, y los dos lados dan el mismo ángulo real (compruébalo con la foto).

</details>

## Caso 4: el giroscopio está invertido o con los ejes mal

Este es el caso al que más cuesta llegar, porque todo "funciona": llegan datos, tienen buen tamaño, el ruido es bajo. Solo que el signo, o el eje, no son los que tu estrategia supone.

**Cómo se ve.**

- **Signo invertido.** En las rectas, el coche se desvía y cada corrección empeora el desvío hasta chocar con un muro. En la primera esquina gira a un lado y no para: el rumbo que cree llevar se aleja del objetivo en vez de acercarse, así que sigue con las ruedas a tope y da vueltas `[código]`. Esto es lo que pasa si la RRC Lite está de canto "del otro lado" de lo que dice `robot.yaml`.
- **Eje equivocado.** El giroscopio apenas se mueve cuando el coche gira (el eje que lees es horizontal): el rumbo no cambia, la esquina nunca se da por terminada y el coche gira sin parar. Y al revés: cuando el coche cabecea o se inclina, el "rumbo" se mueve sin que el coche haya girado `[código]`.
- **Unidades.** El rumbo sale 57 veces mayor o menor que el real (caso 11).

Tu estrategia lee **solo** `angular_velocity.z` de `/imu` (en `drive.py`, `msg.angular_velocity.z`). Del resto de la IMU no usa nada. Por eso, para el giroscopio, **el único eje que importa es `up_axis`**: el eje de la placa que apunta hacia arriba, con su signo `[código]`.

### Las tres convenciones

1. **El marco del coche (ROS).** `x` adelante, `y` izquierda, `z` arriba, mano derecha: el giro positivo alrededor de un eje es el antihorario visto desde la punta del eje. Por eso `z > 0` significa **girar a la izquierda**. Es lo que esperan `/imu` y todo tu código. En reposo la aceleración marca +9,8 en `z` (el acelerómetro mide la reacción del suelo, hacia arriba).
2. **El marco de la placa.** Los ejes dibujados en la RRC Lite (en el chip MPU6050). Están fijos a la placa. Plana, `z` apunta arriba. De canto, apuntan a cualquier otro sitio. El driver los publica tal cual en `/rrc/imu_raw`.
3. **El marco aeronáutico (FRD).** `x` adelante, `y` **derecha**, `z` **abajo**. Lo usan muchas hojas de datos, tutoriales de drones y librerías de IMU. En él un giro positivo en `z` es **horario**, es decir, a la derecha. Pasar de este marco al del coche es girar 180 grados alrededor de `x`: cambian de signo `y` y `z`. Una placa montada boca abajo, o un código copiado de un dron, dan un giroscopio invertido.

`imu_adapter` traduce de la placa al coche con tres claves de `robot.yaml`: `forward_axis`, `left_axis` y `up_axis`. Cada una dice **qué eje de la placa apunta hacia adelante, hacia la izquierda y hacia arriba**, con su signo. Por ejemplo, `left_axis: '-x'` significa "el eje `x` de la placa apunta a la derecha del coche". El adaptador exige que los tres formen un marco de mano derecha (adelante por izquierda tiene que dar arriba); si no, se cae al arrancar con `is not a right-handed frame` `[sim]`. Hay 24 combinaciones válidas.

El montaje plano del 8 oct era `forward_axis: '+y'`, `left_axis: '-x'`, `up_axis: '+z'` `[coche]`. Con la RRC Lite y la Raspberry **de canto** (montaje del 21 oct) esos valores ya no valen: por eso `robot.yaml` dice `measured: false` y `imu_adapter` lo avisa en cada arranque.

<div data-widget="imu-axes"></div>

*Elige cómo está montada la placa en el coche y qué le dices a `imu_adapter`. La tabla muestra qué lee tu estrategia al girar el coche a mano. El caso inicial es el clásico: la placa está de canto, del "otro lado" de lo que dice la configuración.*

### Encuentra los ejes: dos métodos

**Método 1, el del equipo: `imu_axes`.** Con el coche quieto sobre la mesa y solo el driver de la placa corriendo (detén el resto del launch):

```bash
ros2 run robotek_hardware imu_axes
```

Espera 3 s sin tocar el coche: la gravedad da el eje de arriba. Cuando diga `PUSH`, da **un solo empujón suave hacia adelante** y suelta: la primera ráfaga de aceleración da el eje de adelante, y el de la izquierda sale de esos dos. Imprime el bloque `imu_adapter:` listo para pegar en `robot.yaml` y `error_deg`, lo lejos que está cada dirección medida del eje de la placa más cercano. **Si algún `error_deg` pasa de unos 15 grados**, la placa está inclinada o el empujón fue torcido: repite `[código]`.

Trampa: si empujas hacia **atrás** sin querer, adelante e izquierda salen invertidos. Sigue siendo un marco válido, así que nadie se queja; el giroscopio `z` queda bien, pero el acelerómetro `x` queda al revés `[código]`.

**Método 2, tres giros a mano, solo con el giroscopio.** No hace falta empujar el coche. Mira los ejes **de la placa** con `ros2 topic echo --field angular_velocity /rrc/imu_raw` y fíjate en qué eje responde y con qué signo:

1. **Gira el coche a la izquierda** sobre la mesa (antihorario visto desde arriba). Responde el eje que apunta **arriba**. Si el eje `a` de la placa sale positivo, `up_axis: '+a'`; si sale negativo, `up_axis: '-a'`.
2. **Baja el morro** (levanta la cola). Es un giro positivo alrededor del eje de la izquierda. Si responde el eje `b` en positivo, `left_axis: '+b'`; en negativo, `'-b'`.
3. **Inclina el coche a la derecha** (rueda derecha abajo). Es un giro positivo alrededor del eje de adelante. Si responde el eje `c` en positivo, `forward_axis: '+c'`; en negativo, `'-c'`.

Comprueba que adelante por izquierda da arriba. Si no sale, repetiste un giro con el signo cambiado. El acelerómetro confirma: en reposo marca +9,8 en el eje de arriba, y si levantas el morro marca positivo en el de adelante `[código]`.

**Comprobación final (con `measured: true` ya puesto).** Corre `imu_probe.py`, que lee `/robotek/imu`, ya en el marco del coche. Tres giros a mano:

| Giro de unos 90 grados | Debe dar |
|---|---|
| A la izquierda | `z` cerca de +90, y `x`, `y` casi 0 |
| Baja el morro | `y` positivo |
| Inclina a la derecha | `x` positivo |

Si `z` da -90, el signo está invertido: `up_axis` tiene el signo contrario (normalmente también `left_axis`, porque dar la vuelta a la placa alrededor del eje de avance cambia el signo de izquierda y de arriba a la vez). Si `z` da unos 5000, el driver publica grados por segundo (caso 11). Si `z` casi no se mueve, `up_axis` apunta a un eje horizontal.

**Arréglalo.** Pega el bloque en `src/robotek_hardware/config/robot.yaml`, bajo `imu_adapter`, y pon `measured: true`. Relanza. Desde ahí `/robotek/imu` ya viene en el marco del coche y el resto del sistema no cambia.

**Y el reglamento.** Prohíbe hacer calibraciones de sensores en el coche durante la preparación de una ronda (§9.9). Determina los ejes en la práctica y déjalos fijos. El sesgo del giroscopio lo mide tu estrategia después del Start.

**Comprueba que quedó.** `imu_probe.py` pasa las tres pruebas. Después, con el coche en el suelo y a velocidad baja, ya no se acumula el desvío en las rectas y la primera esquina termina en 1 o 2 s.

## Caso 5: se encabrita, derrapa o vuelca

**Cómo se ve.** Al arrancar levanta las ruedas delanteras. O en una esquina derrapa de cola y se va contra el muro exterior. O acaba de lado o boca arriba.

**Causas, de más a menos probable.**

1. **Arranque a fondo.** Desde parado a 100 por ciento el coche se encabrita: las ruedas delanteras quedan en el aire y **la dirección no actúa hasta que vuelven a tocar el suelo**. Con 50 por ciento desde parado el morro empieza a levantarse (la aceleración vertical cae a 4,4 m/s2 en vez de 8) `[coche]`.
2. **Más rápido que el modelo.** La tabla de velocidades se midió con la batería **baja** (7,0 a 7,4 V). Con la batería cargada, el mismo porcentaje da más velocidad `[coche]`. Con 90 por ciento y 7,6 V, el coche iba "mucho más rápido que antes" y chocó (intento 7). Y por encima del 30 por ciento la recta de calibración no vale: el coche iba un 25 a 30 por ciento más lento de lo pedido con la batería casi descargada `[coche]`. La velocidad depende de la carga, del porcentaje y del suelo.
3. **Frenar de golpe.** El primer freno del driver era invertir el motor 0,12 s: las ruedas **derrapaban** y la deceleración era brutal `[coche]`. Hoy el driver frena con una rampa (`stop_ramp_s`).
4. **Velocidad alta con dirección a tope.** La aceleración lateral en una curva es `v^2 * tan(ángulo) / distancia_entre_ejes`. Con la dirección a 17,6 grados y la distancia de 0,1174 m: a 0,6 m/s son unos 1,0 m/s2 (0,1 g); a 1,2 m/s son 3,9 (0,4 g); a 1,5 m/s, 6,1 (0,6 g) `[código]`.
5. **Enganchar algo.** El borde del tapete, una pared, una rueda atascada.

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

**Sobre volcar.** En las notas del equipo **no hay ningún vuelco registrado**: lo que sí se vio es levantar el morro `[coche]`. Con las medidas del coche (vía delantera de 0,1335 m), un vuelco lateral limpio en una curva pide aceleraciones laterales altas, y lo normal es que antes **patinen las ruedas**. Si un coche así acaba de lado, lo más probable es que patinara, enganchara un borde (tapete, pared) y tropezara `[código]`. Puedes medir tu margen en la mesa: apoya el coche en una tabla, levanta un lado poco a poco y anota el ángulo `theta` al que se levantan las ruedas del lado alto. Entonces `a_max = g * tan(theta)`. Compáralo con la aceleración lateral de arriba.

**Diagnostica.**

```bash
ros2 topic echo /motor_vel            # el porcentaje que llega al motor (nunca más que motor_max_pct)
ros2 topic echo /cmd_vel_raw          # la velocidad que pide tu estrategia
ros2 topic echo --field linear_acceleration.z /robotek/imu   # en el arranque, bajar de unos 5 m/s2 = morro arriba
```

La aceleración vertical sobre el arranque es un buen indicador: en reposo marca unos 9,6 a 9,8; una caída por debajo de unos 5 m/s2 es el morro levantándose `[coche]`. Para esto, el eje `z` debe estar ya en el marco del coche (caso 4).

Mide además la velocidad real a un porcentaje fijo, con el coche en el suelo y una cinta en el suelo con una marca cada 25 cm. Publica 3 s a 20 por segundo y graba con el móvil:

```bash
ros2 topic pub -r 20 -t 60 /motor_vel std_msgs/msg/Float32 "{data: 30.0}"
```

El driver tiene un perro guardián de 0,3 s: hay que seguir publicando, por eso `-r 20`. Mide el tiempo entre marcas en la parte estable del vídeo (no al arrancar ni al frenar): `v = 0,25 m / tiempo`.

**Arréglalo.**

| Quieres... | Cambia | Efecto |
|---|---|---|
| Quitar el encabritamiento | Deja `accel_limit: 1.0` (m/s2) en `robot.yaml`. Con 0 no hay límite y vuelves a levantar el morro | La velocidad sube en rampa: 0,6 s para llegar a 0,6 m/s |
| Frenar sin derrapar | `decel_limit: 0.6` y `stop_ramp_s: 0.6`. Si aun así derrapa, `decel_limit: 0.4` | Frena más largo. Cuenta con 0,3 a 0,5 m de parada desde 0,6 m/s |
| Coche más lento en general | `motor_max_pct` (tope de potencia). Es la protección más directa | Con 40, ronda completa en 47 s (batería en 6,66 V); con 50, en 40 s (7,40 V) `[coche]`. No son iguales: las baterías eran distintas |
| Que el modelo coincida con la batería | Vuelve a medir `motor_pct_per_mps` y `motor_min_pct` **con la batería cargada** (caso 8) | La velocidad real se parece a la pedida |
| Esquinas más lentas | `LAST_CORNER_SPEED`, `CRUISE_SPEED` en tu `mission.py` | Menos aceleración lateral. La última esquina ya va más lenta a propósito |

Una regla útil: **las distancias de giro de tu estrategia están afinadas para una velocidad real máxima de unos 0,6 m/s** (en el simulador, el comando 1,28 m/s equivale a 0,60 m/s reales). Si subes `motor_max_pct` hasta que el coche supere eso, las esquinas llegan tarde.

**Comprueba que quedó.** Tres arranques seguidos sin que las ruedas delanteras se separen del suelo, y una ronda completa con `motor_max_pct` fijo en distintos estados de la batería, anotando el voltaje: el tiempo tiene que variar poco.

</details>

## Caso 6: no gira lo suficiente, o gira demasiado

**Cómo se ve.** *No gira lo suficiente:* en la esquina abre la trayectoria y roza o choca con el muro exterior; el radio de giro es mayor de lo que esperabas. *Gira demasiado:* se pasa de la esquina, mete el morro en la isla o zigzaguea.

El ángulo de rueda pasa por **cuatro límites en cadena**. El primero que corta es el que manda:

1. Tu estrategia: `STEER_LIMIT` (0,30718 rad, 17,6 grados) en `minisim.py` y `REAL_STEER_LIMIT` en `robotek_common/vehicle.py`.
2. `base_adapter`: `wheel_limit_deg` (17.6) recorta el ángulo de **rueda** que pide la estrategia, simétrico a los dos lados.
3. La tabla `wheel_table_*` convierte ese ángulo de rueda en ángulo de **servo**, y `steer_limit_deg` (25) recorta el del servo.
4. El servo y la mecánica: `servo_min_us`/`servo_max_us` (1000 a 2050 µs) y el tope físico de la dirección.

**Causas, de más a menos probable.**

1. **La tabla de ruedas no es la del coche actual** (montaje o distancia entre ejes cambiados). Las ruedas giran menos de lo que cree el modelo.
2. **Una rueda gira menos que la otra.** En el montaje anterior, con 25 grados de servo la rueda daba unos 19,7 a la izquierda y 17,6 a la derecha, o sea, ~2 grados de diferencia `[coche]`. `wheel_limit_deg` existe para igualar los dos lados.
3. **Subviraje a velocidad.** Con más velocidad, las ruedas delanteras patinan y el coche abre la curva.
4. **El servo no llega a la posición** por ser lento (caso 7): el comando cambia más rápido que la rueda.
5. **El servo choca con un tope** y el recorte `servo_min_us`/`servo_max_us` no es el del montaje.

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

**Diagnostica.**

- **Ángulo de la rueda frente a la orden.** Con el coche en el aire y `servo_steer`, publica `data` = 0,17 / 0,26 / 0,35 / 0,44 rad y sus negativos, y mide el ángulo de cada rueda delantera con un transportador o con una foto desde arriba junto a una regla. Anota también los µs que se publican (`ros2 topic echo /rrc/acker_servo/set_state`). `[coche]` (así se hizo con círculos).
- **Radio mínimo.** Con el coche en el suelo, ruedas giradas a tope y a velocidad baja, dibuja un círculo y mide el diámetro con cinta. El radio medido en el montaje anterior fue de 0,41 m `[coche]`. A partir de él: `ángulo = atan(distancia_entre_ejes / radio)` (con el radio del eje trasero).
- **Qué hace tu estrategia en la esquina.** Mira `/cmd_vel_raw` durante `TURN`: `angular.z * 0,1174 / linear.x` debe llegar a 0,317 (la tangente de 17,6 grados). Si llega y el coche aún abre, el límite está en los puntos 3 a 5.

**Arréglalo.**

| Si... | Cambia | Efecto |
|---|---|---|
| Faltan grados en una rueda | La fila correspondiente de `wheel_table_left_deg` o `wheel_table_right_deg` | `base_adapter` pide más servo para el mismo ángulo |
| Diferencia entre lados | `wheel_limit_deg` = el menor de los dos máximos | El coche gira igual a izquierda y derecha |
| Quieres más giro, dentro de la regla de 25 grados | Sube `wheel_limit_deg`, `STEER_LIMIT` y `REAL_STEER_LIMIT` **a la vez**, y comprueba que el servo no llega al tope | Radio más cerrado. Sube de a medio grado |
| Subviraje a velocidad | Baja la velocidad de esquina (`CRUISE_SPEED`, o la de la esquina) y adelanta el giro (caso 14) | Menos deslizamiento |
| El servo choca | Acorta `servo_min_us`/`servo_max_us` o `steer_limit_deg` | Sin chasquidos en el tope |

*Gira demasiado*: lo contrario, y mira primero que el centro (caso 3) y el signo (caso 4) sean correctos, porque un giroscopio con el signo cambiado se nota igual.

**Comprueba que quedó.** El radio medido con cinta coincide con el que calculas a partir de la tabla, y el coche termina cada esquina dentro de la tolerancia (`TURN_TOLERANCE`, 0,12 rad) sin rozar el muro exterior.

</details>

## Caso 7: el servo vibra, zumba, se calienta o va lento

**Cómo se ve.** El servo zumba sin parar aunque el coche vaya recto, la dirección tiembla, el servo se calienta, o en las esquinas el coche se pasa de largo y corrige tarde.

**Causas, de más a menos probable.**

1. **Empuja contra un tope.** Si `servo_min_us`/`servo_max_us` (o `steer_limit_deg`) piden más recorrido del que tiene la mecánica, el servo se queda empujando y zumba y se calienta `[código]`. En las pruebas de banco del equipo, las órdenes de -25 grados (1069 µs) quedaban cerca del tope de 1000 µs `[coche]`.
2. **Comandos que oscilan.** `base_adapter` manda una orden al servo **por cada mensaje de velocidad** (50 por segundo desde `drive.py`), redondeada a µs. Si la dirección que pide tu estrategia tiembla un poco por el ruido del LiDAR, el servo recibe 50 órdenes por segundo ligeramente distintas y zumba. `servo_steer` (la herramienta de banco) solo reenvía cuando el valor cambia; `base_adapter` no `[código]`.
3. **Tensión equivocada.** El servo va conectado al puerto 2 de la placa (conector J4). Según la documentación de Hiwonder, la placa tiene un puente para alimentar los servos a 5 V o a la tensión de entrada: comprueba a qué está antes de cambiar de servo `[código]`.
4. **Holgura o roce mecánico** en la palanca o las varillas.
5. **Es más lento de lo que supone el modelo.** El coche del equipo tiene un retardo de unos 60 ms entre la orden y el primer movimiento (52 a 79 ms) y tarda unos 0,15 a 0,2 s en recorrer 10 grados y 0,4 a 0,5 s en 25 grados `[coche]`. El simulador usa retardo 0,06 s, constante de tiempo 0,05 s y 1,2 rad/s (`SERVO_DELAY`, `SERVO_TAU`, `SERVO_RATE` en `minisim.py`).

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

**Diagnostica.**

- **Zumbido en reposo.** Con el coche en el aire y `/steer` fijo en 0: si zumba, es el centro o un tope. Prueba con valores pequeños de `servo_center_us`. Con tu estrategia, mira `ros2 topic echo --field angular.z /cmd_vel_raw`: si oscila de un mensaje a otro con el coche recto, es ruido en la realimentación y no el servo.
- **Tope.** Con el coche en el aire, publica en `/steer` los extremos (±0,44 rad) y escucha: un chasquido o un zumbido sostenido en el extremo es un tope.
- **Retardo y velocidad con el móvil.** Pon el coche en el aire con una cámara lenta (240 fotogramas por segundo) que vea el servo o una rueda y el LED de la placa a la vez. Corre este script, que enciende el LED rojo **y** manda el servo a +20 grados en el mismo instante. Cuenta fotogramas desde el LED hasta que la rueda empieza a moverse (retardo) y hasta que se detiene (recorrido).

<details>
<summary>servo_step.py: salto de servo sincronizado con un LED, para filmarlo</summary>

Para correrlo, lanza **solo** el driver de la placa (nada de `base_adapter` ni `status_leds`, para que solo mande este script).

```python
import time

import rclpy
from rclpy.node import Node
from rrc_lite_msgs.msg import RGBState, RGBStates, SetAckerServoState


def servo(position):
    msg = SetAckerServoState()
    msg.position = position
    msg.duration = 0.05
    return msg


def led(on):
    state = RGBState()
    state.index, state.red, state.green, state.blue = 1, 255 if on else 0, 0, 0
    msg = RGBStates()
    msg.states.append(state)
    return msg


rclpy.init()
node = Node('servo_step')
servo_pub = node.create_publisher(SetAckerServoState, '/rrc/acker_servo/set_state', 10)
rgb_pub = node.create_publisher(RGBStates, '/rrc/set_rgb', 10)
time.sleep(1.0)                          # descubrimiento
servo_pub.publish(servo(1500))
time.sleep(1.5)
rgb_pub.publish(led(True))               # el LED y el servo, en el mismo instante
servo_pub.publish(servo(1879))           # +20 grados con el montaje antiguo; usa tu valor
time.sleep(1.5)
servo_pub.publish(servo(1500))
rgb_pub.publish(led(False))
time.sleep(0.5)
rclpy.shutdown()
```

La posición 1879 es la de +20 grados del montaje anterior; para el tuyo, calcula los µs con tu centro y tu ganancia.

</details>

La cuenta: con 240 fotogramas por segundo, 1 fotograma son 4,2 ms. Si el retardo sale como 12 a 19 fotogramas, es el de 50 a 80 ms del equipo. Si el recorrido de 10 grados tarda más de 0,2 s, el servo es más lento que el modelo `[código]`.

**Arréglalo.**

| Si... | Cambia | Efecto |
|---|---|---|
| Hay tope | Acorta `servo_min_us`/`servo_max_us`, o baja `steer_limit_deg`, hasta que no haya chasquido | Fin del zumbido y del calor |
| El mando oscila | Suaviza el ángulo en tu estrategia, o pon una zona muerta en `base_adapter` (no reenviar si el cambio es menor de 2 µs) `[código]` | Menos órdenes y menos ruido |
| Modelo más lento | Pon tus valores en `SERVO_DELAY`, `SERVO_TAU` y `SERVO_RATE` de `minisim.py`, y vuelve a afinar en el simulador (paso 12) | Las esquinas se calculan con tu servo |
| Servo a otra tensión | Revisa el puente de la placa y la hoja de datos del servo | Evita quemarlo |
| El servo ya es lento y no hay arreglo | Esquinas más lentas y anticipar el giro (caso 14) | El coche compensa con distancia |

**Comprueba que quedó.** El servo está en silencio con el coche recto y no se calienta tras dos minutos con el coche en el aire y la estrategia corriendo; las ruedas se ven moverse sin temblar.

</details>

## Caso 8: el motor

**Cómo se ve.** No se mueve, se mueve a tirones, gira al revés o va a una velocidad que no es la pedida.

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

### No se mueve

Con la estrategia del equipo esto acabó en `STALLED`: la estrategia vio que no avanzaba y se detuvo sola. Pasó tres veces, siempre por un **cable del motor suelto** `[coche]`.

1. **Cable suelto o motor sin alimentación.** Lo más probable de lejos `[coche]`. Tira de cada conector (motor, batería, puente TB6612).
2. **STBY del TB6612 sin levantar.** El pin STBY (GPIO 13) tiene que estar en alto o el motor no gira. El nodo de motor original del equipo **nunca lo tocaba**, por eso el motor "funcionaba a ratos" `[coche]`. `motor_driver` lo pone en alto en cada orden.
3. **El PWM al 100 por ciento.** Una versión anterior de `motor_driver` escribía el pin PWM como salida digital cuando pedía 100 por ciento, y con un PWM de `lgpio` activo esa escritura se ignoraba: el motor se quedaba con el último ciclo y no giraba. Hoy usa siempre `tx_pwm` `[coche]`. Si copias un driver propio, ten cuidado.
4. **`lgpio` no está** (`lgpio missing: motor disabled` en el log), o el chip es otro. En la Raspberry Pi 5 los pines están en `gpiochip` 4 (`gpiochip: 4` en `robot.yaml`).
5. **El porcentaje pedido es menor que el mínimo.** `motor_min_pct` (6,5) es el porcentaje en el que el coche empieza a moverse; por debajo, no se mueve. Con la batería baja, este mínimo sube `[código]`.
6. Si la estrategia está parada (`STOP`, o Stop del botón), es lo esperado.

**Diagnostica.**

```bash
ros2 topic hz /cmd_vel_raw     # unos 50 Hz; si llega a menos de 3 por segundo, el perro guardián (0.3 s) lo para
ros2 topic echo /motor_vel     # ¿llega algún porcentaje distinto de 0?
```

Con las **ruedas en el aire**: `ros2 topic pub -r 20 /motor_vel std_msgs/msg/Float32 "{data: 15.0}"`. Debe girar hacia delante. Si el topic llega y el motor no gira, es hardware (alimentación, cable, STBY, `lgpio`).

### Va a tirones

Tres cosas hacen que un motor sano se mueva a golpes:

1. **El perro guardián.** `base_adapter` y `motor_driver` paran el motor si pasan **0,3 s** sin recibir órdenes (`watchdog`, `watchdog_s`). Si tu estrategia publica a trompicones (CPU saturada, red), el motor arranca y para.
2. **La rampa de parada.** Tras una orden de 0, el motor sigue 0,6 s en rampa, y una orden nueva en el mismo sentido espera a que termine `[coche]`.
3. **La alimentación.** Un reinicio de la placa o del Pi se ve como un tirón (caso 12).

Mira `ros2 topic hz /cmd_vel_raw` con el coche en marcha: debe estar fija en 50 Hz.

### Gira al revés

Si con `/motor_vel` positivo el coche va hacia atrás, intercambia `ain1` y `ain2` en `tb6612fng_motor` de `robot.yaml` (o cambia los dos cables del motor). Con la marcha atrás, el driver pasa siempre por una parada (rampa) para cambiar de sentido `[coche]`.

### Va a una velocidad que no es la pedida

El mapa de velocidad es `v = (porcentaje - motor_min_pct) / motor_pct_per_mps`. En el coche del equipo salió `v = 0,0137 * (porcentaje - 6,5)` m/s entre 10 y 30 por ciento, con la batería baja (7,3 V) `[coche]`. De ahí vienen `motor_pct_per_mps: 73` y `motor_min_pct: 6.5` en `robot.yaml`.

- Está medido **solo hasta 30 por ciento** (0,32 m/s). Más arriba el coche iba 25 a 30 por ciento más lento de lo pedido `[coche]`.
- Con la batería **cargada** el coche va más rápido para el mismo porcentaje `[coche]`.
- La estrategia del curso pide `1.28` m/s (el máximo de `CRUISE_SPEED`). Con la calibración, eso son 100 por ciento, y `motor_max_pct` (50) lo recorta: el tope es lo que decide la velocidad de crucero `[código]`.

**Arréglalo.** Mide la tabla con la batería cargada: con el coche en el suelo y 2 m de cinta, publica 1 s a 10, 15, 20, 25 y 30 por ciento (el `timeout` de arriba) y mide el avance. Ajusta `motor_pct_per_mps` y `motor_min_pct` con una recta por mínimos cuadrados. Repite a mitad de la batería. Si pides más de 30 por ciento, no te fíes de la recta: mide también 40 y 50.

**Comprueba que quedó.** `ros2 topic hz /cmd_vel_raw` en 50 Hz, el coche arranca sin tirones, y una recta de 2 m a una velocidad fija se cruza en el tiempo que predice la tabla (con un 10 a 20 por ciento de margen).

</details>

## Caso 9: LiDAR

**Cómo se ve.** Los LED se ponen en rojo con azul (falta el LiDAR). O hay datos pero el coche "ve" la pared por detrás. O el mapa sale espejado. O hay muchos huecos y la estrategia duda.

**Lo normal en el coche del equipo (LD19)** `[coche]`:

| Dato | Valor |
|---|---|
| Frecuencia | unos 10 Hz |
| Conexión | puerto serie USB (CP2102) a 230400 baudios, tópico `/scan` |
| Ángulos del driver | 0 a 2π, antihorario, con el **frente en π** (el cero apunta hacia atrás) |
| Zona útil | unos ±110 grados. Detrás, los rayos dan en el propio coche a 2 a 8 cm |
| Ruido | unos 5 mm por rayo con la mediana; 19 mm en el percentil 90 (bordes y superficies oscuras) |
| Huecos | al azar, unos 4,3 por ciento de los rayos por vuelta |
| Altura del plano | a unos 30 mm del suelo en el montaje nuevo |

**Causas, de más a menos probable.**

1. **No hay datos.** El puerto serie no está, otro proceso lo tiene abierto (dos lectores en el mismo puerto dan *timeout* `[coche]`), o el LiDAR arrancó a la vez que la placa y falló el arranque: el equipo lanza el LiDAR unos 5 s después de la placa (`car.launch.py` de este curso no los separa). Después no se reprodujo, así que puede haber sido otra cosa, como dos lectores en el puerto `[coche]`. Si moviste un USB con el stack en marcha, hay que **relanzar**: los procesos antiguos se quedan sin datos `[coche]`.
2. **`angle_offset` equivocado.** El valor correcto para el LD19 con el cable atrás es π (`angle_offset: 3.14159...`). Con 0, el "frente" de tu estrategia es la parte trasera del LiDAR `[código]`.
3. **`reverse` equivocado.** Si el driver da los ángulos en sentido horario, hay que poner `reverse: true`. El LD19 del equipo no lo necesita `[coche]`.
4. **Zona ciega.** `fov_deg: 110` y `min_valid_range: 0.12` descartan lo que ve el propio coche. En un montaje nuevo, la zona ciega cambia: vuelve a medirla. En el coche del equipo se hizo con 30 vueltas por grado `[coche]`.
5. **Huecos de más:** superficies muy oscuras o brillantes, luz solar directa o el tapete. Con el plano de escaneo a 30 mm del suelo, **un pliegue o una junta del tapete de más de 3 cm** aparece como una pared falsa `[código]`. El LD19 no se ha probado con sol directo en las pruebas del equipo.

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

**Diagnostica.**

```bash
ls -l /dev/serial/by-id/                    # el LiDAR debe aparecer
ros2 topic hz /scan                         # unos 10 Hz, tal como sale del driver
ros2 topic hz /robotek/scan                 # lo mismo, ya con 0 rad al frente
ros2 topic echo --field header.frame_id --once /robotek/scan
```

Con `scan_probe.py`:

| Prueba | Esperado |
|---|---|
| Mano a 30 cm delante | `más cercano: 0.30 m a  0 grados` (o ±3) |
| Mano a 30 cm a la **izquierda** | ángulo cerca de **+90** |
| Mano a 30 cm a la derecha | cerca de -90 |
| Mano detrás del coche | no cambia nada: está fuera de ±110 grados y se descarta |
| Coche parado en el campo | `sin dato` cerca de 4 por ciento |

Si la mano de la izquierda sale a -90, **el scan está espejado**: `reverse`. Si la de delante sale a ±180, `angle_offset` está mal. También puedes verlo en RViz con `/robotek/scan`: una pared delante debe verse delante.

**Arréglalo.** En `robot.yaml`, bajo `scan_adapter`: `angle_offset` (π para el LD19 con el cable atrás; si lo montas girado, π más el giro), `reverse` y, si cambió el montaje, `fov_deg` y `min_valid_range`. Si hay un cable USB flojo o el LiDAR vibra, asegúralo. Si hay huecos por luz, prueba a la sombra para confirmar; las estrategias del equipo toleran el 4,3 por ciento.

**Comprueba que quedó.** Las cuatro pruebas de `scan_probe.py` dan lo esperado y, con el coche parado en medio del campo, `scene.left`, `scene.right` y `scene.front_axis` valen lo que mides con una cinta (con una precisión de ±1 cm; recuerda que el LiDAR está 0,128 m por delante del centro del coche).

</details>

## Caso 10: cámara y sentido de la vuelta

**Cómo se ve.** Sin imagen. O colores cambiados. O el coche decide el sentido contrario y choca en la primera esquina. O tarda muchos segundos en decidir. O se queda en rojo fijo (`DIRECTION_FAULT`).

En tu estrategia la cámara solo decide **una cosa**: el sentido de la vuelta (`DirectionVote`: línea azul más larga = antihorario, naranja = horario). Pero es la decisión más cara si falla.

**Causas, de más a menos probable.**

1. **Un falso color en el fondo.** Es lo que le pasó al equipo (intento 1): la pared beige de la sala, por encima del muro negro del campo, cayó dentro del rango naranja (en una imagen, 434 píxeles de naranja y 0 de azul), así que el coche decidió "horario" con la esquina abierta antihoraria `[coche]`. Los rangos HSV del curso (`BLUE_HSV`, `ORANGE_HSV` en `vision.py`) son los **del simulador**.
2. **Rojo y azul intercambiados.** Si el nodo de cámara declara `bgr8` pero los datos son `rgb8`, azul y naranja se cambian y el sentido sale al revés `[código]`. Mira la codificación: `ros2 topic echo --field encoding --once /usb_cam/image_raw`.
3. **Línea demasiado corta o no visible al arrancar.** En el intento 6, la línea naranja se veía corta (74 a 322 px) y el sentido tardó 12,4 s `[coche]`. El tiempo máximo en tu estrategia es `DIRECTION_TIMEOUT = 15` s: pasado ese tiempo, `STOP` con `DIRECTION_FAULT` y los LED en rojo fijo.
4. **Pocas imágenes por segundo.** La cámara del equipo da entre 6 y 9 imágenes por segundo con exposición automática, y 4,6 con huecos de 4,8 s si la CPU está saturada `[coche]`. `DirectionVote` necesita 5 imágenes seguidas que coincidan (`CONFIRMATIONS = 5`), o sea, al menos 0,8 s a 6 fps `[código]`, y tu `drive.py` descarta el voto si pasan 0,5 s sin imagen. La estrategia del equipo, con 3 confirmaciones, tardaba entre 0,9 y 1,1 s en calibrar y decidir `[coche]`.
5. **Iluminación.** La exposición automática alarga el obturador con poca luz y baja los fps. Con exposición manual se llegó a 17 fps, pero la imagen sale más oscura y hay que recomprobar los colores `[coche]`.
6. **Inclinación y giro de la cámara.** Mira demasiada sala por encima del muro o la línea cae fuera de la imagen. En el coche del equipo, medida el 8 oct con el montaje anterior, la cámara mira unos 10 grados hacia abajo, con campo de visión de unos 67 grados y girada 4,4 grados a la izquierda (`REAL_CAMERA_*` en `vehicle.py`) `[coche]`. Con el montaje nuevo (cámara más alta y más atrás) hay que volver a medir.
7. **Sin imagen:** la cámara se enchufó después de arrancar (el nodo muere), la ruta `/dev/videoN` cambió, o el USB se cayó. En una prueba de 90 s, el kernel registró `USB disconnect` y la cámara volvió como otro `/dev/videoN`, y el nodo no se recuperaba solo `[coche]`.

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

**Diagnostica.**

```bash
ros2 topic hz /usb_cam/image_raw                       # unos 5 a 15 Hz
ros2 topic echo --field encoding --once /usb_cam/image_raw   # bgr8 o rgb8
ls -l /dev/v4l/by-id/                                  # la ruta estable de la cámara
```

<details>
<summary>grab_frame.py: guarda una imagen y mide qué ve tu detector</summary>

```python
import cv2
import rclpy
from cv_bridge import CvBridge
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import Image

from robotek_course.vision import line_lengths


class Grab(Node):
    def __init__(self):
        super().__init__('grab_frame')
        self.bridge = CvBridge()
        self.done = False
        self.create_subscription(Image, '/usb_cam/image_raw', self.on_image, qos_profile_sensor_data)

    def on_image(self, m):
        if self.done:
            return
        bgr = self.bridge.imgmsg_to_cv2(m, desired_encoding='bgr8')
        cv2.imwrite('frame.png', bgr)
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        h, w = bgr.shape[:2]
        print('azul y naranja (px):', line_lengths(bgr), '| HSV del centro:', hsv[h // 2, w // 2])
        self.done = True


rclpy.init()
node = Grab()
while rclpy.ok() and not node.done:
    rclpy.spin_once(node, timeout_sec=0.5)
rclpy.shutdown()
```

Mira `frame.png`: la línea naranja del campo debe verse **naranja**. Si se ve azul, los canales están cambiados. Con el coche en la posición de salida, `line_lengths` debe dar más de `MIN_LENGTH` (40 px) para la línea que ves, y mucho menos para la otra. Si da cientos de píxeles de un color que no está en el suelo, es un falso positivo (la pared de la sala, un cartel, tu ropa).

</details>

**Arréglalo.**

| Si... | Haz |
|---|---|
| Falso color en el fondo | Mide los HSV de las líneas reales con la luz del lugar (con `frame.png` y `hsv[y, x]`) y ajusta `BLUE_HSV` y `ORANGE_HSV` de `vision.py`. El equipo además hizo que la máscara solo mire el **suelo**, por debajo del muro negro (`vision_floor_mask`), y eso quitó los falsos positivos `[coche]`. En tu código, súbele el recorte superior (el `0.08` de `line_lengths`) hasta que quede fuera la sala `[código]` |
| Canales cambiados | Declara bien la codificación en el nodo de cámara, o cambia `desired_encoding` en `drive.py` |
| Línea corta al salir | Coloca el coche con la línea en el campo de visión, o baja `MIN_LENGTH` (40 px) con cuidado: una línea corta también es ruido |
| Lento | Más luz, o exposición manual y recompruebas colores. No pongas más de 5 confirmaciones si la cámara va a 4 fps |
| `DIRECTION_FAULT` | Es el fallo bueno: el coche no adivina. Arregla la causa de arriba; no quites el límite |
| Sin imagen | Enchufa la cámara **antes** de arrancar; usa la ruta de `/dev/v4l/by-id/...` en `video_device:=`; si se cayó, relanza |

**Nunca fijes el sentido a mano para ganar tiempo.** Elegirlo con un interruptor, o con la posición del coche, sería meter datos al programa, y el reglamento lo prohíbe (§9.9). Lo que sí puedes hacer es que la decisión sea más fiable.

**Comprueba que quedó.** Pon el coche en los dos sentidos, en la luz del sitio, y mira el voto: tiene que decidir en menos de 2 s y acertar las diez veces. Si tiene fallos intermitentes, hazlo con la luz más fuerte y con la más débil del sitio.

</details>

## Caso 11: giroscopio, sesgo, ruido y unidades

**Cómo se ve.** El coche con el giroscopio bien orientado (caso 4) se desvía despacio, o el rumbo "se va" aunque esté quieto, o los valores no tienen el tamaño de un giro real.

**Lo que midió el equipo** `[coche]` (placa plana, el 8 y 9 oct):

| Dato | Valor |
|---|---|
| Frecuencia | unos 49 Hz |
| Ruido en reposo | desviación típica de unos 0,0013 a 0,0019 rad/s |
| Sesgo del eje `z` | +0,006 rad/s en una medida; en otra, +0,0056 |
| Sesgo del eje `y` | **0,047 rad/s** (fijo, no es movimiento) |
| Aceleración en reposo | norma de 9,62 m/s2 |

El sesgo depende del eje: en la placa de canto, el eje que ahora es `z` del coche era otro en el montaje plano. Un sesgo de 0,047 rad/s son 2,7 grados por segundo; si ese eje acabara como tu `up_axis`, la calibración lo quitaría igual, pero verifica `[código]`.

**Causas, de más a menos probable.**

1. **Sesgo residual.** Tu estrategia mide el sesgo en 0,3 s (15 muestras a 50 Hz). Eso deja un error de unos 0,0005 rad/s por ruido, pero el sesgo **cambia con la temperatura** y la medida de 0,3 s no lo sigue. En una ronda real el rumbo de la pared pasó de +0,03 a -0,14 rad en unos 35 s: un sesgo residual de unos 0,005 rad/s `[coche]`. En 42 s eso son 12 grados.
2. **Calibrar con el coche en movimiento** (caso 2), o un control que no va a 50 Hz: `drive.py` integra con `dt = 1/50` fijo (caso 17).
3. **Placa recién encendida.** El MPU6050 se calienta al encender y el sesgo se mueve en los primeros minutos `[código]`.
4. **Unidades.** Medidas del equipo: aceleración de 9,62 m/s2 y ruido de 0,002 rad/s, o sea, que el driver ya da unidades ROS (m/s2 y rad/s) `[coche]`. El protocolo de la placa habla en g y grados por segundo, y el driver convierte. Si cambias de driver, comprueba con `imu_probe.py`: un giro de 90 grados debe dar ~90. Si da ~5200, el driver da grados por segundo; si da ~1,6, convirtió dos veces.
5. **Ruido por vibración.** La placa de canto vibra al rodar `[código]`. Compara la desviación con el coche quieto y con la rueda motriz girando en el aire.
6. **Saturación.** Un giro a tope a 0,6 m/s son unos 1,6 rad/s (unos 93 grados por segundo); cualquier rango del MPU6050 de ±250 grados por segundo lo cubre. Un golpe contra un muro puede saturarlo, pero un golpe ya es un fallo `[código]`.

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

**Diagnostica.** Corre `imu_probe.py` con el coche quieto 10 s: la `media 2 s` de `z` debe quedar entre -0,01 y +0,01 y no cambiar mucho entre ventanas. Anota el valor a los 2 minutos de encender y a los 10.

**Arréglalo.**

| Si... | Haz |
|---|---|
| El sesgo cambia durante la ronda | Calibra durante más tiempo: sube `CALIBRATE_SECONDS`. Cada 0,1 s más son 0,1 s más en el tiempo de la ronda; el sesgo residual baja con la raíz de las muestras, pero el de temperatura no |
| El sesgo es grande al encender | Espera 2 minutos tras encender antes de rondas importantes |
| Calibración de mala calidad | Rechaza la calibración si la desviación típica de las muestras de `_samples` pasa de unos 0,01 rad/s, y repite `[código]` |
| Unidades | Arregla la conversión en el driver o en `imu_adapter` (un solo sitio, `remap_vector`) |

**Comprueba que quedó.** Con el coche quieto 40 s con la estrategia corriendo, el rumbo que integra tu estrategia cambia menos de 3 grados. Para ver el rumbo que integra tu estrategia, haz que `drive.py` imprima `self.strategy.yaw` una vez por segundo (`self.get_logger().info(..., throttle_duration_sec=1.0)`).

</details>

## Caso 12: reinicios y USB que se caen

**Cómo se ve.** En plena ronda el coche se queda parado de golpe. Se pierde la conexión por SSH. Los LED se apagan y se encienden. Falta algún sensor. O el Pi se reinicia y los datos de la ronda se pierden.

**Lo que se encontró en el coche del equipo** `[coche]`:

- **La tira de LED al 100 por ciento apagó el Pi.** Treinta LED blancos al máximo toman unos 1,8 A del raíl de 5 V del Pi. Se quitó la tira; si la usas, aliméntala con un regulador aparte.
- **Un cable flojo** (el del motor, sobre todo) causó tres de los ocho intentos. Siempre que algo "no hace nada", tira de los conectores primero.
- **El Pi se reinició varias veces más con la tira apagada**, también al copiar archivos, sin diagnóstico claro. Después de reiniciar, `vcgencmd get_throttled` vuelve a `0x0` y ya no sirve para saber qué pasó.
- **Con el motor a 80 por ciento y la batería en 6,5 V, el Pi se reinició** a los 73 s (intento 5). En el intento 7, con 90 por ciento, el operador paró el coche cortando la alimentación, y los datos de la ronda, que estaban en un búfer, se perdieron.
- **No era la potencia:** en las pruebas de motor, el raíl de 5 V del Pi no bajó de 4,8 V (el umbral de subtensión es de unos 4,63 V) y la batería se mantuvo por encima de 7 V. Los reinicios coincidieron con la tira LED y con cables flojos.
- **La cámara se desconectó sola** una vez a los 90 s (`USB disconnect`).
- **Un USB movido de puerto** hace que el LiDAR y la cámara cambien de nombre: relanza el stack. Usa las rutas `/dev/serial/by-id/...` y `/dev/v4l/by-id/...`.
- **La placa se resetea y pierde el puerto serie.** El driver del equipo reabre el puerto si el USB se cae; el de este curso no: **relanza el launch** `[coche]`.
- **Vibración.** Los conectores de una placa de canto trabajan al rodar: sujétalos `[código]`.

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

**Diagnostica.**

```bash
vcgencmd get_throttled                          # 0x0 = bien. Bit 0: subtensión ahora. Bit 16: hubo subtensión desde el arranque
vcgencmd measure_temp                           # temperatura
watch -n 0.5 "vcgencmd pmic_read_adc EXT5V_V"   # la tensión de 5 V de la Raspberry Pi 5; debajo de ~4,63 V hay subtensión
sudo dmesg -T | grep -i -E "usb|under-voltage|disconnect"   # qué USB se cayó
journalctl -b -1 -n 50 --no-pager               # el final del arranque anterior, si se reinició
```

**Arréglalo.** Dale a la tira de LED (o a cualquier carga grande) su propia alimentación. Sujeta con una brida cada cable USB y de motor, y comprueba que ninguno queda a menos de 10 mm de una rueda o de la palanca del servo. La estrategia puede guardar sus registros con descarga frecuente al disco (`flush`) para no perderlos si el Pi se apaga `[código]`. El motor del equipo irá con su propia batería (decisión del 9 oct); mientras la batería sea compartida, un motor muy exigido puede hundirla `[código]`.

**Comprueba que quedó.** Tres rondas con el motor al tope y la herramienta de 5 V abierta: sin caídas por debajo de 4,8 V, `get_throttled` en `0x0`, y ningún `USB disconnect` en `dmesg`.

</details>

## Caso 13: paradas y final de la ronda

**Cómo se ve.** *Se para antes de acabar. No se para. Se pasa de la sección de salida. Para antes de llegar.*

**Lo que hace tu estrategia al final** (`mission.py`): tras la esquina 12 entra en `FINISH`, avanza a `FINISH_SPEED = 0.15` hasta que la pared de enfrente está a `FINISH_LEAD = 0.08` m de la distancia que midió en el Start (`_start_front`), frena (se enclava) y a los `STOP_WAIT = 0.9` s pasa a `DONE`.

### Se para antes de acabar

1. **Stop del operador.** Una segunda pulsación del botón, aunque sea sin querer (antirrebote de 1,5 s). Relanza para correr otra vez.
2. **`DIRECTION_FAULT`.** Sin sentido en 15 s (caso 10): LED rojo fijo y el coche ni arranca.
3. **Se atascó (`STALLED`).** Solo la estrategia del equipo lo detecta. Pasó con el cable del motor suelto `[coche]`. La tuya, si no avanza, se queda esperando.
4. **Se cayó el nodo** (caso 17).
5. **Frenó por sensor viejo** (el freno del equipo, caso 2).

### No se para

- `FINISH` solo termina si la pared de enfrente es finita. Si `front_axis` es `inf` (LiDAR ciego, caso 9), el coche **no avanza ni termina** en `FINISH`.
- Si el motor no mueve el coche con 0,15 m/s (con la calibración, 17,5 por ciento), el coche se queda parado en `FINISH` sin llegar. Con la batería baja puede pasar `[código]`.

### Se pasa de la sección de salida o para antes

El coche para donde la pared de enfrente vuelve a estar a la distancia del Start. Si en el Start lo pusiste al fondo de la sección, para al fondo; si lo pusiste al borde delantero, un poco de inercia lo saca. Y la rampa de parada del motor (0,6 s) añade unos centímetros.

En el intento 8, el `FINISH` duró solo 0,9 s: la distancia al frente al terminar la última esquina (1,47 m) ya era menor que la del Start (1,61 m) más el margen, así que frenó **en seguida**, y al llegar a `DONE` los dos lados estaban abiertos, o sea que pudo parar **antes** de la sección de salida. No se verificó `[coche]`.

**Diagnostica.** Después de `DONE`, mide a mano dónde quedó el coche con respecto a la sección de salida, y anota en cada ronda `front_axis` en el Start y al parar (`scan_probe.py` o tu propio log). Si el coche se mueve después de `DONE`, mira el eje del giroscopio: **el giroscopio tras `DONE` no vale** si alguien levantó el coche (en el intento 2 salió +2,6 rad en 60 s tras `DONE` con la desviación subiendo a 0,27 rad/s: era manipulación) `[coche]`.

**Arréglalo.**

| Quieres... | Cambia | Efecto |
|---|---|---|
| Parar más adentro de la sección | Coloca el coche en el Start un poco más adentro de la sección; o sube `FINISH_LEAD` | Para antes de llegar a la pared de enfrente |
| Parar más tarde | Baja `FINISH_LEAD` | Para más cerca de donde empezó, pero con menos margen si hay inercia |
| Menos inercia | Baja `LAST_CORNER_SPEED` y `FINISH_SPEED`; sube `decel_limit` solo si no derrapa | Frena más corto |
| Que no se quede parado en `FINISH` | Si `front_axis` es `inf`, repite el LiDAR (caso 9); si el motor no mueve a 0,15, sube un poco `FINISH_SPEED` | Termina siempre |

**Comprueba que quedó.** Diez rondas, y en todas el coche queda con todo el cuerpo dentro de la sección de salida. Registra el resultado en la tabla de rondas; una ronda "buena" no vale si no mides dónde paró.

## Caso 14: roza la isla o el muro exterior en las esquinas

**Cómo se ve.** Después de girar, el morro toca el muro de la isla. O en la última esquina el lado del coche roza el muro exterior. Rozar la isla sin moverla no penaliza, y **tocar el muro exterior en el Open no está permitido** (§9.18 del reglamento).

En el intento 8 el operador vio dos roces a la isla, justo después de las esquinas 4 y 11 (el LiDAR marcaba el frente a 0,15 a 0,21 m). Además, en la última esquina el LiDAR marcó el frente a 0,12 m y el muro exterior a 0,13 m: un posible roce que nadie confirmó `[coche]`.

La esquina tiene una **puerta** con cuatro condiciones a la vez (`turn_gate.py`): armada, avanzado `ARM_DISTANCE`, pared de enfrente a menos de `TURN_FRONT` y fin de la isla visto (`LOOKAHEAD`, o isla abierta a más de `ISLAND_OPEN`). Cada número mueve el punto donde empieza el giro.

| Constante | Valor | Si la subes | Si la bajas |
|---|---|---|---|
| `TURN_FRONT` | 1,19 m | Gira antes (lejos del muro): riesgo para la isla | Gira después: riesgo para el muro exterior |
| `LOOKAHEAD` | 0,35 m | Empieza cuando el fin de la isla está más lejos: gira antes, riesgo para la isla | Gira después: riesgo para el muro exterior |
| `CONFIRMATIONS` | 2 escaneos | Más seguro frente al ruido, pero tarda más | Gira con un solo escaneo: los huecos del LiDAR pueden disparar el giro |
| `GAP` (en `lane.py`) | 0,25 m | Pasa más lejos de la isla, más cerca del muro exterior | Al revés |
| velocidad de esquina | 1,28 (comando) | El arco se abre: choca fuera | Arco más cerrado |

**Causas, de más a menos probable.**

1. **Velocidad mayor que la del modelo** (caso 5): el coche llega a la esquina más tarde de lo que el modelo supone y se abre.
2. **Umbrales afinados para otro campo.** `TURN_FRONT = 1,19` sirve para el campo `square100`; el Open cambia de tamaño y de pasillos (de 0,5 a 1,1 m).
3. **Cambió la posición del LiDAR.** Los umbrales están en el marco del LiDAR. En el coche del equipo, el montaje nuevo dejó el LiDAR 68 mm más adelante que cuando se afinaron los umbrales, y el fin de la isla se ve unos 6,8 cm antes `[código]`.
4. **El LiDAR falla en el fin de la isla.** Huecos al azar (4,3 por ciento) pueden romper la línea de la pared: `MAX_GAP_BEAMS = 2` y `CONFIRMATIONS = 2` protegen, pero con muchos más huecos (caso 9), el coche cree que la isla acabó y gira demasiado pronto.
5. **Giroscopio con sesgo** (caso 11): el objetivo `goal` se va desviando del muro real.
6. **Dirección con menos giro del que cree el modelo** (caso 6).

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

**Diagnostica.** Añade una línea en `mission.py`, justo cuando la puerta se abre, y compara tres o cuatro esquinas:

```python
        if self.gate.update(scene, inner, self.travelled, self.arc):
            print(f'esquina {self.completed + 1}: frente={scene.front_axis:.2f} fin_isla={scene.island_end:.2f} '
                  f'isla={inner:.2f} v={corner_speed}')
```

Después anota, para cada roce, si fue en el lado de la isla (giró pronto) o en el exterior (giró tarde). Mira también los escaneos con RViz desde tu portátil, o guarda un escaneo en el momento del giro.

**Arréglalo.** Un número cada vez, y de pasos pequeños (3 a 5 cm en `TURN_FRONT` o `LOOKAHEAD`). Si el roce es con la isla, resta; si es con el muro exterior, suma, o baja la velocidad de esquina. Repite cada cambio al menos tres veces: el LiDAR tiene ruido y el resultado varía. Para no desperdiciar baterías, reproduce primero la esquina en el simulador con el modelo del coche real (paso 12).

**Comprueba que quedó.** Diez esquinas seguidas sin roce, en los dos sentidos, y con la batería en dos estados distintos.

</details>

## Caso 15: funciona en el simulador y no en el coche

Esta tabla resume las diferencias que más fallos causaron. La última columna dice dónde está el detalle.

| En el simulador | En el coche | Qué falla | Caso |
|---|---|---|---|
| El IMU sale en el marco del coche | La placa va de canto: ejes y signo hay que medirlos | Giroscopio invertido | 4 |
| `/start` lo publica el árbitro, cuando tu nodo ya está suscrito | `/start` sale del botón, con la durabilidad por defecto | Solo si tu nodo se suscribe con `TRANSIENT_LOCAL`: el botón no arranca | 1 |
| El motor sigue una tabla medida con batería baja: 1,28 de comando da 0,60 m/s | Depende de la batería y de `motor_max_pct`; medido solo hasta 30 por ciento | Más rápido o más lento que el modelo | 5, 8 |
| Servo con retardo 0,06 s y 1,2 rad/s | Lo mismo de media, pero con holgura, topes y calor | Esquinas anchas o servo que zumba | 6, 7 |
| Ángulo de rueda igual al pedido hasta 17,6 grados | La rueda real da menos, y distinto a cada lado, hasta que mides la tabla | Gira poco o desigual | 6 |
| Arranque y frenada suaves, sin deslizar | Encabrita y derrapa sin rampas | Vuelco, derrape | 5 |
| LiDAR de 306 rayos, ±110 grados, 4,3 por ciento de huecos | Superficies oscuras, tapete, sol, cables | Muros falsos o ausentes | 9 |
| Cámara a 30 fps, colores del simulador | 6 a 9 fps, luz de la sala y una pared beige al fondo | Sentido mal decidido o lento | 10 |
| Sesgo del giroscopio fijo, 0,006 rad/s | Cambia con la temperatura, y con el coche en movimiento al calibrar | Rumbo que se va | 11 |
| El control corre a 50 Hz exactos del reloj de la simulación | Reloj de pared (`use_sim_time: false`). Si la CPU se satura, el temporizador se salta ciclos, y `drive.py` sigue suponiendo `dt = 0.02` `[código]` | El rumbo del giroscopio se integra de menos | 11, 17 |
| Las paredes son fijas | En el campo real, las paredes pueden moverse si las empujas (§9.18) | Un roce puede mover un muro | 14 |
| Todos los nodos en una máquina potente | Todo en un Raspberry Pi 5: estrategia, cámara, LiDAR | CPU saturada, cámara a 4,6 fps | 10, 17 |

Una forma de acercar el simulador al coche es cambiar en `minisim.py` las constantes (`SPEED_TABLE`, `SERVO_*`, `GYRO_BIAS`, `SCAN_DROPOUT`, `STEER_LIMIT`) por tus medidas. El paso 12 trata cómo afinar con ellas.

## Caso 16: red, latencia y `ROS_DOMAIN_ID`

**Cómo se ve.** Desde tu portátil no ves los nodos del coche. RViz no muestra la cámara. Ves los nodos pero con datos viejos. Dos coches se pisan.

**Lo que falló al equipo** `[coche]`: el portátil no veía ningún nodo del Pi y RViz no mostraba la cámara. Eran **cuatro causas a la vez**: (1) el dominio era distinto (42 frente a 1); (2) el descubrimiento estaba en `LOCALHOST` en un lado y en `SUBNET` en el otro; (3) un lado usaba Fast DDS y el otro Cyclone, que no se vieron; (4) el demonio de ROS guardaba la configuración anterior (`ros2 daemon stop`). El síntoma: `ros2 node list` en el portátil solo lista nodos del portátil.

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

**Diagnostica y arregla.**

```bash
echo $ROS_DOMAIN_ID $RMW_IMPLEMENTATION $ROS_AUTOMATIC_DISCOVERY_RANGE   # los tres, iguales en las dos máquinas
ros2 daemon stop && ros2 node list
ros2 node list                                       # ¿hay nodos repetidos?
```

- **Nodos repetidos.** Si cierras un `ros2 launch` con `kill -INT`, algunos nodos hijos pueden quedar vivos; al relanzar hay **dos copias** y el LiDAR da *timeout* (dos lectores en el puerto) `[coche]`. Cierra con Ctrl+C en la terminal del launch y comprueba `ros2 node list` antes de volver a lanzar. ROS avisa de nombres repetidos.
- **Tras mover un USB o desenchufar algo**, relanza todo `[coche]`.
- **La imagen cruda no llega por Wi-Fi.** Un cuadro son unos 0,9 MB: nunca llega al portátil. Para verla, usa el tópico comprimido (`/usb_cam/image_raw/compressed`), con el **nombre** del tópico en RViz, y que nada en el portátil se suscriba a la imagen cruda `[coche]`.
- **Tu estrategia corre en el coche**, no en el portátil: el control no puede depender de la red. Si la conexión SSH cae y mata el launch, el coche se para por los perros guardianes. Lanza dentro de `tmux` para sobrevivir a una caída de la conexión `[código]`.
- **Dos coches en la misma red:** pon a cada uno su `ROS_DOMAIN_ID` (de 0 a 101) o los tópicos `/scan`, `/start`, `/cmd_vel_raw` se mezclan `[código]`. En una sala con muchos equipos, el multicast del Wi-Fi puede perderse: no dependas de la red durante la ronda.

</details>

## Caso 17: un nodo se cae

**Cómo se ve.** El launch imprime `process has died`, o un traceback, y el coche se queda sin hacer algo (sin dirección, sin motor, sin estrategia).

<details>
<summary>Diagnóstico, arreglo y cómo comprobarlo</summary>

**Cómo leer un traceback.** La **última línea** dice qué falló (`ValueError: ...`). Las líneas de arriba son los lugares, de fuera a dentro; el último archivo que reconoces (uno tuyo o de `robotek_hardware`) es donde mirar. Guarda siempre la salida: `ros2 launch ... 2>&1 | tee ronda.log`.

| Mensaje | Qué es | Caso |
|---|---|---|
| `ValueError: ... is not a right-handed frame` (`imu_adapter`) | Ejes del `imu_adapter` imposibles | 4 |
| `rrc_lite_msgs missing` (varios nodos) | Falta el paquete de mensajes de la placa | 1 |
| `lgpio missing: motor disabled` | Sin librería de GPIO | 8 |
| `lgpio.error` al abrir el pin ("GPIO busy") | Otro proceso tiene los pines (el motor de otro stack o un launch anterior vivo) `[código]` | 8, 16 |
| `servo_measured: false` (aviso) | Servo sin calibrar | 3 |
| `CvBridgeError` | Codificación de la imagen | 10 |
| `RuntimeError: rrc_lite_msgs missing: cannot command the servo` (`servo_steer`) | Lo mismo, en la herramienta de banco | 1 |

**Cuidado con `drive.py`.** El `main` de la solución captura `RuntimeError` junto a `KeyboardInterrupt` y no dice nada, y en `finally` publica un `Twist()` vacío `[código]`. Si sospechas que tu nodo muere en silencio, quita el `RuntimeError` de ese `except` mientras depuras.

**Qué hace el coche cuando muere el nodo de estrategia.** Los perros guardianes de `base_adapter` y de `motor_driver` (0,3 s) bajan el objetivo a 0, pero con la rampa de `decel_limit = 0,6` m/s2: desde 0,6 m/s son unos 0,3 s a velocidad más 1 s de frenada, es decir, **unos 0,5 m de más** `[código]`. La parada del botón es inmediata. Si el nodo no muere sino que se **congela**, el control sigue con el último escenario, y por eso hace falta el freno por sensor viejo (caso 2).

**Si el Pi va justo de CPU.** Estrategia, cámara y driver compiten por 4 núcleos. La imagen es lo primero que sufre (cayó a 4,6 fps con la CPU al 100 por ciento `[coche]`). Y tu control: `drive.py` integra el giroscopio con `dt = 1/50` fijo, así que si el temporizador va a 40 Hz el rumbo sale un 20 por ciento corto `[código]`. Mira `top` y `ros2 topic hz /cmd_vel_raw` durante una ronda. En las rondas del equipo no se vieron huecos de control en marcha `[coche]`.

</details>

## Caso 18: aviso de batería baja

**Cómo se ve.** Los dos LED parpadean en rojo. El coche sigue funcionando.

`battery_guard` lee `/rrc/battery` (en milivoltios, una vez por segundo) y, tras **5 lecturas seguidas** por debajo de 6,8 V, publica `/robotek/battery_low` y `status_leds` parpadea en rojo. No para el coche (decisión del equipo, 9 oct) y el aviso queda hasta relanzar `[coche]`.

- **6,8 V** son 3,4 V por celda de la LiPo 2S: queda poca carga. Por debajo de unos 3,0 V por celda (6,0 V) la batería se daña, y 6 V es también el mínimo de la placa.
- **Mide la batería del motor aparte.** Lo que mide la placa es la de la electrónica. Si el motor tiene su propia batería, nadie la vigila: usa un medidor.
- **Una lectura suelta no cuenta.** Las lecturas de 0 mV (fallos de la placa) se ignoran.
- La batería del equipo se midió entre 7,0 y 8,1 V; en reposo 7,26 V. Tras unas horas de pruebas llegó a 6,40 V.
- **Contrasta una vez con un multímetro.** Según la documentación de Hiwonder, la placa v1.0 tiene dos patas del chip puenteadas a propósito para medir la batería; sin ese puente la lectura saldría mal. La lectura de 7,26 V es plausible, pero `battery_guard` depende de ella.

| Quieres... | Haz |
|---|---|
| Ver la tensión | `ros2 topic echo /rrc/battery` (milivoltios) |
| Avisar antes | `ros2 launch robotek_course car.launch.py battery_min_v:=7.0` |
| Apagar el aviso | `battery_guard:=false`. No es buena idea; la velocidad del coche depende de la batería |

La batería importa para algo más que el aviso: la misma ronda, con un motor al 40 por ciento y 6,66 V, tardó 47 s; con 50 por ciento y 7,40 V, 40 s `[coche]`. **Anota el voltaje de cada ronda.**

## Checklist antes de cada ronda

Imprímela. Marca cada punto, uno por uno. Los marcados con (*) se pueden hacer en el pasillo en dos minutos.

1. [ ] Batería de la electrónica cargada, `ros2 topic echo /rrc/battery --once` por encima de 7000 mV; batería del motor aparte, medida (caso 18). Anota los dos valores.
2. [ ] Cables y conectores (motor, servo, LiDAR, cámara, placa): tira de cada uno. Ninguno a menos de 10 mm de una rueda o de la palanca del servo (casos 3, 12).
3. [ ] (*) Un solo `ros2 launch` vivo: `ros2 node list` sin repetidos (caso 16).
4. [ ] (*) LED en verde, mirados de cerca. Rojo con un color dice qué sensor falta: azul LiDAR, magenta IMU, amarillo cámara (casos 9, 4, 10).
5. [ ] (*) Frecuencias con `ros2 topic hz`: LiDAR unos 10 Hz, IMU unos 50 Hz, cámara más de 5 Hz y `/cmd_vel_raw` a 50 Hz.
6. [ ] (*) Giroscopio: quieto 10 s, `media` de `z` entre -0,01 y +0,01; un giro a mano a la izquierda da `z` positivo (caso 4).
7. [ ] (*) Servo, con las ruedas en el aire: `+steer` va a la izquierda, 0 queda recto (caso 3).
8. [ ] (*) LiDAR: mano delante, ángulo 0; mano a la izquierda, ángulo +90 (caso 9).
9. [ ] Cámara: una imagen guardada con el coche en el Start; los colores se ven bien y la línea mide más de 40 px (caso 10).
10. [ ] `motor_max_pct` fijo y anotado (casos 5, 8).
11. [ ] Coche en la sección de salida. Pulsa el botón con un dedo y aparta la mano de inmediato: no sostengas el coche ni lo muevas durante el primer segundo, que es cuando calibra (caso 2). Ten la otra mano lista para el Stop.
12. [ ] No cambies calibraciones ni datos en la preparación de la ronda (§9.9). Los ejes de la IMU, el centro del servo y los colores se miden en la práctica.
13. [ ] Tras la ronda: anota batería, tope del motor, resultado, dónde paró y qué roces hubo; guarda el log (`tee`).

## Diagnóstico en cinco minutos

Cuando algo falla y no sabes por dónde empezar, haz esto en orden y **para en el primer paso que no dé lo esperado**.

| Paso | Qué haces | Debes ver | Si no, ve al caso |
|---|---|---|---|
| 1 | `ros2 node list` | Todos los nodos del launch, una sola vez | 16, 17 |
| 2 | `ros2 topic hz` de `/scan`, `/robotek/imu`, la cámara y `/cmd_vel_raw` | 10, 50, más de 5 y 50 Hz | 9, 11, 10, 17 |
| 3 | `ros2 topic echo /rrc/battery --once` | Más de 7000 mV | 18 |
| 4 | Mira los LED | Verde en los dos | 9, 4, 10 |
| 5 | `scan_probe.py`: mano delante y a la izquierda | Ángulos 0 y +90 | 9 |
| 6 | `imu_probe.py`: giro a la izquierda de 90 grados | `z` cerca de +90 | 4, 11 |
| 7 | Ruedas en el aire: `/steer` +0,30 | Ruedas a la izquierda | 3 |
| 8 | Ruedas en el aire: `/motor_vel` 15 | Giran hacia delante | 8 |
| 9 | Pulsa el botón y mira `/robotek/state` | `CALIBRATE`, `DETECT_DIRECTION`, `FOLLOW` en menos de 3 s | 1, 10 |
| 10 | En el suelo, a baja velocidad, una recta de 2 m | Sin desviarse y sin tocar | 3, 4, 5 |

## Qué anotar cuando algo falla

Un fallo bien anotado vale más que diez rondas buenas. Para cada intento, también los fallidos, guarda:

- Fecha, hora, batería (electrónica y motor), `motor_max_pct`, versión del código.
- Qué estado tenía `/robotek/state` al fallar, y qué pedía `/cmd_vel_raw`.
- Lo que viste con tus ojos: si giró bien, dónde chocó, de qué lado.
- El log del launch (`tee`) y, si puedes, un vídeo del móvil.
- La causa **probable**, marcada como hipótesis hasta que la compruebes.

Con ese registro el equipo pudo separar, entre ocho intentos, tres cables sueltos, un sentido mal decidido, una velocidad por encima del modelo y un reinicio sin explicar. Si te encuentras algo que no está aquí, apúntalo con el mismo formato.
