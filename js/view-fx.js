// Efectos visuales con Object Pooling: trazadores, partículas (un solo draw call), destello y retroceso.
import * as THREE from 'three';

const NP = 320; // partículas máximas
const NT = 10;  // trazadores máximos

export function createFx(scene, camera) {
  // --- Partículas: un único Points con buffers reutilizados ---
  const pos = new Float32Array(NP * 3), col = new Float32Array(NP * 3), base = new Float32Array(NP * 3);
  const vel = new Float32Array(NP * 3), life = new Float32Array(NP), max = new Float32Array(NP).fill(1);
  for (let i = 0; i < NP; i++) pos[i * 3 + 1] = -100;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.07, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  pts.frustumCulled = false;
  scene.add(pts);
  let pi = 0;

  // --- Trazadores de bala ---
  const tg = new THREE.CylinderGeometry(0.012, 0.012, 1, 5).rotateX(Math.PI / 2);
  const tracers = [];
  for (let i = 0; i < NT; i++) {
    const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({
      color: new THREE.Color(3, 2.2, 1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false; m.userData.life = 0; scene.add(m); tracers.push(m);
  }
  let ti = 0;

  // --- Destello de boca (luz siempre activa para no recompilar shaders) ---
  const flash = new THREE.PointLight(0xffa860, 0, 8, 2);
  flash.position.set(0.15, -0.1, -0.8);
  camera.add(flash);

  const fx = { kick: 0, shake: 0, flashT: 0 };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  fx.burst = (x, y, z, r, g, b, n, speed) => { // chispas / niebla de sangre
    for (let k = 0; k < n; k++) {
      const i = pi; pi = (pi + 1) % NP;
      pos.set([x, y, z], i * 3);
      vel.set([(Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.5) * speed], i * 3);
      base.set([r, g, b], i * 3);
      life[i] = max[i] = 0.35 + Math.random() * 0.45;
    }
  };

  fx.shoot = (end, from) => { // trazador desde el arma (o desde `from`, un enemigo) hasta el impacto
    const t = tracers[ti]; ti = (ti + 1) % NT;
    if (from) tmp.set(from[0], from[1], from[2]);
    else { camera.updateMatrixWorld(); tmp.set(0.15, -0.12, -0.58).applyMatrix4(camera.matrixWorld); }
    tmp2.set(end[0], end[1], end[2]);
    t.position.copy(tmp).lerp(tmp2, 0.5);
    t.scale.z = tmp.distanceTo(tmp2);
    t.lookAt(tmp2);
    t.userData.life = 0.07; t.visible = true;
    if (!from) { fx.kick = 1; fx.flashT = 0.05; fx.shake = Math.max(fx.shake, 0.08); }
  };

  fx.update = (dt) => {
    for (let i = 0; i < NP; i++) {
      if (life[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
      life[i] -= dt;
      const k = Math.max(0, life[i] / max[i]), j = i * 3;
      vel[j + 1] -= 9 * dt;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      if (pos[j + 1] < 0.02) { pos[j + 1] = 0.02; vel[j + 1] *= -0.3; vel[j] *= 0.6; vel[j + 2] *= 0.6; }
      col[j] = base[j] * k; col[j + 1] = base[j + 1] * k; col[j + 2] = base[j + 2] * k;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    for (const t of tracers) {
      if (!t.visible) continue;
      t.userData.life -= dt;
      t.material.opacity = Math.max(0, t.userData.life / 0.07);
      if (t.userData.life <= 0) t.visible = false;
    }
    fx.flashT -= dt;
    flash.intensity = fx.flashT > 0 ? 28 : 0;
    fx.kick = Math.max(0, fx.kick - dt * 9);
    fx.shake = Math.max(0, fx.shake - dt * 1.4);
  };
  return fx;
}
