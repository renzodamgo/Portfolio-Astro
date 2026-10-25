---
guide: "open-strategy"
order: 9
slug: "paso-9-puntuar-y-medir"
title: "Puntuar y medir"
summary: "Calcula los puntos y mide el tiempo de cada ronda."
tag: "step-9"
compareFrom: "step-8"
---

Tu estrategia ya da las tres vueltas y decide el sentido sola. Este paso no añade comportamiento: enseña a **medir**. Vas a ver qué cuenta el juez, cómo repetir una ronda sin Gazebo, qué tan lejos se puede confiar en cada medida y cómo anotar tus intentos para saber si un cambio mejora algo de verdad. Al final, qué probar para ir más rápido y qué hacer con el coche real.

## Lo que vas a ver

No cambia nada en la pista. Cambia lo que haces con ella: corres rondas, miras el resumen que imprime el árbitro, repites el Open lab y rellenas tu tabla en `RESULTADOS.md`. La referencia de este paso es solo ese archivo, con las rondas medidas de la solución.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-9.json"></div>

*Repetición de una ronda en sentido horario con las secciones del tapete que se van iluminando al puntuar.*

## La idea

### Qué puntúa el juez

El juez (`robotek_evaluation.rule_judge`) aplica las reglas publicadas del Open sobre la pose real del coche, que el árbitro guardó aparte (la estrategia nunca la ve). Son 30 puntos como máximo:

| Regla | Puntos | Qué cuenta |
|---|---:|---|
| 1.1 Secciones | hasta 24 | una por cada sección del tapete de la que sale el coche, en el sentido de la ronda |
| 1.2 Vueltas | 3 | una por vuelta completa (ocho secciones) |
| 1.3 Parada | 3 | parar con todo el coche dentro de la sección de salida, quieto 15 s |

Son **estimaciones de simulación**, no puntuación oficial. Fíjate en lo que no puntúa: no hay puntos por ir rápido ni por «parecer» que terminó. El `DONE` de la estrategia tampoco: es el árbitro quien busca en la pose real el instante en que el coche se detuvo para siempre.

### Qué es una ronda válida

Sacar 30 puntos no basta para que una ronda sea *válida*. Además de eso (`standard_validation`):

- el máximo de puntos, sin faltas de regla;
- la parada observada al menos **30 s** (el árbitro espera ese tiempo antes de cerrar la ronda);
- **ningún contacto** con un muro (sensores de contacto de Gazebo);
- un margen mínimo a los muros de **1 cm** o más;
- un ángulo de dirección que nunca pase de **25°** (el juez tolera hasta 25,5°).

Son umbrales internos del equipo, no reglas de la competencia. Por eso el resumen distingue «Puntos» de «Válida».

### Rondas, tiempo y orden

El árbitro termina una ronda a los 180 s, a los 30 s sin sección nueva, o cuando el coche dio las tres vueltas y quedó quieto. Todo se guarda en `~/robotek_runs/<fecha>-<nombre>/` (`audit_pose.csv`, `events.jsonl`, `manifest.json`, `world.sdf` y `rule_judge.json`). Para volver a puntuar la última ronda, o una concreta:

```bash
ros2 run robotek_course score
ros2 run robotek_course score ~/robotek_runs/<carpeta>
```

El tiempo cuenta **desde Start hasta que el coche se detiene**, no hasta el final de los 30 s de observación. Hay dos relojes:

- **Tiempo simulado:** el que usa el juez y el que imprime `score`. Es el que debes comparar.
- **Tiempo de pared:** el reloj real. `rule_judge.json` también lo guarda (`time_from_start_wall_seconds`), pero depende de tu computador y de si la GUI está abierta.

Para elegir entre dos intentos: **primero los puntos, después el tiempo**. Un intento de 27 puntos en 30 s pierde contra uno de 30 puntos en 40 s. Las vueltas (10,9 / 10,6 / 11,0 s) son parciales de ese total.

### El Open lab: filtro rápido, no autoridad

Gazebo tarda lo que tarda una ronda real. Para probar cambios existe el **Open lab**: un modelo de la ronda en Python con el campo real, el modelo medido del servo y del motor, el LiDAR simulado y **el mismo juez**. Corre las 12 rondas del set estándar (6 campos por 2 sentidos):

```bash
python3 -m robotek_evaluation.open_lab --strategy my_open.strategy:Strategy
python3 -m robotek_evaluation.open_lab --strategy my_open.strategy:Strategy --field square100 --direction ccw
```

Lo que el propio código del lab dice que **no modela**: el deslizamiento de las ruedas, la dinámica del plugin Ackermann de Gazebo, las imágenes de la cámara (entrega el sentido directamente tras un retardo), las fuerzas de contacto y el motor bajo carga. Consecuencias:

- Una ronda que **falla** en el lab es una mala señal.
- Una que **pasa** no demuestra que pase en Gazebo.
- Los tiempos no son los mismos: `square100` ccw da 32,58 s en el lab y 34,80 s en Gazebo. No se ha investigado de dónde sale esa diferencia.

Regla de trabajo: el lab filtra ideas; **Gazebo decide**.

### Las 12 rondas de la solución

Resultados del Open lab (puntos · tiempo desde Start):

| Campo | ccw | cw |
|---|---:|---:|
| `square100` | 30 · 32,58 s | 30 · 32,58 s |
| `square180` | 30 · 50,18 s | 30 · 50,28 s |
| `rect100x180` | 30 · 40,58 s | 30 · 40,58 s |
| `rect180x100` | 30 · 42,28 s | 30 · 42,28 s |
| `shift140` | 30 · 40,58 s | 30 · 42,08 s |
| `east140x100` | 30 · 36,78 s | 30 · 38,28 s |

12 de 12 válidas, tiempo medio 40,75 s. Y las dos rondas de Gazebo:

| Sentido | Puntos | Tiempo | Vueltas (s) | Margen mínimo | Válida |
|---|---:|---:|---|---:|:---:|
| `ccw` | 30 de 30 | 34,80 s | 10,9 / 10,6 / 11,0 | 11,9 cm | sí |
| `cw` | 30 de 30 | 34,90 s | 10,9 / 10,6 / 11,0 | 11,1 cm | sí |

## Escríbelo

Aquí no hay código de estrategia nuevo. Haz esto en orden:

1. **Corre las 12 rondas** del Open lab con tu `Strategy` y compara con la tabla de arriba. Si algo da menos de 30 puntos, vuelve al paso que corresponda (la calibración del paso 2 o la última esquina del paso 7 son los sospechosos habituales).
2. **Corre una ronda `ccw` y otra `cw` en Gazebo** con GUI y anota el resultado de `score`.
3. **Crea `RESULTADOS.md`** en `src/my_open/` (la referencia trae el suyo) y rellena tu tabla: una fila por intento, con puntos primero y tiempo después.

<details>
<summary>Ver la referencia: la tabla de RESULTADOS.md para llenar</summary>

```markdown
| Fecha | Cambio | Sentido | Puntos | Tiempo | Válida |
|---|---|---|---:|---:|:---:|
| | | | | | |
```

Una fila por ronda. En «Cambio» escribe lo único que modificaste desde la fila anterior, por ejemplo `CRUISE_SPEED 1.28 a 1.40`. Cambia **una cosa a la vez**: si cambias dos, no sabrás cuál ayudó.

</details>

## Pruébalo

Las pruebas de este paso son el examen. Necesitan los paquetes de ROS instalados (sin ellos se saltan solas):

Las 14 rondas medidas, ordenadas como lo hace el juez: puntos primero, tiempo después. No compares tiempos entre Gazebo y el laboratorio:

<div data-widget="results-table"></div>

```bash
source /opt/ros/jazzy/setup.bash && source install/setup.bash
python3 -m pytest course/tests/test_step_9.py -q
```

Comprueban que `square100` da 30 puntos, es válida y tarda menos de 34 s en los dos sentidos, y que `square180` ccw y `rect100x180` cw también dan 30 puntos válidos.

En Gazebo, las dos rondas de siempre:

```bash
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=ccw
ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=cw
```

Esperado: 30 de 30 y ronda válida en las dos.

## Si algo falla

- **`score` dice «No hay rondas en ~/robotek_runs».** No terminó ninguna ronda con carpeta. Corre antes `round.launch.py`. Si el árbitro no pudo puntuar, deja los archivos y te dice cómo repetirlo con `score <carpeta>`.
- **Pasa en el lab pero no en Gazebo.** Es el caso esperado de un lab más simple. Gazebo manda.
- **30 puntos pero «Válida: no».** Mira la lista entre paréntesis: puede ser un contacto con un muro, un margen menor de 1 cm o que la parada no se observó 30 s.
- **Tu tiempo difiere unas décimas.** Hay ruido en los sensores. Para decidir si un cambio mejora, repite varias rondas antes de concluir.

## Qué probar para ir más rápido

La regla es **puntos primero, tiempo después**. Cada cambio tiene que mantener los 30 puntos y la validez antes de acortar el tiempo. Ideas, una a la vez:

1. **`CRUISE_SPEED`** (`mission.py`). Es la velocidad que se le pide; la que el coche alcanza sale de una tabla medida (1,28 de comando da 0,60 m/s). Comprueba el efecto en Gazebo antes de creerlo.
2. **`TURN_FRONT`** (`turn_gate.py`). Girar antes o después. El lab de la guía anterior midió, en `square100`, que girar tarde cuesta tiempo: con la pared a 0,9 m, +6,1 s; a 0,6 m, +17,3 s. En el lab, girar tarde costó tiempo, no puntos.
3. **`LOOKAHEAD`** (`turn_gate.py`). Con 0,05 m en vez de 0,35 m el lab midió +2,4 s.
4. **La última esquina.** Es lenta a propósito (protege 3 puntos). Se podría acortar la rampa de frenado, pero cuida la parada dentro de la sección de salida.

Para los límites honestos: amortiguamiento, aflojado y confirmación en dos escaneos no cambian nada en el lab y sin embargo hacen falta en Gazebo. El lab no reproduce esos fallos. Y esta estrategia no tiene **recuperación de atascos**: si el coche se atasca, no hace nada.

## El coche real

El mismo nodo está pensado para correr en el coche (una Raspberry Pi). El paquete `robotek_hardware` traduce `/scan`, `/imu`, `/camera/image` y `/start` a los nombres de la placa y el LiDAR del coche, y tu `/cmd_vel_raw` al servo y al motor. Se lanza con:

```bash
ros2 launch robotek_course car.launch.py strategy:=my_open
```

Los pasos para preparar el Pi, los drivers y la calibración están en `src/robotek_hardware/README.md`. Cuando los LED de la placa están en verde, **una pulsación del botón** es Start (`/start`). **Otra pulsación** detiene el coche (`/robotek/stop`): el nodo llama a `operator_stop()` y la misión pasa a `OPERATOR_STOP`, sin volver a arrancar hasta lanzar de nuevo.

Cosas que debes saber antes de poner el coche en la pista:

- **Esta guía no verificó este código en el coche real.** Todo lo medido aquí es de simulación. El coche del equipo corrió otra estrategia.
- **El color cambia.** Los rangos de `line_lengths` son los del simulador (paso 8).
- **La velocidad real hay que medirla.** El README del hardware dice que el motor se calibró con la batería baja y solo hasta unos 0,32 m/s. Empieza con velocidades bajas.
- **Prueba con las ruedas en el aire** antes de la pista.

## Qué sigue

- Anota tus rondas y cambia una cosa a la vez.
- Prueba un campo nuevo copiando un `.sdf` de `robotek_gazebo/worlds`.
- Escribe la recuperación de atascos: «si en 1,5 s avancé menos de 2 cm, retrocede 0,8 s». ¿Necesita un estado nuevo o basta un dato dentro de `RUN`?
- Mejora la visión para el color real del coche.
- Corre en el coche, con velocidades bajas, y compara con Gazebo.

## Compara

```bash
bash tools/compare-step.sh 8 9     # solo añade RESULTADOS.md
bash tools/compare-step.sh 9       # tu árbol contra el paso 9
```
