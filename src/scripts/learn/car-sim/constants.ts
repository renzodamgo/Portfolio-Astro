// Car (robotek_common/vehicle.py and the URDF), metres / radians. Sim frame: x forward, y left, z up.
export const WHEELBASE = 0.1174;
export const REAR_AXLE_X = -0.0587; // from base_link
export const OUTLINE_FRONT = 0.1477;
export const OUTLINE_REAR = 0.0852;
export const OUTLINE_HALF_WIDTH = 0.074;
export const FRONT_TRACK = 0.1335;
export const REAR_TRACK = 0.1235;
export const WHEEL_RADIUS = 0.0305;
export const WHEEL_WIDTH = 0.0145;
export const STEER_LIMITS = { real: 0.30718, rule: 0.4363323129985824 }; // 17.6 deg / 25 deg
export const STEER_RATE = 1.22; // rad/s, servo ~70 deg/s (real_car_v1 model)
export const MAX_SPEED = 1.28;
/** Top speed in challenge mode: what the simulated real car reaches (so 3 laps against the course code is a fair comparison). */
export const CHALLENGE_MAX_SPEED = 0.6;
export const ACCEL = 2.0;
export const BRAKE = 4.0;
export const DRAG = 0.8; // m/s, m/s^2

// Field (square100): [centre x, centre y, size x, size y]
export type Wall = readonly [number, number, number, number];
export const WALLS: readonly Wall[] = [
  [1.52, 0, 0.04, 3.08], [-1.52, 0, 0.04, 3.08], [0, 1.52, 3.08, 0.04], [0, -1.52, 3.08, 0.04], // outer
  [0.48, 0, 0.04, 1.0], [-0.48, 0, 0.04, 1.0], [0, 0.48, 1.0, 0.04], [0, -0.48, 1.0, 0.04], // island
];
export const START = { x: 0, y: -1.15, yaw: 0 };

/** Traffic signs of the Obstacle race (50 x 50 x 100 mm): regulation layout 4 of the Obstacle guide
 * (WRO-Strategies obstacle_experiment_setup.regulation_signs(4)), the field where the course strategy
 * scored 40 points in Gazebo. `side` is the straight the sign stands on. */
export interface Pillar { x: number; y: number; color: 'red' | 'green'; side: 'bottom' | 'right' | 'top' | 'left' }
export const PILLAR_SIZE = 0.05;
export const OBSTACLE_PILLARS: readonly Pillar[] = [
  { x: -1.1, y: 0.0, color: 'red', side: 'left' }, { x: 0.0, y: 0.9, color: 'red', side: 'top' },
  { x: 1.1, y: -0.5, color: 'green', side: 'right' }, { x: 1.1, y: 0.5, color: 'red', side: 'right' },
  { x: -0.5, y: -0.9, color: 'red', side: 'bottom' }, { x: 0.5, y: -0.9, color: 'green', side: 'bottom' },
];

// LiDAR (LD19 as simulated with real_car:=true): 306 samples over +-110 deg, 0.03 to 12 m,
// scan plane 0.030 m high and 0.128 m ahead of base_link (lidar_joint).
export const LIDAR = { x: 0.128, z: 0.03, samples: 306, halfAngle: 1.91986, min: 0.03, max: 12.0 };

// The car camera (camera_link with real_car:=true): 640 x 480, horizontal FOV 1.164 rad,
// xyz (0.0565, 0, 0.1446), rpy (0, 0.17, 0.077).
export const CAMERA = { aspect: 4 / 3, hfov: 1.164, pitch: 0.17, yaw: 0.077, x: 0.0565, z: 0.1446 };
