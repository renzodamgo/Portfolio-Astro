#!/usr/bin/env python3
"""Replays of the Obstacle guide (public/learn/assets/replays/obstacle-step-N.json) for the step-replay widget.

Each one is a round of the course's reference strategy (my_obstacle, tag obstacle-step-9) in the web lessons'
simulator (public/learn/py/obstacle_runtime.py, a copy of the course's Obstacle lab): the real pose, the LiDAR, the
mission's state and events written for the idea of that step (the progress, what the car believes, the signs it
files, the side it passes them, the corners, the parking moves).

    python3 tools/obstacle_replays.py            # every step
    python3 tools/obstacle_replays.py 3 8        # some steps

Needs numpy (RoboStack's python works: ~/robotek-ros/jazzy/bin/python).
"""
import json
import math
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
PY = HERE / 'public' / 'learn' / 'py'
OUT = HERE / 'public' / 'learn' / 'assets' / 'replays'
LOT = dict(x0=0.48 - 1.5 * 0.2329, x1=0.48, y0=-1.5, y1=-1.3)

# my_obstacle from the course's solution, in a temporary package next to the runtime
PKG = Path(tempfile.mkdtemp()) / 'pkg'
(PKG / 'my_obstacle').mkdir(parents=True)
(PKG / 'my_obstacle' / '__init__.py').write_text('')
for f in (PY / 'obstacle' / 'ref').glob('*.py'):
    (PKG / 'my_obstacle' / f.name).write_text(f.read_text())
sys.path[:0] = [str(PKG), str(PY)]

import obstacle_runtime as orr  # noqa: E402
from my_obstacle import lane  # noqa: E402

FIELDS = {}
for key, signs in json.loads((HERE / 'tools' / 'obstacle_layouts.json').read_text()).items():
    FIELDS[key] = signs

NAMES = ['de salida', 'de la derecha', 'de arriba', 'de la izquierda']
f2 = lambda v: f'{v:.2f}'.replace('.', ',').replace('-', '−')  # noqa: E731
f1 = lambda v: f'{v:.1f}'.replace('.', ',').replace('-', '−')  # noqa: E731
COLOR = {'red': 'roja', 'green': 'verde', None: 'de color desconocido'}


def drive_py(laps, parking):
    return ('from my_obstacle.strategy import Strategy\n'
            f'def make_strategy(parking):\n'
            f"    params = {{'stop_progress': {8 * laps + 0.7}}}\n"
            + (f"    params['park_after'] = {8 * laps}\n" if parking else '')
            + '    return Strategy(parking=parking, params=params)\n')


def seat_name(progress):
    k = int(progress // 2) % 4
    along = progress - 2 * (progress // 2)
    where = {0.0: 'al inicio', 0.5: 'en la mitad', 1.0: 'al final'}.get(round(along * 2) / 2, '')
    return f'{where} de la recta {NAMES[k]}'


def world_point(mission, x, y):
    """Track frame -> world (clockwise rounds are mirrored)."""
    return (-x, y) if mission.selected_direction == 'cw' else (x, y)


def record(step, layout, direction, laps, parking, title, caption, extra=None, belief=False, seconds=200.0):
    (PKG / 'my_obstacle' / 'drive.py').write_text(drive_py(laps, parking))
    run = orr.Run(dict(direction=direction, parking=parking, signs=FIELDS[layout], seed=0))
    if run.error:
        raise SystemExit(run.error)
    st = run.strategy
    m = st.mission
    frames, believed, scans, labels, events = [], [], [], [], []
    state = {'label': None, 'phi_unit': None, 'seats': {}, 'lap': 0, 'parking': None, 'moves': 0, 'peek': None,
             'backup': False, 'err_max': 0.0, 'err_sum': 0.0, 'err_n': 0}
    t_last_scan = -1.0
    done_at = None
    while True:
        pose = run.advance(0.05)
        t = round(pose[5], 2)
        x, y, yaw, steer = pose[0], pose[1], pose[2], pose[3]
        frames.append([t, round(x, 4), round(y, 4), round(yaw, 4), round(steer, 4)])
        label = m.state if m.state != 'PARK' or m.parking is None else m.parking.state
        if m.state == 'RUN' and m._peek is not None:
            label = 'LOOK'
        if m.state == 'RUN' and m._backup_to not in (None, -math.inf) and m.speed < 0:
            label = 'BACKUP'
        if label != state['label']:
            state['label'] = label
            labels.append(dict(t=t, state=label, corners=None))
        if belief and m.state in ('RUN', 'PARK') and not math.isnan(m.pose[0]):
            bx, by = world_point(m, m.pose[0], m.pose[1])
            bth = math.pi - m.pose[2] if m.selected_direction == 'cw' else m.pose[2]
            believed.append([t, round(bx, 4), round(by, 4), round(bth, 4), 0.0])
            err = math.hypot(bx - x, by - y)
            state['err_max'] = max(state['err_max'], err)
            state['err_sum'] += err
            state['err_n'] += 1
        if t - t_last_scan >= 0.5 - 1e-9 and run.strategy.scan is not None:
            t_last_scan = t
            r = [None if not math.isfinite(v) else round(v, 3) for v in run.strategy.scan.ranges]
            scans.append(dict(t=t, track='main', ranges=r))
        if extra:
            extra(t, run, m, state, events)
        if pose[6] or pose[7] or pose[10]:
            raise SystemExit(f'step {step}: crash={pose[6]!r} wrong={pose[10]!r} {pose[7][-300:]}')
        if done_at is None and (m.state == 'STOP'):
            done_at = t
        if (done_at is not None and t - done_at > 1.0) or t > seconds:
            break
    tracks = [dict(id='main', label='El coche (pose real)', color='#e8a33d', frames=frames)]
    if belief and len(believed) > 2:
        tracks.append(dict(id='belief', label='Lo que cree el coche', color='#7db8ff', frames=believed))
    events.sort(key=lambda e: e['t'])
    signs = [dict(x=s['x'], y=s['y'], color=s['color']) for s in FIELDS[layout]]
    data = dict(version=1, step=step, title=title, caption=caption.format(time=f1(frames[-1][0])),
                field='square100', direction=direction, duration=frames[-1][0], tracks=tracks, trail=True,
                scans=scans, labels=labels, sections=True, events=events, signs=signs, lot=LOT if parking else None)
    path = OUT / f'obstacle-step-{step}.json'
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    print(f'{path.name}: {frames[-1][0]:.1f} s, {len(events)} events, {path.stat().st_size // 1024} KB'
          + (f", error medio {state['err_sum'] / max(state['err_n'], 1) * 100:.1f} cm, max {state['err_max'] * 100:.1f} cm" if belief else ''))
    return state


# ------------------------------------------------------------------------------------------- the event writers
def ev(events, t, text):
    events.append(dict(t=round(t, 2), text=text))


def start_events(t, m, state, events):
    if m.state == 'RUN' and not state.get('started'):
        state['started'] = True
        sentido = 'antihorario (la isla a la izquierda)' if m.selected_direction == 'ccw' else 'horario (la isla a la derecha)'
        ev(events, t, f'El primer escaneo elige el sentido: {sentido}, margen del ajuste {f2(m._direction_margin)}')


def lap_events(t, m, state, events):
    if m.state in ('RUN', 'PARK', 'STOP') and m.phi >= 8 * (state['lap'] + 1) and m.phi > 1:
        state['lap'] += 1
        ev(events, t, f'Vuelta {state["lap"]} completada (progreso {state["lap"] * 8})')


def step1(t, run, m, state, events):
    start_events(t, m, state, events)
    if m.state != 'RUN':
        return
    unit = math.floor(m.phi)
    if unit != state['phi_unit'] and unit >= 1:
        state['phi_unit'] = unit
        k = unit % 8
        what = (f'empieza la recta {NAMES[k // 2]}: 1 unidad = 1 m' if k % 2 == 0
                else f'empieza la esquina tras la recta {NAMES[(k - 1) // 2]}: 1 unidad = 0,785 m (un cuarto de círculo de 0,5 m)')
        ev(events, t, f'Progreso {unit}: {what}')


def step2(t, run, m, state, events):
    start_events(t, m, state, events)
    if m.state == 'RUN' and state['err_n'] and state['err_n'] % 160 == 0 and state.get('err_said') != state['err_n']:
        state['err_said'] = state['err_n']
        x, y = run.x, run.y
        bx, by = world_point(m, m.pose[0], m.pose[1])
        ev(events, t, f'Lo que cree el coche está a {f1(math.hypot(bx - x, by - y) * 100)} cm de la pose real (máximo hasta ahora {f1(state["err_max"] * 100)} cm)')
    lap_events(t, m, state, events)


def step3(t, run, m, state, events):
    start_events(t, m, state, events)
    for key, (lateral, votes, hits) in m.memory.seats.items():
        old = state['seats'].get(key)
        colour = max(votes, key=votes.get) if votes else None
        if hits >= 2 and (old is None or (old[0] is None and colour is not None)):
            state['seats'][key] = (colour,)
            fila = 'interior' if lateral > 0 else 'exterior'
            if old is None:
                ev(events, t, f'Memoria: una señal {COLOR[colour]} {seat_name(key / 2)}, fila {fila}' + ('' if colour else ' (el LiDAR la ve; la cámara todavía no)'))
            else:
                n = sum(votes.values())
                ev(events, t, f'Memoria: la cámara ve que la señal {seat_name(key / 2)} es {COLOR[colour]} ({n} {"voto" if n == 1 else "votos"})')
    lap_events(t, m, state, events)


def passing_events(t, run, m, state, events, with_offset=True):
    """When the car passes a sign: its side and the planned offset there."""
    if m.state != 'RUN':
        return
    for key, (lateral, votes, hits) in m.memory.seats.items():
        s = key / 2
        lap_s = s + 8 * math.floor((m.phi - s + 0.5) / 8)
        tag = (key, math.floor((m.phi + 0.5) / 8))
        if hits >= 2 and abs(m.phi - lap_s) < 0.03 and tag not in state.setdefault('passed', set()):
            state['passed'].add(tag)
            colour = max(votes, key=votes.get) if votes else None
            d = m.offset_at(m.phi)
            side = 'derecha' if d < lateral else 'izquierda'
            ev(events, t, f'Pasa la {COLOR[colour]} {seat_name(s)} por su {side}' + (f': desplazamiento {f2(d)} m (fila {f2(lateral)} m)' if with_offset else ''))


def step4(t, run, m, state, events):
    start_events(t, m, state, events)
    passing_events(t, run, m, state, events)
    lap_events(t, m, state, events)


def step5(t, run, m, state, events):
    start_events(t, m, state, events)
    if m.state == 'RUN':
        k = math.floor(m.phi)
        if k % 2 == 1 and k != state.get('corner'):
            state['corner'] = k
            mine = [(s, d) for s, d in m.profile if k - 0.2 <= s <= k + 1.2]
            if mine:
                lo, hi = min(d for _, d in mine), max(d for _, d in mine)
                ev(events, t, f'Esquina {(k + 1) // 2}: la línea va de {f2(mine[0][1])} a {f2(mine[-1][1])} m del carril (entre {f2(lo)} y {f2(hi)})')
        passing_events(t, run, m, state, events, with_offset=False)
    lap_events(t, m, state, events)


def step6(t, run, m, state, events):
    start_events(t, m, state, events)
    if m.state == 'RUN' and not math.isnan(m.pose[0]):
        from my_obstacle import follow
        px, py, heading, _ = follow.reference(m.offset_at, m.phi)
        x, y, th = m.pose
        err = -(x - px) * math.sin(heading) + (y - py) * math.cos(heading)
        state['lat_max'] = max(state.get('lat_max', 0.0), abs(err))
        k = math.floor(m.phi)
        if k != state.get('unit6'):
            if state.get('unit6') is not None and state['unit6'] >= 0:
                first = ' (incluye la salida: el coche arranca en el centro del carril y la línea empieza a un lado)' if state['unit6'] == 0 else ''
                ev(events, t, f'Tramo {state["unit6"]} → {k}: el coche se apartó como mucho {f1(state["lat_max"] * 100)} cm de la línea{first}')
            state['unit6'], state['lat_max'] = k, 0.0
    lap_events(t, m, state, events)


def step7(t, run, m, state, events):
    start_events(t, m, state, events)
    if m.state == 'RUN' and m._backup_to not in (None, -math.inf) and not state['backup'] and m.speed < 0:
        state['backup'] = True
        ev(events, t, 'Salida: la primera señal está demasiado cerca para cambiar de lado; retrocede en recta')
    if m._peek is not None and state['peek'] != m._peek[0]:
        state['peek'] = m._peek[0]
        ev(events, t, f'Mirar: la señal {seat_name(m._peek[0] / 2)} no tiene color; para, retrocede girando para que la cámara la vea')
    lap_events(t, m, state, events)
    if m.state == 'STOP' and not state.get('stopped'):
        state['stopped'] = True
        ev(events, t, f'STOP: tres vueltas y parado en la sección de salida ({f1(t)} s)')


def step8(t, run, m, state, events):
    start_events(t, m, state, events)
    lap_events(t, m, state, events)
    p = m.parking
    if p is None:
        return
    if p.state != state['parking']:
        texts = {'PARK_APPROACH': 'Aparcar: se acerca por la línea a 4 cm del aparcamiento',
                 'PARK_BACK': 'Se pasó al alinearse: vuelve en recta a la pose de planificar',
                 'PARK_PLAN': 'Quieto: planifica las maniobras con A*',
                 'PARKED': 'Aparcado del todo y en paralelo'}
        if p.state in texts:
            ev(events, t, texts[p.state])
        if p.state == 'PARK_STEER' and state['parking'] == 'PARK_PLAN':
            ev(events, t, f'Plan: {len(p.moves) + 1} maniobras')
        state['parking'] = p.state
    if p.state == 'PARK_MOVE' and p.current is not None and p.current is not state.get('move'):
        state['move'] = p.current
        state['moves'] += 1
        steer, direction, length = p.current[:3]
        giro = 'recto' if abs(steer) < 1e-6 else ('a la izquierda' if steer > 0 else 'a la derecha') + (' a fondo' if abs(abs(steer) - 0.307) < 0.01 else ' a medias')
        ev(events, t, f'Maniobra {state["moves"]}: {"adelante" if direction > 0 else "atrás"}, {giro}, {f1(length * 100)} cm')


def step9(t, run, m, state, events):
    start_events(t, m, state, events)
    lap_events(t, m, state, events)
    if m.state == 'STOP' and not state.get('stopped'):
        state['stopped'] = True
        ev(events, t, f'Fin: 24 secciones + 3 vueltas + parada + señales sin mover = 40 puntos, en {f1(t)} s')


STEPS = {
    1: lambda: record(1, '4-0', 'ccw', 1, False, 'El carril y el progreso',
                      'Laboratorio del Obstacle (la copia de la web), campo 4, antihorario: una vuelta de la estrategia del curso. '
                      'Los eventos marcan cada unidad de progreso: 1 por recta y 1 por esquina, 8 por vuelta ({time} s).', step1),
    2: lambda: record(2, '3-0', 'cw', 1, False, 'Ubicarse con los muros',
                      'Campo 3, horario: el sentido sale del primer escaneo. En azul, la pose que cree el coche (predecir con '
                      'distancia y giroscopio, corregir con los muros); en ámbar, la real. Una vuelta ({time} s).', step2, belief=True),
    3: lambda: record(3, '4-0', 'ccw', 1, False, 'Ver las señales y recordarlas',
                      'Campo 4, antihorario: cada señal que el LiDAR ve dos veces entra en la memoria por asiento; la cámara le pone '
                      'color. Una vuelta ({time} s).', step3),
    4: lambda: record(4, '4-0', 'ccw', 1, False, 'La línea: un lado por señal',
                      'Campo 4, antihorario: la línea pasa cada roja por su derecha y cada verde por su izquierda, con 0,254 m entre '
                      'la fila de la señal y el centro del coche. Una vuelta ({time} s).', step4),
    5: lambda: record(5, '4-0', 'ccw', 1, False, 'Las esquinas: recta, arco, recta',
                      'Campo 4, antihorario: en cada esquina la línea es la que corner.plan eligió para las señales de los dos '
                      'extremos. Una vuelta ({time} s).', step5),
    6: lambda: record(6, '4-0', 'ccw', 1, False, 'Seguir la línea',
                      'Campo 4, antihorario: el volante anticipa la curvatura y corrige contra el punto de la línea que tiene al lado. '
                      'Los eventos dicen cuánto se apartó en cada tramo. Una vuelta ({time} s).', step6),
    7: lambda: record(7, '4-0', 'ccw', 3, False, 'La misión: salir, mirar, tres vueltas',
                      'Campo 4, antihorario: la ronda del reglamento, tres vueltas y parada en la salida: 40 puntos en el laboratorio '
                      'del curso; en Gazebo, 40 en 115,6 s ({time} s aquí).', step7),
    8: lambda: record(8, '0-1', 'ccw', 1, True, 'Aparcar en paralelo',
                      'Campo 0 con el aparcamiento, antihorario: una vuelta (la ronda son tres) y a aparcar: acercarse, planificar '
                      'con A* y maniobrar despacio ({time} s).', step8),
    9: lambda: record(9, '3-0', 'cw', 3, False, 'Puntuar y medir: una ronda en horario',
                      'Campo 3, horario: tres vueltas y parada, 40 puntos en el laboratorio del curso ({time} s).', step9),
}

if __name__ == '__main__':
    for n in [int(a) for a in sys.argv[1:]] or sorted(STEPS):
        STEPS[n]()
