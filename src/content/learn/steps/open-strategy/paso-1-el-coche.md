---
guide: "open-strategy"
order: 1
slug: "paso-1-el-coche"
title: "El coche (modelo de bicicleta)"
summary: "Modela cómo gira un coche con dirección Ackermann."
tag: "step-1"
compareFrom: "step-0"
---

Antes de que el coche mire nada, necesita saber qué hace su propio volante. En este paso escribes el **modelo de bicicleta**: tres funciones que convierten un ángulo de dirección en un giro. Con él predices el radio del círculo que dibuja el coche, y después lo comparas con el coche en Gazebo.

<!-- videos:start -->
## Para entrar en tema

Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).

<div class="learn-videos">
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/D4AgX1zjx54" title="Self-Driving Cars - Lecture 5.2 (Vehicle Dynamics: Kinematic Bicycle Model)" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Self-Driving Cars - Lecture 5.2 (Vehicle Dynamics: Kinematic Bicycle Model)</strong> · Tübingen Machine Learning (inglés). Clase universitaria que deriva el modelo de bicicleta de este paso.</figcaption>
</figure>
<figure class="learn-video">
<iframe src="https://www.youtube-nocookie.com/embed/reZiM0aKEjo" title="Ackermann Steering Geometry simply explained" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
<figcaption><strong>Ackermann Steering Geometry simply explained</strong> · Skill Lync (inglés). La geometría Ackermann del coche, sin matemáticas.</figcaption>
</figure>
</div>
<!-- videos:end -->

## Lo que vas a ver

Primero las pruebas en Python: cinco pruebas en verde. Después, en Gazebo y en un campo sin paredes, el coche espera Start, fija el volante a un ángulo (0,25 rad por defecto) y avanza en círculos. La comprobación ajusta una circunferencia a la trayectoria real y la compara con lo que predice tu `turn_radius`. La meta es una diferencia **menor que el 4 %**; en la referencia sale por debajo del 1 %.

<div data-widget="step-replay" data-src="/learn/assets/replays/step-1.json"></div>

*Repetición del mini simulador (Python, no Gazebo): el coche da vueltas con la dirección fija. El fantasma rojo es el modelo ideal, sin el retraso del servo, y va un poco por delante.*

## La idea

### Un coche con dirección Ackermann es una bicicleta

El coche tiene dos ruedas delanteras que giran y dos traseras que no (eso es una dirección tipo Ackermann). Para calcular el giro se simplifica a una bicicleta: **una rueda trasera fija y una delantera que gira un ángulo `δ`** (en el código, `steer`, en radianes, positivo hacia la izquierda; 1 rad son unos 57,3°). La distancia entre los dos ejes es `L = 0,1174 m` (`WHEELBASE`).

La geometría explica el círculo: la rueda trasera apunta siempre hacia delante y la delantera apunta a `δ`. Las dos líneas punteadas del dibujo, la del eje trasero y la perpendicular a la rueda delantera, se cortan en un punto: el **centro del círculo**. Más ángulo acerca ese centro y el círculo se cierra.

<div data-widget="bicycle"></div>

**Prueba esto** con el dibujo:

1. Pulsa **Referencia (0,25 rad)**: el radio es 0,46 m, el círculo que usa la referencia. Pulsa **Dar una vuelta**.
2. Pulsa **Tope del coche real**: 0,37 m es lo más cerrado que puede girar el coche.
3. Cambia la velocidad: el radio no se mueve, solo cambia lo que tarda la vuelta. El radio depende del ángulo y de nada más.
4. Pon la velocidad en 0: la velocidad de giro es 0 aunque el volante esté a tope.
5. Pon un ángulo negativo: gira a la derecha con el mismo radio.

Con el coche a velocidad `v` (`speed`) y las ruedas delanteras a `δ` (`steer`), las fórmulas son:

```text
velocidad de giro (rad/s) = v * tan(δ) / L
radio del círculo (m)     = L / tan(δ)
```

Con las ruedas rectas (`δ = 0`) el radio es infinito: el coche va recto. Un coche parado (`v = 0`) no gira, aunque tenga el volante a tope.

### Por qué la estrategia lo necesita

Tu estrategia decide un **ángulo de volante**. Pero el coche no recibe ángulos: recibe un mensaje `Twist` (el tipo de mensaje de ROS para velocidades) con una velocidad hacia delante `linear.x` y una velocidad de giro `angular.z`. La conversión es la primera fórmula:

```python
cmd.linear.x = speed
cmd.angular.z = speed * math.tan(steer) / WHEELBASE
```

Todos los `drive.py` de la guía usan esa línea. El simulador hace lo contrario: de la velocidad de giro que le pides saca el ángulo de las ruedas.

### Avanzar un instante: primero el rumbo, luego la posición

`bicycle_step` hace avanzar el coche `dt` segundos (un instante pequeño, como 0,01 s). Se llama **rumbo** (`yaw`) al ángulo hacia donde apunta el coche; `x` e `y` son su posición. El orden importa: primero se actualiza el rumbo con la velocidad de giro, y la posición se mueve **a lo largo del rumbo nuevo**:

```text
yaw_nuevo = yaw + yaw_rate * dt
x_nuevo   = x + speed * cos(yaw_nuevo) * dt
y_nuevo   = y + speed * sin(yaw_nuevo) * dt
```

Si usas el rumbo viejo sale un resultado ligeramente distinto, y la prueba que compara con el mini simulador falla.

### El límite del volante real

El servo del coche real no llega a los 25° que admite el simulador. Su tope son **17,6°** (`REAL_STEER_LIMIT = 0.30718` rad, en `robotek_common/vehicle.py`). Con ese ángulo el radio mínimo es `0,1174 / tan(0,30718) = 0,370 m`. Es el círculo más cerrado que puede hacer el coche: una esquina no se puede girar más estrecha que eso.

Por eso el parámetro `steer` del nodo vale 0,25 rad por defecto y no 0,3: cerca del tope, el simulador recorta el ángulo y el modelo deja de acertar (la tabla de «Pruébalo» lo muestra y explica).

> **Antes de escribirlo, juega un rato.** Pon el volante a tope y da el círculo más cerrado que puedas. Mira el ángulo y el radio que enseña el simulador, y pulsa **T** para cambiar el límite de la dirección. ¿Qué círculo se cierra más, con 25° o con el límite del coche real?
>
> [Abrir el simulador con el reto de este paso](/learn/open-strategy/simulador/?paso=1)

## Escríbelo

> **En este paso**
> - Escribes: un archivo, `model.py`, con 3 funciones pequeñas.
> - Copias hecho: `drive.py`, el nodo que habla con ROS; no hace falta entenderlo todavía.

### Antes de empezar

Copia el nodo ya hecho desde la referencia. Ejecuta esta línea desde la raíz del repositorio (los tags existen después de `git fetch --tags`):

```bash
git fetch --tags && git show step-1:src/my_open/my_open/drive.py > src/my_open/my_open/drive.py
```

Ahora crea `src/my_open/my_open/model.py` con este arranque. Las tres líneas con `...` son huecos: los rellenas uno a uno en los pasos de abajo. `WHEELBASE` es la distancia entre los dos ejes (0,1174 m), la `L` de las fórmulas; ya viene hecha.

```python
"""Step 1 - The car: how the steering angle becomes a turn (the bicycle model)."""
import math

from robotek_course.minisim import WHEELBASE


def yaw_rate(speed, steer): ...
def bicycle_step(x, y, yaw, speed, steer, dt): ...
def turn_radius(steer): ...
```

En macOS con RoboStack, pon `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` delante de cada `python -m pytest`. Si lo ejecutas ahora verás errores: es normal, aún no has escrito nada.

### Paso 1.1: cuánto gira el coche por segundo

Primero, una función que diga cuánto gira el coche cada segundo. Piensa en una bici: cuanto más rápido vas y más giras el manillar, más rápido cambia hacia dónde miras. Sustituye la línea `def yaw_rate...: ...` por este esqueleto:

```python
def yaw_rate(speed, steer):
    """How fast the car rotates (rad/s) when it drives at ``speed`` (m/s) with the front wheels at ``steer`` (rad)."""
    return 0.0  # TODO
```

**Pista.** Es la primera fórmula de «La idea»: la velocidad por la tangente del volante, dividido entre `WHEELBASE`. La tangente es `math.tan(...)`, la tecla `tan` de tu calculadora (en radianes).

**Compruébalo** (debes ver `1 passed`):

```bash
python -m pytest course/tests/test_step_1.py -q -k yaw_rate
```

<details><summary>Ver la solución de este paso</summary>

```python
def yaw_rate(speed, steer):
    """How fast the car rotates (rad/s) when it drives at ``speed`` (m/s) with the front wheels at ``steer`` (rad)."""
    return speed * math.tan(steer) / WHEELBASE
```

</details>

### Paso 1.2: avanzar un instante

Ahora, una función que mueva el coche un instante `dt`. Como un paso al caminar: primero giras y después avanzas hacia donde miras. Sustituye la línea `def bicycle_step...: ...` por este esqueleto:

```python
def bicycle_step(x, y, yaw, speed, steer, dt):
    """Advance the car dt seconds: first the heading, then the position along the new heading."""
    return x, y, yaw  # TODO
```

**Pista.** Calcula el rumbo nuevo: el `yaw` de ahora más `yaw_rate(...)` por `dt`. Con ese rumbo nuevo mueve `x` con `cos` y `y` con `sin` (reparten el paso entre los dos ejes), multiplicando por `speed * dt`. Devuelve `x, y, yaw`.

**Compruébalo** (debes ver `1 passed`):

```bash
python -m pytest course/tests/test_step_1.py -q -k mini_car
``` 
<details><summary>Ver la solución de este paso</summary>

```python
def bicycle_step(x, y, yaw, speed, steer, dt):
    """Advance the car dt seconds: first the heading, then the position along the new heading."""
    yaw = yaw + yaw_rate(speed, steer) * dt
    return x + speed * math.cos(yaw) * dt, y + speed * math.sin(yaw) * dt, yaw
```

</details>

### Paso 1.3: el radio del círculo

Por último, una función que diga cuánto mide el círculo (su radio) que dibuja el coche con el volante fijo. Cuanto más giras, más pequeño es el círculo. Sustituye la línea `def turn_radius...: ...` por este esqueleto:

```python
def turn_radius(steer):
    """Radius (m) of the circle the car draws with the wheels fixed at ``steer`` (rad)."""
    return 0.0  # TODO
```

**Pista.** Es la segunda fórmula de «La idea»: `WHEELBASE` dividido entre la tangente del volante. Usa el valor absoluto (`abs(steer)`) para que girar a la izquierda y a la derecha den el mismo radio.

**Compruébalo:**

```bash
python -m pytest course/tests/test_step_1.py -q -k smallest_circle
```


<details><summary>Ver la solución de este paso</summary>

```python
def turn_radius(steer):
    """Radius (m) of the circle the car draws with the wheels fixed at ``steer`` (rad)."""
    return WHEELBASE / math.tan(abs(steer))
```

</details>

## Pruébalo en el simulador

Primero las cinco pruebas juntas, sin ROS ni Gazebo (debes ver `5 passed`):

```bash
python -m pytest course/tests/test_step_1.py -q
```

Después compila y comprueba el paso en Gazebo, sin ventana y con un campo vacío (sin paredes, porque un círculo no cabe en un pasillo de 1 m). En macOS, antes haz `source tools/macos_env.sh ~/robotek-ros/jazzy`.

```bash
colcon build --symlink-install --packages-select my_open && source install/setup.bash
python3 course/verify_step.py 1
```

La primera línea debe terminar sin errores. La segunda arranca el simulador y tu nodo, publica Start, mide la trayectoria real y ajusta un círculo. Debes ver `Paso 1: PASS` y una línea como `radio medido 0.463 m, esperado 0.460 m: diferencia +0.8 % (tolerancia 4 %)`; los milímetros cambian de una ejecución a otra.

Con otros volantes (`--param steer:=0.2`) la referencia midió, con el modelo de actuadores del coche real:

| Volante (rad) | Radio del modelo | Radio medido | Diferencia |
|---:|---:|---:|---:|
| 0,20 | 0,579 m | 0,582 m | menos del 1 % |
| 0,25 | 0,460 m | 0,463 m | menos del 1 % |
| 0,30 | 0,380 m | 0,43 m | +13 % (el tope del servo) |

Con 0,30 sale peor porque el simulador recorta el ángulo cerca del tope del servo (0,307 rad), desde unos 0,278 rad. No es un fallo tuyo.

Cuando termines, compara tu `model.py` con la referencia en la caja «Los cambios de este paso» (el `drive.py` es idéntico: lo copiaste).

### Rómpelo

1. En `yaw_rate` y en `turn_radius`, cambia `math.tan(steer)` por `steer`. Con ángulos pequeños casi no se nota (a 0,1 rad el radio pasa de 1,170 m a 1,174 m), pero con el volante a tope el radio mínimo pasa de 0,370 m a 0,382 m, un 3 % más. Ejecuta las pruebas: fallan tres, `test_yaw_rate_of_the_real_car_at_full_lock`, `test_smallest_circle_of_the_real_car` y `test_agrees_with_the_mini_car`. Un error del 3 % solo asoma con el volante a tope, y para eso están esas pruebas.
2. Deshaz el cambio. En `bicycle_step`, mueve la posición con el rumbo **viejo**. Ahora solo falla `test_agrees_with_the_mini_car`: tras 1 s la posición se desvía 3 a 5 mm del mini simulador. Es poco, pero la prueba lo detecta.

## Si algo falla

- **`ModuleNotFoundError: my_open` o `ImportError`.** Ejecuta pytest desde la raíz del repositorio y revisa que `model.py` tenga las tres funciones.
- **El coche no se mueve nunca.** No le llegó Start. Busca la línea `Start: ...` en `drive.log` (con `--keep-logs` se guarda siempre) y revisa que `drive.py` sea el copiado del tag `step-1`.
- **`FALLA` con un radio un 13 % mayor.** Probaste `steer:=0.3` o más: es el tope del servo, no un error tuyo. Baja a 0,25.

## Resumen

- El modelo de bicicleta convierte un ángulo de volante en un giro: `v * tan(δ) / L` rad/s, y un círculo de radio `L / tan(δ)`.
- El volante real llega a 17,6° (0,307 rad), así que el círculo más cerrado tiene 0,370 m de radio.
- En Gazebo tu modelo acierta con menos del 1 % de error mientras `steer` no pase de unos 0,28 rad.

## Antes de seguir

- [ ] `pytest` marca `5 passed` y `verify_step.py 1` termina en `PASS`.
- [ ] Sabes decir por qué el radio no depende de la velocidad.
- [ ] Probaste al menos uno de los dos «Rómpelo» y viste qué prueba falla.

<details><summary>Para curiosos: cómo funciona drive.py</summary>

`drive.py` es el nodo de ROS que usa tu `model.py`. No lo has escrito, pero esto es lo que hace:

- `create_publisher` abre el canal de salida `/cmd_vel_raw`, por donde manda órdenes al coche.
- `create_subscription` escucha el tópico `start` (la señal de salida, un `Bool`), igual que el botón del coche real.
- `create_timer` llama a `control` 50 veces por segundo. El nodo se llama `strategy`, así lo buscan las herramientas del curso.
- Al recibir Start escribe en el registro el radio que predice tu `turn_radius`, y manda `SPEED = 0.6` m/s con el volante fijo (el coche real llega a 0,42 m/s con esa orden).
- El coche recibe una velocidad de giro, no un ángulo, así que usa la fórmula del paso 1.1: `cmd.angular.z = SPEED * math.tan(self.steer) / WHEELBASE`.

</details>
