/*
  quaternion-viz.js
  -----------------
  Shared logic for the Euler vs Quaternion visualizer.

  NEW IN THIS VERSION:
  - Sync Euler <-> Quaternion values: moving either control set updates the
    other panel AND its sliders to the equivalent orientation.
  - Sync camera views: links the two OrbitControls together.
  - Reset button: returns both panels + all sliders to identity.
  - Manual sliders stay visible (disabled) during Animate mode and track the
    live animated pose, so switching to Manual never causes a jump.
*/

(function () {
  'use strict';

  // =====================================================================
  // 1. CONFIG
  // =====================================================================

  const WAYPOINTS = [
    { axis: { x: 0, y: 1, z: 0 }, angleDeg: 0   },
    { axis: { x: 1, y: 0, z: 0 }, angleDeg: 60  },
    { axis: { x: 0, y: 1, z: 0 }, angleDeg: 90  },  // <- gimbal lock zone
    { axis: { x: 0, y: 0, z: 1 }, angleDeg: 45  },
  ];

  const SECONDS_PER_WAYPOINT = 3;
  const EULER_ORDER = 'XYZ'; // roll=X, pitch=Y, yaw=Z — used everywhere, consistently

  // =====================================================================
  // 2. SCENE SETUP
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
    controls.target.set(0, 0, 0);

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
  // 3. THE ORIENTABLE OBJECT
  // =====================================================================

  function createOrientableObject(color) {
    const group = new THREE.Group();

    const geometry = new THREE.PlaneGeometry(2, 1.2);
    const material = new THREE.MeshStandardMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });
    const plane = new THREE.Mesh(geometry, material);
    group.add(plane);

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
    if (vec.lengthSq() < 1e-8) return;
    vec.normalize();
    object.quaternion.setFromAxisAngle(vec, THREE.MathUtils.degToRad(angleDeg));
  }

  function quaternionToEulerDeg(q) {
    const e = new THREE.Euler().setFromQuaternion(q, EULER_ORDER);
    return {
      roll: THREE.MathUtils.radToDeg(e.x),
      pitch: THREE.MathUtils.radToDeg(e.y),
      yaw: THREE.MathUtils.radToDeg(e.z),
    };
  }

  // Inverse of setFromAxisAngle: recover {axis, angleDeg} from a quaternion.
  function quaternionToAxisAngle(q) {
    const qn = q.clone().normalize();
    const w = THREE.MathUtils.clamp(qn.w, -1, 1);
    const angleRad = 2 * Math.acos(w);
    const s = Math.sqrt(1 - w * w);
    let axis;
    if (s < 1e-6) {
      axis = { x: 0, y: 1, z: 0 }; // angle ~0, axis is arbitrary
    } else {
      axis = { x: qn.x / s, y: qn.y / s, z: qn.z / s };
    }
    return { axis, angleDeg: THREE.MathUtils.radToDeg(angleRad) };
  }

  function setEulerReadout(rollDeg, pitchDeg, yawDeg) {
    const el = document.getElementById('readout-euler');
    if (el) {
      el.textContent =
        `roll: ${rollDeg.toFixed(1)}  pitch: ${pitchDeg.toFixed(1)}  yaw: ${yawDeg.toFixed(1)}`;
    }
  }

  function setQuatReadout(quat) {
    const el = document.getElementById('readout-quat');
    if (el) {
      el.textContent =
        `w: ${quat.w.toFixed(2)}  x: ${quat.x.toFixed(2)}  y: ${quat.y.toFixed(2)}  z: ${quat.z.toFixed(2)}`;
    }
  }

  // Push numeric values into the Euler sliders/outputs WITHOUT re-triggering
  // their 'input' listeners (setting .value programmatically doesn't fire it).
  function syncEulerSlidersFromValues(rollDeg, pitchDeg, yawDeg) {
    document.getElementById('slider-roll').value = rollDeg.toFixed(0);
    document.getElementById('slider-pitch').value = pitchDeg.toFixed(0);
    document.getElementById('slider-yaw').value = yawDeg.toFixed(0);
    document.getElementById('out-roll').textContent = rollDeg.toFixed(0);
    document.getElementById('out-pitch').textContent = pitchDeg.toFixed(0);
    document.getElementById('out-yaw').textContent = yawDeg.toFixed(0);
  }

  function syncAxisAngleSlidersFromQuaternion(q) {
    const { axis, angleDeg } = quaternionToAxisAngle(q);
    document.getElementById('slider-axis-x').value = axis.x.toFixed(2);
    document.getElementById('slider-axis-y').value = axis.y.toFixed(2);
    document.getElementById('slider-axis-z').value = axis.z.toFixed(2);
    document.getElementById('slider-angle').value = angleDeg.toFixed(0);
    document.getElementById('out-angle').textContent = angleDeg.toFixed(0);
  }

  // =====================================================================
  // 5. STATE
  // =====================================================================

  let eulerObj, quatObj;
  let eulerScene, quatScene;
  let mode = 'animate'; // 'animate' | 'manual'
  let animStartTime = null;

  let valuesSynced = false;
  let viewsSynced = false;
  let isSyncingViews = false;

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

  // =====================================================================
  // 6. ANIMATE MODE
  // =====================================================================

  function stepAnimation(elapsedSeconds) {
    if (WAYPOINTS.length < 2) return;
    ensureWaypointCache();

    const totalWaypoints = WAYPOINTS.length;
    const loopDuration = SECONDS_PER_WAYPOINT * totalWaypoints;
    const timeInLoop = elapsedSeconds % loopDuration;

    const fromIndex = Math.floor(timeInLoop / SECONDS_PER_WAYPOINT);
    const toIndex = (fromIndex + 1) % totalWaypoints;
    const t = (timeInLoop % SECONDS_PER_WAYPOINT) / SECONDS_PER_WAYPOINT;

    // Quaternion panel: slerp — smooth, constant angular speed.
    const qOut = waypointQuats[fromIndex].clone().slerp(waypointQuats[toIndex], t);
    quatObj.quaternion.copy(qOut);

    // Euler panel: lerp each angle independently — breaks down near gimbal lock.
    const eFrom = waypointEulers[fromIndex];
    const eTo = waypointEulers[toIndex];
    const roll = THREE.MathUtils.lerp(eFrom.roll, eTo.roll, t);
    const pitch = THREE.MathUtils.lerp(eFrom.pitch, eTo.pitch, t);
    const yaw = THREE.MathUtils.lerp(eFrom.yaw, eTo.yaw, t);
    applyEuler(eulerObj, roll, pitch, yaw);

    setEulerReadout(roll, pitch, yaw);
    setQuatReadout(qOut);

    // Keep the (disabled) manual sliders tracking the live animated pose,
    // so switching to Manual mode never causes a jump.
    syncEulerSlidersFromValues(roll, pitch, yaw);
    syncAxisAngleSlidersFromQuaternion(qOut);
  }

  // =====================================================================
  // 7. MANUAL MODE
  // =====================================================================

  function eulerSlidersChanged() {
    const roll = parseFloat(document.getElementById('slider-roll').value);
    const pitch = parseFloat(document.getElementById('slider-pitch').value);
    const yaw = parseFloat(document.getElementById('slider-yaw').value);

    document.getElementById('out-roll').textContent = roll.toFixed(0);
    document.getElementById('out-pitch').textContent = pitch.toFixed(0);
    document.getElementById('out-yaw').textContent = yaw.toFixed(0);

    applyEuler(eulerObj, roll, pitch, yaw);
    setEulerReadout(roll, pitch, yaw);

    if (valuesSynced) {
      applyEuler(quatObj, roll, pitch, yaw); // identical orientation, different path
      setQuatReadout(quatObj.quaternion);
      syncAxisAngleSlidersFromQuaternion(quatObj.quaternion);
    }
  }

  function quatSlidersChanged() {
    const axisX = parseFloat(document.getElementById('slider-axis-x').value);
    const axisY = parseFloat(document.getElementById('slider-axis-y').value);
    const axisZ = parseFloat(document.getElementById('slider-axis-z').value);
    const angle = parseFloat(document.getElementById('slider-angle').value);

    document.getElementById('out-angle').textContent = angle.toFixed(0);

    applyQuaternionAxisAngle(quatObj, { x: axisX, y: axisY, z: axisZ }, angle);
    setQuatReadout(quatObj.quaternion);

    if (valuesSynced) {
      eulerObj.quaternion.copy(quatObj.quaternion);
      const e = quaternionToEulerDeg(quatObj.quaternion);
      setEulerReadout(e.roll, e.pitch, e.yaw);
      syncEulerSlidersFromValues(e.roll, e.pitch, e.yaw);
    }
  }

  function resetManualControls() {
    document.getElementById('slider-roll').value = 0;
    document.getElementById('slider-pitch').value = 0;
    document.getElementById('slider-yaw').value = 0;
    document.getElementById('slider-axis-x').value = 0;
    document.getElementById('slider-axis-y').value = 1;
    document.getElementById('slider-axis-z').value = 0;
    document.getElementById('slider-angle').value = 0;
    document.getElementById('out-roll').textContent = '0';
    document.getElementById('out-pitch').textContent = '0';
    document.getElementById('out-yaw').textContent = '0';
    document.getElementById('out-angle').textContent = '0';

    eulerObj.quaternion.identity();
    quatObj.quaternion.identity();
    setEulerReadout(0, 0, 0);
    setQuatReadout(quatObj.quaternion);
  }

  // =====================================================================
  // 8. SYNC TOGGLES
  // =====================================================================

  function setValuesSynced(on) {
    valuesSynced = on;
    document.getElementById('btn-sync-values').classList.toggle('active', valuesSynced);
    if (valuesSynced && mode === 'manual') {
      eulerSlidersChanged(); // align quat panel to current euler sliders immediately
    }
  }

  function copyCamera(fromSceneObj, toSceneObj) {
    toSceneObj.camera.position.copy(fromSceneObj.camera.position);
    toSceneObj.controls.target.copy(fromSceneObj.controls.target);
    toSceneObj.controls.update();
  }

  function setViewsSynced(on) {
    viewsSynced = on;
    document.getElementById('btn-sync-views').classList.toggle('active', viewsSynced);
    if (viewsSynced) {
      copyCamera(eulerScene, quatScene); // align immediately when turned on
    }
  }

  function linkCameraControls() {
    eulerScene.controls.addEventListener('change', () => {
      if (!viewsSynced || isSyncingViews) return;
      isSyncingViews = true;
      copyCamera(eulerScene, quatScene);
      isSyncingViews = false;
    });
    quatScene.controls.addEventListener('change', () => {
      if (!viewsSynced || isSyncingViews) return;
      isSyncingViews = true;
      copyCamera(quatScene, eulerScene);
      isSyncingViews = false;
    });
  }

  // =====================================================================
  // 9. WIRING
  // =====================================================================

  function setMode(newMode) {
    mode = newMode;
    const isManual = mode === 'manual';

    document.getElementById('btn-mode-animate').classList.toggle('active', !isManual);
    document.getElementById('btn-mode-manual').classList.toggle('active', isManual);

    document.getElementById('manual-controls').classList.toggle('readonly', !isManual);

    [
      'slider-roll', 'slider-pitch', 'slider-yaw',
      'slider-axis-x', 'slider-axis-y', 'slider-axis-z', 'slider-angle',
    ].forEach((id) => {
      document.getElementById(id).disabled = !isManual;
    });
    document.getElementById('btn-reset').disabled = !isManual;
    document.getElementById('btn-sync-values').disabled = !isManual;

    if (!isManual) {
      animStartTime = null; // restart the animation clock
    } else {
      // Lock both panels exactly where the (already-synced) sliders show,
      // so there's no jump when leaving Animate mode.
      eulerSlidersChanged();
      quatSlidersChanged();
    }
  }

  function init() {
    eulerScene = createScene('canvas-euler');
    quatScene = createScene('canvas-quat');

    eulerObj = createOrientableObject(0x5eb3ff);
    quatObj = createOrientableObject(0xff9d5e);
    eulerScene.scene.add(eulerObj);
    quatScene.scene.add(quatObj);

    linkCameraControls();

    document.getElementById('btn-mode-animate').addEventListener('click', () => setMode('animate'));
    document.getElementById('btn-mode-manual').addEventListener('click', () => setMode('manual'));
    document.getElementById('btn-reset').addEventListener('click', resetManualControls);
    document.getElementById('btn-sync-values').addEventListener('click', () => setValuesSynced(!valuesSynced));
    document.getElementById('btn-sync-views').addEventListener('click', () => setViewsSynced(!viewsSynced));

    ['slider-roll', 'slider-pitch', 'slider-yaw'].forEach((id) => {
      document.getElementById(id).addEventListener('input', eulerSlidersChanged);
    });
    ['slider-axis-x', 'slider-axis-y', 'slider-axis-z', 'slider-angle'].forEach((id) => {
      document.getElementById(id).addEventListener('input', quatSlidersChanged);
    });

    setMode('animate'); // establishes correct disabled/readonly state on load

    function frame(now) {
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