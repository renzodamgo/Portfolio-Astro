#!/usr/bin/env python3
"""Rewrites the "## Escríbelo" section of the Obstacle guide steps 1 to 8 with the recipe of the Open guide: one function
(or one small group) per sub-step, each with why it exists, a skeleton to paste, "Qué va dentro", an example with
numbers, the exact pytest command with the count it gives, and the solution folded. Skeletons and solutions are cut
from the course's solution (public/learn/py/obstacle/ref, tag obstacle-step-9); the counts were measured with it.

    python3 tools/obstacle_write_sections.py

Keeps the "> En este paso" box, the `git show ... drive.py` block and any "###" that is not a "Paso N.k".
"""
import ast
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
REF = HERE / 'public' / 'learn' / 'py' / 'obstacle' / 'ref'
STEPS = HERE / 'src' / 'content' / 'learn' / 'steps' / 'obstacle-strategy'


# ------------------------------------------------------------------------------------------ cutting the reference
def source(module):
    return (REF / f'{module}.py').read_text()


def node_of(module, name):
    tree = ast.parse(source(module))
    parts = name.split('.')
    body = tree.body
    found = None
    for part in parts:
        found = next(n for n in body if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name == part)
        body = found.body
    return found


def segment(module, node):
    lines = source(module).splitlines()
    start = node.lineno - 1 - len(node.decorator_list)
    return '\n'.join(lines[start:node.end_lineno])


def solution(module, names):
    parts = [segment(module, node_of(module, n)) for n in names]
    return '\n\n\n'.join(parts).replace('\n\n\n    def', '\n\n    def')


def skeleton(module, names, todo):
    out = []
    header = None
    for n in names:
        if '.' in n:
            cls = n.split('.')[0]
            if header != cls:
                header = cls
                out.append(f'class {cls}:' + ('' if n.endswith('__init__') else '\n    # ... (lo de los pasos anteriores)'))
        node = node_of(module, n)
        lines = source(module).splitlines()
        indent = ' ' * node.col_offset
        if isinstance(node, ast.ClassDef):
            head = lines[node.lineno - 1 - len(node.decorator_list):node.lineno]
            doc = ast.get_docstring(node)
            body = [f'{indent}    """{doc.splitlines()[0]}"""'] if doc else []
            out.append('\n'.join(head + body + [f'{indent}    ...  # TODO {todo}']))
            continue
        first = node.body[0]
        has_doc = isinstance(first, ast.Expr) and isinstance(getattr(first, 'value', None), ast.Constant) and isinstance(first.value.value, str)
        end_head = (first.end_lineno if has_doc else first.lineno - 1)
        head = lines[node.lineno - 1 - len(node.decorator_list):end_head]
        out.append('\n'.join(head + [f'{indent}    ...  # TODO {todo}']))
    text = '\n\n\n'.join(out).replace(':\n\n\n    def', ':\n    def')
    return text.replace('\n\n\n    def', '\n\n    def')   # methods of a class: one blank line


def preamble(module):
    """Module docstring (its first line), imports and top-level constants: what the student pastes first."""
    tree = ast.parse(source(module))
    lines = source(module).splitlines()
    first = next(n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.ClassDef)))
    start = 0
    doc = ast.get_docstring(tree)
    head = []
    if doc:
        head = [f'"""{doc.splitlines()[0]}"""', '']
        start = tree.body[0].end_lineno
    body = lines[start:first.lineno - 1 - len(first.decorator_list)]
    while body and not body[0].strip():
        body.pop(0)
    while body and not body[-1].strip():
        body.pop()
    return '\n'.join(head + body)


# ------------------------------------------------------------------------------------------ the sub-steps
S = {}
S[1] = dict(module='lane', file='lane.py', subs=[
    dict(title='el carril', names=['lane_pose'], k='starts_on_the_bottom or quarter_circle or closes', n=3,
         why='El carril son cuatro piezas iguales: una recta y un cuarto de círculo, giradas. Como un reloj: basta '
             'saber dibujar las 3 en punto y girar el resultado para las 6, las 9 y las 12. `lane_pose` resuelve la '
             'recta de abajo y su esquina, y gira el punto un cuarto de vuelta por cada recta que ya quedó atrás.',
         inside='Toma `progress % 8`: la sección es la parte entera y `frac` lo que sobra. En una sección par (recta), '
                '`x = -0.5 + frac`, `y = -1.0`, rumbo 0. En una impar (esquina), el ángulo `theta = -π/2 + frac·π/2` '
                'alrededor de la esquina de la isla (0,5, −0,5): `x = 0.5 + 0.5·cos(theta)`, `y = -0.5 + 0.5·sin(theta)`, '
                'rumbo `theta + π/2`. Después gira `(x, y) → (−y, x)` y suma π/2 al rumbo `section // 2` veces.',
         example='`lane_pose(0)` = (−0,5, −1,0, 0): el principio de la recta de salida. `lane_pose(1,5)` = (0,85, −0,85, 0,79): '
                 'la mitad de la primera esquina, rumbo 45°. `lane_pose(2)` = (1,0, −0,5, π/2) y `lane_pose(8)` vuelve al principio.',
         passes='la recta de salida, un cuarto de círculo de 0,5 m y el carril que se cierra tras 8 unidades'),
    dict(title='la normal', names=['lane_normal'], k='normal', n=1,
         why='Para pasar una señal por un lado hay que poder decir «0,15 m a la izquierda del carril». La normal es la '
             'flecha que apunta a la izquierda del sentido de avance: siempre hacia la isla.',
         inside='La normal a la izquierda de un rumbo `h` es `(−sin h, cos h)`; `h` es el tercer número de `lane_pose`.',
         example='En la recta de salida (rumbo 0) la normal es (0, 1): hacia arriba, hacia la isla. Un punto con '
                 'desplazamiento `d` es `lane_pose + d · lane_normal`: con `d = −0,1`, la fila exterior.',
         passes='que la normal apunta a la isla en las cuatro rectas'),
    dict(title='avanzar unos metros', names=['advance'], k='advance', n=1,
         why='El volante mira 10 o 15 cm por delante, pero el progreso no se mide en metros: en una esquina una unidad '
             'son 0,785 m. `advance` convierte metros en unidades según dónde está el coche.',
         inside='La sección es `int(progress) % 8`. En una recta (par) la escala es 1; en una esquina, `CORNER_UNITS` '
                '(π/4). Devuelve `progress + metres / escala`.',
         example='`advance(0.5, 0.1)` = 0,6. `advance(1.5, 0.1)` = 1,5 + 0,1 / 0,785 = 1,627: en la esquina, 10 cm son más progreso.',
         passes='los metros a la escala de una recta y de una esquina'),
    dict(title='el progreso de un punto', names=['_offsets', '_lane_points', 'progress_of'], k='progress_of', n=1,
         why='El coche sabe su posición (x, y); para saber qué señal tiene delante necesita su progreso. `progress_of` '
             'busca el punto del carril más cercano, pero solo hacia delante de donde ya iba: así nunca salta a la recta de enfrente.',
         inside='Prueba los progresos de `start` a `start + span` cada `step` (2 cm), calcula sus puntos del carril y '
                'devuelve el de menor distancia a (x, y). Con NumPy, todos a la vez: `_lane_points` es `lane_pose` para '
                'un arreglo (sin el rumbo) y `_offsets` guarda la lista de saltos (con `lru_cache`, porque siempre es la misma).',
         example='Un coche en (0, −0,95) con `start = 0` da 0,5: la mitad de la recta de salida, aunque esté 5 cm a un lado.',
         passes='el punto más cercano por delante, en una recta y en una esquina'),
    dict(title='el progreso desde cualquier sitio', names=['track_s', 'unwrap_s'], k='track_s or unwrap', n=2,
         why='El localizador (paso 2) necesita el progreso de la pose sin un punto de partida, y el progreso tiene que '
             'seguir contando vueltas: 7,99 → 8,01, no 7,99 → 0,01.',
         inside='`track_s(x, y)`: para cada uno de los cuatro giros, en una recta el progreso es `2k + x_girada + 0,5`; '
                'delante de una esquina, `2k + 1 + ángulo/(π/2)`. Funciona con arreglos (`np.where`). `unwrap_s(previous, current)` '
                'es `previous + ((current − previous + 4) % 8 − 4)`: mueve `current` vueltas enteras hasta quedar cerca de `previous`.',
         example='`unwrap_s(7.9, 0.1)` = 8,1: el coche acaba de empezar la segunda vuelta.',
         passes='el progreso de cualquier punto del campo y que sigue contando vueltas'),
])
S[2] = dict(module='localizer', file='localizer.py', subs=[
    dict(title='los puntos del escaneo', names=['scan_points'], k='scan_points', n=1,
         why='El LiDAR da 306 distancias; para compararlas con los muros hay que convertirlas en puntos. En sentido '
             'horario todo se trabaja en espejo, así que los puntos también.',
         inside='Ángulo de cada rayo: `angle_min + i · angle_increment`. Quédate con los válidos (finitos, entre 0,16 y '
                '4 m). Cada punto es `x = r·cos(a) + LIDAR_OFFSET_X` (el LiDAR está 12,8 cm delante del centro) y '
                '`y = sign · r·sin(a)`.',
         example='Un rayo de 0,5 m a 90° (a la izquierda) da el punto (0,128, 0,5); en horario, (0,128, −0,5).',
         passes='que los puntos están en el sistema del coche y en espejo en horario'),
    dict(title='predecir', names=['Localizer.__init__', 'Localizer.predict'], k='predict', n=1,
         why='Entre escaneo y escaneo el coche avanza a ciegas: sabe cuánto (la odometría del LiDAR) y hacia dónde (el '
             'giroscopio). Usar el rumbo **medio** del tramo evita que una curva se convierta en una recta torcida.',
         inside='`mid = th + 0.5 · wrap(heading − th)`; suma `distance · cos(mid)` a x y `distance · sin(mid)` a y; el rumbo nuevo es `heading`.',
         example='Desde (0, 0, 0), `predict(0.1, 0.2)` deja el coche en (0,0995, 0,0100, 0,2): 10 cm por el rumbo medio, 0,1 rad.',
         passes='un paso de 10 cm con el rumbo medio'),
    dict(title='corregir con los muros', names=['Localizer._fit', 'Localizer.correct'], k='correct_pulls', n=1,
         why='La predicción se desvía unos milímetros por escaneo. Cada escaneo la corrige: se mueve la pose hasta que '
             'los puntos caen sobre los muros que el campo tiene seguro (los cuatro de fuera y la isla), como encajar '
             'una plantilla sobre un dibujo.',
         inside='`_fit`: pasa los puntos al campo con la pose; a cada punto le toca el muro exterior de su eje dominante '
                '(`|x| ≥ |y|` → muro de x) o la cara de la isla que tiene enfrente, la que esté más cerca; su error `r` es la '
                'distancia con signo a ese muro y su normal `(nx, ny)`; quédate con los de `|r| < gate`. `correct`: dos '
                'iteraciones de Gauss-Newton con `J = [nx, ny, nx·−(py − y) + ny·(px − x)]`, pesos de Huber '
                '`min(1, 0,02/|r|)` y `damping · I`; con menos de 20 puntos, no corrige. Mueve la pose `gain` veces la solución.',
         example='Con una pose 8 cm y 6° desviada, cinco correcciones la dejan a 2 mm (prueba el widget de arriba).',
         passes='que una pose equivocada vuelve a los muros'),
    dict(title='empezar sin saber dónde', names=['Localizer.initialize'], k='initialize or cw_is_the_mirror', n=5,
         why='Al arrancar el coche no sabe en qué parte de la recta de salida está. Prueba tres sitios y se queda con el que mejor encaja.',
         inside='Para `x0` en −0,35, 0 y 0,35: pose `(x0, −1, heading)` y `correct` con puertas cada vez más estrechas '
                '(0,45, 0,3, 0,2, 0,12, 0,08, 0,06; `gain` 1, `damping` 0,5). Puntúa cada una con `puntos − 2000 · rms` '
                '(con `_fit` a 5 cm) y quédate con la mejor.',
         example='Desde x = −0,3, 0, 0,2 en la recta, `initialize` encuentra la pose real a menos de 2 cm.',
         passes='el arranque en cuatro puntos de la recta de salida y el espejo en horario'),
    dict(title='el sentido con un escaneo', names=['direction_from_scan'], k='direction_from_the_walls', n=1,
         why='Nadie le dice al coche el sentido de la ronda. Pero la isla mide 1 m y el muro de fuera 3 m: con la '
             'hipótesis equivocada, menos puntos caen sobre un muro.',
         inside='Para `sign` en +1 y −1: `scan_points(scan, sign)` (menos de 50 puntos: `(0, 0)`), un `Localizer` nuevo '
                'con `initialize(bx, by, 0)`, y la fracción de puntos a menos de 5 cm de un muro. Devuelve el signo con '
                'más fracción y la diferencia (el margen).',
         example='En la salida antihoraria: 100 % de puntos en un muro con la isla a la izquierda y 82 % a la derecha: margen 0,18.',
         passes='antihorario y horario desde la salida, con margen de más de 0,10'),
])
S[3] = dict(module='signs', file='signs.py', subs=[
    dict(title='dónde está un clúster', names=['sign_position'], k='a_sign_ahead or behind_or_too_far', n=2,
         why='El LiDAR ve una señal como un grupito de puntos separado de los muros (un clúster). Para guardarla hay que '
             'decir dónde está **en el carril**: su progreso y su lado.',
         inside='Pasa el clúster al campo con la pose (su `y` por `sign` en horario). Descártalo si, medido a lo largo del '
                'carril desde `lane_pose(phi)`, está detrás (menos de −0,05 m) o más allá de `lookahead`, o a más de '
                '`lookahead + 0,5` m del coche. Su progreso es `progress_of(wx, wy, phi)` y su lateral, la proyección '
                'sobre `lane_normal` en ese progreso.',
         example='El coche en (−0,5, −1,0) mira al este y ve un clúster en (1,0, 0,1) del coche: progreso 1,0, lateral +0,1 (fila interior).',
         passes='una señal por delante sobre el carril, y nada detrás o demasiado lejos'),
    dict(title='de qué color', names=['sign_colour'], k='old_observations or cw_mirrors', n=2,
         why='La cámara da bloques de color con su posición; la señal es del color del bloque que está justo encima del '
             'clúster. Una foto vieja no vale: el coche ya se movió.',
         inside='Si las observaciones tienen más de `COLOUR_AGE` (0,6 s) respecto al escaneo, `None`. Si no, el color de '
                'la primera observación a menos de `COLOUR_GATE` (12 cm) del clúster; en horario, cambiado con `SWAP` (en '
                'el espejo una roja se pasa como una verde).',
         example='Un clúster en (1,0, 0,1) y una observación roja en (1,05, 0,12): está a 5,4 cm, es roja; en horario devuelve verde.',
         passes='que una foto vieja no colorea y el espejo de horario'),
    dict(title='la memoria', names=['SeatMemory.__init__', 'SeatMemory.remember'], k='memory_files or clusters_off_the_rows', n=2,
         why='La cámara ve solo 66,7°: una señal sale de su vista mucho antes de pasarla. Pero las señales no se mueven en '
             'toda la ronda y solo hay 24 sitios posibles. Así que se guardan por **asiento**, con sus votos de color, '
             'como un casillero.',
         inside='Para cada clúster: `sign_position`; descártalo si es `None` o si `|lateral| > SECTOR`; el asiento es '
                '`round(progreso · 2) / 2`; descártalo si está a más de `SEAT_SNAP` o si `seat % 2 > 1` (eso es una '
                'esquina). La clave es `int(round(seat · 2)) % 16`; guarda la fila (`±ROW`), una vista más y, si '
                '`sign_colour` da un color, un voto.',
         example='Un clúster en progreso 0,52 y lateral 0,09 va al asiento 0,5 (clave 1), fila +0,1.',
         passes='los asientos con votos, y que lo que no está en una fila o un asiento no entra'),
    dict(title='leer la memoria', names=['SeatMemory.colour', 'SeatMemory.next_sign', 'SeatMemory.ahead'], k='remembered_a_lap_later', n=1,
         why='El resto de la estrategia pregunta dos cosas: cuál es la próxima señal y qué señales hay en los próximos metros.',
         inside='`colour(key)`: el más votado o `None`. `next_sign(phi, lookahead)`: la señal vista al menos `SEAT_HITS` '
                'veces más cercana por delante, `(lateral, progreso, color)`; cada asiento se lleva a esta vuelta con '
                '`origen + (seat − origen) % 8`, `origen = phi − 0,05`. `ahead(phi, behind, horizon)`: '
                '`{progreso: (lateral, color)}` desde `behind` atrás hasta `horizon` delante, con el progreso contando vueltas.',
         example='Con phi = 8,2 (segunda vuelta), una roja guardada en el asiento 0,5 sale en el progreso 8,5.',
         passes='que un color visto en la vuelta 1 vale en la vuelta 2'),
])
S[4] = dict(module='plan', file='plan.py', subs=[
    dict(title='el lado de una señal', names=['side_offset'], k='red_on_the_right or unknown_colour', n=2,
         why='El reglamento: las rojas por la derecha, las verdes por la izquierda. En el carril, «izquierda» es hacia la '
             'isla (positivo). El coche pasa a una distancia de la fila igual al margen más medio coche.',
         inside='Sin color: aléjate `UNKNOWN_OFFSET` de la fila (`−0,12` de una interior, `+0,12` de una exterior). Roja: '
                '`lateral − clearance`; verde: `lateral + clearance`. Limita a `±OFFSET_LIMIT`.',
         example='`clearance` = 0,18 + 0,074 = 0,254. Una roja interior (+0,1) pide −0,154; una verde exterior (−0,1), +0,154; una verde interior, +0,354 → limitado a +0,36.',
         passes='roja por la derecha, verde por la izquierda y el color desconocido'),
    dict(title='nudos y rampas', names=['with_offsets', 'sign_knots', 'offset_at'], k='held_around_a_sign', n=1,
         why='La línea se describe con nudos (progreso, desplazamiento): uno 0,15 antes y otro 0,15 después de cada señal '
             '(el coche mide 0,233 m y tiene que estar de su lado mientras la cruza), y rampas rectas en medio.',
         inside='`with_offsets` añade `side_offset` a cada señal de `{progreso: (lateral, color)}`. `sign_knots` da '
                '`(s − HOLD, d)` y `(s + HOLD, d)` por señal, más los de `lookouts`, sin ordenar. `offset_at` interpola '
                'entre nudos ordenados: antes del primero, el primero; después del último, el último; sin nudos, 0.',
         example='Una roja interior en 0,5 y una verde exterior en 1,0: −0,154 de 0,35 a 0,65, rampa hasta +0,154 en 0,85, y así hasta 1,15.',
         passes='el desplazamiento sostenido junto a una señal y las rampas'),
    dict(title='mirar por adelantado', names=['lookouts'], k='lookout', n=1,
         why='Una señal sin color al principio de la recta siguiente no entra en la cámara desde el lado de fuera. Si el '
             'coche pasa 1,5 unidades antes por el lado de la isla, la ve casi toda la recta.',
         inside='Para cada señal sin color en una recta (progreso par) cuyo punto `s − 1,5` está al menos 0,1 por '
                'delante y sin otra señal a menos de 0,4: un nudo `(s − 1,5, LOOKOUT)` si es interior, o `(s − 1,5, 0)` si es exterior.',
         example='Una interior sin color en 2,0 con el coche en 0,2: un nudo en (0,5, +0,15).',
         passes='el nudo para mirar una señal de la recta siguiente'),
    dict(title='junto al aparcamiento', names=['lot_zone'], k='lot_zone', n=1,
         why='Los topes del aparcamiento sobresalen 20 cm del muro de la recta de salida: ahí la línea no puede ir pegada al muro.',
         inside='Con `s = progress % 8`: en antihorario la zona va de 0,43 a 1,18; en horario, de −0,18 a 0,57 (también cuenta `s − 8`).',
         example='`lot_zone(0.6, "ccw")` es `True`; `lot_zone(1.5, "ccw")`, `False`.',
         passes='la zona del aparcamiento en los dos sentidos'),
])
S[5] = dict(module='corner', file='corner.py', subs=[
    dict(title='la forma de la esquina', names=['path'], k=None, n=None,
         why='Una esquina es recta, arco y recta, como gira una persona en bicicleta. Tres números la describen: el '
             'desplazamiento antes (`d_a`), el radio (`r`) y el desplazamiento después (`d_b`).',
         inside='Recta A en `y = −1 + d_a`, recta B en `x = 1 − d_b`, centro del arco `(1 − d_b − r, −1 + d_a + r)`. '
                'Muestras cada 2 cm: la recta A desde `min(0,35, cx)`, el arco de −π/2 a 0 y la recta B hasta '
                '`max(−0,35, cy)`. En el arco el cuerpo apunta un poco hacia fuera: '
                '`slip = atan2(WHEELBASE/2, √(r² − (WHEELBASE/2)²))`. Si la recta A empieza antes de −0,3 o el centro '
                'pasa de 0,3, no cabe: `None`.',
         example='`path(0, 0, 0.5)` es el centro del carril: un cuarto de círculo de 0,5 m alrededor de (0,5, −0,5).',
         passes=None),
    dict(title='el margen', names=['_outline', '_box_distance', 'clearance', '_cut'], k='wrong_side', n=1,
         why='Una línea vale lo que su punto más justo: la menor distancia del contorno del coche a las señales, la isla '
             'y el muro. Y si pasa una señal por el lado equivocado, el margen es negativo.',
         inside='Mueve el contorno (147,7 mm delante, 85,2 detrás, 74 de medio ancho) a cada muestra y mide la distancia a '
                'la isla, al muro y a la caja de cada señal. Para el lado, `_cut` corta el contorno con la línea de la '
                'señal y da el intervalo lateral `[low, high]`: una roja exige todo el coche por debajo '
                '(`lateral − SIGN_HALF − high`), una verde todo por encima (`low − lateral − SIGN_HALF`).',
         example='La línea del centro del carril con una verde interior al principio de la recta siguiente da −0,23: el coche la pasaría por la derecha, el lado equivocado.',
         passes='que un lado equivocado da margen negativo'),
    dict(title='buscar la mejor', names=['_band', 'plan', 'knots'], k='every_corner or passes_both', n=26,
         why='Con las dos señales de la esquina, se prueban todas las líneas posibles y se elige la de más margen; si '
             'varias dejan 11 cm o más, la más cercana al centro (cambios de lado más cortos).',
         inside='`_band` da los desplazamientos permitidos de un extremo (del lado correcto de su señal, cada 2 cm; sin '
                'señal, ±0,1 alrededor del vecino). `plan` prueba radios 0,5, 0,6 y 0,75 con todas las combinaciones y '
                'puntúa `(1, −distancia al centro, r)` si el margen llega a `ENOUGH`, o `(0, margen, r)`; con `lru_cache`. '
                '`knots` pasa la línea a (progreso desde la esquina, desplazamiento).',
         example='Verde interior al final y roja exterior al principio de la siguiente: margen 3,4 cm con `d_a` = +0,24, `d_b` = −0,34, r = 0,5. Pruébalo en el widget de arriba.',
         passes='los 25 casos de señales (al menos 3 cm de margen y radio de 0,5 m o más) y que la línea pasa cada señal por su lado'),
    dict(title='la esquina en el plan', names=['corner_line', 'merge'], k='keep_off_the_parking_lot or merge', n=2,
         why='El plan del paso 4 tiene nudos para todas las señales; en cada esquina hay que cambiar los suyos por la línea de la esquina.',
         inside='`corner_line(start, signs, low_a, low_b)`: la señal del último asiento de la recta (progreso `start`) y '
                'la del primero de la siguiente (`start + 1`) dan la línea; un extremo sin señal usa el desplazamiento '
                'vecino. `merge` recorre las esquinas desde 1,3 atrás hasta `horizon` delante, **sustituye** los nudos '
                'de dentro de cada esquina por su línea y lo ordena todo. Con `lot_direction`, junto al aparcamiento '
                'nunca baja de `LOT_OFFSET`.',
         example='Con una roja exterior en 1,0 (el último asiento de la recta de salida) la esquina 1 empieza a −0,30 del carril, pegada al muro, y sale a −0,10 con un arco de 0,6 m (9,8 cm de margen). Con el aparcamiento, junto a él nunca baja de −0,19.',
         passes='la línea densa de la esquina en el plan y el límite del aparcamiento'),
])
S[6] = dict(module='follow', file='follow.py', subs=[
    dict(title='un punto de la línea', names=['point', 'reference'], k='reference_on_a_straight or reference_in_a_corner', n=2,
         why='Para seguir la línea hay que saber, en cada sitio, dónde está, hacia dónde va y cuánto se curva. Tres '
             'puntos seguidos lo dicen todo, como tres estacas en una curva.',
         inside='`point(offset, s)` = `lane_pose(s) + offset(s) · lane_normal(s)`. `reference(offset, s)`: los puntos en '
                '`advance(s, −STENCIL)`, `s` y `advance(s, +STENCIL)`; el rumbo es el de la cuerda del primero al '
                'tercero y la curvatura `κ = 2 · cruz / (producto de los tres lados)`.',
         example='En la recta de salida con desplazamiento 0,15 la referencia es (x, −0,85, 0, 0); en una esquina del centro, κ = 2 (radio 0,5 m).',
         passes='la referencia en una recta desplazada y en una esquina'),
    dict(title='el volante', names=['steer'], k='feed_forward or left_of_the_line', n=2,
         why='Tres piezas, como al conducir: girar lo que pide la curva antes de llegar (el servo tarda 0,1 s), corregir '
             'la distancia a la línea y corregir el ángulo, amortiguado con el giroscopio.',
         inside='La referencia en `phi` y la curvatura en `advance(phi, PREVIEW)`. Error lateral '
                '`−(x − px)·sin θ + (y − py)·cos θ`. Volante `atan(WHEELBASE · κ) − LATERAL_GAIN · error − kp · wrap(th − θ) − kd · gyro`, limitado a `±limit`.',
         example='En la esquina del centro, sin error, el volante es `atan(0,1174 · 2)` = 0,23 rad (13,2°): solo la anticipación.',
         passes='que sobre la línea solo actúa la anticipación y que a la izquierda corrige a la derecha'),
])
S[7] = dict(module='mission', file='mission.py', subs=[
    dict(title='los parámetros', names=['Params', 'make_params'], k='unknown_parameters', n=1,
         why='Todo lo que se ajusta sin tocar el código va en un solo sitio, y un nombre mal escrito no puede pasar en silencio.',
         inside='`Params` es un `dataclass` con los valores de la tabla de arriba. `make_params(values)` compara los '
                'nombres con los campos y lanza `ValueError` si alguno no existe; si no, crea `Params` con los valores en `float`.',
         example="`make_params({'cruise_sped': 0.4})` falla: el nombre está mal escrito.",
         passes='que un parámetro desconocido se rechaza'),
    dict(title='los estados', names=['Mission.observe', 'Mission.step'], k='setup_calibrates or stops_after', n=3,
         why='La misión es un repartidor: según el estado, cada tick va a una función. `SETUP` calibra y elige el sentido, '
             '`RUN` conduce, `PARK` aparca (paso 8) y `STOP` se queda quieto.',
         inside='`observe` guarda las observaciones de la cámara. `step` calcula `dt` (entre 0 y 0,1 s), quita el sesgo '
                'del giroscopio, guarda el escaneo si es nuevo y reparte: `SETUP` → `_setup`, `STOP` → `(0, 0, "STOP")`, '
                '`PARK` → `_park`, si no `_run`.',
         example='Los primeros 0,3 s devuelve `(0, 0, "SETUP")`; con el primer escaneo bueno elige el sentido y pasa a `RUN`.',
         passes='la calibración y el sentido en los dos sentidos, y que para tras tres vueltas'),
    dict(title='la salida', names=['Mission._start', 'Mission._backup'], k='backing_up', n=1,
         why='Si la primera señal está justo delante, el coche no tiene metros para cambiar de lado. Retroceder un poco '
             'en recta se los da (el reglamento deja ir hacia atrás en la sección de salida).',
         inside='`_start`: quieto `START_LOOK` (0,25 s, hasta 1 s si la señal de delante no tiene color); después, '
                'retrocede a 0,15 m/s hasta `_backup_to`. `_backup`: solo con una señal en el asiento central '
                '(`progreso % 2 == 0,5`), `0,55 + 0,8 · |desplazamiento| − lo que ya hay`, entre 0 y 0,5 m.',
         example='Una roja interior en 0,5 con el coche en 0,25: hacen falta 0,55 + 0,8 · 0,154 − 0,1 = 0,57 m; retrocede 0,5 (el máximo).',
         passes='que retrocede solo con una señal en el asiento central'),
    dict(title='mirar', names=['Mission._look'], k='stops_to_look', n=1,
         why='Si el color no llega a tiempo, el coche para, retrocede girando para que el morro (y la cámara) apunten a '
             'la señal, y espera un cuadro. Lento, pero mejor que adivinar.',
         inside='Si la próxima señal no tiene color, no se miró antes y está entre 0,6 y 1,4 unidades: fase `back` '
                '(retrocede a fondo hacia el lado contrario hasta girar 15° o 3 s), fase `look` (quieto `PEEK_LOOK`, 0,5 s). '
                'En cuanto llega el color, termina.',
         example='En la ronda del paso 7 mira dos veces: a los 12 s y a los 31 s.',
         passes='que se para a mirar una señal sin color'),
    dict(title='la estrategia', names=[], module2='strategy', names2=['Strategy'], k='is_a_course_strategy or each_scan_stamp', n=2,
         why='La misión no sabe de ROS. `Strategy` la conecta con la clase base del curso, que le da los sensores ya '
             'preparados (escaneo, giroscopio integrado, distancia, señales).',
         inside='En `update`: si hay un escaneo nuevo, sus clústeres (`scan_clusters`, una vez por escaneo); '
                '`mission.observe(self.signs, self.signs_stamp)`; `mission.step(...)`; copia el sesgo, la etiqueta, '
                '`done` (`STOP`) y `parked`.',
         example='Es lo que corren Gazebo, el laboratorio y las pruebas: la misma clase en los tres.',
         passes='que es una estrategia del curso y que cada escaneo se usa una vez'),
])
S[8] = dict(module='park', file='park.py', subs=[
    dict(title='el hueco', names=['footprint', 'Lot'], k='lot_of_the_rules or inside_and_parallel', n=2,
         why='Antes de buscar cómo entrar hay que saber qué es «estar dentro»: las cuatro esquinas del coche dentro del '
             'hueco y paralelo al muro.',
         inside='`footprint` da las cuatro esquinas del contorno. `Lot(sign)`: el hueco del reglamento en el campo '
                'espejado (x de 0,13 a 0,48 en antihorario; y de −1,5 a −1,3), con `limits`, `parked` (rumbo a menos '
                'de 3° y las cuatro esquinas dentro), `free` (contorno y ruedas giradas lejos de topes y muro) y `arc`.',
         example='El coche centrado en (0,30, −1,40) con rumbo 0 está aparcado; a 10° o en y = −1,2, no.',
         passes='el hueco del reglamento (1,5 coches por 0,20 m) y qué es aparcado'),
    dict(title='moverse como el coche', names=['move'], k='rear_axle', n=1,
         why='La búsqueda prueba miles de arcos cortos. El modelo de bicicleta es exacto en el eje trasero, no en el centro.',
         inside='Pasa al eje trasero (`REAR_AXLE_X`, negativo), gira `dth = ds·tan(steer)/WHEELBASE`, avanza por el rumbo medio y vuelve a `base_link`.',
         example='`move(0, 0, 0, 0, 0.1)` = (0,1, 0, 0): recto, 10 cm.',
         passes='el modelo de bicicleta sobre el eje trasero'),
    dict(title='buscar las maniobras', names=['search', 'nominal_plan'], k='planning_pose', n=1,
         why='No cabe en una maniobra (haría falta un hueco de 0,42 m y hay 0,35). A* prueba arcos de 3 cm hacia '
             'delante y hacia atrás y encuentra la secuencia más corta, como una persona que va y viene en un hueco justo.',
         inside='Cola de prioridad con `(coste + peso · h, coste, pose, marcha, camino)`; `h` = distancia al centro del '
                'hueco + 0,1 · |rumbo|. Para cada nodo: si está aparcado con 1,5 cm por lado, devuelve el camino; si no, '
                'los 5 volantes × 2 sentidos con `lot.arc`; cambiar de marcha cuesta 5 cm. `nominal_plan` busca una vez '
                'desde la pose de planificar y lo guarda.',
         example='Desde la pose de planificar: 24 arcos en 14 maniobras, 19 719 nodos. Mira el widget de arriba.',
         passes='un plan desde la pose de planificar'),
    dict(title='conducir el plan', names=['Parking'], k='it_parks', n=2,
         why='Planificar es la mitad: después hay que ejecutar cada maniobra con el coche de verdad, parando entre una y '
             'otra para girar las ruedas, y volver a planificar si algo no sale.',
         inside='Estados `PARK_APPROACH` → `PARK_PLAN` → (`PARK_STEER` → `PARK_MOVE`)* → `PARKED` o `PARK_FAIL`. '
                'Acercarse siguiendo la línea a 4 cm del hueco; planificar quieto; cada tramo de arcos iguales es una '
                'maniobra: quieto mientras gira el servo, luego a 0,06 m/s hasta el giro previsto menos lo que rueda '
                'tras la orden (1,2 cm). Si no quedó aparcado, otro plan (como mucho 10).',
         example='En la repetición del paso 8: 14 maniobras, un segundo plan desde donde quedó y aparcado a los 88 s.',
         passes='que aparca de verdad en el laboratorio, en los dos sentidos (unos 40 s)'),
])

TEST = 'python -m pytest course/tests/obstacle/test_obstacle_step_{step}.py -q'


def render(step, spec):
    out = []
    module = spec['module']
    out.append(f'Crea `src/my_obstacle/my_obstacle/{spec["file"]}` con su cabecera y sus constantes (ya hechas):\n')
    out.append('```python\n' + preamble(module) + '\n```\n')
    for i, sub in enumerate(spec['subs'], 1):
        tag = f'{step}.{i}'
        mod = sub.get('module2', module)
        names = sub['names'] or sub.get('names2', [])
        out.append(f'### Paso {tag}: {sub["title"]}\n')
        out.append(sub['why'] + '\n')
        if names:
            out.append('Y debajo, este esqueleto:\n' if i > 1 or step != 1 else 'Debajo de las constantes, este esqueleto:\n')
            out.append('```python\n' + skeleton(mod, names, tag) + '\n```\n')
        out.append(f'**Qué va dentro:** {sub["inside"]}\n')
        out.append(f'**Un ejemplo:** {sub["example"]}\n')
        if sub.get('k'):
            out.append('```bash\n' + TEST.format(step=step) + f' -k "{sub["k"]}"\n```\n')
            out.append(f'Debes ver `{sub["n"]} passed`: {sub["passes"]}.\n')
        else:
            out.append('Esta función la comprueba el sub-paso siguiente.\n')
        if names:
            label = ', '.join(n.split('.')[-1] for n in names)
            out.append(f'<details>\n<summary>Ver la solución de {label}</summary>\n\n```python\n{solution(mod, names)}\n```\n\n</details>\n')
    return '\n'.join(out)


def main():
    for step, spec in S.items():
        path = next(STEPS.glob(f'paso-{step}-*.md'))
        text = path.read_text()
        start = text.index('## Escríbelo\n')
        end = text.index('\n## Pruébalo')
        section = text[start:end]
        box = re.search(r'\n(> \*\*En este paso\*\*.*?)\n\n', section, re.S)
        drive = re.search(r'\n(```bash\ngit show obstacle-step-\d:src/my_obstacle/my_obstacle/drive\.py.*?```)\n', section, re.S)
        extra = [m.group(0) for m in re.finditer(r'\n### (?!Paso )[^\n]+\n.*?(?=\n### |\Z)', section, re.S)]
        parts = ['## Escríbelo\n']
        if box:
            parts.append(box.group(1) + '\n')
        if drive:
            parts.append(drive.group(1) + '\n')
        parts.append(render(step, spec))
        for e in extra:
            parts.append(e.strip('\n') + '\n')
        new = '\n'.join(parts).rstrip('\n') + '\n'
        path.write_text(text[:start] + new + text[end:])
        print(path.name, f'{len(section)} -> {len(new)} chars')


if __name__ == '__main__':
    main()
