import * as THREE from 'three';
import { loading } from './loader.js';

// Centralized scene / camera / renderer setup
export const scene = new THREE.Scene();

export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

export const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
  antialias: true
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// small helper: create a soft radial particle texture on a canvas
export function createParticleTexture(size, innerColor, outerColor) {
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

// keep the canvas responsive
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// shared particle textures used by other modules
export const smokeParticleTex = createParticleTexture(128, 'rgba(160,140,120,0.95)', 'rgba(0,0,0,0)');
export const emberParticleTex = createParticleTexture(64, 'rgba(255,180,110,0.95)', 'rgba(0,0,0,0)');
// register the generated particle textures so loader can await them
loading.add(Promise.resolve(smokeParticleTex));
loading.add(Promise.resolve(emberParticleTex));

export default { scene, camera, renderer, createParticleTexture, smokeParticleTex, emberParticleTex };
