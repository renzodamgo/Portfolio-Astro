---
guide: "open-strategy"
order: 9.5
slug: "armar-y-conectar-el-coche"
title: "Armar y conectar el coche"
summary: "Las instrucciones de montaje del coche del equipo, paso a paso y con dibujos de sus piezas, y cómo conectar cada cable."
tag: "step-9"
compareFrom: "step-9"
---

Antes de llevar tu nodo al coche real ([el capítulo siguiente](/learn/open-strategy/paso-10-el-coche-real/)) hay que armarlo y cablearlo. Estas instrucciones siguen el orden del README del equipo Robotek ([Robotek-WRO2026](https://github.com/strvaeq/Robotek-WRO2026), sección *Assembly Instructions*) y su diagrama de cables, con dibujos hechos a partir del modelo 3D del coche que usa la simulación: las mismas piezas (`robotek_description/meshes`, sacadas del `Assembly3.stp` del 20 y 21 de octubre de 2026) en el mismo sitio que en el URDF.

> **Qué es exacto y qué es aproximado.** La placa base, la caja, el soporte y la cámara, el servo, la Raspberry Pi, la placa del driver, el LiDAR LD19, la placa RRC Lite y todos los tornillos y tuercas son las piezas del modelo 3D del equipo (`Assembly3.stp`, abierto en SolidCraft), en su sitio; en ese modelo la RRC Lite tiene la forma de una Raspberry Pi. Las ruedas salen de las medidas del URDF (`vehicle.py`). El motor, el eje y las piezas de la dirección **no están en el modelo**: los dibujé con formas simples donde los describe el README del equipo, así que su forma y su posición son aproximadas. Ante cualquier duda, manda el coche real y las fotos del equipo ([`v-photos`](https://github.com/strvaeq/Robotek-WRO2026/tree/main/v-photos)).

## Lo que necesitas

| Pieza | Cantidad | Para qué |
|---|---:|---|
| Placa base y piezas impresas en 3D (caja, soporte de cámara, ruedas) | 1 juego | El chasis; los STL están en [`models`](https://github.com/strvaeq/Robotek-WRO2026/tree/main/models) |
| Raspberry Pi 5 | 1 | El cerebro: corre ROS 2 y tu nodo |
| Placa RRC Lite | 1 | IMU, servo, botón, medida de batería; da los 5 V del Pi |
| LiDAR LD19 (STL-19P) con su adaptador USB | 1 | Distancias en ±110° hacia delante |
| Cámara USB (icSpring) | 1 | Color de las líneas y de las señales |
| Servo digital de 15 kg·cm | 1 | La dirección |
| Motor de 25 mm con reductora | 1 | La tracción trasera |
| Puente TB6612FNG | 1 | Mueve el motor desde los pines del Pi |
| Batería para el motor | 1 | Solo el motor, por el TB6612 (VM) |
| Batería para el Pi | 1 | La RRC Lite, que da 5 V al Pi y mueve el servo |
| Anillo de 16 LED WS2812 | 1 | Luz para ver mejor los colores |
| Protectores de rueda de maleta | 4 | Los neumáticos de las ruedas impresas |
| Cables USB (3), USB-C (1), dupont hembra-hembra (unos 9) | | Las conexiones |
| Tornillos M2×10 (7) y M2×14 (1), tuercas M2 (8) | | La Raspberry Pi y la RRC Lite a la caja |
| Tornillos PA2×6 (4) | | El LiDAR |
| Tornillos M1.6×16 (2) y tuercas M1.6 (2) | | La cámara a su soporte |

Herramientas: destornilladores pequeños, llave para las tuercas del kit y, si vas a cambiar cables, un tester.

## Bolsa 1: el chasis

<div class="lego-step">
<div><div class="lego-num">1</div>
<div class="lego-parts"><figure><img src="/learn/assembly/part-plate.png" alt="placa base" loading="lazy"><figcaption><b>1x</b>placa base</figcaption></figure></div></div>
<img class="lego-view" src="/learn/assembly/step-1.png" alt="Paso 1: la placa base sola" loading="lazy">
<p class="lego-note">La placa base del kit (la del modelo del equipo). La pestaña de delante, más baja, es donde irá el LiDAR; los agujeros de los ejes marcan la distancia entre ejes de 117,4 mm.</p>
</div>

<div class="lego-step">
<div><div class="lego-num">2</div>
<div class="lego-parts"><figure><img src="/learn/assembly/part-servo.png" alt="servo" loading="lazy"><figcaption><b>1x</b>servo</figcaption></figure><figure><img src="/learn/assembly/part-ackermann.png" alt="dirección Ackermann" loading="lazy"><figcaption><b>1x</b>dirección Ackermann</figcaption></figure></div></div>
<img class="lego-view" src="/learn/assembly/step-2.png" alt="Paso 2: el servo baja hasta su hueco en la placa; la dirección se monta delante" loading="lazy">
<p class="lego-note">Atornilla las piezas fijas de la dirección a la placa y, a sus lados, las dos piezas móviles que giran las ruedas: deben girar libres, y se usa el agujero más cercano a la rueda. Únelas con la barra de dirección (con rodamientos en los extremos). Una bieleta más corta va de una de esas piezas al servo, que se monta <b>vertical</b> en la placa; el eje del servo y el lado de la bieleta quedan en lados opuestos.</p>
</div>

<div class="lego-step">
<div><div class="lego-num">3</div>
<div class="lego-parts"><figure><img src="/learn/assembly/part-motor.png" alt="motor de 25 mm" loading="lazy"><figcaption><b>1x</b>motor de 25 mm</figcaption></figure><figure><img src="/learn/assembly/part-axle.png" alt="eje trasero" loading="lazy"><figcaption><b>1x</b>eje trasero</figcaption></figure></div></div>
<img class="lego-view" src="/learn/assembly/step-3.png" alt="Paso 3: el eje entra de lado y el motor por detrás (posiciones aproximadas)" loading="lazy">
<p class="lego-note">Atornilla el soporte del motor a la placa y el motor al soporte. El eje pasa por las dos aberturas del soporte, sobre dos rodamientos que lo centran y dos anillos que lo frenan de lado. Une el eje del motor y el eje trasero con separadores, sin que choquen con los tornillos del motor.</p>
</div>

<div class="lego-step">
<div><div class="lego-num">4</div>
<div class="lego-parts"><figure><img src="/learn/assembly/part-wheelFL.png" alt="rueda" loading="lazy"><figcaption><b>4x</b>rueda</figcaption></figure></div></div>
<img class="lego-view" src="/learn/assembly/step-4.png" alt="Paso 4: las cuatro ruedas entran por los lados" loading="lazy">
<p class="lego-note">Las cuatro ruedas impresas, con un protector de rueda de maleta como neumático (61 mm de diámetro, 14,5 mm de ancho). Las delanteras van en los bujes de la dirección, con rodamientos que las dejen girar libres; las traseras, en el eje. Vía: 133,5 mm delante y 123,5 mm detrás.</p>
</div>


## Bolsa 2: la electrónica y los sensores


<div class="lego-step">
<div><div class="lego-num">5</div>
<div class="lego-parts"><figure><img src="/learn/assembly/part-driver.png" alt="placa del driver" loading="lazy"><figcaption><b>1x</b>placa del driver</figcaption></figure></div></div>
<img class="lego-view" src="/learn/assembly/step-5.png" alt="Paso 5: la placa del driver baja a la parte trasera" loading="lazy">
<p class="lego-note">La placa del driver va en la parte trasera de la placa base (en el modelo del equipo se llama <code>driver_board</code>).</p>
</div>

<div class="lego-step">
<div><div class="lego-num">6</div>
<div class="lego-parts"><figure><img src="/learn/assembly/part-case.png" alt="caja impresa" loading="lazy"><figcaption><b>1x</b>caja impresa</figcaption></figure></div></div>
<img class="lego-view" src="/learn/assembly/step-6.png" alt="Paso 6: la caja impresa baja sobre la placa" loading="lazy">
<p class="lego-note">La caja impresa va encima de la placa y forma un techo sobre el servo, que asoma por arriba de la base.</p>
</div>

<div class="lego-step">
<div><div class="lego-num">7</div>
<div class="lego-parts"><figure><img src="/learn/assembly/part-pi.png" alt="Raspberry Pi 5" loading="lazy"><figcaption><b>1x</b>Raspberry Pi 5</figcaption></figure><figure><img src="/learn/assembly/part-m2x10.png" alt="tornillo M2×10" loading="lazy"><figcaption><b>4x</b>tornillo M2×10</figcaption></figure><figure><img src="/learn/assembly/part-nutM2.png" alt="tuerca M2" loading="lazy"><figcaption><b>4x</b>tuerca M2</figcaption></figure></div></div>
<img class="lego-view" src="/learn/assembly/step-7.png" alt="Paso 7: la Raspberry Pi entra de lado en la caja con cuatro tornillos M2" loading="lazy">
<p class="lego-note">La Raspberry Pi 5 va <b>de canto</b>, en el lado izquierdo de la caja: cuatro tornillos M2×10 desde fuera y sus tuercas por dentro. Así montada, los ejes de la IMU no coinciden con los del coche: el capítulo siguiente explica cómo medirlos con <code>imu_axes</code>.</p>
</div>

<div class="lego-step">
<div><div class="lego-num">8</div>
<div class="lego-parts"><figure><img src="/learn/assembly/part-rrc.png" alt="placa RRC Lite" loading="lazy"><figcaption><b>1x</b>placa RRC Lite</figcaption></figure><figure><img src="/learn/assembly/part-m2x10.png" alt="tornillo M2×10" loading="lazy"><figcaption><b>3x</b>tornillo M2×10</figcaption></figure><figure><img src="/learn/assembly/part-m2x14.png" alt="tornillo M2×14" loading="lazy"><figcaption><b>1x</b>tornillo M2×14</figcaption></figure><figure><img src="/learn/assembly/part-nutM2.png" alt="tuerca M2" loading="lazy"><figcaption><b>4x</b>tuerca M2</figcaption></figure></div></div>
<img class="lego-view" src="/learn/assembly/step-8.png" alt="Paso 8: la RRC Lite entra de lado por la derecha de la caja con cuatro tornillos M2" loading="lazy">
<p class="lego-note">La placa RRC Lite va de canto en el otro lado de la caja (el derecho), con tres tornillos M2×10, uno M2×14 y cuatro tuercas M2. Es la que lleva la IMU: si la cambias de lado, cambian los ejes.</p>
</div>

<div class="lego-step">
<div><div class="lego-num">9</div>
<div class="lego-parts"><figure><img src="/learn/assembly/part-lidar.png" alt="LiDAR LD19" loading="lazy"><figcaption><b>1x</b>LiDAR LD19</figcaption></figure><figure><img src="/learn/assembly/part-pa2x6.png" alt="tornillo PA2×6" loading="lazy"><figcaption><b>4x</b>tornillo PA2×6</figcaption></figure></div></div>
<img class="lego-view" src="/learn/assembly/step-9.png" alt="Paso 9: el LiDAR baja a la pestaña delantera y cuatro tornillos suben desde abajo" loading="lazy">
<p class="lego-note">El LiDAR va delante, en la pestaña de la placa, sujeto desde abajo con cuatro tornillos PA2×6 y con la vista despejada: mira 110° a cada lado. Su plano de medida queda a 30 mm del suelo y 128 mm por delante del centro del coche (<code>base_link</code>).</p>
</div>

<div class="lego-step">
<div><div class="lego-num">10</div>
<div class="lego-parts"><figure><img src="/learn/assembly/part-camSupport.png" alt="soporte de la cámara" loading="lazy"><figcaption><b>1x</b>soporte de la cámara</figcaption></figure><figure><img src="/learn/assembly/part-camera.png" alt="cámara" loading="lazy"><figcaption><b>1x</b>cámara</figcaption></figure><figure><img src="/learn/assembly/part-m16x16.png" alt="tornillo M1.6×16" loading="lazy"><figcaption><b>2x</b>tornillo M1.6×16</figcaption></figure><figure><img src="/learn/assembly/part-nutM16.png" alt="tuerca M1.6" loading="lazy"><figcaption><b>2x</b>tuerca M1.6</figcaption></figure></div></div>
<img class="lego-view" src="/learn/assembly/step-10.png" alt="Paso 10: el soporte baja detrás del LiDAR, la cámara encaja arriba con dos tornillos M1.6" loading="lazy">
<p class="lego-note">El soporte de la cámara va justo detrás del LiDAR y es más alto, para que la cámara vea por encima; la cámara se sujeta con dos tornillos M1.6×16 y sus tuercas. Medido en el coche: la cámara queda a 144,6 mm del suelo, mirando unos 10° hacia abajo y 4,4° a la izquierda.</p>
</div>


## Bolsa 3: los cables

Con todo montado, conecta los cables **con las dos baterías desenchufadas**. El coche lleva dos: una solo para el motor y otra para la RRC Lite, que alimenta el Pi y el servo. Los colores de los dibujos son los de los esquemas, no tienen que coincidir con los de tus cables; lo que importa es cada extremo.

<img class="lego-wiring" src="/learn/assembly/wiring-usb.svg" alt="Paso 11: cámara, LiDAR y placa RRC Lite por USB a la Raspberry Pi 5" loading="lazy">

<img class="lego-wiring" src="/learn/assembly/wiring-motor.svg" alt="Paso 12: el TB6612FNG a los pines GPIO 12, 5, 6 y 13 y al 3,3 V del Pi; el motor al TB6612; el servo a la RRC Lite" loading="lazy">

<img class="lego-wiring" src="/learn/assembly/wiring-power.svg" alt="Paso 13: la batería del motor a la bornera VM del TB6612; la batería del Pi a la RRC Lite, que da 5 V al Pi por USB-C; el anillo de LED al GPIO10" loading="lazy">

| Cable | De | A | Ojo con |
|---|---|---|---|
| USB | Cámara | Pi, USB 0 azul | el nodo de la cámara muere si la conectas con todo en marcha: relánzalo |
| USB | Adaptador del LiDAR | Pi, USB 0 negro | 230 400 baudios; `/dev/serial/by-id/usb-Silicon_Labs_CP2102_…` |
| USB | RRC Lite | Pi, USB 1 negro | `/dev/serial/by-id/usb-1a86_USB_Single_Serial_…` |
| 3 hilos | Servo | RRC Lite, puerto de servo PWM | el número de puerto está por confirmar en el coche |
| 2 hilos | Motor | TB6612, A01 y A02 | si las ruedas giran al revés, intercámbialos |
| dupont | Pi GPIO12 (pin 32) | TB6612 PWMA | velocidad |
| dupont | Pi GPIO5 (pin 29) y GPIO6 (pin 31) | TB6612 AIN1 y AIN2 | sentido |
| dupont | Pi GPIO13 (pin 33) | TB6612 STBY | sin STBY en alto el motor no gira |
| dupont | Pi 3,3 V (pin 1) y GND | TB6612 VCC y GND | VCC es la lógica: 3,3 V, nunca la batería (aguanta 5,5 V como máximo). Este GND une las masas de las dos baterías |
| batería | Batería del motor | TB6612, bornera VM–GND | VM es la potencia del motor (2,5 a 13,5 V) |
| batería | Batería del Pi | RRC Lite, entrada de batería | la placa se apaga bajo 6 V |
| USB-C | RRC Lite (5 V, 5 A) | Pi, entrada USB-C | es la alimentación del Pi |
| dupont | Pi 5 V, GND y GPIO10 (pin 19) | anillo de LED: 5 V, GND y DIN | brillo bajo: al 100 % reinició el Pi |

## Paso 14: comprobar antes de rodar

<div class="lego-step">
<div><div class="lego-num">14</div>
<div class="lego-parts"><figure><img src="/learn/assembly/final-back.png" alt="El coche armado, visto desde atrás" loading="lazy"><figcaption><b>1x</b>coche armado</figcaption></figure></div></div>
<img class="lego-view" src="/learn/assembly/final.png" alt="El coche armado: placa, ruedas, servo, caja, Raspberry Pi, LiDAR y cámara" loading="lazy">
<p class="lego-note">Con el coche en alto (las ruedas sin tocar el suelo), enchufa primero la batería del Pi y espera a que arranque; la del motor, al final. Comprueba, en este orden y como explica el <a href="/learn/open-strategy/paso-10-el-coche-real/">capítulo siguiente</a> (sección 3): que se ven los tres USB, la cámara, el LiDAR (unos 10 Hz), la IMU (unos 49 Hz), el centro y el signo de la dirección y, por último, el motor a poca velocidad.</p>
</div>

## Si algo falla

- **El motor no gira y el servo sí.** Casi siempre es STBY (GPIO13), un dupont flojo en el TB6612 o la batería del motor descargada o sin conectar a VM.
- **El TB6612 se calienta sin motor.** Revisa que la batería del motor vaya a VM y no a VCC: VCC es solo la lógica, 3,3 V del Pi.
- **El Pi se reinicia.** Revisa cada conector (al equipo le pasó con un cable flojo) y baja el brillo de los LED.
- **Falta un dispositivo en `/dev/serial/by-id`.** Es el cable o el adaptador; los nombres no dependen del puerto.
- **Las ruedas delanteras no vuelven al centro o rozan.** Revisa que las piezas móviles de la dirección giren libres y que la bieleta corta vaya al lado contrario del eje del servo.

## Resumen

- Tres bolsas: el chasis (placa, dirección, motor, ruedas), la electrónica y los sensores (driver, caja, Pi, RRC Lite, LiDAR, cámara, con sus tornillos) y los cables (USB, motor y servo, energía y luces).
- Los sensores van por USB al Pi; el motor por el TB6612 a cuatro pines GPIO (y su lógica, VCC, al 3,3 V del Pi); el servo, a la RRC Lite.
- Dos baterías: la del motor a VM del TB6612 y la del Pi a la RRC Lite, que da 5 V al Pi por USB-C; las masas se unen por el GND del TB6612.
- Las piezas dibujadas salen del modelo 3D del equipo (el mismo de la simulación, más los tornillos, el LD19 y la RRC Lite de SolidCraft); el motor y la dirección, de la descripción del equipo.
