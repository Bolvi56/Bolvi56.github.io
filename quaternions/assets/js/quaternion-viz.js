/*
  quaternion-viz.js
  -----------------
  Shared logic for the Euler vs Quaternion visualizer.
  This ONE file is used by index.html, es.html and ko.html (via quaternions.html
  + i18n) — it never changes between languages, only assets/i18n/*.json does.

  WHAT'S ALREADY DONE FOR YOU:
  - Three.js scene/camera/renderer/lights boilerplate (createScene)
  - DOM wiring skeleton (init, event listeners)
  - requestAnimationFrame loop

  WHAT YOU NEED TO FILL IN (search for "TODO"):
  1. createOrientableObject()      -> build the plane + normal arrow
  2. applyEuler()                  -> rotate an object from roll/pitch/yaw (deg)
  3. applyQuaternionAxisAngle()    -> rotate an object from axis + angle (deg)
  4. eulerToQuaternion()           -> convert euler -> {w,x,y,z} for the readout
  5. WAYPOINTS + animationLoop()   -> the auto-play sequence (lerp vs slerp)
  6. onManualControlsChanged()     -> read sliders, update both panels + readouts
*/

(function () {
  'use strict';

  // =====================================================================
  // 1. CONFIG
  // =====================================================================

  // TODO: Define 3-4 target orientations to cycle through in "Animate" mode.
  // Each waypoint should be expressed as an axis + angle (this maps directly
  // to a quaternion via setFromAxisAngle, and you'll convert it to Euler too
  // for the left panel). Make sure at least one waypoint pushes pitch close
  // to +/-90 degrees around the Y axis — that's where Euler gimbal lock shows.
  //
  // Example shape (fill in real values):
  // const WAYPOINTS = [
  //   { axis: { x: 0, y: 1, z: 0 }, angleDeg: 0   },
  //   { axis: { x: 1, y: 0, z: 0 }, angleDeg: 60  },
  //   { axis: { x: 0, y: 1, z: 0 }, angleDeg: 90  },  // <- gimbal lock zone
  //   { axis: { x: 0, y: 0, z: 1 }, angleDeg: 45  },
  // ];
  const WAYPOINTS = [
    // TODO
  ];

  const SECONDS_PER_WAYPOINT = 3;

  // =====================================================================
  // 2. SCENE SETUP (provided — you shouldn't need to touch this)
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

  // TODO: build a THREE.Group containing:
  //   - a THREE.Mesh with THREE.PlaneGeometry(2, 1.2) and a
  //     MeshStandardMaterial({ color, side: THREE.DoubleSide, transparent, opacity })
  //   - a THREE.ArrowHelper pointing along the plane's normal (0,0,1 locally),
  //     length ~1.5, so you can SEE the perpendicular direction rotate too
  // Return the group. Rotating group.quaternion (or group.rotation) later
  // will move both the plane and the arrow together, which is the whole point.
  function createOrientableObject(color) {
    // TODO
    return new THREE.Group(); // placeholder so the file still runs
  }

  // =====================================================================
  // 4. ROTATION MATH — this is the part you're here to learn
  // =====================================================================

  // TODO: rotate `object` using Euler angles given in DEGREES.
  // Hint: convert deg -> rad (THREE.MathUtils.degToRad), build a THREE.Euler
  // with an explicit, fixed order (e.g. 'XYZ') and assign it to object.rotation
  // or object.quaternion.setFromEuler(...).
  function applyEuler(object, rollDeg, pitchDeg, yawDeg) {
    // TODO
  }

  // TODO: rotate `object` using an axis-angle representation (this IS a
  // quaternion under the hood).
  // Hint: normalize the axis vector first (THREE.Vector3.normalize), then
  // object.quaternion.setFromAxisAngle(normalizedAxis, THREE.MathUtils.degToRad(angleDeg))
  function applyQuaternionAxisAngle(object, axis, angleDeg) {
    // TODO
  }

  // TODO: given current roll/pitch/yaw (deg), return the equivalent
  // quaternion as {w, x, y, z} — used to update the numeric readout under
  // the Euler panel so you can see the two representations line up.
  // Hint: new THREE.Quaternion().setFromEuler(new THREE.Euler(...))
  function eulerToQuaternion(rollDeg, pitchDeg, yawDeg) {
    // TODO
    return { w: 1, x: 0, y: 0, z: 0 };
  }

  // =====================================================================
  // 5. ANIMATE MODE — auto-play through WAYPOINTS
  // =====================================================================

  let eulerObj, quatObj;
  let eulerScene, quatScene;
  let mode = 'animate'; // 'animate' | 'manual'
  let animStartTime = null;

  // TODO: implement the waypoint-to-waypoint animation.
  // For the QUATERNION panel: build a THREE.Quaternion for the "from" and
  // "to" waypoint, and call THREE.Quaternion.slerp(from, to, out, t) each
  // frame — this is the smooth, gimbal-lock-free path.
  // For the EULER panel: convert each waypoint to roll/pitch/yaw and
  // linearly interpolate (THREE.MathUtils.lerp) each angle independently —
  // this is what most naive rotation code does, and it's what breaks down
  // near pitch = +/-90.
  // Update readouts (#readout-euler, #readout-quat) with the live numbers
  // each frame too, so the divergence is visible, not just implied.
  function stepAnimation(elapsedSeconds) {
    // TODO
  }

  // =====================================================================
  // 6. MANUAL MODE — sliders drive both panels directly
  // =====================================================================

  // TODO: read #slider-roll/pitch/yaw and #slider-axis-x/y/z/angle,
  // call applyEuler() on eulerObj and applyQuaternionAxisAngle() on quatObj,
  // then update the readouts and the <output> elements next to each slider.
  function onManualControlsChanged() {
    // TODO
  }

  // =====================================================================
  // 7. WIRING — mostly done for you
  // =====================================================================

  function setMode(newMode) {
    mode = newMode;
    document.getElementById('btn-mode-animate').classList.toggle('active', mode === 'animate');
    document.getElementById('btn-mode-manual').classList.toggle('active', mode === 'manual');
    document.getElementById('manual-controls').hidden = mode !== 'manual';
    if (mode === 'animate') animStartTime = null; // restart the clock
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
      const dt = (now - lastTime) / 1000;
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