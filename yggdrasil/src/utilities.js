import * as THREE from 'three';

export function makeSphere(radius, color, x, y, z, scene, opts = {}) {
  const wSeg = opts.widthSegments || 48;
  const hSeg = opts.heightSegments || 48;
  const geometry = new THREE.SphereGeometry(radius, wSeg, hSeg);
  const matOpts = Object.assign({ color: color }, opts.materialOptions || {});
  if (matOpts.metalness === undefined) matOpts.metalness = 0.15;
  if (matOpts.roughness === undefined) matOpts.roughness = 0.6;

  // generate a subtle procedural color map and bump map for extra detail
  function hexToCss(h) {
    if (typeof h === 'string') return h;
    const v = h.toString(16).padStart(6, '0');
    return `#${v}`;
  }
  const baseColor = hexToCss(color);
  // color texture
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  // radial gradient
  const grad = ctx.createRadialGradient(size * 0.35, size * 0.35, size * 0.1, size / 2, size / 2, size * 0.95);
  grad.addColorStop(0, baseColor);
  // slightly darker edge
  grad.addColorStop(1, '#020205');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // equatorial bands
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = '#ffffff';
    const y = size * (0.35 + 0.08 * Math.sin(i * 1.3));
    ctx.fillRect(0, y + (i % 2 ? -6 : 6), size, 6 + Math.random() * 4);
  }
  // subtle noise blotches
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle = '#ffffff';
    const rx = Math.random() * size;
    const ry = Math.random() * size;
    const rw = 1 + Math.random() * 2;
    const rh = 1 + Math.random() * 2;
    ctx.fillRect(rx, ry, rw, rh);
  }
  ctx.globalAlpha = 1.0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;

  // bump map (grayscale noise)
  const bCanvas = document.createElement('canvas');
  bCanvas.width = bCanvas.height = 256;
  const bCtx = bCanvas.getContext('2d');
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    const v = Math.floor(180 + Math.random() * 90);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    const rx = Math.random() * 256;
    const ry = Math.random() * 256;
    const rw = 1 + Math.random() * 2;
    const rh = 1 + Math.random() * 2;
    bCtx.fillRect(rx, ry, rw, rh);
  }
  const bumpTex = new THREE.CanvasTexture(bCanvas);
  bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;

  // build material and assign generated maps unless user passed explicit maps
  if (!matOpts.map && !opts.skipAutoMap) matOpts.map = tex;
  const material = new THREE.MeshStandardMaterial(matOpts);
  if (!matOpts.bumpMap) {
    material.bumpMap = bumpTex;
    material.bumpScale = (typeof opts.bumpScale !== 'undefined') ? opts.bumpScale : 0.02;
  }

  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(x, y, z);
  sphere.userData = { opts };
  scene.add(sphere);

  // optional decorative ring
    if (opts.ring) {
      const offset = opts.ringOffset || 0.6;
      const thickness = opts.ringThickness || 0.08;
      const inner = radius + offset - thickness * 0.5;
      const outer = inner + thickness * 1.6;
      const ringGeo = new THREE.RingGeometry(inner, outer, 128);
      const ringMat = new THREE.MeshStandardMaterial({ color: opts.ringColor || 0x999999, metalness: 0.6, roughness: 0.4, transparent: true, opacity: opts.ringOpacity || 0.9, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      const rotX = (typeof opts.ringRotationX !== 'undefined') ? opts.ringRotationX : Math.PI / 2;
      const rotZ = opts.ringRotationZ || 0;
      ring.rotation.x = rotX;
      ring.rotation.z = rotZ;
      ring.position.set(0, 0, 0);
      sphere.add(ring);
      sphere.userData._ring = ring;
    }

  return sphere;
}


export function updateOrbits(worlds, orbitSpeed) {
  worlds.Asgard.rotation.y += orbitSpeed * 50;
  worlds.Niflheim.rotation.y -= orbitSpeed * 50;

  worlds.Midgard.rotation.y += orbitSpeed * 10;
  worlds.Midgard.rotation.x += orbitSpeed * 10;
  worlds.Midgard.rotation.z += orbitSpeed * 10;

  worlds.Alfheim.position.x = 6 * Math.cos(Date.now() * orbitSpeed - 7);
  worlds.Alfheim.position.z = 6 * Math.sin(Date.now() * orbitSpeed - 7);
  worlds.Jotunheim.position.x = -6 * Math.cos(Date.now() * orbitSpeed - 7);
  worlds.Jotunheim.position.z = -6 * Math.sin(Date.now() * orbitSpeed - 7);

  worlds.Vanaheim.position.x = -4 * Math.cos(Date.now() * orbitSpeed);
  worlds.Vanaheim.position.y = 4 * Math.cos(Date.now() * orbitSpeed);
  worlds.Vanaheim.position.z = 4 * Math.sin(Date.now() * orbitSpeed);
  worlds.Muspelheim.position.x = 4 * Math.cos(Date.now() * orbitSpeed);
  worlds.Muspelheim.position.y = -4 * Math.cos(Date.now() * orbitSpeed);
  worlds.Muspelheim.position.z = -4 * Math.sin(Date.now() * orbitSpeed);

  worlds.Svartalfheim.position.x = 4 * Math.cos(Date.now() * orbitSpeed + 7);
  worlds.Svartalfheim.position.y = 4 * Math.cos(Date.now() * orbitSpeed + 7);
  worlds.Svartalfheim.position.z = 4 * Math.sin(Date.now() * orbitSpeed + 7);
  worlds.Nidavellir.position.x = -4 * Math.cos(Date.now() * orbitSpeed + 7);
  worlds.Nidavellir.position.y = -4 * Math.cos(Date.now() * orbitSpeed + 7);
  worlds.Nidavellir.position.z = -4 * Math.sin(Date.now() * orbitSpeed + 7);
}