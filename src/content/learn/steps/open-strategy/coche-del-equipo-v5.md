---
guide: "open-strategy"
order: 10.5
slug: "coche-del-equipo-v5"
title: "El coche del equipo: calibrar la IMU y correr el v5"
summary: "Del coche reconstruido a la primera ronda con la estrategia v5 del equipo: actualizar la Raspberry Pi, medir los ejes de la IMU, el servo y el motor, llevar las medidas al repositorio y lanzar la ronda."
tag: "step-9"
compareFrom: "step-9"
---

El [capítulo 10](/learn/open-strategy/paso-10-el-coche-real/) lleva **tu** nodo al coche con el repositorio del curso. Esta página es la receta para el **coche del equipo Robotek** con su repositorio de trabajo (`WRO-Strategies`) y su estrategia Open, el **v5**: qué medir después de la reconstrucción del 21 de octubre de 2026, en qué orden, dónde se guarda cada medida y cómo se lanza la ronda.

> **Qué está probado y qué no** (1 de noviembre de 2026).
>
> - **Probado en simulación:** el v5 completa el set estándar de 12 rondas en Gazebo y en el laboratorio, con el modelo del coche real.
> - **Medido en el coche, pero con el montaje anterior** (7 a 9 de octubre): el servo, la tabla de velocidad del motor, el LiDAR, la IMU y los colores de las líneas.
> - **Sin medir en el coche reconstruido:** los ejes de la IMU (la placa va de canto) y el servo (cambió de sitio y giró 90 grados). En `robot.yaml` los dos siguen marcados `measured: false`. **No conduzcas el coche hasta medirlos.**
> - **Sin probar en el coche:** el v5, y la forma de lanzar de la sección 5 tal como está escrita. Los comandos salen del código y de las notas del equipo, no de una ronda real con este montaje.

## 0. El orden

| # | Qué | Bloquea la ronda | Dónde queda |
|---|---|---|---|
| 1 | Actualizar el código en el Pi | sí | — |
| 2 | Ejes de la IMU | **sí** | `robot.yaml` → `imu_adapter` |
| 3 | Servo: centro, signo y ángulo real | **sí** | `robot.yaml` → `base_adapter`, `vehicle.py`, `real_car_v1.yaml` |
| 4 | Motor: velocidad real por % | no, pero sin ella el coche va a otra velocidad que la simulación | `robot.yaml`, `real_car_v1.yaml`, `v5/mission.py` |
| 5 | LiDAR y cámara | no, pero la cámara decide el sentido | `robot.yaml` → `scan_adapter`; colores en `robot.launch.py` |
| 6 | Primera ronda, despacio | — | `~/robotek-runs/` en el Pi |
| 7 | Registrar la ronda | — | `docs/open-challenge-runs/` |

Haz las mediciones **en este orden** y con el coche **sobre soportes, con las ruedas en el aire**, salvo cuando se diga lo contrario.

## 1. Preparar la Raspberry Pi

### Entrar

Desde el Mac, en la misma red Wi‑Fi que el coche:

```bash
ssh <usuario>@<ip-del-pi>
```

La IP la da el router por DHCP y puede cambiar después de un reinicio. Si no responde, espera un minuto (el Pi tarda en volver a la red) o búscala en el router.

### Una regla: los cambios se hacen en el Mac

En el Pi, `~/Projects/WRO-Strategies` es un clon del repositorio. **Todo cambio se hace en el Mac**, se sube con `git push` y se baja en el Pi con `git pull`. Si editas en el Pi, el siguiente `git pull` choca o pierdes el cambio. Lo que genera el Pi (`build/`, `install/`, `log/`, `~/robotek-runs/`) no va a git.

### Parar el stack del equipo

El Pi arranca solo el software del equipo (`ros_autostart.service`), que usa los mismos puertos. Páralo **en su propia conexión ssh** (el script mata procesos por nombre y, si va en la misma línea que otros comandos, puede matar tu propia sesión):

```bash
~/scripts/stop_ros.sh
```

### Bajar el código y compilar

```bash
cd ~/Projects/WRO-Strategies && git pull && colcon build
```

Tarda unos 12 s (la primera vez, casi un minuto). **Repite esto cada vez que cambies algo en el Mac**: la instalación es una copia y no ve los cambios hasta recompilar.

### Cada terminal nueva

`~/.bashrc` ya carga ROS y el repositorio. Comprueba que el dominio es el del equipo:

```bash
echo $ROS_DOMAIN_ID     # debe decir 1
```

No cargues `~/wro_controller_ws`: tiene copias viejas de los mismos paquetes y se mezclan.

### Cómo parar los nodos

`Ctrl+C` en la terminal del `ros2 launch` suele bastar. Si al relanzar algo da *timeout* (el LiDAR, sobre todo), quedaron nodos vivos y hay dos lectores en el mismo puerto. Búscalos y mátalos:

```bash
ps -eo pid,args | grep -E "[r]rc_driver|[l]dlidar|[c]amera_publisher|[r]obotek_hardware|[o]pen_strategy"
kill <pid> <pid> ...
```

## 2. Los ejes de la IMU (bloquea)

### Por qué hay que medirlos

La IMU está en la placa **RRC Lite**, y desde la reconstrucción la placa va **de canto y a un costado** del coche. El v5 calcula su rumbo integrando el giroscopio **z** del coche, y espera que **girar a la izquierda dé positivo**. Con la placa de canto, el eje z de la placa ya no es el z del coche: si no se corrige, el coche cree que gira cuando no gira, o al revés, y se estrella en la primera esquina.

`imu_adapter` gira la IMU de los ejes de la placa a los del coche (x adelante, y izquierda, z arriba) antes de que la lea la estrategia. Solo necesita saber **qué eje de la placa apunta a cada lado**. Eso es lo que se mide.

### Que esté a un costado no importa

- **El giroscopio** mide la velocidad de giro, y en un cuerpo rígido es la misma en cualquier punto: en el centro, en un costado o en la punta, el coche gira igual de rápido. El v5 solo usa el giroscopio.
- **El acelerómetro** sí cambia fuera del centro (en una curva suma una aceleración hacia el centro del giro), pero **ninguna estrategia lo lee**.
- **La medición** usa el acelerómetro solo con el coche quieto y con un empujón recto, sin giro, así que la posición tampoco la afecta.

Lo que sí importa: que la placa esté **firme** (si vibra, el giroscopio mete ruido) y bien **orientada** (si está torcida, la medición lo detecta).

### Medir

Coche **apoyado en el suelo o en una mesa plana**, con espacio por delante. Motor y servo apagados: esta prueba no los usa.

Terminal 1, el driver de la placa:

```bash
ros2 launch rrc_lite_driver controller.launch.py
```

Comprueba que llegan datos, unas 49 veces por segundo:

```bash
ros2 topic hz /rrc/imu_raw
```

Terminal 2, la medición:

```bash
ros2 run robotek_hardware imu_axes
```

1. Dice **`Leave the car still for 3 s`**: no toques el coche ni la mesa.
2. Dice **`PUSH the car forward once now`**: tienes 8 s para dar **un solo empujón suave hacia delante**, recto, y soltarlo. Sin girarlo ni levantarlo.
3. Imprime algo así:

   ```
   imu_adapter:
     ros__parameters:
       forward_axis: '...'
       left_axis: '...'
       up_axis: '...'
       measured: true
   error_deg: {...}
   ```

`error_deg` dice cuántos grados se aleja cada dirección medida del eje de la placa más cercano:

- **Menos de unos 15 grados** en los tres: bien.
- **Más:** la mesa estaba inclinada o el empujón salió torcido. Repite. Si sale igual de torcido varias veces, la placa está inclinada en el montaje: enderézala.
- **`no push seen`:** empuja un poco más fuerte.
- **`no IMU data`:** el driver de la placa no está corriendo o el cable USB está suelto.

### Guardar

En el **Mac**, copia los tres ejes en la sección `imu_adapter` de `src/robotek_hardware/config/robot.yaml` y pon `measured: true`. Haz commit y push, y en el Pi `git pull && colcon build`.

### Comprobar

Con el driver de la placa aún corriendo, lanza solo el adaptador con los ejes nuevos (terminal 2):

```bash
ros2 run robotek_hardware imu_adapter --ros-args \
  --params-file install/robotek_hardware/share/robotek_hardware/config/robot.yaml \
  -r imu_in:=/rrc/imu_raw -r imu_out:=/robotek/imu
```

Si todavía avisa de que los ejes no están medidos, no recompilaste después del `git pull`.

Terminal 3:

```bash
ros2 topic echo /robotek/imu --field angular_velocity.z
```

| Prueba | Debe dar |
|---|---|
| Girar el coche a mano hacia la **izquierda** (antihorario visto desde arriba) | `angular_velocity.z` **positivo** |
| Girarlo a la derecha | negativo |
| Quieto | cerca de 0 |

Y con `--field linear_acceleration`: quieto, `z` cerca de **+9,8**; con un empujón hacia delante, `x` **positivo**.

**El giro a la izquierda positivo es la prueba que importa.** Si sale negativo, el v5 giraría al revés en cada esquina: no sigas, repite la medición.

### Sesgo y ruido del giroscopio (para la simulación)

Con el coche quieto, graba 10 s del giroscopio z y saca la media (el sesgo) y la desviación (el ruido):

```bash
timeout 10 ros2 topic echo --csv --field angular_velocity.z /robotek/imu > /tmp/gz.csv
python3 -c "import statistics as s; v=[float(x) for x in open('/tmp/gz.csv') if x.strip()]; print(len(v), 'muestras, sesgo', s.mean(v), 'ruido', s.stdev(v))"
```

Con el montaje anterior salió un sesgo de 0,006 rad/s y un ruido de 0,0019. No hace falta que sea igual: el v5 mide el sesgo en los 0,3 s después del Start. Anótalo para que la simulación use los valores del coche.

## 3. El servo (bloquea)

El servo cambió de posición y giró 90 grados. El centro, el signo y la tabla de `robot.yaml` son del montaje anterior: con 1500 µs las ruedas pueden no quedar rectas, y el mismo ángulo de servo da otro ángulo de rueda.

Ruedas en el aire. Solo la placa y el nodo del servo, **sin motor**:

```bash
ros2 launch rrc_lite_driver controller.launch.py          # terminal 1 (si no sigue corriendo)
ros2 run robotek_hardware servo_steer                      # terminal 2
```

El ángulo se publica en radianes y **positivo es a la izquierda**. Si dejas de publicar, el servo vuelve al centro a los 0,5 s.

1. **Centro.**

   ```bash
   ros2 topic pub -r 5 /steer std_msgs/msg/Float32 "{data: 0.0}"
   ```

   Mira las ruedas desde arriba con una regla. Si no quedan rectas, relanza `servo_steer` con otro centro, de 10 en 10 µs:

   ```bash
   ros2 run robotek_hardware servo_steer --ros-args -p servo_center_us:=1510.0
   ```

2. **Signo.** Publica `{data: 0.17}` (10 grados). Mirando el coche **desde atrás**, las ruedas deben ir a **tu izquierda**. Si van a la derecha, cambia `servo_sign` (de -1.0 a 1.0).

3. **Tabla.** Para 0,17 / 0,26 / 0,35 / 0,44 rad (10, 15, 20 y 25 grados de servo) y los mismos en negativo, mide el ángulo de **cada** rueda delantera con un transportador o una foto desde arriba. Sube despacio: la palanca puede topar con la placa o las varillas. **Nunca pases de 25 grados de servo**: es el límite que se fijó el equipo.

4. **Revisión mecánica.** Repite 0 → 25 grados → 0 diez veces: el centro debe volver al mismo sitio (±1 grado), sin roces ni chasquidos en los topes.

### Guardar

En el Mac:

| Archivo | Qué |
|---|---|
| `src/robotek_hardware/config/robot.yaml` (`base_adapter`) | `servo_center_us`, `servo_sign`, `wheel_table_servo_deg`, `wheel_table_left_deg`, `wheel_table_right_deg`, `wheel_limit_deg` (el menor de los máximos de los dos lados) y `servo_measured: true` |
| `src/robotek_common/robotek_common/vehicle.py` | `REAL_STEER_LIMIT` = `wheel_limit_deg` en radianes. El v5 lo usa como su tope de dirección y para calcular lo rápido que gira en las esquinas |
| `src/robotek_evaluation/config/real_car_v1.yaml` | `steer_limit`, el mismo valor, para que la simulación gire igual que el coche |

El URDF **no** se toca: su límite de 25 grados es el del servo, no el de la rueda.

Commit, push, y en el Pi `git pull && colcon build`.

## 4. El motor

La tabla de velocidad se midió con la batería casi vacía (7,0 a 7,4 V). Con la batería cargada el coche va más rápido que en la simulación, y los giros se disparan tarde. Mídela otra vez con la batería **cargada**:

```bash
ros2 topic echo /rrc/battery --once        # en mV: 8000 o más es una 2S cargada
ros2 launch robotek_bringup actuator_test.launch.py test:=motor motor:=robotek
```

Con el coche en el suelo y espacio por delante: pulsa el botón de la placa y la prueba da pulsos cortos (0,25 s) al 15, 20 y 30 %, y termina sola. Los resultados quedan en `~/robotek-runs/<fecha>-actuator-motor/summary.json`.

Reglas del equipo para el motor: pulsos de **0,25 s** como máximo (hasta 1 s solo con el 30 % o menos), empezar bajo y subir poco a poco, **nunca al 100 %** desde parado (el coche se encabrita y pierde la dirección).

### Guardar

| Archivo | Qué |
|---|---|
| `robot.yaml` (`base_adapter`) | `motor_pct_per_mps`, `motor_min_pct` y, cuando lo decidas, `motor_max_pct` |
| `real_car_v1.yaml` | `speed_table_cmd` y `speed_table_real` (velocidad pedida → velocidad real) |
| `src/robotek_open/robotek_open/v5/mission.py` | `REAL_SPEED`, una copia de la misma tabla que el v5 usa en las esquinas. Tiene que coincidir con la de `real_car_v1.yaml` |

`motor_max_pct` está en **50** desde un choque al 90 %. Con la calibración actual equivale a unos 0,6 m/s pedidos, aunque el v5 pida 1,28.

## 5. LiDAR y cámara

Lanza los sensores (terminal 1; incluye el driver de la placa, así que para antes el `controller.launch.py` si sigue corriendo):

```bash
ros2 launch peripherals sensors.launch.py detector:=false
```

Arranca la placa, el LiDAR a los 5 s (si arranca junto con la placa da *timeout*) y la cámara a los 7 s. En el **Mac**, RViz:

```bash
bash tools/macos_rviz_real.sh
```

El script pone el dominio 1 y la red del coche. **Relánzalo cada vez que lances algo en el coche**: RViz pierde la imagen de la cámara cuando su nodo se reinicia.

- **LiDAR.** Con el coche a 0,5 m de una pared plana, el rango de frente y a ±90 grados debe coincidir con la regla (±1 cm). El LiDAR mira 110 grados a cada lado; más allá los rayos dan en el propio coche.
- **Cámara.** El v5 decide el sentido de la vuelta comparando la línea **azul** y la **naranja** del suelo. Los colores se midieron el 8 de octubre con la luz de la sala del equipo (la naranja se ve casi roja) y con la cámara a otra altura. En la ronda, la imagen de depuración `/camera/direction_debug` muestra el largo de cada línea (`B=`, `O=`) y el sentido elegido (`dir=+1` antihorario, `-1` horario). Comprueba con el coche en la sección de salida, en los dos sentidos, que elige bien. Si no, hay que ajustar los colores en `REAL_OPEN_CAMERA` de `robot.launch.py`.

Ojo con la pared de la sala: el 8 de octubre su color beige entró en el rango naranja y el coche eligió el sentido equivocado. Por eso la cámara solo mira el suelo por debajo del muro negro.

## 6. La primera ronda

### Antes

1. `robot.yaml` tiene `imu_adapter.measured: true` y `servo_measured: true`, y la prueba del giro a la izquierda dio positivo.
2. **Baja el tope del motor** para empezar: `motor_max_pct: 30` en `robot.yaml` (en el Mac, push, pull y build). Con 30 el coche va despacio, que es lo que quieres la primera vez.
3. Batería cargada (`ros2 topic echo /rrc/battery --once`).
4. Campo Open montado y el coche en la sección de salida.

### Lanzar

Hacen falta **dos terminales**. `robot.launch.py` sabe arrancar la placa y el LiDAR, pero el nombre del launch de la placa que trae por defecto no existe, así que los sensores se lanzan aparte, como en las rondas del 8 de octubre:

```bash
# terminal 1: placa, LiDAR y cámara
ros2 launch peripherals sensors.launch.py detector:=false

# terminal 2, cuando el LiDAR ya publica (unos 10 s): adaptadores, motor, botón, luces y el v5
ros2 launch robotek_bringup robot.launch.py challenge:=open controller:=false camera:=false
```

`controller:=false` y `camera:=false` evitan abrir otra vez la placa y la cámara, que ya están abiertas en la terminal 1. Relanza RViz en el Mac.

### Primero en el aire

Con el coche sobre soportes, pulsa **K1**: calibra 0,3 s, mira la cámara y empieza a "andar". Comprueba que la dirección y el motor se mueven como esperas, y vuelve a pulsar K1 para pararlo. Después, en el suelo: primero una recta de 2 m entre paredes, luego una vuelta, y al final la ronda completa.

### Las luces

Son muy tenues a propósito (2 de 255, para no reflejarse en la cámara). Míralas de cerca.

| Estado | LED izquierdo | LED derecho |
|---|---|---|
| Arrancando (primeros 15 s) | apagado | apagado |
| **Listo, esperando Start** | verde | verde |
| Falta un sensor | rojo | azul = LiDAR, magenta = IMU, amarillo = cámara |
| Calibrando tras Start | azul | azul |
| En ronda | apagado | apagado |
| Terminó (`DONE`) | verde parpadeando | verde parpadeando |
| Fallo (`DIRECTION_FAULT`: la cámara no decidió el sentido en 15 s) | rojo | rojo |
| Batería baja (menos de 6,8 V) | rojo parpadeando | rojo parpadeando |

### El botón

- **Primera pulsación:** Start.
- **Segunda:** para el coche y lo mantiene parado hasta relanzar. Las pulsaciones a menos de 1,5 s de la anterior se ignoran: ten la mano cerca.
- **No uses K2** ni ningún otro interruptor para elegir el sentido: las reglas solo permiten esperar el Start, y el sentido lo decide la estrategia.

### Lo que el v5 no hace en el coche

- **No se recupera de un atasco.** Si choca, se queda empujando: páralo con el botón.
- **No avanza mientras mira la cámara.** Si en 15 s no decide el sentido, se para con `DIRECTION_FAULT`.
- **Frena si un sensor se calla:** sin LiDAR durante 0,35 s o sin IMU durante 0,2 s, manda velocidad 0 hasta que vuelvan.

## 7. Después de la ronda

Cada intento, también los fallidos, deja su carpeta en el Pi: `~/robotek-runs/<fecha UTC>-open/`, con `telemetry.csv`. Tráela al Mac:

```bash
rsync -a <usuario>@<ip-del-pi>:robotek-runs/<fecha>-open/ docs/open-challenge-runs/<fecha>-realcar-v5-r1/
```

En el coche no hay juez ni posición real: el juez eres tú. Escribe su `round.json` y añade la línea a `docs/open-challenge-runs/rounds.jsonl`, como la ronda del 8 de octubre (`20261008T172740Z-realcar-hw-v4-r1`), y anota también lo que no se pudo medir:

- la batería antes de la ronda, `motor_max_pct` y qué cambiaste desde el intento anterior;
- desde dónde salió (x, y y orientación) y en qué sentido;
- el tiempo desde el botón hasta `DONE`, con cronómetro;
- si tocó un muro o la isla, dónde se paró y qué viste.

La telemetría cruda no va a git (está en `.gitignore`); los resúmenes sí.

## Resumen

1. En el Pi: `~/scripts/stop_ros.sh`, y después `git pull && colcon build`.
2. **IMU:** `imu_axes` (quieto 3 s, un empujón), copiar el bloque a `robot.yaml`, `measured: true`, y comprobar que girar a la izquierda da `z` positivo.
3. **Servo:** centro, signo y tabla de ángulos; `robot.yaml`, `REAL_STEER_LIMIT` y `real_car_v1.yaml`.
4. **Motor:** tabla con la batería cargada en `robot.yaml`, `real_car_v1.yaml` y `REAL_SPEED`.
5. **Sensores:** LiDAR contra una regla y la cámara eligiendo bien el sentido.
6. **Ronda:** `motor_max_pct` bajo, `sensors.launch.py` y luego `robot.launch.py challenge:=open controller:=false camera:=false`, luces verdes, K1.
7. **Registro:** traer la carpeta, `round.json` y `rounds.jsonl`.

Si algo falla, busca el síntoma en [Solución de problemas](/learn/open-strategy/paso-11-solucion-de-problemas/).
