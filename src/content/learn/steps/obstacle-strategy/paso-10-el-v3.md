---
guide: "obstacle-strategy"
order: 10
slug: "paso-10-el-v3"
title: "El v3: lo que aprendimos del top 3"
summary: "Lo que cambió en la estrategia del equipo después del curso: un aparcamiento de lazo cerrado, las ideas de los tres primeros de la final de 2025 probadas una a una, el v3, que pasa de 5 a 8 rondas válidas de 10 en Gazebo, su primera ronda completa en el coche real y, el 9 de noviembre, una ronda completa saliendo del aparcamiento con recuperación frontal."
tag: "obstacle-step-9"
compareFrom: "obstacle-step-9"
---

El curso termina en el paso 9 con la referencia del equipo tal como estaba el 25 de octubre de 2026. La estrategia siguió mejorando. Este paso cuenta qué cambió y por qué, con los números que lo decidieron. No hay código que escribir: es el cuaderno de laboratorio del equipo, para que veas cómo se elige entre ideas y puedas probar las mismas en tu solución.

## Lo que vas a ver

Gazebo, con el coche medido (`real_car:=true`), las 10 rondas del set de prueba **con aparcamiento** (campos 0 a 4, los dos sentidos):

| Versión | Rondas válidas (55 pts) | Puntos de media |
|---|---:|---:|
| v2 (la referencia del curso, con el aparcamiento nuevo) | 5 de 10 | 34,8 |
| **v3** | **8 de 10** | **45,0** |

## Qué cambió desde el curso

### El aparcamiento, de lazo cerrado

El paso 8 planifica con A\* y, si el coche no queda dentro, vuelve a planificar desde donde quedó. En Gazebo esa búsqueda llegó a bloquear el bucle unos 10 s y el coche no terminaba de aparcar en 180 s. Además era caótica: un cambio de 10⁻¹⁸ m en el estado cambiaba el resultado de 4 rondas de 20.

La referencia del equipo mantiene el plan calculado antes de la ronda, pero ya **no busca durante la ronda**. Cada maniobra termina en un **objetivo absoluto** del plan, no tras una longitud:

- un arco termina en el **rumbo** planificado (giroscopio);
- la recta inclinada de entrada termina en la **profundidad** planificada (distancia al muro con el LiDAR);
- las demás rectas terminan en su **punto** a lo largo.

Así los errores no se suman de una maniobra a la siguiente. Después del plan, el coche se endereza (adelante y atrás a fondo, hacia paralelo) y se centra en el hueco. Encima de eso, cinco detalles medidos:

| Detalle | Por qué |
|---|---|
| Una recta hasta la pose de plan antes de empezar | la aproximación se pasaba unos 2,5 cm y todo el plan empezaba corrido |
| Si llega torcido, retrocede 0,5 m y vuelve a aproximarse | a veces llegaba a 15° y 6 cm de la línea |
| La inercia tras parar se **mide** y, si se quedó corto, sigue | en el lab el coche no rueda los 12 mm supuestos; en Gazebo sí |
| El servo gira **antes** de moverse: 3 mm/s | con velocidad 0 el ángulo no viaja en el `Twist` y el coche y el lab se quedan con el anterior; 3 mm/s basta para mandar el ángulo y no mueve el motor (zona muerta de 5 mm/s) |
| En los arcos, la distancia sale del giroscopio: \|Δrumbo\| × batalla / tan(dirección) | dentro del hueco el LiDAR solo ve líneas a lo largo y pierde el avance: en CW la posición se iba hasta 5 cm |

Con aparcamiento, campos 0–9 × 2 sentidos × 5 semillas (100 rondas) en el laboratorio:

| Versión | Aparcados del todo (55 pts) | Sin aparcar a tiempo | Tocan un tope |
|---|---:|---:|---:|
| A\* (paso 8) | 29 | 29 | 5 |
| Lazo cerrado | 57 | 0 | 6 |
| + servo parado y distancia por giroscopio | **70** | 0 | **2** |

### Un laboratorio más fiel y más rápido

- **La cámara ya no ve a través de las cosas.** La cámara del coche está a 14,2 cm y los pilares miden 10 cm, así que ve por encima de un pilar cercano. El laboratorio ahora lanza rayos 3D a la cara de cada pilar y solo da su color si la parte visible pasaría el filtro de la detección (más alta que ancha, al menos 8 px).
- **La odometría LiDAR, 5,6 veces más rápida y con los mismos bits.** Era el 55 % del tiempo de una ronda. Ahora 100 rondas tardan unos 50 s.
- **El coche corregido.** Ejes, vía y batalla salen del modelo CAD del coche del equipo (batalla 118,83 mm).

## Lo que hicieron los tres primeros de 2025

En la final internacional de Singapur los tres sacaron la puntuación máxima en Open y en Obstacle. El orden lo decidieron la documentación y el tiempo.

| Puesto | Equipo | Cómo se ubica | Ideas |
|---|---|---|---|
| 1 | Double-X (Canadá) | Solo cámara y un motor paso a paso (distancia sin encoder); sigue el muro en la imagen | Reacciona a lo que ve: apunta a un punto del suelo junto al pilar; prioridades de seguridad; acelera entre pilares |
| 2 | KMIDS GFM (Tailandia) | LiDAR + IMU + encoders + cámara | Un pilar solo entra en el mapa tras 3 lecturas iguales; distancia al muro exterior con 4 objetivos; +50 % de velocidad desde la vuelta 2 |
| 3 | STORMS NGR (Hungría) | LiDAR + giroscopio + encoders + cámara | Dos carriles; la primera vuelta es de detección y las curvas terminan en el centro; después, curvas de un solo arco; despacio donde importa la precisión |

Los repositorios están enlazados desde la lista oficial de la WRO: [World-Robot-Olympiad-Association/fe-2025-links](https://github.com/World-Robot-Olympiad-Association/fe-2025-links).

## Probar cada idea

### El método

1. El v3 empezó como una **copia exacta** del v2: mismas rondas, una a una.
2. Cada idea entró como un **parámetro apagado** y se probó sola.
3. Se decide con el set **con aparcamiento**, que es como es la competición: campos 0–49 × 2 sentidos × 2 semillas, 200 rondas en unos 2 minutos.
4. Lo que mejora se confirma con **semillas nuevas**. Con 10 campos y una semilla, varios cambios parecían mejoras y eran ruido.
5. Primero puntos, después tiempo, y Gazebo decide.

### Los resultados

| Idea (de quién) | Resultado en el laboratorio | Veredicto |
|---|---|---|
| Más velocidad desde la vuelta 2 (KMIDS, STORMS) | ahorra 2–4 s y pierde de 4 a 25 rondas | no |
| Dos carriles fijos (STORMS, KMIDS) | pierde de 26 a 41 rondas de 300 | no |
| Guarda de contacto con el escaneo (Double-X) | no se dispara nunca: el LiDAR ve ±110° y nada a menos de 16 cm, y los roces son en los laterales | no se puede copiar |
| La misma guarda con el mapa y la pose | 126 de 200 (antes 145): retroceder a mitad de curva desordena | no |
| Curvar a 0,30 m/s (con y sin anticipación) | 121–140 de 200 | no |
| **Puntuar las líneas de esquina por el recorrido simulado** | 149 de 200, menos toques | **sí** |
| **Ir a 0,15 m/s en las esquinas estrechas** (STORMS) | combinado con lo anterior, 156 de 200 | **sí** |

### El hallazgo que cambió el enfoque

Al medir dónde se iba el tiempo, la velocidad de crucero casi no aparecía. En una ronda de unos 100 s, el coche iba **45 a 88 s** a 0,2 m/s porque tenía algo a menos de 0,7 m delante: el muro de cada curva, o el próximo pilar. A velocidad de crucero iba menos de 2 s. Por eso subir la velocidad no ahorraba nada. Para ir más rápido hay que curvar más rápido, y el seguidor de la línea todavía no aguanta 0,30 m/s en curva.

### Esquinas que el coche puede seguir

Los fallos de las vueltas son deterministas (las dos semillas fallan igual) y 3 de cada 4 son en sentido horario. El caso típico es una esquina con un pilar interior al entrar y uno exterior al salir, o una rampa corta antes del arco. La línea dibujada tiene 4,7 cm de margen, pero la que el coche recorre lo toca: bajar 10 cm en 20 cm pide unos 10 m⁻¹ de curvatura y el coche da 2,7.

El v3 elige cada esquina por el margen del **recorrido simulado**. Las mejores líneas sobre el papel pasan por una copia del seguidor de la misión, con el retardo y la velocidad del servo reales. Esa simulación cuesta 20–70 ms y, en la Raspberry, sería varias veces más. Como sus entradas son discretas (pilares a ±0,1 m, tres estados de color, el hueco o no), se calcula antes: una tabla de 1083 esquinas que el coche solo consulta.

## Los resultados del v3

El v3 es el v2 con tres cambios: las esquinas por el recorrido simulado, 0,15 m/s en las esquinas planificadas con menos de 7 cm de margen, y el tope de «algo delante» solo a menos de 0,55 m.

| Dónde | Prueba | v2 | v3 |
|---|---|---|---|
| Gazebo | Set de prueba con aparcamiento (10 rondas) | 5 válidas, 34,8 pts | **8 válidas, 45,0 pts** |
| Laboratorio | Con aparcamiento, campos 0–49 × 2 × 2 semillas nuevas | 149 de 200, 44,8 pts | **155 de 200, 45,6 pts** |
| Laboratorio | Sin aparcamiento, campos 0–49 × 2 × 3 semillas | **265 de 300** | 261 de 300 |

Una variante con 0,5 pts más en el laboratorio se quedó fuera: 36 de sus rondas válidas pasaban de 160 s, y en Gazebo, más lento, una se quedó sin tiempo antes de terminar de aparcar.

## En el coche real

El 8 de noviembre de 2026 el v3 hizo su **primera ronda completa en el coche**. Llegó a DONE a los 118,7 s del Start, con tres vueltas y la parada, y más tarde otra en ~138 s. No había juez, así que no hay puntuación medida. Llegar hasta ahí costó más por el coche que por la estrategia.

### Cómo se lanza

En la Raspberry, con `robotek-learn` al día:

```bash
bash tools/car-autostart.sh stop && bash tools/car-clean.sh      # el arranque automático del Open tiene la placa ocupada
ros2 launch robotek_course car.launch.py strategy:=robotek_obstacle_v3 camera_driver:=picam motor_max_rps:=4 \
    strategy_params:=$HOME/.config/robotek/obstacle_v3_car_picam.yaml
```

- **Start:** el botón de la placa da el Start y otra pulsación lo para.
- **Sin botón:** `button:=false start_delay:=20`. La estrategia tarda 13–17 s en estar lista; con los 12 s por defecto, el Start llega antes y se queda en `WAIT_START`.
- **Dónde ponerlo:** centrado en el carril y a ~1,55–1,60 m de la pared de delante. Con un pilar en la recta sale con todo el giro, y desde 0,4–0,5 m más atrás va más rápido y choca.
- **Giro:** el archivo del coche limita el giro a 17,5° (`steer_limit: 0.3054`), un poco menos que los 17,6° del lab, para no forzar el servo contra su tope.
 Para ver qué detecta, el nodo publica la imagen con los pilares marcados (`/obstacle/debug_image/compressed`) y las señales en RViz (`/obstacle/signs`), solo mientras alguien las mira y como mucho a 5 Hz: a 25 fps dejaban a la estrategia sin cámara.

### La cámara nueva

- **Qué cambió:** el coche lleva ahora una IMX708 Wide en el cable plano, no la USB de la simulación.
- **Geometría:** se midió con tres pilares a ~0,9 m comparados con los grupos del LiDAR. Da ~102° de campo (1,78 rad), 0,14 rad de inclinación y 3,1° de giro a la izquierda, con un error de 0,8°.
- **Colores:** también cambian: el rojo de un pilar sale con H ≈ 177 y el verde con H ≈ 55.
- **Con la geometría de antes:** no veía un pilar rojo y emparejaba un verde con un objeto a 2,1 m.
- **Dónde va:** todo está en `obstacle_v3_car_picam.yaml`, que el nodo lee como parámetros.

### El motor que no podía ir despacio

El v3 pide 0,15–0,30 m/s. Las primeras rondas en el coche fallaban de dos maneras: o el coche no arrancaba, o salía disparado a ~0,4–0,75 m/s y se pasaba en los cambios de carril.

- **El lab no lo veía:** con la velocidad real puesta en el perfil del coche real, pasó de 191 a 101 rondas válidas de 200, y ningún ajuste de dirección lo arreglaba.
- **La causa:** se le mandaba a la placa RRC Lite el **tipo de motor 2**. El firmware de Hiwonder (su código está publicado) tiene para ese motor ganancias PID **negativas**, y el encoder de nuestro motor cuenta al revés que el suyo. El control de velocidad empujaba en el sentido equivocado: potencia al máximo con cualquier consigna, el coche no paraba con 0 y a veces iba hacia atrás.
- **El arreglo:** **no mandar el tipo** (`motor_type: -1`), como hace el MentorPi de Hiwonder. Ahora el coche sigue la velocidad desde ~0,02 m/s, en los dos sentidos, y para con un 0.
- **Lo que quedó:** el freno por reinicio de la placa ya no hace falta. La velocidad mínima casi tampoco: en marcha basta, pero con la dirección a tope y desde parado el motor necesita ~1 rps (~0,23 m/s) para arrancar.

### Otros ajustes para el Obstacle

- **Sin el freno de pared** del adaptador (`wall_stop_m: 0`). Frenaba en cuanto el LiDAR veía algo a menos de 0,30 m delante, lo que en el Obstacle pasa todo el rato junto a pilares y paredes. El coche acababa parado. Gazebo nunca lo tuvo.
- **Engranajes.** Con el grande en el motor (54:30), al motor le falta fuerza a 0,15–0,20 m/s, sobre todo con la dirección a tope. Con el pequeño en el motor (30:54) hay 3,24 veces más fuerza y la máxima baja a ~0,65 m/s, de sobra para el Obstacle. El Open va mejor con 54:30.

### Lo que el coche real enseñó de la estrategia

- **La salida con un pilar en la recta.** Con un pilar a ~1 m, el plan pide pasar 0,30 m al lado de la isla ya desde donde está el coche, sin rampa. La dirección se va a tope y el coche llega a la línea con ~57° de rumbo. Al enderezarse se pasa ~17 cm y toca la isla.
  - Se vio pasando la grabación por la estrategia en el Mac, con la misma dirección que el coche, y el lab lo reproduce con la velocidad real.
  - Los arreglos candidatos son limitar el ángulo con que se busca la línea o empezar el plan desde el carril real.
- **A veces la dirección no gira.** En algunas curvas el servo recibe todo el giro y el coche sigue recto. Pasó en rondas del Open.
  - Durante el fallo, la CPU y las frecuencias del Pi son normales, y el servo responde con el coche quieto.
  - Está sin resolver.
- **La placa se reinicia sola** cuando el coche se queda atascado empujando.

### El aparcamiento en el coche

`car.launch.py` no tiene un argumento `parking`: se activa en el archivo de parámetros (`parking: true`). Con
`lot_laps: 0`, las vueltas son las de una ronda sin aparcamiento y el lote solo se usa al final; con `park_after: 0`
aparca nada más arrancar, para probar solo la maniobra.

- **Las vueltas salen:** dos rondas con el aparcamiento activo dieron las tres vueltas en 90 y 115 s y pasaron a aparcar.
- **El aparcamiento del curso no:** pide 0,06 m/s con todo el giro, y con 54:30 el motor no mueve el coche. Tampoco con
  pulsos de 0,66–1 rps.
- **Más rápido tampoco:** con un mínimo de 1,1–1,3 rps sí hace las maniobras, pero sus ~14 movimientos de 3 cm se pasan, y
  se atasca contra un tope por detrás.
- **Lo que se prueba ahora:** un **aparcamiento fijo** (`park_mode: 1`): colocarse pasado el tope del fondo, marcha atrás
  a tope hasta un ángulo del giroscopio, marcha atrás recta hasta el tope (LiDAR), enderezar y centrarse. Son pocos
  pasos, cada uno cerrado con un sensor. En el lab con el coche real aparca 195 de 200 veces, frente a 35 del planificado.
- **Falta en el coche:** probarlo y medir el lote del campo: largo, fondo y posición (`park_lot_length`,
  `park_lot_depth`, `park_lot_end`).

## En el coche real, 9 de noviembre: salir del aparcamiento

El 9 de noviembre el v3 aprendió a **empezar dentro del aparcamiento**, como pide la regla de la salida (+7). Dio una
**ronda completa** saliendo del hueco: llegó a DONE con las tres vueltas. No había juez, así que no hay puntos medidos.

### Cómo se lanza

```bash
cd ~/robotek-learn && bash tools/car-clean.sh && source install/setup.bash
export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp ROS_DOMAIN_ID=1 ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET
ros2 launch robotek_course car.launch.py strategy:=robotek_obstacle_v3 camera_driver:=picam start_lot:=true
```

- **Dónde ponerlo:** dentro del hueco, pegado al muro exterior y a ~1 cm del tope de atrás, mirando en el sentido de la
  vuelta.
- **Luces:** verde parpadeando mientras espera; azul en cuanto pulsas y la ronda empieza.
- **Start:** el pulsador nuevo del GPIO 16 del Pi o el botón de la placa. Sin botón: `button:=false` (arranca a los
  20 s).
- **Siempre `car-clean` antes:** los nodos que quedan de otra prueba mandan órdenes al mismo motor.
- **Todos los parámetros**, con su valor y qué hacen: [PARAMETROS.md](https://github.com/renzodamgo/robotek-learn/blob/main/src/robotek_obstacle_v3/PARAMETROS.md).

### 1. La dirección, con el LiDAR

Dentro del hueco, el muro exterior está pegado a un costado. El LiDAR mira a los dos lados: el lado con el muro cerca
(o sin nada, porque no ve a menos de 12 cm) es el del muro.

- Muro a la **derecha** → **antihorario**.
- Muro a la **izquierda** → **horario**, y todo lo que sigue va en espejo.

### 2. Salir con pulsos

Un solo arco con todo el giro no sale: con el coche de 24,5 cm en un hueco de 36,75 cm, la esquina delantera del lado
del muro toca el tope de delante a los ~11 cm. Hay que maniobrar adelante y atrás, como un aparcamiento en paralelo al
revés.

La salida es una lista de pulsos, `lot_exit_steps`. Cada pulso es `<lado><sentido><segundos>`:

| Letra | Significa |
|---|---|
| `L` / `R` | todo el giro a la izquierda (lejos del muro) / a la derecha |
| `C` | ruedas al centro |
| `+` / `-` | adelante / atrás |

La que dio la ronda completa, a 0,9 m/s (`lot_exit_speed`):

```
L+0.45 R-0.55 L+0.45 R-0.55 L+0.45 R-0.55 L+0.78 C-0.4
```

Cada pulso gira el coche unos grados más hacia fuera: 3° → 11° → 17° → 23° → 27° → 33° → 41°… Después, ruedas al
centro; el LiDAR ubica el coche y empiezan las vueltas.

Lo que se aprendió por el camino:

- **El motor no se arrastra despacio.** A 0,12–0,25 m/s casi no se movía, y menos con la batería baja (6,7 V). Durante la
  salida el adaptador da un golpe de arranque y pulsos de 1,8 rps (`low_speed_states`).
- **Sin rampas.** Las rampas de aceleración y frenado del adaptador se comían los pulsos cortos: uno de 0,3 s apenas
  llegaba a la velocidad pedida. En la salida el pulso arranca de golpe y frena a 0 en seco (`no_ramp_states`).
- **Las ruedas giran antes de moverse.** La orden es una velocidad y una curvatura; con velocidad 0 el ángulo del servo
  no se puede mandar. Antes de cada pulso se manda una velocidad diminuta, por debajo de lo que mueve el motor.
- **El último paso cuenta.** Con `C-0.6` (recto atrás) al final, en una prueba el coche volvió a meterse en el hueco.
- **El sensor de atrás** frena en seco en los pasos hacia atrás a menos de 20 mm, pero mira solo hacia atrás: no ve el
  muro de al lado cuando la trasera se abre hacia él.

### 3. La recuperación frontal

En las vueltas, a veces el coche esquiva un pilar sin giro suficiente y se va contra él o contra una pared. Ahora, si va
a chocar de frente, se recupera:

1. **Detecta:** con el giro que lleva, proyecta el coche **18 cm a lo largo de su curva**. Si algo de lo que hay
   **delante del morro** cae en ese camino, salta. Si está girando y lo va a esquivar, no salta. Tampoco los costados:
   un pilar que pasa de cerca al lado ya no la dispara.
2. **Frena en seco** (`/robotek/estop`, sin la rampa de frenado): con rampa el coche todavía tocaba.
3. **Marcha atrás** con todo el giro, **a la derecha en antihorario y a la izquierda en horario**, durante
   `recover_back` segundos (0,5). El lado sale del sentido de la vuelta, no del rumbo calculado.
4. **Si se repite** en el mismo sitio (a menos de 0,3 m y 8 s), retrocede 0,6 s más cada vez, hasta 3: así el seguidor
   de línea tiene sitio para rodear el obstáculo. Sin esto, una vez saltó 168 veces seguidas delante del tope del
   aparcamiento.

Antes de implementarla se dibujó con el modelo del coche: con un tiempo fijo y el giro hacia paralelo, de 35° pasaba a
−11°.

### El sensor de distancia trasero

Un VL53L0X en la parte de atrás, en el I2C del Pi (`/robotek/rear_range_mm`).

- **Sin arrancarlo bien mide mal:** con solo los registros de fábrica marcaba 218 mm a 10 cm. El nodo hace el arranque
  completo (los ajustes de ST y la calibración, como la librería de Pololu).
- **Aun así mide de más y no en proporción**, y muy cerca casi no cambia. Se corrige con una tabla medida contra una pared
  con regla:

| Real (mm) | 10 | 20 | 30 | 40 | 50 | 85 | 170 | 420 |
|---|---|---|---|---|---|---|---|---|
| Crudo (mm) | 70 | 75 | 77 | 83 | 96 | 138 | 231 | 476 |

  Desde 5 cm acierta a ±5 mm; entre 1 y 4 cm, a ±1 cm.
- **Se cae del I2C** con el cable flojo, y una vez se quedó en otra página de registros aunque el Pi estaba apagado (el
  sensor seguía con corriente). El nodo vuelve a seleccionar la página y se reinicia solo.

### Otras cosas que enseñó el coche

- **La batería manda.** Con 6,7–6,9 V los pulsos casi no movían el coche, y en una prueba bajó de 6,26 a 5,1 V
  esperando y el Pi se apagó.
- **El motor se bloquea tras chocar.** Si el coche empuja contra una pared, la placa deja de mover el motor hasta
  reiniciar su driver (`car-clean` y volver a lanzar).
- **La cámara llegaba tarde.** 0,35–0,43 s de retraso, 48 veces en una ronda, y cada vez el coche paraba
  (`WAIT_SENSOR`). Ahora la cámara puede tener hasta 0,8 s; el LiDAR y el giroscopio siguen en 0,35 s.
- **Grabar desde el Mac:** `tools/car_bag_mac.sh <nombre>` en WRO-Strategies graba el LiDAR, el giroscopio, el sensor
  trasero, las órdenes y el registro de la estrategia, que dice cada pulso de la salida y cada recuperación.

## Lo que todavía falla

1. **Las esquinas cruzadas en sentido horario.** Son la mayoría de los fallos que quedan (33 de 200). La próxima idea es una maniobra con marcha atrás, como hace STORMS cuando llega tarde a una curva.
2. **Dos campos que solo fallan en Gazebo** (CW, campos 1 y 4). El laboratorio los pasa, así que todo apunta a la cámara.
3. **El tiempo.** Unos 142 s con aparcamiento, frente a 49–63 s de los tres primeros. Hace falta curvar más rápido o medir la distancia de verdad: los tres primeros tienen encoder o motor paso a paso.
4. **En el coche real**: la salida con un pilar en la recta, la dirección que a veces no gira y el aparcamiento (el fijo está por probar). Ver [En el coche real](#en-el-coche-real).
5. **Salir del aparcamiento** depende de la batería y del tiempo de cada pulso; la recuperación frontal todavía se activa
   de más en algunas esquivadas. Ver [salir del aparcamiento](#en-el-coche-real-9-de-noviembre-salir-del-aparcamiento).

### Prueba esto

- En tu `my_obstacle`, mide dónde se va el tiempo: cuenta los ciclos en los que se aplica cada tope de velocidad. Quizá te pase lo mismo.
- Haz que la distancia de los arcos del aparcamiento salga del giroscopio y compara las rondas aparcadas del todo.
- Antes de quedarte con un cambio, repítelo con otras semillas.
