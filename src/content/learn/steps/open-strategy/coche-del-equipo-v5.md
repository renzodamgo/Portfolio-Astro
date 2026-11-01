---
guide: "open-strategy"
order: 10.5
slug: "coche-del-equipo-v5"
title: "El coche del equipo: calibrar la IMU y correr la estrategia"
summary: "Del coche reconstruido a la primera ronda con robotek-learn: bajar el código al Raspberry Pi antes de cada prueba, medir los ejes de la IMU, el servo y el motor, llevar las medidas al repositorio y lanzar la estrategia de referencia."
tag: "step-9"
compareFrom: "step-9"
---

Esta página es la receta para el **coche del equipo Robotek**: qué medir después de la reconstrucción del 21 de octubre de 2026, en qué orden, dónde se guarda cada medida y cómo se lanza la ronda. Todo sale del repositorio del curso, **[robotek-learn](https://github.com/renzodamgo/robotek-learn)**: es el que está en el Raspberry Pi del coche y el que se baja con `git pull` antes de cada prueba. La estrategia es la **de referencia del paso 9** (`my_open`), que hace lo mismo que el v5 del equipo, o la tuya si ya la terminaste.

El [capítulo 10](/learn/open-strategy/paso-10-el-coche-real/) explica cada pieza con más calma (instalar el Pi desde cero, el LiDAR en RViz, la cámara). Aquí está el camino corto, en orden.

> **Qué está probado y qué no** (1 de noviembre de 2026).
>
> - **Probado en simulación:** la estrategia de referencia completa las rondas del laboratorio y de Gazebo con el modelo del coche real.
> - **Medido en el coche, pero con el montaje anterior** (7 a 9 de octubre): el servo, la tabla de velocidad del motor, el LiDAR, la IMU y los colores de las líneas.
> - **Sin medir en el coche reconstruido:** los ejes de la IMU (la placa va de canto) y el servo (cambió de sitio y giró 90 grados). En `robot.yaml` los dos siguen marcados `measured: false`. **No conduzcas el coche hasta medirlos.**
> - **Sin probar en el coche:** la estrategia y los comandos de esta página con este montaje. Salen del código de robotek-learn, no de una ronda real.

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
| 3 | Servo: centro, signo y ángulo real | **sí** | `robot.yaml` → `base_adapter` |
| 4 | Motor: velocidad real por % | no, pero sin ella el coche va a otra velocidad que la simulación | `robot.yaml`, `real_car_v1.yaml`, `minisim.py` |
| 5 | LiDAR y cámara | no, pero la cámara decide el sentido | `robot.yaml` → `scan_adapter`; colores en `vision.py` |
| 6 | Primera ronda, despacio | — | el registro de la consola |
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
~/scripts/stop_ros.sh                       # 1. para el software del equipo, que arranca solo
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
ps -eo pid,args | grep -E "[r]rc_driver|[l]dlidar|[c]amera_publisher|[r]obotek_hardware|[m]y_open"
```

No debe salir nada. Si sale algo, mátalo (`kill <pid> <pid> ...`) y vuelve a mirar. Un nodo viejo vivo es la causa típica de un LiDAR que da *timeout* (dos lectores en el mismo puerto) o de un coche que se mueve solo.

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

`Ctrl+C` en cada terminal que lanzaste. Después repite la búsqueda de arriba: si queda algo, `kill`.

## 2. Los ejes de la IMU (bloquea)

**Antes de empezar,** siempre, la [preparación de la sección 1](#1-antes-de-cada-prueba-siempre). En el Pi:

```bash
~/scripts/stop_ros.sh
cd ~/robotek-learn && git pull && colcon build --symlink-install && source install/setup.bash
ps -eo pid,args | grep -E "[r]rc_driver|[l]dlidar|[c]amera_publisher|[r]obotek_hardware|[m]y_open"   # no debe salir nada
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
ps -eo pid,args | grep -E "[r]rc_driver|[l]dlidar|[c]amera_publisher|[r]obotek_hardware|[m]y_open"   # no debe salir nada
```

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

En tu ordenador, en robotek-learn:

| Archivo | Qué |
|---|---|
| `src/robotek_hardware/config/robot.yaml` (`base_adapter`) | `servo_center_us`, `servo_sign`, `wheel_table_servo_deg`, `wheel_table_left_deg`, `wheel_table_right_deg`, `wheel_limit_deg` (el menor de los máximos de los dos lados) y `servo_measured: true` |
| `src/robotek_course/robotek_course/minisim.py` | `STEER_LIMIT` = `wheel_limit_deg` en radianes. La estrategia lo usa como su tope de dirección y para calcular lo rápido que gira en las esquinas |
| `src/robotek_common/robotek_common/vehicle.py` | `REAL_STEER_LIMIT`, el mismo valor (lo usa el control con teclado) |
| `src/robotek_evaluation/config/real_car_v1.yaml` | `steer_limit`, el mismo valor, para que la simulación gire igual que el coche |

El URDF **no** se toca: su límite de 25 grados es el del servo, no el de la rueda.

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
ps -eo pid,args | grep -E "[r]rc_driver|[l]dlidar|[c]amera_publisher|[r]obotek_hardware|[m]y_open"   # no debe salir nada
```

La tabla de velocidad se midió con la batería casi vacía (7,0 a 7,4 V). Con la batería cargada el coche va más rápido que en la simulación, y los giros se disparan tarde. Mídela otra vez con la batería **cargada**.

Solo el nodo del motor, sin la estrategia (terminal 1):

```bash
ros2 topic echo /rrc/battery --once          # en mV: 8000 o más es una 2S cargada (con la placa en marcha)
ros2 run robotek_hardware motor_driver       # debe decir: TB6612FNG ready
```

1. **Con las ruedas en el aire**, el sentido. En la terminal 2, un 15 % durante 1 s (`timeout` corta solo; el motor se para 0,3 s después de la última orden):

   ```bash
   timeout 1 ros2 topic pub -r 20 /motor_vel std_msgs/msg/Float32 "{data: 15.0}"
   ```

   Las ruedas traseras deben girar **hacia delante**. Si giran hacia atrás, intercambia los cables del motor.

2. **En el suelo**, la velocidad. Coche en una recta larga, con una cinta métrica al lado. Para el 15, 20, 25 y 30 %, lanza el mismo comando de 1 s y mide cuánto avanzó. La velocidad real es esa distancia en un segundo (un poco menos que la de crucero, porque tarda 0,15 s en arrancar). Repite cada punto tres veces y vuelve el coche a mano a la salida.

Reglas del equipo para el motor: pulsos de **1 s como máximo y solo hasta el 30 %**; por encima, pulsos de **0,25 s**. Empieza bajo, sube poco a poco y **nunca al 100 %** desde parado (el coche se encabrita y pierde la dirección). Medir por encima del 30 % pide pulsos más largos: acuérdalo antes con el coach.

### Guardar

| Archivo | Qué |
|---|---|
| `robot.yaml` (`base_adapter`) | `motor_pct_per_mps` y `motor_min_pct` (la regla `% = motor_min_pct + motor_pct_per_mps × v`) y, cuando lo decidas, `motor_max_pct` |
| `real_car_v1.yaml` | `speed_table_cmd` y `speed_table_real` (velocidad pedida → velocidad real) |
| `src/robotek_course/robotek_course/minisim.py` | `SPEED_TABLE`, la misma tabla: la estrategia la usa (con `real_speed()`) para saber lo rápido que va de verdad en las esquinas |

`motor_max_pct` está en **50** desde un choque al 90 %. Con la calibración actual equivale a unos 0,6 m/s pedidos, aunque la estrategia pida 1,28 (`CRUISE_SPEED`). Para una prueba no hace falta tocar el archivo: el launch acepta `motor_max_pct:=30`.

### Si quieres pasar del 50 %

Subir `motor_max_pct` es cambiar un número, pero el coche no se comporta como el simulador si solo cambias eso. Esto es lo que hay que tener en cuenta.

**Qué se sabe del motor.** `base_adapter` convierte la velocidad pedida en porcentaje con `% = 6,5 + 73 × v`. Con esa regla, el 50 % son unos 0,6 m/s pedidos, el 70 % unos 0,87 y el 100 % 1,28, lo que pide la estrategia en las rectas (`CRUISE_SPEED`). Pero la regla y la tabla de velocidad real se midieron **solo hasta el 30 %** y **con la batería baja**. Por encima de eso no hay medidas: el punto del 100 % (0,60 m/s reales) se **dedujo**, no se midió. Con la batería cargada el coche puede ir bastante más rápido.

**El simulador ya supone el 100 %.** El modelo del coche y la estrategia (`SPEED_TABLE` de `minisim.py`) dan por hecho que pedir 1,28 da 0,60 m/s reales. En el coche, con el tope del 50 %, va más lento que eso. Si subes el tope sin medir, el coche puede ir más lento **o más rápido** que la simulación, y no lo sabrás hasta que choque.

**Qué cambia en la estrategia al ir más rápido.**

- **Las esquinas empiezan tarde.** Entre que la estrategia decide girar y que las ruedas llegan al tope pasan unos 0,3 s (retardo del servo más el recorrido hasta 17,6 grados). A 0,6 m/s son 18 cm; a 1 m/s, 30 cm. Hay que empezar antes: subir `TURN_FRONT` (`turn_gate.py`).
- **Se ve menos antes de girar.** El LiDAR da 10 escaneos por segundo y la estrategia pide ver el final de la isla en 2 seguidos (`CONFIRMATIONS`). A 0,6 m/s el coche avanza 12 cm entre esos dos escaneos; a 1 m/s, 20 cm. Puede hacer falta subir `LOOKAHEAD`.
- **La frenada es lenta.** `base_adapter` limita la deceleración a 0,6 m/s² para que las ruedas no patinen. Pasar de 1 m/s a 0,6 m/s cuesta unos 0,5 m. Afecta a la última esquina, la única antes de la cual frena la estrategia (`LAST_CORNER_SPEED`, `BRAKE_GAIN` y `BRAKE_MARGIN` en `my_open/mission.py`).
- **El arco se abre.** La velocidad de giro del arco sale de la velocidad real (`real_speed()` con `SPEED_TABLE`). Si la tabla no coincide con el coche, la estrategia calcula mal la rampa y el coche se sale de la línea o se mete hacia la isla.

**Qué cambia en el coche.**

- **Se encabrita.** A fondo desde parado, el coche levanta las ruedas delanteras y deja de girar. Por eso `accel_limit` limita la aceleración a 1 m/s²: no lo subas a la vez que el tope.
- **Patina.** El simulador no modela el patinaje. En las esquinas, a más velocidad, las ruedas resbalan y el radio real es mayor que el calculado.
- **La batería cae.** El motor tira más corriente y la tensión baja. En una prueba, con 6,5 V y el motor al 80 %, el Pi se reinició a mitad de ronda. Usa batería cargada y, mejor, la batería aparte para el motor.
- **Los golpes son más fuertes.** La estrategia no se recupera de un atasco: si choca a más velocidad, empuja contra el muro hasta que lo pares.

**Por encima de la tabla, la estrategia supone 0,60 m/s.** `SPEED_TABLE` llega hasta 1,28 pedidos. Para cualquier orden mayor, `real_speed()` devuelve su último punto (0,60 m/s): si el coche va más rápido, el arco se calcula como si fuera a 0,60 y se abre. Alarga la tabla con lo que midas.

**El orden para subir.**

1. **Mide la velocidad real con la batería cargada**, del 30 % al 70 %, en pulsos cortos y con espacio (sección anterior; acuérdalo con el coach). Repite cada punto.
2. **Pon la tabla nueva en los tres sitios:** `motor_pct_per_mps` y `motor_min_pct` en `robot.yaml`; `speed_table_cmd`, `speed_table_real` y `drive_command_limit` en `real_car_v1.yaml`; `SPEED_TABLE` en `minisim.py`. Si cambia la aceleración que aguanta el coche, también `accel_max` y `decel_max` del modelo.
3. **Prueba en simulación con la estrategia sin cambios**: el laboratorio (`open_lab`) y Gazebo (`round.launch.py`), como en el [capítulo 12](/learn/open-strategy/paso-12-afinar/). Así ves qué cambia solo por el coche.
4. **Reajusta en el laboratorio**, un parámetro cada vez: primero `TURN_FRONT`, luego `LOOKAHEAD` y `LAST_CORNER_SPEED` (con `--set`). Confirma en Gazebo.
5. **Sube el tope de 10 en 10:** 50 → 60 → 70, con `motor_max_pct:=60` al lanzar. En cada paso, primero una vuelta y luego la ronda completa. Registra cada intento, también los que fallan, con la batería y el tope que usaste.
6. **No pases de lo que mediste.** Si la tabla llega al 70 %, el tope no pasa del 70 %.

En el campo puntúa la ronda completa, no la vuelta más rápida: un coche al 50 % que termina las tres vueltas vale más que uno al 80 % que choca.

## 5. LiDAR y cámara

**Antes de empezar,** siempre, la [preparación de la sección 1](#1-antes-de-cada-prueba-siempre). En el Pi:

```bash
~/scripts/stop_ros.sh
cd ~/robotek-learn && git pull && colcon build --symlink-install && source install/setup.bash
ps -eo pid,args | grep -E "[r]rc_driver|[l]dlidar|[c]amera_publisher|[r]obotek_hardware|[m]y_open"   # no debe salir nada
```

La forma más simple de tener los tres sensores es el launch del coche: arranca la placa, el LiDAR y la cámara, y la estrategia **espera el botón** sin moverse. Con las ruedas en el aire:

```bash
ros2 launch robotek_course car.launch.py
```

Mira lo que ve desde tu ordenador con RViz, con el mismo `ROS_DOMAIN_ID`, como en el [capítulo 10](/learn/open-strategy/paso-10-el-coche-real/) (secciones 3.2 y 3.3). **Relanza RViz cada vez que relances el coche**: pierde la imagen de la cámara cuando su nodo se reinicia.

- **LiDAR.** Con el coche a 0,5 m de una pared plana, el rango de frente y a ±90 grados debe coincidir con la regla (±1 cm). La pared delante tiene que verse **delante**, y tu mano a la izquierda, a la izquierda. El LiDAR mira 110 grados a cada lado; más allá los rayos dan en el propio coche.
- **LiDAR que da *timeout* al arrancar.** En el coche del equipo, el LiDAR arrancado a la vez que la placa a veces da *timeout*. Si pasa, para todo (`Ctrl+C` y la búsqueda de nodos de la sección 1) y vuelve a lanzar.
- **Cámara.** La estrategia decide el sentido de la vuelta comparando la línea **azul** y la **naranja** del suelo, con los colores de `BLUE_HSV` y `ORANGE_HSV` en `src/robotek_course/robotek_course/vision.py`. **Esos colores son los del simulador.** En la sala del equipo, el 8 de octubre, la línea naranja se veía **casi roja** (tono H de 163 a 178, fuera del rango naranja del simulador, de 5 a 28) y la pared beige de la sala caía dentro del naranja. Comprueba con el coche en la sección de salida, en los dos sentidos, que la estrategia elige bien, y mide los colores con la luz de la sala como en el capítulo 10 (sección 3.2) si no lo hace.

## 6. La primera ronda

**Antes de empezar,** siempre, la [preparación de la sección 1](#1-antes-de-cada-prueba-siempre). En el Pi:

```bash
~/scripts/stop_ros.sh
cd ~/robotek-learn && git pull && colcon build --symlink-install && source install/setup.bash
ps -eo pid,args | grep -E "[r]rc_driver|[l]dlidar|[c]amera_publisher|[r]obotek_hardware|[m]y_open"   # no debe salir nada
```

### Antes

1. `robot.yaml` tiene `imu_adapter.measured: true` y `servo_measured: true`, y la prueba del giro a la izquierda dio positivo.
2. La estrategia está en `src/my_open` (la de referencia: `bash tools/get-reference.sh`, o la tuya copiada) y compilada.
3. Batería cargada (`ros2 topic echo /rrc/battery --once`).
4. Campo Open montado y el coche en la sección de salida.

### Lanzar

Para antes cualquier otro nodo de las pruebas: el launch abre la placa, el LiDAR y la cámara, y dos lectores en el mismo puerto dan *timeout*. Con el **tope del motor bajo** para empezar, y guardando la consola, que es tu registro:

```bash
mkdir -p ~/rondas-coche
ros2 launch robotek_course open_challenge.launch.py motor_max_pct:=30 2>&1 | tee ~/rondas-coche/ronda-01.log
```

`open_challenge.launch.py` es `car.launch.py` con la estrategia `my_open`. Arranca la placa, el LiDAR, la cámara, los adaptadores, el motor, el botón, las luces y la estrategia. Con 30 el coche va despacio, que es lo que quieres la primera vez. Las luces se ponen verdes cuando llegan los tres sensores. Relanza RViz en tu ordenador.

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

### Lo que la estrategia de referencia no hace en el coche

- **No se recupera de un atasco.** Si choca, se queda empujando: páralo con el botón.
- **No avanza mientras mira la cámara.** Si en 15 s no decide el sentido, se para con `DIRECTION_FAULT`.
- **Frena si un sensor se calla:** sin LiDAR durante 0,35 s o sin IMU durante 0,2 s, manda velocidad 0 hasta que vuelvan.

## 7. Después de la ronda

En el coche no hay juez ni posición real: el juez eres tú. Para cada intento, **también los fallidos**, guarda el archivo de la consola (`~/rondas-coche/ronda-NN.log`) y anota:

- la batería antes de la ronda, `motor_max_pct` y qué cambiaste desde el intento anterior (con el commit de robotek-learn: `git log -1 --oneline`);
- desde dónde salió (x, y y orientación) y en qué sentido;
- el tiempo desde el botón hasta `DONE`, con cronómetro (el estado se ve con `ros2 topic echo /robotek/state`);
- si tocó un muro o la isla, dónde se paró y qué viste.

Pasa los registros a tu ordenador (`scp <usuario>@<ip-del-pi>:rondas-coche/*.log .`) antes de apagar el coche.

## Resumen

1. **Siempre, antes de cada prueba,** en el Pi: `~/scripts/stop_ros.sh`; `cd ~/robotek-learn`; `git pull`; `colcon build --symlink-install`; `source install/setup.bash`; y comprobar que no queda ningún nodo de la prueba anterior.
2. **IMU:** `imu_axes` (quieto 3 s, un empujón) o a mano, eje por eje; copiar los ejes a `robot.yaml`, `measured: true`, y comprobar que girar a la izquierda da `z` positivo.
3. **Servo:** centro, signo y tabla de ángulos; `robot.yaml`, `STEER_LIMIT` (`minisim.py`) y `real_car_v1.yaml`.
4. **Motor:** tabla con la batería cargada en `robot.yaml`, `real_car_v1.yaml` y `SPEED_TABLE` (`minisim.py`).
5. **Sensores:** `car.launch.py`, el LiDAR contra una regla y la cámara eligiendo bien el sentido con la luz de la sala.
6. **Ronda:** `ros2 launch robotek_course open_challenge.launch.py motor_max_pct:=30`, luces verdes, K1.
7. **Registro:** el log de la consola y tus notas de cada intento.

Si algo falla, busca el síntoma en [Solución de problemas](/learn/open-strategy/paso-11-solucion-de-problemas/).
