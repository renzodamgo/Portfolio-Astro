---
guide: "obstacle-strategy"
order: 6
slug: "paso-6-seguir-la-linea"
title: "Seguir la línea"
summary: "Un volante que anticipa la curvatura de la línea y corrige la distancia y el rumbo respecto al punto de la línea que tiene al lado."
tag: "obstacle-step-6"
compareFrom: "obstacle-step-5"
---

Con el plan de los pasos 4 y 5 el coche sabe por dónde quiere ir. En este paso escribes `follow.py`, el volante que lo lleva por ahí. Es el paso donde más cuenta el detalle: la misma línea seguida de dos formas distintas dio **77 o 88 rondas válidas de 100**.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/zMdoLO4kRKg" title="Vehicle Path Tracking Using Pure Pursuit Controller" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Vehicle Path Tracking Using Pure Pursuit Controller</strong> · MATLAB (inglés, 11 min). Pure pursuit con punto de anticipación: el controlador que el v2 tuvo que reemplazar.</figcaption>
</figure>
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/9Y7kVIJs_JI" title="Lesson 3: Geometric Lateral Control - Stanley - Introduction to Self-Driving Cars" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Lesson 3: Geometric Lateral Control - Stanley - Introduction to Self-Driving Cars</strong> · Ta Hai Dang (inglés). El controlador Stanley: error lateral y de rumbo respecto al punto más cercano, como el de este paso.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

Por fin el coche se conduce solo: con el `drive.py` de este paso da **una vuelta** siguiendo la línea a 0,25 m/s y se para (todavía sin salida especial, sin mirar señales desconocidas y sin aparcar; eso es el paso 7). Ya no hace falta `keyboard_drive`. Sigues pudiendo mirar `/obstacle/pose`, `/obstacle/signs` y `/obstacle/plan`.

## La idea

### Lo que falló primero: perseguir un punto

La primera versión usaba un **pure pursuit**: apuntar a un punto de la línea 0,35 m por delante. En las curvas ese método **corta hacia dentro**: el error es de unos `L² / (2R)`, que con L = 0,35 m y R = 0,6 m son unos 10 cm. Medido en el laboratorio, el coche iba de media 3,4 a 7,2 cm por dentro de la línea en las esquinas, justo hacia la señal de la salida. Con L = 0,25 m mejoró algo (de 25 a 28 válidas de 50).

### Anticipar la curvatura

La línea del paso 5 dice, en cada punto, cuánto gira. Si la curva tiene curvatura κ (1/radio), el volante que la recorre exactamente es `atan(L κ)`, con L = 0,1174 m entre ejes. Ese término se llama **anticipación** (*feed-forward*): no espera a que haya error.

La curvatura se calcula con tres puntos de la línea a ±0,15 m: es el círculo que pasa por los tres. Se toma **0,10 m por delante** del coche, porque el servo tarda 60 ms en empezar a moverse y gira a 1,2 rad/s.

### Corregir respecto al punto de al lado

Sobre la anticipación se suman dos correcciones:

- **lateral:** `−6,0 · e`, con `e` la distancia con signo del coche al punto de la línea **que tiene al lado** (positiva si está a la izquierda);
- **de rumbo:** `−1,5 · (rumbo del coche − rumbo de la línea en ese mismo punto)`;
- y, como en el Open, el **amortiguamiento** del giróscopo: `−0,2 · gyro`.

Todo se limita a ±0,307 rad (17,6°, la dirección del coche real tras compensar cada lado).

```text
steer = atan(L · κ(phi + 0,10 m)) − 6,0 · e − 1,5 · (θ − θ_línea) − 0,2 · gyro
```

### Por qué «al lado» y no «por delante»

La primera versión de este volante comparaba el rumbo con el de un punto 8 cm por delante. En una curva el rumbo de la línea cambia 2 rad por metro: 8 cm por delante ya son 17° más. El término de rumbo pedía siempre más giro hacia dentro y el coche entraba a la curva antes de tiempo. Midiendo error y rumbo contra el punto de al lado, y dejando el adelanto solo para la anticipación, el resultado en 100 campos pasó de **77 a 88** rondas válidas.

| Volante | Rondas válidas (100 campos, semilla 0) |
|---|---:|
| pure pursuit a 0,35 m | (25 de 50 en el set de prueba) |
| anticipación + corrección contra un punto 8 cm adelante | 77 |
| anticipación + corrección contra el punto de al lado | **88** |

## Escríbelo

> **En este paso**
> - **Escribes:** `follow.py` con `point`, `reference` y `steer`.
> - **Copias hecho:** `drive.py` de este paso.

```bash
git show obstacle-step-6:src/my_obstacle/my_obstacle/drive.py > src/my_obstacle/my_obstacle/drive.py
```

### Paso 6.1: un punto de la línea

En la referencia la línea es una **función** del progreso, `offset(s)` (la misión le pasa su `offset_at`, que ya aplica el límite del aparcamiento). `point(offset, progress)` devuelve `lane_pose(s) + offset(s) · lane_normal(s)`.

### Paso 6.2: `reference(offset, progress)`

Toma `point` en `advance(progress, −STENCIL)`, en `progress` y en `advance(progress, +STENCIL)`. Devuelve `(x, y, rumbo, κ)`: el rumbo de la cuerda entre el primero y el tercero, y κ = 2 · (producto cruz) / (producto de los tres lados).

### Paso 6.3: `steer(pose, phi, gyro, offset, kp, kd, limit)`

La fórmula de arriba, con `kp` = `steer_kp` (1,5), `kd` = `steer_kd` (0,2) y `limit` = `steer_limit` (0,307), que vienen de los parámetros de la misión (paso 7). El error lateral es `−(x − px) sin θ_línea + (y − py) cos θ_línea`. El resultado está en el campo espejado: en CW el nodo lo multiplica por −1.

<details>
<summary>Ver la solución</summary>

```python
PREVIEW = 0.10          # m ahead for the curvature feed-forward (servo and motor lag)
STENCIL = 0.15          # m between the points the line's heading and curvature come from
LATERAL_GAIN = 6.0      # rad of steer per metre off the planned line


def steer(pose, phi, gyro, offset, kp, kd, limit):
    """Steering angle (rad, + left, track frame) that follows the planned line."""
    x, y, th = pose
    px, py, heading, _ = reference(offset, phi)
    kappa = reference(offset, lane.advance(phi, PREVIEW))[3]
    error = -(x - px) * math.sin(heading) + (y - py) * math.cos(heading)
    angle = (math.atan(WHEELBASE * kappa) - LATERAL_GAIN * error
             - kp * lane.wrap(th - heading) - kd * gyro)
    return lane.clamp(angle, -limit, limit)
```

</details>

### La velocidad

El nodo de este paso va siempre a 0,25 m/s. La misión del paso 7 usa 0,35 m/s en recta y 0,30 m/s cerca de una señal o cambiando de lado, y 0,2 m/s si hay algo a menos de 0,7 m de frente. Más despacio no ayuda (el cambio de lado se mide en metros, no en segundos), y más rápido el servo se queda atrás.

## Pruébalo

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_6.py -q        # 6 passed
colcon build --symlink-install --packages-select my_obstacle && source install/setup.bash
ros2 launch robotek_course obstacle_round.launch.py strategy:=my_obstacle seed:=4 direction:=ccw parking:=false gui:=true
```

### Rómpelo

1. Mide el error contra un punto 8 cm por delante en vez del de al lado: en las esquinas, el coche se mete hacia la isla.
2. Quita la anticipación: el coche llega tarde a cada curva y el volante va a fondo.

## Si algo falla

- **El coche oscila en las rectas.** La ganancia lateral es demasiado alta para tu `dt`, o el error tiene el signo cambiado.
- **Gira al revés en CW.** `steer` trabaja en el campo espejado: el volante se espeja al final, `sign · steer`.

## Resumen

- Anticipa con la curvatura de la línea un poco por delante; corrige contra el punto de al lado.
- El pure pursuit corta las curvas unos 6–10 cm: justo hacia las señales.
- Con este volante: 88 de 100 campos con tres vueltas válidas en el laboratorio.

## Antes de seguir

- [ ] `test_obstacle_step_6.py` da `6 passed`.
- [ ] En Gazebo el coche da una vuelta solo siguiendo la línea, sin tocar señales, en el campo 4, y se para.
