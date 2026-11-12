---
guide: "open-strategy"
order: 9.4
slug: "piezas-del-coche"
title: "Lista de piezas del coche (BOM)"
summary: "Todas las piezas del coche del equipo en una tabla: las impresas en 3D y las del kit Hiwonder, cada una con su render y su STL para descargar, y las que se compran."
tag: "step-9"
compareFrom: "step-9"
---

Esta es la **lista de piezas** (BOM, *bill of materials*) del coche del equipo Robotek, tal como estaba el 11 de noviembre de 2026. Cada pieza con modelo 3D tiene su render y su STL. Las imágenes y los STL salen del modelo del coche, `Assembly3.stp`, al que se añadieron el soporte trasero del VL53L0X, el soporte del botón, la RRC Lite real (el STEP oficial de Hiwonder) y la cámara IMX708 Wide (el STEP oficial de Raspberry Pi). El ensamblaje completo se puede bajar en STEP: [robotek-car-assembly.step.zip](/learn/piezas/robotek-car-assembly.step.zip) (15 MB). Cómo se monta todo está en [el capítulo siguiente](/learn/open-strategy/armar-y-conectar-el-coche/).

<figure>
<img src="/learn/piezas/car-iso.png" alt="Render del coche completo: placa base, caja, Raspberry Pi, cámara, LiDAR y las cuatro ruedas" width="600" loading="lazy">
<figcaption>El coche completo en el modelo 3D, visto por el lado de la Raspberry Pi, con el soporte del VL53L0X en la parte trasera de la placa.</figcaption>
</figure>

<figure>
<img src="/learn/piezas/car-rrc-side.png" alt="Render del coche por el lado derecho: la RRC Lite de canto en la caja" width="470" loading="lazy">
<figcaption>El otro lado: la RRC Lite de canto en el lado derecho de la caja, en los mismos agujeros (58 × 49 mm) que la Raspberry Pi.</figcaption>
</figure>

> **Antes de imprimir.** Cada STL conserva la posición que tiene la pieza en el coche, así que no siempre está apoyado sobre la cama. En Bambu Studio o en tu laminador, usa *Colocar sobre una cara* (o *Lay on face*) antes de laminar. Las medidas van en milímetros.

## Piezas impresas en 3D

| Render | Pieza | Cant. | Medidas (mm) | Volumen | Descargar |
|---|---|---:|---|---:|---|
| <img src="/learn/piezas/base-plate.png" alt="placa base" width="160" loading="lazy"> | **Placa base** (`Base_v1`): el chasis; lleva el servo, la dirección, el LiDAR y la caja | 1 | 232 × 90 × 36 | 66,1 cm³ | [base-plate.stl](/learn/piezas/base-plate.stl) |
| <img src="/learn/piezas/case.png" alt="caja" width="160" loading="lazy"> | **Caja** (`Case_v2`): la Raspberry Pi y la RRC Lite, una a cada lado | 1 | 90 × 90 × 64 | 76,5 cm³ | [case.stl](/learn/piezas/case.stl) |
| <img src="/learn/piezas/camera-support.png" alt="soporte de la cámara" width="160" loading="lazy"> | **Soporte de la cámara** (`Support_v2`): sobre la caja, con la cámara inclinada hacia el suelo | 1 | 39 × 47 × 62 | 21,1 cm³ | [camera-support.stl](/learn/piezas/camera-support.stl) |
| <img src="/learn/piezas/wheel.png" alt="rueda" width="160" loading="lazy"> | **Rueda** (PLA): las cuatro son iguales | 4 | Ø 60 × 12 | 29,0 cm³ | [wheel.stl](/learn/piezas/wheel.stl) |
| <img src="/learn/piezas/wheel-tread.png" alt="banda de rodadura" width="160" loading="lazy"> | **Banda de rodadura**: en el modelo es de silicona. En el coche real se usan protectores de rueda de maleta (ver la lista de compra). | 4 | Ø 61 × 14,5 | 1,4 cm³ | [wheel-tread.stl](/learn/piezas/wheel-tread.stl) |
| <img src="/learn/piezas/vl53-rear-bracket.png" alt="soporte trasero del VL53L0X" width="160" loading="lazy"> | **Soporte trasero del VL53L0X**: en el borde trasero de la placa, sobre ella, con el sensor mirando hacia atrás | 1 | 23 × 30 × 26 | 3,3 cm³ | [vl53-rear-bracket.stl](/learn/piezas/vl53-rear-bracket.stl) |
| <img src="/learn/piezas/top-button-holder.png" alt="soporte del botón" width="160" loading="lazy"> | **Soporte del botón**: en la tapa de la caja, para el botón de Start | 1 | 18 × 18 × 2,5 | 0,6 cm³ | [top-button-holder.stl](/learn/piezas/top-button-holder.stl) |

## Piezas de la dirección (kit Hiwonder MentorPi A1)

Estas piezas vienen en el kit MentorPi A1 de Hiwonder. Los STL salen del STEP oficial del kit, que nos mandó su soporte técnico. Sirven para ver la forma o para imprimir un repuesto, pero no son el archivo de fabricación.

| Render | Pieza | Cant. | Medidas (mm) | Descargar |
|---|---|---:|---|---|
| <img src="/learn/piezas/knuckle-left.png" alt="mangueta" width="160" loading="lazy"> | **Manguetas**: giran la rueda delantera y tienen el brazo de la dirección | 1 izq. + 1 der. | 41 × 24 × 24 | [knuckle-left.stl](/learn/piezas/knuckle-left.stl) · [knuckle-right.stl](/learn/piezas/knuckle-right.stl) |
| <img src="/learn/piezas/hex-hub.png" alt="buje hexagonal" width="160" loading="lazy"> | **Bujes hexagonales**: unen la rueda delantera a la mangueta | 1 izq. + 1 der. | 14 × 18 × 12 | [hex-hub-left.stl](/learn/piezas/hex-hub-left.stl) · [hex-hub-right.stl](/learn/piezas/hex-hub-right.stl) |
| <img src="/learn/piezas/kingpin-plate.png" alt="placa de los pivotes" width="160" loading="lazy"> | **Placa de los pivotes**: debajo de las manguetas, atornillada a los agujeros de la placa base | 1 | 26 × 83 × 1,5 | [kingpin-plate.stl](/learn/piezas/kingpin-plate.stl) |

## Electrónica y sensores (se compran)

Sus STL son los modelos del ensamblaje (el de la RRC Lite, el STEP oficial de Hiwonder comprimido; su STL pesaría 69 MB). Sirven para diseñar soportes o comprobar que algo cabe; no hay que imprimirlos.

| Render | Pieza | Cant. | Para qué | Modelo |
|---|---|---:|---|---|
| <img src="/learn/piezas/raspberry-pi-5.png" alt="Raspberry Pi 5" width="160" loading="lazy"> | **Raspberry Pi 5** | 1 | El cerebro: corre ROS 2 y la estrategia | [raspberry-pi-5.stl](/learn/piezas/raspberry-pi-5.stl) |
| <img src="/learn/piezas/rrc-lite.png" alt="RRC Lite" width="160" loading="lazy"> | **Placa RRC Lite** (Hiwonder) | 1 | IMU, servo, motor, botón y medida de la batería; da los 5 V del Pi. El modelo es el STEP oficial de Hiwonder, sin sus cuatro torretas de 19 mm. | [rrc-lite.step.zip](/learn/piezas/rrc-lite.step.zip) (STEP, 7 MB) |
| <img src="/learn/piezas/lidar-ld19.png" alt="LiDAR LD19" width="160" loading="lazy"> | **LiDAR LD19** (STL-19P) con su adaptador USB y 4 tornillos PA2×6 | 1 | Distancias en ±110° hacia delante | [lidar-ld19.stl](/learn/piezas/lidar-ld19.stl) |
| <img src="/learn/piezas/camera.png" alt="cámara IMX708 en su soporte" width="160" loading="lazy"> | **Cámara IMX708 Wide** (Raspberry Pi Camera Module 3 Wide) con su cable plano | 1 | El color de las líneas y de las señales. En el render, dentro de su soporte con el objetivo hacia delante y abajo. | [STEP oficial](https://pip.raspberrypi.com/categories/1207-design-files) (Raspberry Pi, `camera-module-3-step`) |
| <img src="/learn/piezas/servo.png" alt="servo" width="160" loading="lazy"> | **Servo digital de 15 kg·cm** (en el modelo, TGY-1501) | 1 | La dirección | [servo.stl](/learn/piezas/servo.stl) |
| <img src="/learn/assembly/part-motor.png" alt="motor" width="160" loading="lazy"> | **Motor JGA27-310R 20:1** (7,4 V, 450 rpm sin carga) con encoder, y dos engranajes 54:30 | 1 | La tracción trasera, en el puerto **M2** de la RRC Lite. No está en el modelo 3D; el dibujo es aproximado. | — |
| | **Sensor VL53L0X** | 1 | Distancia hacia atrás; va en su soporte trasero | — |
| | **Botón** (GPIO) | 1 | El Start; va en su soporte, en la tapa | — |
| | **Anillo de 16 LED WS2812** | 1 | Luz para ver mejor los colores, y el estado del coche | — |
| | **Batería** | 1 | Alimenta la RRC Lite, que da 5 V al Pi y mueve el servo y el motor | — |
| | **Protectores de rueda de maleta** | 4 | Los neumáticos de las ruedas impresas | — |

## Tornillería y cables

| Pieza | Cant. | Dónde |
|---|---:|---|
| Tornillo M2×10 (ISO 7045) | 7 | La Raspberry Pi y la RRC Lite a la caja |
| Tornillo M2×14 (ISO 7045) | 1 | La Raspberry Pi y la RRC Lite a la caja |
| Tuerca M2 | 8 | Con los tornillos M2 |
| Tornillo PA2×6 | 4 | El LiDAR a la placa base |
| Tornillo M1.6×16 (ISO 7045) y tuerca M1.6 | 2 + 2 | La cámara a su soporte (eran para la cámara anterior: los agujeros del soporte están a 25 mm y los de la IMX708 a 21 mm) |
| Cables USB | 2 | Las conexiones al Pi (ver el diagrama de cables) |
| Cable USB-C | 1 | Ídem |
| Cables dupont hembra-hembra | 3 | Los LED |

## Límites de esta lista

- **Fecha:** está al día al 11 de noviembre de 2026. Si el coche cambia, manda el coche real.
- **Sin modelo 3D:** el motor, sus engranajes, el eje trasero, el VL53L0X, el botón, el anillo de LED y la batería no están en el modelo 3D, así que no tienen STL.
- **Modelo frente al coche real:** el modelo tiene además una placa de 50 × 40 mm sobre la parte trasera de la placa base que el coche real no lleva; aquí no aparece. La IMX708 está en el sitio de la cámara anterior, centrada y en el mismo plano, pero sus agujeros (21 mm) no coinciden con los del soporte (25 mm), así que en el modelo no lleva tornillos; cómo va sujeta en el coche real no lo dice el modelo.
- **Soportes nuevos:** el soporte trasero del VL53L0X y el del botón se diseñaron para este coche; antes de imprimir varios, comprueba uno en el coche.
