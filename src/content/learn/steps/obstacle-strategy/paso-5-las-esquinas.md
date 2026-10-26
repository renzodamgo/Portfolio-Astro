---
guide: "obstacle-strategy"
order: 5
slug: "paso-5-las-esquinas"
title: "Las esquinas: recta, arco, recta"
summary: "Planifica cada esquina como una recta, un arco y otra recta, y busca la que deja más margen con las señales de los dos lados."
tag: "obstacle-step-5"
compareFrom: "obstacle-step-4"
---

En una recta, la línea del paso 4 funciona. En una esquina no: un desplazamiento de +0,354 m hacia la isla dentro de la curva pide un radio de 0,146 m, y el coche no gira por debajo de unos 0,41 m. En este paso escribes `corner.py`: cada esquina se planifica como **recta, arco, recta** y se elige, entre muchas, la que deja más margen con las señales de los dos extremos.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/gIVNggpYuXA" title="Dubins path examples" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Dubins path examples</strong> · Kyler Laird (inglés). Caminos de Dubins: rectas y arcos de radio mínimo, como la línea de cada esquina.</figcaption>
</figure>
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/tjUVE3jto98" title="Coding a Dubins Car Optimal Path Planner" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Coding a Dubins Car Optimal Path Planner</strong> · Aaron Becker (inglés). Un profesor programa el planificador de Dubins paso a paso.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

Conduciendo con `keyboard_drive`, `/obstacle/plan` ya muestra la línea de cada esquina en vez de las rampas del paso 4. `corner.plan` devuelve, para cada par de señales en los extremos de una esquina, el margen y la línea. Los 25 casos posibles (4 tipos de señal o ninguna, en cada extremo) tienen línea con **al menos 3,4 cm** de margen sobre el papel. Las pruebas lo comprueban.

<div data-widget="obstacle-corner"></div>

## La idea

### Qué fallaba

Con la línea del paso 4 en las esquinas, cuatro campos de prueba fallaban incluso dándole a la estrategia los colores perfectos desde 1,8 m:

1. **Un desplazamiento interior en la curva es imposible:** el coche se abre, el volante se queda a fondo unos 2 s y llega mal a la señal siguiente.
2. **El seguidor corta la curva hacia la señal siguiente:** apunta a un punto que pasa por encima de ella.
3. **Se decide una señal a la vez:** el cambio hacia la señal de la recta siguiente empieza tarde.

### La forma: recta, arco, recta

En el sistema de la primera esquina (recta de abajo hacia la de la derecha, esquina de la isla en (0,5, −0,5)), la línea:

1. va por la recta de abajo con desplazamiento `d_a`: `y = −1 + d_a`;
2. gira a la izquierda por un **arco de radio r**;
3. sigue por la recta de la derecha con desplazamiento `d_b`: `x = 1 − d_b`.

El centro del arco queda en `(1 − d_b − r, −1 + d_a + r)`. Con `d_a`, `d_b` y `r` la línea está entera. Las demás esquinas son esta girada, así que el resultado se da en progreso y desplazamiento y vale para las cuatro.

### Buscar la mejor

Las señales de una esquina son la del **último asiento** de la recta anterior (progreso 2k + 1) y la del **primero** de la siguiente (2k + 2). Para cada una, `d` solo puede estar del lado correcto: una roja admite de −0,36 hasta su fila − 0,099; una verde, desde su fila + 0,099 hasta +0,36 (0,099 = medio cuadro de señal + medio coche). Un extremo sin señal usa el desplazamiento de la señal vecina, con un margen de ±0,1 m.

`plan` prueba todas las combinaciones (pasos de 2 cm en `d`, radios 0,5, 0,6 y 0,75 m) y mide el **margen** de cada línea: la distancia mínima del contorno del coche (147,7 mm delante, 85,2 mm detrás, 74 mm de medio ancho) a las dos señales, la isla y el muro exterior. Si una señal se cruzaría por el lado equivocado (medido como el juez: dónde corta el contorno la línea de la señal), el margen es negativo.

- Si una línea deja **11 cm o más**, entre ellas elige la más cercana al centro del carril: cambios de lado más cortos y señales más fáciles de ver.
- Si ninguna llega, la de más margen.

El radio mínimo es **0,5 m**, no los 0,41 m del coche a fondo. Con arcos más cerrados, al seguidor (paso 6) no le quedaba volante para corregir. Medido en el laboratorio: permitiendo arcos desde 0,45 m, 20 de 50 rondas válidas en el set de prueba y 28 de 40 en campos nuevos; desde 0,5 m, 30 de 50 y 31 de 40.

### Los casos difíciles

| Señal al final de la recta | Señal al inicio de la siguiente | Margen | `d_a` | `d_b` | `r` |
|---|---|---:|---:|---:|---:|
| verde interior | roja exterior | 3,4 cm | +0,24 | −0,34 | 0,5 |
| roja exterior | verde interior | 4,0 cm | −0,36 | +0,24 | 0,5 |
| verde interior | roja interior | 8,0 cm | +0,28 | −0,30 | 0,5 |
| roja interior | verde interior | 8,2 cm | −0,32 | +0,30 | 0,5 |
| sin señal | sin señal | 22,8 cm | 0 | 0 | 0,75 |


Los dos primeros cruzan el carril de un lado al otro en la misma esquina: el coche tiene que pasar la primera señal pegado a la isla y salir de la curva pegado al muro. Son el **límite conocido** de esta estrategia (paso 9).

## Escríbelo

> **En este paso**
> - **Escribes:** `corner.py` con `path`, `clearance`, `plan`, `knots`, `corner_line` y `merge`.
> - **Copias hecho:** `drive.py` de este paso.

```bash
git show obstacle-step-5:src/my_obstacle/my_obstacle/drive.py > src/my_obstacle/my_obstacle/drive.py
```

### Paso 5.1: `path(d_a, d_b, r)`

Devuelve tres arreglos `x, y, yaw` cada 2 cm: la recta A desde `x = min(0.35, cx)` hasta el centro del arco, el arco (de −π/2 a 0 alrededor de `(cx, cy)`) y la recta B hasta `y = max(-0.35, cy)`. En el arco, el cuerpo del coche apunta un poco hacia fuera de la tangente: `base_link` va medio paso de rueda por delante del eje trasero, `atan2(0.0587, sqrt(r² − 0.0587²))`. Si `x_start < -0.3` o `cy > 0.3`, la línea no cabe: `None`.

### Paso 5.2: `clearance(samples, sign_a, sign_b)`

Mueve el contorno a cada muestra y mide la distancia a las cajas de las señales (50 mm), a la isla y al muro. Para el lado, corta el contorno con la línea de la señal y compara el intervalo lateral con la fila.

### Paso 5.3: `plan(sign_a, sign_b, fixed_a, fixed_b, low_a=-1, low_b=-1)` y `knots(d_a, d_b, r)`

`plan` hace la búsqueda y devuelve `(margen, d_a, d_b, r)` (o `None` si no hay línea); guárdalo con `functools.lru_cache`, porque solo depende de las señales. `low_a` y `low_b` son el desplazamiento mínimo de cada extremo (el aparcamiento, paso 8). `knots` pasa la línea a pares (progreso desde el inicio de la esquina, desplazamiento): en la recta A, `x − 0,5`; en el arco, el ángulo alrededor de la esquina de la isla; en la recta B, `1 + (y + 0,5)`.

### Paso 5.4: `corner_line(start, signs, low_a, low_b)` y `merge(sign_knots, signs, phi, horizon, lot_direction=None)`

`corner_line` arma la línea de la esquina que empieza en el progreso `start` (impar: 1, 3, 5…). `signs` es el `{progreso: (lateral, color, desplazamiento)}` de `plan.with_offsets`. La señal en `start` (último asiento de la recta) y la de `start + 1` (primero de la siguiente) dan forma a la línea; un extremo sin señal toma el desplazamiento de la señal vecina (o 0). Devuelve los nudos con el progreso absoluto.

`merge` toma los nudos de `plan.sign_knots`, recorre las esquinas desde 1,3 unidades detrás del coche hasta `horizon` delante, **sustituye** los nudos que caen dentro de cada esquina por su línea y devuelve todo ordenado. Con `lot_direction` (`'ccw'`/`'cw'`) aplica el límite del aparcamiento: antes de la esquina 1 en CCW y después de la esquina 7 en CW.

<details>
<summary>Ver la solución de path</summary>

```python
def path(d_a, d_b, r):
    y_a, x_b = -1.0 + d_a, 1.0 - d_b
    cx, cy = x_b - r, y_a + r
    x_start = min(0.5 - BEFORE, cx)
    y_end = max(-0.5 + AFTER, cy)
    if x_start < -0.3 or cy > 0.3:
        return None
    slip = math.atan2(WHEELBASE / 2.0, math.sqrt(max(r * r - (WHEELBASE / 2.0) ** 2, 1e-9)))
    line_a = np.arange(x_start, cx, STEP)
    angles = np.arange(-math.pi / 2, 0.0, STEP / r)
    line_b = np.arange(cy, y_end + 1e-9, STEP)
    x = np.concatenate([line_a, cx + r * np.cos(angles), np.full(line_b.size, x_b)])
    y = np.concatenate([np.full(line_a.size, y_a), cy + r * np.sin(angles), line_b])
    yaw = np.concatenate([np.zeros(line_a.size), angles + math.pi / 2 - slip, np.full(line_b.size, math.pi / 2)])
    return x, y, yaw
```

</details>

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_5.py -q
```

Da `29 passed`: 25 son los casos de esquina (exigen un margen de al menos 3 cm y un radio de al menos 0,5 m) y 4 comprueban el lado, `merge` y el aparcamiento.

## Si algo falla

- **Un caso da margen negativo.** Revisa el lado: rojo a la derecha (desplazamiento menor que la fila), verde a la izquierda.
- **La búsqueda tarda.** Usa `lru_cache`: en una ronda hay pocas combinaciones distintas.

## Resumen

- Cada esquina es recta-arco-recta con tres números: `d_a`, `d_b` y `r`.
- Se elige la de más margen, y si hay de sobra, la más centrada.
- Dos cruces de lado a lado dejan solo 3–4 cm: el límite conocido.

## Antes de seguir

- [ ] `test_obstacle_step_5.py` da `29 passed`.
- [ ] Sabes por qué no basta el desplazamiento del paso 4 dentro de una curva.
