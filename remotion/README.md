# Videos de la guía Open (Remotion)

Un video corto por capítulo de la guía de la estrategia Open (`src/content/learn/steps/open-strategy/`), en
español, sin audio: solo gráficos animados. Cada video enseña lo que ese capítulo añade a la estrategia, y la
barra de abajo muestra lo que ya tiene la estrategia, capítulo a capítulo.

| Composición (id = slug del capítulo) | Qué muestra |
|---|---|
| `paso-0-instalar-y-preparar` | la terminal (clonar, compilar, lanzar), las seis palabras, conducir con el teclado |
| `paso-1-el-coche` | modelo de bicicleta: δ, centro del círculo, R = L / tan δ, el tope de 17,6° |
| `paso-2-el-rumbo` | rumbo = suma del giroscopio, ley P, el sesgo y la calibración, `wrap` |
| `paso-3-ver-el-campo` | el escaneo del LiDAR y los cuatro números (`left`, `right`, `front_axis`, `island_end`) |
| `paso-4-seguir-la-isla` | la ley de carril a 25 cm (el banco de la guía) y el alto a 1,19 m |
| `paso-5-la-esquina` | meta +90°, la referencia en rampa a 1,62 rad/s, anticipar y amortiguar |
| `paso-6-cuando-girar` | la puerta de giro, condición a condición, en vivo |
| `paso-7-la-mision` | SETUP → RUN → STOP en una ronda completa de 12 esquinas |
| `paso-8-la-direccion` | los votos de la cámara (la secuencia de la guía) y las dos vueltas, ccw y cw |
| `paso-9-puntuar-y-medir` | secciones, vueltas y parada (30 puntos), ronda válida, puntos antes que tiempo |
| `armar-y-conectar-el-coche` | los dibujos de montaje de la guía (`public/learn/assembly`), paso a paso |
| `paso-10-el-coche-real` | las comprobaciones 3.1–3.6, la primera ronda y lo que el simulador no modela |
| `coche-del-equipo-v5` | el orden, los ejes de la IMU, el servo, la tabla del motor y el lanzamiento del v5 |
| `paso-11-solucion-de-problemas` | tres reglas, el giroscopio invertido (caso 4), los intentos del equipo, los síntomas |
| `paso-12-afinar` | los ajustes medidos en el lab frente a la base de 40,75 s y su riesgo |

## De dónde salen los movimientos

Las trayectorias no están dibujadas a mano: `src/sim.ts` es una copia en TypeScript de la Open v5
(`WRO-Strategies/src/robotek_open/robotek_open/v5/mission.py` y `scene.py`) sobre un modelo de bicicleta con el
servo (0,06 s de retardo) y la tabla del motor del coche real, en el campo Open de 3 × 3 m con la isla de 1 × 1 m.
Hace las 12 esquinas y para en la sección de salida a 32,4 s desde Start (el Open lab da 32,58 s en
`square100`; Gazebo, 34,80 s). La primera esquina la decide el lado abierto en x ≈ 0,41 m, como dice el paso 6.

Lo que simplifica: sensores sin ruido ni rayos perdidos, la distancia recorrida es la real (el coche usa
odometría con LiDAR), la cámara decide el sentido a los 0,75 s de Start y `island_end` sale de la geometría
(el rayo que deja de caer en la pared de la isla), sin el ajuste de la recta. Las cifras de los textos salen de la
guía, no de esta simulación. Si cambia la v5, hay que copiar el cambio a `src/sim.ts`.

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

1920 × 1080, 30 fps, H.264 (CRF 20), de 32 a 46 s cada uno; los 15 tardan unos 4 minutos en un Mac M-series.
`out/` está en `.gitignore`: los MP4 no van al repositorio.

## Estructura

- `src/steps.ts`: los capítulos, su orden y el bloque que añade cada uno (la barra de abajo).
- `src/sim.ts`: la v5 en TypeScript, el campo y el LiDAR.
- `src/components/`: el campo y el coche (`Field.tsx`), el marco, las tarjetas y los gráficos (`ui.tsx`).
- `src/videos/`: un archivo por capítulo; cada uno exporta su componente y su duración (`<ID>_SECONDS`).
- `remotion.config.ts`: la carpeta pública es la del sitio (`../public`), para usar los dibujos de montaje.
