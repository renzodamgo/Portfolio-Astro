---
guide: "obstacle-strategy"
order: 2
slug: "paso-2-ubicarse"
title: "Ubicarse con los muros"
summary: "Estima la pose del coche ajustando el escaneo a los muros conocidos, y elige el sentido de la ronda con el primer escaneo."
tag: "obstacle-step-2"
compareFrom: "obstacle-step-1"
---

En el Open el coche no necesitaba saber dónde estaba: le bastaba con la pared de la isla. En el Obstacle sí lo necesita, porque cada señal está en un sitio concreto del carril y hay que llegar a ella por el lado correcto. En este paso escribes `localizer.py`: una pose (x, y, rumbo) que se predice con la distancia recorrida y el giroscopio y se corrige con el LiDAR contra los muros, que son siempre los mismos.

## Lo que vas a ver

Hasta el paso 6 el coche no se conduce solo: el `drive.py` de los pasos 2 a 5 es un nodo **observador**. Tras Start calibra el giroscopio 0,3 s, elige el sentido con el primer escaneo (lo imprime: `Direction ccw`) y desde ahí publica en `/obstacle/pose` lo que entiende: x, y y rumbo en el campo espejado, y el progreso. Tú conduces con el teclado en otra terminal, con `ros2 run robotek_course keyboard_drive`, y miras con `ros2 topic echo /obstacle/pose` cómo el progreso avanza y la pose sigue al coche. En el laboratorio, contra la pose real, el error típico es de **2 a 6 mm** y el del rumbo de unas décimas de grado.

## La idea

### Predecir y corregir

Cada tick (50 por segundo) el localizador **predice**: avanza la distancia que da la odometría del LiDAR (la clase base la calcula por ti, una vez por escaneo) en la dirección del rumbo del giroscopio. Una predicción sola se desvía: la distancia tiene unos milímetros de error por escaneo y el giroscopio un sesgo pequeño.

Por eso, con cada escaneo nuevo, **corrige**: pasa los puntos del escaneo al campo con la pose actual y mide cuánto se separan de los muros conocidos (los cuatro exteriores a ±1,5 m y los cuatro de la isla a ±0,5 m). Luego mueve un poco la pose (x, y y rumbo) para que esa separación sea mínima. Es un **ajuste por mínimos cuadrados** de tres números.

| Detalle | Valor | Por qué |
|---|---|---|
| Puertas (distancia máxima de un punto a su muro) | 0,08 m en la marcha; de 0,45 a 0,06 m al empezar | un punto lejos de todo muro es una señal o un tope, no un muro |
| Peso de cada punto | Huber: 1 hasta 2 cm, menos después | un punto raro no arrastra la pose |
| Ganancia | 0,5 | corrige la mitad del error por escaneo: suave pero rápido (10 escaneos por segundo) |
| Muro de la isla | solo la cara que el punto tiene enfrente | las esquinas de la isla confunden si se usan las dos caras |

### Empezar sin saber dónde

Al salir, el localizador no conoce la pose. Sí sabe que el coche está en la recta de salida mirando a lo largo. Prueba tres posiciones a lo largo (x = −0,35, 0 y 0,35), ajusta desde cada una con puertas que se van cerrando y se queda con la que deja más puntos sobre los muros.

### El sentido con un solo escaneo

El coche arranca mirando en el sentido de la ronda: en CCW la isla queda a su izquierda; en CW, a la derecha. `direction_from_scan` ajusta el escaneo con las dos hipótesis (el escaneo tal cual y espejado) y compara qué fracción de los puntos cae sobre los muros. La correcta gana por unas 0,15–0,18; la diferencia se llama **margen**.

Con el aparcamiento, los topes ensucian el muro exterior y en CCW el margen bajó a **0,05–0,13**. La solución acepta el sentido enseguida si el margen pasa de 0,10, y tras 1 s de escaneos se conforma con 0,03. Sin esa espera, en la semilla 2 con aparcamiento el coche nunca arrancaba.

### Espejar

Para CW, `scan_points(scan, sign)` cambia el signo de la `y` de cada punto: el escaneo espejado es el de un coche que va en CCW. Desde ahí, toda la estrategia trabaja en el campo espejado, y el volante se vuelve a espejar al final (`steer * sign`).

## Escríbelo

> **En este paso**
> - **Escribes:** `localizer.py` con `scan_points`, la clase `Localizer` (`predict`, `_fit`, `correct`, `initialize`) y `direction_from_scan`.
> - **Copias hecho:** `drive.py` de este paso.
> - **Resultado:** el coche sabe dónde está y en qué sentido va.

```bash
git show obstacle-step-2:src/my_obstacle/my_obstacle/drive.py > src/my_obstacle/my_obstacle/drive.py
```

### Paso 2.1: los puntos del escaneo

`scan_points(scan, sign)` devuelve dos arreglos `bx, by` en el sistema del coche (origen en `base_link`): `r cos(a) + LIDAR_X` y `sign · r sin(a)`, solo con los rayos válidos (finitos, entre 0,16 y 4 m). `LIDAR_X` = 0,128 m viene de `robotek_common.vehicle`.

### Paso 2.2: predecir

`predict(distance, heading)` usa el rumbo medio entre el anterior y el nuevo (`th + wrap(heading - th) / 2`) para avanzar `distance`. Así una curva no se convierte en una recta torcida.

### Paso 2.3: corregir

`_fit(bx, by, x, y, th, gate)` hace los puntos 1 a 3 de abajo y devuelve los puntos que quedan con su normal y su error; `correct(bx, by, gain=1.0, gate=0.08, iterations=2, damping=2.0)` llama a `_fit` y hace el 4:

1. Pasa los puntos al campo con la pose actual.
2. Para cada punto, decide su muro: el exterior según el eje dominante (`|x| ≥ |y|` → muro de x) y el de la isla solo si el punto está frente a una de sus caras. Su error `r` es la distancia con signo a ese muro, y su normal `(nx, ny)`.
3. Descarta los puntos con `|r| ≥ gate`. Con menos de 20, no corrige.
4. Resuelve el sistema `J ᵀ W J + damping · I` con `J = [nx, ny, nx·−(py − y) + ny·(px − x)]` y pesos de Huber, y mueve la pose `gain` veces la solución.

### Paso 2.4: empezar y elegir el sentido

`initialize(bx, by, heading)` prueba las tres x de partida con puertas 0,45, 0,3, 0,2, 0,12, 0,08 y 0,06 y se queda con la mejor. `direction_from_scan(scan)` devuelve `(sign, margin)`.

<details>
<summary>Ver la solución de direction_from_scan</summary>

```python
def direction_from_scan(scan):
    """Island on the left (CCW, +1) or on the right (CW, -1), and the margin of the choice."""
    fractions = {}
    for sign in (1.0, -1.0):
        bx, by = scan_points(scan, sign)
        if bx.size < 50:
            return 0.0, 0.0
        loc = Localizer()
        loc.initialize(bx, by, 0.0)
        fractions[sign] = loc._fit(bx, by, loc.x, loc.y, loc.th, 0.05)[4].size / bx.size
    sign = max(fractions, key=fractions.get)
    return sign, fractions[sign] - fractions[-sign]
```

</details>

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_2.py -q        # 9 passed
colcon build --symlink-install --packages-select my_obstacle && source install/setup.bash
ros2 launch robotek_course obstacle_round.launch.py strategy:=my_obstacle seed:=0 direction:=cw gui:=true
```

En otra terminal, `ros2 run robotek_course keyboard_drive` para conducir y `ros2 topic echo /obstacle/pose` para mirar. En la terminal del lanzador verás `Direction cw`. Prueba los dos sentidos.

## Si algo falla

- **El sentido sale al revés.** Revisa el signo de `by` en `scan_points`.
- **La pose se va lejos en las esquinas.** La corrección está usando las dos caras de la isla: limita cada punto a la cara que tiene enfrente.
- **Nunca elige el sentido con aparcamiento.** Baja el margen después de esperar, como se explica arriba.

## Resumen

- Predicción con distancia y giroscopio, corrección contra los muros conocidos con mínimos cuadrados y pesos de Huber.
- El sentido sale del primer escaneo comparando el ajuste con y sin espejo.
- Desde aquí todo se calcula en el campo espejado (CCW).

## Antes de seguir

- [ ] `test_obstacle_step_2.py` da `9 passed`.
- [ ] En Gazebo el nodo elige bien el sentido en CCW y en CW, y la pose de `/obstacle/pose` sigue al coche mientras lo conduces.
