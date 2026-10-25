---
guide: "open-strategy"
order: 0
slug: "paso-0-instalar-y-preparar"
title: "Instalar y preparar"
summary: "Instala el entorno, clona el repositorio y comprueba que las pruebas corren."
tag: "step-0"
compareFrom: "step-0"
---

## Qué tendrás al final

Al terminar este capítulo tendrás tres cosas:

1. ROS 2 Jazzy y Gazebo Harmonic instalados, con el repositorio del curso compilado.
2. El coche de la WRO en el campo Open, dentro de Gazebo, y las vistas del LiDAR y de la cámara en RViz. Lo conduces con el teclado.
3. Tu propio paquete de ROS, `my_open`, que compila y se ejecuta. Ahí vivirá tu estrategia a partir del paso 1.

Cuenta con una hora si todo va bien, casi toda en descargas. El entorno ocupa unos 4 GB en macOS y varios GB en Ubuntu (ROS 2 de escritorio más Gazebo). Deja unos 10 GB libres para no tener sorpresas.

> **Qué está probado.** Lo que ves aquí lo he ejecutado yo, pero no en todas partes:
>
> - Ubuntu 24.04 (arm64, en Docker): la instalación, `colcon build`, `ros2 pkg create` y rondas completas sin ventana, y también con la ventana de Gazebo usando render por software. Todo funciona.
> - macOS con RoboStack (Apple Silicon): rondas completas con ventana (Metal), 30 de 30 puntos. También creé el entorno desde cero con la línea de abajo (4,5 GB, unos 5 minutos) y en él compilé el repositorio y corrí una ronda en cada sentido: 30 de 30 en las dos.
> - No lo he probado: Linux con una GPU y una pantalla reales, WSL2, el coche real.
>
> Si algo de esto no funciona en tu máquina, cuéntamelo.

## Requisitos y sistema operativo

Necesitas un ordenador con Ubuntu 24.04 o con macOS en Apple Silicon, conexión a internet y una terminal. Elige tu sistema con las pestañas de abajo. La elección se recuerda en toda la guía.

<div data-os="ubuntu">

### Ubuntu 24.04 (o WSL2)

Ubuntu 24.04 es el sistema para el que está hecho ROS 2 Jazzy, y es el camino más corto.

> **WSL2 es experimental.** Ubuntu 24.04 dentro de WSL2 debería funcionar con la misma receta, pero el autor no lo ha probado. Gazebo y RViz necesitan WSLg (Windows 11, o Windows 10 reciente con los drivers al día). Si lo pruebas, dime si funcionó.

Primero instala `git` y clona el repositorio. El script de instalación está dentro del repositorio, así que hay que clonarlo antes:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/renzodamgo/robotek-learn.git
cd robotek-learn
```

Ahora el script. Instala `ros-jazzy-desktop` (incluye RViz), `ros-jazzy-ros-gz` (el puente con Gazebo Harmonic), el middleware `rmw_cyclonedds`, `pytest` y las herramientas de `colcon`. Te pide la contraseña de `sudo` y tarda un buen rato:

```bash
bash tools/install-ubuntu.sh
```

Compila el workspace desde la raíz del repositorio:

```bash
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
```

`--symlink-install` hace que `install/` apunte a tus archivos en lugar de copiarlos. Así, cuando edites Python, no hace falta recompilar.

El script añade `source /opt/ros/jazzy/setup.bash` a tu `~/.bashrc`, pero `source install/setup.bash` lo tienes que repetir en cada terminal nueva, desde la raíz del repositorio.

</div>

<div data-os="macos">

### macOS (RoboStack)

En macOS no hay paquetes oficiales de ROS 2 que sirvan para esto. Se usa [RoboStack](https://robostack.github.io/): ROS 2 Jazzy empaquetado en conda-forge, instalado con `micromamba`. Hace falta un Mac con Apple Silicon y las herramientas de Xcode (`xcode-select --install`).

> **Ojo con el ROS de Homebrew.** No lo uses para esto. Si ya lo tienes instalado no estorba: el script `tools/macos_env.sh` borra sus variables del entorno.

Instala `micromamba` y clona el repositorio:

```bash
brew install micromamba
git clone https://github.com/renzodamgo/robotek-learn.git
cd robotek-learn
```

Crea el entorno una sola vez. Es el mismo conjunto de paquetes con el que se ha probado el curso: Python 3.12, ROS 2 Jazzy base, el puente con Gazebo, `gz-sim8` (Gazebo Harmonic), RViz, `xacro` y `colcon`. `cv_bridge`, `pytest` y `rmw_cyclonedds` llegan como dependencias:

```bash
micromamba create -y -p ~/robotek-ros/jazzy \
  -c robostack-jazzy -c conda-forge --strict-channel-priority \
  python=3.12 ros-jazzy-ros-base ros-jazzy-ros-gz-sim ros-jazzy-ros-gz-bridge \
  ros-jazzy-robot-state-publisher ros-jazzy-rviz2 ros-jazzy-xacro \
  ros-jazzy-cv-bridge colcon-common-extensions gz-sim8
```

> **Probado desde cero.** Esta línea creó un entorno limpio con `micromamba` 2.10: 647 paquetes, 745 MB de descarga. Tarda unos minutos. Si `micromamba` te da un error de `libsimdjson` (pasó con la versión de Homebrew tras actualizar esa librería), haz `brew upgrade micromamba`.

Cada vez que abras una terminal para trabajar, prepárala con el script del repositorio:

```bash
cd robotek-learn
source tools/macos_env.sh ~/robotek-ros/jazzy
```

Ese script hace cuatro cosas que importan:

- Pone `ros2`, `gz` y `colcon` del entorno RoboStack en el `PATH` y quita lo que venga de Homebrew.
- Define `OGRE2_RESOURCE_PATH`. Sin esa variable, Gazebo no encuentra el render de Metal y se cae al arrancar la cámara y el LiDAR.
- Usa `rmw_cyclonedds_cpp` como middleware. Con el de por defecto (Fast DDS), en macOS se pierden casi todos los fotogramas de la cámara.
- Fija `ROS_DOMAIN_ID=42` y limita el descubrimiento a tu ordenador, para no cruzarte con otros ROS de la red.

La primera vez dirá `no install/ yet`. Es normal.

Ahora compila. En macOS hay un detalle: el `setuptools` reciente de conda (versión 80 o más) ya no entiende el modo editable que usa `colcon build --symlink-install`, y falla con `option --editable not recognized`. La salida más simple que he probado es instalar una copia vieja de `setuptools` en una carpeta aparte y ponerla en `PYTHONPATH` solo al compilar:

```bash
python -m pip install --target ~/robotek-ros/setuptools79 'setuptools<80'
PYTHONPATH=$HOME/robotek-ros/setuptools79 colcon build --symlink-install
source tools/macos_env.sh ~/robotek-ros/jazzy      # ahora sí carga install/
```

Tarda uno o dos minutos la primera vez. Verás avisos de CMake en `robotek_description` y `robotek_gazebo`; son normales.

Si prefieres no hacer eso, compila con `colcon build` a secas. Funciona, pero entonces `install/` es una copia y tendrás que recompilar tu paquete con `colcon build --packages-select my_open` cada vez que lo edites.

</div>

## Comprueba la instalación

Con el entorno cargado, comprueba que ROS y Gazebo responden:

```bash
echo $ROS_DISTRO          # jazzy
gz sim --versions         # 8.x (Gazebo Harmonic)
ros2 pkg list | grep robotek
```

Debes ver `jazzy`, una versión 8 de Gazebo y los paquetes `robotek_*` del repositorio. Si falta alguno, no has cargado `install/setup.bash` (Ubuntu) o `tools/macos_env.sh` (macOS).

Ahora lanza el simulador:

```bash
ros2 launch robotek_course sim.launch.py
```

Se abre la ventana de Gazebo con el campo del reto Open y el coche mirando en el sentido contrario a las agujas del reloj (`direction:=ccw`, el valor por defecto). El coche está quieto. Lleva un LiDAR, una cámara a 6 fotogramas por segundo y un giroscopio, con los mismos retrasos y ruido que el coche real.

Para ver lo que ve el coche, lanza el simulador con RViz:

```bash
ros2 launch robotek_course sim.launch.py rviz:=true
```

RViz muestra los puntos del LiDAR sobre las paredes y la imagen de la cámara. Hay una tercera imagen, `Direction evidence`, que queda vacía hasta que corra una estrategia.

Gazebo necesita una pantalla. Si tu máquina no tiene una (un servidor, un contenedor) o va muy justa de GPU, arranca sin la ventana y mira solo RViz:

```bash
ros2 launch robotek_course sim.launch.py gui:=false rviz:=true
```

El servidor de Gazebo corre igual sin ventana. Esto lo verifiqué en Docker con render por software. En el Mac, la simulación con cámara y LiDAR consume bastante CPU, y la ventana de Gazebo corre como un proceso aparte del servidor; si el ordenador se arrastra, cierra otras aplicaciones o prueba con `gui:=false`.

### Conduce con el teclado

Deja el simulador abierto. En otra terminal con el entorno cargado:

```bash
ros2 run robotek_course keyboard_drive
```

Esa terminal debe estar en primer plano, porque lee las teclas directamente.

| Tecla | Efecto |
|---|---|
| `w` / `s` | Más / menos velocidad (pasos de 0,1 m/s, hasta 1,28 hacia adelante y 0,4 hacia atrás) |
| `a` / `d` | Gira a la izquierda / a la derecha (pasos de 0,05 rad, con el tope del coche real: unos 17,6 grados) |
| `espacio` | Para el coche y centra la dirección |
| `q` | Sale |

El programa publica en `/cmd_vel_raw`, el mismo tema que publicará tu estrategia. La velocidad y el ángulo de dirección se convierten en una velocidad de giro con el modelo de bicicleta; ese modelo es justo lo que escribirás en el paso 1. Da una vuelta al campo y fíjate en cómo cambia el escaneo en RViz. Para cerrar, pulsa `q` en esa terminal y `Ctrl+C` en la del simulador.

## Crea tu paquete

Tu estrategia será un paquete de ROS 2 en Python llamado `my_open`. Se crea dentro de `src/`, junto a los demás. Pon tu nombre y tu correo en el comando:

```bash
cd src
ros2 pkg create --build-type ament_python my_open --node-name drive \
  --license MIT --maintainer-name "Tu Nombre" --maintainer-email tu@correo.com \
  --description "Mi estrategia del reto Open" \
  --dependencies rclpy geometry_msgs sensor_msgs std_msgs visualization_msgs cv_bridge robotek_common robotek_course
cd ..
```

Crea esto:

```text
src/my_open/
├── LICENSE
├── package.xml            # nombre del paquete y dependencias
├── setup.py               # cómo se instala y qué comandos expone
├── setup.cfg              # dónde se instalan los ejecutables
├── resource/my_open       # marcador para que ROS encuentre el paquete
├── my_open/
│   ├── __init__.py        # hace que la carpeta sea un módulo de Python
│   └── drive.py           # tu nodo: aquí vivirá la estrategia
└── test/                  # pruebas de estilo que genera ROS (copyright, flake8, pep257)
```

La lista de dependencias es larga a propósito. Es todo lo que usarás hasta el final del curso: `rclpy` (ROS en Python), los mensajes de velocidad, LiDAR e imagen, los marcadores de RViz, `cv_bridge` para pasar imágenes a OpenCV, y los paquetes del curso (`robotek_common` con las medidas del coche y `robotek_course` con la clase base de la estrategia). Declararlas ahora evita volver a tocar `package.xml` en cada paso.

Compila solo tu paquete y cárgalo. En macOS añade el prefijo `PYTHONPATH=$HOME/robotek-ros/setuptools79` delante de `colcon`:

```bash
colcon build --symlink-install --packages-select my_open
source install/setup.bash        # en macOS: source tools/macos_env.sh ~/robotek-ros/jazzy
ros2 run my_open drive
```

Debe imprimir `Hi from my_open.`. Ese es el nodo de plantilla. En el paso 1 empiezas a llenar `my_open/` con código.

Git ignora `src/my_open` en la rama `main`: es tu código, no el del repositorio. El repositorio tiene además una rama `solutions` con un commit y una etiqueta `step-N` por cada paso de la guía. Esta página corresponde a `step-0`. Para comparar tu trabajo con la referencia, desde el paso 1:

```bash
git fetch --tags
bash tools/compare-step.sh 1        # tu src/my_open contra la referencia del paso 1
bash tools/compare-step.sh 1 2      # qué cambia la referencia entre dos pasos
```

## Si algo falla

- **`rosdep install` falla con una dependencia que no encuentra.** No hace falta: `ros-jazzy-desktop` y `ros-jazzy-ros-gz` ya traen todo lo que pide el curso. Salta `rosdep` y ve directo a `colcon build`. (Si te sale justo `ament_python`, haz `git pull`: ya no está en el repositorio.)
- **La ronda puntúa casi 0 aunque el código esté bien, o el coche avanza muy despacio.** Casi siempre quedan procesos de una ejecución anterior que se interrumpió (un `gz sim`, los puentes o tus nodos). Se mezclan con la nueva ronda: dos modelos de actuadores publican a la vez. Es lo que más tiempo me hizo perder. Una ronda que termina sola limpia lo suyo, pero si cortas con Ctrl+C o por tiempo, ciérralo todo antes de lanzar otra vez:

  ```bash
  bash src/robotek_evaluation/tools/clean_sim.sh
  ```

- **`pytest` falla con `PluginValidationError` de `launch_testing` (típico en RoboStack).** Los plugins de ROS se cargan solos y chocan con `pytest`. Desactiva la carga automática:

  ```bash
  PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest course/tests/test_step_1.py
  ```

- **Veo topics o nodos que no son míos.** Otro ordenador de la red usa tu mismo `ROS_DOMAIN_ID`. Elige un número entre 0 y 101 y úsalo igual en todas tus terminales: `export ROS_DOMAIN_ID=37`. En macOS el script ya pone 42.
- **Gazebo no abre ventana en WSL2.** Comprueba que WSLg funciona (`echo $DISPLAY` no debe estar vacío y una app gráfica sencilla debe abrirse). Si no, usa `gui:=false rviz:=true`.
- **En macOS, `ros2` o `colcon` no es el de RoboStack, o `install/setup.sh` menciona `/opt/homebrew`.** Carga `tools/macos_env.sh` (limpia las variables de Homebrew) y vuelve a compilar.
- **En macOS, `option --editable not recognized`.** Falta el truco de `setuptools<80` descrito arriba.
- **En macOS aparece `no such file or directory ... ros2-argcomplete`.** Es un aviso del autocompletado; puedes ignorarlo.

## Cómo seguir la guía

Cada paso de la guía repite el mismo ciclo:

1. **Lee** la explicación de la página.
2. **Escribe** el código en tu editor, dentro de `src/my_open/my_open/`.
3. **Prueba** con `pytest`. Las pruebas de cada paso son Python puro, sin ROS ni Gazebo:

   ```bash
   python3 -m pytest course/tests/test_step_1.py
   ```

   En macOS, antepón `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`.
4. **Comprueba en Gazebo** con el script de verificación del paso, o lanzando una ronda con tu estrategia:

   ```bash
   ros2 launch robotek_course round.launch.py strategy:=my_open gui:=true direction:=ccw
   ```

5. **Compara** con la referencia: `bash tools/compare-step.sh N`.

Las rondas se guardan en `~/robotek_runs/` y los puntos son una estimación de simulación con las reglas publicadas, no una puntuación oficial. Si algo no te cuadra, vuelve a esta página: casi todos los problemas de instalación están en la sección anterior.

Cuando `ros2 run my_open drive` imprima `Hi from my_open.` y veas el coche en Gazebo, pasa al paso 1.
