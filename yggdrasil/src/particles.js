import * as THREE from 'three';
import { createParticleTexture } from './sceneSetup.js';

// create a simple particle emitter for a volcano: returns an object with geometry and points
export function createVolcanoParticles(planet, { origin = new THREE.Vector3(), normal = new THREE.Vector3(0, 1, 0), count = 72 } = {}) {
  // convert provided world-space origin/normal into planet-local space
  const worldOrigin = origin.clone();
  const worldNormal = normal.clone().normalize();
  const planetWorldQuat = new THREE.Quaternion();
  planet.getWorldQuaternion(planetWorldQuat);
  const invPlanetQuat = planetWorldQuat.clone().invert();
  const localOrigin = worldOrigin.clone();
  planet.worldToLocal(localOrigin);
  const localNormal = worldNormal.clone().applyQuaternion(invPlanetQuat).normalize();

  // particle textures
  const smokeParticleTex = createParticleTexture(128, 'rgba(160,140,120,0.95)', 'rgba(0,0,0,0)');
  const emberParticleTex = createParticleTexture(64, 'rgba(255,180,110,0.95)', 'rgba(0,0,0,0)');

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

  const smoke = makeEmitter(Math.max(16, Math.floor(smokeCount * 0.6)), 0.012, 0.08, 0x332622, false, smokeParticleTex);
  const embers = makeEmitter(Math.max(6, Math.floor(emberCount * 0.6)), 0.03, 0.04, 0xff8a33, true, emberParticleTex);

  return { smoke, embers, originLocal: localOrigin.clone(), localNormal };
}

export default { createVolcanoParticles };
