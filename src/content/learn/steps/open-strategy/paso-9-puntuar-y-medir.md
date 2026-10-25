---
guide: "open-strategy"
order: 9
slug: "paso-9-puntuar-y-medir"
title: "Puntuar y medir"
summary: "Calcula los puntos y mide el tiempo de cada ronda."
tag: "step-9"
compareFrom: "step-8"
---

Tu estrategia ya da las tres vueltas y decide el sentido sola. Este paso no añade comportamiento: enseña a **medir**. Vas a aprender qué cuenta el juez, cómo leer lo que imprime, cómo repetir una ronda sin Gazebo, hasta dónde se puede confiar en cada medida y cómo anotar tus intentos para saber si un cambio mejora algo de verdad. Al final, qué probar para ir más rápido y qué hacer con el coche real.

## Lo que vas a ver

No cambia nada en la pista. Cambia lo que haces con ella:

1. Corres las 12 rondas del Open lab (sin Gazebo) y comparas con la tabla de la solución.
2. Corres una ronda `ccw` y otra `cw` en Gazebo y lees el resumen del árbitro.
3. Rellenas tu propia tabla de intentos en `RESULTADOS.md`.

La referencia de este paso es solo ese archivo, con las rondas medidas de la solución.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-9.json"></div>

## La idea

### Qué puntúa el juez

El juez (`robotek_evaluation.rule_judge`) aplica las reglas publicadas del Open sobre la pose real del coche, que el árbitro guardó aparte (la estrategia nunca la ve). Son 30 puntos como máximo. Usa el visor de arriba y mira cómo se iluminan las secciones del tapete, una por cada punto de la regla 1.1:

| Regla | Puntos | Qué cuenta |
|---|---:|---|
| 1.1 Secciones | hasta 24 | una por cada sección del tapete de la que sale el coche, en el sentido de la ronda |
| 1.2 Vueltas | 3 | una por vuelta completa (ocho secciones) |
| 1.3 Parada | 3 | parar con todo el coche dentro de la sección de salida, quieto 15 s |

Son **estimaciones de simulación**, no puntuación oficial. Fíjate en lo que no puntúa: no hay puntos por ir rápido ni por «parecer» que terminó. El `DONE` de la estrategia tampoco da puntos: la parada solo cuenta si la pose real confirma que el coche se quedó quieto dentro de la sección de salida.

### Qué es una ronda válida

Sacar 30 puntos no basta para que una ronda sea *válida*. Además de eso (`standard_validation`):

- el máximo de puntos, sin faltas de regla;
- la parada observada al menos **30 s** (el árbitro espera ese tiempo antes de cerrar la ronda);
- **ningún contacto** con un muro (sensores de contacto de Gazebo);
- un margen mínimo a los muros de **1 cm** o más;
- un ángulo de dirección que nunca pase de **25°** (el juez tolera hasta 25,5°).

Son umbrales internos del equipo, no reglas de la competencia. Por eso el resumen distingue «Puntos» (lo que da la regla) de «Válida» (si además cumples nuestros umbrales).

### Rondas, tiempo y orden

El árbitro termina una ronda a los 180 s, a los 30 s sin sección nueva, o cuando el coche dio las tres vueltas y lleva 31 s quieto. Por eso, en Gazebo, el resultado aparece unos 31 s de tiempo simulado después de que el coche pare. Todo se guarda en `~/robotek_runs/<fecha>-<nombre>/` (`audit_pose.csv`, `events.jsonl`, `manifest.json`, `world.sdf`, `contacts.jsonl` y `rule_judge.json`). Para volver a puntuar la última ronda, o una concreta:

```bash
ros2 run robotek_course score
ros2 run robotek_course score ~/robotek_runs/<carpeta>
```

El tiempo cuenta **desde Start hasta que el coche se detiene**, no hasta el final de los 30 s de observación. Hay dos relojes:

- **Tiempo simulado:** el que usa el juez y el que imprime `score`. Es el que debes comparar.
- **Tiempo de pared:** el reloj real. `rule_judge.json` también lo guarda (`time_from_start_wall_seconds`), pero depende de tu computador y de si la GUI está abierta.

Y hay un detalle sobre **dónde se para el reloj**: en Gazebo, `score` busca en la pose real el instante en que el coche queda quieto para siempre y lo marca como `DONE`; en el Open lab el reloj se para cuando la propia estrategia dice `DONE` (0,9 s después de frenar, `STOP_WAIT`). Son dos definiciones del final, otra razón para no mezclar tiempos del lab y de Gazebo.

Para elegir entre dos intentos: **primero los puntos, después el tiempo**. Un intento de 27 puntos en 30 s pierde contra uno de 30 puntos en 40 s. Las vueltas son parciales de ese total, y no suman el total: tras la vuelta 3 vienen el freno y la parada.

### Cómo leer lo que imprime `score`

Al terminar la ronda el árbitro imprime un resumen como este (es el de la solución en Gazebo, `ccw`; la carpeta de ejemplo lleva tu fecha y hora):

```text
Ronda: ~/robotek_runs/20261025T143012-my_open-ccw
Puntos: 30 de 30   (secciones 24 + vueltas 3 + parada 3)
Tiempo desde Start: 34.80 s simulados   (vueltas: 10.9 / 10.6 / 11.0 s)
Válida: sí   margen mínimo 11.9 cm
Son estimaciones de simulación, no puntuación oficial.
```

Léelo de arriba abajo. Cuando algo no sea lo esperado, busca aquí la línea que ves:

- **`Puntos: 27 ... parada 0`**: dio las tres vueltas pero no paró con todo el coche dentro de la sección de salida. Mira la última esquina y el freno (paso 7); la línea `Aviso: Stop not counted` dice por qué no contó la parada.
- **Pocos puntos y, justo encima del resumen, `Ronda terminada (no_section_progress_30s)`**: el coche se quedó parado o atascado y no pasó a otra sección en 30 s. Mira el registro de la terminal: ¿hubo `DIRECTION_FAULT`? ¿chocó?
- **`Falta: ... (regla 9.24.3/A4)`**: una falta de regla, por ejemplo dos cruces de sección hacia atrás. Mira el sentido de la ronda (paso 8).
- **`Válida: no (no_contacts)`**: tocó un muro. Mira la distancia de giro y el margen (pasos 5 y 6).
- **`Válida: no (min_..._wall_clearance_m)`**: pasó a menos de 1 cm de un muro o de la isla, aunque no haya contacto.
- **`Válida: no (stop_observed)`**: la parada no se observó 30 s. Mira que el coche quede quieto, la línea `Ronda terminada (...)` y si aparece `La ronda terminó por: ...`.
- **`Válida: no (steering_limit)`**: el volante pasó de 25°. Mira `STEER_LIMIT` y tu control de dirección.

### El Open lab: filtro rápido, no autoridad

Gazebo tarda lo que tarda una ronda real. Para probar cambios existe el **Open lab**: un modelo de la ronda en Python con el campo real, el modelo medido del servo y del motor, el LiDAR simulado y **el mismo juez**. Corre las 12 rondas del set estándar (6 campos por 2 sentidos):

```bash
python3 -m robotek_evaluation.open_lab --strategy my_open.strategy:Strategy
python3 -m robotek_evaluation.open_lab --strategy my_open.strategy:Strategy --field square100 --direction ccw
```

Cada línea que imprime es una ronda: campo y sentido, `pts` (puntos), `t` (tiempo desde Start), `valid` y, si no es válida, la lista de motivos. La última línea resume cuántas son válidas y el tiempo medio. Con `--seed N` cambia el ruido de los sensores.

Lo que el propio código del lab dice que **no modela**: el deslizamiento de las ruedas, la dinámica del plugin Ackermann de Gazebo, las imágenes de la cámara (entrega el sentido directamente tras un retardo), las fuerzas de contacto y el motor bajo carga. Consecuencias:

- Una ronda que **falla** en el lab es una mala señal.
- Una que **pasa** no demuestra que pase en Gazebo.
- Los tiempos no son los mismos: `square100` ccw da 32,58 s en el lab y 34,80 s en Gazebo. No se ha investigado de dónde sale esa diferencia; una parte podría ser la definición del final de la ronda (arriba), pero no se ha medido cuánto.

Regla de trabajo: el lab filtra ideas; **Gazebo decide**.

### Las 14 rondas de la solución

Estas son las rondas medidas de la solución: 2 en Gazebo y 12 en el Open lab. Ordénalas por la regla (puntos primero, tiempo después), filtra por sentido o por prueba, y fíjate en la columna de vueltas y en el tiempo que sobra hasta parar. **No compares tiempos entre Gazebo y el lab:** la marca «mejor» es el puesto 1 dentro de cada prueba.

<div data-widget="results-table"></div>

Para comparar con tu ejecución del lab, las 12 rondas con sus tiempos, todas válidas con 30 puntos:

| Campo | ccw | cw |
|---|---:|---:|
| `square100` | 30 · 32,58 s | 30 · 32,58 s |
| `square180` | 30 · 50,18 s | 30 · 50,28 s |
| `rect100x180` | 30 · 40,58 s | 30 · 40,58 s |
| `rect180x100` | 30 · 42,28 s | 30 · 42,28 s |
| `shift140` | 30 · 40,58 s | 30 · 42,08 s |
| `east140x100` | 30 · 36,78 s | 30 · 38,28 s |

12 de 12 válidas, tiempo medio 40,75 s (Open lab, semilla 0). Las dos rondas de Gazebo (`ccw` 34,80 s y `cw` 34,90 s, ambas 30 puntos y válidas) están en la tabla de arriba.

## Escríbelo

Aquí no hay código de estrategia nuevo. Haz esto en orden:

1. **Corre las 12 rondas** del Open lab con tu `Strategy` y compara con la tabla de arriba. Si algo da menos de 30 puntos, lee la fila de la tabla «Qué ves» y vuelve al paso que corresponda (la calibración del paso 2 o la última esquina del paso 7 son los sospechosos habituales).
2. **Corre una ronda `ccw` y otra `cw` en Gazebo** con GUI y copia el resultado de `score` a tu tabla.
3. **Crea `RESULTADOS.md`** en `src/my_open/` (la referencia trae el suyo) y anota una fila por intento: puntos primero y tiempo después.

<details>
<summary>Ver la referencia: la tabla de RESULTADOS.md para llenar</summary>

```markdown
| Fecha | Cambio | Sentido | Puntos | Tiempo | Válida |
|---|---|---|---:|---:|:---:|
| | | | | | |
```

Una fila por ronda. En «Cambio» escribe lo único que modificaste desde la fila anterior. Cambia **una cosa a la vez**: si cambias dos, no sabrás cuál ayudó.

</details>

### Cómo llevar tu registro

La plantilla de la referencia es mínima. Te recomiendo añadir una columna **Dónde** (`lab` o `Gazebo`), porque los tiempos de los dos no se comparan, y una de **Nota** para lo que veas. Así se ve con una primera fila (la línea base de la solución, antes de cambiar nada) y la fila de tu primer experimento sin rellenar:

| Fecha | Cambio | Dónde | Sentido | Puntos | Tiempo | Válida | Nota |
|---|---|---|---|---:|---:|:---:|---|
| AAAA-MM-DD | ninguno (línea base de la solución) | Gazebo | ccw | 30 | 34,80 s | sí | vueltas 10,9 / 10,6 / 11,0 |
| AAAA-MM-DD | (lo único que cambiaste) | | | | | | |

Cómo usarla bien:

- **Primero la línea base**: tu propia ronda sin cambios, en el mismo sitio. Es lo que vas a intentar mejorar.
- **Un cambio por fila** y anota el valor anterior y el nuevo (`TURN_FRONT 1.19 a 1.10`).
- **Compara dentro del mismo «Dónde» y el mismo sentido.** Un 33 s del lab no «mejora» un 34,8 s de Gazebo.
- **Repite** (tres rondas) antes de concluir: hay ruido en los sensores y un solo intento puede engañar. En esta guía no se midió cuánto varía el tiempo entre repeticiones en Gazebo.
- **Un cambio que baja los puntos o la validez se descarta**, aunque sea más rápido.

## Pruébalo

Las pruebas de este paso son el examen. Necesitan los paquetes de ROS instalados (sin ellos se saltan solas) y tardan unos 20 a 30 s, porque corren rondas completas del Open lab:

```bash
source /opt/ros/jazzy/setup.bash && source install/setup.bash
python3 -m pytest course/tests/test_step_9.py -q
```

Esperado: `3 passed`. Comprueban que `square100` da 30 puntos, es válida y tarda menos de 34 s en los dos sentidos, y que `square180` ccw y `rect100x180` cw también dan 30 puntos válidos.

En Gazebo, las dos rondas de siempre:

```bash
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=ccw
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=cw
```

Esperado: 30 de 30 y ronda válida en las dos.

## Si algo falla

- **`score` dice «No hay rondas en ~/robotek_runs».** No terminó ninguna ronda con carpeta. Corre antes `round.launch.py`. Si el árbitro no pudo puntuar, deja los archivos y te dice cómo repetirlo con `score <carpeta>`.
- **Pasa en el lab pero no en Gazebo.** Es el caso esperado de un lab más simple. Gazebo manda.
- **30 puntos pero «Válida: no».** Mira la lista entre paréntesis (tabla «Qué ves»): puede ser un contacto con un muro, un margen menor de 1 cm o que la parada no se observó 30 s.
- **Tu tiempo difiere unas décimas.** Hay ruido en los sensores. Para decidir si un cambio mejora, repite varias rondas antes de concluir.
- **Las pruebas de este paso se saltan.** Falta cargar ROS: `source /opt/ros/jazzy/setup.bash && source install/setup.bash`.

## Qué probar para ir más rápido

La regla es **puntos primero, tiempo después**. Cada cambio tiene que mantener los 30 puntos y la validez antes de acortar el tiempo. Prueba ideas una a la vez y anótalas en tu tabla. Esto es lo que mide el Open lab con la solución, **sin confirmar en Gazebo**:

| Cambio, de uno en uno | Una ronda | Media de las 12 |
|---|---:|---:|
| Línea base de la solución | 32,58 s | 40,75 s |
| `CRUISE_SPEED` 1,28 a 1,00 | 35,78 s (+3,2) | 44,92 s |
| `CRUISE_SPEED` 1,28 a 1,20 | 33,88 s (+1,3) | 41,91 s |
| `CRUISE_SPEED` 1,28 a 1,40 | 32,58 s | 40,73 s |
| `CRUISE_SPEED` 1,28 a 1,60 | 32,58 s | 40,61 s |
| `TURN_FRONT` 1,19 a 0,90 | 38,68 s (+6,1) | 42,86 s |
| `TURN_FRONT` 1,19 a 0,60 | 49,88 s (+17,3) | 50,00 s |
| `TURN_FRONT` 1,19 a 1,30 | 32,68 s (+0,1) | 40,80 s |
| `LOOKAHEAD` 0,35 a 0,05 | 34,98 s (+2,4) | 42,69 s |
| `FINISH_SPEED` 0,15 a 0,30 | 32,28 s (-0,3) | 40,12 s |
| `FINISH_SPEED` 0,15 a 0,50 | 32,08 s (-0,5) | 39,73 s |

«Una ronda» es `square100` en `ccw`; la media es de las 12 rondas del set. `CRUISE_SPEED` y `FINISH_SPEED` están en `mission.py`; `TURN_FRONT` y `LOOKAHEAD`, en `turn_gate.py`. En todas estas pruebas del lab las 12 rondas siguen dando 30 puntos y válidas, una ronda por cambio y con la semilla 0 (con ruido, repite). Qué leer ahí:

1. **`CRUISE_SPEED` pide, no entrega.** La velocidad que alcanza el coche sale de una tabla medida (1,28 de comando da 0,60 m/s) que llega hasta 1,28. Por encima, el lab casi no cambia; no se investigó por qué. Bajarla sí cuesta tiempo, así que la estrategia ya va en el techo de lo medido.
2. **`TURN_FRONT` y `LOOKAHEAD` tienen un punto bueno.** Girar tarde cuesta mucho tiempo, no puntos; girar antes que 1,19 m no gana nada. La solución ya está cerca de lo mejor que ve el lab.
3. **Lo único que baja el tiempo en el lab es el final**: avanzar más rápido hasta la pared de salida ahorra 0,3 a 0,5 s. Es poco, y es justo lo que el lab modela peor (el motor bajo carga y el frenado). Si lo pruebas en Gazebo, mira que la parada siga dando los 3 puntos.
4. **La última esquina.** Es lenta a propósito (protege 3 puntos, ver «Rómpelo» del paso 7). Se podría acortar la rampa de frenado, pero cuida la parada dentro de la sección de salida.

Estos números son del Open lab: ninguna de estas mejoras está confirmada en Gazebo. Y el lab puede engañar en las dos direcciones: quitar el amortiguamiento de la esquina (`DAMPING = 0` en `arc.py`) o pedir una sola confirmación a la puerta (`CONFIRMATIONS = 1` en `turn_gate.py`) no rompe nada en el lab y hasta gana entre 0,1 y 1,4 s en las tres rondas que probé, y sin embargo, según los registros del equipo, hicieron falta en Gazebo. Hay también ideas que nadie ha medido aquí, por ejemplo una trayectoria de esquina más abierta.

Un límite más: esta estrategia no tiene **recuperación de atascos**: si el coche se atasca, no hace nada.

## El coche real

El mismo nodo está pensado para correr en el coche (una Raspberry Pi). El paquete `robotek_hardware` traduce `/scan`, `/imu`, `/camera/image` y `/start` a los nombres de la placa y el LiDAR del coche, y tu `/cmd_vel_raw` al servo y al motor. Se lanza con:

```bash
ros2 launch robotek_course car.launch.py strategy:=my_open
```

Los pasos para preparar el Pi, los drivers y la calibración están en `src/robotek_hardware/README.md` y, paso a paso, en el capítulo 10. Cuando los LED de la placa están en verde, **una pulsación del botón** es Start (`/start`). **Otra pulsación** detiene el coche (`/robotek/stop`): el nodo llama a `operator_stop()` y la misión pasa a `OPERATOR_STOP`, sin volver a arrancar hasta lanzar de nuevo.

Cosas que debes saber antes de poner el coche en la pista:

- **Esta guía no verificó este código en el coche real.** Todo lo medido aquí es de simulación. El coche del equipo corrió otra estrategia.
- **El color cambia.** Los rangos de `line_lengths` son los del simulador (paso 8).
- **La velocidad real hay que medirla.** El README del hardware dice que el motor se calibró con la batería baja y solo hasta unos 0,32 m/s. Empieza con velocidades bajas.
- **Prueba con las ruedas en el aire** antes de la pista.

## Qué sigue

Cuatro ideas, de menor a mayor esfuerzo:

1. **Repite y anota.** Cambia una cosa a la vez, tres rondas por cambio, y mira la tabla de arriba cada vez.
2. **Prueba un campo nuevo.** Copia un `.sdf` de `robotek_gazebo/worlds`, córrelo en el lab con `run_round` (mira cómo lo hace `test_step_9.py`; `--field` solo elige entre los 6 del set estándar) y en Gazebo con `world:=ruta/al/campo.sdf`.
3. **Escribe la recuperación de atascos.** Por ejemplo: «si en 1,5 s avancé menos de 2 cm, retrocede 0,8 s». ¿Necesita un estado nuevo o basta un dato dentro de `RUN`? Piénsalo antes de escribir código: es la misma pregunta del paso 7.
4. **Mejora la visión para el color real del coche** y corre con velocidades bajas en el coche, comparando con Gazebo. Eso lo continúan los capítulos 10 a 12.

## Resumen

- El juez da hasta 30 puntos (24 secciones, 3 vueltas, 3 por la parada); una ronda es válida si además no toca muros, deja 1 cm de margen, no pasa de 25° de volante y la parada se observa 30 s.
- Se elige primero por puntos y después por tiempo desde Start; el lab filtra ideas y Gazebo decide, y sus tiempos no se comparan.
- Para saber si un cambio ayuda: una cosa por fila, línea base primero, repetir y confirmar en Gazebo.

## Antes de seguir

- [ ] `python3 -m pytest course/tests/test_step_9.py -q` da `3 passed`.
- [ ] Corriste una ronda `ccw` y otra `cw` en Gazebo y copiaste el resultado de `score` a tu tabla.
- [ ] Tu `RESULTADOS.md` tiene una fila de línea base y sabes qué columna dice «Dónde».
- [ ] Sabes explicar por qué 32,58 s (lab) y 34,80 s (Gazebo) no se comparan.

## Compara

```bash
bash tools/compare-step.sh 8 9     # solo añade RESULTADOS.md
bash tools/compare-step.sh 9       # tu árbol contra el paso 9
```
