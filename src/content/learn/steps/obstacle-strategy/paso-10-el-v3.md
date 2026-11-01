---
guide: "obstacle-strategy"
order: 10
slug: "paso-10-el-v3"
title: "El v3: lo que aprendimos del top 3"
summary: "Lo que cambió en la estrategia del equipo después del curso: un aparcamiento de lazo cerrado, las ideas de los tres primeros de la final de 2025 probadas una a una, y el v3, que pasa de 5 a 8 rondas válidas de 10 en Gazebo."
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

## Lo que todavía falla

1. **Las esquinas cruzadas en sentido horario.** Son la mayoría de los fallos que quedan (33 de 200). La próxima idea es una maniobra con marcha atrás, como hace STORMS cuando llega tarde a una curva.
2. **Dos campos que solo fallan en Gazebo** (CW, campos 1 y 4). El laboratorio los pasa, así que todo apunta a la cámara.
3. **El tiempo.** Unos 142 s con aparcamiento, frente a 49–63 s de los tres primeros. Hace falta curvar más rápido o medir la distancia de verdad: los tres primeros tienen encoder o motor paso a paso.

### Prueba esto

- En tu `my_obstacle`, mide dónde se va el tiempo: cuenta los ciclos en los que se aplica cada tope de velocidad. Quizá te pase lo mismo.
- Haz que la distancia de los arcos del aparcamiento salga del giroscopio y compara las rondas aparcadas del todo.
- Antes de quedarte con un cambio, repítelo con otras semillas.
