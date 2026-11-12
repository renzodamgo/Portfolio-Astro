---
guide: "open-strategy"
order: 10
slug: "paso-10-el-coche-real"
title: "Comprobar el coche real, sensor por sensor"
summary: "Comprueba la cámara, el LiDAR, la IMU, la dirección y el motor del coche real, uno a uno, antes de la primera ronda."
tag: "step-9"
compareFrom: "step-9"
---

Hasta aquí todo fue simulación. Antes de soltar el coche real en el campo conviene saber que **cada sensor y cada actuador hace lo que el código cree**: este capítulo los comprueba uno a uno, con el coche parado o sobre soportes.

Para instalar el Pi y lanzar una ronda, el camino corto es [Correr el Open en el Pi desde cero](/learn/open-strategy/correr-en-el-pi/). Vuelve aquí cuando algo no cuadre, cuando cambies una pieza o antes de correr **tu propia** estrategia.

Aquí importa ir despacio: un error en el simulador cuesta una ronda, y uno aquí puede costar un cable arrancado o un coche contra la pared.

> **Qué está probado y qué no.** Separo lo que se midió en un coche real de lo que solo he visto en simulación.
>
> - **Medido en el coche real** (equipo Robotek, 7 a 9 de octubre de 2026, montaje anterior): el retardo del servo, el ángulo real de las ruedas con círculos, la tabla de velocidad del motor, el LiDAR, la IMU, la cámara, el botón y los LED de la placa. De ahí salen los números de `robot.yaml` y del simulador.
> - **Rondas Open en el coche real:** la estrategia del equipo (el Open v5, la misma del curso con los valores del coche) hace rondas completas de 3 vueltas en los dos sentidos; el 11 de noviembre de 2026, en 31 a 38 s. Cómo lanzarla, en [Correr el Open en el Pi desde cero](/learn/open-strategy/correr-en-el-pi/).
> - **No probado en el coche real:** el paquete `my_open` de esta guía y `tools/setup-pi.sh` en un Pi recién instalado. `car.launch.py` sí: es el que lanza el Open del equipo. Los he escrito leyendo el código y los datos del equipo, no ejecutándolos en el coche. Si algo no coincide con lo que ves, tú tienes la razón: cuéntamelo.

<!-- step-video:start -->
<figure class="learn-step-video">
<video controls muted playsinline preload="none" poster="/learn/videos/open/paso-10-el-coche-real.jpg"><source src="/learn/videos/open/paso-10-el-coche-real.mp4" type="video/mp4"></video>
<figcaption>Lo que este capítulo añade a la estrategia, en 42 s de animación sin sonido.</figcaption>
</figure>
<!-- step-video:end -->

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/JxhMEpHXym4" title="ROS 2 on a Raspberry Pi Robot | CamJam EduKit #3 Robot Kit" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>ROS 2 on a Raspberry Pi Robot | CamJam EduKit #3 Robot Kit</strong> · Mike Likes Robots (inglés). ROS 2 instalado en una Raspberry Pi y arrancado en un robot real.</figcaption>
</figure>
</div>
<!-- videos:end -->

## 1. Qué necesitas

¿Todavía no está armado? Las instrucciones de montaje y de cables, paso a paso y con dibujos, están en [Armar y conectar el coche](/learn/open-strategy/armar-y-conectar-el-coche/).

### Piezas

- Una **Raspberry Pi 5** con Ubuntu 24.04 (la del equipo). Una Pi 4 no la he probado.
- La placa **HiWonder RRC Lite**: IMU (MPU6050), botones K1 y K2, dos LED RGB, el servo de dirección y el motor de tracción.
- El **LiDAR LDROBOT LD19**, con su adaptador USB serie, y una cámara: la del equipo es, desde el 4 nov 2026, una **IMX708 Wide** por el cable plano (`camera_driver:=picam`); antes, una **cámara USB** (solo da YUYV 640x480), que sigue sirviendo.
- El **motor de tracción**: un motor **310** (JGA27-310R 20:1, 450 rpm) con encoder, con engranajes 1:1 hasta el eje, en el puerto **M2** de la RRC Lite y **sin mandarle el tipo de motor** a la placa. La placa mantiene la velocidad con el encoder y para con un 0 ([sección 4 de El coche del equipo](/learn/open-strategy/coche-del-equipo-v5/)).
- Una **batería LiPo 2S** (7,4 V nominales) en la RRC Lite: alimenta la placa, el servo, el motor y el Pi.
- Soportes para levantar el coche del suelo (cajas, libros). Es lo más útil de la lista.

### Conexiones

| Qué | Dónde se conecta | Cómo lo ves en Linux |
|---|---|---|
| Placa RRC Lite | USB del Pi | `/dev/ttyACM0` (USB `1a86:55d4`) |
| Servo de dirección | Conector **J4** de la RRC Lite, que es el **canal PWM 1** (medido el 1 nov 2026; el código de Hiwonder usaba el 2) | `acker_channel: 1` en `rrc_lite_driver/config/controller_params.yaml` |
| Botón de Start | **K1** de la RRC Lite (K2 también cuenta) | `/rrc/button` |
| LED de estado | Los dos RGB de la RRC Lite (1 izquierdo, 2 derecho) | los maneja `status_leds` |
| LiDAR LD19 | USB del Pi, con su adaptador CP2102 | `/dev/ttyUSB0`, 230400 baudios (USB `10c4:ea60`) |
| Cámara IMX708 | Conector de cámara del Pi, por el cable plano | `/picam/image_raw` (`camera_driver:=picam`) |
| Cámara USB (alternativa) | USB del Pi | `/dev/v4l/by-id/...-video-index0` |
| Motor | Puerto **M2** de la RRC Lite (motor y encoder) | `rrc_motor_port: 2` y `rrc_motor_sign: -1.0` en `robot.yaml`; `motor_type: -1` (no mandar el tipo) en `controller_params.yaml` |

Enchufa la placa, el LiDAR y la cámara **antes** de encender el Pi. Si cambias el motor de puerto (al equipo le pasó tras un choque), cambia `rrc_motor_port` en `robot.yaml`.

### Alimentación

- **Usa una batería buena y cargada.** El motor anterior se midió con la batería casi vacía (7,0 a 7,4 V). En una prueba, con 6,5 V y el motor al 80 %, el Pi se reinició a mitad de ronda.
- La RRC Lite acepta de 6 a 14 V y da 5 V y 5 A al Pi. `battery_guard` avisa a 6,8 V (3,4 V por celda). Por debajo de 6 V la placa se apaga y las celdas se dañan.
- El motor sale ahora de la misma batería que el Pi, así que `battery_guard` vigila las dos cosas a la vez. Un arranque fuerte hunde la tensión de todo.
- **Un motor frenado se quema.** Con la rueda bloqueada (un choque de frente, el coche contra una pared) la placa sigue empujando para mantener la velocidad, y el motor se calienta: así se quemó el motor anterior. Si el coche choca, para el motor enseguida (botón o `Ctrl+C`).
- **Reinicios.** El Pi del equipo se reinició varias veces. Medido: con pulsos de motor, los 5 V del Pi no bajaron de 4,8 V y nunca hubo aviso de subtensión, así que la fuente estaba bien. Las causas que sí aparecieron fueron un **cable flojo** y una **tira de LED** de 30 píxeles en blanco al 100 %, que consume unos 1,8 A y apagó el Pi. De algunos reinicios no se llegó a saber la causa. Si el tuyo se reinicia: revisa primero cada conector y no cuelgues cosas grandes de los 5 V del Pi.

### La seguridad, primero

1. **La primera vez, el coche sobre soportes, con las ruedas en el aire.** Todas las pruebas de este capítulo se hacen así, salvo la ronda final.
2. **Una pulsación del botón es Start y la siguiente para el coche** (`/robotek/stop`). Pero el botón ignora pulsaciones separadas por menos de 1,5 s: en el primer segundo y medio no puedes parar con él. Ten la mano cerca de las ruedas y el cable de la batería a mano. `Ctrl+C` en la terminal también corta el motor.
3. **Un Start falso es posible.** En una de las rondas del equipo `/start` se publicó sin que nadie tocara el botón. Por eso las ruedas en el aire valen también para las pruebas con la estrategia lanzada.
4. **Pulsos cortos.** El equipo no encendió el motor más de 0,25 s seguidos en sus pruebas, y solo llegó a pulsos de 1 s con el 30 % o menos. Haz lo mismo: potencia baja, duración corta, y sube poco a poco.
5. **Arranca siempre a baja potencia.** A fondo desde parado el coche del equipo levantó las ruedas delanteras y la dirección dejó de actuar. Por eso `base_adapter` limita la aceleración a 1 m/s² y la deceleración a 0,6 m/s², y `motor_max_rps` limita la velocidad que se pide a la placa (el Open del equipo corre con `motor_max_rps:=6.7`; empieza con 2,5).
6. **Freno junto a la pared** (apagado por defecto desde el 8 nov 2026). Con `wall_stop_m: 0.10` en `robot.yaml`, `base_adapter` baja la velocidad hacia delante cuando el LiDAR ve algo a menos de 0,30 m (`wall_slow_m`) y la deja en 0 a 0,10 m. Se apagó porque en el Obstacle frenaba junto a cada pilar y el coche acababa parado; si lo enciendes y el coche se para cerca de una pared, es esto.

## 2. El Pi preparado y tu estrategia

Instala el Pi como en [Correr el Open en el Pi desde cero](/learn/open-strategy/correr-en-el-pi/), sección 2: `git clone`, `bash tools/setup-pi.sh`, cerrar sesión y `bash tools/setup-pi.sh --check`.

Eso basta para el Open del equipo. Para correr **tu** `my_open` del curso hay que llevarlo al Pi, porque no está en git (el repositorio lo ignora en `main`):

- **La tuya:** cópiala desde tu ordenador a `~/robotek-learn/src/my_open/` con `rsync` o `scp`, cada vez que la cambies.
- **La de referencia** (la solución del paso 9): `bash tools/get-reference.sh`. No pisa la tuya: avisa y sale; con `--force` guarda antes una copia.

Después, `colcon build --symlink-install`. Tu estrategia se lanza con `ros2 launch robotek_course open_challenge.launch.py` (sección 4).

## 3. Las comprobaciones, una a una

Carga el entorno en **cada terminal** del Pi:

```bash
cd ~/robotek-learn
source /opt/ros/jazzy/setup.bash
source install/setup.bash
```

### 3.1 Los dispositivos USB (sin ROS)

```bash
ls -l /dev/serial/by-id/ /dev/v4l/by-id/ /dev/rrc_lite /dev/ldlidar
```

Debes ver la placa (`1a86` en el nombre), el LiDAR (`Silicon_Labs_CP2102`) y la cámara terminada en `video-index0`. Si falta uno, lo primero es el cable. Si solo faltan `/dev/rrc_lite` o `/dev/ldlidar`, las reglas de udev no están activas: desenchufa y enchufa, o reinicia. Y si mueves un dispositivo de puerto con todo en marcha, relanza: los nodos que lo tenían abierto se quedan sin datos.

### 3.2 La cámara

Con el coche **sobre soportes** lanza todo, sin pulsar el botón:

```bash
ros2 launch robotek_course car.launch.py strategy:=my_open
```

Verás avisos amarillos: `base_adapter` dice que `servo_measured` es falso y `imu_adapter` dice que los ejes no están medidos. Es lo esperado hasta que calibres (3.4 y 3.5). **No pulses el botón.** Este lanzador deja tu `drive` esperando Start.

`car.launch.py --show-args` lista las opciones: `camera:=false`, `video_device:=...`, `camera_driver:=usb_cam`, `battery_guard:=false`, `status_leds:=false`, `lidar_package:=''`.

En otra terminal:

```bash
ros2 topic hz /usb_cam/image_raw
```

Debes ver entre 5 y 15 imágenes por segundo. La cámara del equipo, con exposición automática, daba unos 6,5 con la luz de una sala y hasta unos 15 con otra. El simulador usa 6. El nodo `camera_publisher` busca la cámara solo; si no la encuentra, avisa y reintenta cada segundo (mira su mensaje en la primera terminal). Si usas otra cámara, `video_device:=/dev/v4l/by-id/...`, y `camera_driver:=usb_cam` cambia al paquete `ros-jazzy-usb-cam`.

**Con la IMX708 del equipo** (cable plano): añade `camera_driver:=picam` al lanzar y mira `ros2 topic hz /picam/image_raw`. En el Open va a 1280x720 y 10 fps, y solo hasta que la estrategia elige el sentido; en el Obstacle, a 640x360 y 30 fps toda la ronda. Si no llega imagen, lo primero es el cable plano: suelto, el Open se queda calculando el sentido (`DIRECTION_FAULT`). Sus colores son otros que los de la USB: usa `~/.config/robotek/open_v5_car_picam.yaml`.

Para **ver** la imagen, desde otro ordenador con pantalla (la red, en 3.3):

```bash
ros2 run rqt_image_view rqt_image_view /usb_cam/image_raw/compressed     # Ubuntu
```

Usa siempre el tópico `compressed` por Wi-Fi: la imagen cruda pesa unos 0,9 MB por cuadro y no llega. En la Mac del curso no hay `rqt`: usa una pantalla `Image` de RViz con ese mismo tópico (el equipo tuvo que instalar `ros-jazzy-compressed-image-transport` en RoboStack). El Pi solo comprime si alguien se suscribe.

<details>
<summary>Sin pantalla: guardar un cuadro en el Pi</summary>

```bash
python3 - <<'PY'
import cv2, rclpy
from cv_bridge import CvBridge
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import Image

rclpy.init()
node = rclpy.create_node('grab_frame')
def save(msg):
    cv2.imwrite('cuadro.png', CvBridge().imgmsg_to_cv2(msg, 'bgr8'))
    raise SystemExit
node.create_subscription(Image, '/usb_cam/image_raw', save, qos_profile_sensor_data)
try:
    rclpy.spin(node)
except SystemExit:
    print('guardado cuadro.png')
PY
```

Cópialo a tu ordenador. Mira que se ven las líneas naranja y azul y que no hay reflejos de las luces.

</details>

### 3.3 El LiDAR: tasa y vista en RViz

```bash
ros2 topic hz /robotek/scan
```

Debes ver cerca de **10 Hz** (el LD19 del equipo daba 10,1). Si no hay nada, el driver no abrió el puerto y terminó: mira la primera terminal.

Ahora mira lo que ve. Desde **otro ordenador** de la misma red (el que usaste para el simulador), con el **mismo número de dominio** que el Pi. `tools/macos_env.sh` usa el 42 y limita el descubrimiento a tu propio ordenador, así que hay que cambiar eso. En clase, **cada coche necesita su propio número** (elige uno entre 1 y 100), o verás los sensores de tus compañeros mezclados con los tuyos.

En el Pi, antes de lanzar (o añade las líneas a `~/.bashrc`):

```bash
export ROS_DOMAIN_ID=7                        # el tuyo
export ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET   # por defecto
export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
```

En el ordenador:

```bash
export ROS_DOMAIN_ID=7                          # macos_env.sh respeta este valor (si no hay, usa 42)
source tools/macos_env.sh ~/robotek-ros/jazzy   # en Ubuntu: source /opt/ros/jazzy/setup.bash y
                                                # export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
export ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET     # macos_env.sh pone LOCALHOST: lo cambiamos
ros2 topic list                                 # deben aparecer /robotek/scan y /rrc/...
ros2 run rviz2 rviz2
```

El equipo lo usó así por Wi-Fi, con el mismo middleware y dominio en los dos lados y el cortafuegos de macOS apagado. Si `ros2 topic list` no muestra nada, casi siempre es el dominio, el middleware o la red. Fuera de la red local, DDS no funciona sin una VPN.

En RViz: pon **Fixed Frame** en `lidar_link` y añade una pantalla `LaserScan` con el tópico `/robotek/scan` y **Reliability Policy** en `Best Effort` (el LiDAR publica así; con otra no verás nada). La prueba es esta: con una pared delante, la ves **delante**. Pon la mano a la izquierda del coche y debe aparecer a la izquierda. Si todo sale girado 180 grados o espejado, es `angle_offset` (el LD19 tiene el cero hacia atrás: el valor por defecto es π) o `reverse` en `robot.yaml`. Además, el LiDAR del coche solo ve ±110 grados: detrás los rayos dan en el propio chasis, y `scan_adapter` los descarta.

### 3.4 La IMU: tasa y signo del giroscopio

```bash
ros2 topic hz /rrc/imu_raw
ros2 topic hz /robotek/imu
ros2 topic echo /rrc/battery --once
```

La IMU debe dar unos **49 Hz** en los dos (el simulador usa 50). La batería publica a 1 Hz, en milivoltios: de 7000 a 8400 es una 2S sana.

Ahora lo que más importa del capítulo. Tu estrategia integra `angular_velocity.z` como la velocidad de giro, y espera que **girar a la izquierda sea positivo**. Si el signo o el eje están mal, el coche cree que gira al revés y se estrella en la primera esquina.

```bash
ros2 topic echo /robotek/imu --field angular_velocity.z
```

Coge el coche con la mano y gíralo despacio **hacia la izquierda, en sentido contrario a las agujas del reloj visto desde arriba**. Debes ver valores **positivos**. Con el coche quieto deben quedarse cerca de cero (el equipo midió un sesgo de 0,006 rad/s y un ruido de 0,0019). Comprueba también:

```bash
ros2 topic echo /robotek/imu --field linear_acceleration
```

Con el coche en reposo `z` ronda +9,8 m/s². Un empujón suave hacia delante da `x` positiva.

Si algo falla, los ejes de la placa no coinciden con los del coche. Es casi seguro si montas la placa de canto. La herramienta `imu_axes` los mide, y solo escucha (puedes dejarla con el resto corriendo):

```bash
ros2 run robotek_hardware imu_axes
```

Deja el coche quieto 3 s y, cuando diga `PUSH`, dale un empujón suave hacia delante y suéltalo. Imprime un bloque con `forward_axis`, `left_axis` y `up_axis` y el error angular de cada eje (más de 15 grados: placa inclinada o empujón torcido, repítelo). Copia el bloque en la sección `imu_adapter` de `src/robotek_hardware/config/robot.yaml`, pon `measured: true` y recompila:

```bash
colcon build --symlink-install --packages-select robotek_hardware
```

Relanza y repite la prueba del giro a mano. Los valores de `robot.yaml` son los de **otro montaje**: no te fíes de ellos.

### 3.5 La dirección: centro y signo

Para el servo y el motor, **para el lanzador** (`Ctrl+C`): `base_adapter` y la estrategia mandan órdenes constantemente y se pisarían con las tuyas. Lanza solo el driver de la placa y el nodo de prueba, que mueve **solo el servo**, nunca el motor. `servo_steer` no lee `robot.yaml`: pásale el centro, la ganancia y el signo del coche del equipo:

```bash
ros2 launch rrc_lite_driver controller.launch.py        # terminal 1: el driver de la placa
ros2 run robotek_hardware servo_steer --ros-args -p servo_center_us:=1403.0 \
  -p servo_gain_pos:=20.0 -p servo_gain_neg:=20.0 -p servo_sign:=1.0      # terminal 2
```

En una tercera terminal, publica el ángulo del **servo**. Es en radianes y **positivo es a la izquierda**:

```bash
ros2 topic pub -r 5 /steer std_msgs/msg/Float32 "{data: 0.0}"
```

Si dejas de publicar, el servo vuelve al centro a los 0,5 s. Mira las ruedas desde arriba con una regla: con 0.0 deben quedar **rectas**. Si no, prueba otro centro (`servo_center_us`) de 10 en 10 µs. Ahora el signo, con `data: 0.35` (unos 20 grados, que se ven bien): mirando el coche **desde atrás**, las ruedas deben girar hacia **tu izquierda**; con `-0.35`, a la derecha. Si salen al revés, cambia `servo_sign`. Sube con cuidado: la palanca del servo puede topar con la placa o las varillas.

**Medir la dirección en el suelo.** Con un transportador se mide mal. El equipo la midió el 1 de noviembre de 2026 con `tools/steer_calibration.py`: el coche avanza unos segundos con cada pulso del servo, el giroscopio da cuánto gira y, con la velocidad medida con el LiDAR, sale el ángulo real de las ruedas (`ángulo = atan(L · giro / v)`). Después de cada pulso vuelve marcha atrás por el mismo arco. Necesita `car.launch.py` en marcha **sin** `base_adapter`, que pisaría el servo y el motor (por ejemplo, `teleop:=true` y después `pkill -f base_adapter`), y ~1,5 m libres delante:

```bash
python3 tools/steer_calibration.py 1100 1250 1400 1550 1700        # pulsos del servo, en µs
```

El resultado del coche del equipo, ya en `robot.yaml`: el centro real es **1403 µs** (con 1500 iba 4,5° a la derecha), cada grado de servo son 20 µs a los dos lados, y las ruedas giran como mucho 19° a la derecha (a la izquierda, más). `wheel_limit_deg: 19` deja el mismo tope a los dos lados, y la tabla `wheel_table_*` hace que el ángulo pedido sea el que gira la rueda, de forma proporcional: la estrategia funciona igual en sentido horario y antihorario.

**Comprobar la calibración.** Con `base_adapter` en marcha (el lanzador normal, sin estrategia: `teleop:=true`), pide ángulos de rueda como lo haría una estrategia y mira lo que gira de verdad:

```bash
python3 tools/steer_calibration.py --check 0 10 -10 19 -19
```

Cada ángulo pedido debe salir a uno o dos grados. En el coche del equipo, la derecha y el centro dieron −0,2°, −8,7° y −18,7°. **La izquierda está por comprobar en el suelo.**

### 3.6 El motor: velocidad baja

Aún con las ruedas en el aire y el servo parado. Solo el driver de la placa (el motor va por ella):

```bash
ros2 launch rrc_lite_driver controller.launch.py
```

En otra terminal, una velocidad baja, en vueltas por segundo de la placa (rps) del puerto M2. `rrc_driver` invierte el signo, así que en este tópico **−rps es hacia delante**:

```bash
ros2 topic pub -r 10 /rrc/set_motor rrc_lite_msgs/msg/MotorsState "{data: [{id: 2, rps: -2.0}]}"
```

Las ruedas traseras deben girar **hacia delante**. Hay que repetir la orden: el driver para el motor si pasan 0,5 s sin ninguna. Para (`Ctrl+C`): la rueda se para. Prueba `rps: 2.0` para la marcha atrás. No dejes el motor encendido más de unos segundos. Si va siempre a tope o no para con 0, se le está mandando un tipo de motor: `motor_type: -1`.

Lo que se sabe del motor:

- La "rps" de la placa **no es una vuelta real** del motor: depende del tipo de motor que la placa cree tener. Sin mandarle el tipo, en el coche del equipo, 1 rps son ~0,22 m/s (medido con el LiDAR el 8 nov 2026).
- `base_adapter` convierte los m/s de tu estrategia en rps con `motor_rps_per_mps` y nunca pide más de `motor_max_rps`. Con los engranajes 1:1 son **8,0** rps por m/s: pásalo al lanzar (`motor_rps_per_mps:=8.0`), porque `robot.yaml` aún trae 4,4, de los engranajes 54:30 de antes.
- El coche sigue la consigna desde ~0,1 rps (~0,02 m/s) en los dos sentidos. Pero con la dirección a tope, desde parado, le falta fuerza por debajo de ~1 rps. Tras un 0 se desliza 8–35 cm.

## 4. Después de las comprobaciones

Con las comprobaciones 3.1 a 3.6 bien, y `servo_measured` e `imu_adapter.measured` en `true` en `robot.yaml`:

- **El Open del equipo:** [Correr el Open en el Pi desde cero](/learn/open-strategy/correr-en-el-pi/), desde la sección 4. Allí están las luces, el botón, dónde queda la ronda y el arranque automático.
- **Tu `my_open`:** el mismo coche y el mismo botón, con otro lanzador. Empieza despacio:

```bash
cd ~/robotek-learn && bash tools/car-clean.sh
source /opt/ros/jazzy/setup.bash && source install/setup.bash
ros2 launch robotek_course open_challenge.launch.py motor_rps_per_mps:=8.0 motor_max_rps:=4.0
```

`motor_max_rps:=4.0` no deja pasar de 0,5 m/s con los engranajes 1:1. Tu `my_open` trae las constantes del simulador (pide 1,28 m/s en las rectas), y en el coche los m/s son reales: sin ese tope iría mucho más rápido que en Gazebo. Súbelo cuando las esquinas salgan bien, o baja `CRUISE_SPEED` y `CORNER_SPEED` en tu `mission.py`. Los valores con los que corre el equipo están en la [tabla del capítulo del Pi](/learn/open-strategy/correr-en-el-pi/#6-los-valores-del-coche). **Nadie ha corrido `my_open` en el coche todavía.**

## 5. El coche real no es el simulador

El simulador `real_car` modela lo que el equipo midió. Conviene saber qué es y qué no.

| Parte | Lo que modela el simulador (medido en el coche) |
|---|---|
| Servo | Retardo de 0,06 s; velocidad de giro de 1,2 rad/s; el ángulo de las ruedas limitado a 17,6 grados (la dirección medida del 8 de octubre; el coche llega ahora a 19°) |
| Motor | Retardo de 0,06 s y respuesta de 0,15 s; aceleración 1,0 y deceleración 0,6 m/s²; una tabla de velocidad del **motor anterior**, medida con la batería baja (pedir 0,30 da 0,27 m/s, pedir 0,60 da 0,42; el tope de 0,60 m/s se infirió). El motor 310 va a ~0,45–0,5 m/s con 2,5 rps y no frena solo con 0 (no está en el modelo) |
| LiDAR | ±110 grados, 306 rayos, 10 Hz, ruido de unos 8 mm y un 4,3 % de rayos perdidos al azar |
| IMU | 50 Hz, ruido del giroscopio de 0,0019 rad/s y un **sesgo** de 0,006 rad/s |
| Cámara | Unos 6 fps y el campo de visión del coche, con la cámara girada 4,4 grados |

Y esto es lo que **no** modela:

- **Patinaje de las ruedas** y la **fricción del suelo**. En Gazebo las ruedas no resbalan como en el piso real.
- **La caída de la batería** al acelerar, y el motor 310: va a la velocidad que le deja la placa, no a la pedida, y con 0 a veces sigue de largo.
- **El bucle de control más lento.** En el Pi, la estrategia corre a ~35–40 ciclos por segundo, no a 50. Si integras el giroscopio suponiendo 1/50 s por ciclo, el rumbo te sale corto y cada esquina gira de más (al Open v5 le pasaba: ~115° en vez de 90°). Usa el tiempo real entre ciclos.
- **El giroscopio no es exacto.** El de la placa marca un ~5 % menos de lo que gira el coche: en tres vueltas son decenas de grados. Corrige el rumbo con lo que ves: el Open v5 ajusta una recta a las paredes de cada lado con el LiDAR y, en las rectas, acerca su rumbo a ellas (`wall_heading_gain`, explicado en [El coche del equipo](/learn/open-strategy/coche-del-equipo-v5/#los-valores-del-open-para-el-coche)).
- **El encabritamiento:** a fondo desde parado el morro se levanta. No pasa en simulación.
- **La luz.** El simulador tiene colores perfectos. Los rangos de `line_lengths` de la guía son los del simulador y con la luz de tu sala pueden fallar. Al equipo le pasó: la pared beige de la sala cayó dentro del naranja y el coche giró mal. El remedio fue mirar solo la parte del suelo de la imagen y medir los colores reales.
- **La distorsión de la lente** de la cámara y el retardo propio de los sensores.
- **Las medidas del coche que cambian** cuando reconstruyes: la distancia entre ejes (0,1174 m en el repositorio), el sitio del LiDAR y de la cámara, el sesgo real del giroscopio.

Una ronda perfecta en Gazebo no demuestra nada sobre el coche. Y una mala en el coche suele ser un sensor (el color, el sesgo, un signo) o la velocidad real, casi nunca tu algoritmo.

## 6. Cuando algo falla

- **El coche se estrella al arrancar, vuelca, el giroscopio está invertido o no hay datos de un sensor:** [Solución de problemas del coche real](/learn/open-strategy/paso-11-solucion-de-problemas/).
- **Funciona pero quieres ir más rápido o con más margen:** [Afinar](/learn/open-strategy/paso-12-afinar/).

Antes, repite la primera ronda un par de veces con la misma batería y el mismo tope de motor: una ronda buena no dice nada todavía.

Para lanzar la estrategia del equipo: [Correr el Open en el Pi desde cero](/learn/open-strategy/correr-en-el-pi/).
