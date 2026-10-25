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
    --set my_open.mission.LAST_CORNER_SPEED=0.9 --set my_open.mission.FINISH_SPEED=0.45 \
    --out /tmp/prueba.json
```

La última línea dice `36/36 valid, mean time 39.34 s`. El margen mínimo a una pared (en metros) está en cada ronda del `--out`, en `min_clearance`.

Para ver cómo reacciona tu estrategia a un coche distinto, el lab acepta `--act nombre=valor` (por ejemplo `--act steer_rate=0.6`), `--act-scale speed_table_real=0.85` y `--latency 0.05`. En Gazebo, las mismas constantes con `set:=` y el coche con `actuator_params:=`:

```bash
ros2 launch robotek_course round.launch.py strategy:=my_open direction:=ccw \
    set:='my_open.mission.LAST_CORNER_SPEED=0.9;my_open.mission.FINISH_SPEED=0.45' \
    actuator_params:=speed_scale=1.15
```

> **Ojo con el retardo del servo.** Gazebo suma 0,04 s del plugin al retardo del yaml, y el lab lo imita. Para un servo con 0,12 s: en Gazebo `actuator_params:=steer_delay=0.12`; en el lab `--act steer_delay=0.16 --act steer_tau=0.06`.

## El servo, de un vistazo

El servo es lo que más pesa en las esquinas. Este widget corre **una** esquina en el mini simulador: pon un servo lento y mira el sobrepaso, con y sin amortiguamiento.

<div data-widget="corner"></div>

Una advertencia: en el widget el amortiguamiento arregla el sobrepaso de un servo lento, pero en la **ronda completa del lab** no. Con el retardo del servo triplicado, subir `DAMPING` a 0,2 o 0,3 empeoró las rondas (9 de 12 válidas) `[lab]`. Lo que sí dio margen fue **bajar la velocidad**.

## Ideas pequeñas, una a una

Ordenadas de más segura a más arriesgada. Los tiempos son la media de las 12 rondas del set estándar, base 40,75 s `[lab]`.

### 1. Mira si el motor ya está en su tope

- **Qué cambiar:** `CRUISE_SPEED` en `mission.py` (1,28 m/s pedidos; el coche llega a 0,60 m/s reales con esa orden, y 1,28 es el 100 por ciento del motor).
- **Cuánto gana:** casi nada. Pedir 1,6 da 40,63 s y 2,0 da 40,33 s, con tres semillas, frente a 40,77 s `[lab]`. Bajar sí cuesta: a 1,0 son +4,2 s y a 0,6 son +12,6 s.
- **Riesgo:** ninguno al subir, pero no sirve. Bajarla solo tiene sentido para ganar margen (ver «Hallazgos»).
- **Cómo comprobarlo:** una vez en el lab; si el tiempo no baja de 0,5 s, déjalo en 1,28.

### 2. Carga la batería (y mídela)

- **Qué cambiar:** nada en el código. La velocidad real manda: con el motor al 115 por ciento de la tabla, 35,99 s (-4,8 s); al 85 por ciento (batería baja), 47,03 s (+6,3 s) `[lab]`.
- **Riesgo:** los ajustes de las ideas 5 a 7 se afinan para una batería. Con otra, no valen. A 1,3 el margen baja a 1,5 cm y a 1,5 falla.
- **Cómo comprobarlo:** anota la tensión de la batería en cada ronda. La tabla de `real_car_v1.yaml` se midió con la batería baja (7,0 a 7,4 V) y su último punto (1,28 da 0,60 m/s) está **inferido**, no medido: vuelve a medirlo con la batería cargada.

### 3. No pierdas tiempo con la cámara

- **Qué cambiar:** en el lab, nada; mira en tu registro cuánto tarda en salir el sentido.
- **Cuánto gana:** cada segundo que tarda la cámara en dar el sentido, un segundo más de ronda (1 s: 41,52 s; 3 s: 43,45 s; 8 s: 48,39 s). La tasa de imágenes no importa: de 6 a 1 fotograma por segundo, el mismo tiempo `[lab]`.
- **Riesgo:** no bajes `CONFIRMATIONS` (`direction.py`) para ganar medio segundo: un sentido mal decidido cuesta toda la ronda (paso 11, caso 10). Con 16 s de retraso, 12 rondas de 12 terminan en `DIRECTION_FAULT`.
- **Cómo comprobarlo:** cronometra desde Start hasta que la estrategia anuncia el sentido, y repítelo con luces distintas.

### 4. Que la calibración siga corta

- **Qué cambiar:** `CALIBRATE_SECONDS` en `mission.py` (0,3 s).
- **Cuánto gana:** nada al acortarla (0,05 s: 40,73 s). Alargarla sí cuesta: 1 s da 41,52 s y 2 s da 42,48 s `[lab]`.
- **Riesgo:** con 0,05 s y ruido de giroscopio de 0,01 rad/s, solo 2 de 12 rondas fueron válidas; con 0,3 s, las 12 `[lab]`. No bajes de 0,3 s.
- **Cómo comprobarlo:** 12 rondas del lab con ruido de giroscopio (`--set robotek_evaluation.open_lab.GYRO_NOISE=0.01`).

### 5. Subir la velocidad del final con cuidado

- **Qué cambiar:** `FINISH_SPEED` en `mission.py` (0,15 m/s).
- **Cuánto gana:** 0,3 da 40,12 s (-0,6 s); 0,6 da 39,54 s (-1,2 s) `[lab]`.
- **Riesgo:** el coche tiene que frenar a tiempo dentro de la sección de salida (3 puntos). Con 0,8, una búsqueda de 24 rondas dio 0 válidas; `FINISH_LEAD` en 0,15 dio 14 de 24 `[lab]`.
- **Cómo comprobarlo:** tres semillas en el lab, luego Gazebo y mira que la parada siga dentro de la sección. `BRAKE_GAIN` y `BRAKE_MARGIN` no cambiaron nada en el rango probado.

### 6. Frenar menos en la última esquina

- **Qué cambiar:** `LAST_CORNER_SPEED` en `mission.py` (0,6).
- **Cuánto gana:** 0,9 da 39,72 s (-1,0 s) `[lab]`.
- **Riesgo:** es lenta a propósito para parar dentro de la sección de salida. Con 1,28, 6 de 12 rondas no terminan (`no finish in DONE`).
- **Cómo comprobarlo:** como la idea 5; mira siempre la parada.

### 7. Ejemplo: las dos juntas, y por qué no es una receta

Con `LAST_CORNER_SPEED` 0,6 a 1,1 y `FINISH_SPEED` 0,15 a 0,6 el lab da **40,77 a 38,93 s** (-1,8 s, -4,5 %), 36 rondas de 36 válidas con tres semillas y el mismo margen (8,2 cm) `[lab]`. Parece un buen ajuste, y falla cuando cambia la batería: **con el motor al 115 por ciento (batería cargada) solo 7 de 12 rondas son válidas**; el coche no frena a tiempo en la meta. La variante prudente, 0,9 y 0,45, gana -1,4 s (39,34 s) y aguanta: con el motor al 115 por ciento da 34,83 s, 12 de 12 (la base daba 35,99 s) `[lab]`.

La lección: **un ajuste afinado para una batería no sirve para otra.** Si lo usas, usa la variante prudente y vuelve a comprobar cuando cambie la batería.

### 8. Un ángulo de volante mayor

- **Qué cambiar:** `STEER_LIMIT` (en `minisim.py` y en tu código; el coche real tiene 17,6° de tope, 0,307 rad).
- **Cuánto gana:** si coche y estrategia usan 25°, solo -0,8 s (39,93 s) y el margen baja a 6,8 cm. Si el coche gira más de lo que cree la estrategia, casi nada cambia `[lab]`.
- **Riesgo:** pedir más ángulo del que tiene el coche. El del equipo llega como mucho a 17,6° `[coche]`: no merece la pena.
- **Cómo comprobarlo:** mide el ángulo real (paso 11, caso 6) antes de cambiar la constante.

### 9. Lo que no merece la pena tocar

En el lab casi no cambian nada, con el valor base ya bien: `GAP` (0,15 a 0,40 m), `GAIN` (0 a 2), `LIMIT`, `EXIT_ANGLE`, `TURN_FRONT` (1,1 a 1,6 m) y `ARM_DISTANCE` (hasta 0,5 m). Y hay constantes que **cuestan** si las cambias: `TURN_FRONT` a 0,9 m (+2,1 s), `LOOKAHEAD` a 0,1 m (+1,9 s), `KP` de 2 o más (la mitad de las rondas chocan), `ARM_DISTANCE` a 0,8 m (4 de 12 válidas) `[lab]`.

## Si cambias de coche

Estas son pistas, no una receta. Vuelve a medir antes de tocar constantes: **distancia entre ejes** (`WHEELBASE`; un coche más largo no cabe en la esquina aunque la actualices: 14,7 cm solo da 9 de 12 rondas válidas `[lab]`), **ángulo máximo de volante**, **retardo y velocidad del servo** con el móvil en cámara lenta y el `servo_step.py` del [paso 11](/learn/open-strategy/paso-11-solucion-de-problemas/), **tabla de velocidad** (un recorrido de 2 m cronometrado a varias velocidades pedidas, con batería cargada y baja), y la **posición del LiDAR** y la **inclinación de la cámara**. Cambia los valores en `minisim.py` y en el yaml del coche, y vuelve a pasar el lab.

## Límites

- Todo son números del simulador, de un coche y una estrategia. El coche real puede dar otros.
- El lab ha ido unos 1,8 s más rápido que Gazebo en `square100` ccw (32,58 s frente a 34,42 s) `[gazebo]`.
- Probé pocas rondas de Gazebo: tres. No generalices.
- Aplica los cambios **de uno en uno** y vuelve a medir tras cada uno.

<details>
<summary>Hallazgos medidos: qué pasa si...</summary>

Base: 12 de 12 rondas válidas, 40,75 s de media, 32,58 s en `square100`, margen mínimo 9,5 cm `[lab]`. Una ronda es válida si da 30 puntos, no toca ninguna pared y deja al menos 1 cm de margen. «Falla» quiere decir que no son válidas las 12.

| Qué pasa si... | Resultado |
|---|---|
| El servo tarda x1,5 (0,09 s) | 12/12; margen 7,7 cm; +0,4 s |
| El servo tarda x2 (0,12 s) | 12/12; margen 5,9 cm; +0,8 s. En Gazebo, 30/30 puntos y 35,92 s (la base: 34,42 s) |
| El servo tarda x3 (0,18 s) | 12/12; margen 2,0 cm; +1,5 s |
| El servo tarda x5 (0,30 s) | falla: 2 de 12 válidas |
| El servo va más lento (`steer_rate`, base 1,2 rad/s) | 1,2 bien; 0,6 deja un margen de 1,7 cm; 0,4 falla (5 de 12) |
| Subes `DAMPING` con un servo lento (x3) | no arregla: 0,2 y 0,3 empeoran (9 de 12). Lo que da margen es bajar la velocidad |
| El coche solo gira 0,25 rad (14°) | 12/12; margen 1,6 cm |
| El coche solo gira 0,20 rad (11,5°) | falla: 7 de 12 |
| El coche gira más que lo que cree la estrategia | casi nada cambia |
| Estrategia y coche usan 25° | solo -0,8 s |
| El motor entrega el 85 por ciento (batería baja) | 47,0 s |
| El motor entrega el 70 por ciento | 56,0 s |
| El motor entrega el 115 por ciento | 36,0 s |
| El motor entrega el 130 por ciento | 32,4 s; margen 1,5 cm |
| El motor entrega el 150 por ciento | falla |
| Pides 1,0 de velocidad en vez de 1,28 | +4 s (44,92 s) |
| Pides 0,6 | +12 s (53,33 s) |
| Pides 1,6 o 2,0 | no ayuda: el 1,28 ya es el techo del motor |
| `KP` de 2 o más | falla |
| Ruido del LiDAR de 20 mm o más | falla (con 20 mm, 10 de 12) |
| Pérdidas del LiDAR hasta el 15 por ciento | 12/12 |
| Pérdidas del LiDAR del 25 por ciento | falla |
| Error de escala del giroscopio de ±1 por ciento | 12/12 (con -1 por ciento, margen 2,6 cm) |
| Error de escala del giroscopio de ±2 por ciento | falla |
| Deriva del giroscopio de 0,0002 rad/s por segundo o más | falla (a 0,0002, 11 de 12) |
| La cámara da el sentido 1 s más tarde | 1 s más de ronda |
| La cámara tarda 16 s | `DIRECTION_FAULT` en las 12 rondas |
| Retraso de control de 100 ms | 12/12; margen 3,0 cm; +1,1 s |
| Retraso de control de 200 ms | falla (5 de 12) |

El equipo ejecutó estos barridos con sus propios scripts de mantenimiento, con las opciones nuevas del lab (`--set`, `--act`, `--act-scale`, `--latency`, `--seeds`, `--jobs`) y de los lanzadores (`set:=` y `actuator_params:=`). Las tablas completas, con cada configuración, están en `course/maintainers/tuning/RESULTS.md` del repositorio del curso.

</details>

## Resumen

- Cambia una cosa cada vez. Primero el lab, luego Gazebo, luego el coche con la mano en el botón de parada.
- Los pequeños ahorros que más aparecieron en el lab fueron el final y la última esquina (de 1 a 2 s), y la batería manda más que todos juntos.
- Un ajuste afinado para una batería puede fallar con otra: usa la variante prudente y anota la tensión.
- Todo son números del simulador. Compruébalo en el coche antes de fiarte.
