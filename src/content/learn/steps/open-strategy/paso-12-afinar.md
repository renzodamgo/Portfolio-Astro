---
guide: "open-strategy"
order: 12
slug: "paso-12-afinar"
title: "Afinar: mejorar tiempos y adaptarlo a tu coche"
summary: "Qué pasa si el servo es más lento, el ángulo máximo cambia o el motor es otro, y cómo ajustar cada parámetro."
tag: "step-9"
compareFrom: "step-9"
---

Tu estrategia ya completa las tres vueltas con 30 puntos. Este capítulo no es una receta para "la estrategia óptima": es una lista de **pequeños ajustes** que puedes probar, **de uno en uno**, para ganar unas décimas o un par de segundos, y de qué se rompe si te pasas. Los puntos van primero y el tiempo después: un ajuste que gana 1 s pero pierde un punto no vale.

> **Cuánto te puedes fiar de cada cifra.** Etiquetas, como en el paso 11:
>
> - `[lab]`: medido en el Open lab (sin Gazebo), 12 rondas del set estándar, semilla 0 salvo que diga lo contrario.
> - `[gazebo]`: una ronda en Gazebo, pocas.
> - `[coche]`: medido en el coche real por el equipo (solo los valores del modelo del coche, no estos ajustes).
> - `[código]`: lo deduzco leyendo el código. Es una hipótesis.
>
> **Ninguno de estos ajustes se probó en el coche real.** Son números del simulador: el coche real puede darte otros.

<!-- step-video:start -->
<figure class="learn-step-video">
<video controls muted playsinline preload="none" poster="/learn/videos/open/paso-12-afinar.jpg"><source src="/learn/videos/open/paso-12-afinar.mp4" type="video/mp4"></video>
<figcaption>Lo que este capítulo añade a la estrategia, en 42 s de animación sin sonido.</figcaption>
</figure>
<!-- step-video:end -->

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/sFOEsA0Irjs" title="A PID Tuning Guide | Understanding PID Control, Part 4" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>A PID Tuning Guide | Understanding PID Control, Part 4</strong> · MATLAB (inglés, 12 min). Un método práctico para afinar ganancias, como en este paso.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Cómo trabajar

1. **Un cambio cada vez.** Si cambias dos cosas y mejora, no sabrás cuál fue.
2. **Primero el lab, luego Gazebo, luego el coche.** El lab te da 12 rondas en segundos; Gazebo te dice si el lab se engaña; el coche tiene la última palabra y siempre con **la mano en el botón de parada** (paso 11).
3. **Mira la ronda mala, no solo la media.** Una media de 39 s con una ronda que roza la pared es peor que 40 s sin roces. Mira las rondas válidas (12 de 12) y el margen mínimo a las paredes.
4. **Repite con más semillas.** Una búsqueda automática con dos semillas "encontró" un cambio de `GAIN` que a la tercera semilla falló una ronda de 36 `[lab]`. Con ruido, repite.
5. **Anota todo** en una tabla: cambio, rondas válidas, tiempo, margen, batería. Es la única forma de volver atrás.

## Cómo medir

En el lab, cada `--set` cambia una constante de tu código sin editar el archivo (`'my_open.*.NOMBRE=valor'` cambia todos los módulos que la tienen), y `--seeds` y `--jobs` repiten con varias semillas en paralelo:

```bash
python -m robotek_evaluation.open_lab --strategy my_open.strategy:Strategy --jobs 8 --seeds 0,1,2 \
    --set my_open.mission.FINISH_SPEED=0.45 \
    --out /tmp/prueba.json
```

La última línea dice `36/36 valid, mean time 41.64 s`. El margen mínimo a una pared (en metros) está en cada ronda del `--out`, en `min_clearance`.

Para ver cómo reacciona tu estrategia a un coche distinto, el lab acepta `--act nombre=valor` (por ejemplo `--act steer_rate=0.6`), `--act-scale speed_table_real=0.85` y `--latency 0.05`. En Gazebo, las mismas constantes con `set:=` y el coche con `actuator_params:=`:

```bash
ros2 launch robotek_course round.launch.py strategy:=my_open direction:=ccw \
    set:='my_open.mission.CORNER_SPEED=0.9;my_open.mission.FINISH_SPEED=0.45' \
    actuator_params:=speed_scale=1.15
```

> **Ojo con el retardo del servo.** Gazebo suma 0,04 s del plugin al retardo del yaml, y el lab lo imita. Para un servo con 0,12 s: en Gazebo `actuator_params:=steer_delay=0.12`; en el lab `--act steer_delay=0.16 --act steer_tau=0.06`.

## El servo, de un vistazo

El servo es lo que más pesa en las esquinas. Este widget corre **una** esquina en el mini simulador: pon un servo lento y mira el sobrepaso, soltando el tope antes o después y con y sin amortiguamiento.

<div data-widget="corner"></div>

Una advertencia: lo que arregla una esquina suelta no siempre se nota en la **ronda completa del lab**. Con el retardo del servo triplicado, ni `DAMPING` (de 0 a 0,3) ni `TURN_TOLERANCE` (de 0,2 a 0,5) cambiaron el resultado: 12 de 12 válidas, con 2 a 4 cm de margen a la pared. Lo que sí dio margen fue **bajar la velocidad de esquina**: con `CORNER_SPEED` 0,8 el margen subió a 6,1 cm, y con 0,6 a 10,7 cm `[lab]`.

## Ideas pequeñas, una a una

Ordenadas de más segura a más arriesgada. Los tiempos son la media de las 12 rondas del set estándar, base 41,82 s `[lab]`.

### 1. Mira si el motor ya está en su tope

- **Qué cambiar:** `CRUISE_SPEED` en `mission.py` (1,28 m/s pedidos; el coche llega a 0,60 m/s reales con esa orden, y 1,28 es el 100 por ciento del motor).
- **Cuánto gana:** casi nada. Pedir 1,6 da 41,54 s y 2,0 da 41,34 s, frente a 41,82 s `[lab]`. Bajar sí cuesta: a 1,0 son +1,7 s y a 0,6 son +6,5 s.
- **Riesgo:** ninguno al subir, pero no sirve. Bajarla solo tiene sentido para ganar margen (ver «Hallazgos»).
- **Cómo comprobarlo:** una vez en el lab; si el tiempo no baja de 0,5 s, déjalo en 1,28.

### 2. Carga la batería (y mídela)

- **Qué cambiar:** nada en el código. La velocidad real manda: con el motor al 85 por ciento de la tabla (batería baja), 48,37 s (+6,5 s) y las 12 válidas `[lab]`.
- **Riesgo:** con más velocidad de la medida, el coche **no para a tiempo**. Con el motor al 115 por ciento el lab da 38,6 s, pero solo 29 de 36 rondas válidas: las otras 7 paran fuera de la sección de salida (27 puntos). Al 130 por ciento, 21 de 36. La idea 6 dice cómo recuperar el margen.
- **Cómo comprobarlo:** anota la tensión de la batería en cada ronda. La tabla de `real_car_v1.yaml` se midió con la batería baja (7,0 a 7,4 V) y su último punto (1,28 da 0,60 m/s) está **inferido**, no medido: vuelve a medirlo con la batería cargada.

### 3. No pierdas tiempo con la cámara

- **Qué cambiar:** en el lab, nada; mira en tu registro cuánto tarda en salir el sentido.
- **Cuánto gana:** cada segundo que tarda la cámara en dar el sentido, un segundo más de ronda (1 s: 42,51 s; 3 s: 44,59 s; 8 s: 49,50 s). La tasa de imágenes no importa: de 6 a 1 fotograma por segundo, el mismo tiempo `[lab]`.
- **Riesgo:** no bajes `CONFIRMATIONS` (`direction.py`) para ganar medio segundo: un sentido mal decidido cuesta toda la ronda (paso 11, caso 10). Con 16 s de retraso, 12 rondas de 12 terminan en `DIRECTION_FAULT`.
- **Cómo comprobarlo:** cronometra desde Start hasta que la estrategia anuncia el sentido, y repítelo con luces distintas.

### 4. Que la calibración siga corta

- **Qué cambiar:** `CALIBRATE_SECONDS` en `mission.py` (0,3 s).
- **Cuánto gana:** nada al acortarla (0,05 s: 41,85 s). Alargarla sí cuesta: 1 s da 42,52 s y 2 s da 43,51 s `[lab]`.
- **Riesgo:** poco con esta estrategia: incluso con 0,05 s y un ruido de giroscopio de 0,01 rad/s las 12 rondas fueron válidas `[lab]`, porque la pared de la isla corrige el rumbo en cada recta (paso 7). Aun así, deja 0,3 s: acortar no gana nada.
- **Cómo comprobarlo:** 12 rondas del lab con ruido de giroscopio (`--set robotek_evaluation.open_lab.GYRO_NOISE=0.01`).

### 5. Subir la velocidad del final con cuidado

- **Qué cambiar:** `FINISH_SPEED` en `mission.py` (0,15 m/s).
- **Cuánto gana:** poco: 0,3 da 41,70 s (-0,1 s); 0,45 da 41,61 s; 0,6 da 41,51 s (-0,3 s) `[lab]`.
- **Riesgo:** el coche tiene que frenar a tiempo dentro de la sección de salida (3 puntos). Con 0,8, ninguna de las 12 rondas fue válida; `FINISH_LEAD` en 0,15 dio 8 de 12 `[lab]`.
- **Cómo comprobarlo:** tres semillas en el lab, luego Gazebo y mira que la parada siga dentro de la sección. `BRAKE_GAIN` (1 a 4) cambió menos de 0,4 s; `BRAKE_MARGIN` a 0 gana 0,3 s y a 0,35 pierde 0,5 s.

### 6. La velocidad de esquina: la que más pesa y la más delicada

- **Qué cambiar:** `CORNER_SPEED` en `mission.py` (1,0 m/s pedidos, en las 12 esquinas).
- **Cuánto cuesta bajarla:** 0,8 da 44,84 s (+3,0 s) y 0,6 da 48,87 s (+7,1 s) `[lab]`.
- **Riesgo al subirla:** el coche sale de la última esquina demasiado rápido para parar en la sección de salida. Con 1,15 solo 7 de 12 rondas son válidas; con 1,28 (la de crucero), 6 de 12. Todas las que fallan sacan 27 puntos: dieron las tres vueltas y pararon fuera `[lab]`.
- **Cómo comprobarlo:** tres semillas en el lab y mira siempre la parada, no solo el tiempo.

### 7. Ejemplo: un ajuste para una batería no sirve para otra

La base da 36 de 36 con el motor de la tabla. Con la batería cargada (motor al 115 por ciento) baja a 29 de 36: el coche llega más rápido a la meta y 7 rondas paran fuera de la sección. Bajando `CORNER_SPEED` de 1,0 a 0,9 vuelven las 36 de 36, y la ronda sigue siendo más rápida que con la batería baja: 38,27 s `[lab]`. Con el motor de la tabla, 0,9 cuesta 1,4 s (43,28 s) y también da 36 de 36, con más margen a las paredes (11,5 cm).

La lección: **la parada es la parte frágil**. Si tu coche va más rápido que el del simulador, lo primero que se pierde son los 3 puntos del final. Mira la velocidad real con la batería que vas a usar y ajusta `CORNER_SPEED` con ella.

### 8. Un ángulo de volante mayor

- **Qué cambiar:** `STEER_LIMIT` (en `minisim.py` y en tu código; hoy 17,6°, 0,307 rad). El coche del equipo gira ahora ±19° (medido el 1 nov 2026; `wheel_limit_deg` en `robot.yaml`).
- **Cuánto gana:** si coche y estrategia usan 20°, -0,6 s (41,25 s) y el margen baja de 10,1 a 5,8 cm. Con 23° solo 9 de 12 rondas son válidas y con 25°, 6 de 12: el coche gira más cerrado y, soltando el tope a los mismos 17 grados, se pasa. Si el coche gira más de lo que cree la estrategia, casi nada cambia (41,34 s) `[lab]`.
- **Riesgo:** pedir más ángulo del que tiene el coche, o cambiar el ángulo sin volver a medir cuándo soltar (`TURN_TOLERANCE`, paso 5).
- **Cómo comprobarlo:** mide el ángulo real (paso 11, caso 6) antes de cambiar la constante, y repite la tabla del paso 5 con el widget de arriba.

### 9. Lo que no merece la pena tocar

En el lab casi no cambian nada, con el valor base ya bien: `GAP` (0,20 a 0,40 m), `GAIN` (0 a 2), `LIMIT`, `DAMPING` (0 a 0,2), `TURN_TOLERANCE` (0,3 a 0,8), `WALL_HEADING_GAIN` (0 a 1, con un giroscopio sin error), `TURN_FRONT` (1,1 a 1,3 m) y `ARM_DISTANCE` (hasta 0,5 m). Y hay constantes que **cuestan** si las cambias: `TURN_FRONT` a 0,9 m (+1,4 s), `LOOKAHEAD` a 0,1 m (+1,5 s) o a 0,5 m (3 de 12 chocan con la isla), `TURN_TOLERANCE` a 0,12 o 0,2 (1 o 2 de 12 paran fuera), `GAP` a 0,15 m (2 de 12 paran fuera), `KP` de 3 o más (casi todas chocan) y `ARM_DISTANCE` a 1,2 m (ninguna gira a tiempo) `[lab]`.

## Si cambias de coche

Estas son pistas, no una receta. Vuelve a medir antes de tocar constantes: **distancia entre ejes** (`WHEELBASE`; un coche más largo no cabe en la esquina aunque la actualices: 14,7 cm solo da 9 o 10 de 12 rondas válidas `[lab]`), **ángulo máximo de volante**, **retardo y velocidad del servo** con el móvil en cámara lenta y el `servo_step.py` del [paso 11](/learn/open-strategy/paso-11-solucion-de-problemas/), **tabla de velocidad** (un recorrido de 2 m cronometrado a varias velocidades pedidas, con batería cargada y baja), y la **posición del LiDAR** y la **inclinación de la cámara**. Cambia los valores en `minisim.py` y en el yaml del coche, y vuelve a pasar el lab.

## Límites

- Todo son números del simulador, de un coche y una estrategia. El coche real puede dar otros.
- El lab ha ido unos 1,8 s más rápido que Gazebo en `square100` ccw (33,78 s frente a 35,56 s) `[gazebo]`.
- Solo hay dos rondas de Gazebo con esta estrategia, las dos con los valores base. No generalices.
- Aplica los cambios **de uno en uno** y vuelve a medir tras cada uno.

<details>
<summary>Hallazgos medidos: qué pasa si...</summary>

Base: 12 de 12 rondas válidas, 41,82 s de media, 33,78 s en `square100`, margen mínimo 10,1 cm `[lab]`. Una ronda es válida si da 30 puntos, no toca ninguna pared y deja al menos 1 cm de margen. «Falla» quiere decir que no son válidas las 12.

| Qué pasa si... | Resultado |
|---|---|
| El servo tarda x1,5 (0,09 s) | 12/12; margen 8,5 cm; +0,4 s |
| El servo tarda x2 (0,12 s) | 12/12; margen 6,9 cm; +0,7 s |
| El servo tarda x3 (0,18 s) | 12/12; margen 2,9 cm; +1,6 s |
| El servo tarda x5 (0,30 s) | falla: 6 de 12 válidas |
| El servo va más lento (`steer_rate`, base 1,2 rad/s) | 0,9 bien (7,8 cm); 0,6 deja un margen de 2,9 cm; 0,4 falla (5 de 12) |
| Subes `DAMPING` o `TURN_TOLERANCE` con un servo lento (x3) | no cambia: 12/12 con 2 a 4 cm. Lo que da margen es bajar `CORNER_SPEED` (0,8: 6,1 cm) |
| El coche solo gira 0,25 rad (14°) | falla por poco: 11 de 12; margen 1,9 cm |
| El coche solo gira 0,20 rad (11,5°) | falla: 6 de 12 |
| El coche gira más que lo que cree la estrategia | casi nada cambia (-0,5 s; margen 8,1 cm) |
| Estrategia y coche usan 20° | -0,6 s; margen 5,8 cm |
| Estrategia y coche usan 25° | falla: 6 de 12 (se pasa en las esquinas) |
| El motor entrega el 85 por ciento (batería baja) | 48,4 s; 12/12 |
| El motor entrega el 70 por ciento | 57,7 s; 12/12 |
| El motor entrega el 115 por ciento | 38,6 s, pero falla: 9 de 12 (para fuera de la sección). Con `CORNER_SPEED` 0,9: 36 de 36, 38,3 s |
| El motor entrega el 130 por ciento | falla: 8 de 12; margen 3,2 cm |
| El motor responde más lento (`drive_tau` 0,3 s; base 0,15) | falla: 6 de 12 (para fuera) |
| Pides 1,0 de velocidad en vez de 1,28 | +1,7 s (43,53 s) |
| Pides 0,6 | +6,5 s (48,31 s) |
| Pides 1,6 o 2,0 | no ayuda: el 1,28 ya es el techo del motor |
| `KP` de 3 o más | falla (con 2, margen 3,2 cm) |
| Ruido del LiDAR de 20 mm o más | falla (con 20 mm, 10 de 12) |
| Pérdidas del LiDAR hasta el 40 por ciento | 12/12 (los rayos perdidos no cuentan como final de la isla, paso 3) |
| Error de escala del giroscopio de ±5 por ciento | 12/12 con la corrección por la pared de la isla; sin ella, con ±3 por ciento ya fallan casi todas |
| El giroscopio lee un 6 por ciento de menos (el del coche del equipo) | con la corrección, 10 de 12; sin ella, 0 de 12 |
| El giroscopio lee un 10 por ciento de menos | 9 de 12 con la corrección |
| Deriva del giroscopio de 0,0005 rad/s por segundo | 12/12 con la corrección; sin ella, 4 de 12 |
| La cámara da el sentido 1 s más tarde | 0,7 s más de ronda |
| La cámara tarda 16 s | `DIRECTION_FAULT` en las 12 rondas |
| Retraso de control de 100 ms | 12/12; margen 4,9 cm; +1,3 s |
| Retraso de control de 200 ms | falla (5 de 12) |

El equipo ejecutó estos barridos con sus propios scripts de mantenimiento, con las opciones nuevas del lab (`--set`, `--act`, `--act-scale`, `--latency`, `--seeds`, `--jobs`) y de los lanzadores (`set:=` y `actuator_params:=`). Las tablas completas, con cada configuración, están en `course/maintainers/tuning/RESULTS.md` del repositorio del curso.

</details>

## Resumen

- Cambia una cosa cada vez. Primero el lab, luego Gazebo, luego el coche con la mano en el botón de parada.
- En el lab casi ninguna constante gana tiempo: la batería y la velocidad de esquina mandan más que todas las demás juntas.
- La parada es la parte frágil: con el coche más rápido de lo medido se pierden los 3 puntos del final. Baja `CORNER_SPEED` y anota la tensión.
- Todo son números del simulador. Compruébalo en el coche antes de fiarte.
