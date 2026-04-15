import * as THREE from 'three';
import { createParticleTexture } from './sceneSetup.js';
import { loading } from './loader.js';
import { realmRadius as defaultRealmRadius } from './settings.js';

export function sphericalToCartesian(radius, lat, lon) {
  const x = radius * Math.cos(lat) * Math.cos(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.sin(lon);
  return new THREE.Vector3(x, y, z);
}

export function addMoon(planet, { radius = 0.07, distance = 0.5, color = 0xffffff, speed = 0.001 } = {}) {
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

export function addPlanetRing(planet, { ringOffset = 0.45, thickness = 0.03, color = 0x999999, opacity = 0.7, rotationX = Math.PI / 2, rotationZ = 0 } = {}) {
  const base = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : defaultRealmRadius;
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

export function addGlowRing(planet, { color = 0x88ccff, inner = 0.6, outer = 0.8, opacity = 0.25 } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : defaultRealmRadius;
  const innerR = radius + inner; const outerR = radius + outer;
  const geo = new THREE.RingGeometry(innerR, outerR, 64);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  planet.add(mesh);
  mesh.userData = mesh.userData || {};
  mesh.userData.baseOpacity = opacity;
  return mesh;
}

export function addThinAtmosphere(planet, { color = 0xaaddff, opacity = 0.08, rimColor = 0xaaddff, fresnelIntensity = 0.9 } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : defaultRealmRadius;
  const geo = new THREE.SphereGeometry(radius * 1.06, 32, 16);
  const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, side: THREE.BackSide, depthWrite: false });
  const sph = new THREE.Mesh(geo, mat);
  planet.add(sph);
  sph.userData = sph.userData || {};
  sph.userData.baseOpacity = opacity;

  // fresnel shader
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
  sph.userData.fresnel = fresnel;
  sph.userData.fresnelBaseIntensity = fresnelIntensity;
  return sph;
}

export function addParticleStorm(planet, { count = 200, radiusOffset = 0.2, speed = 0.02, color = 0xcccccc, size = 0.06 } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : defaultRealmRadius;
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
    const t = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang)).multiplyScalar(speed * (0.6 + Math.random() * 0.8));
    vel[i * 3 + 0] = t.x;
    vel[i * 3 + 1] = (Math.random() - 0.5) * speed * 0.2;
    vel[i * 3 + 2] = t.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  const pTex = createParticleTexture(64, 'rgba(200,200,200,0.9)', 'rgba(0,0,0,0)');
  loading.add(Promise.resolve(pTex));
  const mat = new THREE.PointsMaterial({ color, size, map: pTex, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.NormalBlending });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  planet.add(points);
  const wind = new THREE.Vector3((Math.random() - 0.5) * 0.02, (Math.random() - 0.2) * 0.008, (Math.random() - 0.5) * 0.02);
  const windRotateSpeed = (Math.random() * 0.6 - 0.3) * 0.8;
  const windAxis = new THREE.Vector3(0, 1, 0);
  const seasonPhase = Math.random() * Math.PI * 2;
  const seasonSpeed = 0.02 + Math.random() * 0.04;
  planet.userData.storm = { geo, points, count, speed, wind, windRotateSpeed, windAxis, seasonPhase, seasonSpeed, gust: 0.0, gustDecayRate: 1.6 + Math.random() * 1.2, gustChance: 0.25 + Math.random() * 0.5, targetRadius: radius + radiusOffset };
  return planet.userData.storm;
}

export function createCloudLayer(planet, { color = 0xffffff, opacity = 0.18, speed = 0.02, scale = 1.08, density = 80, white = false } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : defaultRealmRadius;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const blobs = Math.max(6, Math.floor(density));
  for (let i = 0; i < blobs; i++) {
    const bx = Math.random() * size;
    const by = Math.random() * size;
    const br = size * (0.02 + Math.random() * 0.18);
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
  loading.add(Promise.resolve(tex));
  const geo = new THREE.SphereGeometry(radius * scale, 48, 16);
  const mat = new THREE.MeshStandardMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData = { cloudSpeed: speed, tex };
  planet.add(mesh);
  return mesh;
}

export function scatterCones(planet, { count = 10, minH = 0.03, maxH = 0.12, color = 0x555555 } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : defaultRealmRadius;
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

export function scatterLights(planet, { count = 8, color = 0xffaa55, intensity = 0.8 } = {}) {
  const radius = (planet.geometry && planet.geometry.parameters && planet.geometry.parameters.radius) ? planet.geometry.parameters.radius : defaultRealmRadius;
  for (let i = 0; i < count; i++) {
    const lat = (Math.random() - 0.5) * Math.PI * 0.8;
    const lon = Math.random() * Math.PI * 2;
    const pos = sphericalToCartesian(radius + 0.01, lat, lon);
    const pLight = new THREE.PointLight(color, intensity * (0.6 + Math.random() * 0.8), 1.6);
    pLight.position.copy(pos);
    planet.add(pLight);
  }
}

export default { sphericalToCartesian, addMoon, addPlanetRing, addGlowRing, addThinAtmosphere, addParticleStorm, createCloudLayer, scatterCones, scatterLights };
