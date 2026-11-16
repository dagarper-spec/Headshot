// Efectos visuales con Object Pooling: partículas (chispas, humo, polvo, sangre), casquillos, trazadores,
// agujeros de bala y manchas de sangre. Todo se reutiliza (sin crear objetos durante el juego).
import * as THREE from 'three';

const VS = `attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale;
void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(size * scale / max(-mv.z, 0.05), 0.0, 220.0); }`;
const FS = `varying vec4 vC;
void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = 1.0 - smoothstep(0.15, 1.0, r);
  if (a < 0.01) discard; gl_FragColor = vec4(vC.rgb, vC.a * a); }`;

// Sistema de partículas: un único Points (1 draw call) con tamaño y alfa por partícula.
function makeSystem(scene, n, additive, uniforms) {
  const s = { n, i: 0, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), col: new Float32Array(n * 4), size: new Float32Array(n),
    base: new Float32Array(n * 4), s0: new Float32Array(n), s1: new Float32Array(n), life: new Float32Array(n), max: new Float32Array(n).fill(1),
    grav: new Float32Array(n), drag: new Float32Array(n), type: new Uint8Array(n) };
  for (let i = 0; i < n; i++) s.pos[i * 3 + 1] = -100;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(s.pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(s.col, 4));
  g.setAttribute('size', new THREE.BufferAttribute(s.size, 1));
  s.geo = g;
  s.pts = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  s.pts.frustumCulled = false; s.pts.renderOrder = 5;
  scene.add(s.pts);
  return s;
}

// Textura de decal generada en un canvas (sin archivos externos).
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const blob = (x, cx, cy, r, a) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.6, `rgba(255,255,255,${a * 0.8})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };

export function createFx(scene, camera, view) {
  const U = { scale: { value: 800 } };
  const spark = makeSystem(scene, 200, true, U);   // aditivo: chispas, fogonazo
  const dust = makeSystem(scene, 360, false, U);   // normal: humo, polvo, astillas, sangre
  const fx = { kick: 0, shake: 0, flashT: 0, q: 1, blood: 1, onTink: null };

  // Emite una partícula en el sistema s. type: 0 normal, 1 escombro que rebota, 2 gota de sangre (deja mancha al caer)
  const em = (s, x, y, z, vx, vy, vz, s0, s1, life, r, g, b, a, grav = 0, drag = 0, type = 0) => {
    const i = s.i; s.i = (s.i + 1) % s.n;
    s.pos[i * 3] = x; s.pos[i * 3 + 1] = y; s.pos[i * 3 + 2] = z;
    s.vel[i * 3] = vx; s.vel[i * 3 + 1] = vy; s.vel[i * 3 + 2] = vz;
    s.base[i * 4] = r; s.base[i * 4 + 1] = g; s.base[i * 4 + 2] = b; s.base[i * 4 + 3] = a;
    s.s0[i] = s0; s.s1[i] = s1; s.life[i] = s.max[i] = life; s.grav[i] = grav; s.drag[i] = drag; s.type[i] = type;
  };
  const rnd = (a = 1) => (Math.random() - 0.5) * a;
  const cnt = (n) => Math.max(1, Math.round(n * fx.q));

  // ---------- Decales (agujeros de bala, manchas y charcos): anillos de mallas reutilizadas ----------
  const holeTex = canvasTex(64, (x, s) => { blob(x, s / 2, s / 2, s * 0.17, 1); x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 3; x.beginPath(); x.arc(s / 2, s / 2, s * 0.26, 0, 7); x.stroke(); blob(x, s / 2, s / 2, s * 0.42, 0.25); });
  const splatTex = [0, 1, 2].map(() => canvasTex(128, (x, s) => {
    blob(x, s / 2, s / 2, s * (0.14 + Math.random() * 0.08), 1);
    for (let k = 0; k < 14; k++) { const a = Math.random() * 6.28, d = s * (0.1 + Math.random() * 0.36); blob(x, s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, s * (0.015 + Math.random() * 0.05), 1); }
    x.lineWidth = 3; x.strokeStyle = '#fff'; for (let k = 0; k < 5; k++) { const a = Math.random() * 6.28, d = s * (0.2 + Math.random() * 0.25); x.beginPath(); x.moveTo(s / 2, s / 2); x.lineTo(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d); x.stroke(); }
  }));
  const poolTex = canvasTex(128, (x, s) => { blob(x, s / 2, s / 2, s * 0.5, 1); });
  const decalMat = (map, color, op) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mkRing = (n, geo, mats) => Array.from({ length: n }, (_, k) => { const m = new THREE.Mesh(geo, mats[k % mats.length]); m.visible = false; m.renderOrder = 2; scene.add(m); return m; });
  const plane = new THREE.PlaneGeometry(1, 1);
  const holes = mkRing(28, plane, [decalMat(holeTex, 0x050505, 0.85)]);
  const splats = mkRing(42, plane, splatTex.map((t) => decalMat(t, 0x4a0707, 0.9)));
  const pools = mkRing(5, plane, [decalMat(poolTex, 0x3a0505, 0.92)]);
  let hi = 0, si = 0, pi = 0;
  const _q = new THREE.Quaternion(), _n = new THREE.Vector3(), _up = new THREE.Vector3(0, 0, 1);
  const place = (m, p, n, size) => {
    _n.set(n[0], n[1], n[2]); m.position.set(p[0] + n[0] * 0.004, p[1] + n[1] * 0.004, p[2] + n[2] * 0.004);
    m.quaternion.setFromUnitVectors(_up, _n); m.rotateZ(Math.random() * 6.28); m.scale.setScalar(size); m.visible = true; return m;
  };

  // ---------- Casquillos (InstancedMesh) ----------
  const NC = 10;
  const cas = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.011, 0.012, 0.042, 8), new THREE.MeshStandardMaterial({ color: 0xd9ad4f, metalness: 1, roughness: 0.32 }), NC);
  cas.frustumCulled = false; cas.count = NC; scene.add(cas);
  const C = Array.from({ length: NC }, () => ({ p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), e: new THREE.Euler(), w: new THREE.Vector3(), life: 0, bounced: false }));
  const dummy = new THREE.Object3D(); let ci = 0;
  for (let i = 0; i < NC; i++) { dummy.position.set(0, -50, 0); dummy.updateMatrix(); cas.setMatrixAt(i, dummy.matrix); }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
  function eject() { // expulsa un casquillo por la ventana de la corredera (hacia la derecha y arriba)
    const c = C[ci]; ci = (ci + 1) % NC;
    view.ejector(c.p); camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements; _r.set(e[0], e[1], e[2]); _u.set(e[4], e[5], e[6]);
    c.v.set(0, 0, 0).addScaledVector(_r, 1.5 + Math.random() * 0.8).addScaledVector(_u, 1.3 + Math.random() * 0.6);
    c.v.x += (Math.random() - 0.5) * 0.4; c.v.z += (Math.random() - 0.5) * 0.4;
    c.e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); c.w.set(rnd(40), rnd(40), rnd(40));
    c.life = 5; c.bounced = false;
  }

  // ---------- Trazadores ----------
  const NT = 10, tg = new THREE.CylinderGeometry(0.008, 0.008, 1, 5).rotateX(Math.PI / 2), tracers = [];
  for (let i = 0; i < NT; i++) {
    const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false; m.userData.life = 0; scene.add(m); tracers.push(m);
  }
  let ti = 0;

  // Destello de boca (luz siempre activa para no recompilar shaders)
  const flash = new THREE.PointLight(0xffa860, 0, 9, 2); flash.position.set(0.15, -0.1, -0.8); camera.add(flash);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), mz = new THREE.Vector3();

  // ---------- API ----------
  // Chispas genéricas (compatibilidad): x,y,z, color rgb, cantidad, velocidad.
  fx.burst = (x, y, z, r, g, b, n, speed) => {
    for (let k = 0; k < cnt(n); k++) em(spark, x, y, z, rnd(speed), Math.random() * speed * 0.8, rnd(speed), 0.03, 0.01, 0.3 + Math.random() * 0.4, r * 2, g * 2, b * 2, 1, 9, 0.3);
  };

  // Fogonazo + humo en `p` apuntando a `d` (vector unitario). strong: arma del jugador.
  fx.muzzle = (p, d, strong) => {
    em(spark, p.x, p.y, p.z, 0, 0, 0, strong ? 0.34 : 0.22, 0.05, 0.05, 4, 2.8, 1.2, 1);
    for (let k = 0; k < cnt(strong ? 8 : 5); k++) { const s = 5 + Math.random() * 9; em(spark, p.x, p.y, p.z, d.x * s + rnd(3), d.y * s + rnd(3), d.z * s + rnd(3), 0.02, 0.005, 0.07 + Math.random() * 0.08, 3, 1.8, 0.6, 1, 2, 0.5); }
    for (let k = 0; k < cnt(strong ? 4 : 3); k++) em(dust, p.x, p.y, p.z, d.x * 0.8 + rnd(0.5), 0.35 + Math.random() * 0.3, d.z * 0.8 + rnd(0.5), 0.08, 0.45, 0.8 + Math.random() * 0.5, 0.6, 0.6, 0.6, 0.22, 0, 1.6);
  };

  // Disparo: trazador desde `from` (enemigo) o desde la boca del arma (jugador) hasta `end`.
  fx.shoot = (end, from, dirOut) => {
    const t = tracers[ti]; ti = (ti + 1) % NT;
    if (from) tmp.set(from[0], from[1], from[2]); else view.muzzle(tmp);
    tmp2.set(end[0], end[1], end[2]);
    t.position.copy(tmp).lerp(tmp2, 0.5); t.scale.z = tmp.distanceTo(tmp2); t.lookAt(tmp2);
    t.userData.life = 0.07; t.visible = true;
    mz.copy(tmp2).sub(tmp).normalize(); fx.muzzle(tmp, mz, !from);
    if (!from) { fx.kick = 1; fx.flashT = 0.05; fx.shake = Math.max(fx.shake, 0.08); eject(); }
  };

  // Impacto en una superficie: kind = 'concrete' | 'metal' | 'wood' | 'floor'; n = normal.
  fx.impact = (pt, n, kind, big = 1, decal = true) => {
    const [x, y, z] = pt, nx = n[0], ny = n[1], nz = n[2];
    if (decal) { const o = kind === 'wood' ? 0.03 : kind === 'metal' ? 0.045 : 0.008; place(holes[hi], [pt[0] + nx * o, pt[1] + ny * o, pt[2] + nz * o], n, 0.17 + Math.random() * 0.05); hi = (hi + 1) % holes.length; }
    const dustc = kind === 'wood' ? [0.55, 0.4, 0.25] : kind === 'metal' ? [0.5, 0.5, 0.5] : [0.62, 0.6, 0.56];
    for (let k = 0; k < cnt(kind === 'metal' ? 2 : 4); k++) em(dust, x, y, z, nx * (0.5 + Math.random()) + rnd(0.6), ny * (0.5 + Math.random()) + rnd(0.6) + 0.15, nz * (0.5 + Math.random()) + rnd(0.6), 0.06, 0.34 * big, 0.5 + Math.random() * 0.35, dustc[0], dustc[1], dustc[2], 0.5, 0, 3);
    if (kind === 'metal') {
      em(spark, x + nx * 0.02, y + ny * 0.02, z + nz * 0.02, 0, 0, 0, 0.16 * big, 0.02, 0.05, 4, 3, 1.5, 1);
      for (let k = 0; k < cnt(12 * big); k++) { const s = 2 + Math.random() * 5; em(spark, x, y, z, nx * s + rnd(4), ny * s + rnd(4), nz * s + rnd(4), 0.016, 0.006, 0.25 + Math.random() * 0.35, 3.5, 1.9, 0.6, 1, 9, 0.2); }
    } else if (kind === 'wood') {
      for (let k = 0; k < cnt(9); k++) { const s = 1.5 + Math.random() * 3.5; em(dust, x, y, z, nx * s + rnd(3), ny * s + rnd(3) + 1, nz * s + rnd(3), 0.016 + Math.random() * 0.012, 0.014, 0.6 + Math.random() * 0.5, 0.62, 0.42, 0.22, 1, 9, 0.2, 1); }
    } else {
      for (let k = 0; k < cnt(7); k++) { const s = 1.5 + Math.random() * 3.5; em(dust, x, y, z, nx * s + rnd(3), ny * s + rnd(3) + 1, nz * s + rnd(3), 0.012 + Math.random() * 0.01, 0.01, 0.5 + Math.random() * 0.5, 0.45, 0.44, 0.42, 1, 9, 0.2, 1); }
      for (let k = 0; k < cnt(3); k++) em(spark, x, y, z, nx * 3 + rnd(3), ny * 3 + rnd(3), nz * 3 + rnd(3), 0.012, 0.005, 0.15, 3, 2, 0.8, 1, 9, 0.2);
    }
  };

  // Sangre: niebla + gotas en la dirección del disparo (dir). amount 1 = cuerpo, 2 = cabeza.
  fx.blood = (pt, dir, amount = 1) => {
    if (fx.blood_level <= 0) return;
    const n = cnt(14 * amount * fx.blood_level), [x, y, z] = pt;
    for (let k = 0; k < n; k++) { // gotas
      const s = 1.5 + Math.random() * 4.5 * amount;
      em(dust, x, y, z, dir[0] * s + rnd(3), dir[1] * s + rnd(3) + 0.8, dir[2] * s + rnd(3), 0.014 + Math.random() * 0.02, 0.01, 0.9 + Math.random() * 0.7, 0.34, 0.02, 0.02, 0.95, 9.5, 0.15, 2);
    }
    for (let k = 0; k < cnt(5 * amount * fx.blood_level); k++) // niebla roja
      em(dust, x, y, z, dir[0] * 1.5 + rnd(1.2), dir[1] * 1.5 + rnd(1.2), dir[2] * 1.5 + rnd(1.2), 0.04, 0.2 + 0.08 * amount, 0.35 + Math.random() * 0.25, 0.4, 0.02, 0.02, 0.4, 0, 2.5);
  };
  fx.blood_level = 1;
  fx.setBlood = (v) => { fx.blood_level = v === 'off' ? 0 : v === 'low' ? 0.45 : 1; };

  // Mancha de sangre en una superficie (pared/suelo) y charco bajo un cuerpo.
  fx.splat = (pt, n, size = 0.4) => {
    if (fx.blood_level <= 0) return;
    place(splats[si], pt, n, size * (0.7 + Math.random() * 0.6)).material.opacity = 0.75 + Math.random() * 0.2; si = (si + 1) % splats.length;
  };
  fx.pool = (x, z) => {
    if (fx.blood_level <= 0) return;
    const m = place(pools[pi], [x, 0.003, z], [0, 1, 0], 0.1); pi = (pi + 1) % pools.length;
    m.userData.grow = 0; m.userData.maxS = (0.75 + Math.random() * 0.25) * (0.5 + fx.blood_level * 0.5); // crece despacio
  };

  // Limpia los decales al empezar un nivel.
  fx.clear = () => { for (const m of [...holes, ...splats, ...pools]) { m.visible = false; m.userData.grow = -1; } for (const c of C) { c.life = 0; c.p.y = -50; } for (const s of [spark, dust]) s.life.fill(0); };
  fx.setQuality = (q) => { fx.q = q; };

  fx.update = (dt) => {
    U.scale.value = (view.viewH || innerHeight) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const s of [spark, dust]) {
      const { pos, vel, life, max, col, size, base, s0, s1, grav, drag, type } = s;
      for (let i = 0; i < s.n; i++) {
        if (life[i] <= 0) { col[i * 4 + 3] = 0; continue; }
        life[i] -= dt;
        const k = 1 - Math.max(0, life[i] / max[i]), j = i * 3, d = Math.max(0, 1 - drag[i] * dt);
        vel[j] *= d; vel[j + 1] = vel[j + 1] * d - grav[i] * dt; vel[j + 2] *= d;
        pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
        if (pos[j + 1] < 0.015 && type[i]) {
          if (type[i] === 2) { fx.splat([pos[j], 0, pos[j + 2]], [0, 1, 0], 0.1 + Math.random() * 0.12); life[i] = 0; continue; }
          pos[j + 1] = 0.015; vel[j + 1] *= -0.3; vel[j] *= 0.6; vel[j + 2] *= 0.6;
        }
        const a = base[i * 4 + 3] * (1 - k) * Math.min(1, k * 10 + (type[i] === 2 ? 1 : 0));
        col[i * 4] = base[i * 4]; col[i * 4 + 1] = base[i * 4 + 1]; col[i * 4 + 2] = base[i * 4 + 2]; col[i * 4 + 3] = a;
        size[i] = s0[i] + (s1[i] - s0[i]) * k;
      }
      s.geo.attributes.position.needsUpdate = s.geo.attributes.color.needsUpdate = s.geo.attributes.size.needsUpdate = true;
    }
    for (let i = 0; i < NC; i++) { // casquillos
      const c = C[i];
      if (c.life <= 0) continue;
      c.life -= dt; c.v.y -= 9.8 * dt; c.p.addScaledVector(c.v, dt);
      c.e.x += c.w.x * dt; c.e.y += c.w.y * dt; c.e.z += c.w.z * dt;
      if (c.p.y < 0.013) {
        c.p.y = 0.013;
        if (c.v.y < -0.6 && fx.onTink) fx.onTink(Math.min(1, -c.v.y / 3));
        c.v.y *= -0.35; c.v.x *= 0.6; c.v.z *= 0.6; c.w.multiplyScalar(0.55);
        if (!c.bounced) { c.bounced = true; c.e.x = Math.PI / 2; c.e.z = 0; }
      }
      if (c.bounced) { c.e.x = Math.PI / 2; c.e.z = 0; }
      if (c.life <= 0) c.p.y = -50;
      dummy.position.copy(c.p); dummy.rotation.copy(c.e); dummy.updateMatrix(); cas.setMatrixAt(i, dummy.matrix);
    }
    cas.instanceMatrix.needsUpdate = true;
    for (const m of pools) if (m.visible && m.userData.grow >= 0 && m.scale.x < m.userData.maxS) m.scale.setScalar(Math.min(m.userData.maxS, m.scale.x + dt * 0.12 * (1.2 - m.scale.x)));
    for (const t of tracers) {
      if (!t.visible) continue;
      t.userData.life -= dt; t.material.opacity = Math.max(0, t.userData.life / 0.07);
      if (t.userData.life <= 0) t.visible = false;
    }
    fx.flashT -= dt; flash.intensity = fx.flashT > 0 ? 30 : 0;
    fx.kick = Math.max(0, fx.kick - dt * 9); fx.shake = Math.max(0, fx.shake - dt * 1.4);
  };
  return fx;
}
