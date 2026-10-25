---
guide: "open-strategy"
order: 2
slug: "paso-2-el-rumbo"
title: "El rumbo (giroscopio)"
summary: "Estima hacia dónde apunta el coche integrando el giroscopio."
tag: "step-2"
compareFrom: "step-1"
---

El coche no tiene brújula. Para saber hacia dónde mira solo cuenta con el giroscopio, un sensor que dice a qué velocidad gira (en rad/s). En este paso escribes `GyroHeading`, que suma esas lecturas para obtener el **rumbo**, y `heading_steer`, que gira el volante para volver al rumbo que quieres. El giroscopio tiene un error constante, y verás por qué hay que medirlo antes de arrancar.

## Lo que vas a ver

En Gazebo, en un campo sin paredes, el coche espera Start, se queda quieto 0,6 s midiendo el giroscopio, y luego avanza intentando ir recto (rumbo 0) durante 10 s. La comprobación compara el rumbo **real** del coche al final, que tu nodo no ve. Con calibración, el error es de unas milésimas de radián. Sin calibrar (`calibrate:=false`), el coche cree ir recto pero termina torcido unos **0,06 rad (3,4°)**.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-2.json"></div>

*Repetición del mini simulador (Python, no Gazebo): la misma recta con y sin calibrar el giroscopio. El coche rojo, sin calibrar, se desvía hacia un lado mientras cree ir recto.*

## La idea

### El rumbo es una suma

El giroscopio mide la velocidad de giro `gyro` en rad/s. Si la sumas en cada instante multiplicada por el tiempo `dt`, obtienes cuánto ha girado el coche desde que empezó: el rumbo (`yaw`, en radianes, cero en Start, positivo hacia la izquierda). Es lo mismo que el cuentakilómetros, que suma velocidad por tiempo para dar distancia.

```text
yaw = yaw + gyro * dt
```

Es una integral. Cada lectura aporta un poquito, y los errores pequeños se acumulan.

### El sesgo del giroscopio

El giroscopio del coche tiene un **sesgo**: un error constante de unos 0,006 rad/s. Con el coche quieto dice «estoy girando 0,006 rad/s». Si lo sumas 10 s, el coche cree que ha girado 0,06 rad (3,4°) sin moverse. Además de ese sesgo hay **ruido** (unos 0,0019 rad/s) que cambia en cada lectura.

La solución es medir el sesgo cuando sabes que el coche está quieto y restarlo. Con el coche parado, la lectura **es** el sesgo (más ruido), así que basta el **promedio** de unas cuantas lecturas. Ese promedio también contiene algo de ruido, pero menos: con N lecturas el ruido del promedio baja unas √N veces. Con 30 lecturas (0,6 s a 50 por segundo) queda en unos 0,00035 rad/s, más de cinco veces menos que el ruido de una sola.

<div data-widget="gyro-drift"></div>

**Prueba esto** con la figura (los botones de arriba ponen los valores del coche real):

1. Con sesgo 0,006 y la calibración apagada, mira el rumbo real a los 10 s: unos −3,4° (0,06 rad). Mientras, la línea azul (lo que cree el coche) se queda cerca de 0.
2. Enciende la calibración: el error baja a décimas de grado.
3. Sube el **ruido** y pulsa **Otro ruido** varias veces: la calibración falla un poco más cuanto más ruido hay, y cambia de una semilla a otra.
4. Pon el sesgo en 0: no hay nada que corregir y calibrar da igual.

### Por qué el coche no se da cuenta

Sin calibrar, el rumbo que cree el coche (la línea azul de la figura) se separa cada vez más del real (la línea ámbar). La ley de control mantiene **el rumbo estimado** en 0, así que el coche corrige un error que no existe y deja que crezca el real. Esa es la razón de calibrar: nada dentro del coche te avisa del error. Con 0,06 rad de error, tras seguir una recta durante 6 m terminas a unos 0,35 m del camino.

### Volver al rumbo: una ley proporcional

Para ir a un rumbo `goal`, la ley más sencilla pone el volante **proporcional al error**:

```text
volante = KP * (goal - yaw)          KP = 0,8, y nunca más que el tope del volante (17,6°)
```

Si el error es de 0,1 rad el volante gira 0,08 rad; si el error es grande, el volante llega al tope y no pasa de él (`STEER_LIMIT = 0.30718`). Como `yaw` y `goal` son ángulos, un error positivo significa «la meta está a la izquierda» y el volante gira a la izquierda.

Hay un detalle con los ángulos. 3 rad y -3 rad parecen estar a 6 rad de distancia, pero en un círculo están a solo 0,28 rad, al otro lado de ±π. `wrap` (ya hecha en `robotek_course.minisim`) lleva la diferencia al intervalo de -π a π. Aplícala siempre a `goal - yaw`.

<div data-widget="heading-law"></div>

**Prueba esto**: pulsa **Meta 3 rad, coche en −3 rad**. Con `wrap` el volante gira un poco a la derecha (el camino corto, 0,28 rad). Quita la marca de `wrap`: el volante se va al tope hacia la izquierda y el coche daría casi una vuelta entera por el camino largo.

## Escríbelo

> **En este paso**
> - Escribes: un archivo, `heading.py`, con 3 funciones pequeñas.
> - Copias hecho: `drive.py`, el nodo que habla con ROS; no hace falta entenderlo todavía.

### Antes de empezar

Copia el nodo ya hecho desde la referencia. Ejecuta esta línea desde la raíz del repositorio (los tags existen después de `git fetch --tags`):

```bash
git fetch --tags && git show step-2:src/my_open/my_open/drive.py > src/my_open/my_open/drive.py
```

Ahora crea `src/my_open/my_open/heading.py` con este arranque. `GyroHeading` es una libreta con dos números en cero: el sesgo (`bias`) y el rumbo (`yaw`). Las líneas con `...` son huecos que rellenas abajo. Las ayudas `STEER_LIMIT`, `clamp` y `wrap` ya vienen hechas.

```python
"""Step 2 - The heading: integrate the gyroscope and steer back to a goal heading."""

from robotek_course.minisim import STEER_LIMIT, clamp, wrap


class GyroHeading:
    """The car's heading, from the gyroscope alone (the car has no compass)."""

    def __init__(self):
        self.bias = 0.0      # the gyroscope's constant error (rad/s), measured while the car is still
        self.yaw = 0.0       # rad, zero at Start

    def calibrate(self, samples): ...

    def update(self, gyro, dt): ...


def heading_steer(goal, yaw): ...
```

### Paso 2.1: medir el sesgo

Primero, que la libreta mida el sesgo del giroscopio. Es como una báscula que marca 2 kg de más con nada encima: la miras vacía y luego restas esos 2 kg. Aquí «vacía» es el coche quieto. Sustituye la línea `def calibrate...: ...` por este esqueleto (con la sangría de dentro de la clase):

```python
    def calibrate(self, samples):
        """``samples``: gyroscope readings taken with the car standing still. Their mean is the bias."""
        pass  # TODO
```

**Pista.** `samples` es una lista de lecturas con el coche quieto. El sesgo es su promedio: súmalas con `sum`, divide entre cuántas son (`len`) y guarda el resultado en `self.bias`.

**Compruébalo** (debes ver `1 passed`; en macOS con RoboStack pon `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` delante):

```bash
python -m pytest course/tests/test_step_2.py -q -k calibration_measures
```

<details><summary>Ver la solución de este paso</summary>

```python
    def calibrate(self, samples):
        """``samples``: gyroscope readings taken with the car standing still. Their mean is the bias."""
        self.bias = sum(samples) / len(samples)
```

</details>

### Paso 2.2: sumar el giro

Ahora, que la libreta sume cuánto ha girado el coche. Es el cuentakilómetros del giro: en cada instante suma lo que gira por segundo (`gyro`) por el tiempo que pasa (`dt`). Sustituye la línea `def update...: ...` por este esqueleto (con la misma sangría):

```python
    def update(self, gyro, dt):
        """Add the rotation of this tick (the reading without the bias) to the heading; returns the heading."""
        return self.yaw  # TODO
```

**Pista.** A la lectura `gyro` réstale el sesgo, multiplica por `dt` y súmalo a `self.yaw`. Después devuelve `self.yaw`.

**Compruébalo** (debes ver `1 passed`):

```bash
python -m pytest course/tests/test_step_2.py -q -k integral
```

<details><summary>Ver la solución de este paso</summary>

```python
    def update(self, gyro, dt):
        """Add the rotation of this tick (the reading without the bias) to the heading; returns the heading."""
        self.yaw += (gyro - self.bias) * dt
        return self.yaw
```

</details>

### Paso 2.3: el volante, proporcional al error

Ahora, la función que decide cuánto girar el volante. Cuanto más desviado estás del rumbo que quieres, más lo giras: igual que con el manillar de una bici. La constante `KP = 0,8` dice cuántos radianes de volante das por cada radián de error. Sustituye la línea `def heading_steer...: ...` por este esqueleto:

```python
KP = 0.8     # steering (rad) per radian of heading error


def heading_steer(goal, yaw):
    """Steering angle that brings the heading ``yaw`` towards ``goal``: proportional to the error, within full lock."""
    return 0.0  # TODO
```

**Pista.** El error es la meta menos el rumbo (`goal - yaw`). Multiplícalo por `KP`. Los límites vienen en el paso siguiente, así que la solución de abajo es a medias.

**Compruébalo** (debes ver `1 passed`):

```bash
python -m pytest course/tests/test_step_2.py -q -k points_towards
```

<details><summary>Ver la solución de este paso</summary>

```python
    return KP * (goal - yaw)
```

</details>

### Paso 2.4: que la orden sea posible

Por último, que la orden sea posible. Camino corto: 3 rad y -3 rad están a solo 0,28 rad si cruzas ±π, y `wrap` lleva el error a ese intervalo. Tope: el volante no pasa de 17,6° (`STEER_LIMIT`), y `clamp(valor, mínimo, máximo)` corta el valor a ese rango. Cambia la última línea de `heading_steer` por este esqueleto, y rellena el hueco `...`:

```python
    return clamp(..., -STEER_LIMIT, STEER_LIMIT)  # TODO
```

**Pista.** En el hueco va el error de antes multiplicado por `KP`, pero con el error pasado por `wrap` primero.

**Compruébalo** (debes ver `1 passed`):

```bash
python -m pytest course/tests/test_step_2.py -q -k short_way
```

<details><summary>Ver la solución de este paso</summary>

```python
def heading_steer(goal, yaw):
    """Steering angle that brings the heading ``yaw`` towards ``goal``: proportional to the error, within full lock."""
    return clamp(KP * wrap(goal - yaw), -STEER_LIMIT, STEER_LIMIT)
```

</details>

## Pruébalo en el simulador

Primero las siete pruebas juntas, sin ROS ni Gazebo (debes ver `7 passed`):

```bash
python -m pytest course/tests/test_step_2.py -q
```

Después compila y comprueba el paso en Gazebo, sin ventana y con un campo vacío. En macOS, antes haz `source tools/macos_env.sh ~/robotek-ros/jazzy`.

```bash
colcon build --symlink-install --packages-select my_open && source install/setup.bash
python3 course/verify_step.py 2 --compare
```

La compilación debe terminar sin errores. `--compare` corre el paso dos veces: con calibración (esa decide `PASS` o `FAIL`: el error de rumbo real debe ser menor que 0,03 rad) y con `calibrate:=false` (solo informa la deriva). En la referencia, el error del rumbo **real** al final de los 10 s fue de menos de 0,005 rad (0,3°) con calibración, y de 0,053 a 0,060 rad (3,0° a 3,4°) sin calibrar. El valor calibrado cambia de una ejecución a otra porque el ruido del giroscopio no se repite.

Cuando termines, compara tu `heading.py` con la referencia en la caja «Los cambios de este paso» (el `drive.py` es idéntico: lo copiaste).

### Rómpelo

1. **Sin `wrap`.** Quita `wrap` de `heading_steer` y corre `test_steering_never_exceeds_full_lock_and_takes_the_short_way_round`. Falla en la última línea: con la meta en 3 rad y el coche en -3, el volante gira al tope a la izquierda (el camino largo), como viste en la figura.

## Si algo falla

- **El coche no se mueve nunca.** No le llegó Start. Busca `Start: quieto 0.6 s...` en `drive.log`.
- **Con calibración el error es grande (más de 0,03 rad), o el registro dice `Sesgo del giroscopio: 0.0000`.** Revisa que `calibrate` use el promedio de las lecturas y que `update` **reste** el sesgo. Si el sesgo sale 0, no llegan lecturas del IMU: revisa la suscripción a `/imu`.
- **El coche gira en círculos en vez de ir recto.** Casi siempre es el signo: el error es `goal - yaw`.

## Resumen

- El rumbo es la suma de `(gyro - sesgo) * dt`; el sesgo del giroscopio (unos 0,006 rad/s) hace que el coche se tuerza unos 3° en 10 s si no lo restas.
- Se mide con el coche quieto, promediando unas 30 lecturas, y nada dentro del coche avisa si no se hizo.
- `heading_steer` pone el volante proporcional al error (`KP = 0,8`), con `wrap` para el camino corto y el tope del volante.

## Antes de seguir

- [ ] `pytest` marca `7 passed`.
- [ ] `verify_step.py 2 --compare` da PASS con calibración y una deriva cercana a 0,06 rad sin ella.
- [ ] Puedes explicar por qué el coche sin calibrar «cree» ir recto.

<details><summary>Para curiosos: cómo funciona drive.py</summary>

`drive.py` es el nodo de ROS que usa tu `heading.py`. No lo has escrito, pero esto es lo que hace:

- Escucha el IMU (el sensor de movimiento del coche, que publica el giroscopio en `/imu`) y Start. Tiene tres fases: antes de Start está quieto; tras Start espera 0,6 s quieto guardando lecturas; después calibra una vez y conduce.
- En cada tick llama a `update` con el giroscopio y manda `SPEED` con el volante que pide `heading_steer(0.0, yaw)`. El parámetro `calibrate` (por defecto `True`) permite saltarse la calibración para ver la deriva.
- El bucle va a 50 Hz con el reloj de simulación, así que `dt` es fijo, `1/50`. La estrategia final espera solo 0,3 s en el paso 7; aquí son 0,6 s para tener unas 30 lecturas (el nodo guarda 29: el último tick cae justo en 0,6 s y ya no cuenta).

</details>
