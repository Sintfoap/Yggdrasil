import './style.css';
import { makeSphere, updateOrbits } from './utilities.js';

import * as THREE from 'three';


const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
});


const orbitSpeed = 0.0001;
// slightly smaller planets so outer decorations avoid the clock face
const realmRadius = 0.36;
// define clockOffsetX before using it
const clockOffsetX = 3.6;

const smokeParticleTex = createParticleTexture(128, 'rgba(160,140,120,0.95)', 'rgba(0,0,0,0)');
const emberParticleTex = createParticleTexture(64, 'rgba(255,180,110,0.95)', 'rgba(0,0,0,0)');
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
// base camera position (slightly left so clock sits to the right within the view)
const cameraBase = new THREE.Vector3(9, 0, 10);
const cameraTarget = new THREE.Vector3(-1.4, 0, 0);
camera.position.copy(cameraBase);
camera.rotation.set(0, 1, 0);
// add camera to scene so camera-attached children (snow) render correctly
scene.add(camera);

// camera animation state for section-based focus
const cameraAnim = {
  active: false,
  startTime: 0,
  duration: 800,
  fromBase: new THREE.Vector3(),
  toBase: new THREE.Vector3(),
  fromTarget: new THREE.Vector3(),
  toTarget: new THREE.Vector3()
};

function computeCameraFocusForIndex(idx) {
  // idx 0 => overview
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
  // place the camera slightly above and behind the planet
  const offset = new THREE.Vector3(0, 1.2, 2.8);
  const base = worldPos.clone().add(offset);
  const target = worldPos.clone();
  return { base, target };
}

// strengthen atmosphere visuals: rim glow and pulsing intensity
function strengthenAtmosphere(planet, { intensity = 1.6, rimColor = 0xaaddff } = {}) {
  if (!planet.userData) planet.userData = {};
  const atmospheres = planet.children.filter(c => c.userData && c.userData.baseOpacity !== undefined);
  atmospheres.forEach((sph) => {
    sph.material.opacity = Math.min(0.8, sph.userData.baseOpacity * intensity);
    // increase fresnel shader intensity if present
    if (sph.userData && sph.userData.fresnel && sph.userData.fresnel.material && sph.userData.fresnel.material.uniforms) {
      sph.userData.fresnel.material.uniforms.uIntensity.value = (sph.userData.fresnelBaseIntensity || 1.0) * intensity * 0.9;
      sph.userData.fresnel.material.uniforms.uColor.value.set(rimColor);
    }
    // add a rim sprite for stronger presence (fallback for non-shader atmospheres)
    if (!sph.userData.rim) {
      const rimGeo = new THREE.RingGeometry((sph.geometry.parameters.radius || 1) * 1.04, (sph.geometry.parameters.radius || 1) * 1.12, 64);
      const rimMat = new THREE.MeshBasicMaterial({ color: rimColor, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.x = Math.PI / 2;
      sph.add(rim);
      sph.userData.rim = rim;
    }
  });
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
  // if this section corresponds to a planet, request follow when animation completes
  if (idx === 0) {
    cameraAnim.followOnComplete = null;
    cameraFollow = null;
  } else {
    cameraAnim.followOnComplete = planets[idx - 1] || null;
  }
}
// expose to UI
window.moveCameraToSection = moveCameraToSection;

// --- Click-to-section: raycasting to detect planet clicks and trigger UI + camera
const raycaster = new THREE.Raycaster();
const canvas = renderer.domElement;
const pointer = new THREE.Vector2();

function findPlanetFromObject(obj) {
  while (obj) {
    if (planets.includes(obj)) return obj;
    obj = obj.parent;
  }
  return null;
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
      // If this planet is currently being followed, clicking it again returns to the overview
      if (cameraFollow === planet) {
        try { if (window.snapToSection) window.snapToSection(0); } catch (err) { }
        try { if (window.moveCameraToSection) window.moveCameraToSection(0); } catch (err) { }
        return;
      }
      const idx = planets.indexOf(planet);
      const sectionIndex = idx + 1; // UI sections: 0 = overview, 1.. = planets
      try { if (window.snapToSection) window.snapToSection(sectionIndex); } catch (err) { }
      try { if (window.moveCameraToSection) window.moveCameraToSection(sectionIndex); } catch (err) { }
    }
  }
}

canvas.addEventListener('pointerdown', onPointerDown, { passive: true });

// follow state: when set to a planet Mesh, camera will update each frame to follow it
let cameraFollow = null;
let cameraFollowOffset = new THREE.Vector3(0, 1.2, 2.8);

const Asgard = makeSphere(realmRadius, 0xffd27a, clockOffsetX, 6, 0, scene, { materialOptions: { metalness: 0.7, roughness: 0.25, emissive: 0x402200, emissiveIntensity: 0.02 } });
const Niflheim = makeSphere(realmRadius, 0x7fb7ff, clockOffsetX, -6, 0, scene, { materialOptions: { metalness: 0.05, roughness: 0.7, emissive: 0x002233, emissiveIntensity: 0.03 } });

const Midgard = makeSphere(realmRadius * 1.2, 0x3aa84f, clockOffsetX, 0, 0, scene, { materialOptions: { metalness: 0.1, roughness: 0.5 } });

const Alfheim = makeSphere(realmRadius, 0xaee6c8, 6, 0, 0, scene, { materialOptions: { metalness: 0.05, roughness: 0.6 } });
const Jotunheim = makeSphere(realmRadius, 0x9aa0ff, -6, 0, 0, scene, { materialOptions: { metalness: 0.12, roughness: 0.5 } });

const Vanaheim = makeSphere(realmRadius, 0xffcda6, -6 * Math.cos((45 * Math.PI) / 180), 7 * Math.sin((45 * Math.PI) / 180), 0, scene, { materialOptions: { metalness: 0.15, roughness: 0.45 } });
// Muspelheim slightly smaller and with a tighter ring to avoid the clock
const Muspelheim = makeSphere(realmRadius * 0.85, 0xff6b3d, 6 * Math.cos((45 * Math.PI) / 180), -7 * Math.sin((45 * Math.PI) / 180), 0, scene, { materialOptions: { metalness: 0.2, roughness: 0.35, emissive: 0x220500, emissiveIntensity: 0.08 }, ring: true, ringColor: 0xff8a5b, ringOpacity: 0.9, ringRotationX: Math.PI / 2 - 0.8, ringRotationZ: 0.4, ringOffset: 0.48, ringThickness: 0.05 });

const Svartalfheim = makeSphere(realmRadius, 0x9a9a9a, 6 * Math.cos((45 * Math.PI) / 180), 7 * Math.sin((45 * Math.PI) / 180), 0, scene, { materialOptions: { metalness: 0.6, roughness: 0.4 } });
const Nidavellir = makeSphere(realmRadius, 0xc2b280, -6 * Math.cos((45 * Math.PI) / 180), -7 * Math.sin((45 * Math.PI) / 180), 0, scene, { materialOptions: { metalness: 0.8, roughness: 0.25 } });

// decorate planets: small moons and thin rings (parented so they follow orbits)
const planets = [Asgard, Niflheim, Midgard, Alfheim, Jotunheim, Vanaheim, Muspelheim, Svartalfheim, Nidavellir];

// group to hold the planetary system so we can center it to the clock
const worldGroup = new THREE.Group();
// place the planetary group at the clock's X offset so their center matches the clock
worldGroup.position.set(clockOffsetX, 0, 0);
scene.add(worldGroup);
// reparent planets while preserving their world positions (no additional shift)
for (const p of planets) {
  const wp = new THREE.Vector3();
  p.getWorldPosition(wp);
  if (p.parent) p.parent.remove(p);
  worldGroup.add(p);
  const local = wp.clone();
  worldGroup.worldToLocal(local);
  p.position.copy(local);
}

// one-time diagnostic: log distance from each planet to the clock center (helps verify centering)
try {
  const clockPos = new THREE.Vector3();
  if (typeof clockGroup !== 'undefined') clockGroup.getWorldPosition(clockPos);
  const names = ['Asgard', 'Niflheim', 'Midgard', 'Alfheim', 'Jotunheim', 'Vanaheim', 'Muspelheim', 'Svartalfheim', 'Nidavellir'];
  planets.forEach((pl, i) => {
    const wp = new THREE.Vector3();
    pl.getWorldPosition(wp);
    const dist = wp.distanceTo(clockPos);
    console.log(names[i] + ' distance to clock center:', dist.toFixed(4));
  });
} catch (e) {
  // ignore in non-browser environments
}

// If static planets appear off-center, shift only the static subset so the
// planetary centroid matches the clock center. This avoids disturbing orbiting
// bodies that are animated elsewhere.
try {
  const clockPos = new THREE.Vector3();
  if (typeof clockGroup !== 'undefined') clockGroup.getWorldPosition(clockPos);
  else clockPos.set(clockOffsetX, 0, 0);
  // compute centroid of all planets in world space
  const centroid = new THREE.Vector3();
  for (const p of planets) { const wp = new THREE.Vector3(); p.getWorldPosition(wp); centroid.add(wp); }
  centroid.divideScalar(planets.length);
  const shift = centroid.clone().sub(clockPos); // how much centroid is offset from clock
  // apply negative shift to the static planets only
  const staticSet = new Set([Asgard, Niflheim, Midgard]);
  for (const p of planets) {
    if (!staticSet.has(p)) continue;
    const wp = new THREE.Vector3();
    p.getWorldPosition(wp);
    const targetWorld = wp.clone().sub(shift);
    // convert back to worldGroup local space and set
    worldGroup.worldToLocal(targetWorld);
    p.position.copy(targetWorld);
  }
  // log corrected distances
  for (const p of planets) {
    const wp2 = new THREE.Vector3(); p.getWorldPosition(wp2);
    const d2 = wp2.distanceTo(clockPos);
    // only log static ones to keep console concise
    if (staticSet.has(p)) console.log('corrected', p.uuid ? p.uuid : p.name, 'dist->', d2.toFixed(4));
  }
} catch (e) {
  // ignore errors in non-browser contexts
}

function addMoon(planet, { radius = 0.07, distance = 0.5, color = 0xffffff, speed = 0.001 } = {}) {
  const r = radius;
  const geom = new THREE.SphereGeometry(r, 12, 12);
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.7 });
  const moon = new THREE.Mesh(geom, mat);
  moon.position.set(distance, 0, 0);
  moon.userData = {
    angleOffset: Math.random() * Math.PI * 2,
    speed,
    orbitRadius: distance,
    inclination: (Math.random() - 0.5) * 0.9,
    yaw: Math.random() * Math.PI * 2
  };
  planet.add(moon);
  planet.userData.moons = planet.userData.moons || [];
  planet.userData.moons.push(moon);
  return moon;
}

function addPlanetRing(planet, { ringOffset = 0.45, thickness = 0.03, color = 0x999999, opacity = 0.7, rotationX = Math.PI / 2, rotationZ = 0 } = {}) {
  const base = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : realmRadius;
  const inner = base + ringOffset - thickness * 0.5;
  const outer = inner + thickness * 1.6;
  const ringGeo = new THREE.RingGeometry(inner, outer, 128);
  const ringMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4, transparent: true, opacity, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = rotationX;
  ring.rotation.z = rotationZ;
  ring.position.set(0, 0, 0);
  planet.add(ring);
  planet.userData._ring = ring;
  return ring;
}

// sample decorations (scaled)
addMoon(Asgard, { radius: 0.08, distance: 0.5, color: 0xffeebb, speed: 0.0016 });
addMoon(Niflheim, { radius: 0.06, distance: 0.45, color: 0xcfe6ff, speed: 0.0012 });
addMoon(Jotunheim, { radius: 0.07, distance: 0.52, color: 0xbfd1ff, speed: 0.001 });
addPlanetRing(Svartalfheim, { ringOffset: 0.4, thickness: 0.025, color: 0x666666, opacity: 0.6, rotationX: Math.PI / 2 - 0.5 });
addMoon(Svartalfheim, { radius: 0.055, distance: 0.42, color: 0x999999, speed: 0.002 });
addMoon(Nidavellir, { radius: 0.07, distance: 0.5, color: 0xd6c9a0, speed: 0.001 });

// --- Muspelheim volcanic decorations (volcano cones, lava lakes, mountains)
function sphericalToCartesian(radius, lat, lon) {
  // lat, lon in radians: lat = inclination from equator (-pi/2..pi/2), lon = azimuth
  const x = radius * Math.cos(lat) * Math.cos(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.sin(lon);
  return new THREE.Vector3(x, y, z);
}

function addVolcano(planet, { lat = 0, lon = 0, height = 0.18, base = 0.18, lavaRadius = 0.25, lavaColor = 0xff4b1f } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : realmRadius;
  const surfacePos = sphericalToCartesian(radius + 0.001, lat, lon);
  // create mountain/volcano cone
  const coneGeo = new THREE.ConeGeometry(base, height, 12);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x4a2f2a, metalness: 0.1, roughness: 0.8 });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  // position cone so its base sits on the planet surface
  cone.position.copy(surfacePos);
  // orient cone so its local Y points away from planet center
  const normal = surfacePos.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(up, normal);
  cone.quaternion.copy(q);
  // lift the cone so base intersects the surface
  cone.position.add(normal.clone().multiplyScalar(height * 0.5));
  planet.add(cone);

  // lava lake: create a curved spherical cap so the lake hugs planet curvature
  const lakeCenter = sphericalToCartesian(radius + 0.002, lat + 0.02, lon + 0.02);
  const ln = lakeCenter.clone().normalize();
  // angular radius derived from desired lake radius on the surface
  const angularRadius = Math.atan2(lavaRadius, radius);
  const lakeGeoCurved = createSphericalCap(radius, ln, angularRadius, 6, 32, 0.002);
  const lakeMat = new THREE.MeshStandardMaterial({ color: lavaColor, emissive: lavaColor, emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.3, side: THREE.DoubleSide });
  const lake = new THREE.Mesh(lakeGeoCurved, lakeMat);
  // lake geometry already computed in local (planet) coordinates; add to planet
  planet.add(lake);

  // emissive core for pulsing glow (small sphere inside cone)
  const coreGeo = new THREE.SphereGeometry(Math.max(0.04, base * 0.25), 8, 8);
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xffb37a, emissive: 0xff5a1a, emissiveIntensity: 1.2, metalness: 0.1, roughness: 0.2 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  // place core at mouth of volcano
  const mouth = surfacePos.clone().add(normal.clone().multiplyScalar(height * 0.6));
  core.position.copy(mouth);
  planet.add(core);

  // store references for animation
  planet.userData.volcanoes = planet.userData.volcanoes || [];
  const vInfo = { cone, lake, core, baseLavaIntensity: lakeMat.emissiveIntensity || 0.8, lakeMat, coreMat };
  planet.userData.volcanoes.push(vInfo);

  // add particles for smoke/lava puffs
  // convert local mouth/normal to world space so the emitter initializer can compute planet-local coords reliably
  const worldMouth = mouth.clone();
  planet.localToWorld(worldMouth);
  const pwq = new THREE.Quaternion();
  planet.getWorldQuaternion(pwq);
  const worldNormal = normal.clone().applyQuaternion(pwq).normalize();
  vInfo.particles = createVolcanoParticles(planet, { origin: worldMouth, normal: worldNormal });
  return { cone, lake, core };
}

function addMountain(planet, { lat = 0, lon = 0, height = 0.12, base = 0.12 } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : realmRadius;
  const pos = sphericalToCartesian(radius + 0.001, lat, lon);
  const geom = new THREE.ConeGeometry(base, height, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0x4b3f36, metalness: 0.03, roughness: 0.9 });
  const m = new THREE.Mesh(geom, mat);
  const normal = pos.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  m.quaternion.copy(q);
  m.position.copy(pos.add(normal.clone().multiplyScalar(height * 0.45)));
  planet.add(m);
  planet.userData.mountains = planet.userData.mountains || [];
  planet.userData.mountains.push(m);
  return m;
}

// add several volcanoes and mountains to Muspelheim (smaller, varied)
if (typeof Muspelheim !== 'undefined') {
  // a few primary volcanoes with randomized scale so they don't all match
  const primaryDefs = [
    { lat: 0.18, lon: 0.4, height: 0.20, base: 0.14, lavaRadius: 0.16 },
    { lat: -0.12, lon: -1.0, height: 0.16, base: 0.12, lavaRadius: 0.12 },
    { lat: 0.5, lon: 2.2, height: 0.14, base: 0.10, lavaRadius: 0.10 }
  ];
  for (const d of primaryDefs) {
    const s = 0.6 + Math.random() * 0.5; // scale 0.6 - 1.1
    addVolcano(Muspelheim, { lat: d.lat + (Math.random() - 0.5) * 0.06, lon: d.lon + (Math.random() - 0.5) * 0.2, height: d.height * s, base: d.base * s, lavaRadius: d.lavaRadius * s });
  }
  // a couple of small lava ponds (lower profile)
  addVolcano(Muspelheim, { lat: -0.4, lon: 1.6, height: 0.06, base: 0.05, lavaRadius: 0.12, lavaColor: 0xff6f33 });
  if (Math.random() > 0.6) addVolcano(Muspelheim, { lat: 0.12, lon: -2.0, height: 0.05, base: 0.04, lavaRadius: 0.10, lavaColor: 0xff5a2a });

  // mountain clusters: reduce count for less visual clutter
  for (let i = 0; i < 6; i++) {
    const lat = (Math.random() - 0.5) * 1.4;
    const lon = Math.random() * Math.PI * 2;
    const h = 0.04 + Math.random() * 0.12;
    const b = h * 0.6 + Math.random() * 0.03;
    addMountain(Muspelheim, { lat, lon, height: h, base: b });
  }
}

// create a spherical cap geometry (local coordinates) centered on `centerNormal` (unit vector)
function createSphericalCap(radius, centerNormal, angularRadius, radialSeg = 6, circumSeg = 32, offset = 0.002) {
  const verts = [];
  const normals = [];
  // tangent basis
  const t = centerNormal.clone();
  let u = new THREE.Vector3(0, 1, 0).cross(t);
  if (u.lengthSq() < 1e-6) u = new THREE.Vector3(1, 0, 0).cross(t);
  u.normalize();
  const v = new THREE.Vector3().crossVectors(t, u).normalize();
  // center vertex (at normal direction)
  const centerPos = t.clone().multiplyScalar(radius + offset);
  verts.push(centerPos.x, centerPos.y, centerPos.z);
  normals.push(centerPos.x, centerPos.y, centerPos.z);
  // rings
  for (let i = 1; i <= radialSeg; i++) {
    const r = (i / radialSeg) * angularRadius;
    const cosr = Math.cos(r);
    const sinr = Math.sin(r);
    for (let j = 0; j < circumSeg; j++) {
      const theta = (j / circumSeg) * Math.PI * 2;
      const dir = t.clone().multiplyScalar(cosr)
        .add(u.clone().multiplyScalar(Math.cos(theta) * sinr))
        .add(v.clone().multiplyScalar(Math.sin(theta) * sinr))
        .normalize();
      const p = dir.clone().multiplyScalar(radius + offset);
      verts.push(p.x, p.y, p.z);
      normals.push(dir.x, dir.y, dir.z);
    }
  }
  // build indices
  const indices = [];
  // fan from center to first ring
  for (let j = 0; j < circumSeg; j++) {
    const a = 0;
    const b = 1 + j;
    const c = 1 + ((j + 1) % circumSeg);
    indices.push(a, b, c);
  }
  // rings
  for (let i = 1; i < radialSeg; i++) {
    const ringStart = 1 + (i - 1) * circumSeg;
    const nextStart = 1 + i * circumSeg;
    for (let j = 0; j < circumSeg; j++) {
      const a = ringStart + j;
      const b = ringStart + ((j + 1) % circumSeg);
      const c = nextStart + j;
      const d = nextStart + ((j + 1) % circumSeg);
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

// create a simple particle emitter for a volcano: returns an object with geometry and points
function createVolcanoParticles(planet, { origin = new THREE.Vector3(), normal = new THREE.Vector3(0, 1, 0), count = 72 } = {}) {
  // convert provided world-space origin/normal into planet-local space
  const worldOrigin = origin.clone();
  const worldNormal = normal.clone().normalize();
  const planetWorldQuat = new THREE.Quaternion();
  planet.getWorldQuaternion(planetWorldQuat);
  const invPlanetQuat = planetWorldQuat.clone().invert();
  const localOrigin = worldOrigin.clone();
  planet.worldToLocal(localOrigin);
  const localNormal = worldNormal.clone().applyQuaternion(invPlanetQuat).normalize();

  // split into two emitters: smoke (soft, larger) and embers (small, additive)
  const smokeCount = Math.max(24, Math.floor(count * 0.6));
  const emberCount = Math.max(8, count - smokeCount);

  function makeEmitter(n, baseSpeed, baseSize, color, additive = false, texture = null) {
    const positions = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const life = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      positions[i * 3 + 0] = localOrigin.x + (Math.random() - 0.5) * 0.02;
      positions[i * 3 + 1] = localOrigin.y + (Math.random() - 0.5) * 0.02;
      positions[i * 3 + 2] = localOrigin.z + (Math.random() - 0.5) * 0.02;
      const speed = baseSpeed * (0.6 + Math.random() * 0.9);
      // tangent basis
      let tangent = new THREE.Vector3(1, 0, 0);
      if (Math.abs(localNormal.dot(tangent)) > 0.9) tangent.set(0, 1, 0);
      const bitangent = new THREE.Vector3().crossVectors(localNormal, tangent).normalize();
      tangent = new THREE.Vector3().crossVectors(bitangent, localNormal).normalize();
      const dir = localNormal.clone().multiplyScalar(0.5 + Math.random() * 0.9)
        .add(tangent.clone().multiplyScalar((Math.random() - 0.5) * 0.4))
        .add(bitangent.clone().multiplyScalar((Math.random() - 0.5) * 0.4)).normalize();
      vel[i * 3 + 0] = dir.x * speed;
      vel[i * 3 + 1] = dir.y * speed;
      vel[i * 3 + 2] = dir.z * speed;
      life[i] = 0.6 + Math.random() * 1.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
    const mat = new THREE.PointsMaterial({ color, size: baseSize, sizeAttenuation: true, transparent: true, opacity: additive ? 0.9 : 0.7, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    if (texture) { mat.map = texture; mat.alphaTest = 0.02; mat.transparent = true; }
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    planet.add(pts);
    return { geo, pts, baseSize };
  }

  // reduce counts/sizes for better performance and use textured sprites
  const smoke = makeEmitter(Math.max(16, Math.floor(smokeCount * 0.6)), 0.012, 0.08, 0x332622, false, smokeParticleTex);
  const embers = makeEmitter(Math.max(6, Math.floor(emberCount * 0.6)), 0.03, 0.04, 0xff8a33, true, emberParticleTex);

  return { smoke, embers, originLocal: localOrigin.clone(), localNormal };
}

// Procedural planet textures (simple canvas gradients/noise)
function makePlanetTexture(colorA, colorB) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  // radial gradient
  const grad = ctx.createRadialGradient(size * 0.35, size * 0.35, size * 0.1, size * 0.5, size * 0.5, size * 0.9);
  grad.addColorStop(0, colorA);
  grad.addColorStop(1, colorB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // add some stripes/noise
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    const y = Math.random() * size;
    ctx.fillRect(0, y, size, 2 + Math.random() * 4);
  }
  return new THREE.CanvasTexture(canvas);
}

// create a simple continental map: ocean base + a few irregular land blobs
function makeContinentalTexture(oceanColor = '#1b5d2b', landColor = '#63c66b', size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // simple value noise / fbm implementation (deterministic-ish)
  function hash2(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }
  function smoothNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const a = hash2(ix, iy);
    const b = hash2(ix + 1, iy);
    const c = hash2(ix, iy + 1);
    const d = hash2(ix + 1, iy + 1);
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const lerp = (p, q, t) => p + (q - p) * t;
    const x1 = lerp(a, b, u);
    const x2 = lerp(c, d, u);
    return lerp(x1, x2, v);
  }
  function fbm(x, y, octaves = 5) {
    let value = 0;
    let amplitude = 0.5;
    let freq = 1.0;
    for (let o = 0; o < octaves; o++) {
      value += amplitude * smoothNoise(x * freq, y * freq);
      freq *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  const img = ctx.createImageData(size, size);
  // generate equirectangular-style map using lon/lat coordinates so continents wrap nicely
  for (let j = 0; j < size; j++) {
    const v = j / size; // 0..1 latitude
    const lat = v * Math.PI - Math.PI / 2; // -pi/2..pi/2
    const latFactor = Math.cos(lat) * 0.8 + 0.2; // less land near poles
    for (let i = 0; i < size; i++) {
      const u = i / size; // 0..1 longitude
      const lon = u * Math.PI * 2; // 0..2pi
      // sample fbm with both lon/lats scaled
      const nx = Math.cos(lon) * latFactor * 1.2;
      const ny = Math.sin(lon) * latFactor * 1.2;
      const e = fbm(nx * 2.0 + 10.0, ny * 2.0 + 10.0, 5);
      // apply continental mask to bias ocean coverage
      const mask = Math.pow(Math.max(0, 1.0 - Math.abs(lat) / (Math.PI * 0.5)), 1.2);
      const elevation = (e * 0.9 + 0.1 * fbm(nx * 6.0, ny * 6.0, 2)) * mask;
      // choose threshold for land
      const landThreshold = 0.47 + (Math.sin(lat * 3.0) * 0.02);
      const idx = (j * size + i) * 4;
      if (elevation > landThreshold) {
        // land, shade by elevation
        const shade = Math.floor(lerpColor(landColor, shadeColor(landColor, -18), Math.min(1, (elevation - landThreshold) * 3.0)));
        img.data[idx + 0] = (shade >> 16) & 255;
        img.data[idx + 1] = (shade >> 8) & 255;
        img.data[idx + 2] = shade & 255;
        img.data[idx + 3] = 255;
      } else {
        // ocean: vary depth color based on elevation to suggest depth
        const t = Math.max(0, (landThreshold - elevation) / landThreshold);
        const deep = hexToRgb(oceanColor);
        // shallow mix towards lighter blue near coasts
        const shore = mixColor(deep, { r: 80, g: 160, b: 255 }, Math.pow(1 - t, 1.6));
        img.data[idx + 0] = shore.r;
        img.data[idx + 1] = shore.g;
        img.data[idx + 2] = shore.b;
        img.data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // tiny blur for smoothing coastlines
  // draw canvas onto itself scaled down and up to soften edges
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = size / 2;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(tmp, 0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// tiny helpers for color operations
function hexToRgb(hex) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function mixColor(a, b, t) {
  return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) };
}
function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA); const b = hexToRgb(hexB);
  const m = mixColor(a, b, Math.max(0, Math.min(1, t)));
  return (m.r << 16) | (m.g << 8) | m.b;
}

// small helper to slightly darken/lighten a hex color
function shadeColor(hex, percent) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00FF) + percent;
  let b = (num & 0x0000FF) + percent;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + (r.toString(16).padStart(2, '0')) + (g.toString(16).padStart(2, '0')) + (b.toString(16).padStart(2, '0'));
}

// helper: create a soft radial particle texture on a canvas
function createParticleTexture(size, innerColor, outerColor) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(1, outerColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// apply textures to a few planets for variety
if (Asgard.material) { Asgard.material.map = makePlanetTexture('#ffdba0', '#b5732f'); Asgard.material.needsUpdate = true; }
if (Midgard.material) {
  // blue oceans, greener continents
  Midgard.material.map = makeContinentalTexture('#1b6fff', '#63c66b', 1024);
  Midgard.material.roughness = 0.45;
  Midgard.material.metalness = 0.05;
  Midgard.material.needsUpdate = true;
}
if (Muspelheim.material) { Muspelheim.material.map = makePlanetTexture('#ff9a6b', '#6a1f10'); Muspelheim.material.needsUpdate = true; }
if (Jotunheim.material) { Jotunheim.material.map = makePlanetTexture('#bcd0ff', '#506f9a'); Jotunheim.material.needsUpdate = true; }
if (Svartalfheim.material) { Svartalfheim.material.map = makePlanetTexture('#bfbfbf', '#474747'); Svartalfheim.material.needsUpdate = true; }
// --- Planet decoration helpers
// lists of animated elements
const animatedGlowRings = [];
const animatedAtmospheres = [];
const animatedClouds = [];

function addGlowRing(planet, { color = 0x88ccff, inner = 0.6, outer = 0.8, opacity = 0.25 } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : realmRadius;
  const innerR = radius + inner; const outerR = radius + outer;
  const geo = new THREE.RingGeometry(innerR, outerR, 64);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  planet.add(mesh);
  mesh.userData = mesh.userData || {};
  mesh.userData.baseOpacity = opacity;
  animatedGlowRings.push(mesh);
  return mesh;
}

function addThinAtmosphere(planet, { color = 0xaaddff, opacity = 0.08, rimColor = 0xaaddff, fresnelIntensity = 0.9 } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : realmRadius;
  // simple backside lit atmosphere sphere (keeps previous behavior)
  const geo = new THREE.SphereGeometry(radius * 1.06, 32, 16);
  const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, side: THREE.BackSide, depthWrite: false });
  const sph = new THREE.Mesh(geo, mat);
  planet.add(sph);
  sph.userData = sph.userData || {};
  sph.userData.baseOpacity = opacity;

  // fresnel rim shader: thin front-facing shell that adds a glowing rim and subtle pulsing
  const fresnelGeo = new THREE.SphereGeometry(radius * 1.08, 32, 16);
  const fresnelUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(rimColor) },
    uIntensity: { value: fresnelIntensity }
  };
  const fresnelVert = `
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const fresnelFrag = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uIntensity;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float fres = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 2.0);
      float pulse = 0.8 + 0.45 * sin(uTime * 1.6 + vWorldPos.x * 0.12);
      vec3 col = uColor * fres * uIntensity * pulse;
      float alpha = fres * 0.9 * uIntensity * pulse;
      gl_FragColor = vec4(col, alpha);
    }
  `;
  const fresnelMat = new THREE.ShaderMaterial({ uniforms: fresnelUniforms, vertexShader: fresnelVert, fragmentShader: fresnelFrag, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide });
  const fresnel = new THREE.Mesh(fresnelGeo, fresnelMat);
  planet.add(fresnel);
  // store references so other helpers can tweak them
  sph.userData.fresnel = fresnel;
  sph.userData.fresnelBaseIntensity = fresnelIntensity;
  animatedAtmospheres.push(sph);
  return sph;
}

// create a drifting particle storm around a planet (local coordinates)
function addParticleStorm(planet, { count = 200, radiusOffset = 0.2, speed = 0.02, color = 0xcccccc, size = 0.06 } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : realmRadius;
  const positions = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const lat = (Math.random() - 0.5) * 0.6;
    const r = radius + radiusOffset + (Math.random() - 0.5) * 0.08;
    const p = sphericalToCartesian(r, lat, ang);
    positions[i * 3 + 0] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    // velocity tangentially along longitude to create drifting swirl
    const t = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang)).multiplyScalar(speed * (0.6 + Math.random() * 0.8));
    vel[i * 3 + 0] = t.x;
    vel[i * 3 + 1] = (Math.random() - 0.5) * speed * 0.2;
    vel[i * 3 + 2] = t.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  const mat = new THREE.PointsMaterial({ color, size, map: smokeParticleTex, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.NormalBlending });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  planet.add(points);
  // add a local wind vector so storms visibly drift around the planet
  const wind = new THREE.Vector3((Math.random() - 0.5) * 0.02, (Math.random() - 0.2) * 0.008, (Math.random() - 0.5) * 0.02);
  const windRotateSpeed = (Math.random() * 0.6 - 0.3) * 0.8; // radians/sec
  const windAxis = new THREE.Vector3(0, 1, 0); // rotate wind around local Y by default
  // seasonal/gust params
  const seasonPhase = Math.random() * Math.PI * 2;
  const seasonSpeed = 0.02 + Math.random() * 0.04; // slow seasonal oscillation
  const gust = 0.0;
  const gustDecayRate = 1.6 + Math.random() * 1.2;
  const gustChance = 0.25 + Math.random() * 0.5; // chance per second
  // store the intended orbit radius so particles stay near the planet surface
  const targetRadius = radius + radiusOffset;
  planet.userData.storm = { geo, points, count, speed, wind, windRotateSpeed, windAxis, seasonPhase, seasonSpeed, gust, gustDecayRate, gustChance, targetRadius };
  return planet.userData.storm;
}

function createCloudLayer(planet, { color = 0xffffff, opacity = 0.18, speed = 0.02, scale = 1.08, density = 80, white = false } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : realmRadius;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  // start transparent
  ctx.clearRect(0, 0, size, size);
  // draw many soft cloud blobs (radial gradients) to form organic cloud shapes
  const blobs = Math.max(6, Math.floor(density));
  for (let i = 0; i < blobs; i++) {
    const bx = Math.random() * size;
    const by = Math.random() * size;
    const br = size * (0.02 + Math.random() * 0.18);
    // whiter/denser clouds use higher inner alpha
    const innerAlpha = white ? (0.7 + Math.random() * 0.25) : (0.35 + Math.random() * 0.45);
    const outerAlpha = white ? (0.02 + Math.random() * 0.03) : (0.01 + Math.random() * 0.06);
    const grad = ctx.createRadialGradient(bx, by, Math.max(1, br * 0.03), bx, by, br);
    grad.addColorStop(0, `rgba(255,255,255,${innerAlpha})`);
    grad.addColorStop(0.6, `rgba(255,255,255,${Math.max(0.08, innerAlpha * 0.45)})`);
    grad.addColorStop(1, `rgba(255,255,255,${outerAlpha})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  // subtle overall softening by drawing lightly again with low alpha
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < Math.max(8, Math.floor(blobs / 4)); i++) {
    const bx = Math.random() * size;
    const by = Math.random() * size;
    const br = size * (0.06 + Math.random() * 0.26);
    const grad = ctx.createRadialGradient(bx, by, br * 0.1, bx, by, br);
    grad.addColorStop(0, 'rgba(255,255,255,0.06)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 1);
  const geo = new THREE.SphereGeometry(radius * scale, 48, 16);
  const mat = new THREE.MeshStandardMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { cloudSpeed: speed, tex };
  planet.add(mesh);
  animatedClouds.push(mesh);
  return mesh;
}

function scatterCones(planet, { count = 10, minH = 0.03, maxH = 0.12, color = 0x555555 } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : realmRadius;
  for (let i = 0; i < count; i++) {
    const lat = (Math.random() - 0.5) * Math.PI * 0.8;
    const lon = Math.random() * Math.PI * 2;
    const pos = sphericalToCartesian(radius + 0.001, lat, lon);
    const h = minH + Math.random() * (maxH - minH);
    const b = h * (0.5 + Math.random() * 0.6);
    const geom = new THREE.ConeGeometry(b, h, 6);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.8 });
    const m = new THREE.Mesh(geom, mat);
    const normal = pos.clone().normalize();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    m.position.copy(pos.add(normal.clone().multiplyScalar(h * 0.45)));
    planet.add(m);
  }
}

function scatterLights(planet, { count = 8, color = 0xffaa55, intensity = 0.8 } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : realmRadius;
  for (let i = 0; i < count; i++) {
    const lat = (Math.random() - 0.5) * Math.PI * 0.8;
    const lon = Math.random() * Math.PI * 2;
    const pos = sphericalToCartesian(radius + 0.01, lat, lon);
    const pLight = new THREE.PointLight(color, intensity * (0.6 + Math.random() * 0.8), 1.6);
    pLight.position.copy(pos);
    planet.add(pLight);
  }
}

// create a floating island visual attached to a planet (keeps planet mesh for raycast)
function createFloatingIsland(planet, { scale = 1.0, cliffColor = 0x654321, grassColor = 0x2e8b57 } = {}) {
  const island = new THREE.Group();
  // make the island a bit larger relative to the planet so it reads when focused
  const baseRadius = ((planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : realmRadius) * 0.85 * scale;

  // simple hash / smooth noise / fbm used to sculpt terrain
  function hash2(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }
  function smoothNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const a = hash2(ix, iy);
    const b = hash2(ix + 1, iy);
    const c = hash2(ix, iy + 1);
    const d = hash2(ix + 1, iy + 1);
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const lerp = (p, q, t) => p + (q - p) * t;
    const x1 = lerp(a, b, u);
    const x2 = lerp(c, d, u);
    return lerp(x1, x2, v);
  }
  function fbm(x, y, oct = 5) {
    let value = 0, amp = 0.5, freq = 1.0;
    for (let o = 0; o < oct; o++) {
      value += amp * smoothNoise(x * freq, y * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return value;
  }

  // radial-grid heightfield for island top
  const radialSeg = 20;
  const angularSeg = 48;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // center vertex
  positions.push(0, baseRadius * 0.18, 0);
  uvs.push(0.5, 0.5);

  for (let r = 1; r <= radialSeg; r++) {
    const rr = r / radialSeg;
    for (let a = 0; a < angularSeg; a++) {
      const theta = (a / angularSeg) * Math.PI * 2;
      const sx = Math.cos(theta) * rr;
      const sy = Math.sin(theta) * rr;
      // sample fbm for height; scale coordinates so continents-like bumps form
      const e = fbm(sx * 2.5 + 10.0, sy * 2.5 + 10.0, 5);
      const taper = Math.pow(1 - rr * rr, 1.2);
      const height = baseRadius * (0.08 + e * 0.36) * taper + (Math.random() - 0.5) * baseRadius * 0.005;
      const px = sx * baseRadius;
      const py = height;
      const pz = sy * baseRadius;
      positions.push(px, py, pz);
      uvs.push((sx + 1) * 0.5, (sy + 1) * 0.5);
    }
  }

  // build indices: fan from center to first ring
  for (let a = 0; a < angularSeg; a++) {
    const b = 1 + a;
    const c = 1 + ((a + 1) % angularSeg);
    indices.push(0, b, c);
  }
  // rings
  for (let r = 1; r < radialSeg; r++) {
    const ringStart = 1 + (r - 1) * angularSeg;
    const nextStart = 1 + r * angularSeg;
    for (let a = 0; a < angularSeg; a++) {
      const a0 = ringStart + a;
      const a1 = ringStart + ((a + 1) % angularSeg);
      const b0 = nextStart + a;
      const b1 = nextStart + ((a + 1) % angularSeg);
      indices.push(a0, b0, a1);
      indices.push(a1, b0, b1);
    }
  }

  // create geometry for top
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // compute rim statistics from outer ring vertices so skirts/waterfalls align exactly
  const outerRingStart = 1 + (radialSeg - 1) * angularSeg;
  let rimY = 0; let rimR = 0;
  for (let a = 0; a < angularSeg; a++) {
    const vi = outerRingStart + a;
    const vx = positions[vi * 3 + 0];
    const vy = positions[vi * 3 + 1];
    const vz = positions[vi * 3 + 2];
    rimY += vy;
    rimR += Math.sqrt(vx * vx + vz * vz);
  }
  rimY /= angularSeg;
  rimR /= angularSeg;
  const landMat = new THREE.MeshStandardMaterial({ color: grassColor, metalness: 0.05, roughness: 0.7, side: THREE.DoubleSide });
  const land = new THREE.Mesh(geo, landMat);
  land.castShadow = true;
  land.receiveShadow = true;
  island.add(land);

  // underside cliff skirt: inverted cone (tapers inward toward bottom)
  // shorten and lower the skirt so the top island surface remains visible.
  const skirtHeight = baseRadius * 1.2;
  const skirtGeo = new THREE.CylinderGeometry(baseRadius * 0.85, baseRadius * 0.45, skirtHeight, 48, 1, true);
  const skirtMat = new THREE.MeshStandardMaterial({ color: cliffColor, metalness: 0.02, roughness: 0.9, side: THREE.DoubleSide });
  const skirt = new THREE.Mesh(skirtGeo, skirtMat);
  // position the skirt so its top edge meets the computed rimY
  const skirtTopLocalY = skirtHeight * 0.5; // cylinder centered at origin
  skirt.position.y = rimY - skirtTopLocalY - 0.005 * baseRadius;
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  island.add(skirt);

  // small trees scattered on top
  const treeCount = 6 + Math.floor(Math.random() * 6);
  for (let i = 0; i < treeCount; i++) {
    const tGroup = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.01 * baseRadius, 0.01 * baseRadius, 0.08 * baseRadius, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b2e12, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.02 * baseRadius;
    const crownGeo = new THREE.ConeGeometry(0.03 * baseRadius, 0.12 * baseRadius, 6);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x1f7a3a, roughness: 0.8 });
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.y = 0.08 * baseRadius;
    tGroup.add(trunk);
    tGroup.add(crown);
    // place on top approximate by sampling a random direction
    const ang = Math.random() * Math.PI * 2;
    const r = baseRadius * (0.2 + Math.random() * 0.6);
    tGroup.position.set(Math.cos(ang) * r, Math.random() * baseRadius * 0.18 + 0.02 * baseRadius, Math.sin(ang) * r);
    tGroup.lookAt(0, 1, 0);
    island.add(tGroup);
  }
  // small cloud ring under island (soft silhouette)
  const ring = addGlowRing(planet, { color: 0xffffff, inner: 0.0, outer: 0.35, opacity: 0.12 });
  // parent island to planet so it moves with it; add island after ring so order is OK
  planet.add(island);
  // adjust island local transform so it sits 'above' planet surface
  // position the island below the planet so it 'hangs' out of the bottom
  const planetR = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius ? planet.geometry.parameters.radius : realmRadius);
  // raise the island a bit so it's clearer when focused, and nudge slightly outward
  island.position.set(0, -planetR * 0.45 - 0.02, 0);
  island.renderOrder = 500;
  land.renderOrder = 510;
  skirt.renderOrder = 510;
  island.userData = island.userData || {};
  island.userData.baseY = island.position.y;
  // expose computed island metrics for downstream placement (city, waterfalls)
  island.userData.baseRadius = baseRadius;
  island.userData.rimR = rimR;
  island.userData.rimY = rimY;
  island.userData.floatSpeed = 0.6 + Math.random() * 0.8;
  island.userData.floatAmp = 0.03 * baseRadius; // reduced bobbing so it reads as hanging
  // waterfalls and mist: create several waterfalls around the rim
  island.userData.waterfalls = [];
  island.userData.mistEmitters = [];
  // mist texture
  const mistTex = createParticleTexture(64, 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)');
  // helper: create a vertical waterfall plane with a flowing texture
  function makeWaterfall(theta) {
    const wfWidth = baseRadius * (0.22 + Math.random() * 0.12);
    const wfHeight = baseRadius * (0.8 + Math.random() * 0.25);
    // create a thin vertical gradient texture with light streaks
    const wc = document.createElement('canvas'); wc.width = 32; wc.height = 256;
    const wctx = wc.getContext('2d');
    wctx.clearRect(0, 0, wc.width, wc.height);
    const grad = wctx.createLinearGradient(0, 0, 0, wc.height);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.3, 'rgba(220,240,255,0.85)');
    grad.addColorStop(0.6, 'rgba(200,230,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0.02)');
    wctx.fillStyle = grad; wctx.fillRect(0, 0, wc.width, wc.height);
    // add a few faint vertical streaks
    wctx.strokeStyle = 'rgba(255,255,255,0.35)'; wctx.lineWidth = 1;
    for (let s = 0; s < 6; s++) {
      const x = 4 + Math.random() * (wc.width - 8);
      wctx.beginPath(); wctx.moveTo(x, 0); wctx.lineTo(x + (Math.random() - 0.5) * 2, wc.height); wctx.stroke();
    }
    const wfTex = new THREE.CanvasTexture(wc);
    wfTex.wrapS = wfTex.wrapT = THREE.RepeatWrapping;
    wfTex.repeat.set(1, 1);
    // geometry and material
    const geo = new THREE.PlaneGeometry(wfWidth, wfHeight, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ map: wfTex, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending });
    const mesh = new THREE.Mesh(geo, mat);
    // position at computed rim so waterfall meets land edge
    const r = rimR;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const topY = rimY;
    mesh.position.set(x, topY - wfHeight * 0.5, z);
    // face outward
    mesh.rotation.y = -theta + Math.PI / 2;
    mesh.rotation.x = 0.18 + (Math.random() - 0.5) * 0.05;
    mesh.renderOrder = 520;
    island.add(mesh);
    // mist emitter at base
    const mistCount = 40;
    const mPos = new Float32Array(mistCount * 3);
    const mVel = new Float32Array(mistCount * 3);
    const mLife = new Float32Array(mistCount);
    const baseX = x; const baseZ = z; const baseYPos = topY - wfHeight + 0.02 * baseRadius;
    for (let i = 0; i < mistCount; i++) {
      mPos[i * 3 + 0] = baseX + (Math.random() - 0.5) * wfWidth * 0.6;
      mPos[i * 3 + 1] = baseYPos + (Math.random()) * 0.04 * baseRadius;
      mPos[i * 3 + 2] = baseZ + (Math.random() - 0.5) * wfWidth * 0.6;
      mVel[i * 3 + 0] = (Math.random() - 0.5) * 0.002;
      mVel[i * 3 + 1] = 0.01 + Math.random() * 0.02;
      mVel[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
      mLife[i] = 0.6 + Math.random() * 1.2;
    }
    const mGeo = new THREE.BufferGeometry();
    mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
    mGeo.setAttribute('aVel', new THREE.BufferAttribute(mVel, 3));
    mGeo.setAttribute('aLife', new THREE.BufferAttribute(mLife, 1));
    const mMat = new THREE.PointsMaterial({ map: mistTex, size: baseRadius * 0.06, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.NormalBlending });
    const points = new THREE.Points(mGeo, mMat);
    points.frustumCulled = false;
    points.renderOrder = 525;
    island.add(points);
    // store
    island.userData.waterfalls.push({ mesh, tex: wfTex, speed: 0.6 + Math.random() * 0.8 });
    island.userData.mistEmitters.push({ geo: mGeo, pts: points, baseX, baseYPos, baseZ, count: mistCount });
  }
  // create several waterfalls around the rim
  const wfCount = 3 + Math.floor(Math.random() * 3);
  for (let wi = 0; wi < wfCount; wi++) {
    const theta = Math.random() * Math.PI * 2;
    makeWaterfall(theta);
  }
  // store reference on planet userData
  planet.userData.island = island;
  return island;
}

// add a compact city to an island: simple buildings, a central hall, and lights
function addCityToIsland(planet, { density = 16 } = {}) {
  if (!planet || !planet.userData || !planet.userData.island) return;
  const isl = planet.userData.island;
  const baseRadius = isl.userData.baseRadius || 0.5;
  const rimR = isl.userData.rimR || baseRadius * 0.9;
  const rimY = isl.userData.rimY || (isl.userData.baseY || 0) + baseRadius * 0.12;
  const city = new THREE.Group();
  city.name = 'asgardCity';

  // central hall
  const hallRadius = baseRadius * 0.22;
  const hallHeight = baseRadius * 0.25;
  const hallGeo = new THREE.CylinderGeometry(hallRadius, hallRadius * 0.9, hallHeight, 16);
  const hallMat = new THREE.MeshStandardMaterial({ color: 0xffeecf, metalness: 0.3, roughness: 0.45, emissive: 0x332211, emissiveIntensity: 0.03 });
  const hall = new THREE.Mesh(hallGeo, hallMat);
  hall.position.set(0, rimY + hallHeight * 0.5 - 0.02 * baseRadius, 0);
  city.add(hall);
  // ring of houses
  const houseCount = Math.max(8, Math.floor(density));
  for (let i = 0; i < houseCount; i++) {
    const ang = (i / houseCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
    const dist = rimR * (0.4 + Math.random() * 0.45);
    const hx = Math.cos(ang) * dist;
    const hz = Math.sin(ang) * dist;
    const w = baseRadius * (0.08 + Math.random() * 0.06);
    const h = baseRadius * (0.08 + Math.random() * 0.5);
    const d = w * (0.8 + Math.random() * 0.6);
    const geom = new THREE.BoxGeometry(w, h, d);
    const col = new THREE.Color().setHSL(0.08 + Math.random() * 0.08, 0.3, 0.25 + Math.random() * 0.2);
    const mat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.05, roughness: 0.7 });
    const b = new THREE.Mesh(geom, mat);
    b.position.set(hx, rimY + h * 0.5 - 0.02 * baseRadius, hz);
    // add simple emissive windows as small planes on the front face
    const winW = w * 0.3; const winH = h * 0.18;
    const winGeo = new THREE.PlaneGeometry(winW, winH);
    const winMat = new THREE.MeshBasicMaterial({ color: 0xfff7d6, transparent: true, opacity: 0.92 });
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.set(0, h * 0.12, d * 0.51 + 0.001);
    b.add(win);
    // small rooftop light
    const pLight = new THREE.PointLight(0xffe8cc, 0.35 + Math.random() * 0.45, baseRadius * 0.8);
    pLight.position.set(0, h * 0.55, 0);
    b.add(pLight);
    // rotate houses slightly toward center
    b.lookAt(0, rimY, 0);
    city.add(b);
  }

  // small street lamps along radial paths
  const lampCount = Math.max(6, Math.floor(density / 2));
  for (let i = 0; i < lampCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = rimR * (0.2 + Math.random() * 0.6);
    const lx = Math.cos(ang) * dist; const lz = Math.sin(ang) * dist;
    const lamp = new THREE.PointLight(0xfff1c8, 0.18 + Math.random() * 0.22, baseRadius * 0.9);
    lamp.position.set(lx, rimY + 0.06 * baseRadius, lz);
    city.add(lamp);
  }

  // subtle glowing band under city to suggest street layout
  const ringGeo = new THREE.RingGeometry(rimR * 0.15, rimR * 0.6, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffeed6, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
  const glow = new THREE.Mesh(ringGeo, ringMat);
  glow.rotation.x = Math.PI / 2;
  glow.position.y = rimY - baseRadius * 0.02;
  city.add(glow);

  isl.add(city);
  // store for potential future animation
  isl.userData.city = city;
}

// --- Apply themed decorations for each realm
if (typeof Asgard !== 'undefined') {
  // gilded halo and subtle aurora ring
  Asgard.userData.glowRing = addGlowRing(Asgard, { color: 0xffd27a, inner: 0.28, outer: 0.44, opacity: 0.18 });
  Asgard.userData.atmosphere = addThinAtmosphere(Asgard, { color: 0xffedcc, opacity: 0.04 });
  // soft cloud layer
  Asgard.userData.cloud = createCloudLayer(Asgard, { color: 0xfff4dd, opacity: 0.06, speed: 0.01, scale: 1.04 });
  // create a floating island visual and keep the Asgard sphere as an invisible pick target
  // make the original planet material transparent so it doesn't render but remains raycastable
  if (Asgard.material) {
    Asgard.material.transparent = true;
    Asgard.material.opacity = 0.0;
    Asgard.material.depthWrite = false;
    Asgard.material.depthTest = false;
    Asgard.material.side = THREE.DoubleSide;
    if (Asgard.material.color) Asgard.material.color.set(0xffffff);
    if (Asgard.material.emissive) Asgard.material.emissive.set(0x000000);
    Asgard.material.needsUpdate = true;
  }
  createFloatingIsland(Asgard, { scale: 1.0, cliffColor: 0x5a3924, grassColor: 0xfff4dd });
  // add a small city on the island
  addCityToIsland(Asgard, { density: 18 });
}
if (typeof Niflheim !== 'undefined') {
  // icy shards and thin blue atmosphere
  Niflheim.userData.mountains = scatterCones(Niflheim, { count: 14, minH: 0.02, maxH: 0.06, color: 0xddeeef });
  Niflheim.userData.atmosphere = addThinAtmosphere(Niflheim, { color: 0xcfeeff, opacity: 0.12 });
  Niflheim.userData.cloud = createCloudLayer(Niflheim, { color: 0xdfefff, opacity: 0.08, speed: 0.012, scale: 1.03 });
}
if (typeof Midgard !== 'undefined') {
  // soft clouds and greenish banding
  Midgard.userData.atmosphere = addThinAtmosphere(Midgard, { color: 0x88e08a, opacity: 0.06 });
  // ensure Midgard has a strong visible cloud layer (user requested more visible clouds)
  if (!Midgard.userData.cloud) Midgard.userData.cloud = createCloudLayer(Midgard, { color: 0xffffff, opacity: 0.9, speed: 0.018, scale: 1.03, density: 22, white: true });
  else { Midgard.userData.cloud.material.opacity = Math.max(0.9, Midgard.userData.cloud.material.opacity); Midgard.userData.cloud.material.color.set(0xffffff); }
  // add a second, higher cloud band for depth (fewer blobs, still very white)
  if (!Midgard.userData.cloud2) Midgard.userData.cloud2 = createCloudLayer(Midgard, { color: 0xffffff, opacity: 0.6, speed: 0.009, scale: 1.07, density: 10, white: true });
  else { Midgard.userData.cloud2.material.opacity = Math.max(0.6, Midgard.userData.cloud2.material.opacity); Midgard.userData.cloud2.material.color.set(0xffffff); }
  scatterCones(Midgard, { count: 6, minH: 0.02, maxH: 0.05, color: 0x2f6b35 });
}
if (typeof Alfheim !== 'undefined') {
  // fey glow and small scattered lights
  Alfheim.userData.glowRing = addGlowRing(Alfheim, { color: 0xaee6c8, inner: 0.18, outer: 0.34, opacity: 0.18 });
  scatterLights(Alfheim, { count: 10, color: 0x88fff0, intensity: 0.6 });
  Alfheim.userData.cloud = createCloudLayer(Alfheim, { color: 0xeafffb, opacity: 0.06, speed: 0.02, scale: 1.05 });
}
if (typeof Jotunheim !== 'undefined') {
  // big jagged mountains
  Jotunheim.userData.mountains = scatterCones(Jotunheim, { count: 18, minH: 0.06, maxH: 0.22, color: 0x8ea6c8 });
  Jotunheim.userData.atmosphere = addThinAtmosphere(Jotunheim, { color: 0xe6f0ff, opacity: 0.06 });
  Jotunheim.userData.cloud = createCloudLayer(Jotunheim, { color: 0xf0f5ff, opacity: 0.05, speed: 0.008, scale: 1.02 });
}
if (typeof Vanaheim !== 'undefined') {
  // pastel spots / blooms
  Vanaheim.userData.mountains = scatterCones(Vanaheim, { count: 8, minH: 0.02, maxH: 0.07, color: 0xffd1b3 });
  scatterLights(Vanaheim, { count: 6, color: 0xffd1b3, intensity: 0.5 });
  Vanaheim.userData.cloud = createCloudLayer(Vanaheim, { color: 0xfff0e6, opacity: 0.05, speed: 0.015, scale: 1.03 });
}
if (typeof Svartalfheim !== 'undefined') {
  // metallic plates and a tight ring
  Svartalfheim.userData.mountains = scatterCones(Svartalfheim, { count: 6, minH: 0.02, maxH: 0.05, color: 0x555555 });
  Svartalfheim.userData.ring = addPlanetRing(Svartalfheim, { ringOffset: 0.38, thickness: 0.02, color: 0x222222, opacity: 0.5, rotationX: Math.PI / 2 - 0.3 });
}
if (typeof Nidavellir !== 'undefined') {
  // mining lights and small forges
  Nidavellir.userData.lights = scatterLights(Nidavellir, { count: 14, color: 0xffa860, intensity: 0.9 });
  Nidavellir.userData.mountains = scatterCones(Nidavellir, { count: 6, minH: 0.02, maxH: 0.06, color: 0x7a5f3a });
  Nidavellir.userData.cloud = createCloudLayer(Nidavellir, { color: 0xfff0cc, opacity: 0.04, speed: 0.01, scale: 1.02 });
}
// enable drifting storms on worlds where they make thematic sense
if (typeof Niflheim !== 'undefined') {
  addParticleStorm(Niflheim, { count: 240, radiusOffset: 0.28, speed: 0.015, color: 0xdfefff, size: 0.045 });
  strengthenAtmosphere(Niflheim, { intensity: 2.0, rimColor: 0xcfeeff });
}
if (typeof Jotunheim !== 'undefined') {
  addParticleStorm(Jotunheim, { count: 200, radiusOffset: 0.24, speed: 0.02, color: 0xcfe6ff, size: 0.05 });
  strengthenAtmosphere(Jotunheim, { intensity: 1.8, rimColor: 0xe6f0ff });
}
if (typeof Midgard !== 'undefined') {
  addParticleStorm(Midgard, { count: 160, radiusOffset: 0.18, speed: 0.014, color: 0xe8ffe8, size: 0.05 });
  strengthenAtmosphere(Midgard, { intensity: 1.4, rimColor: 0x88e08a });
}
if (typeof Muspelheim !== 'undefined') {
  // ash/smoke-laden storms for volcanic Muspelheim
  addParticleStorm(Muspelheim, { count: 140, radiusOffset: 0.2, speed: 0.03, color: 0xff9a6b, size: 0.055 });
  strengthenAtmosphere(Muspelheim, { intensity: 1.9, rimColor: 0xff8a5b });
}
if (typeof Vanaheim !== 'undefined') {
  addParticleStorm(Vanaheim, { count: 100, radiusOffset: 0.16, speed: 0.012, color: 0xffefe0, size: 0.04 });
  strengthenAtmosphere(Vanaheim, { intensity: 1.3, rimColor: 0xfff0e6 });
}
const outerRingGeo = new THREE.TorusGeometry(4.9, 0.18, 16, 400);
const outerRingMat = new THREE.MeshStandardMaterial({ color: 0xc89b4b, metalness: 0.9, roughness: 0.25 });
const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
outerRing.rotation.set(0, 0, 0); // align to clock face (XY plane)
outerRing.position.x = clockOffsetX;
scene.add(outerRing);

const innerRingGeo = new THREE.TorusGeometry(4.6, 0.08, 8, 200);
const innerRingMat = new THREE.MeshStandardMaterial({ color: 0x002b36, metalness: 0.2, roughness: 0.6, side: THREE.DoubleSide });
const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
innerRing.rotation.set(0, 0, 0); // align to clock face
innerRing.position.x = clockOffsetX;
scene.add(innerRing);

// runes around the clock: small emissive marks
const runesGroup = new THREE.Group();
runesGroup.rotation.set(0, 0, 0); // align runes to the clock face (XY)
runesGroup.position.z = 0.06; // slight offset so runes sit above the ring
// position runes to the clock offset
runesGroup.position.x = clockOffsetX;
const runeMaterials = [];
for (let i = 0; i < 9; i++) {
  const rGeom = new THREE.BoxGeometry(0.12, 0.5, 0.06);
  rGeom.translate(0, 2.95, 0);
  const rMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0x7be8ff, emissiveIntensity: 0.0, metalness: 0.2, roughness: 0.4 });
  const rune = new THREE.Mesh(rGeom, rMat);
  rune.rotation.z = i * ((Math.PI * 2) / 9);
  runesGroup.add(rune);
  runeMaterials.push(rMat);
}
scene.add(runesGroup);

// --- Norse-flavored clock hands, ticks, stars, and snow ---
const clockGroup = new THREE.Group();
clockGroup.position.set(clockOffsetX, 0, 0);
scene.add(clockGroup);
// move clock rings and runes into `clockGroup` so everything aligns
if (outerRing.parent) outerRing.parent.remove(outerRing);
clockGroup.add(outerRing);
outerRing.position.set(0, 0, 0);
if (innerRing.parent) innerRing.parent.remove(innerRing);
clockGroup.add(innerRing);
innerRing.position.set(0, 0, 0);
if (runesGroup.parent) runesGroup.parent.remove(runesGroup);
clockGroup.add(runesGroup);
runesGroup.position.set(0, 0, 0.06);

function makeHand(length, thickness, color) {
  const geom = new THREE.BoxGeometry(length, thickness, thickness);
  geom.translate(length / 2, 0, 0);
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.5 });
  return new THREE.Mesh(geom, mat);
}

const hourHand = makeHand(2.5, 0.12, 0x8b5a2b);
const minuteHand = makeHand(3.5, 0.09, 0xcaa74a);
const secondHand = makeHand(4.2, 0.04, 0xe85c2a);

hourHand.position.set(0, 0, 0.01);
minuteHand.position.set(0, 0, 0.02);
secondHand.position.set(0, 0, 0.03);

clockGroup.add(hourHand, minuteHand, secondHand);

// 9 hour markers
const tickMat = new THREE.MeshStandardMaterial({ color: 0xffe6aa, emissive: 0x2b2b17, emissiveIntensity: 0.12 });
for (let i = 0; i < 9; i++) {
  const geom = new THREE.BoxGeometry(0.15, 0.6, 0.15);
  geom.translate(0, 2.8, 0);
  const tick = new THREE.Mesh(geom, tickMat);
  tick.rotation.z = i * ((Math.PI * 2) / 9);
  clockGroup.add(tick);
}

// Stars (shader-based Points): spread out, each has independent pulse phase
const starCount = 500;
const starsGeo = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
const starPhases = new Float32Array(starCount);
const starSizes = new Float32Array(starCount);
const starSpeeds = new Float32Array(starCount);
for (let i = 0; i < starCount; i++) {
  const r = 80 + Math.random() * 260; // spread wider
  const theta = Math.random() * Math.PI * 2;
  const phi = (Math.random() - 0.5) * Math.PI * 0.9;
  starPositions[i * 3 + 0] = Math.cos(theta) * Math.cos(phi) * r;
  starPositions[i * 3 + 1] = Math.sin(phi) * r * 0.6;
  starPositions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r - 20;
  starPhases[i] = Math.random() * Math.PI * 2;
  starSizes[i] = 1.0 + Math.random() * 3.0;
  starSpeeds[i] = 0.2 + Math.random() * 1.2;
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starsGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
starsGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
starsGeo.setAttribute('aSpeed', new THREE.BufferAttribute(starSpeeds, 1));

const starUniforms = {
  uTime: { value: 0 },
  uPixelRatio: { value: window.devicePixelRatio }
};

const starVert = `
  attribute float aPhase;
  attribute float aSize;
  attribute float aSpeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vPhase;
  varying float vPulse;
  void main() {
    vPhase = aPhase;
    // per-star pulse in range [0,1]
    vPulse = 0.5 + 0.5 * sin(aPhase + uTime * aSpeed);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // make size respond to pulse (stronger effect)
    float size = aSize * (0.6 + 2.0 * vPulse);
    gl_PointSize = size * uPixelRatio;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starFrag = `
  varying float vPhase;
  varying float vPulse;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = dot(uv, uv);
    // soft circular point
    float base = smoothstep(0.25, 0.0, d);
    // modulate alpha and brightness by pulse (stronger)
    float alpha = base * (0.3 + 0.7 * vPulse);
    vec3 col = mix(vec3(0.9,0.95,1.0), vec3(1.0,0.95,0.8), fract(vPhase * 0.159));
    col *= (0.6 + 0.9 * vPulse);
    gl_FragColor = vec4(col, alpha);
  }
`;

const starMat = new THREE.ShaderMaterial({
  uniforms: starUniforms,
  vertexShader: starVert,
  fragmentShader: starFrag,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const starField = new THREE.Points(starsGeo, starMat);
scene.add(starField);

// Snow
const snowCount = 300;
const snowGeo = new THREE.BufferGeometry();
const snowPos = new Float32Array(snowCount * 3);
const snowVel = new Float32Array(snowCount);
for (let i = 0; i < snowCount; i++) {
  snowPos[i * 3 + 0] = (Math.random() - 0.5) * 40;
  snowPos[i * 3 + 1] = Math.random() * 24 + 2;
  // keep snow much closer to camera/origin so it reads differently from distant stars
  snowPos[i * 3 + 2] = (Math.random() - 0.5) * 8 + 2;
  snowVel[i] = 0.01 + Math.random() * 0.02;
}
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snowMat = new THREE.PointsMaterial({ color: 0xf8fbff, size: 0.07, transparent: true, opacity: 0.95, depthTest: true, blending: THREE.NormalBlending });
const snowField = new THREE.Points(snowGeo, snowMat);
// attach snow to camera so it always covers the view (screen-aligned)
camera.add(snowField);
snowField.position.set(0, 0, -6);
snowField.frustumCulled = false;

// Mouse parallax
const mouse = { x: 0, y: 0 };
const targetMouse = { x: 0, y: 0 };
window.addEventListener('mousemove', (e) => {
  targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  targetMouse.y = - (e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(-2, 2, 2);
scene.add(directionalLight);

renderer.render(scene, camera);

function animate() {
  requestAnimationFrame(animate);
  const nowMs = Date.now();
  const dt = (nowMs - (animate._lastTime || nowMs)) / 1000;
  animate._lastTime = nowMs;

  updateOrbits({ Asgard, Niflheim, Midgard, Alfheim, Jotunheim, Vanaheim, Muspelheim, Svartalfheim, Nidavellir }, orbitSpeed);

  // orient planetary rings so they avoid intersecting the central clock face
  for (const pl of planets) {
    if (pl && pl.userData && pl.userData._ring) {
      const ring = pl.userData._ring;
      const worldPos = new THREE.Vector3();
      pl.getWorldPosition(worldPos);
      const dist = worldPos.length();
      const dir = worldPos.clone().normalize();
      let ref = new THREE.Vector3(0, 1, 0);
      if (Math.abs(dir.dot(ref)) > 0.9) ref.set(1, 0, 0);
      const desiredNormal = new THREE.Vector3().crossVectors(dir, ref).normalize();
      if (desiredNormal.lengthSq() < 0.0001) desiredNormal.set(0, 0, 1);
      const from = new THREE.Vector3(0, 0, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(from, desiredNormal);
      // compute parent inverse so we can express desiredNormal and rotation in planet local space
      const parentQuat = new THREE.Quaternion();
      pl.getWorldQuaternion(parentQuat);
      const invParent = parentQuat.clone().invert();
      const localNormal = desiredNormal.clone().applyQuaternion(invParent).normalize();
      // local rotation to align (0,0,1) -> localNormal
      const localQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), localNormal);
      ring.quaternion.copy(localQ);
      // keep ring centered on planet so it surrounds it
      ring.position.set(0, 0, 0);
      // subtle spin around local normal for life
      ring.rotation.z += 0.006;
    }
  }

  // base-9 clock fraction of day (continuous/smooth)
  const now = performance.now ? performance.now() : Date.now();
  // fraction of day using system Date for absolute day fraction
  const d = new Date();
  const msSinceMid = d - new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const fraction = msSinceMid / 86400000;

  // continuous angles: hour completes 1 rotation/day, minute completes 9 rotations/day, second completes 81 rotations/day
  const twoPi = Math.PI * 2;
  const hourAngle = fraction * twoPi;
  const minuteAngle = fraction * 9 * twoPi;
  const secondAngle = fraction * 81 * twoPi;

  // set smooth rotations (negative to match previous orientation)
  hourHand.rotation.z = -hourAngle;
  minuteHand.rotation.z = -minuteAngle;
  secondHand.rotation.z = -secondAngle;

  // pulse runes softly
  const t = Date.now() * 0.001;
  for (let i = 0; i < runeMaterials.length; i++) {
    runeMaterials[i].emissiveIntensity = 0.08 + Math.max(0, Math.sin(t * 1.2 + i)) * 0.18;
  }

  // gentle ring rotation to feel alive
  outerRing.rotation.z += 0.0002;
  innerRing.rotation.z -= 0.00015;

  // animate snow
  const pos = snowGeo.attributes.position.array;
  for (let i = 0; i < snowCount; i++) {
    pos[i * 3 + 1] -= snowVel[i];
    pos[i * 3 + 0] += Math.sin((i * 0.3 + Date.now() * 0.0002)) * 0.02;
    if (pos[i * 3 + 1] < -6) {
      pos[i * 3 + 1] = 20 + Math.random() * 6;
      pos[i * 3 + 0] = (Math.random() - 0.5) * 30;
    }
  }
  snowGeo.attributes.position.needsUpdate = true;

  // animate moons around their parent planets (local coordinates)
  const timeNow = Date.now();
  for (const pl of planets) {
    if (pl && pl.userData && pl.userData.moons) {
      for (const m of pl.userData.moons) {
        const ud = m.userData;
        const a = ud.angleOffset + timeNow * ud.speed;
        const r = ud.orbitRadius || Math.max(0.001, m.position.length());
        // circular orbit in XZ plane then tilt by inclination and yaw for a proper 3D orbit
        const x0 = Math.cos(a) * r;
        const z0 = Math.sin(a) * r;
        const v = new THREE.Vector3(x0, 0, z0);
        // tilt around X
        const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ud.inclination || 0);
        v.applyQuaternion(qx);
        // yaw rotation to vary orbital plane
        const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ud.yaw || 0);
        v.applyQuaternion(qy);
        m.position.copy(v);
      }
    }
  }

  // twinkle stars slightly (global shimmer)
  const st = Math.sin(Date.now() * 0.0015) * 0.12 + 0.8;
  // update shader uniform time for independent star pulses
  starMat.uniforms.uTime.value = Date.now() * 0.001;

  // animate glow rings (pulsing), atmospheres (breathing), and cloud layers (scrolling)
  const nowSec = Date.now() * 0.001;
  for (let i = 0; i < animatedGlowRings.length; i++) {
    const g = animatedGlowRings[i];
    if (!g || !g.material) continue;
    const pulse = 0.85 + 0.15 * Math.sin(nowSec * 0.6 + i);
    g.material.opacity = (g.userData.baseOpacity || 0.12) * pulse;
    g.material.needsUpdate = true;
  }
  for (let i = 0; i < animatedAtmospheres.length; i++) {
    const a = animatedAtmospheres[i];
    if (!a || !a.material) continue;
    const breathe = 0.95 + 0.08 * Math.sin(nowSec * 0.4 + i * 0.7);
    a.material.opacity = (a.userData.baseOpacity || 0.06) * breathe;
    a.material.needsUpdate = true;
    // update fresnel shader if present
    if (a.userData && a.userData.fresnel && a.userData.fresnel.material && a.userData.fresnel.material.uniforms) {
      const fm = a.userData.fresnel.material;
      fm.uniforms.uTime.value = nowSec;
      const pulse = 0.9 + 0.18 * Math.sin(nowSec * 0.9 + i * 0.5);
      fm.uniforms.uIntensity.value = (a.userData.fresnelBaseIntensity || 1.0) * pulse;
      a.userData.fresnel.material.needsUpdate = true;
    }
  }
  for (let i = 0; i < animatedClouds.length; i++) {
    const c = animatedClouds[i];
    if (!c || !c.material || !c.userData) continue;
    // scroll texture coordinates
    c.userData.tex.offset.x = (c.userData.tex.offset.x + c.userData.cloudSpeed * dt) % 1.0;
    c.material.needsUpdate = true;
  }

  // update particle storms (advance positions in local space)
  worldGroup.children.forEach((child) => {
    if (child.userData && child.userData.storm) {
      const s = child.userData.storm;
      const posAttr = s.geo.getAttribute('position');
      const velAttr = s.geo.getAttribute('aVel');
      const pos = posAttr.array;
      const vel = velAttr.array;
      // slowly rotate the storm's wind vector around its axis so the drift evolves
      if (s.wind && typeof s.windRotateSpeed === 'number' && s.windAxis) {
        const q = new THREE.Quaternion().setFromAxisAngle(s.windAxis.clone().normalize(), s.windRotateSpeed * dt);
        s.wind.applyQuaternion(q);
      }
      // seasonal modulation and gusts
      const seasonFactor = 1.0 + 0.35 * Math.sin(nowSec * (s.seasonSpeed || 0.03) + (s.seasonPhase || 0));
      // decay any active gust and occasionally trigger a new gust
      s.gust = Math.max(0, (s.gust || 0) - (s.gustDecayRate || 1.6) * dt);
      if (Math.random() < ((s.gustChance || 0.3) * dt)) {
        s.gust += 0.6 + Math.random() * 1.0; // add transient gust strength
      }
      // precompute applied wind for this frame
      const appliedWind = s.wind ? s.wind.clone().multiplyScalar(seasonFactor + (s.gust || 0)) : new THREE.Vector3(0, 0, 0);
      for (let i = 0; i < s.count; i++) {
        // integrate existing velocity
        pos[i * 3 + 0] += vel[i * 3 + 0] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        // apply wind drift (same wind for all particles in this storm, local space)
        pos[i * 3 + 0] += appliedWind.x * dt;
        pos[i * 3 + 1] += appliedWind.y * dt;
        pos[i * 3 + 2] += appliedWind.z * dt;
        // compute radial restoration toward the target storm radius to prevent runaway
        const px = pos[i * 3 + 0]; const py = pos[i * 3 + 1]; const pz = pos[i * 3 + 2];
        const curR = Math.sqrt(px * px + py * py + pz * pz);
        const tgtR = s.targetRadius || ((child.geometry && child.geometry.parameters && child.geometry.parameters.radius ? child.geometry.parameters.radius : realmRadius) + 0.2);
        const restoreK = 3.2; // strength of restoring force
        if (curR > 1e-6) {
          const scale = (tgtR - curR) * restoreK * dt;
          pos[i * 3 + 0] += (px / curR) * scale;
          pos[i * 3 + 1] += (py / curR) * scale;
          pos[i * 3 + 2] += (pz / curR) * scale;
        }
        // add small tangential swirl and per-particle jitter for variety
        const swirl = 0.6 + Math.sin((i * 0.17 + nowSec * 0.8)) * 0.4;
        const tx = -pz; const ty = 0; const tz = px; // simple perpendicular in XZ
        const tlen = Math.sqrt(tx * tx + tz * tz) || 1.0;
        pos[i * 3 + 0] += (tx / tlen) * (0.006 * swirl) * dt;
        pos[i * 3 + 2] += (tz / tlen) * (0.006 * swirl) * dt;
        pos[i * 3 + 1] += (Math.sin(i * 12.9898 + nowSec * 3.14) * 0.001) * dt; // tiny vertical jitter
        // keep particles from drifting too far — if they exceed a soft cap, respawn nearer the ring
        const vlen = Math.sqrt(pos[i * 3 + 0] * pos[i * 3 + 0] + pos[i * 3 + 1] * pos[i * 3 + 1] + pos[i * 3 + 2] * pos[i * 3 + 2]);
        const maxR = (child.geometry && child.geometry.parameters && child.geometry.parameters.radius ? child.geometry.parameters.radius : realmRadius) + 0.9;
        if (vlen > maxR + 0.6) {
          const ang = Math.random() * Math.PI * 2;
          const lat = (Math.random() - 0.5) * 0.6;
          const r = (child.geometry && child.geometry.parameters && child.geometry.parameters.radius ? child.geometry.parameters.radius : realmRadius) + 0.2 + (Math.random() - 0.5) * 0.06;
          const np = sphericalToCartesian(r, lat, ang);
          pos[i * 3 + 0] = np.x;
          pos[i * 3 + 1] = np.y;
          pos[i * 3 + 2] = np.z;
          // reset velocity to a tangential drift so respawned particles join the swirl
          vel[i * 3 + 0] = -np.z * (s.speed * (0.6 + Math.random() * 0.8));
          vel[i * 3 + 1] = (Math.random() - 0.5) * s.speed * 0.2;
          vel[i * 3 + 2] = np.x * (s.speed * (0.6 + Math.random() * 0.8));
        }
      }
      posAttr.needsUpdate = true;
    }
  });

  // animate volcanic lava glow intensity on planets that have volcano data
  const lavaTime = Date.now() * 0.0025;
  for (const pl of planets) {
    if (!pl || !pl.userData || !pl.userData.volcanoes) continue;
    for (let vi = 0; vi < pl.userData.volcanoes.length; vi++) {
      const v = pl.userData.volcanoes[vi];
      if (!v) continue;
      // gentle pulsing based on time and index to desynchronize
      const pulse = 0.5 + 0.5 * Math.sin(lavaTime * (0.8 + vi * 0.11) + vi);
      if (v.lake && v.lake.material) {
        v.lake.material.emissiveIntensity = (v.baseLavaIntensity || 0.8) * (0.6 + 0.6 * pulse);
        v.lake.material.needsUpdate = true;
      }
      if (v.core && v.core.material) {
        v.core.material.emissiveIntensity = 0.6 + 1.2 * pulse;
        v.core.material.needsUpdate = true;
      }
      // update particles if present (support separate smoke and ember emitters)
      if (v.particles) {
        const planetPos = new THREE.Vector3();
        pl.getWorldPosition(planetPos);
        const distToCamera = camera.position.distanceTo(planetPos);
        const sizeScale = THREE.MathUtils.clamp(6 / Math.max(0.001, distToCamera), 0.35, 3.0);
        const emitters = ['smoke', 'embers'];
        for (const name of emitters) {
          const e = v.particles[name];
          if (!e || !e.geo) continue;
          const posAttr = e.geo.getAttribute('position');
          const velAttr = e.geo.getAttribute('aVel');
          const lifeAttr = e.geo.getAttribute('aLife');
          const n = posAttr.count;
          // scale particle point size based on camera distance so they remain visible when zoomed
          if (e.pts && e.pts.material) e.pts.material.size = (e.baseSize || 0.06) * sizeScale;
          for (let i = 0; i < n; i++) {
            let px = posAttr.array[i * 3 + 0];
            let py = posAttr.array[i * 3 + 1];
            let pz = posAttr.array[i * 3 + 2];
            let vx = velAttr.array[i * 3 + 0];
            let vy = velAttr.array[i * 3 + 1];
            let vz = velAttr.array[i * 3 + 2];
            let lifeVal = lifeAttr.array[i];
            // apply local-normal acceleration (push outward from planet)
            const ln = v.particles.localNormal || new THREE.Vector3(0, 1, 0);
            vx += ln.x * 0.02 * dt;
            vy += ln.y * 0.02 * dt;
            vz += ln.z * 0.02 * dt;
            // small random spread
            vx += (Math.random() - 0.5) * 0.002;
            vy += (Math.random() - 0.5) * 0.002;
            vz += (Math.random() - 0.5) * 0.002;
            // advance in local space
            px += vx * dt;
            py += vy * dt;
            pz += vz * dt;
            lifeVal -= dt;
            // reset conditions relative to the local origin
            const ox = v.particles.originLocal.x; const oy = v.particles.originLocal.y; const oz = v.particles.originLocal.z;
            const dx = px - ox; const dy = py - oy; const dz = pz - oz;
            const distSq = dx * dx + dy * dy + dz * dz;
            if (lifeVal <= 0 || distSq > 1.5) {
              // reset to origin (local) with fresh velocity
              px = ox + (Math.random() - 0.5) * 0.02;
              py = oy + (Math.random() - 0.5) * 0.015;
              pz = oz + (Math.random() - 0.5) * 0.02;
              const speed = (name === 'embers' ? 0.03 : 0.015) * (0.8 + Math.random() * 1.2);
              const rv = new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.9, (Math.random() - 0.5) * 0.4).normalize();
              vx = rv.x * speed; vy = rv.y * speed; vz = rv.z * speed;
              lifeVal = 0.6 + Math.random() * 1.6;
            }
            posAttr.array[i * 3 + 0] = px;
            posAttr.array[i * 3 + 1] = py;
            posAttr.array[i * 3 + 2] = pz;
            velAttr.array[i * 3 + 0] = vx;
            velAttr.array[i * 3 + 1] = vy;
            velAttr.array[i * 3 + 2] = vz;
            lifeAttr.array[i] = lifeVal;
          }
          posAttr.needsUpdate = true;
          velAttr.needsUpdate = true;
          lifeAttr.needsUpdate = true;
        }
      }
    }
  }

  // animate floating islands (bob + slow rotation)
  for (const pl of planets) {
    if (pl && pl.userData && pl.userData.island) {
      const isl = pl.userData.island;
      const baseY = isl.userData.baseY || isl.position.y;
      const amp = isl.userData.floatAmp || 0.02;
      const sp = isl.userData.floatSpeed || 0.8;
      isl.position.y = baseY + Math.sin(nowSec * sp) * amp;
      isl.rotation.y += 0.02 * dt;
      // animate waterfalls (texture scroll) and mist emitters
      if (isl.userData && isl.userData.waterfalls) {
        for (let wi = 0; wi < isl.userData.waterfalls.length; wi++) {
          const wf = isl.userData.waterfalls[wi];
          if (!wf || !wf.tex) continue;
          // scroll waterfall texture downward to imply flow
          wf.tex.offset.y = ((wf.tex.offset.y || 0) + wf.speed * dt) % 1.0;
          if (wf.mesh && wf.mesh.material && wf.mesh.material.map) wf.mesh.material.map = wf.tex;
        }
      }
      let baseRadius = 0.5;
      if (isl.userData && isl.userData.mistEmitters) {
        for (let mi = 0; mi < isl.userData.mistEmitters.length; mi++) {
          const em = isl.userData.mistEmitters[mi];
          if (!em || !em.geo) continue;
          const posAttr = em.geo.getAttribute('position');
          const velAttr = em.geo.getAttribute('aVel');
          const lifeAttr = em.geo.getAttribute('aLife');
          const pArr = posAttr.array; const vArr = velAttr.array; const lArr = lifeAttr.array;
          for (let i = 0; i < em.count; i++) {
            let px = pArr[i * 3 + 0]; let py = pArr[i * 3 + 1]; let pz = pArr[i * 3 + 2];
            let vx = vArr[i * 3 + 0]; let vy = vArr[i * 3 + 1]; let vz = vArr[i * 3 + 2];
            let life = lArr[i];
            // advance
            px += vx * dt;
            py += vy * dt;
            pz += vz * dt;
            life -= dt * (0.4 + Math.random() * 0.6);
            // gentle spread and fade upwards
            if (life <= 0 || py > (em.baseYPos + 0.5 * baseRadius)) {
              // respawn near base
              px = em.baseX + (Math.random() - 0.5) * 0.2 * baseRadius;
              py = em.baseYPos + (Math.random()) * 0.04 * baseRadius;
              pz = em.baseZ + (Math.random() - 0.5) * 0.2 * baseRadius;
              vx = (Math.random() - 0.5) * 0.002;
              vy = 0.01 + Math.random() * 0.02;
              vz = (Math.random() - 0.5) * 0.002;
              life = 0.6 + Math.random() * 1.2;
            }
            pArr[i * 3 + 0] = px; pArr[i * 3 + 1] = py; pArr[i * 3 + 2] = pz;
            vArr[i * 3 + 0] = vx; vArr[i * 3 + 1] = vy; vArr[i * 3 + 2] = vz;
            lArr[i] = life;
          }
          posAttr.needsUpdate = true; velAttr.needsUpdate = true; lifeAttr.needsUpdate = true;
        }
      }
    }
  }

  // update camera animation if active (interpolate cameraBase and cameraTarget)
  if (cameraAnim.active) {
    const nowTime = performance.now();
    const elapsed = Math.min(1, (nowTime - cameraAnim.startTime) / cameraAnim.duration);
    const tnorm = elapsed;
    // cubic ease
    const ease = tnorm < 0.5 ? 4 * tnorm * tnorm * tnorm : 1 - Math.pow(-2 * tnorm + 2, 3) / 2;
    cameraBase.lerpVectors(cameraAnim.fromBase, cameraAnim.toBase, ease);
    cameraTarget.lerpVectors(cameraAnim.fromTarget, cameraAnim.toTarget, ease);
    if (elapsed >= 1) {
      cameraAnim.active = false;
      // if a follow target was requested for this animation, enable follow now
      if (cameraAnim.followOnComplete) {
        cameraFollow = cameraAnim.followOnComplete;
        // compute offset = toBase - toTarget so camera keeps same relative placement
        cameraFollowOffset.copy(cameraAnim.toBase).sub(cameraAnim.toTarget);
        cameraAnim.followOnComplete = null;
      }
    }
  }

  // if following a planet, update the cameraBase/Target each frame to track it
  if (cameraFollow) {
    const wp = new THREE.Vector3();
    cameraFollow.getWorldPosition(wp);
    const desiredTarget = wp;
    const desiredBase = wp.clone().add(cameraFollowOffset);
    // blend a little for smoothness
    cameraBase.lerp(desiredBase, 0.12);
    cameraTarget.lerp(desiredTarget, 0.18);
  }

  // mouse parallax: smoothly lerp camera towards base + parallax offset, then look at the clock target
  const parallax = new THREE.Vector3(targetMouse.x * 1.8, targetMouse.y * 0.9, 0);
  camera.position.x += ((cameraBase.x + parallax.x) - camera.position.x) * 0.06;
  camera.position.y += ((cameraBase.y + parallax.y) - camera.position.y) * 0.06;
  camera.position.z += ((cameraBase.z + parallax.z) - camera.position.z) * 0.06;
  camera.lookAt(cameraTarget);

  renderer.render(scene, camera);
}

animate();