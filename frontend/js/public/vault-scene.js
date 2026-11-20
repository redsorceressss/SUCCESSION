import * as THREE from '../../assets/public/three.module.js';

export function createVaultExperience(container, opts = {}) {
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    disposed: false,
    unlocked: false,
    opening: 0, // 0..1
    dialAngle: 0,
    dialProgress: 0,
    dragging: false,
    lastPointerAngle: 0,
    skipRequested: false,
    introT: 0,
    ready: false,
  };

  const callbacks = {
    onUnlock: typeof opts.onUnlock === 'function' ? opts.onUnlock : () => {},
    onOpened: typeof opts.onOpened === 'function' ? opts.onOpened : () => {},
  };

  let renderer, scene, camera, frameId;
  let doorGroup, dialGroup, pointerMesh, lockRing, lightSweep, keyLight, rimLight;
  let fallbackNeeded = false;

  function canUseWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch {
      return false;
    }
  }

  function dispose() {
    state.disposed = true;
    if (frameId) cancelAnimationFrame(frameId);
    window.removeEventListener('resize', onResize);
    container.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    if (scene) {
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    }
  }

  function onResize() {
    if (!renderer || !camera || !container) return;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  function addBolt(group, radius, angle, size = 0.08, depth = 0.12) {
    const geo = new THREE.CylinderGeometry(size, size, depth, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0xbfa15e, metalness: 0.95, roughness: 0.25 });
    const bolt = new THREE.Mesh(geo, mat);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.28);
    group.add(bolt);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.7, size * 0.7, depth * 0.35, 6), mat);
    head.rotation.x = Math.PI / 2;
    head.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.36);
    group.add(head);
  }

  function buildScene() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050607, 0.08);

    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.1, 7.2);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x9fb0c2, 0.22);
    scene.add(ambient);

    keyLight = new THREE.DirectionalLight(0xfff2d9, 2.2);
    keyLight.position.set(3.5, 2.5, 5);
    scene.add(keyLight);

    rimLight = new THREE.DirectionalLight(0x8fb4ff, 0.7);
    rimLight.position.set(-4, 1.5, 2);
    scene.add(rimLight);

    lightSweep = new THREE.SpotLight(0xd6b46a, 0.0, 20, Math.PI / 8, 0.45, 1.2);
    lightSweep.position.set(-4, 2, 6);
    lightSweep.target.position.set(0, 0, 0);
    scene.add(lightSweep);
    scene.add(lightSweep.target);

    const backPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 10),
      new THREE.MeshStandardMaterial({ color: 0x07090c, metalness: 0.2, roughness: 0.95 })
    );
    backPlate.position.set(0, 0, -1.4);
    scene.add(backPlate);

    // Inner vault chamber (revealed on open)
    const chamber = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.15, 1.2, 64, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x1a1f25, metalness: 0.5, roughness: 0.6, side: THREE.BackSide })
    );
    chamber.rotation.x = Math.PI / 2;
    chamber.position.set(0, 0, -0.5);
    scene.add(chamber);
    const chamberGlow = new THREE.PointLight(0xd6b46a, 0.0, 8, 2);
    chamberGlow.position.set(0, 0, -0.2);
    scene.add(chamberGlow);
    state.chamberGlow = chamberGlow;

    doorGroup = new THREE.Group();
    scene.add(doorGroup);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x3a434d, metalness: 0.92, roughness: 0.32 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x232a32, metalness: 0.85, roughness: 0.38 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xb9924a, metalness: 0.96, roughness: 0.22, emissive: 0x241a08, emissiveIntensity: 0.08 });

    const baseDoor = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 0.42, 96), steelMat);
    baseDoor.rotation.x = Math.PI / 2;
    doorGroup.add(baseDoor);

    const ringSpecs = [
      { r: 2.25, t: 0.08, z: 0.22, mat: brassMat },
      { r: 1.95, t: 0.1, z: 0.24, mat: darkSteel },
      { r: 1.65, t: 0.08, z: 0.25, mat: steelMat },
      { r: 1.35, t: 0.07, z: 0.26, mat: brassMat },
    ];
    ringSpecs.forEach((rs) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rs.r, rs.t, 24, 120), rs.mat);
      ring.position.z = rs.z;
      doorGroup.add(ring);
    });

    // Bolts
    for (let i = 0; i < 12; i++) {
      addBolt(doorGroup, 2.15, (i / 12) * Math.PI * 2, 0.075, 0.1);
    }
    for (let i = 0; i < 8; i++) {
      addBolt(doorGroup, 1.52, (i / 8) * Math.PI * 2 + Math.PI / 8, 0.055, 0.08);
    }

    // Handle / locking bars
    const handleGroup = new THREE.Group();
    handleGroup.position.z = 0.32;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 24), brassMat);
    hub.rotation.x = Math.PI / 2;
    handleGroup.add(hub);
    for (let i = 0; i < 3; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.1), brassMat);
      const a = (i / 3) * Math.PI * 2;
      bar.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0);
      bar.rotation.z = a;
      handleGroup.add(bar);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), brassMat);
      cap.position.set(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0);
      handleGroup.add(cap);
    }
    doorGroup.add(handleGroup);
    state.handleGroup = handleGroup;

    // Dial assembly
    dialGroup = new THREE.Group();
    dialGroup.position.set(0, -0.15, 0.38);
    doorGroup.add(dialGroup);

    const dialBase = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 64), darkSteel);
    dialBase.rotation.x = Math.PI / 2;
    dialGroup.add(dialBase);
    const dialFace = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.08, 64), brassMat);
    dialFace.rotation.x = Math.PI / 2;
    dialFace.position.z = 0.04;
    dialGroup.add(dialFace);
    const dialInner = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 32), steelMat);
    dialInner.rotation.x = Math.PI / 2;
    dialInner.position.z = 0.08;
    dialGroup.add(dialInner);

    // Dial ticks
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(major ? 0.03 : 0.015, major ? 0.12 : 0.07, 0.02),
        new THREE.MeshStandardMaterial({ color: major ? 0xf3ede2 : 0xd6b46a, metalness: 0.4, roughness: 0.4 })
      );
      const a = (i / 60) * Math.PI * 2;
      const r = 0.43;
      tick.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.09);
      tick.rotation.z = a;
      dialGroup.add(tick);
    }

    // Pointer (fixed to door, indicates dial position)
    pointerMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0xf3ede2, metalness: 0.5, roughness: 0.25, emissive: 0x33250e, emissiveIntensity: 0.15 })
    );
    pointerMesh.position.set(0, 0.52, 0.46);
    pointerMesh.rotation.z = Math.PI;
    doorGroup.add(pointerMesh);

    lockRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.025, 12, 80),
      new THREE.MeshStandardMaterial({ color: 0x5f6770, metalness: 0.8, roughness: 0.35, emissive: 0xd6b46a, emissiveIntensity: 0.0 })
    );
    lockRing.position.set(0, -0.15, 0.33);
    doorGroup.add(lockRing);

    // Subtle brand plate
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.18, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x1e2329, metalness: 0.7, roughness: 0.35 })
    );
    plate.position.set(0, 0.95, 0.31);
    doorGroup.add(plate);

    // Door hinge pivot approximation: rotate around left edge for opening feel
    doorGroup.position.x = 0;

    onResize();
    state.ready = true;
  }

  function getPointerAngle(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    // focus around dial center region (approx lower-center of door)
    const cx = 0.5, cy = 0.54;
    return Math.atan2(y - cy, x - cx);
  }

  function onPointerDown(e) {
    if (!state.ready || state.unlocked) return;
    state.dragging = true;
    state.lastPointerAngle = getPointerAngle(e);
    if (renderer?.domElement?.setPointerCapture) {
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch {}
    }
  }
  function onPointerMove(e) {
    if (!state.dragging || state.unlocked) return;
    const a = getPointerAngle(e);
    let delta = a - state.lastPointerAngle;
    // normalize
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    state.lastPointerAngle = a;
    state.dialAngle += delta;
    // progress based on absolute rotation accumulated
    state.dialProgress = Math.min(1, state.dialProgress + Math.abs(delta) / (Math.PI * 3.2));
    if (state.dialProgress >= 1) {
      unlock();
    }
  }
  function onPointerUp() { state.dragging = false; }

  function unlock() {
    if (state.unlocked) return;
    state.unlocked = true;
    state.dragging = false;
    callbacks.onUnlock();
  }

  function rotateDial(deltaRadians) {
    if (!state.ready || state.unlocked) return;
    const delta = Number(deltaRadians) || 0;
    state.dialAngle += delta;
    state.dialProgress = Math.min(1, state.dialProgress + Math.abs(delta) / (Math.PI * 3.2));
    if (state.dialProgress >= 1) {
      unlock();
    }
  }

  function activateDial() {
    if (!state.ready) return;
    if (state.unlocked) return;
    // Keyboard activation unlocks/engages the mechanism directly (accessible alternative to drag)
    state.dialProgress = 1;
    unlock();
  }

  function skipIntro() {
    state.skipRequested = true;
    state.introT = 1;
    state.dialProgress = 1;
    if (!state.unlocked) unlock();
    state.opening = 1;
  }

  function animate(t) {
    if (state.disposed) return;
    frameId = requestAnimationFrame(animate);
    const time = t * 0.001;

    if (!reducedMotion) {
      state.introT = Math.min(1, state.introT + 0.0035 + (state.skipRequested ? 0.05 : 0));
    } else {
      state.introT = 1;
    }

    // Intro choreography: camera/light sweep
    const intro = state.introT;
    camera.position.z = 8.6 - intro * 1.4 + state.opening * 0.8;
    camera.position.y = 0.25 - intro * 0.15;
    camera.lookAt(0, 0, 0);

    if (lightSweep) {
      lightSweep.intensity = (intro > 0.2 && intro < 0.95) ? (1.2 * Math.sin((intro - 0.2) / 0.75 * Math.PI)) : 0.0;
      lightSweep.position.x = -4 + intro * 8;
    }
    if (keyLight) keyLight.intensity = 0.4 + intro * 1.8;
    if (rimLight) rimLight.intensity = 0.15 + intro * 0.55;

    if (dialGroup) {
      dialGroup.rotation.z = state.dialAngle;
    }
    if (lockRing) {
      lockRing.material.emissiveIntensity = 0.05 + state.dialProgress * 1.2 + (state.unlocked ? 0.6 : 0);
      lockRing.material.color.setHex(state.unlocked ? 0xd6b46a : 0x5f6770);
    }
    if (state.handleGroup) {
      state.handleGroup.rotation.z = state.unlocked ? Math.min(0.5, state.handleGroup.rotation.z + 0.02) : 0;
    }

    // Open door after unlock
    if (state.unlocked) {
      const target = 1;
      const speed = reducedMotion ? 1 : 0.012;
      const prev = state.opening;
      state.opening = Math.min(target, state.opening + speed + (state.skipRequested ? 0.08 : 0));
      if (doorGroup) {
        // swing open around left hinge area
        doorGroup.rotation.y = -state.opening * 1.25;
        doorGroup.position.x = -state.opening * 1.05;
        doorGroup.position.z = state.opening * 0.15;
      }
      if (state.chamberGlow) {
        state.chamberGlow.intensity = state.opening * 2.2;
      }
      if (prev < 1 && state.opening >= 1) {
        callbacks.onOpened();
      }
    } else if (doorGroup) {
      // subtle breathing before unlock
      if (!reducedMotion) {
        doorGroup.position.y = Math.sin(time * 0.8) * 0.01;
      }
    }

    renderer.render(scene, camera);
  }

  if (!canUseWebGL()) {
    fallbackNeeded = true;
    // Minimal animate loop not needed; but provide state progression hooks for keyboard/fallback UI
    return {
      fallbackNeeded: true,
      getState: () => ({ ...state, fallbackNeeded: true }),
      skipIntro: () => { state.skipRequested = true; state.introT = 1; state.dialProgress = 1; unlock(); state.opening = 1; callbacks.onOpened(); },
      unlock,
      rotateDial,
      activateDial: () => { state.dialProgress = 1; unlock(); state.opening = 1; callbacks.onOpened(); },
      dispose,
    };
  }

  buildScene();
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('role', 'slider');
  renderer.domElement.setAttribute('aria-label', 'SUCCESSION vault combination dial');
  renderer.domElement.setAttribute('aria-describedby', 'vault-dial-instructions');
  renderer.domElement.setAttribute('aria-valuemin', '0');
  renderer.domElement.setAttribute('aria-valuemax', '100');
  renderer.domElement.setAttribute('aria-valuenow', '0');
  renderer.domElement.setAttribute('aria-valuetext', 'Locked, 0 percent rotated');
  container.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('resize', onResize);

  // Keep ARIA progress in sync
  const ariaSync = setInterval(() => {
    if (state.disposed || !renderer?.domElement) return;
    const pct = Math.round(Math.min(1, state.dialProgress) * 100);
    renderer.domElement.setAttribute('aria-valuenow', String(pct));
    renderer.domElement.setAttribute('aria-valuetext', `${state.unlocked ? 'Unlocked' : 'Locked'}, ${pct} percent rotated`);
  }, 200);

  const origDispose = dispose;
  function disposeWithAria() {
    clearInterval(ariaSync);
    origDispose();
  }

  frameId = requestAnimationFrame(animate);

  return {
    fallbackNeeded: false,
    getState: () => ({ ...state, fallbackNeeded: false }),
    skipIntro,
    unlock,
    rotateDial,
    activateDial,
    dispose: disposeWithAria,
  };
}