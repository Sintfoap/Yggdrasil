import * as THREE from 'three';

// createAnimator takes a context object with required scene elements and returns
// { start(), stop() } to control the animation loop.
export function createAnimator(ctx) {
  let rafId = null;

  function animateFrame() {
    rafId = requestAnimationFrame(animateFrame);
    const nowMs = Date.now();
    const dt = (nowMs - (animateFrame._lastTime || nowMs)) / 1000;
    animateFrame._lastTime = nowMs;

    const {
      updateOrbits, planets, orbitSpeed, worldGroup,
      animatedGlowRings, animatedAtmospheres, animatedClouds,
      snowGeo, snowCount, snowVel,
      starMat, runeMaterials,
      outerRing, innerRing,
      hourHand, minuteHand, secondHand,
      camera, cameraBase, cameraTarget, cameraAnim, cameraFollow, cameraFollowOffset,
      renderer
    } = ctx;

    if (updateOrbits && planets && orbitSpeed !== undefined) {
      try { updateOrbits({ Asgard: planets[0], Niflheim: planets[1], Midgard: planets[2], Alfheim: planets[3], Jotunheim: planets[4], Vanaheim: planets[5], Muspelheim: planets[6], Svartalfheim: planets[7], Nidavellir: planets[8] }, orbitSpeed); } catch (e) { }

      // orient planetary rings and animate subtle ring spin
      for (const pl of planets) {
        if (pl && pl.userData && pl.userData._ring) {
          const ring = pl.userData._ring;
          const worldPos = new THREE.Vector3();
          pl.getWorldPosition(worldPos);
          const dir = worldPos.clone().normalize();
          let ref = new THREE.Vector3(0, 1, 0);
          if (Math.abs(dir.dot(ref)) > 0.9) ref.set(1, 0, 0);
          const desiredNormal = new THREE.Vector3().crossVectors(dir, ref).normalize();
          if (desiredNormal.lengthSq() < 0.0001) desiredNormal.set(0, 0, 1);
          const parentQuat = new THREE.Quaternion();
          pl.getWorldQuaternion(parentQuat);
          const invParent = parentQuat.clone().invert();
          const localNormal = desiredNormal.clone().applyQuaternion(invParent).normalize();
          const localQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), localNormal);
          ring.quaternion.copy(localQ);
          ring.position.set(0, 0, 0);
          ring.rotation.z += 0.006;
        }
      }

      // clock hands (time-based)
      const d = new Date();
      const msSinceMid = d - new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const fraction = msSinceMid / 86400000;
      const twoPi = Math.PI * 2;
      const hourAngle = fraction * twoPi;
      const minuteAngle = fraction * 9 * twoPi;
      const secondAngle = fraction * 81 * twoPi;
      if (hourHand) hourHand.rotation.z = -hourAngle;
      if (minuteHand) minuteHand.rotation.z = -minuteAngle;
      if (secondHand) secondHand.rotation.z = -secondAngle;

      // rune pulses
      const t = Date.now() * 0.001;
      if (runeMaterials) for (let i = 0; i < runeMaterials.length; i++) runeMaterials[i].emissiveIntensity = 0.08 + Math.max(0, Math.sin(t * 1.2 + i)) * 0.18;

      // gentle ring movement
      if (outerRing) outerRing.rotation.z += 0.0002;
      if (innerRing) innerRing.rotation.z -= 0.00015;

      // snow
      if (snowGeo && snowCount && snowVel) {
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
      }

      // update storms
      if (worldGroup && worldGroup.children) {
        worldGroup.children.forEach((child) => {
          if (child.userData && child.userData.storm) {
            const s = child.userData.storm;
            const posAttr = s.geo.getAttribute('position');
            const velAttr = s.geo.getAttribute('aVel');
            const pos = posAttr.array; const vel = velAttr.array;
            if (s.wind && typeof s.windRotateSpeed === 'number' && s.windAxis) {
              const q = new THREE.Quaternion().setFromAxisAngle(s.windAxis.clone().normalize(), s.windRotateSpeed * dt);
              s.wind.applyQuaternion(q);
            }
            const nowSec = Date.now() * 0.001;
            const seasonFactor = 1.0 + 0.35 * Math.sin(nowSec * (s.seasonSpeed || 0.03) + (s.seasonPhase || 0));
            s.gust = Math.max(0, (s.gust || 0) - (s.gustDecayRate || 1.6) * dt);
            if (Math.random() < ((s.gustChance || 0.3) * dt)) s.gust += 0.6 + Math.random() * 1.0;
            const appliedWind = s.wind ? s.wind.clone().multiplyScalar(seasonFactor + (s.gust || 0)) : new THREE.Vector3(0, 0, 0);
            for (let i = 0; i < s.count; i++) {
              pos[i * 3 + 0] += vel[i * 3 + 0] * dt + appliedWind.x * dt;
              pos[i * 3 + 1] += vel[i * 3 + 1] * dt + appliedWind.y * dt;
              pos[i * 3 + 2] += vel[i * 3 + 2] * dt + appliedWind.z * dt;
              const px = pos[i * 3 + 0]; const py = pos[i * 3 + 1]; const pz = pos[i * 3 + 2];
              const curR = Math.sqrt(px * px + py * py + pz * pz);
              const tgtR = s.targetRadius || ((child.geometry && child.geometry.parameters && child.geometry.parameters.radius ? child.geometry.parameters.radius : 0.36) + 0.2);
              const restoreK = 3.2;
              if (curR > 1e-6) {
                const scale = (tgtR - curR) * restoreK * dt;
                pos[i * 3 + 0] += (px / curR) * scale;
                pos[i * 3 + 1] += (py / curR) * scale;
                pos[i * 3 + 2] += (pz / curR) * scale;
              }
              const swirl = 0.6 + Math.sin((i * 0.17 + nowSec * 0.8)) * 0.4;
              const tx = -pz; const tz = px;
              const tlen = Math.sqrt(tx * tx + tz * tz) || 1.0;
              pos[i * 3 + 0] += (tx / tlen) * (0.006 * swirl) * dt;
              pos[i * 3 + 2] += (tz / tlen) * (0.006 * swirl) * dt;
              pos[i * 3 + 1] += (Math.sin(i * 12.9898 + nowSec * 3.14) * 0.001) * dt;
              const vlen = Math.sqrt(pos[i * 3 + 0] * pos[i * 3 + 0] + pos[i * 3 + 1] * pos[i * 3 + 1] + pos[i * 3 + 2] * pos[i * 3 + 2]);
              const maxR = (child.geometry && child.geometry.parameters && child.geometry.parameters.radius ? child.geometry.parameters.radius : 0.36) + 0.9;
              if (vlen > maxR + 0.6) {
                const ang = Math.random() * Math.PI * 2;
                const lat = (Math.random() - 0.5) * 0.6;
                const r = (child.geometry && child.geometry.parameters && child.geometry.parameters.radius ? child.geometry.parameters.radius : 0.36) + 0.2 + (Math.random() - 0.5) * 0.06;
                const np = new THREE.Vector3(Math.cos(ang) * Math.cos(lat) * r, Math.sin(lat) * r, Math.sin(ang) * Math.cos(lat) * r);
                pos[i * 3 + 0] = np.x; pos[i * 3 + 1] = np.y; pos[i * 3 + 2] = np.z;
                vel[i * 3 + 0] = -np.z * (s.speed * (0.6 + Math.random() * 0.8));
                vel[i * 3 + 1] = (Math.random() - 0.5) * s.speed * 0.2;
                vel[i * 3 + 2] = np.x * (s.speed * (0.6 + Math.random() * 0.8));
              }
            }
            posAttr.needsUpdate = true;
          }
        });
      }

      // animate volcanoes, islands, particles, clouds, atmospheres
      const lavaTime = Date.now() * 0.0025;
      for (const pl of planets) {
        if (!pl || !pl.userData) continue;
        if (pl.userData.volcanoes) {
          for (let vi = 0; vi < pl.userData.volcanoes.length; vi++) {
            const v = pl.userData.volcanoes[vi]; if (!v) continue;
            const pulse = 0.5 + 0.5 * Math.sin(lavaTime * (0.8 + vi * 0.11) + vi);
            if (v.lake && v.lake.material) { v.lake.material.emissiveIntensity = (v.baseLavaIntensity || 0.8) * (0.6 + 0.6 * pulse); v.lake.material.needsUpdate = true; }
            if (v.core && v.core.material) { v.core.material.emissiveIntensity = 0.6 + 1.2 * pulse; v.core.material.needsUpdate = true; }
            if (v.particles) {
              const planetPos = new THREE.Vector3(); pl.getWorldPosition(planetPos);
              const distToCamera = camera.position.distanceTo(planetPos);
              const sizeScale = THREE.MathUtils.clamp(6 / Math.max(0.001, distToCamera), 0.35, 3.0);
              for (const name of ['smoke', 'embers']) {
                const e = v.particles[name]; if (!e || !e.geo) continue;
                const posAttr = e.geo.getAttribute('position'); const velAttr = e.geo.getAttribute('aVel'); const lifeAttr = e.geo.getAttribute('aLife');
                const n = posAttr.count;
                if (e.pts && e.pts.material) e.pts.material.size = (e.baseSize || 0.06) * sizeScale;
                for (let i = 0; i < n; i++) {
                  let px = posAttr.array[i * 3 + 0]; let py = posAttr.array[i * 3 + 1]; let pz = posAttr.array[i * 3 + 2];
                  let vx = velAttr.array[i * 3 + 0]; let vy = velAttr.array[i * 3 + 1]; let vz = velAttr.array[i * 3 + 2];
                  let lifeVal = lifeAttr.array[i];
                  const ln = v.particles.localNormal || new THREE.Vector3(0, 1, 0);
                  vx += ln.x * 0.02 * dt; vy += ln.y * 0.02 * dt; vz += ln.z * 0.02 * dt;
                  vx += (Math.random() - 0.5) * 0.002; vy += (Math.random() - 0.5) * 0.002; vz += (Math.random() - 0.5) * 0.002;
                  px += vx * dt; py += vy * dt; pz += vz * dt; lifeVal -= dt;
                  const ox = v.particles.originLocal.x; const oy = v.particles.originLocal.y; const oz = v.particles.originLocal.z;
                  const dx = px - ox; const dy = py - oy; const dz = pz - oz; const distSq = dx * dx + dy * dy + dz * dz;
                  if (lifeVal <= 0 || distSq > 1.5) {
                    px = ox + (Math.random() - 0.5) * 0.02; py = oy + (Math.random() - 0.5) * 0.015; pz = oz + (Math.random() - 0.5) * 0.02;
                    const speed = (name === 'embers' ? 0.03 : 0.015) * (0.8 + Math.random() * 1.2);
                    const rv = new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.9, (Math.random() - 0.5) * 0.4).normalize();
                    vx = rv.x * speed; vy = rv.y * speed; vz = rv.z * speed; lifeVal = 0.6 + Math.random() * 1.6;
                  }
                  posAttr.array[i * 3 + 0] = px; posAttr.array[i * 3 + 1] = py; posAttr.array[i * 3 + 2] = pz;
                  velAttr.array[i * 3 + 0] = vx; velAttr.array[i * 3 + 1] = vy; velAttr.array[i * 3 + 2] = vz; lifeAttr.array[i] = lifeVal;
                }
                posAttr.needsUpdate = true; velAttr.needsUpdate = true; lifeAttr.needsUpdate = true;
              }
            }
          }
        }
        // islands
        if (pl.userData && pl.userData.island) {
          const isl = pl.userData.island; const baseY = isl.userData.baseY || isl.position.y; const amp = isl.userData.floatAmp || 0.02; const sp = isl.userData.floatSpeed || 0.8;
          isl.position.y = baseY + Math.sin(Date.now() * 0.001 * sp) * amp;
          isl.rotation.y += 0.02 * dt;
          if (isl.userData && isl.userData.waterfalls) {
            for (let wi = 0; wi < isl.userData.waterfalls.length; wi++) {
              const wf = isl.userData.waterfalls[wi]; if (!wf || !wf.tex) continue; wf.tex.offset.y = ((wf.tex.offset.y || 0) + wf.speed * dt) % 1.0; if (wf.mesh && wf.mesh.material && wf.mesh.material.map) wf.mesh.material.map = wf.tex;
            }
          }
          if (isl.userData && isl.userData.mistEmitters) {
            for (let mi = 0; mi < isl.userData.mistEmitters.length; mi++) {
              const em = isl.userData.mistEmitters[mi]; if (!em || !em.geo) continue;
              const posAttr = em.geo.getAttribute('position'); const velAttr = em.geo.getAttribute('aVel'); const lifeAttr = em.geo.getAttribute('aLife');
              const pArr = posAttr.array; const vArr = velAttr.array; const lArr = lifeAttr.array; for (let i = 0; i < em.count; i++) {
                let px = pArr[i * 3 + 0]; let py = pArr[i * 3 + 1]; let pz = pArr[i * 3 + 2]; let vx = vArr[i * 3 + 0]; let vy = vArr[i * 3 + 1]; let vz = vArr[i * 3 + 2]; let life = lArr[i];
                px += vx * dt; py += vy * dt; pz += vz * dt; life -= dt * (0.4 + Math.random() * 0.6);
                if (life <= 0 || py > (em.baseYPos + 0.5 * (isl.userData.baseRadius || 0.5))) {
                  px = em.baseX + (Math.random() - 0.5) * 0.2 * (isl.userData.baseRadius || 0.5);
                  py = em.baseYPos + (Math.random()) * 0.04 * (isl.userData.baseRadius || 0.5);
                  pz = em.baseZ + (Math.random() - 0.5) * 0.2 * (isl.userData.baseRadius || 0.5);
                  vx = (Math.random() - 0.5) * 0.002; vy = 0.01 + Math.random() * 0.02; vz = (Math.random() - 0.5) * 0.002; life = 0.6 + Math.random() * 1.2;
                }
                pArr[i * 3 + 0] = px; pArr[i * 3 + 1] = py; pArr[i * 3 + 2] = pz; vArr[i * 3 + 0] = vx; vArr[i * 3 + 1] = vy; vArr[i * 3 + 2] = vz; lArr[i] = life;
              }
              posAttr.needsUpdate = true; velAttr.needsUpdate = true; lifeAttr.needsUpdate = true;
            }
          }
        }
      }

      // animated rings, atmospheres, clouds
      const nowSec = Date.now() * 0.001;
      for (let i = 0; i < animatedGlowRings.length; i++) {
        const g = animatedGlowRings[i]; if (!g || !g.material) continue; const pulse = 0.85 + 0.15 * Math.sin(nowSec * 0.6 + i); g.material.opacity = (g.userData.baseOpacity || 0.12) * pulse; g.material.needsUpdate = true;
      }
      for (let i = 0; i < animatedAtmospheres.length; i++) {
        const a = animatedAtmospheres[i]; if (!a || !a.material) continue; const breathe = 0.95 + 0.08 * Math.sin(nowSec * 0.4 + i * 0.7); a.material.opacity = (a.userData.baseOpacity || 0.06) * breathe; a.material.needsUpdate = true; if (a.userData && a.userData.fresnel && a.userData.fresnel.material && a.userData.fresnel.material.uniforms) { const fm = a.userData.fresnel.material; fm.uniforms.uTime.value = nowSec; const pulse = 0.9 + 0.18 * Math.sin(nowSec * 0.9 + i * 0.5); fm.uniforms.uIntensity.value = (a.userData.fresnelBaseIntensity || 1.0) * pulse; a.userData.fresnel.material.needsUpdate = true; }
      }
      for (let i = 0; i < animatedClouds.length; i++) {
        const c = animatedClouds[i]; if (!c || !c.material || !c.userData) continue; c.userData.tex.offset.x = (c.userData.tex.offset.x + c.userData.cloudSpeed * dt) % 1.0; c.material.needsUpdate = true;
      }

      // camera animation
      if (cameraAnim && cameraAnim.active) {
        const nowTime = performance.now();
        const elapsed = Math.min(1, (nowTime - cameraAnim.startTime) / cameraAnim.duration);
        const tnorm = elapsed;
        const ease = tnorm < 0.5 ? 4 * tnorm * tnorm * tnorm : 1 - Math.pow(-2 * tnorm + 2, 3) / 2;
        cameraBase.lerpVectors(cameraAnim.fromBase, cameraAnim.toBase, ease);
        cameraTarget.lerpVectors(cameraAnim.fromTarget, cameraAnim.toTarget, ease);
        if (elapsed >= 1) {
          cameraAnim.active = false;
          if (cameraAnim.followOnComplete) {
            ctx.cameraFollow = cameraAnim.followOnComplete;
            cameraFollowOffset.copy(cameraAnim.toBase).sub(cameraAnim.toTarget);
            cameraAnim.followOnComplete = null;
          }
        }
      }

      // following
      if (ctx.cameraFollow) {
        const wp = new THREE.Vector3(); ctx.cameraFollow.getWorldPosition(wp);
        const desiredTarget = wp; const desiredBase = wp.clone().add(cameraFollowOffset);
        cameraBase.lerp(desiredBase, 0.12); cameraTarget.lerp(desiredTarget, 0.18);
      }

      // mouse parallax + apply camera base
      const targetMouse = ctx.targetMouse || { x: 0, y: 0 };
      const parallax = new THREE.Vector3(targetMouse.x * 1.8, targetMouse.y * 0.9, 0);
      camera.position.x += ((cameraBase.x + parallax.x) - camera.position.x) * 0.06;
      camera.position.y += ((cameraBase.y + parallax.y) - camera.position.y) * 0.06;
      camera.position.z += ((cameraBase.z + parallax.z) - camera.position.z) * 0.06;
      camera.lookAt(cameraTarget);

      // final render
      renderer.render(ctx.scene, camera);
    }
  }

  return {
    start() { if (!rafId) animateFrame(); },
    stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
  };
}

export default { createAnimator };
