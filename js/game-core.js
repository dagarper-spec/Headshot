// Lógica pura del juego (sin Three.js ni DOM): estado, jugador, enemigos y oleadas.
import { CFG } from './config.js';

// Bus de eventos mínimo: la lógica emite, la vista/audio/UI escuchan.
const L = {};
export const on = (e, f) => (L[e] || (L[e] = [])).push(f);
export const emit = (e, d) => { (L[e] || []).forEach((f) => f(d)); };

export const S = {
  state: 'menu', // menu | play | pause | upgrade | over
  t: 0, hp: 100, maxHp: 100, score: 0, kills: 0, wave: 0,
  spawnLeft: 0, spawnT: 0, combo: 1, comboT: 0,
  mag: 30, reloadT: 0, fireT: 0, reloading: false,
  player: { x: 0, z: 9, yaw: 0, pitch: 0, speed: 0 },
  up: { dmg: 0, rate: 0, mag: 0, hp: 0, spd: 0, rel: 0 },
  enemies: [], // Object Pool: se crea una vez y se reutiliza
};
for (let i = 0; i < CFG.pool; i++) {
  S.enemies.push({ id: i, active: false, type: 'walker', x: 0, z: 0, hp: 1, maxHp: 1,
    r: 0.4, h: 1.8, face: 0, atkT: 0, hitT: 0, spd: 0, dmg: 0, side: 1 });
}

export function startGame() {
  Object.assign(S, { score: 0, kills: 0, wave: 0, t: 0, hp: CFG.player.hp, maxHp: CFG.player.hp,
    combo: 1, comboT: 0, mag: CFG.weapon.mag, reloading: false, fireT: 0 });
  Object.assign(S.up, { dmg: 0, rate: 0, mag: 0, hp: 0, spd: 0, rel: 0 });
  Object.assign(S.player, { x: 0, z: 9, yaw: 0, pitch: 0, speed: 0 });
  S.enemies.forEach((e) => { e.active = false; });
  nextWave();
}

export function nextWave() {
  S.wave++;
  S.spawnLeft = 5 + S.wave * 4;
  S.spawnT = 1.2;
  S.state = 'play';
  emit('wave', S.wave);
}

export function look(dx, dy) {
  const p = S.player;
  p.yaw -= dx * CFG.player.sens;
  p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch - dy * CFG.player.sens));
}

// Paso de simulación. dt en segundos (Delta Time) => independiente de los FPS.
export function update(dt, inp) {
  if (S.state !== 'play') return;
  S.t += dt;
  movePlayer(dt, inp);
  updateEnemies(dt);
  updateWaves(dt);
  if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 1; }
}

function movePlayer(dt, inp) {
  const p = S.player, sp = CFG.player.speed * (1 + 0.1 * S.up.spd);
  let mx = inp.mx, mz = inp.mz;
  const l = Math.hypot(mx, mz);
  if (l > 1) { mx /= l; mz /= l; }
  const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
  const vx = (c * mx - s * mz) * sp, vz = (-s * mx - c * mz) * sp;
  p.x += vx * dt; p.z += vz * dt;
  p.speed = Math.hypot(vx, vz);
  resolve(p, CFG.player.radius);
}

// Colisión círculo vs paredes y cajas (AABB). Modifica o.x / o.z.
export function resolve(o, r) {
  const H = CFG.half - r;
  o.x = Math.max(-H, Math.min(H, o.x));
  o.z = Math.max(-H, Math.min(H, o.z));
  for (const b of CFG.crates) {
    const hx = b[2] / 2, hz = b[3] / 2;
    const cx = Math.max(b[0] - hx, Math.min(o.x, b[0] + hx));
    const cz = Math.max(b[1] - hz, Math.min(o.z, b[1] + hz));
    const dx = o.x - cx, dz = o.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-6) { const d = Math.sqrt(d2); o.x = cx + (dx / d) * r; o.z = cz + (dz / d) * r; }
    else { // centro dentro de la caja: salir por el eje más corto
      const px = hx + r - Math.abs(o.x - b[0]), pz = hz + r - Math.abs(o.z - b[1]);
      if (px < pz) o.x += (o.x >= b[0] ? 1 : -1) * px; else o.z += (o.z >= b[1] ? 1 : -1) * pz;
    }
  }
}

function updateEnemies(dt) {
  const p = S.player;
  for (const e of S.enemies) {
    if (!e.active) continue;
    let dx = p.x - e.x, dz = p.z - e.z;
    const d = Math.hypot(dx, dz) || 1e-4;
    dx /= d; dz /= d;
    e.face = Math.atan2(dx, dz);
    let vx = dx * e.spd, vz = dz * e.spd;
    for (const o of S.enemies) { // separación para que no se apilen
      if (o === e || !o.active) continue;
      const sx = e.x - o.x, sz = e.z - o.z, sd = Math.hypot(sx, sz), m = e.r + o.r;
      if (sd < m && sd > 1e-4) { vx += (sx / sd) * (m - sd) * 4; vz += (sz / sd) * (m - sd) * 4; }
    }
    const reach = e.r + CFG.player.radius + 0.25;
    if (d > reach) {
      const nx = e.x + vx * dt, nz = e.z + vz * dt;
      e.x = nx; e.z = nz;
      resolve(e, e.r);
      // si una caja lo bloquea, rodearla por un lateral
      if (Math.hypot(e.x - nx, e.z - nz) > 0.002) {
        e.x += -dz * e.side * e.spd * dt; e.z += dx * e.side * e.spd * dt;
        resolve(e, e.r);
      }
    }
    e.atkT -= dt; e.hitT -= dt;
    if (d <= reach + 0.15 && e.atkT <= 0) { e.atkT = 0.9; hurt(e.dmg); }
  }
}

function hurt(n) {
  S.hp -= n;
  emit('hurt', n);
  if (S.hp <= 0) { S.hp = 0; S.state = 'over'; emit('over'); }
}

function updateWaves(dt) {
  let alive = 0;
  for (const e of S.enemies) if (e.active) alive++;
  if (S.spawnLeft > 0) {
    S.spawnT -= dt;
    if (S.spawnT <= 0 && alive < CFG.maxAlive) {
      spawn(); S.spawnLeft--; S.spawnT = Math.max(0.25, 0.9 - S.wave * 0.04);
    }
  } else if (alive === 0) {
    S.hp = Math.min(S.maxHp, S.hp + S.maxHp * 0.3);
    S.state = 'upgrade';
    emit('waveclear', S.wave);
  }
}

function spawn() {
  const e = S.enemies.find((o) => !o.active);
  if (!e) return;
  const w = S.wave, roll = Math.random();
  let type = 'walker';
  if (w >= 2 && roll < 0.35) type = 'runner';
  if (w >= 4 && roll > 0.9) type = 'brute';
  const T = CFG.types[type], hs = 1 + (w - 1) * 0.12, H = CFG.half - 1;
  let x, z, tries = 0;
  do { // borde aleatorio, lejos del jugador
    const s = Math.random() * 2 - 1, side = (Math.random() * 4) | 0;
    x = side < 2 ? s * H : (side === 2 ? -H : H);
    z = side < 2 ? (side === 0 ? -H : H) : s * H;
    tries++;
  } while (Math.hypot(x - S.player.x, z - S.player.z) < 10 && tries < 10);
  Object.assign(e, { active: true, type, x, z, hp: T.hp * hs, maxHp: T.hp * hs, r: T.r, h: T.h,
    spd: T.speed * (0.9 + Math.random() * 0.2), dmg: T.dmg, atkT: 0.5, hitT: 0,
    side: Math.random() < 0.5 ? -1 : 1 });
  emit('spawn', e);
}
