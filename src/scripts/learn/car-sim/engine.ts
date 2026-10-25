// The heavy part (three.js). Loaded lazily from ../car-sim.ts once the simulator is near the viewport.
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import {
  CAMERA, FRONT_TRACK, LIDAR, REAR_AXLE_X, REAR_TRACK, START, WALLS, WHEELBASE, WHEEL_RADIUS, WHEEL_WIDTH,
} from './constants';
import type { Sim } from './physics';
import { onThemeChange, scenePalette, sceneBackground, type Theme } from '../theme-colors';

export interface EngineOptions {
  root: HTMLElement;
  sim: Sim;
  compact: boolean;
  autostart: boolean;
  assetBase: string; // e.g. /learn/assets/
  onTick: () => void; // called once per rendered frame, after physics and LiDAR
}
export interface Engine {
  setVisible(visible: boolean): void;
  /** Show or hide the LiDAR fan and the car-camera picture (the keys L and C do the same). */
  setOverlays(overlays: { lidar?: boolean; camera?: boolean }): void;
  dispose(): void;
}

const DT = 1 / 240;
const MESHES: [string, string][] = [
  ['base_plate', 'purple'], ['case', 'purple'], ['camera_support', 'purple'], ['camera', 'black'],
  ['servo', 'black'], ['raspberry_pi', 'pcb'], ['driver_board', 'pcb'],
];

export function startEngine(opts: EngineOptions): Engine {
  const { root, sim, compact, autostart, assetBase, onTick } = opts;
  const state = sim.state;
  const challenge = root.dataset.challenge === 'true'; // the Reto panel has its own timer
  const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const viewport = q<HTMLElement>('.cs-viewport');
  const canvas = q<HTMLCanvasElement>('.cs-canvas');
  const hud = q<HTMLElement>('.cs-hud');
  const hitFlash = q<HTMLElement>('.cs-hit');
  const camLabel = q<HTMLElement>('.cs-camlabel');
  const loading = q<HTMLElement>('.cs-loading');

  let disposed = false;
  let visible = true;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  let palette = scenePalette();
  scene.background = new THREE.Color(sceneBackground());
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6558, 1.5));
  const sun = new THREE.DirectionalLight(0xfff3df, 2.2);
  sun.position.set(-1.5, 3, 1.5);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 0.5, far: 8 });
  sun.shadow.mapSize.set(compact ? 1024 : 2048, compact ? 1024 : 2048);
  scene.add(sun);

  // Our own game mat (robotek_game_mat: 3.2 x 3.2 m). With the plane rotated -90 deg about x, the image's
  // right is sim +x and its top is sim +y, the orientation Gazebo shows.
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 1.0 }); // fallback without the image
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  // Unlit and the colour of the background, so the field floats on a plain white / black page (no horizon line).
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: sceneBackground() }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  scene.add(ground);
  const startZone = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.002, 0.2), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }));
  startZone.position.set(START.x, 0.002, -START.y);
  scene.add(startZone);

  const wallMeshes = WALLS.map(([cx, cy, sx, sy]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.1, sy), new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.7 }));
    mesh.position.set(cx, 0.06, -cy);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  });

  // ---- Car model (robotek.urdf.xacro). `car` sits at base_link (y up, z = -sim y); `urdf` is rotated
  // -90 deg about x so the parts are written in the URDF frame: +x forward, +y left, +z up. ----
  const car = new THREE.Group();
  scene.add(car);
  const urdf = new THREE.Group();
  urdf.rotation.x = -Math.PI / 2;
  car.add(urdf);
  // The car's own parts are on layer 1 so its camera, which sits inside the camera body, does not see them.
  const addPart = (parent: THREE.Object3D, part: THREE.Object3D) => {
    part.traverse((o) => o.layers.set(1));
    parent.add(part);
  };
  const material = (color: THREE.Color, roughness = 0.55, metalness = 0.05) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const materials: Record<string, THREE.MeshStandardMaterial> = {
    purple: material(new THREE.Color(0.4, 0.17, 0.7)), black: material(new THREE.Color(0.05, 0.05, 0.05), 0.5),
    pcb: material(new THREE.Color(0.04, 0.32, 0.2), 0.45), navy: material(new THREE.Color(0.07, 0.07, 0.2)),
    lilac: material(new THREE.Color(0.72, 0.65, 0.93), 0.9, 0), olive: material(new THREE.Color(0.3, 0.35, 0.2), 0.8, 0),
    silver: material(new THREE.Color(0.7, 0.7, 0.7), 0.3, 0.6),
  };

  // STL meshes: millimetres, Y up, front towards -X (Assembly3.stp). URDF origin (0.02495, 0, 0.0379),
  // rpy (pi/2, 0, pi) -> Euler order 'ZYX' with (x = roll, y = pitch, z = yaw).
  const pending: Promise<void>[] = [];
  const stlLoader = new STLLoader();
  const loadedGeometries: THREE.BufferGeometry[] = [];
  for (const [file, name] of MESHES) {
    pending.push(new Promise<void>((resolve) => {
      stlLoader.load(`${assetBase}meshes/${file}.stl`, (geometry: THREE.BufferGeometry) => {
        if (disposed) { geometry.dispose(); return resolve(); }
        loadedGeometries.push(geometry);
        const mesh = new THREE.Mesh(geometry, materials[name]);
        mesh.scale.setScalar(0.001);
        mesh.position.set(0.02495, 0, 0.0379);
        mesh.rotation.set(Math.PI / 2, 0, Math.PI, 'ZYX');
        mesh.castShadow = true;
        addPart(urdf, mesh);
        resolve();
      }, undefined, () => { console.warn(`[car-sim] ${file}.stl not found`); resolve(); });
    }));
  }
  let texture: THREE.Texture | null = null;
  pending.push(new Promise<void>((resolve) => {
    new THREE.TextureLoader().load(`${assetBase}mat.png`, (t) => {
      if (disposed) { t.dispose(); return resolve(); }
      texture = t;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      floorMaterial.map = t;
      floorMaterial.color.set(0xffffff);
      floorMaterial.needsUpdate = true;
      resolve();
    }, undefined, () => { console.warn('[car-sim] mat.png not found'); resolve(); });
  }));
  Promise.all(pending).then(() => {
    if (disposed) return;
    root.dataset.ready = 'true';
    loading.hidden = true;
  });

  // LD19 from primitives, as in the URDF (axis 128.35 mm ahead of base_link, standing on the plate tab).
  const lidarBody = new THREE.Mesh(new THREE.BoxGeometry(0.0386, 0.0386, 0.0146), materials.navy);
  lidarBody.position.set(0.12835, 0, 0.0233);
  const lidarHead = new THREE.Mesh(new THREE.CylinderGeometry(0.0187, 0.0187, 0.0202, 32), materials.black);
  lidarHead.rotation.x = Math.PI / 2;
  lidarHead.position.set(0.12835, 0, 0.0407);
  const imuBox = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.005), materials.silver); // imu_link, 61 mm above base_link
  imuBox.position.set(0, 0, 0.061);
  for (const part of [lidarBody, lidarHead, imuBox]) { part.castShadow = true; addPart(urdf, part); }

  // Wheels: tyre (lilac) and hub (olive). The knuckle is the steering pivot (about z) of the front wheels.
  function makeWheel(x: number, y: number, steered: boolean) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, WHEEL_RADIUS);
    const wheel = new THREE.Group(); // spins about +y
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 40), materials.lilac);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS - 0.0045, WHEEL_RADIUS - 0.0045, WHEEL_WIDTH + 0.0006, 40), materials.olive);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.004, WHEEL_WIDTH + 0.0012, 0.018), materials.black);
    mark.position.z = 0.012;
    for (const part of [tyre, hub, mark]) { part.castShadow = true; wheel.add(part); }
    pivot.add(wheel);
    if (steered) {
      const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, WHEEL_RADIUS * 2, 16), materials.silver);
      knuckle.rotation.x = Math.PI / 2;
      pivot.add(knuckle);
    }
    addPart(urdf, pivot);
    return { pivot, wheel };
  }
  const frontX = REAR_AXLE_X + WHEELBASE;
  const wheels = {
    fl: makeWheel(frontX, FRONT_TRACK / 2, true), fr: makeWheel(frontX, -FRONT_TRACK / 2, true),
    rl: makeWheel(REAR_AXLE_X, REAR_TRACK / 2, false), rr: makeWheel(REAR_AXLE_X, -REAR_TRACK / 2, false),
  };

  // ---- The car's own camera (camera_link in the URDF with real_car:=true) ----
  const carCamera = new THREE.PerspectiveCamera(
    THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(CAMERA.hfov / 2) / CAMERA.aspect)), CAMERA.aspect, 0.02, 20);
  const cameraRig = new THREE.Group();
  cameraRig.position.set(CAMERA.x, 0, CAMERA.z);
  cameraRig.rotation.set(0, CAMERA.pitch, CAMERA.yaw, 'ZYX');
  // A three.js camera looks along its -z with +y up; the URDF camera looks along +x with +z up.
  carCamera.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));
  cameraRig.add(carCamera);
  urdf.add(cameraRig);

  // ---- LiDAR fan: rays and hit points (layer 1: not seen by the car camera) ----
  const rayPositions = new Float32Array(LIDAR.samples * 2 * 3);
  const hitPositions = new Float32Array(LIDAR.samples * 3);
  const rayGeometry = new THREE.BufferGeometry();
  rayGeometry.setAttribute('position', new THREE.BufferAttribute(rayPositions, 3));
  const hitGeometry = new THREE.BufferGeometry();
  hitGeometry.setAttribute('position', new THREE.BufferAttribute(hitPositions, 3));
  const rayMaterial = new THREE.LineBasicMaterial({ color: palette.lidarRay, transparent: true, opacity: palette.lidarRayOpacity });
  const hitMaterial = new THREE.PointsMaterial({ color: palette.lidarHit, size: 0.012 * palette.lidarHitSize });
  const lidarRays = new THREE.LineSegments(rayGeometry, rayMaterial);
  const lidarHits = new THREE.Points(hitGeometry, hitMaterial);
  for (const o of [lidarRays, lidarHits]) { o.frustumCulled = false; o.layers.set(1); scene.add(o); }
  let lidarVisible = true;
  let camVisible = true;
  let cameraMode = 0; // 0 chase, 1 top

  function updateLidar() {
    const { ox, oy, stepAngle } = sim.scan();
    if (!lidarVisible) return;
    for (let i = 0; i < LIDAR.samples; i++) {
      const a = state.yaw - LIDAR.halfAngle + i * stepAngle, range = sim.ranges[i];
      const hx = ox + range * Math.cos(a), hy = oy + range * Math.sin(a); // sim -> three: (x, z, -y)
      rayPositions.set([ox, LIDAR.z, -oy, hx, LIDAR.z, -hy], i * 6);
      hitPositions.set([hx, LIDAR.z, -hy], i * 3);
    }
    rayGeometry.attributes.position.needsUpdate = true;
    hitGeometry.attributes.position.needsUpdate = true;
  }

  // ---- Main camera, size ----
  const cam = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
  cam.layers.enable(1);
  cam.position.set(START.x - 0.45, 0.33, -START.y);
  let width = 1, height = 1, tight = false;
  const pip = { width: 0, height: 0, margin: 10 };
  function resize() {
    const rect = viewport.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    cam.aspect = width / height;
    cam.updateProjectionMatrix();
    tight = width < 520;
    root.dataset.tight = tight ? 'true' : 'false';
    pip.width = Math.round(Math.max(96, Math.min(320, width * (compact || tight ? 0.3 : 0.26))));
    pip.height = Math.round(pip.width / CAMERA.aspect);
    pip.margin = compact ? 8 : 10;
    const labelText = camLabel.querySelector('span');
    if (labelText) labelText.textContent = pip.width < 190 ? 'cámara' : 'cámara del coche · 640×480';
    camLabel.style.width = `${pip.width}px`;
    camLabel.style.height = `${pip.height}px`;
    camLabel.style.top = `${pip.margin}px`;
    camLabel.style.right = `${pip.margin}px`;
    renderFrame();
  }
  const resizeObserver = new ResizeObserver(() => { if (!disposed) resize(); });
  resizeObserver.observe(viewport);

  // ---- Input: only while the viewport has focus ----
  const keys = new Set<string>();
  const touch = new Set<string>();
  const isDown = (...names: string[]) => names.some((n) => keys.has(n) || touch.has(n));
  const syncControls = () => {
    sim.controls.throttle = (isDown('w', 'ArrowUp', 'up') ? 1 : 0) - (isDown('s', 'ArrowDown', 'down') ? 1 : 0);
    sim.controls.steer = (isDown('a', 'ArrowLeft', 'left') ? 1 : 0) - (isDown('d', 'ArrowRight', 'right') ? 1 : 0);
    sim.controls.brake = isDown(' ');
  };
  const HANDLED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd', 'r', 'l', 'c', 'v', 't']);
  const normalize = (e: KeyboardEvent) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
  function setFocused(on: boolean) {
    root.dataset.focused = on ? 'true' : 'false';
    if (!on) { keys.clear(); syncControls(); }
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = normalize(e);
    if (k === 'Escape') { viewport.blur(); return; }
    if (!HANDLED.has(k)) return;
    e.preventDefault(); // only reached while the viewport (or one of its buttons) has focus
    if (e.repeat) return;
    keys.add(k);
    if (k === 'r') sim.reset();
    if (k === 'v') cameraMode = (cameraMode + 1) % 2;
    if (k === 'l') lidarVisible = !lidarVisible;
    if (k === 'c') camVisible = !camVisible;
    if (k === 't') sim.toggleSteerLimit();
    lidarRays.visible = lidarHits.visible = lidarVisible;
    camLabel.hidden = !camVisible;
    syncControls();
  };
  const onKeyUp = (e: KeyboardEvent) => { keys.delete(normalize(e)); syncControls(); };
  const onFocusIn = () => setFocused(true);
  const onFocusOut = (e: FocusEvent) => { if (!viewport.contains(e.relatedTarget as Node | null)) setFocused(false); };
  viewport.addEventListener('keydown', onKeyDown);
  viewport.addEventListener('keyup', onKeyUp);
  viewport.addEventListener('focusin', onFocusIn);
  viewport.addEventListener('focusout', onFocusOut);
  const onWindowBlur = () => { keys.clear(); touch.clear(); syncControls(); };
  window.addEventListener('blur', onWindowBlur);
  if (document.activeElement && viewport.contains(document.activeElement)) setFocused(true);

  // Touch buttons (held while pressed)
  const touchCleanup: (() => void)[] = [];
  root.querySelectorAll<HTMLElement>('[data-touch]').forEach((button) => {
    const name = button.dataset.touch!;
    const press = (e: PointerEvent) => {
      e.preventDefault();
      if (name === 'reset') { sim.reset(); return; }
      touch.add(name); syncControls();
      try { button.setPointerCapture(e.pointerId); } catch { /* synthetic or already released pointer */ }
      button.dataset.active = 'true';
    };
    const release = () => { touch.delete(name); syncControls(); delete button.dataset.active; };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    touchCleanup.push(() => {
      button.removeEventListener('pointerdown', press); button.removeEventListener('pointerup', release);
      button.removeEventListener('pointercancel', release); button.removeEventListener('lostpointercapture', release);
    });
  });
  const flash = () => {
    hitFlash.style.opacity = '0.35';
    setTimeout(() => { hitFlash.style.opacity = '0'; }, 120);
  };

  // ---- Frame ----
  let lastContacts = state.contacts;
  const pos = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const wanted = new THREE.Vector3();
  function updateVisuals(dt: number) {
    car.position.set(state.x, 0, -state.y);
    car.rotation.y = state.yaw;
    // A left turn (positive steer, +y) is a rotation about three's +y: pivots follow the same sign.
    wheels.fl.pivot.rotation.z = state.steer;
    wheels.fr.pivot.rotation.z = state.steer;
    for (const w of Object.values(wheels)) w.wheel.rotation.y = state.wheelSpin;
    const hit = sim.lastHit;
    wallMeshes.forEach((m, i) => m.material.color.set(i === hit.index && state.clock - hit.at < 0.4 ? palette.wallHit : palette.wall));

    pos.set(state.x, 0.05, -state.y);
    const k = 1 - Math.exp(-dt * 8);
    if (cameraMode === 0) {
      wanted.set(-Math.cos(state.yaw) * 0.45, 0.28, Math.sin(state.yaw) * 0.45).add(pos);
      cam.position.lerp(wanted, k);
      cam.lookAt(tmp.set(Math.cos(state.yaw) * 0.25, 0, -Math.sin(state.yaw) * 0.25).add(pos));
    } else {
      cam.position.lerp(wanted.set(0, 3.4, 0.001), k);
      cam.lookAt(0, 0, 0);
    }
  }
  const deg = (r: number) => ((r * 180) / Math.PI).toFixed(1);
  function updateHud() {
    const wrap = (((state.yaw + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const front = Number.isFinite(sim.frontRange) ? sim.frontRange.toFixed(2) : '--';
    hud.textContent = compact || tight
      ? `v        ${state.v.toFixed(2)} m/s\nvolante  ${deg(state.steer)}°\nLiDAR    ${front} m\nchoques  ${state.contacts}`
      : `v        ${state.v.toFixed(2)} m/s\nvolante  ${deg(state.steer)}° (límite ±${deg(sim.steerLimit)}°)\n` +
        `x, y     ${state.x.toFixed(2)}, ${state.y.toFixed(2)} m\nrumbo    ${deg(wrap)}°\n` +
        `LiDAR    ${front} m al frente\n${challenge ? '' : `tiempo   ${state.time.toFixed(1)} s\n`}choques  ${state.contacts}`;
  }
  function renderFrame() {
    if (disposed) return;
    renderer.setViewport(0, 0, width, height);
    renderer.render(scene, cam);
    if (camVisible) {
      // Picture in picture: the car camera in the top-right corner (y of the viewport counts from the bottom).
      const x = width - pip.width - pip.margin, y = height - pip.height - pip.margin;
      renderer.setScissorTest(true);
      renderer.setScissor(x, y, pip.width, pip.height);
      renderer.setViewport(x, y, pip.width, pip.height);
      renderer.clearDepth();
      renderer.render(scene, carCamera);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
    }
  }

  let raf = 0, last = 0, accumulator = 0, lastHud = 0;
  function frame(now: number) {
    raf = 0;
    if (disposed || !running()) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    accumulator += dt;
    while (accumulator >= DT) { sim.step(DT); accumulator -= DT; }
    if (state.contacts !== lastContacts) { lastContacts = state.contacts; flash(); }
    updateVisuals(dt);
    updateLidar();
    if (now - lastHud > 100) { lastHud = now; updateHud(); }
    onTick();
    renderFrame();
    raf = requestAnimationFrame(frame);
  }
  const running = () => visible && !document.hidden;
  function kick() {
    if (disposed || raf || !running()) return;
    last = performance.now();
    accumulator = 0;
    raf = requestAnimationFrame(frame);
  }
  const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); };
  document.addEventListener('visibilitychange', onVisibility);

  // The scene follows the page theme live: clear colour, unlit ground and the LiDAR colours.
  function applyTheme(theme: Theme) {
    palette = scenePalette(theme);
    (scene.background as THREE.Color).set(sceneBackground(theme));
    (ground.material as THREE.MeshBasicMaterial).color.set(sceneBackground(theme));
    rayMaterial.color.set(palette.lidarRay);
    rayMaterial.opacity = palette.lidarRayOpacity;
    hitMaterial.color.set(palette.lidarHit);
    hitMaterial.size = 0.012 * palette.lidarHitSize;
    renderFrame();
  }
  const offTheme = onThemeChange(applyTheme);

  resize();
  updateHud();
  if (autostart) root.dataset.autostart = 'true';
  kick();

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    offTheme();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', onWindowBlur);
    viewport.removeEventListener('keydown', onKeyDown);
    viewport.removeEventListener('keyup', onKeyUp);
    viewport.removeEventListener('focusin', onFocusIn);
    viewport.removeEventListener('focusout', onFocusOut);
    touchCleanup.forEach((fn) => fn());
    keys.clear(); touch.clear(); syncControls();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    loadedGeometries.forEach((g) => g.dispose());
    texture?.dispose();
    sun.shadow.map?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return {
    setOverlays({ lidar, camera }) {
      if (lidar !== undefined) lidarVisible = lidar;
      if (camera !== undefined) camVisible = camera;
      lidarRays.visible = lidarHits.visible = lidarVisible;
      camLabel.hidden = !camVisible;
      renderFrame();
    },
    setVisible(v: boolean) { visible = v; if (v) kick(); else { cancelAnimationFrame(raf); raf = 0; } },
    dispose,
  };
}
