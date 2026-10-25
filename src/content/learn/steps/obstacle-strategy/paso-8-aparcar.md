---
guide: "obstacle-strategy"
order: 8
slug: "paso-8-aparcar"
title: "Aparcar en paralelo"
summary: "Tras las tres vueltas: acercarse alineado, parar, planificar las maniobras con una búsqueda A* y ejecutarlas despacio, una a una."
tag: "obstacle-step-8"
compareFrom: "obstacle-step-7"
---

Tras las tres vueltas, el reglamento da 15 puntos por aparcar del todo dentro del hueco y en paralelo al muro (7 si queda dentro a medias o torcido). El hueco mide **0,35 × 0,20 m** y el coche **0,233 × 0,148 m**: sobran 11,7 cm a lo largo y 5,2 cm a lo ancho. En este paso escribes `park.py`.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/yw305Q0khyo" title="Hybrid A* path planning for autonomous parallel parking of a trailer truck" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Hybrid A* path planning for autonomous parallel parking of a trailer truck</strong> · Atsushi Sakai (inglés). Aparcamiento en paralelo con una búsqueda A* sobre arcos (del autor de PythonRobotics).</figcaption>
</figure>
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/Mo6hTUZ-B6Q" title="Hybrid A-Star Path Planning - Autonomous Car" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Hybrid A-Star Path Planning - Autonomous Car</strong> · Vimal Raj Ayyappan (inglés). Hybrid A* en RViz con obstáculos.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

Al terminar la tercera vuelta, el coche sigue por la recta de salida pegado a una línea paralela al aparcamiento, se para un poco después del tope del fondo, se queda quieto un momento (está planificando) y entra marcha atrás en varias maniobras cortas, parando entre una y otra para girar las ruedas. En el laboratorio, solo con el aparcamiento, aparca del todo en 7 a 9 de cada 10 intentos, en 35 a 70 s.

![Las maniobras de un aparcamiento planificado](/learn/obstacle/aparcar.svg)

## La idea

### Una maniobra no cabe

Para aparcar marcha atrás en una sola maniobra, la esquina delantera exterior tiene que librar el tope del fondo mientras la trasera entra. Con el radio mínimo del coche (0,37 m en el eje trasero) eso pide un hueco de unos **0,42 m**, y el reglamento da 0,35. Hacen falta varias maniobras: entrar de culata, enderezar, adelante y atrás a fondo hasta quedar paralelo. Lo que hace una persona en un hueco justo.

### Se puede parar

Ninguna regla obliga a moverse todo el tiempo: solo cuentan los 3 minutos. Así que el coche **para**, piensa y maniobra despacio:

1. **Acercarse:** sigue la línea a 4 cm del aparcamiento (`y = −1,3 + 0,074 + 0,04`) hasta quedar alineado (menos de 8 mm y 2° de error) y a 5 cm del tope del fondo. Si al alinearse se pasa, vuelve marcha atrás en recta. Si no se alinea en 0,4 m, sigue igual.
2. **Planificar:** con el coche quieto, una búsqueda **A\*** sobre arcos de 3 cm (volante a fondo a cada lado, a la mitad o recto; hacia delante o hacia atrás) con el contorno del coche y las ruedas giradas, a **1,5 cm** de los topes y del muro (si no encuentra, a 1 cm). La meta es estar dentro del hueco 1,5 cm por cada lado y paralelo. Como la pose de parada es casi siempre la misma, el primer plan se calcula **antes de la ronda**: tarda unos segundos y durante la ronda no cuesta nada.
3. **Ejecutar:** cada tramo de arcos iguales es una maniobra. Para cada una: quieto mientras el servo gira (0,2 s más 1 s por cada 1,2 rad de giro), luego a **0,06 m/s** hasta completar el giro previsto, medido con el giroscopio, o la distancia en los tramos rectos.
4. **Corregir:** si al terminar no está dentro y paralelo, planifica otra vez desde donde quedó. Esa búsqueda empieza cerca de la meta y suele tardar milisegundos. Como mucho 10 veces.

### Detalles que importaron

| Detalle | Sin él | Con él |
|---|---|---|
| Esperar al servo entre maniobras | el coche arrancaba con las ruedas a medio girar y el plan no servía | de 2 de 6 a 7 de 10 aparcados del todo |
| Parar 1,2 cm antes (el motor sigue rodando unos 150 ms tras la orden) | se pasaba en cada maniobra de 3 cm | de 7 a 9 de 10 |
| Guardia: el contorno 2 cm más adelante a menos de 8 mm de un tope termina la maniobra | tocar un tope anula el aparcamiento y para la ronda | — |

### Durante las vueltas

El aparcamiento está en la recta de salida y los topes sobresalen 20 cm del muro exterior. Durante las vueltas, junto a ellos el plan no deja ir más allá de **−0,19 m** del carril, y las líneas de las esquinas de al lado respetan ese límite. Por reglamento, las señales de esa sección pasan a la fila interior. Y después de las tres vueltas las señales se pueden pasar por cualquier lado: el juez del curso ya no cuenta el lado mientras aparcas.

## Escríbelo

> **En este paso**
> - **Escribes:** `park.py`, en dos mitades: el modelo y la búsqueda (`footprint`, `move`, `Lot`, `search`) y la conducción (`nominal_plan` y la clase `Parking` con `step(now, x, y, th) → (speed, steer)`).
> - **Puedes copiar hecha** la primera mitad si prefieres centrarte en la conducción: es la búsqueda A\* del aparcamiento del equipo. Copia el archivo de la referencia y borra la clase `Parking`:

```bash
git show obstacle-step-8:src/my_obstacle/my_obstacle/park.py > src/my_obstacle/my_obstacle/park.py
```

### Paso 8.1: el modelo y la búsqueda

- `move(x, y, th, steer, ds)`: el modelo de bicicleta alrededor del eje trasero, con la pose en `base_link`.
- `Lot(sign)`: el hueco del reglamento en el campo espejado (x de 0,13 a 0,48 en CCW, de −0,48 a −0,13 en CW; y de −1,5 a −1,3), con `limits`, `free` (el contorno y las ruedas giradas lejos de los topes y del muro), `parked` y `arc`.
- `search(lot, pose, gear, steer_limit, margin, deadline, weight)`: A\* ponderado sobre arcos de 3 cm (5 ángulos de volante, hacia delante y hacia atrás, coste extra por cambiar de marcha), hasta 200 000 expansiones.
- `nominal_plan(steer_limit)`: el plan desde la pose de parada, calculado una vez (la misión lo llama al crearse, antes de la ronda) y guardado.

### Paso 8.2: acercarse

Persigue la línea con `steer = 2 · wrap(atan2(línea − y, 0,30) − θ)`, a 0,12 m/s lejos y 0,06 m/s en los últimos 30 cm.

### Paso 8.3: maniobras

Convierte el plan (lista de arcos `(steer, dirección)`) en maniobras sumando los arcos iguales seguidos. Para un tramo con volante, el giro previsto es `largo · tan(steer) / L`. Termina cuando el giro medido llega al previsto menos lo que rodará el coche después de la orden.

<details>
<summary>Ver la solución de drive (una maniobra)</summary>

```python
def _drive(self, now, x, y, th):
    steer, direction, length, (x0, y0, th0) = self.current
    if abs(steer) > 1e-6:
        # Heading change of the arc: the gyro measures it better than the distance.
        done = abs(wrap(th - th0)) >= (length - COAST) * abs(math.tan(steer)) / WHEELBASE
    else:
        done = math.hypot(x - x0, y - y0) >= length - COAST
    ahead = move(x, y, th, steer, direction * GUARD_AHEAD)
    if done or not self.lot.free(*ahead, steer, GUARD_MARGIN):
        if not done:
            self.moves = []      # the plan no longer fits: plan again from here
        self._next(now, (x, y, th))
        return 0.0, steer
    return direction * self.speed, steer
```

</details>

### Paso 8.4: en la misión

En `RUN`, cuando el progreso llega a `park_after` (**24**: tres vueltas, de vuelta en la recta de salida) y `park` vale 1, pasa al estado `PARK`, crea `Parking(self, park_speed, park_margin)` y llama a `Parking.step` en cada tick hasta `PARKED` (o `PARK_FAIL`), y entonces a `STOP`. `Strategy(parking=True)` pone `park` a 1.

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_8.py -q        # 6 passed, ~40 s (aparca de verdad en el laboratorio)
python3 -m robotek_evaluation.obstacle_lab --strategy my_obstacle.strategy:Strategy --parking --layouts 0-9
ros2 launch robotek_course obstacle_round.launch.py strategy:=my_obstacle seed:=4 direction:=ccw parking:=true gui:=true
python3 course/obstacle/verify_step.py 8          # Gazebo sin ventana: exige 55 puntos y ronda válida
```

## Si algo falla

- **Toca un tope al entrar.** Sube el margen del plan o la guardia; revisa que esperas al servo.
- **Se queda maniobrando sin terminar.** Tu coche rueda más de lo que crees tras la orden de parar: mide cuánto y ajusta el margen de parada.
- **En Gazebo se queda quieto varios segundos y después la ronda llega a 180 s.** Es el límite conocido del paso 9: una corrección larga bloquea el nodo.

## Resumen

- Una maniobra no cabe: hacen falta unas 14, cortas y despacio.
- Parar está permitido: se planifica con el coche quieto y se ejecuta maniobra a maniobra.
- Esperar al servo y descontar lo que rueda el coche llevaron el aparcamiento de 2 de 6 a 9 de 10.

## Antes de seguir

- [ ] `test_obstacle_step_8.py` da `6 passed` (tarda unos 40 s).
- [ ] En el laboratorio, con `--parking`, ves rondas de 55 puntos.
