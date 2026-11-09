---
guide: "open-strategy"
order: 10.5
slug: "coche-del-equipo-v5"
title: "El coche del equipo: calibrar la IMU y correr la estrategia"
summary: "Del coche reconstruido a la primera ronda con robotek-learn: bajar el código al Raspberry Pi antes de cada prueba, medir los ejes de la IMU, el servo y el motor, llevar las medidas al repositorio y lanzar la estrategia de referencia."
tag: "step-9"
compareFrom: "step-9"
---

Esta página es la receta para el **coche del equipo Robotek**: qué medir después de la reconstrucción del 21 de octubre de 2026, en qué orden, dónde se guarda cada medida y cómo se lanza la ronda. Todo sale del repositorio del curso, **[robotek-learn](https://github.com/renzodamgo/robotek-learn)**: es el que está en el Raspberry Pi del coche y el que se baja con `git pull` antes de cada prueba. La estrategia es la **de referencia del paso 9** (`my_open`) o la tuya si ya la terminaste; el **Open v5** del equipo también está en robotek-learn y se lanza igual ([sección 6](#6-la-primera-ronda)).

El [capítulo 10](/learn/open-strategy/paso-10-el-coche-real/) explica cada pieza con más calma (instalar el Pi desde cero, el LiDAR en RViz, la cámara). Aquí está el camino corto, en orden.

> **Qué está probado y qué no** (8 de noviembre de 2026).
>
> - **Probado en el coche:** el **Open v5** hizo varias rondas completas de 3 vueltas en el campo del equipo, con
>   arranque automático y botón, y se paró solo en la sección de salida. El 8 nov, con la cámara **IMX708**, el motor
>   sin tipo y `motor_max_rps:=6.7`, hizo **tres rondas perfectas seguidas: FINISH a 28,5 / 26,7 / 26,7 s** desde Start
>   (~0,87 m/s de media; sin juez).
> - **Corregido en el coche:** el rumbo, con las paredes del LiDAR (el giroscopio marca un ~5 % menos); el sentido, con
>   el LiDAR si la cámara se equivoca o no decide.
> - **Medido en el coche reconstruido:** los ejes de la IMU (`measured: true`), la dirección (1 de noviembre: centro
>   1403 µs, ±19°, `servo_measured: true`) y el motor 310 en M2 **sin tipo de motor**, a 4,4 rps por m/s (sección 4).
> - **Resuelto el 8 nov:** el motor no paraba con un 0 porque se le mandaba el tipo 2 a la placa (sección 4). Ya para
>   con un 0 normal, sin reiniciar la placa.
> - **Sin aclarar:** a veces una esquina no gira aunque la dirección recibe la orden a tope (dos rondas del 4 nov, dos
>   del 8 nov y una del Obstacle). El servo funciona cuando se prueba solo.
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
| 1 | **Antes de cada prueba:** `git pull` de robotek-learn, compilar y limpiar el Pi | sí, siempre | — |
| 2 | Ejes de la IMU | **sí** | `robot.yaml` → `imu_adapter` |
| 3 | Servo: centro, signo y ángulo real (**hecho** el 1 nov) | **sí** | `robot.yaml` → `base_adapter` |
| 4 | Motor: sin tipo, M2, sentido, velocidad y parada (**hecho** el 8 nov) | **sí** | `controller_params.yaml`, `robot.yaml` |
| 5 | LiDAR y cámara | no, pero la cámara decide el sentido | `robot.yaml` → `scan_adapter`; colores en `vision.py` |
| 6 | Primera ronda, despacio; después, arranque automático | — | `~/runs/` en el Pi |
| 7 | Anotar la ronda | — | tu cuaderno de rondas |

Todos los archivos están en robotek-learn: `src/robotek_hardware/config/robot.yaml`, `src/robotek_evaluation/config/real_car_v1.yaml`, `src/robotek_course/robotek_course/minisim.py` y `src/robotek_course/robotek_course/vision.py`.

Haz las mediciones **en este orden** y con el coche **sobre soportes, con las ruedas en el aire**, salvo cuando se diga lo contrario.

## 1. Antes de cada prueba (siempre)

Haz esto **al empezar cada prueba**, aunque ya lo hayas hecho antes ese día: así el Pi corre exactamente el código de robotek-learn y no queda nada de la prueba anterior. Cada sección siguiente empieza recordándolo.

### La primera vez: el repositorio en el Pi

Si el Pi todavía no tiene robotek-learn (o lo tiene en otra carpeta), clónalo en la carpeta de usuario e instala lo que falta, como en el [capítulo 10](/learn/open-strategy/paso-10-el-coche-real/):

```bash
cd ~
git clone https://github.com/renzodamgo/robotek-learn.git
cd robotek-learn
bash tools/setup-pi.sh --with-reference      # ROS, dependencias, udev, grupos, la estrategia de referencia y colcon build
```

Cierra la sesión y vuelve a entrar (por los grupos nuevos) y comprueba con `bash tools/setup-pi.sh --check`.

Si el `~/.bashrc` del Pi carga **otro** workspace (por ejemplo `source ~/Projects/WRO-Strategies/install/setup.bash` o `~/wro_controller_ws`), quita esa línea: tienen paquetes con el mismo nombre (`robotek_hardware`, `rrc_lite_driver`…) y se mezclan.

### De dónde vienen los cambios

- **El código y las medidas del coche** (`robot.yaml`, `minisim.py`, …) están en robotek-learn, en GitHub. Quien tiene permiso los cambia en su ordenador y hace `git push`. En el Pi **solo se hace `git pull`**: si editas en el Pi, el siguiente `git pull` choca o pierdes el cambio.
- **Tu estrategia `my_open`** no está en git (el repositorio la ignora). Si usas la tuya y no la de referencia, cópiala al Pi cada vez que la cambies (con `rsync` o `scp`, como en el capítulo 10).

Si mediste algo en el Pi (por ejemplo los ejes de la IMU), pásalo al ordenador, súbelo y vuelve a hacer `git pull` en el Pi.

### En el Pi: entra, para lo que corre, baja el código y compila

Desde tu ordenador, en la misma red Wi‑Fi que el coche:

```bash
ssh <usuario>@<ip-del-pi>
```

La IP la da el router por DHCP y puede cambiar después de un reinicio. Si no responde, espera un minuto (el Pi tarda en volver a la red) o búscala en el router.

Ya dentro del Pi, siempre en este orden:

```bash
~/scripts/stop_ros.sh                       # 1. para el software del equipo, que arranca solo (si lo tiene)
bash ~/robotek-learn/tools/car-autostart.sh stop   #    y el Open del arranque automático (sección 6), si está
cd ~/robotek-learn
git pull                                    # 2. baja la última versión de robotek-learn
git log -1 --oneline                        #    el mismo commit que ves en GitHub
colcon build --symlink-install              # 3. compila
source install/setup.bash                   # 4. carga lo que acabas de compilar
echo $ROS_DOMAIN_ID                         # 5. el número del coche: el mismo en el ordenador que mira RViz
```

- **`stop_ros.sh`**: el Pi del equipo arranca solo su software (`ros_autostart.service`), que usa los mismos puertos que las pruebas. Escríbelo tú en la sesión de ssh. No lo metas en una línea como `ssh pi '~/scripts/stop_ros.sh && ...'`: el script mata procesos por nombre y puede matar tu propia conexión. Si tu Pi no tiene ese script, sáltalo.
- **`colcon build --symlink-install`** cada vez: es lo que usa `setup-pi.sh`, y con él los cambios de Python y de `robot.yaml` llegan sin copiar nada a mano.
- **`git pull` falla** con "local changes": alguien editó en el Pi. Pasa ese cambio al ordenador antes de descartarlo (`git stash`), no lo borres.
- **El dominio:** el coche del equipo usa el **1**. En clase, cada coche tiene el suyo (capítulo 10, sección 3.3).

### Comprueba que no quedó nada de la prueba anterior

```bash
bash tools/car-clean.sh
```

Para todos los nodos del coche que hayan quedado vivos (de un launch parado por ssh o desde un script, que a veces
deja sus nodos corriendo) y pone los motores a 0. Debe decir `no car nodes running` o los nombres de los que paró.
Un nodo viejo vivo es la causa típica de un LiDAR que da *timeout* (dos lectores en el mismo puerto), de un coche que
se mueve solo o de una estrategia lenta: el 4 de noviembre, tres nodos olvidados de pruebas anteriores frenaron el
Open hasta que chocó de frente.

Y la batería, si la prueba mueve el motor:

```bash
ros2 topic echo /rrc/battery --once         # en mV: 8000 o más es una 2S cargada (necesita la placa en marcha)
```

### Cada terminal nueva

Cada prueba usa dos o tres terminales en el Pi. Cada una es otro `ssh <usuario>@<ip-del-pi>`, y en cada una:

```bash
cd ~/robotek-learn && source install/setup.bash && echo $ROS_DOMAIN_ID
```

### Cómo parar los nodos al terminar

`Ctrl+C` en cada terminal que lanzaste y después `bash tools/car-clean.sh`.

## 2. Los ejes de la IMU (bloquea)

**Antes de empezar,** siempre, la [preparación de la sección 1](#1-antes-de-cada-prueba-siempre). En el Pi:

```bash
~/scripts/stop_ros.sh
cd ~/robotek-learn && git pull && colcon build --symlink-install && source install/setup.bash
bash tools/car-clean.sh                     # para lo que quedó de antes
```

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

**Antes de empezar,** siempre, la [preparación de la sección 1](#1-antes-de-cada-prueba-siempre). En el Pi:

```bash
~/scripts/stop_ros.sh
cd ~/robotek-learn && git pull && colcon build --symlink-install && source install/setup.bash
bash tools/car-clean.sh                     # para lo que quedó de antes
```

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
- Con ella calcula la **velocidad de giro en la esquina** (`arc.py`): `v · tan(STEER_LIMIT) / WHEELBASE`. Si el coche gira más cerrado, la rampa del arco se acelera sola; si gira menos, se hace más lenta.
- En el coche va la misma medida en `robot.yaml` (`wheel_table_*`, `wheel_limit_deg`), y en el simulador en `real_car_v1.yaml` (`steer_limit`), como en la tabla de arriba.

Lo que **no** se ajusta solo es el punto donde empieza el giro. Con un radio menor el coche puede girar más tarde, y con uno mayor tiene que girar antes. Eso lo deciden `TURN_FRONT` (1,19 m: la pared de enfrente a la que se puede empezar a girar) y `LOOKAHEAD` (0,35 m: lo cerca que tiene que estar el final de la isla), en `my_open/turn_gate.py`. Se prueban en el laboratorio sin tocar el archivo, con `--set`.

**2. Tiempo de respuesta del servo: la estrategia no lo tiene en cuenta.** No tiene ningún parámetro de retardo del servo.

- El retardo solo existe en el **modelo del simulador**: `steer_delay` (0,06 s), `steer_rate` (1,2 rad/s) y `steer_tau` en `real_car_v1.yaml`. El laboratorio los cambia con `--act` y Gazebo con `actuator_params:=` ([capítulo 12](/learn/open-strategy/paso-12-afinar/)).
- Si el servo nuevo es **más lento**, la dirección llega tarde al tope en cada esquina y el coche abre la curva. El remedio es empezar a girar antes (subir `TURN_FRONT`). Compruébalo en el laboratorio y en Gazebo **con el retardo nuevo en el modelo**: si no, la simulación sigue con el servo viejo y no te muestra el problema.
- Si es mucho más lento, quizá haya que tocar las ganancias: `KP` (0,8) en `heading.py`, `DAMPING` (0,1) y `EXIT_ANGLE` (0,25 rad) en `arc.py`. Ojo: en el capítulo 12, con el retardo triplicado, subir `DAMPING` empeoró las rondas; lo que dio margen fue bajar la velocidad.

**3. Ángulo del servo distinto, con el mismo giro de rueda.** Si solo cambia la palanca (por ejemplo, ahora hacen falta 30 grados de servo para el mismo ángulo de rueda), la estrategia no se entera: trabaja con el ángulo de la **rueda**. Solo cambia la tabla servo → rueda de `robot.yaml`. Recuerda que el equipo no pasa de **25 grados de servo**.

| Cambio en el coche | Qué tocar | ¿Se ajusta solo? |
|---|---|---|
| Ángulo de rueda o radio de giro | `STEER_LIMIT`, `robot.yaml` y `real_car_v1.yaml` | El arco sí; el punto de giro hay que reajustarlo (`TURN_FRONT`, `LOOKAHEAD`) |
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

**Antes de empezar,** siempre, la [preparación de la sección 1](#1-antes-de-cada-prueba-siempre). En el Pi:

```bash
~/scripts/stop_ros.sh
cd ~/robotek-learn && git pull && colcon build --symlink-install && source install/setup.bash
bash tools/car-clean.sh                     # para lo que quedó de antes
```

El coche lleva un **motor 310** (JGA27-310R: reductora 20:1, 7,4 V, 450 rpm sin carga, encoder Hall) en el puerto
**M2** de la RRC Lite, con dos engranajes **54:30** hasta el eje (el grande en el motor). La placa mantiene la velocidad
pedida con el encoder. Así está desde el **8 de noviembre de 2026**; lo de antes, al final de la sección.

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
- **Velocidad:** `base_adapter` pasa los m/s de la estrategia a rps con `motor_rps_per_mps` **4,4**. Medido el 8 nov en el
  suelo, con el LiDAR, en la segunda mitad de cada consigna:

  | rps de la placa | 0,1 | 0,2 | 0,3 | 0,5 | 0,6 | 0,8 | 1,0 |
  |---|---|---|---|---|---|---|---|
  | adelante (m/s) | 0,014 | 0,039 | 0,061 | 0,09–0,12 | 0,153 | 0,169 | 0,215 |
  | atrás (m/s) | 0,017 | 0,054 | 0,073 | 0,13–0,14 | 0,179 | 0,217 | 0,197 |
  | 4,4 rps por m/s | 0,023 | 0,045 | 0,068 | 0,114 | 0,136 | 0,182 | 0,227 |

  - La respuesta tarda: en 1 s no llega a la velocidad estable.
  - El tope de `robot.yaml` (`motor_max_rps: 3.4`) son ~0,77 m/s.
  - El Open v5 se lanza con **`motor_max_rps:=6.7`**, que no recorta sus 1,28 m/s: el coche hace ~0,87 m/s de media en
    la ronda.
- **Fuerza a poca velocidad:** con 54:30 el motor tiene poca. Con la dirección a tope, desde parado, no arranca por
  debajo de ~1 rps (~0,23 m/s). En el Open no se nota; en el Obstacle sí. Dos remedios:
  - **Engranajes 30:54** (el pequeño en el motor): 3,24 veces más fuerza y máxima ~0,65 m/s; entonces
    `motor_rps_per_mps` 13.
  - **Opciones del adaptador** (apagadas por defecto): `motor_min_rps`, `motor_kick_rps` y `motor_pulse_rps`, en el
    README de `robotek_hardware`.

Para comprobar el sentido, con las ruedas en el aire y solo la placa (terminal 1):

```bash
ros2 topic echo /rrc/battery --once          # en mV: 8000 o más es una 2S cargada (con la placa en marcha)
ros2 launch rrc_lite_driver controller.launch.py
```

En la terminal 2, 2 rps hacia delante durante 1 s:

```bash
timeout 1 ros2 topic pub -r 10 /rrc/set_motor rrc_lite_msgs/msg/MotorsState "{data: [{id: 2, rps: -2.0}]}"
```

Las ruedas traseras deben girar **hacia delante** y pararse solas al acabar.

### El freno

Un **0 normal**. El coche se desliza 8–35 cm (más cuanto más rápido iba) y se queda quieto. El Open lo compensa
pidiendo parar 25 cm antes (`finish_lead`, sección 6).

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
| `src/robotek_hardware/config/robot.yaml` (`base_adapter`) | `rrc_motor_port: 2`, `rrc_motor_sign: -1.0`, `motor_rps_per_mps: 4.4`, `brake_reset: false`, `brake_rps: 0.0`, `wall_stop_m: 0.0` |
| argumentos del launch | Open: `motor_max_rps:=6.7`; la primera vez, 2,5 |

### Si quieres ir más rápido

El coche ya va a lo que pide la estrategia, hasta el tope. Lo que cambia al ir más rápido:

- **Las esquinas empiezan tarde.** Entre que la estrategia decide girar y que las ruedas llegan al tope pasan unos 0,3 s.
  A 0,6 m/s son 18 cm; a 1 m/s, 30 cm.
- **Se ve menos antes de girar.** El LiDAR da 10 escaneos por segundo: a 1 m/s el coche avanza 10 cm entre dos.
- **El freno se pasa más.** A más velocidad, más centímetros después de la orden de parar.
- **Se encabrita y patina.** `accel_limit` limita la aceleración a 1 m/s²: no lo subas a la vez que el tope.

En el campo puntúa la ronda completa, no la vuelta más rápida: un coche lento que termina las tres vueltas vale más que
uno rápido que choca.

### Antes del 8 de noviembre

Del 1 al 8 nov el motor estuvo en M1 y se le mandaba el **tipo 2**. Era el único tipo que movía el coche, pero con el
control invertido:
- iba a ~0,45–0,75 m/s con cualquier consigna, así que el Open se corría a 2,5 rps;
- no paraba con 0, así que se paraba reiniciando la placa al final de la ronda;
- si la placa se reiniciaba sola, se quedaba quieto o iba hacia atrás.

El diagnóstico (firmware, pruebas en M1 y M2 y con el SDK de Hiwonder) está en WRO-Strategies,
`docs/robot-real-pi/obstacle-runs/20261108/`.

## 5. LiDAR y cámara

**Antes de empezar,** siempre, la [preparación de la sección 1](#1-antes-de-cada-prueba-siempre). En el Pi:

```bash
~/scripts/stop_ros.sh
cd ~/robotek-learn && git pull && colcon build --symlink-install && source install/setup.bash
bash tools/car-clean.sh                     # para lo que quedó de antes
```

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
  su propio archivo de ajustes, `~/.config/robotek/open_v5_car_picam.yaml`: los de la sección 6 más los colores
  (`vision_blue_*`, `vision_orange_*` y `vision_wall_v_max`, medidos en la sala del equipo).
- **Líneas finas.** A 1,5 m la línea azul se ve gris marino, del mismo tono que el suelo blanco junto al muro. Ningún
  rango de color las separa. Con `vision_line_contrast: 30` y `vision_line_tint: 8`, el detector busca franjas finas más
  oscuras que el suelo de alrededor y las clasifica por su tinte respecto a ese suelo: más azul en la azul, menos en la
  naranja.
- **El borde del suelo.** El detector ignora todo lo que está por encima del muro negro. Donde algo tapa el muro (un
  pilar, un objeto claro), toma el borde de las columnas vecinas.

## 6. La primera ronda

**Antes de empezar,** siempre, la [preparación de la sección 1](#1-antes-de-cada-prueba-siempre). En el Pi:

```bash
~/scripts/stop_ros.sh
cd ~/robotek-learn && git pull && colcon build --symlink-install && source install/setup.bash
bash tools/car-clean.sh                     # para lo que quedó de antes
```

### Antes

1. `robot.yaml` tiene `imu_adapter.measured: true` y `servo_measured: true`, y la prueba del giro a la izquierda dio positivo.
2. El motor está como en la sección 4: M2, sin tipo (`motor_type: -1`), `rrc_motor_sign: -1.0`, y un 0 lo para.
3. Batería cargada (`ros2 topic echo /rrc/battery --once`).
4. Campo Open montado y el coche en la sección de salida. Para llevarlo hasta allí sin tocarlo, conduce con el teclado desde tu ordenador (`car.launch.py teleop:=true` y `tools/keyboard_racing`; ver el README de robotek-learn).

### Los ajustes del Open v5 para el coche

El Open v5 trae los valores del simulador. Para el coche del equipo hay unos pocos distintos, en un archivo aparte que
el launch le pasa con `strategy_params:=`. Así el simulador no cambia. En el Pi, `~/.config/robotek/open_v5_car.yaml`:

```yaml
strategy:
  ros__parameters:
    inner_gap: 0.35            # m a la isla en las rectas (0,25 en el simulador)
    wall_heading_gain: 0.3     # corrige el rumbo con las paredes en las rectas (0 en el simulador)
    finish_speed: 0.4          # m/s del último tramo hasta la salida
    finish_lead: 0.25          # m: pide parar 25 cm antes, lo que se pasa el freno
    direction_fallback: ccw    # si la cámara no decide el sentido, antihorario (el LiDAR lo corrige)
```

Con la cámara IMX708, el archivo es `open_v5_car_picam.yaml`: lo mismo más los colores de esa cámara (sección 5).

- **`wall_heading_gain`: el giroscopio corregido con el LiDAR.** El giroscopio de la placa marca un ~5 % menos de lo
  que gira el coche. Cada esquina salía 4–6° de más y, en dos vueltas, el coche iba 35–40° torcido hacia la isla
  mientras el Open creía ir recto. Las paredes de una recta son rectas y paralelas a la pista, así que dicen el rumbo
  real:
  1. En cada barrido del LiDAR, `wall_heading` (en `v5/scene.py`) toma los rayos a ±20° de cada costado (90° a la
     izquierda y a la derecha) y les ajusta una recta.
  2. Solo vale un lado si la recta es limpia (los puntos a menos de 3 cm de ella), no muy inclinada (menos de 30°) y a
     una distancia creíble (de 0,12 a 1,2 m). Si valen los dos, los promedia según cuántos rayos tiene cada uno.
  3. La inclinación de esa recta es el rumbo del coche respecto a la pista. La misión (`_correct_heading` en
     `v5/mission.py`) lo compara con el yaw del giroscopio y acerca el yaw un 30 % a lo que dicen las paredes (el
     `0.3`).
  4. No corrige en las esquinas, ni en los primeros 25 cm después de una, ni si la diferencia pasa de 25°: eso sería
     un mal ajuste (una esquina, un hueco), no deriva.

  El giroscopio sigue mandando en los giros; las paredes solo van quitando el error que se acumula en las rectas. En
  las rondas del 4 de noviembre, el coche iba recto (entre 0° y −7°) de la primera a la tercera vuelta. En el simulador
  vale 0, porque allí el giroscopio no tiene ese error.
- **`direction_fallback`:** con la IMX708, desde algunas posiciones de salida las dos líneas se ven igual de largas y
  la cámara no decide. Sin esto, el Open esperaba 15 s y se paraba (DIRECTION_FAULT). Con `ccw`, si 1 s después de
  calibrar la cámara no ha decidido, sale en antihorario, y el LiDAR lo corrige antes de la primera esquina si era al
  revés.
- **`laps`:** para probar la llegada y el freno sin hacer la ronda entera, añade `laps: 1` (una vuelta). Quítalo para
  las rondas de verdad.

### Lanzar a mano

Guarda la consola, que es tu registro:

```bash
mkdir -p ~/rondas-coche
ros2 launch robotek_course car.launch.py strategy:=robotek_open executable:=open_v5 motor_max_rps:=6.7 \
    strategy_params:=$HOME/.config/robotek/open_v5_car_picam.yaml camera_driver:=picam \
    2>&1 | tee ~/rondas-coche/ronda-v5-01.log
```

`motor_max_rps:=6.7` es como corre el equipo (no recorta los 1,28 m/s del v5). La primera vez, o con un coche nuevo,
empieza con `motor_max_rps:=2.5` (~0,57 m/s) y sube cuando las esquinas salgan bien.

Con la cámara USB: `strategy_params:=$HOME/.config/robotek/open_v5_car.yaml`, sin `camera_driver`.

Arranca la placa, el LiDAR, la cámara, los adaptadores, el botón, las luces y la estrategia. La estrategia de referencia
se lanza con `ros2 launch robotek_course open_challenge.launch.py motor_max_rps:=2.5` (sin el archivo de ajustes: sus
valores son otros). Relanza RViz en tu ordenador.

Para una prueba **sin botón**, con todo grabado (el coche sale solo 12 s después de lanzar; el botón lo para):

```bash
bash tools/open-debug-run.sh motor_max_rps:=6.7 strategy_params:=$HOME/.config/robotek/open_v5_car_picam.yaml camera_driver:=picam
```

### Que se cargue solo al encender

Para competir o para hacer muchas rondas seguidas, el Open se carga solo cada vez que se enciende el Pi y espera el
botón:

```bash
bash tools/car-autostart.sh on motor_max_rps:=6.7 \
    strategy_params:=$HOME/.config/robotek/open_v5_car_picam.yaml camera_driver:=picam
bash tools/car-autostart.sh start           # ahora, sin reiniciar
bash tools/car-autostart.sh stop            # pararlo (antes de lanzar cualquier otra cosa a mano)
bash tools/car-autostart.sh off             # que no arranque más al encender
```

Cada arranque pasa antes por `car-clean.sh`. **Después de cada ronda hay que relanzar** (`stop` y `start`, o reiniciar el
Pi): el Open termina en `DONE` y no vuelve a empezar.

Cada ronda queda grabada en `~/runs/<fecha>-<hora>-autostart/`:

- `launch.log`: la salida del launch;
- `kernel.log`: los avisos del sistema, por ejemplo si se cae el USB de la placa;
- `bag/`: un rosbag ligero que empieza al pulsar Start.

La telemetría del Open queda al lado, en `~/runs/<fecha>-<hora>-open-v5/`.

### Primero en el aire

Con el coche sobre soportes, pulsa el botón: calibra, mira la cámara y empieza a "andar". Comprueba que la dirección y
el motor se mueven como esperas, y vuelve a pulsar para pararlo, pasados 5 s desde el Start (un 0 lo para en el aire
al momento). Después, en
el suelo: primero una vuelta (`laps: 1`), y al final la ronda completa.

### Las luces

Son muy tenues a propósito (2 de 255, para no reflejarse en la cámara). Míralas de cerca. El color se vuelve a mandar
cada segundo: si se perdía el único mensaje, se quedaban en verde toda la ronda (y un reset de la placa las apaga).

| Estado | Los dos LED |
|---|---|
| Arrancando | apagados |
| **Listo: pulsa el botón** | **verde** |
| **Pulsado: la ronda corre** (y también cuando terminó o la paraste) | **azul** |
| Batería baja (menos de 6,8 V): cámbiala | rojo parpadeando |

### El botón

- **Primera pulsación:** Start.
- **Durante los 5 s siguientes al Start, el botón no hace nada** (`stop_lockout`). El 4 de noviembre, con los LED aún en
  verde, el botón se pulsó otra vez a los 2,2 s y a los 4,4 s: sin esto, la ronda se habría parado.
- **Después:** otra pulsación para el coche (un 0 normal) y lo mantiene parado hasta relanzar.
- **No uses K2** ni ningún otro interruptor para elegir el sentido: las reglas solo permiten esperar el Start, y el
  sentido lo decide la estrategia.

### Lo que hace el Open v5 en el coche

- **El sentido** lo elige la cámara: gana la línea (azul o naranja) más larga en la imagen. Si no decide en 1 s, sale
  con `direction_fallback`. Si un reflejo esconde una línea, o una junta del tapete la parte en dos, se puede
  equivocar; por eso, antes de la primera esquina, **el LiDAR lo comprueba**: si el lado que debería ser la isla se abre
  más de 1,2 m durante 3 barridos, cambia el sentido. Mejor sin luz directa sobre el tapete.
- **El rumbo** lo integra con el giroscopio usando el tiempo real de cada ciclo (en el Pi el bucle va a 33–50 Hz, no a
  50 fijos: con un paso fijo, las esquinas salían de ~115°) y lo corrige con las paredes en las rectas
  (`wall_heading_gain`).
- **Frena si un sensor se calla:** sin LiDAR durante 0,35 s o sin IMU durante 0,2 s, manda velocidad 0 hasta que vuelvan
  (sin reiniciar la placa).
- **No se recupera de un atasco.** Si choca, se queda empujando: páralo con el botón.

## 7. Después de la ronda

En el coche no hay juez ni posición real: el juez eres tú. Para cada intento, **también los fallidos**, guarda los
registros (`~/runs/…-autostart/` o `~/rondas-coche/ronda-NN.log`) y anota:

- la batería antes de la ronda, `motor_max_rps` y qué cambiaste desde el intento anterior (con el commit de robotek-learn: `git log -1 --oneline`);
- desde dónde salió (x, y y orientación) y en qué sentido;
- el tiempo desde el botón hasta `DONE`, con cronómetro (el estado se ve con `ros2 topic echo /robotek/state`);
- si tocó un muro o la isla, dónde se paró y qué viste.

Pasa los registros a tu ordenador (`scp -r <usuario>@<ip-del-pi>:runs/<carpeta> .`) antes de apagar el coche.

## Resumen

1. **Siempre, antes de cada prueba,** en el Pi: `~/scripts/stop_ros.sh`; `car-autostart.sh stop`; `cd ~/robotek-learn`; `git pull`; `colcon build --symlink-install`; `source install/setup.bash`; `bash tools/car-clean.sh`.
2. **IMU:** `imu_axes` (quieto 3 s, un empujón) o a mano, eje por eje; copiar los ejes a `robot.yaml`, `measured: true`, y comprobar que girar a la izquierda da `z` positivo.
3. **Servo (hecho el 1 nov):** `steer_calibration.py` en el suelo da el centro real y el ángulo de cada lado; `--check` lo comprueba.
4. **Motor (8 nov):** el 310 en M2 **sin tipo** (`motor_type: -1`), `rrc_motor_sign: -1.0`, 4,4 rps por m/s con los engranajes 54:30, parada con un 0 y sin freno de pared.
5. **Sensores:** `car.launch.py`, el LiDAR contra una regla y la cámara (IMX708, `camera_driver:=picam`) eligiendo bien el sentido con la luz de la sala.
6. **Ronda:** el Open v5 con `~/.config/robotek/open_v5_car_picam.yaml`, a mano o con `car-autostart.sh on …`; luces verdes, una pulsación. El 8 de noviembre, con `motor_max_rps:=6.7`: tres rondas perfectas seguidas, de 26,7 a 28,5 s.
7. **Registro:** `~/runs/` y tus notas de cada intento.

Si algo falla, busca el síntoma en [Solución de problemas](/learn/open-strategy/paso-11-solucion-de-problemas/).
