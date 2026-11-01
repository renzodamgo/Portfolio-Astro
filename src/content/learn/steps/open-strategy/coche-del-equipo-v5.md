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
> - **Sin probar en el coche:** el v5, y la forma de lanzar de la sección 6 (`robot.launch.py` arranca la placa, el LiDAR y la cámara solo desde el 1 de noviembre). Los comandos salen del código y de las notas del equipo, no de una ronda real con este montaje.

<!-- step-video:start -->
<figure class="learn-step-video">
<video controls muted playsinline preload="none" poster="/learn/videos/open/coche-del-equipo-v5.jpg"><source src="/learn/videos/open/coche-del-equipo-v5.mp4" type="video/mp4"></video>
<figcaption>Lo que este capítulo añade a la estrategia, en 46 s de animación sin sonido.</figcaption>
</figure>
<!-- step-video:end -->

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

### Medir a mano, eje por eje

`imu_axes` lo hace todo en 10 s, pero conviene saber hacerlo a mano: para entender qué mide la IMU, para comprobar lo que dio la herramienta, o si la herramienta falla. Solo hace falta mirar los números de la placa mientras inclinas y giras el coche.

**Qué mide cada cosa.** La placa publica en `/rrc/imu_raw`, con **sus** ejes x, y, z (no los del coche):

- `linear_acceleration` en m/s². **Con el coche quieto, mide la gravedad apuntando hacia arriba:** el eje de la placa que mira al techo marca unos **+9,8**, el que mira al suelo unos **−9,8**, y los que quedan horizontales, cerca de **0**.
- `angular_velocity` en rad/s: lo rápido que gira el coche alrededor de cada eje. Quieto, todo cerca de 0. Visto desde la punta del eje, el giro antihorario da positivo.

Lo que buscamos son tres nombres: qué eje de la placa (con su signo) apunta **hacia arriba** (`up_axis`), **hacia delante** (`forward_axis`) y **hacia la izquierda** (`left_axis`). Se escriben como `'+x'`, `'-y'`, `'+z'`, etc.

Terminal 1, el driver de la placa (si no sigue corriendo):

```bash
ros2 launch rrc_lite_driver controller.launch.py
```

Terminal 2, los números del acelerómetro (se actualizan solos; `Ctrl+C` para salir):

```bash
ros2 topic echo /rrc/imu_raw --field linear_acceleration
```

Ve anotando cada resultado en una tabla como la del ejemplo de abajo.

**Paso 1. Arriba: coche quieto y plano.** Pon el coche en una mesa plana y no lo toques. Busca el eje que marca unos ±9,8:

| Lo que ves | `up_axis` |
|---|---|
| `x` ≈ +9,8 | `'+x'` |
| `x` ≈ −9,8 | `'-x'` |
| `y` ≈ +9,8 | `'+y'` |
| `y` ≈ −9,8 | `'-y'` |
| `z` ≈ +9,8 | `'+z'` |
| `z` ≈ −9,8 | `'-z'` |

Los otros dos deben quedar cerca de 0 (menos de ±1,5). Si ninguno pasa de 8,5 y dos marcan valores medianos (por ejemplo 7 y 6), la placa está **inclinada** en el montaje: enderézala antes de seguir.

**Paso 2. Adelante: levanta el morro.** Levanta la parte delantera del coche unos 30 grados (un libro bajo las ruedas delanteras) y quédate quieto. El eje de "arriba" baja un poco (de 9,8 a unos 8,5) y **uno de los otros dos cambia de 0 a unos ±4,9** (9,8 × sen 30°):

- Si ese eje sube a **+4,9**, apunta hacia delante: `forward_axis` = `'+'` y ese eje.
- Si baja a **−4,9**, apunta hacia atrás: `forward_axis` = `'-'` y ese eje.

¿Por qué? Al levantar el morro, el eje que mira hacia delante empieza a mirar un poco hacia arriba, y la gravedad (que se mide hacia arriba) le da un valor positivo.

**Paso 3. Izquierda: levanta el lado izquierdo.** Vuelve a dejar el coche plano. Ahora levanta el **lado izquierdo** del coche unos 30 grados (mirando el coche desde atrás, el lado de tu mano izquierda). El eje que queda cambia a unos ±4,9:

- **+4,9** → `left_axis` = `'+'` y ese eje.
- **−4,9** → `left_axis` = `'-'` y ese eje.

**Paso 4. Comprueba que los tres encajan.** Tienen que ser tres ejes distintos (un x, un y y un z) y formar un sistema "de mano derecha": `izquierda = arriba × adelante`. Con esta tabla de productos:

| | × x | × y | × z |
|---|---|---|---|
| **x** | — | z | −y |
| **y** | −z | — | x |
| **z** | y | −x | — |

Fila = arriba, columna = adelante, y los signos se multiplican (− × − = +). El resultado tiene que ser tu `left_axis`. Si sale con el signo contrario, uno de los tres pasos está mal: repite el que tengas menos claro. No hace falta hacerlo de memoria: si no encajan, `imu_adapter` no arranca y dice `is not a right-handed frame`.

**Paso 5. El giroscopio: gira a la izquierda.** Cambia la terminal 2 al giroscopio:

```bash
ros2 topic echo /rrc/imu_raw --field angular_velocity
```

Con el coche plano en la mesa, gíralo con la mano **hacia la izquierda** (antihorario visto desde arriba), un cuarto de vuelta en un segundo. El eje que es tu `up_axis` debe marcar unos **±1,5** mientras giras, y los otros dos quedarse cerca de 0:

- Si `up_axis` tiene **+** (por ejemplo `'+x'`), ese eje marca **positivo** al girar a la izquierda.
- Si tiene **−** (por ejemplo `'-x'`), marca **negativo**.

Si sale al revés, el eje de arriba está mal: repite el paso 1. Este signo es el que usa el v5 para saber hacia dónde gira.

**Un ejemplo.** Son números inventados, **no** los del coche: tu placa puede dar otros.

| Prueba | x | y | z | Conclusión |
|---|---|---|---|---|
| 1. Quieto y plano | **−9,79** | 0,12 | 0,21 | arriba = `'-x'` |
| 2. Morro levantado | −8,51 | 0,15 | **+4,86** | adelante = `'+z'` |
| 3. Lado izquierdo levantado | −8,47 | **+4,93** | 0,18 | izquierda = `'+y'` |
| 4. Comprobación | | | | arriba × adelante = (−x) × (z) = −(−y) = **+y** ✓ |
| 5. Giro a la izquierda (giroscopio) | **−1,52** | 0,03 | −0,04 | arriba es `'-x'`, así que negativo ✓ |

### Guardar

En el **Mac**, abre `src/robotek_hardware/config/robot.yaml` y busca la sección `imu_adapter`. Hoy tiene los ejes del montaje anterior, con la placa plana:

```yaml
imu_adapter:
  ros__parameters:
    forward_axis: '+y'   # old flat build (8 oct 2026): board +y forward, z up, x to the right
    left_axis: '-x'
    up_axis: '+z'
    frame_id: imu_link
    measured: false
```

Cambia los tres ejes por los tuyos, con comillas, y pon `measured: true`. Con el ejemplo de arriba quedaría:

```yaml
imu_adapter:
  ros__parameters:
    forward_axis: '+z'   # measured <fecha>: board on its edge
    left_axis: '+y'
    up_axis: '-x'
    frame_id: imu_link
    measured: true
```

No toques `frame_id`. Haz commit y push, y en el Pi:

```bash
cd ~/Projects/WRO-Strategies && git pull && colcon build
```

Si `imu_adapter` arranca con `is not a right-handed frame`, los tres ejes no encajan (paso 4). Si arranca avisando de que los ejes no están medidos, no recompilaste después del `git pull`.

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

Y con `--field linear_acceleration`. Ahora los ejes ya son **los del coche** (x adelante, y izquierda, z arriba), así que da igual cómo esté montada la placa: tiene que salir siempre esto.

| Prueba | x | y | z |
|---|---|---|---|
| Quieto y plano | ≈ 0 | ≈ 0 | ≈ **+9,8** |
| Morro levantado 30° | ≈ **+4,9** | ≈ 0 | ≈ 8,5 |
| Lado izquierdo levantado 30° | ≈ 0 | ≈ **+4,9** | ≈ 8,5 |
| Empujón hacia delante | sube a **positivo** un momento | ≈ 0 | ≈ 9,8 |

Si una casilla en negrita sale con el signo contrario, el eje correspondiente está mal en `robot.yaml`.

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

### Si tu coche gira distinto: qué cambia en el v5

Otro servo, otra palanca u otra dirección cambian tres cosas: el **ángulo** que alcanzan las ruedas, el **radio** de giro y el **tiempo de respuesta** del servo. Adaptar el v5 es fácil, pero no todo se ajusta solo.

**1. Ángulo máximo de la rueda: casi automático.** Basta con cambiar **una constante**, `REAL_STEER_LIMIT` en `vehicle.py`. Es el ángulo real de la rueda, no el del servo.

- El v5 la usa como `STEER`, su tope de dirección.
- Con ella calcula la **velocidad de giro en la esquina**: `v · tan(STEER) / WHEELBASE`. Si el coche gira más cerrado, la rampa del arco se acelera sola; si gira menos, se hace más lenta.
- En el coche va la misma medida en `robot.yaml` (`wheel_table_*`, `wheel_limit_deg`), y en el simulador en `real_car_v1.yaml` (`steer_limit`), como en la tabla de arriba.

Lo que **no** se ajusta solo es el punto donde empieza el giro. Con un radio menor el coche puede girar más tarde, y con uno mayor tiene que girar antes. Eso lo deciden `turn_front_distance` (1,19 m: la pared de enfrente a la que se puede empezar a girar) y `corner_lookahead` (0,35 m: lo cerca que tiene que estar el final de la isla). Son parámetros del perfil `open_v5.yaml` y se prueban en el laboratorio sin tocar código.

**2. Tiempo de respuesta del servo: el v5 no lo tiene en cuenta.** No tiene ningún parámetro de retardo del servo; se quitó a propósito al simplificar la estrategia.

- El retardo solo existe en el **modelo del simulador**: `steer_delay` (0,06 s), `steer_rate` (1,2 rad/s) y `steer_tau` en `real_car_v1.yaml`. El laboratorio usa los mismos valores.
- Si el servo nuevo es **más lento**, la dirección llega tarde al tope en cada esquina y el coche abre la curva. El remedio es empezar a girar antes (subir `turn_front_distance`). Comprúebalo en el laboratorio y en Gazebo **después de poner el retardo nuevo en el modelo**: si no, la simulación sigue con el servo viejo y no te muestra el problema.
- Si es mucho más lento, quizá haya que tocar las ganancias. `KP` (0,8), `DAMPING` (0,1) y `EXIT_ANGLE` (0,25 rad) son **constantes en `v5/mission.py`**, no parámetros: cambiarlas es editar el código.

Para medir el retardo, con el coche quieto: `ros2 launch robotek_bringup actuator_test.launch.py test:=servo`. Pulsa el botón y la prueba termina sola; el resultado queda en `~/robotek-runs/<fecha>-actuator-servo/summary.json`.

**3. Ángulo del servo distinto, con el mismo giro de rueda.** Si solo cambia la palanca (por ejemplo, ahora hacen falta 30 grados de servo para el mismo ángulo de rueda), la estrategia no se entera: trabaja con el ángulo de la **rueda**. Solo cambia la tabla servo → rueda de `robot.yaml`. Recuerda que el equipo no pasa de **25 grados de servo**.

| Cambio en el coche | Qué tocar | ¿Se ajusta solo? |
|---|---|---|
| Ángulo de rueda o radio de giro | `REAL_STEER_LIMIT`, `robot.yaml` y `real_car_v1.yaml` | El arco sí; el punto de giro hay que reajustarlo (`turn_front_distance`, `corner_lookahead`) |
| Servo más lento o más rápido | El modelo del simulador (`steer_delay`, `steer_rate`, `steer_tau`) | No: reajustar `turn_front_distance`; si hace falta, `KP` y `DAMPING` en el código |
| Otra palanca, mismo giro de rueda | Solo la tabla servo → rueda de `robot.yaml` | Sí |
| Otra distancia entre ejes | `WHEELBASE` en `vehicle.py` (y el URDF) | El arco sí; el punto de giro hay que reajustarlo |

**El orden:**

1. Mide el coche: el ángulo de cada rueda (esta sección) y el retardo del servo.
2. Pon las medidas en el repositorio: `vehicle.py`, `robot.yaml` y `real_car_v1.yaml`.
3. Corre el set estándar del laboratorio y de Gazebo **con el v5 sin cambios**, para ver qué cambia solo por el coche.
4. Reajusta `turn_front_distance` y `corner_lookahead` en el laboratorio, un parámetro cada vez. Por ejemplo, `--param turn_front_distance=1.25`.
5. Confirma con el set estándar de Gazebo, y solo después prueba en el coche.

Medir el coche es lo que da más trabajo. Con las medidas, reajustar el v5 son unos minutos en el laboratorio.

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

### Si quieres pasar del 50 %

Subir `motor_max_pct` es cambiar un número, pero el coche no se comporta como el simulador si solo cambias eso. Esto es lo que hay que tener en cuenta.

**Qué se sabe del motor.** `base_adapter` convierte la velocidad pedida en porcentaje con `% = 6,5 + 73 × v`. Con esa regla, el 50 % son unos 0,6 m/s pedidos, el 70 % unos 0,87 y el 100 % 1,28, que es lo que pide el v5 en las rectas. Pero la regla y la tabla de velocidad real se midieron **solo hasta el 30 %** y **con la batería baja**. Por encima de eso no hay medidas: el punto del 100 % (0,60 m/s reales) se **dedujo**, no se midió. Con la batería cargada el coche puede ir bastante más rápido.

**El simulador ya supone el 100 %.** El modelo del coche y el v5 (`REAL_SPEED`) dan por hecho que pedir 1,28 da 0,60 m/s reales. En el coche, con el tope del 50 %, va más lento que eso. Si subes el tope sin medir, el coche puede ir más lento **o más rápido** que la simulación, y no lo sabrás hasta que choque.

**Qué cambia en la estrategia al ir más rápido.**

- **Las esquinas empiezan tarde.** Entre que el v5 decide girar y que las ruedas llegan al tope pasan unos 0,3 s (retardo del servo más el recorrido hasta 17,6 grados). A 0,6 m/s son 18 cm; a 1 m/s, 30 cm. Hay que empezar antes: subir `turn_front_distance`.
- **Se ve menos antes de girar.** El LiDAR da 10 escaneos por segundo y el v5 pide ver el final de la isla en 2 seguidos. A 0,6 m/s el coche avanza 12 cm entre esos dos escaneos; a 1 m/s, 20 cm. Puede hacer falta subir `corner_lookahead`.
- **La frenada es lenta.** `base_adapter` limita la deceleración a 0,6 m/s² para que las ruedas no patinen. Pasar de 1 m/s a 0,6 m/s cuesta unos 0,5 m. Afecta a la última esquina, la única antes de la cual frena el v5 (`last_corner_speed`, y `BRAKE_GAIN` y `BRAKE_MARGIN` en `mission.py`).
- **El arco se abre.** La velocidad de giro del arco sale de la velocidad real (`REAL_SPEED`). Si la tabla no coincide con el coche, el v5 calcula mal la rampa y el coche se sale de la línea o se mete hacia la isla.

**Qué cambia en el coche.**

- **Se encabrita.** A fondo desde parado, el coche levanta las ruedas delanteras y deja de girar. Por eso `accel_limit` limita la aceleración a 1 m/s²: no lo subas a la vez que el tope.
- **Patina.** El simulador no modela el patinaje. En las esquinas, a más velocidad, las ruedas resbalan y el radio real es mayor que el calculado.
- **La batería cae.** El motor tira más corriente y la tensión baja. En una prueba, con 6,5 V y el motor al 80 %, el Pi se reinició a mitad de ronda. Usa batería cargada y, mejor, la batería aparte para el motor.
- **Los golpes son más fuertes.** El v5 no se recupera de un atasco: si choca a más velocidad, empuja contra el muro hasta que lo pares.

**El `real_speed` del v5 tiene un tope.** La tabla `REAL_SPEED` llega hasta 1,28. Si quieres pedir más (por ejemplo, porque cambias la calibración y 1,28 ya no es el 100 %), **alarga antes la tabla**. Con una velocidad por encima de su último punto, `real_speed()` no encuentra el tramo, lanza una excepción y el nodo se cae en la primera esquina.

**El orden para subir.**

1. **Mide la velocidad real con la batería cargada**, del 30 % al 70 %, en pulsos cortos y con espacio (sección anterior). Repite cada punto.
2. **Pon la tabla nueva en los tres sitios:** `motor_pct_per_mps` y `motor_min_pct` en `robot.yaml`; `speed_table_cmd`, `speed_table_real` y `drive_command_limit` en `real_car_v1.yaml`; `REAL_SPEED` en `v5/mission.py`. Si cambia la aceleración que aguanta el coche, también `accel_max` y `decel_max` del modelo.
3. **Prueba en simulación con el v5 sin cambios**: el set estándar del laboratorio y de Gazebo. Así ves qué cambia solo por el coche.
4. **Reajusta en el laboratorio**, un parámetro cada vez: primero `turn_front_distance`, luego `corner_lookahead` y `last_corner_speed`. Confirma con el set estándar de Gazebo.
5. **Sube el tope de 10 en 10:** 50 → 60 → 70. En cada paso, primero una vuelta y luego la ronda completa. Registra cada intento, también los que fallan, con la batería y el tope que usaste.
6. **No pases de lo que mediste.** Si la tabla llega al 70 %, el tope no pasa del 70 %.

En el campo puntúa la ronda completa, no la vuelta más rápida: un coche al 50 % que termina las tres vueltas vale más que uno al 80 % que choca.

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

Para antes `sensors.launch.py` y cualquier otro nodo de las pruebas: este launch abre la placa, el LiDAR y la cámara, y dos lectores en el mismo puerto dan *timeout*. Después, un solo comando:

```bash
ros2 launch robotek_bringup robot.launch.py challenge:=open
```

Arranca todo, con los mismos tiempos que `sensors.launch.py`: la placa al momento, el LiDAR a los 5 s (si arranca junto con la placa da *timeout*) y la cámara a los 7 s; además los adaptadores, el motor, el botón, las luces y el v5. Las luces se ponen verdes cuando llegan los tres sensores. Relanza RViz en el Mac.

Si los sensores ya corren aparte (por ejemplo, con `sensors.launch.py` abierto desde la sección 5), di que no los abra otra vez:

```bash
ros2 launch robotek_bringup robot.launch.py challenge:=open controller:=false lidar_package:= camera:=false
```

Hasta el 1 de noviembre de 2026 `robot.launch.py` buscaba un launch de la placa que no existe y no arrancaba el LiDAR, y había que usar siempre esta segunda forma. La primera todavía no se ha probado en el coche.

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
6. **Ronda:** `motor_max_pct` bajo, `ros2 launch robotek_bringup robot.launch.py challenge:=open`, luces verdes, K1.
7. **Registro:** traer la carpeta, `round.json` y `rounds.jsonl`.

Si algo falla, busca el síntoma en [Solución de problemas](/learn/open-strategy/paso-11-solucion-de-problemas/).
