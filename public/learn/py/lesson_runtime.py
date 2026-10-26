"""Runs the student's my_open/drive.py in the mini simulator of the course, for the 3D view of the interactive lessons.

The physics is the course's own: ``MiniCar`` (bicycle model, real servo, speed table) and ``Field`` (LiDAR and contacts),
with the lesson's walls and rocks. The browser only draws the pose this returns. The strategy gets what the real car
has: the gyroscope, the LiDAR scan (10 per second) and, in the step 8 lesson, the two line lengths of the camera.
"""
import importlib
import math
import random
import sys
import traceback

from robotek_course.minisim import Field, MiniCar, real_speed


class Sensors:
    """What ``drive(s)`` receives every tick: ``s.time``, ``s.dt``, ``s.gyro``, ``s.scan``, ``s.camera`` and ``s.moved``.

    ``s.moved`` is the distance driven in the last tick, estimated from the speed command with the car's speed table
    (the car has no wheel encoder): what the strategy uses to count metres since a corner.
    """

    def __init__(self):
        self.time = 0.0
        self.dt = 0.02
        self.gyro = 0.0
        self.scan = None        # a NEW object for every LiDAR scan (sensor_msgs/LaserScan fields)
        self.camera = (0.0, 0.0)  # (blue, orange) line lengths in pixels
        self.moved = 0.0


def _camera_frame(rng, direction, time):
    """Synthetic camera for the step 8 lesson: the longer line names the lap direction, with noisy and empty frames."""
    if direction is None:
        return 0.0, 0.0
    long, short = 260.0 + rng.gauss(0, 25), 70.0 + rng.gauss(0, 20)
    if rng.random() < 0.25:                 # a blurry frame: both alike
        long = short = 120.0 + rng.gauss(0, 10)
    blue, orange = (long, short) if direction == 'ccw' else (short, long)
    return max(0.0, blue), max(0.0, orange)


class Run:
    def __init__(self, world):
        walls = [tuple(w) for w in world['walls']] + [tuple(r) for r in world.get('rocks', [])]
        seed = int(world.get('seed', 0))
        self.field = Field(walls, seed=seed)
        x, y, yaw = world['start']
        self.car = MiniCar(x, y, yaw, realistic=world.get('realistic', True), seed=seed)
        self.car.steer = float(world.get('steer0', 0.0))
        self.car.speed = float(world.get('speed0', 0.0))
        if 'bias' in world:
            self.car._bias = float(world['bias'])
        self.dt = 0.02
        self.scan_period = 0.1
        self.camera = world.get('camera')
        self.rng = random.Random(seed + 7)
        self.s = Sensors()
        self.next_scan = 0.0
        self.crashed = False
        self.error = ''
        self.status = ''
        self.command = (0.0, 0.0)
        for name in [m for m in sys.modules if m == 'my_open' or m.startswith('my_open.')]:
            del sys.modules[name]                       # fresh modules: the student's latest code, globals reset
        importlib.invalidate_caches()
        try:
            self.module = importlib.import_module('my_open.drive')
            if not callable(getattr(self.module, 'drive', None)):
                raise AttributeError('my_open/drive.py no tiene la función drive(s)')
            if callable(getattr(self.module, 'start', None)):
                self.module.start()
        except Exception:                               # noqa: BLE001 - shown to the student as is
            self.error = traceback.format_exc(limit=4)

    def advance(self, seconds):
        """Simulate ``seconds`` (in 0.02 s ticks). Returns [x, y, yaw, steer, speed, time, crashed, error, status,
        samples], ``samples`` being [x, y, yaw, speed, time] after every tick (for the judge)."""
        steps = max(0, round(seconds / self.dt))
        c = self.car
        samples = []
        for _ in range(steps):
            if self.crashed or self.error:
                break
            self._tick()
            samples.append([c.x, c.y, c.yaw, c.speed, c.time])
        return [c.x, c.y, c.yaw, c.steer, c.speed, c.time, self.crashed, self.error, self.status, samples]

    def _tick(self):
        c, s = self.car, self.s
        s.time, s.dt, s.gyro = c.time, self.dt, c.gyro()
        if c.time + 1e-9 >= self.next_scan:
            s.scan = self.field.scan(c.x, c.y, c.yaw)
            self.next_scan += self.scan_period
        s.camera = _camera_frame(self.rng, self.camera, c.time)
        s.moved = real_speed(self.command[0]) * self.dt if c.realistic else abs(self.command[0]) * self.dt
        try:
            out = self.module.drive(s)
            speed, steer = (float(v) for v in out)
            if not (math.isfinite(speed) and math.isfinite(steer)):
                raise ValueError(f'drive(s) devolvió {out!r}: deben ser dos números finitos')
        except Exception:                               # noqa: BLE001
            self.error = traceback.format_exc(limit=4)
            return
        self.command = (speed, steer)
        self.status = str(getattr(self.module, 'status', '') or '')
        c.step(speed, steer, self.dt)
        if self.field.touches(c.x, c.y, c.yaw):
            self.crashed = True
