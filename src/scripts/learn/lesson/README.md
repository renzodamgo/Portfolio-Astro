# Lecciones interactivas

Cada paso de una guía puede tener una **lección interactiva** en
`/learn/<guía>/leccion/<paso>/`: instrucciones a la derecha, editor y terminal a la izquierda y, cuando la tarea
mueve el coche, la vista 3D arriba. Todo corre en el navegador. Python es real (Pyodide); los comandos de ROS son
simulados, pero los suficientes para seguir la guía.

Hay lecciones para la guía del Open (pasos 0 a 9) y la del Obstacle (pasos 0 a 9), oct 2026. Esta nota explica
cómo están hechas, para añadir lecciones o hacer las de otra guía.

## Archivos

| Archivo | Qué hace |
|---|---|
| `src/pages/learn/<guía>/leccion/[step].astro` | La ruta. Una página por lección de `LESSONS[guía]`; anterior / siguiente. |
| `src/components/learn/LessonApp.astro` | El HTML y los estilos de la página (cabecera, vista 3D, editor, terminal, barra de instrucciones). |
| `src/components/learn/CarSim.astro` | El coche 3D de siempre. Con `lesson` no se monta solo: lo maneja `sim.ts`. |
| `src/components/learn/GuideStepPage.astro` | Pone el botón «Lección interactiva» en el paso de la guía si existe `findLesson(guía, paso)`. |
| `scripts/learn/lesson/app.ts` | El controlador: estado guardado, tareas, comprobaciones, editor ↔ Python ↔ terminal ↔ 3D. |
| `scripts/learn/lesson/types.ts` | La forma de una lección (`Lesson`, `Task`, `Check`, `World`, `SimGoal`, `Metrics`). |
| `scripts/learn/lesson/lessons/*.ts` | El contenido: una `Lesson` por paso (`open-0-4.ts`, `open-5-9.ts`, `obstacle.ts`). `index.ts` las reúne en `LESSONS`. |
| `scripts/learn/lesson/lessons/obstacle-fields.ts` | Las señales de los campos del reglamento que usan las lecciones del Obstacle. |
| `scripts/learn/lesson/lessons/worlds.ts` | Piezas de los mundos: anillos y pasillos de rocas, zonas, `f()` para la coma decimal. |
| `scripts/learn/lesson/py-worker.ts` | **Python en un Web Worker**: carga Pyodide (CDN jsDelivr, v314), monta el repositorio virtual y atiende `pytest`, `python3`, compilar, `diff` y el simulador del reto 3D. |
| `scripts/learn/lesson/python.ts` | El lado de la página: llamadas asíncronas al worker; `restart()` lo tira y arranca otro (Detener durante un cálculo largo). |
| `scripts/learn/lesson/shell.ts` | La terminal tipo Ubuntu: `ls`, `cd`, `cat`, `source`, `colcon`, `ros2`, `pytest`, `python3`, `code`. |
| `scripts/learn/lesson/terminal.ts` | El dibujo de la terminal: historial, Tab, Ctrl+C, Ctrl+L. |
| `scripts/learn/lesson/editor.ts` | El editor: pestañas, números de línea, colores de Python, Tab/Shift+Tab, Ctrl+S, Ctrl+Enter. |
| `scripts/learn/lesson/sim.ts` | La vista 3D de la lección: pide al worker que avance el simulador y dibuja el coche; el juez de cada fotograma; modo teclado (con el `SideWatch` de las señales). |
| `scripts/learn/car-sim/engine.ts` | El motor 3D. Para las lecciones añade `setWorld` (muros, rocas, marcas, señales y aparcamiento), `setView` y el rastro. |
| `scripts/learn/car-sim/physics.ts` | `setWalls()`: el LiDAR del dibujo ve las rocas de la lección. |
| `public/learn/py/` | El Python que corre en el navegador (ver abajo). |
| `tools/sync_lesson_py.sh` | Copia ese Python desde `robotek-learn`. |

## El Python del navegador (`public/learn/py/`)

Se copia del repositorio público del curso con `bash tools/sync_lesson_py.sh` (por defecto desde
`~/Projects/robotek-learn`). Vuelve a correrlo si cambian el mini simulador, las pruebas o la solución.

- `robotek_course/minisim.py`: el mini simulador del curso (coche con servo real, tabla de velocidades,
  giroscopio con sesgo, LiDAR con ruido y rayos perdidos, contactos).
- `tests/`: `conftest.py`, `helpers.py` y `test_step_1.py` a `test_step_8.py`, **las mismas pruebas del curso**.
- `ref/`: los módulos de la solución (`git show step-9:src/my_open/my_open/<m>.py`). Una lección los usa como pasos
  anteriores (solo lectura) o como punto de partida con huecos (`gaps`).
- `lesson_runtime.py` (propio de la web): la clase `Run` del Open, que mueve el coche del mini simulador con el
  `drive.py` del alumno.
- Para el Obstacle: `robotek_course/obstacle_base.py` y `obstacle_vision.py` (con `cv2` opcional: en la web no hay
  imágenes), `robotek_common/vehicle.py` y `lidar_odometry.py`, `obstacle/tests/` (`fieldsim.py` y
  `test_obstacle_step_1.py` a `_8.py`) y `obstacle/ref/` (`git show obstacle-step-9:src/my_obstacle/my_obstacle/<m>.py`).
- `obstacle_runtime.py` (propio de la web): una copia ligera del laboratorio del Obstacle
  (`robotek_evaluation.obstacle_lab`): el campo del reglamento con señales y aparcamiento como cajas, los actuadores del
  coche real (`open_lab.Actuators` con los valores de `real_car_v1.yaml`), LiDAR a 10 Hz con ruido y rayos perdidos,
  giroscopio a 50 Hz con sesgo, cámara a 6 fps que da las señales que ve (`dict(x, y, color)`), contactos y el
  `SideWatch` (una señal por el lado equivocado corta el intento). Corre la `Strategy` del alumno.

En Pyodide el repositorio vive en `/home/robotek/robotek-learn`, con la misma forma que el real:
`src/my_open/my_open/*.py` o `src/my_obstacle/my_obstacle/*.py` (los archivos del editor, según `lesson.package`),
`src/robotek_course/...`, `src/robotek_common/...` y `course/tests/[obstacle/]...`. Por eso las pruebas corren sin
cambios: `python3 -m pytest course/tests/obstacle/test_obstacle_step_4.py -k red_on_the_right`.

Todo Python corre en el worker: la página nunca se congela. Hacía falta por el aparcamiento del Obstacle, cuya
búsqueda A* piensa ~20 s en CPython de una vez (en el navegador, hasta un minuto): mientras tanto el coche espera
quieto y la página sigue respondiendo. Medido en el navegador: una vuelta del Obstacle (45 s simulados) se calcula en
6,9 s, unos 0,15 s por segundo simulado; las rondas van a 3 o 4 veces la velocidad real.

`pytest` se instala con micropip al abrir la lección; `numpy` con `loadPackage` cuando la lección lo pide
(`packages: ['numpy']`). La primera carga baja unos 10 MB; luego queda en caché del navegador.

## El `drive.py` de los retos 3D

En el navegador no hay ROS: el nodo del alumno se reemplaza por una función.

```python
def start():          # opcional: una vez, antes de arrancar
    ...

def drive(s):         # cada 0,02 s de simulación
    return speed, steer   # m/s pedidos y ángulo de las ruedas (rad), como el Twist del curso
```

`s` trae solo lo que tiene el coche real (simulación honesta): `s.time`, `s.dt`, `s.gyro` (con sesgo y ruido),
`s.scan` (un objeto `LaserScan` nuevo cada 0,1 s), `s.camera` (largos de línea azul y naranja, sintéticos, para el
paso 8) y `s.moved` (metros del último tick, estimados con la tabla de velocidades: no hay encoder). Si el módulo
define `status`, la página lo muestra y el juez lo puede leer (p. ej. `'DONE'`).

`lesson_runtime.Run(world)` borra los módulos `my_open.*` antes de importar, así cada intento usa el código
recién editado y empieza con las variables globales limpias. Si `drive` lanza una excepción, la página muestra el
traceback en la terminal y marca la línea en el editor.

## El Obstacle: la estrategia entera con los módulos del alumno

En el Obstacle el reto 3D no corre una función `drive(s)`: corre la `Strategy` del curso (`strategy.py`), que
importa `lane`, `localizer`, `signs`, `plan`, `corner`, `follow`, `mission` y `park` del paquete del alumno. Cada
lección le da al alumno **su módulo con huecos** (`gaps` sobre la solución del curso) y el resto de solo lectura (los
de pasos futuros también: la estrategia los necesita para correr; la nota de la pestaña lo dice). Así, desde el paso
1, el coche da vueltas en el campo del reglamento **con el código que acaba de escribir**: si `lane_pose` está mal,
se pierde; si `side_offset` cambia rojo por verde, el juez lo para en la primera señal.

`drive.py` es el pegamento: `make_strategy(parking)` crea la estrategia; `LAPS` y los parámetros (`stop_progress`,
`park_after`) acortan la ronda (una vuelta para los retos de un módulo, tres en los pasos 7 y 9).

Campos (los de `regulation_signs`, generados en `obstacle-fields.ts`), elegidos porque la referencia puntúa en el
laboratorio del curso, y comprobados con el runtime de la web y el juez de vueltas de la página:

| Campo | Reto | Resultado de la referencia |
|---|---|---|
| 4, antihorario | una vuelta (pasos 1, 3 a 6) | 1 vuelta, 45 s, sin faltas |
| 3, horario | una vuelta (paso 2: el sentido sale del escaneo) | 1 vuelta, 46,5 s |
| 0, antihorario, con aparcamiento | una vuelta y aparcar (paso 8) | aparcado del todo y en paralelo a los 88 s |
| 4 antihorario y 3 horario | tres vueltas (pasos 7 y 9) | 3 vueltas, 116 s y 120 s (40 puntos en el laboratorio) |
| 1, antihorario | — | la referencia toca una señal verde: un límite conocido (paso 9 de la guía) |

## Cómo se ve y cómo se juzga un intento

`sim.ts` crea el motor 3D del guía (`startEngine`) con un `createSim()` bloqueado: la física de JavaScript no
mueve el coche. En cada fotograma pide al worker que avance el tiempo real transcurrido (por `world.speedup`, con un
tope de 0,6 s por petición); mientras una petición está en marcha no pide otra. El worker devuelve la pose final y
**muestras** cada 0,02 s (Open) o 0,04 s (Obstacle), con las que el juez avanza. El LiDAR del dibujo se calcula en
JavaScript con los mismos muros, rocas, señales y topes (`sim.setWalls`).

El juez está en el TypeScript de la lección (`SimGoal`), con las `Metrics` de cada fotograma: tiempo, pose,
velocidad, volante, giro acumulado sin envolver (`turned`), segundos quieto (`still`), metros, `status`, la ronda
(`round`, del juez de secciones de la web si el objetivo pone `round: 'ccw' | 'cw'`) y un `memo` libre.

- `done(m)`: pasa.
- `fail(m)`: falla con un mensaje propio (p. ej. «Paraste muy cerca»).
- `track(m, dt)`: cuentas por fotograma (tiempo dentro de una franja).
- `passAtTimeout(m)`: pasa si se acaba el tiempo (retos de «aguanta»).
- Un choque (contacto del contorno con un muro o una roca) o una excepción **siempre** fallan.

El modo teclado (paso 0, `kind: 'keyboard'`) es al revés: la física de JavaScript manda y el alumno conduce con
W A S D (velocidad máxima 0,8 m/s).

## Una lección

```ts
export const step1: Lesson = {
  step: 1, title: 'El coche', summary: '…', guideUrl: '/learn/open-strategy/paso-1-el-coche/',
  packages: ['numpy'],                                  // opcional
  files: [
    { name: 'model.py', starter: MODEL_STARTER },        // el archivo del paso, con TODO
    { name: 'drive.py', starter: CIRCLE_DRIVE },
    { name: 'heading.py', ref: 'heading', readonly: true, note: 'Tu paso 2 (la solución del curso).' },
    { name: 'mission.py', ref: 'mission', gaps: [[textoDeLaSolución, '        pass   # TODO (tarea 1)\n']] },
  ],
  tasks: [ /* Task[] */ ],
};
```

Cada `Task` tiene `id`, `title`, `body` (HTML en castellano), `hint` (se ve tras el primer fallo), `solution` (tras
el tercero), `file` (la pestaña que abre) y `files` (archivos que escribe la primera vez que se abre: el `drive.py`
de cada reto). Y una comprobación (`check`):

| `kind` | Pasa cuando |
|---|---|
| `command` | el alumno escribe en la terminal un comando que cumple `match(e, estadoDelShell, archivos)` |
| `pytest` | `pytest course/tests/<file> [-k k]` sale con 0 (botón **Comprobar**, o el alumno lo escribe) |
| `python` | unas líneas de `assert` en Python no fallan (cuando ninguna prueba del curso aísla la pieza) |
| `sim` | el `drive.py` cumple el `SimGoal` en el mundo `world` (botón **▶ Ejecutar en 3D** o `ros2 run my_open drive`); `tests` corre antes unas pruebas |
| `keyboard` | el alumno, conduciendo, cumple el `SimGoal` |
| `choice` | elige la opción correcta (las otras se marcan y suman un fallo) |

Las tareas se desbloquean en orden. Las de terminal pasan solas a la siguiente; las demás muestran
**Siguiente →**. El progreso, los archivos y el estado de la terminal se guardan en `localStorage`
(`learn-lesson-<guía>-<paso>`); **Empezar de cero** lo borra. Para depurar en la consola:
`window.__lesson` (`python()`, `sim`, `lesson`).

### Mundos (`World`)

`field: 'field'` es el campo del Open (muros y la isla); `'floor'` solo los muros de fuera. `rocks` son cajas
`[cx, cy, ancho, alto]` (se dibujan como piedras y chocan como cajas), `marks` son zonas en el suelo (círculo, anillo
o rectángulo con `w`/`h`), `start: [x, y, yaw]`, `steer0`, `speed0`, `bias` (sesgo del giroscopio), `camera`
(`'ccw' | 'cw'`), `seed`, `view` (`'top' | 'chase'`), `trail`, `speedup` y `realistic` (`false`: coche ideal, como
las pruebas del paso 1).

## Cómo se afinó cada reto

Un reto vale si **la respuesta correcta pasa y los errores típicos chocan o fallan**. Antes de escribirlo en
TypeScript se probó en Python con el mismo `lesson_runtime.py` y los módulos de la solución, barriendo el valor
que pide la tarea. Ejemplos del Open:

| Reto | Pasa | Falla |
|---|---|---|
| Rodea la roca (paso 1) | `STEER` de 0,215 a 0,27 rad (radio 0,42 a 0,54 m; correcto 0,23) | 0 (recto), 0,29 y el tope 0,307 |
| El garaje (paso 1) | `TURN_TIME` de 1,10 a 1,22 s (correcto 1,163) | 1,05 o menos, 1,28 o más |
| El pasillo (paso 2) | con `calibrate` | sin calibrar (sesgo 0,06 rad/s) choca a los 3,5 s |
| El camino corto (paso 2) | con `wrap` | sin `wrap` choca a los 0,6 s |
| Frena a tiempo (paso 3) | `STOP_AT` de 0,30 a 0,45 m | 0 choca; 0,2 para muy cerca; 0,5 o más para lejos |
| La recta sur (paso 4) | la solución (≈0,18 m de la isla) | `GAIN = 0` (0,45 m), signo al revés (0,75 m), sin `LIMIT` choca |
| La ronda (pasos 7 a 9) | 30 puntos en ≈32 s en los dos sentidos | |

Las tareas de código se revisaron igual: con el archivo inicial la prueba **falla** y con la solución del curso
**pasa**. En el Open, dos que pasaban con el archivo inicial se cambiaron por una pregunta y por un `assert` propio;
en el Obstacle, la de `scan_points` (la prueba acepta puntos en cero) se juntó con la del sentido. Las pruebas del paso
7 del Obstacle corren rondas enteras: tardan unos 10 s en CPython y bastante más en el navegador.

## Añadir o cambiar una lección

1. Escribe la `Lesson` en `lessons/<guía>-*.ts` y añádela a `LESSONS` en `lessons/index.ts`.
2. Si la guía es nueva, crea `src/pages/learn/<guía>/leccion/[step].astro` (copia la del Open) y, si usa otro
   paquete o pruebas, amplía `tools/sync_lesson_py.sh` y la lista de archivos de `python.ts`.
3. Comprueba: `bunx astro build`; luego abre la lección y, para cada tarea, que el archivo inicial falla y la
   solución pasa.
4. La vista 3D solo avanza con la pestaña visible (usa `requestAnimationFrame`); el worker se puede probar sin ella:
   `await __lesson.python.simStart('obstacle', {...})` y `await __lesson.python.simAdvance(1)` en la consola.

## Límites conocidos

- Los comandos de ROS son simulados: no hay nodos, tópicos ni Gazebo. `ros2 run my_open drive` corre el reto 3D.
- La cámara del paso 8 da largos de línea sintéticos con fotogramas borrosos, no imágenes.
- Física: la del mini simulador (modelo de bicicleta). Es la misma de las pruebas del curso, no la de Gazebo.
- No probado en el móvil: la página apila las columnas bajo 900 px.
