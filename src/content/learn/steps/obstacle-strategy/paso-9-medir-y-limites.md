---
guide: "obstacle-strategy"
order: 9
slug: "paso-9-medir-y-limites"
title: "Puntuar y medir"
summary: "Mide la estrategia con el juez en el laboratorio y en Gazebo, compara versiones con números y conoce los límites de la solución actual."
tag: "obstacle-step-9"
compareFrom: "obstacle-step-8"
---

Una estrategia que «parece ir bien» no sirve para decidir nada. En este paso mides la tuya como lo hizo el equipo: muchas rondas en el laboratorio para comparar versiones, Gazebo para confirmar, y una tabla con puntos y tiempos. Y lees, con los mismos números, dónde falla todavía la solución de referencia.

## Lo que vas a ver

```text
obstacle-0-ccw-park    s0  pts=55/55 t=177.7  VALID    park=parked_fully_parallel
obstacle-0-cw-park     s0  pts= 1/55 t=7.3    invalid contact:sign_green_1 park=not_parked
...
valid 11/20  mean time of the valid 152.8 s  wall 73 s
```

Una línea por ronda: puntos estimados sobre el máximo, tiempo desde Start, si es válida y, si falló, la primera causa; con aparcamiento, cómo quedó (`park=`). `--early` corta una ronda 1,5 s después de un lado incorrecto claro (el juez la sigue puntuando): las tandas largas tardan la mitad.

> **Con aparcamiento el número baila.** La búsqueda del aparcamiento tiene un tope de tiempo de reloj; con 12 rondas en paralelo la máquina va cargada y encuentra menos planes. La misma solución dio 11 de 20 en una tanda y 9 en otra. Compara versiones en la misma máquina y con la misma carga.

## La idea

### Qué puntúa el juez

El juez del curso es el que usa el equipo en sus rondas de Gazebo: secciones (24), vueltas (3), parar en la sección de salida (3), señales sin mover tras las tres vueltas (10) y aparcamiento (15 del todo y en paralelo, 7 a medias). Con aparcamiento el máximo de este curso es **55**. Una ronda con un lado incorrecto termina en ese momento: cuenta lo hecho hasta ahí.

Una ronda es **válida** si además tiene el máximo, no tiene faltas, tiene los 30 s de parada observados, dura menos de 180 s y deja al menos 1 cm a los muros durante las vueltas (al aparcar se va pegado al muro: ahí no cuenta). Todo es una **estimación de simulación**, no una puntuación oficial.

### Medir bien

- **Muchas rondas, no una.** Con ruido, una ronda dice poco. El set de prueba son los campos 0 a 4 en los dos sentidos con 5 semillas de ruido: 50 rondas en menos de un minuto en el laboratorio.
- **Campos nuevos.** Si ajustas mirando solo el set de prueba, acabas resolviendo esos 10 campos. Por eso hay que mirar también los campos 5 a 49, que no se usaron para ajustar nada. Al cambiar el volante del paso 6, el set de prueba bajó de 44 a 35 de 50, pero los campos nuevos subieron de 28 a 38 de 40 (y los 100 campos, de 77 a 88).
- **Primero puntos, después tiempo.** Entre dos versiones gana la de más puntos; a igualdad, la de menos tiempo total desde Start.
- **El laboratorio filtra, Gazebo decide.** Una versión que mejora el laboratorio se confirma en Gazebo antes de darla por buena.

### Cómo llegó la referencia hasta aquí

| Cambio | Set de prueba (50) | 100 campos |
|---|---:|---:|
| Primera versión (latch por señal) | 15 | — |
| Memoria por asiento + línea planificada + esquinas recta-arco-recta | 32 | — |
| Volante con anticipación (contra un punto adelantado) | 33 | — |
| Parar a mirar las señales sin color | 44 | 77 |
| Volante corrigiendo contra el punto de al lado | 35 | **88** |

El último cambio bajó el set de prueba y subió los campos nuevos: por eso se quedó.

## Los resultados de la referencia

| Dónde | Prueba | Resultado |
|---|---|---|
| Laboratorio | Tres vueltas, campos 0–49 × CCW/CW (100 rondas) | **88 válidas** |
| Laboratorio | Con aparcamiento, campos 0–9 × CCW/CW | **11 de 20 con 55 puntos** (en otra tanda, 9), 130–178 s |
| Laboratorio | Solo aparcamiento, 10 intentos | 7–9 aparcados del todo, 35–70 s |
| Gazebo (coche real, sin ventana) | Campo 4 CCW, sin aparcamiento | **40 puntos, válida, 115,6 s** |
| Gazebo | Campo 4 CCW, con aparcamiento (v2 del equipo) | 37 puntos: las vueltas bien, el aparcamiento **no terminó** en 180 s |
| Gazebo, lanzador del curso | Campo 4 CCW, con aparcamiento (`my_obstacle`) | **47 de 55**, 165,8 s: tres vueltas (42,0 / 35,8 / 36,4 s), señales y parada completas; aparcamiento a medias (7) |

## Lo que todavía falla

Esto es lo que mejorará la referencia en las próximas semanas, y un buen sitio para que pruebes tus ideas:

1. **El aparcamiento en Gazebo.** Una corrección del plan puede tardar segundos de cálculo, y mientras tanto el nodo no atiende los sensores: en la ronda de Gazebo se perdieron unos 18 s de simulación. Con las vueltas en unos 115 s, al aparcamiento le queda poco más de un minuto. Ideas: calcular en otro hilo, limitar la búsqueda por número de nodos, o una maniobra fija sin búsqueda (se probó una de «entrar de culata y zigzag»: en el laboratorio aparcó peor, 4 de 20).
2. **El cruce de lado a lado en una esquina** (verde interior al final de una recta y roja exterior al inicio de la siguiente, o al revés). La mejor línea deja 3,4 cm con un seguimiento perfecto, y el seguimiento real se come ese margen. En los campos 0 y 47 CW esa esquina aparece justo en la salida y el coche no tiene sitio para prepararla.
3. **La cámara en CW.** Girada 4,4° a la izquierda, del lado de la isla solo ve hasta 28,9°. «Mirar» lo resuelve parando, pero cuesta unos 2 s por señal en la primera vuelta. Centrar la cámara en el coche real ayudaría.
4. **La salida con la primera señal al final de la recta**, a 0,6 m: el coche no puede retroceder (el asiento de detrás puede estar ocupado) y no siempre llega al lado correcto.
5. **Las vueltas con aparcamiento en CW.** Con las señales de la salida movidas a la fila interior y los topes junto a la recta, varios campos CW fallan por contacto en la vuelta 2 o 3. Hay que medirlo campo a campo.

## Hazlo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_9.py -q        # 2 passed: tu RESULTADOS.md y una ronda del laboratorio
python3 -m robotek_evaluation.obstacle_lab --strategy my_obstacle.strategy:Strategy --layouts 0-4 --seeds 0-4 --early --workers 8
python3 -m robotek_evaluation.obstacle_lab --strategy my_obstacle.strategy:Strategy --layouts 0-49 --early --workers 8
python3 -m robotek_evaluation.obstacle_lab --strategy my_obstacle.strategy:Strategy --parking --layouts 0-9 --tmax 200 --workers 8
ros2 launch robotek_course obstacle_round.launch.py strategy:=my_obstacle seed:=4 direction:=ccw parking:=true gui:=false
ros2 run robotek_course score_obstacle
```

Anota en `src/my_obstacle/RESULTADOS.md` cada versión: qué cambiaste, los tres números del laboratorio y las rondas de Gazebo (puntos, tiempo, válida o no y por qué).

## Si algo falla

- **El laboratorio y Gazebo no coinciden.** Es normal en los márgenes de 1–2 cm: el laboratorio no modela el deslizamiento ni la imagen real de la cámara.
- **Gazebo va lento o una ronda sale rara.** Cierra lo que esté usando la CPU y repite: con el ordenador cargado, el nodo se queda atrás respecto al reloj de la simulación y la ronda no vale para comparar.

## Resumen

- Mide con muchas rondas, separa campos de ajuste y campos nuevos, y confirma en Gazebo.
- La referencia: 88 de 100 con tres vueltas, 11 de 20 con aparcamiento en el laboratorio, 40 puntos en Gazebo.
- Lo pendiente es el aparcamiento en Gazebo, el cruce de lado en una esquina y la cámara en CW.

## Antes de seguir

- [ ] `test_obstacle_step_9.py` da `2 passed`.
- [ ] Tienes tu tabla en `RESULTADOS.md` con al menos el set de prueba y los campos nuevos.
- [ ] Una ronda de Gazebo puntuada con `score_obstacle`.
- [ ] `python3 course/obstacle/verify_step.py 9` (exige 55 puntos y una ronda válida; hoy la referencia no siempre llega: ver los límites).
