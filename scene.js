/* ─────────────────────────────────────────────────────────
   scene.js  –  Ethereal Electric Tree  (Three.js r128)
   ───────────────────────────────────────────────────────── */

(function () {

  /* ── Renderer ──────────────────────────────────────────── */
  const canvas   = document.getElementById('bg');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 8, 42);
  camera.lookAt(0, 10, 0);

  /* ── Fog ───────────────────────────────────────────────── */
  scene.fog = new THREE.FogExp2(0x00030a, 0.018);

  /* ── Ambient glow ──────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0x061525, 1.0));

  const glowLight = new THREE.PointLight(0x44aaff, 3, 80);
  glowLight.position.set(0, 20, 0);
  scene.add(glowLight);

  /* ═══════════════════════════════════════════════════════
     TREE GENERATION
  ═══════════════════════════════════════════════════════ */

  const BRANCH_COLOR   = 0x5cf0ff;
  const BRANCH_OPACITY = 0.18;
  const MAX_DEPTH      = 7;

  const branchSegments = [];

  function addBranch(start, direction, length, depth) {
    if (depth > MAX_DEPTH || length < 0.3) return;

    const end = start.clone().addScaledVector(direction, length);
    branchSegments.push({ start: start.clone(), end: end.clone(), depth });

    const childCount  = depth < 2 ? 3 : depth < 4 ? 3 : 2;
    const spread      = 0.55 - depth * 0.04;
    const lengthScale = 0.68 - depth * 0.01;

    for (let i = 0; i < childCount; i++) {
      const axis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.4,
        Math.random() - 0.5
      ).normalize();

      const angle    = spread * (0.6 + Math.random() * 0.8);
      const childDir = direction.clone()
        .applyAxisAngle(axis, (Math.random() - 0.5) * angle * 2)
        .normalize();

      childDir.y = Math.abs(childDir.y) * 0.5 + 0.3;
      childDir.normalize();

      addBranch(end, childDir, length * lengthScale, depth + 1);
    }
  }

  addBranch(
    new THREE.Vector3(0, -12, 0),
    new THREE.Vector3(0, 1, 0),
    9,
    0
  );

  /* ── Build branch lines ────────────────────────────────── */
  const branchMeshes = [];

  branchSegments.forEach((seg) => {
    const geo = new THREE.BufferGeometry().setFromPoints([seg.start, seg.end]);
    const depthRatio = seg.depth / MAX_DEPTH;

    const mat = new THREE.LineBasicMaterial({
      color:       BRANCH_COLOR,
      transparent: true,
      opacity:     BRANCH_OPACITY * (1 - depthRatio * 0.5),
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    const line = new THREE.Line(geo, mat);
    scene.add(line);
    branchMeshes.push({ line, mat, seg, depthRatio });
  });

  /* ═══════════════════════════════════════════════════════
     CHILD MAP
  ═══════════════════════════════════════════════════════ */

  function buildChildMap() {
    const map = new Map();
    branchSegments.forEach((seg, i) => {
      const children = [];
      branchSegments.forEach((other, j) => {
        if (i !== j && seg.end.distanceToSquared(other.start) < 0.01) {
          children.push(j);
        }
      });
      map.set(i, children);
    });
    return map;
  }
  const childMap = buildChildMap();

  const rootSegments = branchSegments
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.depth === 0)
    .map(({ i }) => i);

  /* ═══════════════════════════════════════════════════════
     ELECTRICITY PULSES
  ═══════════════════════════════════════════════════════ */

  const pulseGeo = new THREE.SphereGeometry(0.12, 6, 6);

  const POOL_SIZE = 120;
  const pulsePool = [];

  for (let i = 0; i < POOL_SIZE; i++) {
    const mesh = new THREE.Mesh(
      pulseGeo,
      new THREE.MeshBasicMaterial({
        color:       0xaaeeff,
        transparent: true,
        opacity:     0.0,
        blending:    THREE.AdditiveBlending,
        depthWrite:  false,
      })
    );
    mesh.visible = false;
    scene.add(mesh);
    pulsePool.push({
      mesh,
      active:   false,
      segIndex: -1,
      t:        0,
      speed:    0,
    });
  }

  function getFreePulse() {
    return pulsePool.find(p => !p.active) || null;
  }

  function spawnPulse(segIndex, t) {
    t = t || 0;
    const p = getFreePulse();
    if (!p) return;
    const seg = branchSegments[segIndex];
    p.active   = true;
    p.segIndex = segIndex;
    p.t        = t;
    p.speed    = 0.4 + Math.random() * 0.5 + seg.depth * 0.08;
    p.mesh.material.opacity = 0;
    p.mesh.visible = true;
  }

  function triggerRootPulse() {
    rootSegments.forEach(function(idx) { spawnPulse(idx, 0); });
  }
  triggerRootPulse();

  let nextRootPulse = 1.2;

  /* ═══════════════════════════════════════════════════════
     FLOATING SPORE PARTICLES
  ═══════════════════════════════════════════════════════ */

  const SPORE_COUNT    = 300;
  const sporePositions = new Float32Array(SPORE_COUNT * 3);
  const sporeSeeds     = new Float32Array(SPORE_COUNT);

  for (let i = 0; i < SPORE_COUNT; i++) {
    const r     = 5 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI;
    sporePositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    sporePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) + 6;
    sporePositions[i * 3 + 2] = r * Math.cos(phi) - 5;
    sporeSeeds[i] = Math.random() * Math.PI * 2;
  }

  const sporeGeo = new THREE.BufferGeometry();
  sporeGeo.setAttribute('position', new THREE.BufferAttribute(sporePositions.slice(), 3));

  const sporeMat = new THREE.PointsMaterial({
    color:           0x88ddff,
    size:            0.14,
    sizeAttenuation: true,
    transparent:     true,
    opacity:         0.5,
    blending:        THREE.AdditiveBlending,
    depthWrite:      false,
  });

  scene.add(new THREE.Points(sporeGeo, sporeMat));
  const sporeBasePos = sporePositions.slice();

  /* ── Mouse / scroll ────────────────────────────────────── */
  const mouse  = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };

  window.addEventListener('mousemove', function(e) {
    mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  let scrollY = 0;
  window.addEventListener('scroll', function() { scrollY = window.scrollY; });

  window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ── Animation loop ────────────────────────────────────── */
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    /* Smooth mouse parallax */
    smooth.x += (mouse.x - smooth.x) * 0.03;
    smooth.y += (mouse.y - smooth.y) * 0.03;

    camera.position.x = smooth.x * 5;
    camera.position.y = 8 - smooth.y * 3 - scrollY * 0.01;
    camera.lookAt(0, 10 - scrollY * 0.01, 0);

    /* Pulsing ambient light */
    glowLight.intensity = 2.5 + Math.sin(t * 1.3) * 0.8;

    /* Branch shimmer */
    branchMeshes.forEach(function(b) {
      const wave = Math.sin(t * 2.1 + b.seg.start.x * 0.4 + b.seg.start.y * 0.3) * 0.5 + 0.5;
      b.mat.opacity = BRANCH_OPACITY * (1 - b.depthRatio * 0.5) * (0.7 + wave * 0.5);
    });

    /* Spawn root pulses periodically */
    if (t > nextRootPulse) {
      triggerRootPulse();
      nextRootPulse = t + 0.8 + Math.random() * 1.0;
    }

    /* Advance pulses */
    pulsePool.forEach(function(p) {
      if (!p.active) return;

      p.t += 0.016 * p.speed;

      if (p.t >= 1.0) {
        var children = childMap.get(p.segIndex) || [];
        children.forEach(function(ci) {
          if (Math.random() > 0.15) spawnPulse(ci, 0);
        });
        p.active = false;
        p.mesh.visible = false;
        p.mesh.material.opacity = 0;
        return;
      }

      var seg = branchSegments[p.segIndex];
      var pos = seg.start.clone().lerp(seg.end, p.t);
      p.mesh.position.copy(pos);

      var fade = Math.sin(p.t * Math.PI);
      p.mesh.material.opacity = fade * (0.9 - seg.depth * 0.09);
      p.mesh.scale.setScalar(0.8 + fade * 0.8);
    });

    /* Drift spores */
    var posAttr = sporeGeo.getAttribute('position');
    for (var i = 0; i < SPORE_COUNT; i++) {
      var seed = sporeSeeds[i];
      posAttr.setX(i, sporeBasePos[i * 3]     + Math.cos(t * 0.3 + seed) * 0.4);
      posAttr.setY(i, sporeBasePos[i * 3 + 1] + Math.sin(t * 0.4 + seed) * 0.6);
    }
    posAttr.needsUpdate = true;

    renderer.render(scene, camera);
  }

  animate();

})();
