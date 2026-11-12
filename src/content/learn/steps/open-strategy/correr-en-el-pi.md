---
guide: "open-strategy"
order: 9.7
slug: "correr-en-el-pi"
title: "Correr el Open en el Pi desde cero"
summary: "De un Raspberry Pi recién instalado a una ronda del Open en el coche: clonar, preparar con un script, comprobar y lanzar con un solo comando."
tag: "step-9"
compareFrom: "step-9"
---

Esta página es el camino corto: un Raspberry Pi con Ubuntu recién instalado, el coche del equipo ya armado, y al final una ronda del Open. Corre el **Open v5**, la estrategia del equipo (`src/robotek_open` en robotek-learn), que es la misma que construyes en los pasos 2 a 8 con los valores medidos en el coche.

> **Qué está probado y qué no** (12 de noviembre de 2026).
>
> - **Probado en el coche del equipo:** lanzar con `tools/car-run.sh open`, el botón, las luces y la ronda completa. El 11 de noviembre, con los engranajes 1:1, hizo rondas de 3 vueltas en 31 a 38 s en los dos sentidos y paró en la sección de salida.
> - **Comprobado en el Pi del equipo, no en uno recién instalado:** `tools/setup-pi.sh`. El Pi del coche se preparó a mano hace meses; el script instala lo mismo, pero nadie lo ha corrido todavía de principio a fin en una tarjeta nueva. Si un paso no coincide con lo que ves, tú tienes la razón: cuéntamelo.
> - **No lo instala el script:** `rpicam-vid`, el programa de la cámara del Pi (sección 3).

## 1. Lo que necesitas

- El coche armado y cableado ([Armar y conectar el coche](/learn/open-strategy/armar-y-conectar-el-coche/)): placa RRC Lite, LiDAR LD19, cámara, servo y motor.
- Un **Raspberry Pi 5** con **Ubuntu 24.04 de 64 bits**, en la misma red Wi-Fi que tu ordenador y con internet.
- La batería cargada: una 2S a 8 V o más.
- Un campo del Open, o al menos un pasillo con paredes, y **soportes** para dejar las ruedas en el aire la primera vez.

Las medidas de `robot.yaml` (los ejes de la IMU, el centro del servo, el sentido del motor) son las del coche del equipo. Si tu coche es otro, mídelas antes de la primera ronda: [El coche del equipo](/learn/open-strategy/coche-del-equipo-v5/), secciones 2 a 4.

## 2. Entrar al Pi y preparar todo

Desde tu ordenador:

```bash
ssh <usuario>@<ip-del-pi>
```

Ya dentro del Pi:

```bash
cd ~
git clone https://github.com/renzodamgo/robotek-learn.git
cd robotek-learn
bash tools/setup-pi.sh
```

El script pide la contraseña de `sudo` cuando hace falta y se puede repetir: lo que ya está hecho se lo salta. Hace cinco cosas:

1. Comprueba que el sistema es Ubuntu 24.04.
2. Instala ROS 2 Jazzy (sin Gazebo ni RViz) y los paquetes del coche, entre ellos Cyclone DDS, que es como el coche y tu ordenador se ven en la red.
3. Instala las reglas de udev: la placa queda siempre en `/dev/rrc_lite` y el LiDAR en `/dev/ldlidar`, aunque el USB se desconecte y vuelva.
4. Te añade a los grupos `dialout`, `video` y `gpio`.
5. Compila todo con `colcon build --symlink-install`. En un Pi tarda varios minutos.

Cuando termine, **cierra la sesión y vuelve a entrar** (los grupos nuevos solo cuentan en una sesión nueva) y comprueba:

```bash
cd ~/robotek-learn
bash tools/setup-pi.sh --check
```

No instala ni mueve nada. Cada línea dice `ok`, `FALTA` o `aviso`, y la última, cuántas quedan por resolver. Debe terminar en `0 por resolver`. Un `aviso` de que no hay paquete `my_open` es normal: ese es tu propio paquete del curso, y el Open del equipo no lo necesita.

> **Antes de cortar la corriente después de compilar:** `sync` o `sudo poweroff`. Un corte en mitad de la escritura deja archivos vacíos; al equipo le pasó con el ejecutable de la estrategia.

## 3. La cámara (se puede dejar para después)

La cámara solo sirve para una cosa: elegir el sentido de la vuelta antes de arrancar. El coche usa la cámara del Pi en el cable plano (IMX708) y la lee con `rpicam-vid`, de las herramientas de cámara de Raspberry Pi (`rpicam-apps`). En Ubuntu no vienen en un paquete: en el Pi del equipo están compiladas desde el código de Raspberry Pi, en `/usr/local/bin`.

```bash
which rpicam-vid          # debe imprimir una ruta
```

Si no imprime nada, **el Open corre igual**: sin cámara sale en sentido antihorario al segundo de calibrar (`direction_fallback: ccw`) y el LiDAR lo corrige antes de la primera esquina si el campo va al revés (paso 8). Empieza así y añade la cámara después.

## 4. Primero, con las ruedas en el aire

Pon el coche sobre soportes y lanza:

```bash
cd ~/robotek-learn
bash tools/car-run.sh open
```

El coche lleva engranajes 1:1 y `robot.yaml` ya trae su valor: `motor_rps_per_mps: 7.0`, las vueltas del motor por segundo por cada m/s del coche. No hay que pasar nada.

El comando hace todo lo demás solo:

- para el arranque automático y cualquier nodo que haya quedado de una prueba anterior (`tools/car-clean.sh`);
- pone la red que ve tu ordenador (Cyclone DDS, dominio 1);
- arranca la placa, el LiDAR, la cámara, el botón, las luces y la estrategia, con los valores del coche (`src/robotek_open/config/car_picam.yaml`).

Cuando la terminal escribe `READY` y los dos LED de la placa están en **verde**, el coche espera el botón:

| Los dos LED | Qué significa |
|---|---|
| apagados | arrancando |
| **verde** | listo: pulsa el botón |
| **azul** | pulsado: la ronda corre (o ya terminó) |
| rojo parpadeando | batería baja (menos de 6,8 V): cámbiala |

Son muy tenues a propósito, para no reflejarse en la cámara: míralos de cerca.

Pulsa el botón de la placa. Con las ruedas en el aire verás que calibra un instante, que el motor arranca y que la dirección se mueve. Pasados 5 s, **pulsa otra vez para pararlo**: durante los primeros 5 s el botón no hace nada, por si se pulsa dos veces sin querer. `Ctrl+C` en la terminal también para el motor.

Si el motor gira hacia atrás, la dirección no se centra o no pasa nada al pulsar, no bajes el coche al suelo: busca el síntoma en [Solución de problemas](/learn/open-strategy/paso-11-solucion-de-problemas/).

## 5. La ronda, en el suelo

1. Coloca el coche en la sección de salida, recto, mirando a lo largo del pasillo.
2. Lanza el mismo comando y espera el verde.
3. Una pulsación. No toques el coche hasta que pare.

```bash
bash tools/car-run.sh open
```

La terminal escribe un resumen de la ronda: cada cambio de estado con el tiempo desde Start (`CALIBRATE`, `DETECT_DIRECTION`, `FOLLOW`, `TURN`…), el tiempo de cada vuelta (`LAP 1`, `LAP 2`, `LAP 3`), `FINISH`, `DONE` con el tiempo total, y cualquier cosa rara (un nodo caído, la placa reiniciada, batería baja). Con `VERBOSE=1` delante del comando sale el registro entero.

Lo que hace el coche es lo que escribiste en el curso:

- sigue la pared de la isla a 0,50 m, o a 0,25 m de la pared exterior si el pasillo es estrecho;
- frena antes de cada esquina y gira con el volante a tope hasta 17 grados del rumbo nuevo;
- en cada recta, la pared de la isla corrige el rumbo del giroscopio;
- tras 12 esquinas avanza despacio hasta que la pared de enfrente está como en la salida, y para.

Para **otra ronda**, vuelve a lanzar el comando.

Si quieres ir más despacio la primera vez, cualquier valor se cambia al lanzar, sin editar archivos:

```bash
bash tools/car-run.sh open cruise_speed:=0.6 corner_speed:=0.5
```

## 6. Los valores del coche

Todos los parámetros del Open v5 en el coche. Los nombres de la estrategia son los de las constantes del curso, en
minúsculas.

**Cómo se cambian.** Los ocho marcados con ✓ se cambian al lanzar, sin editar nada:
`bash tools/car-run.sh open cruise_speed:=0.8 inner_gap:=0.45`. Para los demás, copia
`src/robotek_open/config/car_picam.yaml` entero, cambia lo que quieras y lánzalo con
`strategy_params:=<tu archivo>`: ese archivo **sustituye** a `car_picam.yaml`, no se suma. La columna «Código» es el
valor por defecto de `robotek_open/v5/mission.py` y `v5/settings.py`; «Coche» es el de `car_picam.yaml`, que
`car.launch` carga solo con la cámara IMX708 (vacío = el del código).

**La estrategia (la misión)**

| Parámetro | Código | Coche | Al lanzar | Qué hace |
|---|---:|---:|:-:|---|
| `cruise_speed` | 1,28 | 0,85 m/s | ✓ | velocidad en las rectas |
| `corner_speed` | 1,0 | 0,64 m/s | ✓ | velocidad en las 12 esquinas; frena hasta ella al acercarse |
| `brake_margin` | 0,15 | 0,35 m | ✓ | cuánto antes de `turn_front_distance` ya va a la velocidad de esquina (más = frena antes) |
| `inner_gap` | 0,25 | 0,50 m | ✓ | distancia a la isla en las rectas (en un pasillo estrecho guarda 0,25 m a la pared exterior) |
| `lateral_kp` | 0,3 | 1,0 | ✓ | cuánto corrige la distancia a la isla (rad por m de error, como mucho 0,4 rad) |
| `turn_tolerance` | 0,30 | 0,30 rad | ✓ | el arco termina a esta distancia de los 90°; más = esquina más corta |
| `corner_lookahead` | 0,35 | 0,35 m | ✓ | el final de la isla así de cerca (o un lado abierto) empieza la esquina |
| `turn_front_distance` | 1,19 | | | pared de enfrente (a lo largo de la pista) desde la que puede empezar una esquina |
| `wall_heading_gain` | 0,0 | 0,3 | | parte de la diferencia entre el giroscopio y la pared de la isla que corrige en cada escaneo (el giroscopio del coche lee un 6 % de menos) |
| `finish_speed` | 0,15 | 0,32 m/s | | velocidad del último tramo |
| `finish_lead` | 0,08 | 0,14 m | | frena cuando la pared de enfrente está así de cerca de la que había en la salida |
| `direction` | `auto` | | | `ccw`, `cw` o `auto` (lo decide la cámara) |
| `direction_fallback` | (vacío) | `ccw` | | sentido si la cámara no decide al segundo de calibrar; el LiDAR lo corrige antes de la primera esquina. Vacío = espera y se para |
| `laps` | 3 | | | vueltas (menos solo para pruebas en el coche) |

**El nodo**

| Parámetro | Código | Coche | Al lanzar | Qué hace |
|---|---:|---:|:-:|---|
| `scan_max_age` | 0,35 | 1,0 s | | un LiDAR más viejo que esto frena el coche hasta que vuelva |
| `imu_max_age` | 0,2 s | | | lo mismo con el giroscopio |
| `detect_crash` | `false` | `false` | ✓ | detector de choques: para el coche, reinicia la placa y guarda los últimos 5 s en `crash-<hora>.json` |
| `crash_window_s` | 5,0 s | | | segundos que guarda el detector |
| `crash_min_rays` / `crash_clear_rays` | 120 / 180 | | | un choque = escaneos con menos de 120 rayos válidos durante `crash_blind_s` (hasta uno con 180) |
| `crash_blind_s` | 0,4 s | | | |
| `crash_gyro_jump` | 3,0 rad/s | | | o un salto del giroscopio así en 0,1 s (0 = no) |
| `telemetry_path` | `auto` | | | `auto` = `~/runs/<fecha>-<hora>-open-v5/telemetry.csv`; vacío = sin telemetría |
| `telemetry_sync_seconds` | 0,5 s | | | cada cuánto se escribe al disco (por si se corta la batería) |
| `auto_start` | `false` | | | `true` = sale solo, sin el botón |
| `shutdown_on_done` / `done_hold` | `false` / 35 s | | | apagar el nodo al terminar, y cuánto espera antes |

**La cámara** (colores en HSV de OpenCV; si `h_min` es mayor que `h_max`, el rango pasa por el rojo)

| Parámetro | Código | Coche | Qué hace |
|---|---:|---:|---|
| `vision_blue_h_min` / `h_max` / `s_min` / `v_min` | 100 / 135 / 80 / 25 | 95 / 135 / 60 / 60 | la línea azul |
| `vision_orange_h_min` / `h_max` / `s_min` / `v_min` | 158 / 4 / 60 / 40 | 2 / 25 / 60 / 60 | la línea naranja |
| `vision_wall_v_max` | 40 | 70 | más oscuro que esto es pared negra |
| `vision_wall_min_rows` | 8 | | filas de pared que hacen falta para recortar por ella |
| `vision_floor_mask` | `true` | | mira solo el suelo, dentro de las paredes |
| `vision_line_contrast` / `vision_line_tint` | 0 / 8 | 30 / 8 | cuánto tiene que destacar la línea del tapete |
| `direction_confirmations` | 3 | | imágenes seguidas de acuerdo para elegir el sentido |

**El launch del coche** (`car.launch.py`; todos se pasan igual: `nombre:=valor`)

| Argumento | Para el Open | Qué hace |
|---|---|---|
| `motor_rps_per_mps` | 7,0 (`robot.yaml`) | vueltas del motor por m/s; con los engranajes 1:1, 8,0 va un poco más rápido |
| `motor_max_rps` | 6,7 (`auto`) | tope del motor |
| `motor_min_rps` | 0 | mínimo mientras el coche se mueve (0 = sin mínimo) |
| `button` / `start_delay` | `true` / 12 s | `button:=false` arranca solo a los `start_delay` s; entonces la primera pulsación es el Stop |
| `board_button` | `false` | también el botón de la RRC Lite (el del equipo es el GPIO 16) |
| `camera_always` | `false` | `true` deja la cámara encendida toda la ronda (para verla en RViz); si no, se apaga al decidir el sentido |
| `picam_jpeg_quality` | 30 (`auto`) | calidad del JPEG que ve RViz por Wi-Fi |
| `done_reset` | `DONE,CRASH` (`auto`) | estados en que se reinicia la placa para que el motor pare del todo |
| `battery_guard` / `battery_min_v` | `true` / 6,8 V | aviso de batería baja (luz roja) |
| `strategy_params` | `car_picam.yaml` (`auto`) | el archivo de valores; otro lo sustituye |
| `debug` | `false` | `true` añade el `round_reporter` (ve líneas, giros y tiempos) |

En el coche los m/s son reales: la placa mantiene la velocidad pedida con el encoder del motor. En el simulador del
curso, 1,28 pedidos son 0,60 m/s reales.

## 7. Dónde queda la ronda

Cada ronda se guarda sola en el Pi, en `~/runs/<fecha>-<hora>-open-v5/`:

- `telemetry.csv`: varias veces por segundo, el estado, las distancias del LiDAR, el rumbo y lo que mandó la estrategia;
- `events.jsonl`: el Start y la parada, con su hora;
- los escaneos del LiDAR, comprimidos.

Pásala a tu ordenador antes de apagar el coche:

```bash
scp -r <usuario>@<ip-del-pi>:runs/<carpeta> .
```

En el coche no hay juez: el juez eres tú. Anota de cada intento, también de los fallidos, la batería, desde dónde salió y en qué sentido, el tiempo hasta `DONE` y si tocó algo.

## 8. Las veces siguientes

Antes de cada sesión de pruebas, baja el código nuevo:

```bash
cd ~/robotek-learn
git pull
colcon build --symlink-install
```

Y lanza como en la sección 5. En el Pi **solo se hace `git pull`**: los cambios se hacen en el ordenador y se suben a GitHub. Si editas en el Pi, el siguiente `git pull` choca.

## 9. Que arranque solo al encender

Para competir o para muchas rondas seguidas, el Open puede cargarse solo cada vez que se enciende el Pi y esperar el botón:

```bash
bash tools/car-autostart.sh on     # desde ahora, en cada encendido
bash tools/car-autostart.sh start                         # ahora, sin reiniciar
bash tools/car-autostart.sh stop                          # pararlo
bash tools/car-autostart.sh off                           # que no arranque más al encender
```

Después de cada ronda hay que relanzarlo (`stop` y `start`, o reiniciar el Pi).

> **Nunca las dos cosas a la vez.** El 11 de noviembre el arranque automático seguía vivo mientras se lanzaba otra estrategia a mano: dos programas mandaban órdenes al motor y dos leían el mismo LiDAR, y el coche no se movió en toda la ronda. `car-run.sh` para el arranque automático antes de lanzar; si lanzas de otra manera, `bash tools/car-autostart.sh stop` primero.

## 10. Verlo desde tu ordenador (opcional)

Con ROS 2 Jazzy y Cyclone DDS en tu ordenador, en la misma red Wi-Fi:

```bash
export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp ROS_DOMAIN_ID=1
ros2 topic echo /robotek/state        # el estado de la estrategia
rviz2                                 # /robotek/scan para el LiDAR
```

Para ver la cámara durante toda la ronda (normalmente se apaga al elegir el sentido), lanza con `camera_always:=true`.

## Si algo falla

| Qué ves | Dónde mirar |
|---|---|
| `setup-pi.sh --check` dice `FALTA` | la propia línea dice qué instalar o conectar |
| No llega al verde | [caso 1](/learn/open-strategy/paso-11-solucion-de-problemas/#caso-1-no-pasa-nada-al-pulsar-el-botón) de Solución de problemas |
| El motor no gira | pruébalo solo, sin estrategia: [mover el motor a mano](/learn/open-strategy/paso-11-solucion-de-problemas/#mover-el-motor-a-mano-la-primera-prueba) |
| Va más lento o más rápido de lo pedido | `motor_rps_per_mps` en `robot.yaml` (7,0): [caso 8](/learn/open-strategy/paso-11-solucion-de-problemas/#caso-8-el-motor) |
| Gira al revés o da círculos | los ejes de la IMU: [El coche del equipo](/learn/open-strategy/coche-del-equipo-v5/), sección 2 |
| El LiDAR da *timeout* o el coche no se mueve | quedó otro programa corriendo: `bash tools/car-clean.sh` y la nota de la sección 9 |
| Choca en una esquina | [Solución de problemas](/learn/open-strategy/paso-11-solucion-de-problemas/), casos 6 y 14 |

## Resumen

1. Una vez: `git clone`, `bash tools/setup-pi.sh`, cerrar sesión y `bash tools/setup-pi.sh --check`.
2. Cada sesión: `git pull` y `colcon build --symlink-install`.
3. Cada ronda: `bash tools/car-run.sh open`, esperar el verde, una pulsación.
4. La primera vez, con las ruedas en el aire.
5. La ronda queda en `~/runs/`.
