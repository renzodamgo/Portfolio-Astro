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

## Hazlo: correr, leer, anotar

> **En este paso**
> - **Escribes:** nada de código. Solo corres rondas, lees el resultado y lo anotas en `RESULTADOS.md`.
> - **Copias hecho:** `RESULTADOS.md`, con las rondas medidas de la solución y una tabla vacía para las tuyas; no hace falta entenderlo todavía.

```bash
git fetch --tags
git show step-9:src/my_open/RESULTADOS.md > src/my_open/RESULTADOS.md
```

### Paso 9.1: correr el laboratorio

Corre las 12 rondas del Open lab con tu `Strategy`. Tarda cerca de un minuto. Es el filtro rápido: te dice si algo se rompió antes de gastar tiempo en Gazebo.

```bash
python -m robotek_evaluation.open_lab --strategy my_open.strategy:Strategy
```

Debes ver 12 líneas con `pts=30` y `valid=True`, y al final `12/12 valid, mean time 40.75 s`. Compara cada tiempo con la tabla de arriba. Si alguna da menos de 30, mira la lista de motivos y vuelve al paso que corresponda (la calibración del paso 7.1 o la última esquina del 7.6 son los sospechosos habituales).

Para comprobarlo con el juez de las pruebas:

```bash
python -m pytest course/tests/test_step_9.py -q -k square100
```

Debes ver `2 passed, 1 deselected` (unos 10 s).

### Paso 9.2: leer una ronda de Gazebo

Corre una ronda `ccw` con ventana. El resultado aparece unos 31 s de tiempo simulado después de que el coche pare.

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=ccw
```

Debes ver el resumen de «Cómo leer lo que imprime `score`»: `Puntos: 30 de 30` y `Válida: sí`, con un tiempo cerca de 34,80 s. Si ves otra cosa, busca tu línea en esa lista. Para volver a leer la última ronda sin repetirla, usa `ros2 run robotek_course score`. Repite con `direction:=cw` (la solución dio 34,90 s).

### Paso 9.3: anotar

Cada ronda es una fila de tu tabla. Abre `src/my_open/RESULTADOS.md` y, al final, rellena tu primera fila con la ronda de 9.2. Es tu **línea base**: lo que vas a intentar mejorar.

Te recomiendo dos columnas más que la plantilla: **Dónde** (`lab` o `Gazebo`), porque sus tiempos no se comparan, y **Nota**. Así se ve con la línea base de la solución y la fila de tu primer experimento sin rellenar:

| Fecha | Cambio | Dónde | Sentido | Puntos | Tiempo | Válida | Nota |
|---|---|---|---|---:|---:|:---:|---|
| AAAA-MM-DD | ninguno (línea base de la solución) | Gazebo | ccw | 30 | 34,80 s | sí | vueltas 10,9 / 10,6 / 11,0 |
| AAAA-MM-DD | (lo único que cambiaste) | | | | | | |

Reglas para que la tabla sirva: **un cambio por fila**, con el valor anterior y el nuevo (`TURN_FRONT 1.19 a 1.10`); compara dentro del mismo «Dónde» y sentido; repite tres rondas antes de concluir (en esta guía no se midió cuánto varía el tiempo entre repeticiones en Gazebo); y descarta un cambio que baje puntos o validez, aunque sea más rápido.

<details>
<summary>Ver la plantilla de la referencia</summary>

```markdown
## Tu tabla

Anota aquí tus rondas (`ros2 run robotek_course score`): puntos primero, tiempo desde Start después.

| Fecha | Cambio | Sentido | Puntos | Tiempo | Válida |
|---|---|---|---:|---:|:---:|
| | | | | | |
```

</details>

## Pruébalo

Las pruebas de este paso son el examen. Necesitan los paquetes de ROS cargados (sin ellos se saltan solas) y tardan unos 25 s, porque corren rondas completas del Open lab:

```bash
python -m pytest course/tests/test_step_9.py -q
```

Debes ver `3 passed`: `square100` da 30 puntos válidos en menos de 34 s en los dos sentidos, y `square180` ccw con `rect100x180` cw también.

## Si algo falla

- **`score` dice «No hay rondas en ~/robotek_runs».** No terminó ninguna ronda. Corre antes `round.launch.py`.
- **Pasa en el lab pero no en Gazebo.** Es lo esperado de un lab más simple. Gazebo manda.
- **Las pruebas se saltan.** Falta cargar ROS: `source /opt/ros/jazzy/setup.bash && source install/setup.bash` (o tu entorno del paso 0).

## Qué probar para ir más rápido

La regla es **puntos primero, tiempo después**: un cambio debe mantener los 30 puntos y la validez antes de acortar el tiempo. Esto mide el Open lab en una ronda de `square100` `ccw` con la semilla 0, cambiando una cosa a la vez. **Ninguno está confirmado en Gazebo.**

| Cambio | Tiempo de la ronda |
|---|---:|
| Línea base de la solución | 32,58 s |
| `CRUISE_SPEED` 1,28 a 1,00 (`mission.py`) | 35,78 s |
| `TURN_FRONT` 1,19 a 0,90 (`turn_gate.py`) | 38,68 s |
| `FINISH_SPEED` 0,15 a 0,50 (`mission.py`) | 32,08 s |

Girar tarde o ir más lento cuesta tiempo, no puntos. Subir `CRUISE_SPEED` por encima de 1,28 no cambia nada (el coche solo entrega lo que dice su tabla medida). Lo único que bajó el tiempo fue el final, y es lo que el lab modela peor: si lo pruebas en Gazebo, mira que la parada siga dando los 3 puntos. El lab puede engañar: según los registros del equipo, el amortiguamiento de la esquina (`DAMPING` en `arc.py`) y la confirmación de la puerta (`CONFIRMATIONS` en `turn_gate.py`) hicieron falta en Gazebo aunque quitarlos no rompa nada en el lab. Y esta estrategia no tiene recuperación de atascos.

## El coche real

El mismo nodo está pensado para el coche (`ros2 launch robotek_course car.launch.py strategy:=my_open`); los pasos están en el capítulo 10. **Esta guía no verificó este código en el coche real**: todo lo medido aquí es de simulación. El color de las líneas cambia (paso 8) y el motor se calibró solo hasta unos 0,32 m/s, así que empieza despacio y con las ruedas en el aire.

## Qué sigue

Repite y anota (una cosa a la vez, tres rondas por cambio). Escribe una recuperación de atascos: ¿necesita un estado nuevo o basta un dato dentro de `RUN`? Y pasa al coche real en los capítulos 10 a 12.

## Resumen

- El juez da hasta 30 puntos (24 secciones, 3 vueltas, 3 por la parada); una ronda es válida si además no toca muros, deja 1 cm de margen, no pasa de 25° de volante y la parada se observa 30 s.
- Se elige primero por puntos y después por tiempo desde Start; el lab filtra ideas y Gazebo decide, y sus tiempos no se comparan.
- Para saber si un cambio ayuda: una cosa por fila, línea base primero, repetir y confirmar en Gazebo.

## Antes de seguir

- [ ] `python -m pytest course/tests/test_step_9.py -q` da `3 passed`.
- [ ] Corriste una ronda `ccw` y una `cw` en Gazebo y anotaste la línea base en `RESULTADOS.md`.
- [ ] Sabes explicar por qué 32,58 s (lab) y 34,80 s (Gazebo) no se comparan.
