---
guide: "open-strategy"
order: 10
slug: "paso-10-el-coche-real"
title: "Del git clone al primer arranque en el coche real"
summary: "Instala el repositorio en la Raspberry Pi, comprueba cada sensor y haz la primera ronda con el coche real."
tag: "step-9"
compareFrom: "step-9"
---

Hasta aquí todo fue simulación. En este capítulo llevas el mismo nodo `drive` al coche real: lo montas, instalas el repositorio en la Raspberry Pi, compruebas cada sensor y cada actuador por separado, y solo al final haces una primera ronda en el campo.

Aquí importa ir despacio: un error en el simulador cuesta una ronda, y uno aquí puede costar un cable arrancado o un coche contra la pared.

> **Qué está probado y qué no.** Separo lo que se midió en un coche real de lo que solo he visto en simulación.
>
> - **Medido en el coche real** (equipo Robotek, 7 a 9 de octubre de 2026, montaje anterior): el retardo del servo, el ángulo real de las ruedas con círculos, la tabla de velocidad del motor, el LiDAR, la IMU, la cámara, el botón y los LED de la placa. De ahí salen los números de `robot.yaml` y del simulador.
> - **Rondas Open en el coche real:** el 8 de octubre el equipo hizo ocho intentos con su propia estrategia (el v4) y su propio lanzador, que viven en otro repositorio. El primero chocó contra el muro a los 2,9 s: el color de la pared de la sala se confundió con una línea. Con el motor limitado al 40 % el coche dio los 12 giros y llegó a `DONE` en 47,1 s, y el operador dijo que funcionó. Con el 50 %, 40,4 s, pero rozó dos veces la isla interior. Los demás fallaron por un cable suelto (varias veces), un Start falso, un reinicio del Pi con la batería a 6,5 V y un choque al 90 % del motor. No hubo juez: no sé cuántos puntos habrían sido, solo hay una estimación provisional.
> - **Después de eso el coche se reconstruyó** (21 de octubre): el servo de dirección cambió de sitio y giró 90 grados, y la Raspberry y la placa van de canto. Hasta donde llegan mis notas, el servo y los ejes de la IMU de esa construcción no se han vuelto a medir y no se ha hecho ninguna ronda con ella.
> - **No probado en el coche real:** `car.launch.py`, `tools/setup-pi.sh`, el paquete `my_open` de esta guía y los comandos de este capítulo. Los he escrito leyendo el código y los datos del equipo, no ejecutándolos en el coche. Si algo no coincide con lo que ves, tú tienes la razón: cuéntamelo.

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

- Una **Raspberry Pi 5** con Ubuntu 24.04 (la del equipo). Una Pi 4 no la he probado: el motor usa el chip de GPIO 4 del Pi 5, y en otra placa ese número cambia (`gpiochip` en `robot.yaml`).
- La placa **HiWonder RRC Lite**: IMU (MPU6050), botones K1 y K2, dos LED RGB y el servo de dirección.
- El **LiDAR LDROBOT LD19**, con su adaptador USB serie, y una **cámara USB** (la del equipo solo da YUYV 640x480).
- El **motor de tracción** con un puente **TB6612FNG** conectado a pines GPIO del Pi.
- Una **batería LiPo 2S** (7,4 V nominales) para la electrónica y, mejor, otra aparte para el motor.
- Soportes para levantar el coche del suelo (cajas, libros). Es lo más útil de la lista.

### Conexiones

| Qué | Dónde se conecta | Cómo lo ves en Linux |
|---|---|---|
| Placa RRC Lite | USB del Pi | `/dev/ttyACM0` (USB `1a86:55d4`) |
| Servo de dirección | Conector **J4** de la RRC Lite (canal PWM 2) | lo manda el driver de la placa |
| Botón de Start | **K1** de la RRC Lite (K2 también cuenta) | `/rrc/button` |
| LED de estado | Los dos RGB de la RRC Lite (1 izquierdo, 2 derecho) | los maneja `status_leds` |
| LiDAR LD19 | USB del Pi, con su adaptador CP2102 | `/dev/ttyUSB0`, 230400 baudios (USB `10c4:ea60`) |
| Cámara | USB del Pi | `/dev/v4l/by-id/...-video-index0` |
| Motor | Puente TB6612FNG a GPIO del Pi: PWM 12, AIN1 5, AIN2 6, STBY 13 | chip `gpiochip4` |

Enchufa la placa, el LiDAR y la cámara **antes** de encender el Pi. El pin **STBY** (13) es fácil de olvidar: si el puente no lo recibe en alto, el motor no se mueve (al equipo le pasó: el servo respondía y el motor solo andaba a ratos). `motor_driver` lo pone en alto solo.

### Alimentación

- **Usa una batería buena y cargada.** La tabla de velocidad del motor se midió con la batería casi vacía (7,0 a 7,4 V), y con otra carga el coche va a otra velocidad. En una prueba, con 6,5 V y el motor al 80 %, el Pi se reinició a mitad de ronda.
- La RRC Lite acepta de 6 a 14 V y da 5 V y 5 A al Pi. `battery_guard` avisa a 6,8 V (3,4 V por celda). Por debajo de 6 V la placa se apaga y las celdas se dañan.
- El equipo decidió dar al motor **su propia batería**, para que no hunda la tensión del Pi. Ten en cuenta que `battery_guard` solo vigila la de la placa: la del motor no la vigila nadie.
- **Corriente del motor:** no la medí. La hoja de datos del TB6612FNG da 1,2 A continuos y 3,2 A de pico por canal, así que comprueba que tu motor no pide más. Un motor con la rueda bloqueada es lo que más corriente pide.
- **Reinicios.** El Pi del equipo se reinició varias veces. Medido: con pulsos de motor, los 5 V del Pi no bajaron de 4,8 V y nunca hubo aviso de subtensión, así que la fuente estaba bien. Las causas que sí aparecieron fueron un **cable flojo** y una **tira de LED** de 30 píxeles en blanco al 100 %, que consume unos 1,8 A y apagó el Pi. De algunos reinicios no se llegó a saber la causa. Si el tuyo se reinicia: revisa primero cada conector y no cuelgues cosas grandes de los 5 V del Pi.

### La seguridad, primero

1. **La primera vez, el coche sobre soportes, con las ruedas en el aire.** Todas las pruebas de este capítulo se hacen así, salvo la ronda final.
2. **Una pulsación del botón es Start y la siguiente para el coche** (`/robotek/stop`). Pero el botón ignora pulsaciones separadas por menos de 1,5 s: en el primer segundo y medio no puedes parar con él. Ten la mano cerca de las ruedas y el cable de la batería a mano. `Ctrl+C` en la terminal también corta el motor.
3. **Un Start falso es posible.** En una de las rondas del equipo `/start` se publicó sin que nadie tocara el botón. Por eso las ruedas en el aire valen también para las pruebas con la estrategia lanzada.
4. **Pulsos cortos.** El equipo no encendió el motor más de 0,25 s seguidos en sus pruebas, y solo llegó a pulsos de 1 s con el 30 % o menos. Haz lo mismo: potencia baja, duración corta, y sube poco a poco.
5. **Arranca siempre a baja potencia.** A fondo desde parado el coche del equipo levantó las ruedas delanteras y la dirección dejó de actuar. Por eso `base_adapter` limita la aceleración a 1 m/s² y la deceleración a 0,6 m/s², y `motor_max_pct` limita el motor.

## 2. Clonar y preparar el Pi con un comando

### El camino corto: la estrategia de referencia

Si solo quieres ver al coche hacer la ronda con la estrategia terminada de los pasos 2 a 9, son tres comandos en el Pi, con internet:

```bash
git clone https://github.com/renzodamgo/robotek-learn.git && cd robotek-learn
bash tools/setup-pi.sh --with-reference
source install/setup.bash && ros2 launch robotek_course open_challenge.launch.py motor_max_pct:=30
```

El segundo comando instala todo y, además, saca la estrategia terminada de la etiqueta `step-9` y la deja en `src/my_open`. Con el tercero arrancan los nodos del coche. Cuando las luces estén **verdes**, pulsas el botón de la placa **una vez** para empezar y **otra vez** para parar. Antes de pulsarlo la primera vez, lee la sección 4: el coche en alto, el motor limitado y la batería cargada. Y ojo con la dirección: el archivo `robot.yaml` trae el centro y el signo del servo del coche del equipo (`servo_measured: false`). Si tu coche es otro, el servo saltará a ese centro en cuanto la estrategia publique y el coche saldrá torcido. Haz antes las comprobaciones 3.5 y 3.6.

Si ya tienes la estrategia de otra forma, `get-reference.sh` no la pisa: avisa y sale. Con `--force` guarda una copia (`src/my_open.bak-FECHA`) y la reemplaza. Si lanzas sin tener `my_open`, el lanzador no da un error técnico: te dice en español los dos caminos y sale.

### El camino largo: tu propia estrategia

Clona igual:

```bash
git clone https://github.com/renzodamgo/robotek-learn.git
cd robotek-learn
```

Tu estrategia `my_open` no está en git (el repositorio la ignora en `main`). Cópiala desde tu ordenador a `robotek-learn/src/my_open/` antes de seguir, con `rsync`, `scp` o clonándola de tu propio repositorio. Cada vez que cambies tu código en el ordenador tendrás que volver a copiarla.

Ahora el script (sin `--with-reference`, porque ya tienes tu paquete):

```bash
bash tools/setup-pi.sh
```

Es repetible: lo que ya está hecho se salta. Pide `sudo` y tarda varios minutos (`--dry-run` muestra los comandos sin ejecutarlos). Hace cuatro cosas:

1. Comprueba que el sistema es Ubuntu 24.04. En otro sistema se niega, salvo `ROBOTEK_FORCE=1`.
2. Instala ROS 2 Jazzy **sin Gazebo ni RViz** (en el Pi no los necesitas) y los paquetes de apt del coche: `cv_bridge`, `robot_state_publisher`, `xacro`, `python3-serial`, `python3-lgpio`, `python3-opencv`, `v4l-utils`.
3. Instala las **reglas de udev** (`tools/99-robotek.rules`) y te añade a los grupos `dialout` (puertos serie), `video` (cámara) y `gpio` (motor).
4. Compila todo con `colcon build --symlink-install`.

Los **drivers de terceros ya vienen en el repositorio**, en `src/`: el del LiDAR (`ldlidar_stl_ros2`, de LDROBOT, con licencia MIT) y el de la placa (`rrc_lite_driver` y `rrc_lite_msgs`, basado en el código de Hiwonder). Los de Hiwonder se incluyen con su permiso; los créditos están en `CREDITS.md`. No hay que descargar nada más.

Las reglas de udev dan nombres fijos, `/dev/rrc_lite` a la placa y `/dev/ldlidar` al LiDAR, que no dependen del puerto USB, y evitan que ModemManager ocupe la placa. Los grupos solo cuentan en una sesión nueva: **cierra la sesión y vuelve a entrar, o reinicia el Pi**.

Después, comprueba sin tocar nada:

```bash
bash tools/setup-pi.sh --check
```

Imprime una línea por cosa: `ok`, `FALTA` o `aviso`. Mira el sistema, ROS, los paquetes compilados (incluido `my_open`), la placa, el LiDAR, la cámara, el GPIO, `lgpio`, `pyserial` y los grupos, y termina con el recuento. Un `FALTA` en un USB es casi siempre un cable. `--check` no arranca nada.

El script no se ha probado en un Pi limpio. Si falla, mira qué comando falló y cuéntamelo.

## 3. Las comprobaciones, una a una

Carga el entorno en **cada terminal** del Pi:

```bash
cd ~/robotek-learn
source /opt/ros/jazzy/setup.bash
source install/setup.bash
```

### 3.1 Los dispositivos USB (sin ROS)

```bash
ls -l /dev/serial/by-id/ /dev/v4l/by-id/ /dev/rrc_lite /dev/ldlidar /dev/gpiochip4
```

Debes ver la placa (`1a86` en el nombre), el LiDAR (`Silicon_Labs_CP2102`) y la cámara terminada en `video-index0`. Si falta uno, lo primero es el cable. Si solo faltan `/dev/rrc_lite` o `/dev/ldlidar`, las reglas de udev no están activas: desenchufa y enchufa, o reinicia. Si falta `/dev/gpiochip4`, tu Pi no es un Pi 5. Y si mueves un dispositivo de puerto con todo en marcha, relanza: los nodos que lo tenían abierto se quedan sin datos.

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

Para el servo y el motor, **para el lanzador** (`Ctrl+C`): `base_adapter` y la estrategia mandan órdenes constantemente y se pisarían con las tuyas. Lanza solo el driver de la placa y el nodo de prueba, que mueve **solo el servo**, nunca el motor:

```bash
ros2 launch rrc_lite_driver controller.launch.py        # terminal 1: el driver de la placa
ros2 run robotek_hardware servo_steer                    # terminal 2
```

En una tercera terminal, publica el ángulo. Es en radianes y **positivo es a la izquierda**:

```bash
ros2 topic pub -r 5 /steer std_msgs/msg/Float32 "{data: 0.0}"
```

Si dejas de publicar, el servo vuelve al centro a los 0,5 s. Mira las ruedas desde arriba con una regla: con 0.0 deben quedar **rectas**. Si no, ajusta el centro (`servo_center_us`, 1500 por defecto) de 10 en 10 µs:

```bash
ros2 run robotek_hardware servo_steer --ros-args -p servo_center_us:=1510.0
```

Sube con cuidado: la palanca del servo puede topar con la placa o las varillas. Ahora el signo, con `data: 0.35` (unos 20 grados, que se ven bien; a 10 grados casi no se aprecia). Mirando el coche **desde atrás**, las ruedas deben girar hacia **tu izquierda**. Con `-0.35`, a la derecha. Si salen al revés, cambia `servo_sign` (de -1.0 a 1.0).

Cuando el centro y el signo estén bien, mide el **ángulo real de cada rueda** para 10, 15, 20 y 25 grados de servo, a cada lado, con un transportador o una foto desde arriba, y rellena `servo_center_us`, `servo_sign`, `wheel_table_servo_deg`, `wheel_table_left_deg`, `wheel_table_right_deg` y `wheel_limit_deg` en `robot.yaml`. Después pon `servo_measured: true`. `base_adapter` avisa en cada arranque mientras sea `false`.

Un dato del coche del equipo, con el montaje anterior: 25 grados de servo daban unos 19,7 grados de rueda a la izquierda y 17,6 a la derecha, y `base_adapter` limitaba a 17,6 en los dos lados. No te sirve de valor, pero te dice que las ruedas **no giran lo que pides**.

### 3.6 El motor: velocidad baja

Aún con las ruedas en el aire y el servo parado. Solo el nodo del motor:

```bash
ros2 run robotek_hardware motor_driver
```

Debe decir `TB6612FNG ready`. Si dice `GPIO chip 4 not usable`, falta `python3-lgpio`, tu usuario no está en el grupo `gpio` o el chip se llama de otra forma (`ls /dev/gpiochip*` y `gpiochip` en `robot.yaml`).

En otra terminal, un **15 %** de potencia, que es poco. El equipo vio mover el coche desde un 10 %:

```bash
ros2 topic pub -r 20 /motor_vel std_msgs/msg/Float32 "{data: 15.0}"
```

Las ruedas traseras deben girar **hacia delante**. Si giran hacia atrás, intercambia los cables del motor. Hay que repetir la orden a 20 Hz: `motor_driver` corta el motor si pasan 0,3 s sin orden (y lo para con una rampa de 0,6 s, a propósito: parar en seco hacía patinar al coche). Para, y prueba `-15.0` para la marcha atrás. Sube de 5 en 5 hasta un 30 % como máximo en esta prueba, sin dejar nunca el motor encendido más de unos segundos.

Para el motor, esto es lo que midió el equipo con la batería baja: el coche empieza a moverse hacia el 6,5 %, y a un 20 % va a unos 0,20 m/s, a un 30 % a unos 0,32 m/s. La regla que usa `base_adapter` es `% = 6,5 + 73 x velocidad`. Con la batería cargada irá más rápido.

## 4. La primera ronda, en el suelo

### Antes de poner el coche en el campo

1. Las comprobaciones 3.1 a 3.6 pasan, y `servo_measured` e `imu_adapter.measured` son `true`.
2. **Baja el tope del motor.** Lánzalo con `motor_max_pct:=30` (o cambia `motor_max_pct` en `robot.yaml` y recompila `robotek_hardware`). Con el valor del equipo (50) el coche irá a unos 0,4 m/s; con 30, a unos 0,3. Es lento y es lo que quieres para empezar.
3. La batería cargada: `ros2 topic echo /rrc/battery --once`.
4. Un campo Open montado, la isla fija y el coche en la sección de salida, como en el simulador.

### Lanzar

Guarda la salida de la consola, que es tu registro:

```bash
mkdir -p ~/rondas-coche
ros2 launch robotek_course open_challenge.launch.py motor_max_pct:=30 2>&1 | tee ~/rondas-coche/ronda-01.log
```

Espera a que las luces se pongan **verdes**. Con la batería cargada y el coche en su posición de salida, pulsa el botón **una vez**.

### Qué significan los LED

Las luces son muy tenues a propósito (2 de 255): con más brillo se reflejaban en la cámara. Míralas de cerca.

| Estado | LED izquierdo | LED derecho |
|---|---|---|
| Arrancando (primeros 15 s) | apagado | apagado |
| Listo, esperando Start (LiDAR, IMU y cámara con datos) | verde | verde |
| Falta un sensor antes de Start | rojo | azul = LiDAR, magenta = IMU, amarillo = cámara |
| Calibrando tras Start | azul | azul |
| En ronda, o parado con el botón | apagado | apagado |
| Terminó (`DONE`) | verde parpadeando | verde parpadeando |
| Fallo de la estrategia (`FAULT`, `DIRECTION_FAULT`, `STALLED`, `PARK_FAIL`) | rojo fijo | rojo fijo |
| Batería baja (menos de 6,8 V), hay que cambiarla | rojo parpadeando | rojo parpadeando |

Los estados salen de lo que publica **tu** nodo en `/robotek/state` (lo hace `drive.py` desde el paso 7). Si falta un sensor, solo muestra el primero en este orden: LiDAR, IMU, cámara. Durante la ronda las luces van apagadas aunque falle un sensor.

### El botón

- **Primera pulsación:** publica `/start` y pita una vez. El zumbador de la placa del equipo está quemado, así que allí no suena: no dependas del pitido.
- **Segunda pulsación:** publica `/robotek/stop` y pita dos veces. `base_adapter` y `motor_driver` ponen el motor a 0 y lo mantienen. Tu nodo pasa a `OPERATOR_STOP` y no se mueve más hasta lanzar de nuevo.
- Las pulsaciones a menos de 1,5 s de la anterior se ignoran.

**Qué imprime la consola.** Son líneas del código, no la captura de una ronda real. Al arrancar: `Press the button to start; press it again to stop.` (`start_button`), `TB6612FNG ready` (`motor_driver`) y `Status RGBs at level 2/255.` (`status_leds`). Con el primer pulso: `Start.` y el `Start` de tu `drive`, y después lo que escribiste en cada paso (`Giro a la izquierda (esquina N)`). Con el segundo: `Stop (button pressed again).` y `Operator stop: motor held at 0.`. Si la batería baja de 6,8 V: `Battery X V < 6.80 V: change it before the next round`.

### El registro de una ronda

En el coche no hay juez, ni posición real, ni registro de contactos, y `ros2 run robotek_course score` no puntúa rondas reales. El juez eres tú. Apunta, para cada intento, también los fallidos:

- El archivo de registro, la batería antes (`ros2 topic echo /rrc/battery --once`), `motor_max_pct` y qué cambiaste desde el intento anterior.
- El sentido que detectó y desde dónde salió.
- El tiempo desde el botón hasta `DONE` con cronómetro (el estado se ve con `ros2 topic echo /robotek/state`).
- Si tocó un muro o movió la isla, dónde se paró y qué viste.

## 5. El coche real no es el simulador

El simulador `real_car` modela lo que el equipo midió. Conviene saber qué es y qué no.

| Parte | Lo que modela el simulador (medido en el coche) |
|---|---|
| Servo | Retardo de 0,06 s; velocidad de giro de 1,2 rad/s; el ángulo de las ruedas limitado a 17,6 grados |
| Motor | Retardo de 0,06 s y respuesta de 0,15 s; aceleración 1,0 y deceleración 0,6 m/s²; una tabla de velocidad medida con la **batería baja** (pedir 0,30 da 0,27 m/s, pedir 0,60 da 0,42). El 100 % (0,60 m/s) se infirió, no se midió |
| LiDAR | ±110 grados, 306 rayos, 10 Hz, ruido de unos 8 mm y un 4,3 % de rayos perdidos al azar |
| IMU | 50 Hz, ruido del giroscopio de 0,0019 rad/s y un **sesgo** de 0,006 rad/s |
| Cámara | Unos 6 fps y el campo de visión del coche, con la cámara girada 4,4 grados |

Y esto es lo que **no** modela:

- **Patinaje de las ruedas** y la **fricción del suelo**. En Gazebo las ruedas no resbalan como en el piso real.
- **La caída de la batería** al acelerar, y cualquier velocidad por encima de lo medido (más del 30 % de motor, con baja carga). Con la batería cargada el coche va más rápido que el modelo, y los giros se disparan tarde.
- **El encabritamiento:** a fondo desde parado el morro se levanta. No pasa en simulación.
- **La luz.** El simulador tiene colores perfectos. Los rangos de `line_lengths` de la guía son los del simulador y con la luz de tu sala pueden fallar. Al equipo le pasó: la pared beige de la sala cayó dentro del naranja y el coche giró mal. El remedio fue mirar solo la parte del suelo de la imagen y medir los colores reales.
- **La distorsión de la lente** de la cámara y el retardo propio de los sensores.
- **Las medidas del coche que cambian** cuando reconstruyes: la distancia entre ejes (0,1174 m en el repositorio), el sitio del LiDAR y de la cámara, el sesgo real del giroscopio.

Una ronda perfecta en Gazebo no demuestra nada sobre el coche. Y una mala en el coche suele ser un sensor (el color, el sesgo, un signo) o la velocidad real, casi nunca tu algoritmo.

## 6. Cuando algo falla

- **El coche se estrella al arrancar, vuelca, el giroscopio está invertido o no hay datos de un sensor:** [Solución de problemas del coche real](/learn/open-strategy/paso-11-solucion-de-problemas/).
- **Funciona pero quieres ir más rápido o con más margen:** [Afinar](/learn/open-strategy/paso-12-afinar/).

Antes, repite la primera ronda un par de veces con la misma batería y el mismo tope de motor: una ronda buena no dice nada todavía.
