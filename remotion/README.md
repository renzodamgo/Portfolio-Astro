# Videos de la guía Open (Remotion)

Un video corto por capítulo de la guía de la estrategia Open (`src/content/learn/steps/open-strategy/`), en
español, sin audio: solo gráficos animados. Cada video enseña lo que ese capítulo añade a la estrategia, y la
barra de abajo muestra lo que ya tiene la estrategia, capítulo a capítulo.

| Composición (id = slug del capítulo) | Qué muestra |
|---|---|
| `paso-0-instalar-y-preparar` | la terminal (clonar, compilar, lanzar), las seis palabras, conducir con el teclado |
| `paso-1-el-coche` | modelo de bicicleta: δ, centro del círculo, R = L / tan δ, el tope de 17,6° |
| `paso-2-el-rumbo` | rumbo = suma del giroscopio, ley P, el sesgo y la calibración, `wrap` |
| `paso-3-ver-el-campo` | el escaneo del LiDAR y los cinco números (`left`, `right`, `front_axis`, `island_end`, `wall_heading`) |
| `paso-4-seguir-la-isla` | la ley de carril a 25 cm (el banco de la guía) y el alto a 1,19 m |
| `paso-5-la-esquina` | meta +90°, volante a tope hasta 17° (0,3 rad) de la meta, soltar a tiempo y amortiguar |
| `paso-6-cuando-girar` | la puerta de giro (tres condiciones) en vivo y la distancia recorrida sin encoder |
| `paso-7-la-mision` | SETUP → RUN → STOP en una ronda completa de 12 esquinas: frenar antes de cada una, la pared corrige el rumbo |
| `paso-8-la-direccion` | los votos de la cámara (la secuencia de la guía) y las dos vueltas, ccw y cw |
| `paso-9-puntuar-y-medir` | secciones, vueltas y parada (30 puntos), ronda válida, puntos antes que tiempo |
| `armar-y-conectar-el-coche` | los dibujos de montaje de la guía (`public/learn/assembly`), paso a paso |
| `paso-10-el-coche-real` | las comprobaciones 3.1–3.6, la primera ronda y lo que el simulador no modela |
| `coche-del-equipo-v5` | el orden, los ejes de la IMU, el servo, la tabla del motor y el lanzamiento del v5 |
| `paso-11-solucion-de-problemas` | tres reglas, el giroscopio invertido (caso 4), los intentos del equipo, los síntomas |
| `paso-12-afinar` | los ajustes medidos en el lab frente a la base de 41,82 s y su riesgo |

## De dónde salen los movimientos

Las trayectorias no están dibujadas a mano: `src/sim.ts` es una copia en TypeScript de la estrategia del curso
(`robotek-learn/src/my_open/my_open/`: `perception.py`, `arc.py`, `turn_gate.py` y `mission.py`, versión del
12 nov 2026) sobre un modelo de bicicleta con el servo (0,06 s de retardo) y la tabla del motor del coche real, en
el campo Open de 3 × 3 m con la isla de 1 × 1 m. Hace las 12 esquinas y para en la sección de salida a 33,9 s
desde Start (el Open lab da 33,78 s en `square100`; Gazebo, 35,56 s). La esquina es volante a tope hasta 0,3 rad de la meta y
después `KP * error - 0,1 * gyro`; el coche frena a 1,0 m/s pedidos antes de cada esquina; la distancia recorrida
es cuánto se acercó la pared de enfrente. La primera esquina la decide el lado abierto, como dice el paso 6.

Lo que simplifica: sensores sin ruido ni rayos perdidos, giroscopio perfecto (la corrección del rumbo con la
pared de la isla está, pero no tiene nada que corregir), la cámara decide el sentido a los 0,75 s de Start, e
`island_end` y `wall_heading` salen de la geometría (el rayo que deja de caer en la pared de la isla y el ángulo
real con ella), sin el ajuste de la recta. Las cifras de los textos salen de la guía, no de esta simulación. Si
cambia la estrategia, hay que copiar el cambio a `src/sim.ts`.

Los 15 videos se volvieron a renderizar el 12 nov 2026 con esta versión.

## Volver a renderizar

Requisitos: Node 22 y las dependencias (`npm install` en esta carpeta). La primera vez Remotion descarga su
Chrome headless.

```bash
cd remotion
npm install
npm run render:all                          # todos los videos → out/<slug>.mp4
node render-all.mjs paso-5-la-esquina       # solo uno (o varios slugs)
npm run studio                              # editor en el navegador para ver y ajustar
npx remotion still src/index.ts paso-3-ver-el-campo out/still.png --frame=300   # un fotograma
```

1920 × 1080, 30 fps, H.264 (CRF 20), de 32 a 46 s cada uno; los 15 tardan unos 10 minutos en un Mac M-series.
`out/` está en `.gitignore`.

## Publicar en la guía

Cada página de la guía muestra su video justo después de la introducción:

```bash
node publish.mjs                                   # out/*.mp4 y un póster .jpg → public/learn/videos/open/
python3 ../tools/learn/insert_step_videos.py ..    # el bloque <video> en cada página (lo reemplaza si ya está)
```

El bloque va entre `<!-- step-video:start -->` y `<!-- step-video:end -->`; el póster es el fotograma que dice
`POSTER_SECONDS` en `publish.mjs`.

## Estructura

- `src/steps.ts`: los capítulos, su orden y el bloque que añade cada uno (la barra de abajo).
- `src/sim.ts`: la v5 en TypeScript, el campo y el LiDAR.
- `src/components/`: el campo y el coche (`Field.tsx`), el marco, las tarjetas y los gráficos (`ui.tsx`).
- `src/videos/`: un archivo por capítulo; cada uno exporta su componente y su duración (`<ID>_SECONDS`).
- `remotion.config.ts`: la carpeta pública es la del sitio (`../public`), para usar los dibujos de montaje.
