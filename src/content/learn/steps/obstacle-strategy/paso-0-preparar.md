---
guide: "obstacle-strategy"
order: 0
slug: "paso-0-preparar"
title: "Preparar el paquete"
summary: "Usa el entorno del Open, crea el paquete my_obstacle y corre una ronda del Obstacle en Gazebo."
tag: "obstacle-step-0"
compareFrom: "obstacle-step-0"
---

## Qué tendrás al final

1. El repositorio `robotek-learn` al día, compilado, con el campo del Obstacle: señales rojas y verdes y el aparcamiento.
2. Una ronda del Obstacle en Gazebo con el coche quieto (todavía no hay estrategia) y el árbitro que la puntúa.
3. Tu paquete `my_obstacle`, que compila y se ejecuta. Ahí vivirá la estrategia desde el paso 1.

Esta guía empieza donde terminó la del Open. Si no tienes el entorno, haz primero el [paso 0 del Open](/learn/open-strategy/paso-0-instalar-y-preparar/): instala ROS 2 Jazzy y Gazebo Harmonic, clona el repositorio y compila.

## Poner el repositorio al día

```bash
cd robotek-learn
git pull
git fetch origin --tags
colcon build --symlink-install
source install/setup.bash          # en macOS: source tools/macos_env.sh ~/robotek-ros/jazzy
```

## El campo del Obstacle en Gazebo

Una ronda se lanza con un solo comando. El campo se genera en el momento: `seed` elige las señales con el mismo sorteo de cartas del reglamento, `direction` el sentido y `parking:=true` pone el aparcamiento en la sección de salida.

```bash
ros2 launch robotek_course obstacle_round.launch.py strategy:=my_obstacle seed:=0 direction:=ccw parking:=true gui:=true
```

Hasta que escribas el paquete, el lanzador avisa de que `my_obstacle` no existe. Para ver solo el campo, usa la estrategia de referencia, que ya da vueltas:

```bash
git fetch origin solutions-obstacle
git worktree add ../robotek-learn-ref obstacle-step-9        # una copia aparte con la referencia
```

> **El campo que verás.** Tres señales de 50 × 50 × 100 mm por recta como mucho, en tres posiciones posibles a lo largo de la recta y dos filas (a 0,4 o 0,6 m del muro interior). El aparcamiento son dos topes magenta de 200 × 20 × 100 mm contra el muro exterior de la sección de salida. Con aparcamiento, las señales de esa sección pasan a la fila interior (reglamento, sorteo paso 4).

## Crear tu paquete

Desde la carpeta `src` del repositorio:

```bash
cd src
ros2 pkg create --build-type ament_python my_obstacle --node-name drive \
  --license MIT --maintainer-name "Tu Nombre" --maintainer-email tu@correo.com \
  --description "Mi estrategia del reto Obstacle" \
  --dependencies rclpy geometry_msgs sensor_msgs std_msgs cv_bridge robotek_common robotek_course
cd ..
colcon build --symlink-install --packages-select my_obstacle
source install/setup.bash
ros2 run my_obstacle drive          # imprime "Hi from my_obstacle."
```

`src/my_obstacle` está en el `.gitignore` de `main`: es tu código y no choca con las actualizaciones del curso.

## Las pruebas de cada paso

Cada paso tiene su archivo de pruebas, sin ROS ni Gazebo, que importa tu paquete desde `src/my_obstacle`:

```bash
python -m pytest course/tests/obstacle/test_obstacle_step_1.py -q
```

Son 83 pruebas en los nueve archivos. Ahora todas fallan con `ModuleNotFoundError` o `ImportError`: es lo esperado. Hasta el paso 6 el coche no se conduce solo: en los pasos 2 a 5 lo llevas tú con el teclado (`ros2 run robotek_course keyboard_drive`) mientras tu nodo publica lo que entiende. En macOS con RoboStack pon `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` delante de `python`.

## El laboratorio

Además de Gazebo hay un **laboratorio**: una ronda del Obstacle en Python puro, con el mismo campo, el LiDAR simulado por rayos contra las cajas, el giroscopio con sesgo y ruido, la cámara real (66,7° de campo, girada 4,4° a la izquierda) y el servo y el motor medidos. Una ronda tarda unos segundos en vez de un par de minutos, y en paralelo corre 50 rondas en menos de un minuto. Lo usarás desde el paso 7:

```bash
python3 -m robotek_evaluation.obstacle_lab --strategy my_obstacle.strategy:Strategy --seed 0 --direction ccw
```

> **El laboratorio filtra, Gazebo decide.** Lo que falla en el laboratorio casi seguro falla en Gazebo; lo que pasa en el laboratorio todavía hay que verlo en Gazebo. La cámara del laboratorio no ve imágenes: da el color y la posición de las señales que caen en su campo de visión.

## Antes de seguir

- [ ] `ros2 run my_obstacle drive` imprime el saludo.
- [ ] `ros2 launch robotek_course obstacle_round.launch.py ...` abre el campo con las señales y el aparcamiento.
- [ ] `python -m pytest course/tests/obstacle/test_obstacle_step_1.py -q` corre (y falla).
