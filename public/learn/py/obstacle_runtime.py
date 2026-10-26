"""Runs the student's Obstacle strategy (my_obstacle.strategy:Strategy) in the field of the rules, for the 3D view of
the interactive lessons. A light copy of the course's Obstacle lab (robotek_evaluation.obstacle_lab):

* the field: outer walls, island, the signs (5 x 5 cm) and, with parking, the lot limits, as boxes;
* the real car's actuators (open_lab.Actuators with the values of real_car_v1.yaml): servo with dead time, rate and
  lag; motor with slew, dead time, speed table and lag;
* the LD19 scan (10 Hz, 306 rays over +-110 deg, 8 mm noise, 4.3 % dropouts), a 50 Hz gyroscope with bias and
  noise, and a 6 fps camera that reports the signs in its view (2 m at most) as dict(x, y, color) in the car frame.

Any contact ends the attempt. Not modelled: wheel slip, camera images, occlusion. The browser draws the pose.
"""
import importlib
import inspect
import math
import sys
import traceback
from types import SimpleNamespace

import numpy as np

from robotek_common import vehicle

ACTUATORS = {"wheelbase": 0.13, "steer_limit": 0.30718, "steer_delay": 0.1, "steer_rate": 1.2, "steer_tau": 0.06,
             "accel_max": 1.0, "decel_max": 0.6, "drive_delay": 0.06, "drive_tau": 0.15, "drive_command_limit": 1.28,
             "drive_deadband": 0.005, "speed_table_cmd": [0.15, 0.3, 0.4, 0.6, 1.28],
             "speed_table_real": [0.18, 0.27, 0.3, 0.42, 0.6]}
PHYSICS_HZ = 100.0
DT = 1.0 / PHYSICS_HZ
RAYS = 306
HALF_ANGLE = math.radians(110.0)
SCAN_MIN, SCAN_MAX = 0.12, 4.0
SCAN_NOISE, SCAN_DROPOUT = 0.008, 0.043
GYRO_NOISE, GYRO_BIAS = 0.0019, 0.006
CAMERA_PERIOD, CAMERA_RANGE, CAMERA_NOISE = 1.0 / 6.0, 2.0, 0.01
WALL = 0.02
LOT = dict(x0=0.48 - 1.5 * vehicle.LENGTH, x1=0.48, y0=-1.5, y1=-1.3)   # obstacle_field.PARKING_LOT


def _slew(current, target, accel, decel, dt):
    limit = (accel if abs(target) > abs(current) else decel) * dt
    return current + max(-limit, min(limit, target - current))


def _table_speed(v, cmd, real):
    x, sign = abs(v), math.copysign(1.0, v)
    points = [(0.0, 0.0)] + list(zip(cmd, real))
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if x <= x1:
            return sign * (y0 + (y1 - y0) * (x - x0) / (x1 - x0))
    (x0, y0), (x1, y1) = points[-2], points[-1]
    return sign * (y1 + (y1 - y0) * (x - x1) / (x1 - x0))


class Actuators:
    """open_lab.Actuators: speed and steering commands in, real speed and yaw rate out."""

    def __init__(self, p=ACTUATORS):
        self.p = p
        self.table = (p['speed_table_cmd'], p['speed_table_real'])
        self.v_cmd = self.steer_cmd = self.v = self.steer = self.v_out = self.target = self.delayed_v = 0.0
        self.steer_queue, self.drive_queue = [], []

    def command(self, now, speed, steer):
        self.v_cmd = speed
        if abs(speed) > 1e-3:
            wz = speed * math.tan(steer) / vehicle.WHEELBASE
            self.steer_cmd = math.atan(wz * self.p['wheelbase'] / speed)
        self.steer_queue.append((now, self.steer_cmd))

    def step(self, now, dt):
        p = self.p
        target = None
        while self.steer_queue and now - self.steer_queue[0][0] >= p['steer_delay']:
            target = self.steer_queue.pop(0)[1]
        if target is not None:
            self.target = max(-p['steer_limit'], min(p['steer_limit'], target))
        change = (self.target - self.steer) * min(1.0, dt / p['steer_tau'])
        limit = p['steer_rate'] * dt
        self.steer += max(-limit, min(limit, change))
        self.v = _slew(self.v, self.v_cmd, p['accel_max'], p['decel_max'], dt)
        self.drive_queue.append((now, self.v))
        v = None
        while self.drive_queue and now - self.drive_queue[0][0] >= p['drive_delay']:
            v = self.drive_queue.pop(0)[1]
        self.delayed_v = self.delayed_v if v is None else v
        v = max(-p['drive_command_limit'], min(p['drive_command_limit'], self.delayed_v))
        if abs(v) < p['drive_deadband']:
            v = 0.0
        v = _table_speed(v, *self.table)
        self.v_out += (v - self.v_out) * min(1.0, dt / p['drive_tau'])
        return self.v_out, self.v_out * math.tan(self.steer) / p['wheelbase']


def field_boxes(signs, lot):
    """(xmin, xmax, ymin, ymax, kind) of the walls, the island, the signs and the lot limits."""
    boxes = [(-1.5 - WALL, 1.5 + WALL, -1.5 - WALL, -1.5, 'outer'), (-1.5 - WALL, 1.5 + WALL, 1.5, 1.5 + WALL, 'outer'),
             (-1.5 - WALL, -1.5, -1.5, 1.5, 'outer'), (1.5, 1.5 + WALL, -1.5, 1.5, 'outer'),
             (-0.5, 0.5, -0.5, 0.5, 'island')]
    boxes += [(s['x'] - 0.025, s['x'] + 0.025, s['y'] - 0.025, s['y'] + 0.025, 'sign') for s in signs]
    if lot:
        boxes += [(lot['x0'] - 0.02, lot['x0'], lot['y0'], lot['y1'], 'lot'), (lot['x1'], lot['x1'] + 0.02, lot['y0'], lot['y1'], 'lot')]
    return boxes


class SideWatch:
    """obstacle_lab.SideWatch: a clear wrong-side pass (red must stay on the car's right... of the sign: the car
    passes red signs on their right, green ones on their left)."""

    TANGENTS = {'bottom': (1, 0), 'right': (0, 1), 'top': (-1, 0), 'left': (0, -1)}

    def __init__(self, signs, direction):
        sign = 1 if direction == 'ccw' else -1
        self.signs = [(p, self.TANGENTS[p['side']][0] * sign, self.TANGENTS[p['side']][1] * sign) for p in signs]
        self.before = [False] * len(signs)

    def wrong(self, x, y):
        for k, (p, tx, ty) in enumerate(self.signs):
            horizontal = p['side'] in ('bottom', 'top')
            near = (abs(x - p['x']) < .6 and y * math.copysign(1, p['y']) >= .45) if horizontal else \
                (abs(y - p['y']) < .6 and x * math.copysign(1, p['x']) >= .45)
            if not near:
                continue
            along = tx * (x - p['x']) + ty * (y - p['y'])
            if along < 0:
                self.before[k] = True
            elif self.before[k]:
                self.before[k] = False
                lateral = -ty * (x - p['x']) + tx * (y - p['y'])
                if (lateral > 0) == (p['color'] == 'red'):
                    return p
        return None


def _outline(x, y, yaw):
    c, s = math.cos(yaw), math.sin(yaw)
    corners = [(vehicle.OUTLINE_FRONT, -vehicle.OUTLINE_HALF_WIDTH), (vehicle.OUTLINE_FRONT, vehicle.OUTLINE_HALF_WIDTH),
               (-vehicle.OUTLINE_REAR, vehicle.OUTLINE_HALF_WIDTH), (-vehicle.OUTLINE_REAR, -vehicle.OUTLINE_HALF_WIDTH)]
    return [(x + px * c - py * s, y + px * s + py * c) for px, py in corners]


def _touches(poly, box):
    """Separating axes between the car outline and an axis-aligned box."""
    xmin, xmax, ymin, ymax = box[:4]
    rect = [(xmin, ymin), (xmax, ymin), (xmax, ymax), (xmin, ymax)]
    (ax, ay), (bx, by), (cx, cy) = poly[0], poly[1], poly[2]
    for nx, ny in ((1.0, 0.0), (0.0, 1.0), (ay - by, bx - ax), (by - cy, cx - bx)):
        pa = [px * nx + py * ny for px, py in poly]
        pb = [px * nx + py * ny for px, py in rect]
        if max(pa) < min(pb) or max(pb) < min(pa):
            return False
    return True


class Run:
    def __init__(self, world):
        self.direction = world.get('direction', 'ccw')
        self.parking = bool(world.get('parking', False))
        self.signs = [dict(s) for s in world.get('signs', [])]
        lot = dict(LOT) if self.parking else None     # the same place in both directions (obstacle_field.PARKING_LOT)
        self.boxes = field_boxes(self.signs, lot)
        self.arr = np.array([b[:4] for b in self.boxes])
        self.rng = np.random.default_rng(int(world.get('seed', 0)))
        x, y, yaw = world.get('start') or ((-0.25, -1.0, 0.0) if self.direction == 'ccw' else (0.25, -1.0, math.pi))
        back = -vehicle.REAR_AXLE_X
        self.x, self.y, self.yaw = x, y, yaw
        self.xr, self.yr = x - back * math.cos(yaw), y - back * math.sin(yaw)
        self.back = back
        self.act = Actuators()
        self.bias = GYRO_BIAS + self.rng.normal(0.0, 0.0005)
        self.yaw_rate = 0.0
        self.tick = 0
        self.camera_time = self.scan_time = None
        self.sides = SideWatch(self.signs, self.direction)
        self.crashed = ''
        self.wrong = ''
        self.error = ''
        self.status = ''
        self.parked = False
        self.done = False
        self.increment = 2 * HALF_ANGLE / (RAYS - 1)
        self.beams = -HALF_ANGLE + self.increment * np.arange(RAYS)
        for name in [m for m in sys.modules if m == 'my_obstacle' or m.startswith('my_obstacle.')]:
            del sys.modules[name]
        importlib.invalidate_caches()
        try:
            drive = None
            try:
                drive = importlib.import_module('my_obstacle.drive')
            except ModuleNotFoundError as e:
                if e.name != 'my_obstacle.drive':
                    raise
            if drive is not None and callable(getattr(drive, 'make_strategy', None)):
                self.strategy = drive.make_strategy(self.parking)
            else:
                cls = importlib.import_module('my_obstacle.strategy').Strategy
                kwargs = {'parking': self.parking} if 'parking' in inspect.signature(cls).parameters else {}
                self.strategy = cls(**kwargs)
        except Exception:                                   # noqa: BLE001 - shown to the student as is
            self.error = traceback.format_exc(limit=4)

    # ----------------------------------------------------------------- sensors
    def _scan(self, now):
        ox, oy = self.x + vehicle.LIDAR_OFFSET_X * math.cos(self.yaw), self.y + vehicle.LIDAR_OFFSET_X * math.sin(self.yaw)
        angles = self.beams + self.yaw
        dx, dy = np.cos(angles), np.sin(angles)
        best = np.full(RAYS, np.inf)
        with np.errstate(divide='ignore', invalid='ignore'):
            for xmin, xmax, ymin, ymax in self.arr:
                tx = np.stack([(xmin - ox) / dx, (xmax - ox) / dx])
                ty = np.stack([(ymin - oy) / dy, (ymax - oy) / dy])
                near = np.maximum(tx.min(axis=0), ty.min(axis=0))
                far = np.minimum(tx.max(axis=0), ty.max(axis=0))
                best = np.minimum(best, np.where((far >= near) & (near > 1e-6), near, np.inf))
        best = best + self.rng.normal(0.0, SCAN_NOISE, RAYS)
        best[(best < SCAN_MIN) | (best > SCAN_MAX) | ~np.isfinite(best)] = np.inf
        best[self.rng.random(RAYS) < SCAN_DROPOUT] = np.inf
        sec = int(now)
        return SimpleNamespace(ranges=list(best), angle_min=-HALF_ANGLE, angle_increment=self.increment,
                               range_min=SCAN_MIN, range_max=SCAN_MAX,
                               header=SimpleNamespace(stamp=SimpleNamespace(sec=sec, nanosec=int(round((now - sec) * 1e9)))))

    def _camera(self):
        out = []
        c, s = math.cos(self.yaw), math.sin(self.yaw)
        for p in self.signs:
            dx, dy = p['x'] - self.x, p['y'] - self.y
            bx, by = c * dx + s * dy, -s * dx + c * dy
            distance = math.hypot(bx - vehicle.CAMERA_OFFSET_X, by)
            bearing = math.atan2(by, bx - vehicle.CAMERA_OFFSET_X)
            if SCAN_MIN < distance < CAMERA_RANGE and abs(bearing - vehicle.REAL_CAMERA_YAW) <= vehicle.REAL_CAMERA_HFOV / 2:
                out.append(dict(x=bx + self.rng.normal(0, CAMERA_NOISE), y=by + self.rng.normal(0, CAMERA_NOISE), color=p['color']))
        return out

    # ----------------------------------------------------------------- loop
    def advance(self, seconds):
        """Simulate ``seconds``. Returns [x, y, yaw, steer, speed, time, crashed, error, status, samples, wrong, parked,
        done], ``samples`` being [x, y, yaw, speed, time] every 0.04 s (for the judge)."""
        samples = []
        for _ in range(max(0, round(seconds / DT))):
            if self.crashed or self.error or self.wrong:
                break
            try:
                self._step()
            except Exception:                               # noqa: BLE001
                self.error = traceback.format_exc(limit=4)
            if self.tick % 4 == 0:
                samples.append([self.x, self.y, self.yaw, self.act.v_out, self.tick * DT])
        now = self.tick * DT
        return [self.x, self.y, self.yaw, self.act.steer, self.act.v_out, now, self.crashed, self.error, self.status,
                samples, self.wrong, self.parked, self.done]

    def _step(self):
        tick, now, st = self.tick, self.tick * DT, self.strategy
        if tick % 10 == 0:
            st.on_scan(self._scan(now))
            self.scan_time = now
        if tick % 2 == 0:
            st.on_imu(now, self.yaw_rate + self.bias + self.rng.normal(0.0, GYRO_NOISE))
            if (self.camera_time is None or now - self.camera_time >= CAMERA_PERIOD - 1e-9) and \
                    self.scan_time is not None and now - self.scan_time <= 0.15:
                self.camera_time = now
                st.on_signs(self._camera(), now)
            speed, steer = st.control(now, 2 * DT)
            self.act.command(now, float(speed), float(steer))
            self.status = str(getattr(st, 'label', '') or '')
            self.parked = bool(getattr(st, 'parked', False))
            self.done = bool(getattr(st, 'done', False))
        v, self.yaw_rate = self.act.step(now, DT)
        self.yaw += self.yaw_rate * DT
        self.xr += v * math.cos(self.yaw) * DT
        self.yr += v * math.sin(self.yaw) * DT
        self.x, self.y = self.xr + self.back * math.cos(self.yaw), self.yr + self.back * math.sin(self.yaw)
        self.tick += 1
        if tick % 2 == 0:
            poly = _outline(self.x, self.y, self.yaw)
            for box in self.boxes:
                if _touches(poly, box):
                    self.crashed = {'outer': 'el muro de fuera', 'island': 'la isla', 'sign': 'una señal',
                                    'lot': 'el aparcamiento'}[box[4]]
                    return
            if tick % 10 == 0:
                p = self.sides.wrong(self.x, self.y)
                if p is not None:
                    self.wrong = 'roja' if p['color'] == 'red' else 'verde'
