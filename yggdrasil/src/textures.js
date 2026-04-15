import * as THREE from 'three';
import { loading } from './loader.js';

export function hexToRgb(hex) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
export function mixColor(a, b, t) {
  return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) };
}
export function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA); const b = hexToRgb(hexB);
  const m = mixColor(a, b, Math.max(0, Math.min(1, t)));
  return (m.r << 16) | (m.g << 8) | m.b;
}
export function shadeColor(hex, percent) {
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

export function makePlanetTexture(colorA, colorB) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size * 0.35, size * 0.35, size * 0.1, size * 0.5, size * 0.5, size * 0.9);
  grad.addColorStop(0, colorA);
  grad.addColorStop(1, colorB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    const y = Math.random() * size;
    ctx.fillRect(0, y, size, 2 + Math.random() * 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  // register as a completed loading task so the loader knows about
  loading.add(Promise.resolve(tex));
  return tex;
}

export function makeContinentalTexture(oceanColor = '#1b5d2b', landColor = '#63c66b', size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

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
  for (let j = 0; j < size; j++) {
    const v = j / size;
    const lat = v * Math.PI - Math.PI / 2;
    const latFactor = Math.cos(lat) * 0.8 + 0.2;
    for (let i = 0; i < size; i++) {
      const u = i / size;
      const lon = u * Math.PI * 2;
      const nx = Math.cos(lon) * latFactor * 1.2;
      const ny = Math.sin(lon) * latFactor * 1.2;
      const e = fbm(nx * 2.0 + 10.0, ny * 2.0 + 10.0, 5);
      const mask = Math.pow(Math.max(0, 1.0 - Math.abs(lat) / (Math.PI * 0.5)), 1.2);
      const elevation = (e * 0.9 + 0.1 * fbm(nx * 6.0, ny * 6.0, 2)) * mask;
      const landThreshold = 0.47 + (Math.sin(lat * 3.0) * 0.02);
      const idx = (j * size + i) * 4;
      if (elevation > landThreshold) {
        const shade = Math.floor(lerpColor(landColor, shadeColor(landColor, -18), Math.min(1, (elevation - landThreshold) * 3.0)));
        img.data[idx + 0] = (shade >> 16) & 255;
        img.data[idx + 1] = (shade >> 8) & 255;
        img.data[idx + 2] = shade & 255;
        img.data[idx + 3] = 255;
      } else {
        const t = Math.max(0, (landThreshold - elevation) / landThreshold);
        const deep = hexToRgb(oceanColor);
        const shore = mixColor(deep, { r: 80, g: 160, b: 255 }, Math.pow(1 - t, 1.6));
        img.data[idx + 0] = shore.r;
        img.data[idx + 1] = shore.g;
        img.data[idx + 2] = shore.b;
        img.data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = size / 2;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(tmp, 0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  // register as a completed loading task so main can await it if desired
  loading.add(Promise.resolve(tex));
  return tex;
}
