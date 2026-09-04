/*
  quaternion-viz.js
  -----------------
  Shared logic for the Euler vs Quaternion visualizer.
  This ONE file is used by index.html, es.html and ko.html (via quaternions.html
  + i18n) — it never changes between languages, only assets/i18n/*.json does.
*/

(function () {
  'use strict';

  // =====================================================================
  // 1. CONFIG
  // =====================================================================

  // Target orientations to cycle through in "Animate" mode, each as
  // axis + angle (this maps directly to a quaternion). Waypoint index 2
  // sits at 90° around Y, which is exactly where Euler gimbal lock shows.
  const WAYPOINTS = [
    { axis: { x: 0, y: 1, z: 0 }, angleDeg: 0   },
    { axis: { x: 1, y: 0, z: 0 }, angleDeg: 60  },
    { axis: { x: 0, y: 1, z: 0 }, angleDeg: 90  },  // <- gimbal lock zone
    { axis: { x: 0, y: 0, z: 1 }, angleDeg: 45  },
  ];

  const SECONDS_PER_WAYPOINT = 3;
  const EULER_ORDER = 'XYZ'; // roll=X, pitch=Y, yaw=Z — used everywhere, consistently

  // =====================================================================
  // 2. SCENE SETUP (unchanged)
  // =====================================================================

  function createScene(containerId) {
    const container = document.getElementById(containerId);
    const width = container.clientWidth;
    const height = container.clientHeight || 320;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(3, 2.5, 4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AxesHelper(1.5));
    scene.add(new THREE.GridHelper(4, 8, 0x333844, 0x1a1e28));
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(3, 5, 2);
    scene.add(dirLight);

    window.addEventListener('resize', () => {
      const w = container.clientWidth;
      const h = container.clientHeight || 320;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    return { scene, camera, renderer, controls };
  }

  // =====================================================================
  // 3. THE ORIENTABLE OBJECT  (plane + its perpendicular / normal vector)
  // =====================================================================

  function createOrientableObject(color) {
    const group = new THREE.Group();

    // The plane itself. DoubleSide so it's visible from both faces,
    // slightly transparent so the arrow reads clearly through it.
    const geometry = new THREE.PlaneGeometry(2, 1.2);
    const material = new THREE.MeshStandardMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });
    const plane = new THREE.Mesh(geometry, material);
    group.add(plane);

    // The perpendicular / normal vector. A PlaneGeometry's local normal
    // points along +Z before any rotation, so the arrow starts there too —
    // rotating the whole group keeps both in sync.
    const normalDir = new THREE.Vector3(0, 0, 1);
    const arrow = new THREE.ArrowHelper(normalDir, new THREE.Vector3(0, 0, 0), 1.5, color, 0.3, 0.15);
    group.add(arrow);

    return group;
  }

  // =====================================================================
  // 4. ROTATION MATH
  // =====================================================================

  function applyEuler(object, rollDeg, pitchDeg, yawDeg) {
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(rollDeg),
      THREE.MathUtils.degToRad(pitchDeg),
      THREE.MathUtils.degToRad(yawDeg),
      EULER_ORDER
    );
    object.quaternion.setFromEuler(euler);
  }

  function applyQuaternionAxisAngle(object, axis, angleDeg) {
    const vec = new THREE.Vector3(axis.x, axis.y, axis.z);
    if (vec.lengthSq() < 1e-8) return; // guard against a zero-length axis (all sliders at 0)
    vec.normalize();
    object.quaternion.setFromAxisAngle(vec, THREE.MathUtils.degToRad(angleDeg));
  }

  function eulerToQuaternion(rollDeg, pitchDeg, yawDeg) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(rollDeg),
      THREE.MathUtils.degToRad(pitchDeg),
      THREE.MathUtils.degToRad(yawDeg),
      EULER_ORDER
    ));
    return { w: q.w, x: q.x, y: q.y, z: q.z };
  }

  function quaternionToEulerDeg(q) {
    const e = new THREE.Euler().setFromQuaternion(q, EULER_ORDER);
    return {
      roll: THREE.MathUtils.radToDeg(e.x),
      pitch: THREE.MathUtils.radToDeg(e.y),
      yaw: THREE.MathUtils.radToDeg(e.z),
    };
  }

  function updateReadouts(rollDeg, pitchDeg, yawDeg, quat) {
    const eulerReadout = document.getElementById('readout-euler');
    const quatReadout = document.getElementById('readout-quat');
    if (eulerReadout) {
      eulerReadout.textContent =
        `roll: ${rollDeg.toFixed(1)}  pitch: ${pitchDeg.toFixed(1)}  yaw: ${yawDeg.toFixed(1)}`;
    }
    if (quatReadout) {
      quatReadout.textContent =
        `w: ${quat.w.toFixed(2)}  x: ${quat.x.toFixed(2)}  y: ${quat.y.toFixed(2)}  z: ${quat.z.toFixed(2)}`;
    }
  }

  // =====================================================================
  // 5. ANIMATE MODE — auto-play through WAYPOINTS
  // =====================================================================

  let eulerObj, quatObj;
  let eulerScene, quatScene;
  let mode = 'animate'; // 'animate' | 'manual'
  let animStartTime = null;

  // Cache each waypoint's quaternion + equivalent Euler angles once,
  // instead of recomputing every animation frame.
  let waypointQuats = null;
  let waypointEulers = null;

  function ensureWaypointCache() {
    if (waypointQuats) return;
    waypointQuats = WAYPOINTS.map((wp) => {
      const axis = new THREE.Vector3(wp.axis.x, wp.axis.y, wp.axis.z).normalize();
      return new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(wp.angleDeg));
    });
    waypointEulers = waypointQuats.map(quaternionToEulerDeg);
  }

  function stepAnimation(elapsedSeconds) {
    if (WAYPOINTS.length < 2) return;
    ensureWaypointCache();

    const totalWaypoints = WAYPOINTS.length;
    const loopDuration = SECONDS_PER_WAYPOINT * totalWaypoints;
    const timeInLoop = elapsedSeconds % loopDuration;

    const fromIndex = Math.floor(timeInLoop / SECONDS_PER_WAYPOINT);
    const toIndex = (fromIndex + 1) % totalWaypoints;
    const t = (timeInLoop % SECONDS_PER_WAYPOINT) / SECONDS_PER_WAYPOINT; // 0..1 within this leg

    // --- Quaternion panel: spherical interpolation (slerp). Smooth, constant
    // angular speed, no loss of degrees of freedom.
    const qOut = waypointQuats[fromIndex].clone().slerp(waypointQuats[toIndex], t);
    quatObj.quaternion.copy(qOut);

    // --- Euler panel: linearly interpolate each angle independently. This is
    // what naive rotation code usually does — and it's what breaks down near
    // pitch = +/-90 (gimbal lock): you'll see roll/yaw jump or the motion
    // twist unnaturally compared to the quaternion panel right next to it.
    const eFrom = waypointEulers[fromIndex];
    const eTo = waypointEulers[toIndex];
    const roll = THREE.MathUtils.lerp(eFrom.roll, eTo.roll, t);
    const pitch = THREE.MathUtils.lerp(eFrom.pitch, eTo.pitch, t);
    const yaw = THREE.MathUtils.lerp(eFrom.yaw, eTo.yaw, t);
    applyEuler(eulerObj, roll, pitch, yaw);

    updateReadouts(roll, pitch, yaw, qOut);
  }

  // =====================================================================
  // 6. MANUAL MODE — sliders drive both panels directly
  // =====================================================================

  function onManualControlsChanged() {
    const roll = parseFloat(document.getElementById('slider-roll').value);
    const pitch = parseFloat(document.getElementById('slider-pitch').value);
    const yaw = parseFloat(document.getElementById('slider-yaw').value);

    applyEuler(eulerObj, roll, pitch, yaw);
    document.getElementById('out-roll').textContent = roll.toFixed(0);
    document.getElementById('out-pitch').textContent = pitch.toFixed(0);
    document.getElementById('out-yaw').textContent = yaw.toFixed(0);

    const axisX = parseFloat(document.getElementById('slider-axis-x').value);
    const axisY = parseFloat(document.getElementById('slider-axis-y').value);
    const axisZ = parseFloat(document.getElementById('slider-axis-z').value);
    const angle = parseFloat(document.getElementById('slider-angle').value);

    applyQuaternionAxisAngle(quatObj, { x: axisX, y: axisY, z: axisZ }, angle);
    document.getElementById('out-angle').textContent = angle.toFixed(0);

    // Readouts: left panel shows its own Euler values (redundant with sliders
    // but useful once you add more panels later); right panel shows the
    // ACTUAL live quaternion of quatObj, straight from Three.js.
    updateReadouts(roll, pitch, yaw, quatObj.quaternion);
  }

  // =====================================================================
  // 7. WIRING
  // =====================================================================

  function setMode(newMode) {
    mode = newMode;
    document.getElementById('btn-mode-animate').classList.toggle('active', mode === 'animate');
    document.getElementById('btn-mode-manual').classList.toggle('active', mode === 'manual');
    document.getElementById('manual-controls').hidden = mode !== 'manual';
    if (mode === 'animate') {
      animStartTime = null; // restart the clock
    } else {
      onManualControlsChanged(); // sync panels to current slider positions immediately
    }
  }

  function init() {
    eulerScene = createScene('canvas-euler');
    quatScene = createScene('canvas-quat');

    eulerObj = createOrientableObject(0x5eb3ff);
    quatObj = createOrientableObject(0xff9d5e);
    eulerScene.scene.add(eulerObj);
    quatScene.scene.add(quatObj);

    document.getElementById('btn-mode-animate').addEventListener('click', () => setMode('animate'));
    document.getElementById('btn-mode-manual').addEventListener('click', () => setMode('manual'));

    [
      'slider-roll', 'slider-pitch', 'slider-yaw',
      'slider-axis-x', 'slider-axis-y', 'slider-axis-z', 'slider-angle',
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', onManualControlsChanged);
    });

    let lastTime = performance.now();
    function frame(now) {
      lastTime = now;

      if (mode === 'animate') {
        if (animStartTime === null) animStartTime = now;
        stepAnimation((now - animStartTime) / 1000);
      }

      eulerScene.controls.update();
      quatScene.controls.update();
      eulerScene.renderer.render(eulerScene.scene, eulerScene.camera);
      quatScene.renderer.render(quatScene.scene, quatScene.camera);

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  document.addEventListener('DOMContentLoaded', init);
})();