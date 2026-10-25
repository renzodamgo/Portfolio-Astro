// The heavy part of the replay player (three.js). Loaded lazily by widgets/step-replay.ts once the file is read.
// Builds the same scene as ../car-sim/engine.ts (STL car, game mat, walls, 306-ray LiDAR fan) but driven by a
// recorded trajectory instead of the physics. engine.ts is tied to the CarSim markup and the physics, so the
// parts that were needed are repeated here; the measures come from ../car-sim/constants.
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { FRONT_TRACK, LIDAR, REAR_AXLE_X, REAR_TRACK, WHEELBASE, WHEEL_RADIUS, WHEEL_WIDTH } from '../car-sim/constants';
import { fieldSpec } from './fields';
import { currentTheme, onThemeChange, scenePalette, sceneBackground, trackColor, type Theme } from '../theme-colors';
import { frameIndex, latestAt, samplePose, type Replay, type Scan, type Track, type TrackPose } from './format';

export type CameraMode = 'top' | 'follow';
export interface FrameOptions { lidar: boolean; measures: boolean; mode: CameraMode; dt: number; snap: boolean }
export interface ReplayScene {
  resize(width: number, height: number): void;
  /** Draws the replay at `time` seconds. Returns true when the camera has settled (nothing else will move). */
  frame(time: number, options: FrameOptions): boolean;
  dispose(): void;
}

const MESHES: [string, string][] = [
  ['base_plate', 'purple'], ['case', 'purple'], ['camera_support', 'purple'], ['camera', 'black'],
  ['servo', 'black'], ['raspberry_pi', 'pcb'], ['driver_board', 'pcb'],
];
// Mat sections [centre x, centre y, size x, size y]; same layout as rule_judge.mat_section (corridors are 1 m wide).
const SECTION_RECTS: readonly (readonly [number, number, number, number])[] = [
  [0, -1, 1, 1], [1, -1, 1, 1], [1, 0, 1, 1], [1, 1, 1, 1], [0, 1, 1, 1], [-1, 1, 1, 1], [-1, 0, 1, 1], [-1, -1, 1, 1],
];

export async function createReplayScene(opts: { canvas: HTMLCanvasElement; replay: Replay; assetBase: string }): Promise<ReplayScene> {
  const renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  try {
    return await buildScene(renderer, opts.replay, opts.assetBase);
  } catch (error) {
    renderer.dispose(); // do not leak the context when something fails after it was created
    renderer.forceContextLoss();
    throw error;
  }
}

async function buildScene(renderer: THREE.WebGLRenderer, replay: Replay, assetBase: string): Promise<ReplayScene> {
  const spec = fieldSpec(replay.field, replay.tracks);
  const bounds = spec.bounds;
  const centre = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  const boundsW = bounds.maxX - bounds.minX, boundsH = bounds.maxY - bounds.minY;

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const initialTheme = currentTheme();
  let colors = scenePalette(initialTheme);
  scene.background = new THREE.Color(sceneBackground(initialTheme));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6558, 1.5));
  const sun = new THREE.DirectionalLight(0xfff3df, 2.2);
  sun.position.set(centre.x - 1.5, 3, -centre.y + 1.5);
  sun.target.position.set(centre.x, 0, -centre.y);
  scene.add(sun.target);
  sun.castShadow = true;
  const half = Math.max(boundsW, boundsH) / 2 + 0.3;
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 0.5, far: 14 });
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);

  // ---- Assets (loaded together; a missing file is a warning, not a failure) ----
  const stl = new STLLoader();
  const geometries = await Promise.all(MESHES.map(([file]) => new Promise<THREE.BufferGeometry | null>((resolve) => {
    stl.load(`${assetBase}meshes/${file}.stl`, resolve, undefined, () => {
      console.warn(`[step-replay] ${file}.stl not found`);
      resolve(null);
    });
  })));
  let matTexture: THREE.Texture | null = null;
  let gridTexture: THREE.CanvasTexture | null = null;
  if (spec.floor.mat) {
    matTexture = await new Promise<THREE.Texture | null>((resolve) => {
      new THREE.TextureLoader().load(`${assetBase}mat.png`, resolve, undefined, () => {
        console.warn('[step-replay] mat.png not found');
        resolve(null);
      });
    });
    if (matTexture) {
      matTexture.colorSpace = THREE.SRGBColorSpace;
      matTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
  } else {
    // Plain floor with a 0.5 m grid so distances can be read.
    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    const g = tile.getContext('2d')!;
    g.fillStyle = '#d9d6cc'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#b8b3a3'; g.lineWidth = 4; g.strokeRect(0, 0, 128, 128);
    gridTexture = new THREE.CanvasTexture(tile);
    gridTexture.colorSpace = THREE.SRGBColorSpace;
    gridTexture.wrapS = gridTexture.wrapT = THREE.RepeatWrapping;
    gridTexture.repeat.set(spec.floor.width / 0.5, spec.floor.height / 0.5);
    gridTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  // ---- Floor, ground, walls ----
  const floorMaterial = new THREE.MeshStandardMaterial({ color: matTexture ? 0xffffff : 0xd9d6cc, roughness: 1, map: matTexture ?? gridTexture });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(spec.floor.width, spec.floor.height), floorMaterial);
  floor.rotation.x = -Math.PI / 2; // image right = +x, image top = +y (the orientation Gazebo shows)
  floor.position.set(spec.floor.cx, 0, -spec.floor.cy);
  floor.receiveShadow = true;
  scene.add(floor);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: sceneBackground(initialTheme) })); // unlit, the colour of the background
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  scene.add(ground);
  const wallMeshes: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>[] = [];
  for (const [cx, cy, sx, sy] of spec.walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.1, sy), new THREE.MeshStandardMaterial({ color: colors.wall, roughness: 0.7 }));
    wall.position.set(cx, 0.06, -cy);
    wall.castShadow = wall.receiveShadow = true;
    scene.add(wall);
    wallMeshes.push(wall);
  }

  // Mat sections, tinted as the main car drives out of them (the points the rules would give).
  const sectionMaterials: THREE.MeshBasicMaterial[] = [];
  if (replay.sections) {
    for (const [cx, cy, sx, sy] of SECTION_RECTS) {
      const material = new THREE.MeshBasicMaterial({ color: colors.section, transparent: true, opacity: 0, depthWrite: false });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy), material);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(cx, 0.0025, -cy);
      scene.add(plane);
      sectionMaterials.push(material);
    }
  }
  const sectionShown = new Int8Array(8).fill(-1);
  // Things drawn in a track colour (rings, trails, ghost fans): redrawn when the theme changes.
  const themedTracks: ((theme: Theme) => void)[] = [];

  // ---- The car (robotek.urdf.xacro): `car` at base_link (y up, z = -sim y); `urdf` rotated so +x is forward, +z up ----
  const baseMaterials: Record<string, THREE.MeshStandardMaterial> = {};
  const std = (r: number, g: number, b: number, roughness = 0.55, metalness = 0.05) =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(r, g, b), roughness, metalness });
  const palette: Record<string, () => THREE.MeshStandardMaterial> = {
    purple: () => std(0.4, 0.17, 0.7), black: () => std(0.05, 0.05, 0.05, 0.5), pcb: () => std(0.04, 0.32, 0.2, 0.45),
    navy: () => std(0.07, 0.07, 0.2), lilac: () => std(0.72, 0.65, 0.93, 0.9, 0), olive: () => std(0.3, 0.35, 0.2, 0.8, 0),
    silver: () => std(0.7, 0.7, 0.7, 0.3, 0.6),
  };
  const ownedMaterials: THREE.Material[] = [];
  const ownedGeometries: THREE.BufferGeometry[] = [];

  interface CarModel { root: THREE.Group; wheels: { pivot: THREE.Group; wheel: THREE.Group; steered: boolean }[] }
  function buildCar(color: string, ghost: boolean): CarModel {
    const tint = new THREE.Color(ghost ? color : trackColor(color));
    const material = (name: string) => {
      if (!ghost) return (baseMaterials[name] ??= palette[name]());
      const m = palette[name]();
      m.color.lerp(tint, 0.55);
      m.transparent = true; m.opacity = 0.4; m.depthWrite = false;
      ownedMaterials.push(m);
      return m;
    };
    const root = new THREE.Group();
    const urdf = new THREE.Group();
    urdf.rotation.x = -Math.PI / 2;
    root.add(urdf);
    const add = (mesh: THREE.Object3D) => { mesh.traverse((o) => { o.castShadow = !ghost; }); urdf.add(mesh); };

    MESHES.forEach(([, name], i) => {
      const geometry = geometries[i];
      if (!geometry) return;
      const mesh = new THREE.Mesh(geometry, material(name));
      mesh.scale.setScalar(0.001); // STL in millimetres, Y up, front towards -X
      mesh.position.set(0.02495, 0, 0.0379);
      mesh.rotation.set(Math.PI / 2, 0, Math.PI, 'ZYX');
      add(mesh);
    });
    const lidarBody = new THREE.Mesh(new THREE.BoxGeometry(0.0386, 0.0386, 0.0146), material('navy'));
    lidarBody.position.set(0.12835, 0, 0.0233);
    const lidarHead = new THREE.Mesh(new THREE.CylinderGeometry(0.0187, 0.0187, 0.0202, 32), material('black'));
    lidarHead.rotation.x = Math.PI / 2;
    lidarHead.position.set(0.12835, 0, 0.0407);
    const imu = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.005), material('silver'));
    imu.position.set(0, 0, 0.061);
    for (const part of [lidarBody, lidarHead, imu]) { ownedGeometries.push(part.geometry); add(part); }

    const wheels: CarModel['wheels'] = [];
    const makeWheel = (x: number, y: number, steered: boolean) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, WHEEL_RADIUS);
      const wheel = new THREE.Group();
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 40), material('lilac'));
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS - 0.0045, WHEEL_RADIUS - 0.0045, WHEEL_WIDTH + 0.0006, 40), material('olive'));
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.004, WHEEL_WIDTH + 0.0012, 0.018), material('black'));
      mark.position.z = 0.012;
      for (const part of [tyre, hub, mark]) { ownedGeometries.push(part.geometry); wheel.add(part); }
      pivot.add(wheel);
      if (steered) {
        const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, WHEEL_RADIUS * 2, 16), material('silver'));
        knuckle.rotation.x = Math.PI / 2;
        ownedGeometries.push(knuckle.geometry);
        pivot.add(knuckle);
      }
      add(pivot);
      wheels.push({ pivot, wheel, steered });
    };
    const frontX = REAR_AXLE_X + WHEELBASE;
    makeWheel(frontX, FRONT_TRACK / 2, true); makeWheel(frontX, -FRONT_TRACK / 2, true);
    makeWheel(REAR_AXLE_X, REAR_TRACK / 2, false); makeWheel(REAR_AXLE_X, -REAR_TRACK / 2, false);

    // A ring on the floor in the track colour links the car with its legend entry and its trail.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ghost ? 0.1 : 0.115, ghost ? 0.118 : 0.14, 48),
      new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: ghost ? 0.55 : 0.9, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0.03, 0.004, 0);
    ownedGeometries.push(ring.geometry);
    ownedMaterials.push(ring.material as THREE.Material);
    root.add(ring);
    themedTracks.push((theme) => { (ring.material as THREE.MeshBasicMaterial).color.set(trackColor(color, theme)); });
    return { root, wheels };
  }

  // ---- Per track: car, trail ribbon, LiDAR fan ----
  const rayMaterial = (color: number, opacity: number) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  interface Fan {
    scans: Scan[]; rays: THREE.LineSegments; hits: THREE.Points;
    rayPos: Float32Array; hitPos: Float32Array; shown: Scan | null;
  }
  interface TrackView {
    track: Track; model: CarModel; pose: TrackPose; trail: THREE.Mesh | null; trailSegments: number; fan: Fan | null;
  }
  const views: TrackView[] = replay.tracks.map((track, index) => {
    const ghost = index > 0;
    const model = buildCar(track.color, ghost);
    scene.add(model.root);

    let trail: THREE.Mesh | null = null;
    let trailSegments = 0;
    if (replay.trail) {
      const n = track.t.length, width = ghost ? 0.014 : 0.02;
      const positions = new Float32Array(n * 2 * 3);
      let px = 1, py = 0; // last non-zero perpendicular
      for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
        const dx = track.x[b] - track.x[a], dy = track.y[b] - track.y[a], len = Math.hypot(dx, dy);
        if (len > 1e-6) { px = -dy / len; py = dx / len; }
        const y3 = ghost ? 0.0035 : 0.004;
        positions.set([track.x[i] + px * width / 2, y3, -(track.y[i] + py * width / 2)], i * 6);
        positions.set([track.x[i] - px * width / 2, y3, -(track.y[i] - py * width / 2)], i * 6 + 3);
      }
      const indices: number[] = [];
      for (let i = 0; i < n - 1; i++) indices.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.setDrawRange(0, 0);
      trail = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: trackColor(track.color), transparent: true, opacity: ghost ? 0.6 : 0.9, side: THREE.DoubleSide, depthWrite: false,
      }));
      trail.frustumCulled = false;
      ownedGeometries.push(geometry);
      ownedMaterials.push(trail.material as THREE.Material);
      const trailMaterial = trail.material as THREE.MeshBasicMaterial;
      themedTracks.push((theme) => { trailMaterial.color.set(trackColor(track.color, theme)); });
      scene.add(trail);
      trailSegments = n - 1;
    }

    let fan: Fan | null = null;
    const scans = replay.scans.filter((s) => s.track === index);
    if (scans.length) {
      const samples = Math.max(...scans.map((s) => s.ranges.length));
      const rayPos = new Float32Array(samples * 2 * 3), hitPos = new Float32Array(samples * 3);
      const rg = new THREE.BufferGeometry(), hg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.BufferAttribute(rayPos, 3));
      hg.setAttribute('position', new THREE.BufferAttribute(hitPos, 3));
      const rayHex = (theme: Theme) => (ghost ? new THREE.Color(trackColor(track.color, theme)).getHex() : scenePalette(theme).lidarRay);
      const hitHex = (theme: Theme) => (ghost ? new THREE.Color(trackColor(track.color, theme)).getHex() : scenePalette(theme).lidarHit);
      const rayOpacity = (theme: Theme) => (ghost ? 0.14 : scenePalette(theme).lidarRayOpacity + 0.02);
      const hitSize = (theme: Theme) => 0.016 * (ghost ? 1 : scenePalette(theme).lidarHitSize);
      const initial = initialTheme;
      const rays = new THREE.LineSegments(rg, rayMaterial(rayHex(initial), rayOpacity(initial)));
      const hits = new THREE.Points(hg, new THREE.PointsMaterial({ color: hitHex(initial), size: hitSize(initial) }));
      themedTracks.push((theme) => {
        const rm = rays.material as THREE.LineBasicMaterial, hm = hits.material as THREE.PointsMaterial;
        rm.color.set(rayHex(theme)); rm.opacity = rayOpacity(theme);
        hm.color.set(hitHex(theme)); hm.size = hitSize(theme);
      });
      for (const o of [rays, hits]) { o.frustumCulled = false; o.visible = false; scene.add(o); }
      ownedGeometries.push(rg, hg);
      ownedMaterials.push(rays.material as THREE.Material, hits.material as THREE.Material);
      fan = { scans, rays, hits, rayPos, hitPos, shown: null };
    }
    return { track, model, pose: { x: 0, y: 0, yaw: 0, steer: 0, spin: 0 }, trail, trailSegments, fan };
  });

  // ---- Measures from the car: left, right (perpendicular) and front (ahead) ----
  const measurePos = new Float32Array(6 * 3), pointPos = new Float32Array(3 * 3);
  const measureColors = new Float32Array(6 * 3), pointColors = new Float32Array(3 * 3);
  const paintMeasures = (p: typeof colors) => {
    p.measure.forEach((rgb, k) => { measureColors.set(rgb, k * 6); measureColors.set(rgb, k * 6 + 3); pointColors.set(rgb, k * 3); });
  };
  paintMeasures(colors);
  const mg = new THREE.BufferGeometry(), pg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(measurePos, 3));
  mg.setAttribute('color', new THREE.BufferAttribute(measureColors, 3));
  pg.setAttribute('position', new THREE.BufferAttribute(pointPos, 3));
  pg.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));
  const measureLines = new THREE.LineSegments(mg, new THREE.LineBasicMaterial({ vertexColors: true }));
  const measurePoints = new THREE.Points(pg, new THREE.PointsMaterial({ vertexColors: true, size: 0.035 }));
  for (const o of [measureLines, measurePoints]) { o.frustumCulled = false; o.visible = false; scene.add(o); }
  ownedGeometries.push(mg, pg);
  ownedMaterials.push(measureLines.material as THREE.Material, measurePoints.material as THREE.Material);

  // ---- Camera ----
  const cam = new THREE.PerspectiveCamera(40, 4 / 3, 0.02, 100);
  const lookAt = new THREE.Vector3(centre.x, 0, -centre.y);
  const wantedPos = new THREE.Vector3(), wantedLook = new THREE.Vector3();
  let width = 1, height = 1;
  cam.position.set(centre.x, 5, -centre.y + 0.001);

  function resize(w: number, h: number) {
    width = Math.max(1, Math.floor(w));
    height = Math.max(1, Math.floor(h));
    renderer.setSize(width, height, false);
    cam.aspect = width / height;
    cam.updateProjectionMatrix();
  }

  function frame(time: number, o: FrameOptions): boolean {
    lastCall = { time, options: o };
    // Cars, trails, wheels
    for (const view of views) {
      const { track, model, pose } = view;
      samplePose(track, time, pose);
      model.root.position.set(pose.x, 0, -pose.y);
      model.root.rotation.y = pose.yaw;
      for (const w of model.wheels) {
        if (w.steered) w.pivot.rotation.z = pose.steer;
        w.wheel.rotation.y = pose.spin;
      }
      if (view.trail) view.trail.geometry.setDrawRange(0, 6 * Math.min(view.trailSegments, frameIndex(track, time)));
    }
    const main = views[0].pose;

    // Section tint: every exit so far adds to the section (up to the three laps)
    if (replay.sections) {
      const counts = new Int8Array(8);
      for (const e of replay.sectionExits) if (e.t <= time) counts[e.section]++;
      for (let s = 0; s < 8; s++) {
        if (counts[s] === sectionShown[s]) continue;
        sectionShown[s] = counts[s];
        sectionMaterials[s].opacity = counts[s] ? Math.min(0.6, (0.16 + 0.09 * (Math.min(counts[s], 3) - 1)) * colors.sectionOpacityBoost) : 0;
      }
    }

    // LiDAR fans: latest scan at or before `time`, drawn from the pose at the moment of the scan
    for (const view of views) {
      const fan = view.fan;
      if (!fan) continue;
      fan.rays.visible = fan.hits.visible = false;
      if (!o.lidar) { fan.shown = null; continue; }
      const scan = latestAt(fan.scans, time);
      if (!scan) { fan.shown = null; continue; }
      fan.rays.visible = fan.hits.visible = true;
      if (scan === fan.shown) continue;
      fan.shown = scan;
      const p = samplePose(view.track, scan.t);
      const ox = p.x + LIDAR.x * Math.cos(p.yaw), oy = p.y + LIDAR.x * Math.sin(p.yaw);
      const n = scan.ranges.length, step = (2 * LIDAR.halfAngle) / (n - 1);
      for (let i = 0; i < n; i++) {
        const range = scan.ranges[i];
        if (range === null) { fan.rayPos.set([ox, LIDAR.z, -oy, ox, LIDAR.z, -oy], i * 6); fan.hitPos.set([ox, LIDAR.z, -oy], i * 3); continue; }
        const a = p.yaw - LIDAR.halfAngle + i * step, hx = ox + range * Math.cos(a), hy = oy + range * Math.sin(a);
        fan.rayPos.set([ox, LIDAR.z, -oy, hx, LIDAR.z, -hy], i * 6);
        fan.hitPos.set([hx, LIDAR.z, -hy], i * 3);
      }
      fan.rays.geometry.attributes.position.needsUpdate = true;
      fan.hits.geometry.attributes.position.needsUpdate = true;
      // Scans may have different lengths: draw only the vertices of this one.
      fan.rays.geometry.setDrawRange(0, n * 2);
      fan.hits.geometry.setDrawRange(0, n);
    }

    // Measures (left/right/front) around the main car
    const entry = replay.scene.length ? latestAt(replay.scene, time) : null;
    const showMeasures = o.measures && entry !== null;
    measureLines.visible = measurePoints.visible = showMeasures;
    if (showMeasures && entry) {
      const c = Math.cos(main.yaw), s = Math.sin(main.yaw), z = 0.035;
      const put = (k: number, dx: number, dy: number, len: number | null) => {
        const ex = main.x + dx * (len ?? 0), ey = main.y + dy * (len ?? 0);
        measurePos.set([main.x, z, -main.y, ex, z, -ey], k * 6);
        pointPos.set(len === null ? [main.x, z, -main.y] : [ex, z, -ey], k * 3);
      };
      put(0, -s, c, entry.left); // left of the heading
      put(1, s, -c, entry.right);
      put(2, c, s, entry.front);
      mg.attributes.position.needsUpdate = true;
      pg.attributes.position.needsUpdate = true;
    }

    // Camera: top view fits the field; follow chases the main car
    if (o.mode === 'top') {
      const halfV = Math.max(boundsH / 2, boundsW / (2 * cam.aspect)) * 1.04;
      const dist = halfV / Math.tan(THREE.MathUtils.degToRad(40 / 2));
      wantedPos.set(centre.x, dist, -centre.y + 0.001);
      wantedLook.set(centre.x, 0, -centre.y);
    } else {
      wantedPos.set(main.x - Math.cos(main.yaw) * 0.75, 0.55, -main.y + Math.sin(main.yaw) * 0.75);
      wantedLook.set(main.x + Math.cos(main.yaw) * 0.3, 0.02, -main.y - Math.sin(main.yaw) * 0.3);
    }
    const fov = o.mode === 'top' ? 40 : 52;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const k = o.snap ? 1 : 1 - Math.exp(-o.dt * 8);
    cam.position.lerp(wantedPos, k);
    lookAt.lerp(wantedLook, k);
    cam.lookAt(lookAt);
    const settled = cam.position.distanceTo(wantedPos) < 0.002 && lookAt.distanceTo(wantedLook) < 0.002;

    renderer.render(scene, cam);
    return settled;
  }

  // The scene follows the page theme live; the last camera position is drawn again at once.
  function applyTheme(theme: Theme) {
    colors = scenePalette(theme);
    (scene.background as THREE.Color).set(sceneBackground(theme));
    (ground.material as THREE.MeshBasicMaterial).color.set(sceneBackground(theme));
    for (const wall of wallMeshes) wall.material.color.set(colors.wall);
    for (const material of sectionMaterials) material.color.set(colors.section);
    sectionShown.fill(-1); // opacities are recomputed on the next frame
    paintMeasures(colors);
    mg.attributes.color.needsUpdate = true;
    pg.attributes.color.needsUpdate = true;
    for (const apply of themedTracks) apply(theme);
    if (disposed) return;
    // Redraw at once with the last frame's time and options (dt 0: the camera does not move).
    if (lastCall) frame(lastCall.time, { ...lastCall.options, dt: 0, snap: false });
    else renderer.render(scene, cam);
  }
  let lastCall: { time: number; options: FrameOptions } | null = null;
  const offTheme = onThemeChange(applyTheme);

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    offTheme();
    scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    geometries.forEach((g) => g?.dispose());
    ownedGeometries.forEach((g) => g.dispose());
    ownedMaterials.forEach((m) => m.dispose());
    Object.values(baseMaterials).forEach((m) => m.dispose());
    matTexture?.dispose();
    gridTexture?.dispose();
    sun.shadow.map?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { resize, frame, dispose };
}
