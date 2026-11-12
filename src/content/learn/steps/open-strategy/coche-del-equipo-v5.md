---
guide: "open-strategy"
order: 10.5
slug: "coche-del-equipo-v5"
title: "El coche del equipo: medir la IMU, el servo y el motor"
summary: "Las medidas del coche del equipo y dónde se guardan: los ejes de la IMU, el servo y el motor, qué hacer antes de cada prueba y los valores con los que corre el Open."
tag: "step-9"
compareFrom: "step-9"
---

Esta página es para cuando el coche **cambia**: una IMU girada, otro servo, otro motor u otros engranajes. Dice qué medir, en qué orden y dónde se guarda cada medida. Todo está en el repositorio del curso, **[robotek-learn](https://github.com/renzodamgo/robotek-learn)**, el que corre en el Raspberry Pi del coche.

Si el coche no cambió y solo quieres correr una ronda, no te hace falta nada de aquí: ve a [Correr el Open en el Pi desde cero](/learn/open-strategy/correr-en-el-pi/). Si quieres comprobar un sensor suelto, al [capítulo 10](/learn/open-strategy/paso-10-el-coche-real/).

> **Qué está probado y qué no** (12 de noviembre de 2026).
>
> - **Probado en el coche:** el **Open v5** hace rondas completas de 3 vueltas en el campo del equipo, con botón, y
>   para solo en la sección de salida. El 11 nov, con los engranajes 1:1 y la cámara **IMX708**: rondas de 31 a 38 s
>   en los dos sentidos (sin juez).
> - **Corregido en el coche:** el rumbo, con la pared de la isla (el giroscopio lee un 6 % de menos); el sentido, con
>   el LiDAR si la cámara se equivoca o no decide.
> - **Medido en el coche:** los ejes de la IMU (`measured: true`), la dirección (centro 1403 µs, ±19°,
>   `servo_measured: true`) y el motor 310 en M2 **sin tipo de motor**, a 8,0 rps por m/s con los engranajes 1:1
>   (sección 4).
> - **Sin aclarar:** a veces una esquina no gira aunque la dirección recibe la orden a tope, y el LiDAR pierde datos
>   a ratos por el cable USB ([Solución de problemas](/learn/open-strategy/paso-11-solucion-de-problemas/), casos 7 y 9).
> - **Sin probar en el coche:** la estrategia de referencia `my_open`. Corre igual, pero sus valores son los del
>   simulador.

<!-- step-video:start -->
<figure class="learn-step-video">
<video controls muted playsinline preload="none" poster="/learn/videos/open/coche-del-equipo-v5.jpg"><source src="/learn/videos/open/coche-del-equipo-v5.mp4" type="video/mp4"></video>
<figcaption>Lo que este capítulo añade a la estrategia, en 46 s de animación sin sonido.</figcaption>
</figure>
<!-- step-video:end -->

## 0. El orden

| # | Qué | Bloquea la ronda | Dónde queda |
|---|---|---|---|
| 1 | **Antes de cada medida:** el código al día y el Pi limpio | sí, siempre | — |
| 2 | Ejes de la IMU | **sí** | `robot.yaml` → `imu_adapter` |
| 3 | Servo: centro, signo y ángulo real (**hecho** el 1 nov) | **sí** | `robot.yaml` → `base_adapter` |
| 4 | Motor: sin tipo, M2, sentido, velocidad y parada (**hecho** el 8 nov) | **sí** | `controller_params.yaml`, `robot.yaml` |
| 5 | LiDAR y cámara | no, pero la cámara decide el sentido | `robot.yaml` → `scan_adapter`; colores en `vision.py` |
| 6 | La ronda, con los valores del coche | — | `~/runs/` en el Pi |
| 7 | Anotar la ronda | — | tu cuaderno de rondas |

Todos los archivos están en robotek-learn: `src/robotek_hardware/config/robot.yaml`, `src/robotek_evaluation/config/real_car_v1.yaml`, `src/robotek_course/robotek_course/minisim.py` y `src/robotek_course/robotek_course/vision.py`.

Haz las mediciones **en este orden** y con el coche **sobre soportes, con las ruedas en el aire**, salvo cuando se diga lo contrario.

## 1. Antes de cada prueba (siempre)

El Pi ya tiene robotek-learn instalado ([Correr el Open en el Pi](/learn/open-strategy/correr-en-el-pi/), sección 2). Antes de cada medida, en el Pi:

```bash
cd ~/robotek-learn
bash tools/car-autostart.sh stop            # si el Open arranca solo al encender
git pull && colcon build --symlink-install  # el código al día
bash tools/car-clean.sh                     # nada de una prueba anterior
source /opt/ros/jazzy/setup.bash && source install/setup.bash
```

- **Las medidas se guardan en el ordenador, no en el Pi.** `robot.yaml` y los demás archivos están en GitHub: se cambian en el ordenador, se suben con `git push` y en el Pi **solo se hace `git pull`**. Si mediste algo en el Pi, pásalo al ordenador, súbelo y vuelve a hacer `git pull`. Si `git pull` falla con "local changes", alguien editó en el Pi: guarda ese cambio (`git stash`) antes de descartarlo.
- **`car-clean.sh`** para los nodos del coche que hayan quedado vivos y pone los motores a 0. Un nodo viejo es la causa típica de un LiDAR que da *timeout* (dos lectores en el mismo puerto) o de un coche que se mueve solo.
- **Otro software en el Pi.** Si el `~/.bashrc` carga otro workspace con paquetes del mismo nombre (`robotek_hardware`, `rrc_lite_driver`…), quita esa línea. Si el Pi arranca solo otro programa que usa la placa o el LiDAR, páralo antes.
- **Cada terminal nueva** del Pi necesita los dos `source` de arriba. El coche del equipo usa `ROS_DOMAIN_ID` 1.
- **La batería,** si la prueba mueve el motor: `ros2 topic echo /rrc/battery --once` (en mV; 8000 o más es una 2S cargada).
- **Al terminar:** `Ctrl+C` en cada terminal y otra vez `bash tools/car-clean.sh`.

## 2. Los ejes de la IMU (bloquea)

**Antes de empezar,** siempre, la [preparación de la sección 1](#1-antes-de-cada-prueba-siempre).

### Por qué hay que medirlos

La IMU está en la placa **RRC Lite**, y desde la reconstrucción la placa va **de canto y a un costado** del coche. La estrategia calcula su rumbo integrando el giroscopio **z** del coche, y espera que **girar a la izquierda dé positivo**. Con la placa de canto, el eje z de la placa ya no es el z del coche: si no se corrige, el coche cree que gira cuando no gira, o al revés, y se estrella en la primera esquina.

`imu_adapter` gira la IMU de los ejes de la placa a los del coche (x adelante, y izquierda, z arriba) antes de que la lea la estrategia. Solo necesita saber **qué eje de la placa apunta a cada lado**. Eso es lo que se mide.

### Que esté a un costado no importa

- **El giroscopio** mide la velocidad de giro, y en un cuerpo rígido es la misma en cualquier punto: en el centro, en un costado o en la punta, el coche gira igual de rápido. La estrategia solo usa el giroscopio.
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

Si sale al revés, el eje de arriba está mal: repite el paso 1. Este signo es el que usa la estrategia para saber hacia dónde gira.

**Un ejemplo.** Son números inventados, **no** los del coche: tu placa puede dar otros.

| Prueba | x | y | z | Conclusión |
|---|---|---|---|---|
| 1. Quieto y plano | **−9,79** | 0,12 | 0,21 | arriba = `'-x'` |
| 2. Morro levantado | −8,51 | 0,15 | **+4,86** | adelante = `'+z'` |
| 3. Lado izquierdo levantado | −8,47 | **+4,93** | 0,18 | izquierda = `'+y'` |
| 4. Comprobación | | | | arriba × adelante = (−x) × (z) = −(−y) = **+y** ✓ |
| 5. Giro a la izquierda (giroscopio) | **−1,52** | 0,03 | −0,04 | arriba es `'-x'`, así que negativo ✓ |

### Guardar

En tu ordenador, en robotek-learn, abre `src/robotek_hardware/config/robot.yaml` y busca la sección `imu_adapter`. Hoy tiene los ejes del montaje anterior, con la placa plana:

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
cd ~/robotek-learn && git pull && colcon build --symlink-install && source install/setup.bash
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

**El giro a la izquierda positivo es la prueba que importa.** Si sale negativo, la estrategia giraría al revés en cada esquina: no sigas, repite la medición.

### Sesgo y ruido del giroscopio (para la simulación)

Con el coche quieto, graba 10 s del giroscopio z y saca la media (el sesgo) y la desviación (el ruido):

```bash
timeout 10 ros2 topic echo --csv --field angular_velocity.z /robotek/imu > /tmp/gz.csv
python3 -c "import statistics as s; v=[float(x) for x in open('/tmp/gz.csv') if x.strip()]; print(len(v), 'muestras, sesgo', s.mean(v), 'ruido', s.stdev(v))"
```

Con el montaje anterior salió un sesgo de 0,006 rad/s y un ruido de 0,0019. No hace falta que sea igual: la estrategia mide el sesgo en los 0,3 s después del Start. Anótalo para que la simulación use los valores del coche.

## 3. El servo (bloquea)

**Antes de empezar,** siempre, la [preparación de la sección 1](#1-antes-de-cada-prueba-siempre).

**Ya está medido** (1 de noviembre de 2026). Esta sección explica cómo se hizo y cómo comprobarlo; repítela si cambias el servo, la palanca o la dirección.

**Lo que se midió.** Con 1500 µs el coche iba 4,5° a la derecha: el **centro real** es **1403 µs**. Cada grado de servo son 20 µs, igual a los dos lados. La rueda gira como mucho **19°** a la derecha y más a la izquierda, así que `wheel_limit_deg: 19` deja el mismo tope a los dos lados. Con la tabla servo → rueda de cada lado (`wheel_table_*`), el ángulo que pide la estrategia es el que gira la rueda, de forma **proporcional**: el mismo algoritmo vale en sentido horario y antihorario.

**Cómo se midió: en el suelo, con el giroscopio.** `tools/steer_calibration.py` hace avanzar el coche unos segundos con cada pulso del servo, a velocidad fija. El giroscopio da cuánto gira (`ω`) y el LiDAR, la velocidad (`v`, en una recta hacia una pared). El ángulo real de las ruedas sale del modelo de bicicleta: `ángulo = atan(L · ω / v)`, con `L` la distancia entre ejes. Después de cada pulso el coche vuelve marcha atrás por el mismo arco. Es mucho más preciso que un transportador.

Necesita la placa, el LiDAR y la IMU, pero **no** `base_adapter`, que pisaría el servo y el motor. Con ~1,5 m libres delante y ~1 m alrededor:

```bash
ros2 launch robotek_course car.launch.py teleop:=true      # terminal 1: el coche sin estrategia
pkill -f base_adapter                                       # terminal 2: para solo base_adapter
python3 tools/steer_calibration.py 1100 1250 1400 1550 1700  # pulsos del servo en µs
```

El pulso con ángulo 0 es el centro real; los extremos dan el máximo de cada lado. **Nunca pases de 25 grados de servo**: es el límite que se fijó el equipo.

**Comprobar.** Con `base_adapter` en marcha (relanza `car.launch.py teleop:=true`), pide ángulos de rueda como una estrategia y mira lo que gira de verdad:

```bash
python3 tools/steer_calibration.py --check 0 10 -10 19 -19
```

Cada ángulo debe salir a uno o dos grados. En el coche del equipo: 0 → −0,2°, −10 → −8,7°, −19 → −18,7°. La izquierda (+10, +19) está por comprobar.

**Revisión mecánica.** Repite 0 → 25 grados → 0 diez veces con `servo_steer` (como en el [capítulo 10](/learn/open-strategy/paso-10-el-coche-real/), sección 3.5): el centro debe volver al mismo sitio (±1 grado), sin roces ni chasquidos en los topes.

### Guardar

En tu ordenador, en robotek-learn:

| Archivo | Qué |
|---|---|
| `src/robotek_hardware/config/robot.yaml` (`base_adapter`) | `servo_center_us`, `servo_sign`, `wheel_table_servo_deg`, `wheel_table_left_deg`, `wheel_table_right_deg`, `wheel_limit_deg` (el menor de los máximos de los dos lados) y `servo_measured: true` |
| `src/robotek_course/robotek_course/minisim.py` | `STEER_LIMIT` = `wheel_limit_deg` en radianes. La estrategia lo usa como su tope de dirección y para calcular lo rápido que gira en las esquinas |
| `src/robotek_common/robotek_common/vehicle.py` | `REAL_STEER_LIMIT`, el mismo valor (lo usa el control con teclado) |
| `src/robotek_evaluation/config/real_car_v1.yaml` | `steer_limit`, el mismo valor, para que la simulación gire igual que el coche |

El URDF **no** se toca: su límite de 25 grados es el del servo, no el de la rueda.

**Estado hoy:** `robot.yaml` ya tiene los ±19°, pero `STEER_LIMIT`, `REAL_STEER_LIMIT` y `steer_limit` siguen en **17,6°** (0,30718 rad), lo validado en simulación. Pedir 17,6° es seguro: está dentro de lo que el coche gira. Para usar los 19°, cambia los tres y repite el laboratorio y Gazebo antes de llevarlo al coche.

Commit y push, y en el Pi la [preparación de la sección 1](#1-antes-de-cada-prueba-siempre) (`git pull`, `colcon build --symlink-install`).

### Si tu coche gira distinto: qué cambia en la estrategia

Otro servo, otra palanca u otra dirección cambian tres cosas: el **ángulo** que alcanzan las ruedas, el **radio** de giro y el **tiempo de respuesta** del servo. Adaptar la estrategia es fácil, pero no todo se ajusta solo. Los nombres de abajo son los de la estrategia de referencia (`src/my_open/my_open/`); si escribiste la tuya, búscalos en tu código.

**1. Ángulo máximo de la rueda: casi automático.** Basta con cambiar **una constante**, `STEER_LIMIT` en `minisim.py`. Es el ángulo real de la rueda, no el del servo.

- La estrategia la usa como su tope de dirección.
- En la esquina el volante va a ese tope (`arc.py`) hasta que faltan 17 grados para el rumbo nuevo (`TURN_TOLERANCE`). Si el coche gira más cerrado, llega antes; si cambia mucho, vuelve a medir cuándo soltar (paso 5).
- En el coche va la misma medida en `robot.yaml` (`wheel_table_*`, `wheel_limit_deg`), y en el simulador en `real_car_v1.yaml` (`steer_limit`), como en la tabla de arriba.

Lo que **no** se ajusta solo es el punto donde empieza el giro. Con un radio menor el coche puede girar más tarde, y con uno mayor tiene que girar antes. Eso lo deciden `TURN_FRONT` (1,19 m: la pared de enfrente a la que se puede empezar a girar) y `LOOKAHEAD` (0,35 m: lo cerca que tiene que estar el final de la isla), en `my_open/turn_gate.py`. Se prueban en el laboratorio sin tocar el archivo, con `--set`.

**2. Tiempo de respuesta del servo: la estrategia no lo tiene en cuenta.** No tiene ningún parámetro de retardo del servo.

- El retardo solo existe en el **modelo del simulador**: `steer_delay` (0,06 s), `steer_rate` (1,2 rad/s) y `steer_tau` en `real_car_v1.yaml`. El laboratorio los cambia con `--act` y Gazebo con `actuator_params:=` ([capítulo 12](/learn/open-strategy/paso-12-afinar/)).
- Si el servo nuevo es **más lento**, la dirección llega tarde al tope en cada esquina y el coche abre la curva. El remedio es empezar a girar antes (subir `TURN_FRONT`). Compruébalo en el laboratorio y en Gazebo **con el retardo nuevo en el modelo**: si no, la simulación sigue con el servo viejo y no te muestra el problema.
- Si es mucho más lento, hay que soltar el tope antes en cada esquina: `TURN_TOLERANCE` (0,3 rad) en `arc.py`, con el freno `DAMPING` (0,1) puesto. El widget del paso 5 enseña cuánto. Ojo: en el capítulo 12, con el retardo triplicado, ni `DAMPING` ni `TURN_TOLERANCE` cambiaron la ronda completa; lo que dio margen fue bajar la velocidad de esquina (`CORNER_SPEED`).

**3. Ángulo del servo distinto, con el mismo giro de rueda.** Si solo cambia la palanca (por ejemplo, ahora hacen falta 30 grados de servo para el mismo ángulo de rueda), la estrategia no se entera: trabaja con el ángulo de la **rueda**. Solo cambia la tabla servo → rueda de `robot.yaml`. Recuerda que el equipo no pasa de **25 grados de servo**.

| Cambio en el coche | Qué tocar | ¿Se ajusta solo? |
|---|---|---|
| Ángulo de rueda o radio de giro | `STEER_LIMIT`, `robot.yaml` y `real_car_v1.yaml` | El tope sí; cuándo soltarlo (`TURN_TOLERANCE`) y el punto de giro (`TURN_FRONT`, `LOOKAHEAD`) hay que reajustarlos |
| Servo más lento o más rápido | El modelo del simulador (`steer_delay`, `steer_rate`, `steer_tau`) | No: reajustar `TURN_FRONT`; si hace falta, `KP` y `DAMPING` |
| Otra palanca, mismo giro de rueda | Solo la tabla servo → rueda de `robot.yaml` | Sí |
| Otra distancia entre ejes | `WHEELBASE` en `minisim.py`, `vehicle.py` y `robot.yaml` (y el URDF) | El arco sí; el punto de giro hay que reajustarlo |

**El orden:**

1. Mide el coche: el ángulo de cada rueda (esta sección) y, si cambió el servo, su retardo.
2. Pon las medidas en robotek-learn: `robot.yaml`, `minisim.py`, `vehicle.py` y `real_car_v1.yaml`.
3. Corre el laboratorio **con la estrategia sin cambios**, para ver qué cambia solo por el coche:

   ```bash
   python -m robotek_evaluation.open_lab --strategy my_open.strategy:Strategy --jobs 8 --seeds 0,1,2
   ```

4. Reajusta un valor cada vez, por ejemplo `--set my_open.turn_gate.TURN_FRONT=1.25`. Para un servo más lento, añade el modelo nuevo: `--act steer_delay=0.16 --act steer_tau=0.06` (el laboratorio suma 0,04 s como Gazebo; ver el capítulo 12).
5. Confirma en Gazebo (`round.launch.py` con `set:=` y `actuator_params:=`), y solo después prueba en el coche.

Medir el coche es lo que da más trabajo. Con las medidas, reajustar la estrategia son unos minutos en el laboratorio.

## 4. El motor

**Antes de empezar,** siempre, la [preparación de la sección 1](#1-antes-de-cada-prueba-siempre).

El coche lleva un **motor 310** (JGA27-310R: reductora 20:1, 7,4 V, 450 rpm sin carga, encoder Hall) en el puerto
**M2** de la RRC Lite, con dos engranajes iguales (**1:1**) hasta el eje. La placa mantiene la velocidad pedida con el
encoder.

### El tipo de motor: no mandarlo

La placa acepta un número de tipo de motor (`motor_type` en `src/rrc_lite_driver/config/controller_params.yaml`), que
elige los pulsos por vuelta y las ganancias de su control de velocidad. robotek-learn **no lo manda**
(`motor_type: -1`), igual que el MentorPi de Hiwonder, y la placa usa el suyo de fábrica.

Por qué: el firmware de la RRC Lite (Hiwonder publica su código, `motors_param.h`) tiene para el JGA27, el tipo 2, ganancias
PID **negativas**, porque en su motor el encoder cuenta al revés que el nuestro. Con el tipo 2, en nuestro coche el
control empujaba en el sentido equivocado:
- el motor iba a tope con cualquier consigna;
- no paraba con un 0;
- a veces iba hacia atrás.

Sin tipo, sigue la consigna en los dos sentidos y para con un 0.

Si la placa se reinicia sola (el giroscopio se corta ~2,5 s; pasa sobre todo con el coche atascado empujando), vuelve a su
tipo de fábrica, que ya es el bueno. `rrc_driver` solo le reenvía los offsets del servo.

### Sentido y velocidad

- **Sentido:** `rrc_motor_sign: -1.0` en `robot.yaml`. `rrc_driver` invierte el signo, así que en `/rrc/set_motor`
  **−rps es hacia delante**, y la placa recibe +rps. Si cambias de puerto o de motor, vuelve a comprobarlo.
- **Velocidad:** `base_adapter` pasa los m/s de la estrategia a rps con `motor_rps_per_mps`. Con los engranajes 1:1 son
  **8,0** (probado el 11 nov con 6, 7, 8 y 10: con 8 el coche va a lo pedido). `robot.yaml` aún trae 4,4, de los
  engranajes 54:30 de antes, así que se pasa al lanzar: `motor_rps_per_mps:=8.0`. La tabla es la medida del 8 nov con
  54:30, en el suelo, con el LiDAR, en la segunda mitad de cada consigna:

  | rps de la placa | 0,1 | 0,2 | 0,3 | 0,5 | 0,6 | 0,8 | 1,0 |
  |---|---|---|---|---|---|---|---|
  | adelante (m/s) | 0,014 | 0,039 | 0,061 | 0,09–0,12 | 0,153 | 0,169 | 0,215 |
  | atrás (m/s) | 0,017 | 0,054 | 0,073 | 0,13–0,14 | 0,179 | 0,217 | 0,197 |
  | 4,4 rps por m/s | 0,023 | 0,045 | 0,068 | 0,114 | 0,136 | 0,182 | 0,227 |

  - La respuesta tarda: en 1 s no llega a la velocidad estable.
  - El Open v5 pone solo el tope `motor_max_rps` en 6,7: con 8,0 rps por m/s son 0,84 m/s, su velocidad de crucero.
- **Fuerza a poca velocidad:** si el coche no arranca desde parado con la dirección a tope (pasa en el Obstacle, no
  en el Open), `base_adapter` tiene `motor_min_rps`, `motor_kick_rps` y `motor_pulse_rps`, apagadas por defecto: están
  en el README de `robotek_hardware`.

### El freno

Un **0 normal**. El coche se desliza 8–35 cm (más cuanto más rápido iba) y se queda quieto. El Open lo compensa
pidiendo parar antes (`finish_lead: 0.14` en `car_picam.yaml`): en el final el adaptador manda el 0 de golpe, sin rampa.

- `brake_reset` (reiniciar la placa por `/rrc/reset` para parar) y `brake_rps` (el freno de vaivén) siguen en
  `base_adapter`, **apagados**. Eran el parche del 1–4 nov, cuando el tipo 2 no dejaba parar.
- **El freno de pared** (`wall_stop_m`) también está apagado desde el 8 nov: frenaba en cuanto el LiDAR veía algo a
  menos de 0,30 m delante. En el Obstacle eso pasa todo el rato y el coche acababa parado. Se enciende con
  `wall_stop_m: 0.10`.
- Una vez, en las pruebas del 8 nov, la placa dejó de mover el motor hasta reiniciarla: si el coche no avanza aunque llegan
  las órdenes, apágala y enciéndela.

**Cuida el motor:** pulsos cortos, empieza bajo y ten la mano cerca del interruptor. Si se queda empujando contra una
pared, apaga la placa: así se quemó el anterior.

### Guardar

| Archivo | Qué |
|---|---|
| `src/rrc_lite_driver/config/controller_params.yaml` | `motor_type: -1` |
| `src/robotek_hardware/config/robot.yaml` (`base_adapter`) | `rrc_motor_port: 2`, `rrc_motor_sign: -1.0`, `motor_rps_per_mps: 4.4` (8,0 al lanzar, con los engranajes 1:1), `brake_reset: false`, `brake_rps: 0.0`, `wall_stop_m: 0.0` |
| argumentos del launch | `motor_rps_per_mps:=8.0` (engranajes 1:1); el Open pone solo el tope `motor_max_rps` en 6,7 |

### Si quieres ir más rápido

El coche ya va a lo que pide la estrategia, hasta el tope. Lo que cambia al ir más rápido:

- **Las esquinas empiezan tarde.** Entre que la estrategia decide girar y que las ruedas llegan al tope pasan unos 0,3 s.
  A 0,6 m/s son 18 cm; a 1 m/s, 30 cm.
- **Se ve menos antes de girar.** El LiDAR da 10 escaneos por segundo: a 1 m/s el coche avanza 10 cm entre dos.
- **El freno se pasa más.** A más velocidad, más centímetros después de la orden de parar.
- **Se encabrita y patina.** `accel_limit` limita la aceleración a 1 m/s²: no lo subas a la vez que el tope.

En el campo puntúa la ronda completa, no la vuelta más rápida: un coche lento que termina las tres vueltas vale más que
uno rápido que choca.

## 5. LiDAR y cámara

**Antes de empezar,** siempre, la [preparación de la sección 1](#1-antes-de-cada-prueba-siempre).

La forma más simple de tener los tres sensores es el launch del coche: arranca la placa, el LiDAR y la cámara, y la estrategia **espera el botón** sin moverse. Con las ruedas en el aire:

```bash
ros2 launch robotek_course car.launch.py
```

Mira lo que ve desde tu ordenador con RViz, con el mismo `ROS_DOMAIN_ID`, como en el [capítulo 10](/learn/open-strategy/paso-10-el-coche-real/) (secciones 3.2 y 3.3). **Relanza RViz cada vez que relances el coche**: pierde la imagen de la cámara cuando su nodo se reinicia.

- **LiDAR.** Con el coche a 0,5 m de una pared plana, el rango de frente y a ±90 grados debe coincidir con la regla (±1 cm). La pared delante tiene que verse **delante**, y tu mano a la izquierda, a la izquierda. El LiDAR mira 110 grados a cada lado; más allá los rayos dan en el propio coche.
- **LiDAR que da *timeout* al arrancar.** En el coche del equipo, el LiDAR arrancado a la vez que la placa a veces da *timeout*. Si pasa, para todo (`Ctrl+C` y la búsqueda de nodos de la sección 1) y vuelve a lanzar.
- **LiDAR que vuelve como otro puerto.** Si el USB del LiDAR se corta, vuelve como `/dev/ttyUSB1`. El launch abre
  `/dev/ldlidar` (el nombre fijo de la regla de udev), así que no importa.
- **Cámara.** La estrategia decide el sentido de la vuelta comparando la línea **azul** y la **naranja** del suelo, con los colores de `BLUE_HSV` y `ORANGE_HSV` en `src/robotek_course/robotek_course/vision.py`. **Esos colores son los del simulador.** En la sala del equipo, el 8 de octubre, la línea naranja se veía **casi roja** (tono H de 163 a 178, fuera del rango naranja del simulador, de 5 a 28) y la pared beige de la sala caía dentro del naranja. Comprueba con el coche en la sección de salida, en los dos sentidos, que la estrategia elige bien, y mide los colores con la luz de la sala como en el capítulo 10 (sección 3.2) si no lo hace.

### La cámara IMX708 (la del coche desde el 4 de noviembre)

El coche lleva ahora una **Raspberry Pi Camera Module 3 (IMX708)** en el flex, en el conector **CAM/DISP 1** del Pi 5
(junto a los micro HDMI), girada 180°. Ve 1,8 veces más ancho que la USB y gasta menos por imagen. Se usa con
`camera_driver:=picam` en el launch:

- **El nodo.** `pi_camera_publisher` (en `robotek_hardware`) lanza `rpicam-vid` y publica `/picam/image_raw`. El driver
  de cámara de ROS no ve las cámaras del Pi 5, y el nodo quita las librerías de ROS del entorno de `rpicam-vid` por el
  mismo motivo. Si pasan 3 s sin imagen, reinicia `rpicam-vid` y escribe su error en el log («Camera frontend has timed
  out»: el flex está suelto; apaga el Pi del todo y vuelve a encajarlo por los dos lados).
- **1280x720 a 10 fps.** Desde la salida, las líneas de la esquina están a ~1,5 m. A 640x360 ocupan 1 píxel y casi no
  tienen color.
- **Solo hasta elegir el sentido.** La cámara se apaga en cuanto el Open empieza a conducir (`picam_active_states:=auto`).
  Encendida, el Pi gasta 4,6 W y el bucle del Open baja a ~26 Hz; apagada, 3,8 W y 50 Hz.
- **Otros colores.** Esta cámara ve el muro negro azulado y el naranja de verdad (la USB lo veía rosado), así que tiene
  sus propios colores en `src/robotek_open/config/car_picam.yaml`
  (`vision_blue_*`, `vision_orange_*` y `vision_wall_v_max`, medidos en la sala del equipo).
- **Líneas finas.** A 1,5 m la línea azul se ve gris marino, del mismo tono que el suelo blanco junto al muro. Ningún
  rango de color las separa. Con `vision_line_contrast: 30` y `vision_line_tint: 8`, el detector busca franjas finas más
  oscuras que el suelo de alrededor y las clasifica por su tinte respecto a ese suelo: más azul en la azul, menos en la
  naranja.
- **El borde del suelo.** El detector ignora todo lo que está por encima del muro negro. Donde algo tapa el muro (un
  pilar, un objeto claro), toma el borde de las columnas vecinas.

## 6. La ronda

Lanzar el Open es un comando, que también para lo que haya quedado de antes:

```bash
cd ~/robotek-learn && git pull && colcon build --symlink-install
bash tools/car-run.sh open motor_rps_per_mps:=8.0
```

El paso a paso (las luces, el botón, primero en el aire, dónde queda la ronda, el arranque automático) está en
[Correr el Open en el Pi desde cero](/learn/open-strategy/correr-en-el-pi/). Antes de la primera ronda:

1. `robot.yaml` tiene `imu_adapter.measured: true` y `servo_measured: true`, y la prueba del giro a la izquierda dio positivo.
2. El motor está como en la sección 4: M2, sin tipo (`motor_type: -1`), `rrc_motor_sign: -1.0`, y un 0 lo para.

### Los valores del Open para el coche

Están en el repositorio, en `src/robotek_open/config/car_picam.yaml`, y el launch los carga solo. La tabla completa,
con el valor del curso al lado, está en [Correr el Open en el Pi](/learn/open-strategy/correr-en-el-pi/#6-los-valores-del-coche).
Los que más pesan:

- **`wall_heading_gain: 0.3`: el giroscopio corregido con la pared de la isla.** El giroscopio de la placa lee un 6 %
  menos de lo que gira el coche. Cada esquina salía 4 a 6° de más y, en dos vueltas, el coche iba 35 a 40° torcido
  hacia la isla mientras la estrategia creía ir recto. En cada recta, con cada escaneo, la recta ajustada a la pared de
  la isla da el rumbo real (`wall_heading`, paso 3) y la misión acerca su rumbo un 30 % a ese (paso 7). No corrige en
  las esquinas, ni en los primeros 25 cm después de una, ni si la diferencia pasa de 25°.
- **`inner_gap: 0.50` y la pared exterior.** El coche va a 0,50 m de la isla. En un pasillo estrecho (0,6 m) eso lo
  dejaría rozando la pared exterior, así que allí guarda 0,25 m a esa pared.
- **`corner_speed: 0.64` y `brake_margin: 0.35`.** Frena antes de cada esquina y la toma a 0,64 m/s.
- **`direction_fallback: ccw`.** Desde algunas salidas las dos líneas se ven igual de largas y la cámara no decide. Al
  segundo de calibrar, el coche sale en antihorario y el LiDAR lo corrige antes de la primera esquina si era al revés.
- **`scan_max_age: 1.0`.** Si el LiDAR calla más de 1 s, manda velocidad 0 hasta que vuelva. Entre escaneos, la pared
  de enfrente se estima con la velocidad pedida.

Cualquiera se cambia al lanzar, sin editar el archivo: `bash tools/car-run.sh open motor_rps_per_mps:=8.0 cruise_speed:=0.7`.

### Lo que hace el Open en el coche

- **El sentido** lo elige la cámara: gana la línea (azul o naranja) más larga en la imagen. Si un reflejo esconde una
  línea se puede equivocar; por eso, antes de la primera esquina, **el LiDAR lo comprueba**: si el lado que debería
  ser la isla se abre más de 1,2 m durante 3 escaneos, cambia el sentido. Mejor sin luz directa sobre el tapete.
- **El rumbo** lo integra con el giroscopio usando el tiempo real de cada ciclo (en el Pi el bucle va a 33 a 50 Hz, no
  a 50 fijos) y lo corrige con la pared de la isla en las rectas.
- **La distancia** en cada recta es lo que se acerca la pared de enfrente: no hay encoder de ruedas ni odometría.
- **No se recupera de un atasco.** Si choca, se queda empujando: páralo con el botón.
- **No uses K2** ni ningún otro interruptor para elegir el sentido: las reglas solo permiten esperar el Start.

## 7. Después de la ronda

En el coche no hay juez ni posición real: el juez eres tú. Para cada intento, **también los fallidos**, guarda los
registros (`~/runs/<fecha>-<hora>-open-v5/`) y anota:

- la batería antes de la ronda y qué cambiaste desde el intento anterior (con el commit de robotek-learn: `git log -1 --oneline`);
- desde dónde salió (x, y y orientación) y en qué sentido;
- el tiempo desde el botón hasta `DONE`, con cronómetro (el estado se ve con `ros2 topic echo /robotek/state`);
- si tocó un muro o la isla, dónde se paró y qué viste.

Pasa los registros a tu ordenador (`scp -r <usuario>@<ip-del-pi>:runs/<carpeta> .`) antes de apagar el coche.

## Resumen

1. **Siempre, antes de cada medida,** en el Pi: `car-autostart.sh stop`; `git pull`; `colcon build --symlink-install`; `bash tools/car-clean.sh`; los dos `source`.
2. **IMU:** `imu_axes` (quieto 3 s, un empujón) o a mano, eje por eje; copiar los ejes a `robot.yaml`, `measured: true`, y comprobar que girar a la izquierda da `z` positivo.
3. **Servo (hecho el 1 nov):** `steer_calibration.py` en el suelo da el centro real y el ángulo de cada lado; `--check` lo comprueba.
4. **Motor:** el 310 en M2 **sin tipo** (`motor_type: -1`), `rrc_motor_sign: -1.0`, 8,0 rps por m/s con los engranajes 1:1 (`motor_rps_per_mps:=8.0` al lanzar), parada con un 0.
5. **Sensores:** `car.launch.py`, el LiDAR contra una regla y la cámara (IMX708, `camera_driver:=picam`) eligiendo bien el sentido con la luz de la sala.
6. **Ronda:** `bash tools/car-run.sh open motor_rps_per_mps:=8.0`; luces verdes, una pulsación. El 11 de noviembre, rondas de 31 a 38 s en los dos sentidos.
7. **Registro:** `~/runs/` y tus notas de cada intento.

Si algo falla, busca el síntoma en [Solución de problemas](/learn/open-strategy/paso-11-solucion-de-problemas/).
