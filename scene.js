/* ─────────────────────────────────────────────────────────
   scene.js  –  Three.js r128 background
   ───────────────────────────────────────────────────────── */

(function () {
  // ── Setup ────────────────────────────────────────────────
  const canvas   = document.getElementById('bg');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 30);

  // ── Fog ──────────────────────────────────────────────────
  scene.fog = new THREE.FogExp2(0x050508, 0.025);

  // ── Lights ───────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambient);

  const pointA = new THREE.PointLight(0xc8f542, 4, 60);
  pointA.position.set(10, 10, 10);
  scene.add(pointA);

  const pointB = new THREE.PointLight(0x42f5c8, 3, 50);
  pointB.position.set(-15, -8, 5);
  scene.add(pointB);

  // ── Icosahedron (hero centrepiece) ───────────────────────
  const icoGeo = new THREE.IcosahedronGeometry(6, 1);
  const icoMat = new THREE.MeshStandardMaterial({
    color:       0x1a1a2e,
    emissive:    0x0a0a18,
    roughness:   0.3,
    metalness:   0.9,
    wireframe:   false,
  });
  const ico = new THREE.Mesh(icoGeo, icoMat);
  ico.position.set(14, 0, -5);
  scene.add(ico);

  // Wireframe overlay on icosahedron
  const icoWire = new THREE.Mesh(
    icoGeo,
    new THREE.MeshBasicMaterial({ color: 0xc8f542, wireframe: true, opacity: 0.15, transparent: true })
  );
  ico.add(icoWire);

  // ── Torus (ring accent) ───────────────────────────────────
  const torusGeo = new THREE.TorusGeometry(9, 0.25, 16, 80);
  const torusMat = new THREE.MeshStandardMaterial({
    color:    0x42f5c8,
    emissive: 0x10403a,
    roughness: 0.2,
    metalness: 1.0,
  });
  const torus = new THREE.Mesh(torusGeo, torusMat);
  torus.rotation.x = Math.PI / 3;
  torus.position.set(-10, 2, -10);
  scene.add(torus);

  // ── Floating particles ────────────────────────────────────
  const PARTICLE_COUNT = 600;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 120;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
  }
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const partMat = new THREE.PointsMaterial({
    color:       0xc8f542,
    size:        0.18,
    sizeAttenuation: true,
    transparent: true,
    opacity:     0.55,
  });
  scene.add(new THREE.Points(partGeo, partMat));

  // ── Small floating cubes ──────────────────────────────────
  const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
  const cubes   = [];
  for (let i = 0; i < 18; i++) {
    const mat  = new THREE.MeshStandardMaterial({
      color:    i % 2 === 0 ? 0xc8f542 : 0x42f5c8,
      roughness: 0.4,
      metalness: 0.8,
      transparent: true,
      opacity:   0.7,
    });
    const mesh = new THREE.Mesh(cubeGeo, mat);
    const r    = 5 + Math.random() * 25;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI;
    mesh.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    mesh.scale.setScalar(0.3 + Math.random() * 0.8);
    mesh._speed  = 0.003 + Math.random() * 0.006;
    mesh._offset = Math.random() * Math.PI * 2;
    scene.add(mesh);
    cubes.push(mesh);
  }

  // ── Mouse parallax ────────────────────────────────────────
  const mouse  = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };

  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ── Scroll parallax ───────────────────────────────────────
  let scrollY = 0;
  window.addEventListener('scroll', () => { scrollY = window.scrollY; });

  // ── Resize handler ────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Animation loop ────────────────────────────────────────
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Smooth mouse parallax
    target.x += (mouse.x - target.x) * 0.04;
    target.y += (mouse.y - target.y) * 0.04;

    camera.position.x = target.x * 4;
    camera.position.y = -target.y * 2 - scrollY * 0.012;
    camera.lookAt(0, -scrollY * 0.012, 0);

    // Icosahedron rotation
    ico.rotation.x = t * 0.18;
    ico.rotation.y = t * 0.12;

    // Torus rotation
    torus.rotation.z = t * 0.09;
    torus.rotation.y = t * 0.05;

    // Light orbiting
    pointA.position.x = Math.sin(t * 0.4) * 15;
    pointA.position.z = Math.cos(t * 0.4) * 15;
    pointB.position.x = Math.cos(t * 0.3) * 12;
    pointB.position.z = Math.sin(t * 0.3) * 12;

    // Floating cubes
    cubes.forEach((c) => {
      c.rotation.x += c._speed;
      c.rotation.y += c._speed * 0.7;
      c.position.y += Math.sin(t * c._speed * 30 + c._offset) * 0.005;
    });

    renderer.render(scene, camera);
  }

  animate();
})();
