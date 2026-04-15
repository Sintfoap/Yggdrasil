import * as THREE from 'three';

// setupControls wires pointer/mouse interactions and exposes moveCameraToSection
// ctx: { canvas, planets, cameraAnim, cameraBase, cameraTarget, cameraFollowOffset, appState, snapToSection }
export function setupControls(ctx) {
  const { canvas, planets, camera, cameraAnim, cameraBase, cameraTarget, cameraFollowOffset, appState, snapToSection } = ctx;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function findPlanetFromObject(obj) {
    while (obj) {
      if (planets.includes(obj)) return obj;
      obj = obj.parent;
    }
    return null;
  }

  function computeCameraFocusForIndex(idx) {
    if (idx === 0) {
      return {
        base: new THREE.Vector3(9, 0, 10),
        target: new THREE.Vector3(-1.4, 0, 0)
      };
    }
    const planet = planets[idx - 1];
    if (!planet) return null;
    const worldPos = new THREE.Vector3();
    planet.getWorldPosition(worldPos);
    const offset = new THREE.Vector3(0, 1.2, 2.8);
    const base = worldPos.clone().add(offset);
    const target = worldPos.clone();
    return { base, target };
  }

  function moveCameraToSection(idx) {
    const focus = computeCameraFocusForIndex(idx);
    if (!focus) return;
    cameraAnim.active = true;
    cameraAnim.startTime = performance.now();
    cameraAnim.duration = 700;
    cameraAnim.fromBase.copy(cameraBase);
    cameraAnim.fromTarget.copy(cameraTarget);
    cameraAnim.toBase.copy(focus.base);
    cameraAnim.toTarget.copy(focus.target);
    if (idx === 0) {
      cameraAnim.followOnComplete = null;
      appState.cameraFollow = null;
    } else {
      cameraAnim.followOnComplete = planets[idx - 1] || null;
    }
  }

  function onPointerDown(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = - ((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(planets, true);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const planet = findPlanetFromObject(hit);
      if (planet) {
        // if this planet was designated as Muspelheim, redirect to its dedicated page
        try {
          if (planet.userData && planet.userData.realmName === 'Muspelheim') {
            // prefer a client-side view toggle when available (avoids loading a separate HTML file on hosts
            // that restrict module/text fetches). Try `window.showMuspelheim`, then directly toggle the
            // embedded DOM node if present, and only then fall back to a full navigation.
            try {
              if (typeof window.showMuspelheim === 'function') {
                window.showMuspelheim();
                return;
              }
              // if the embedded muspelheim screen exists in the DOM, show it directly
              try {
                const mus = (typeof document !== 'undefined') ? document.getElementById('muspelheim-screen') : null;
                const uiEl = (typeof document !== 'undefined') ? document.getElementById('ui') : null;
                if (mus) {
                  mus.classList.remove('hidden');
                  mus.setAttribute('aria-hidden', 'false');
                  if (uiEl) uiEl.style.display = 'none';
                  try { history.pushState({ view: 'muspelheim' }, '', '/muspelheim.html'); } catch (e) { }
                  return;
                }
              } catch (e) { /* ignore DOM toggling errors */ }
            } catch (e) { /* ignore */ }
            // fallback to an absolute navigation
            window.location.href = '/muspelheim.html';
            return;
          }
        } catch (err) { }

        if (appState.cameraFollow === planet) {
          try { if (snapToSection) snapToSection(0); } catch (err) { }
          try { moveCameraToSection(0); } catch (err) { }
          return;
        }
        const idx = planets.indexOf(planet);
        const sectionIndex = idx + 1;
        try { if (snapToSection) snapToSection(sectionIndex); } catch (err) { }
        try { moveCameraToSection(sectionIndex); } catch (err) { }
      }
    }
  }

  function onMouseMove(e) {
    appState.targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    appState.targetMouse.y = - (e.clientY / window.innerHeight) * 2 + 1;
  }

  canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('mousemove', onMouseMove);

  // expose to global UI hooks similar to previous behavior
  window.moveCameraToSection = moveCameraToSection;

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('mousemove', onMouseMove);
      if (window.moveCameraToSection === moveCameraToSection) delete window.moveCameraToSection;
    }
  };
}

export default { setupControls };
