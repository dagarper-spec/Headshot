// Combate: arma, disparo hitscan, daño, combo y mejoras. Sin dependencias de render.
import { CFG } from './config.js';
import { S, emit } from './game-core.js';

// Estadísticas del arma con las mejoras aplicadas.
export const stats = () => ({
  dmg: CFG.weapon.dmg * (1 + 0.25 * S.up.dmg),
  rate: CFG.weapon.rate / (1 + 0.2 * S.up.rate),
  mag: CFG.weapon.mag + 10 * S.up.mag,
  reload: CFG.weapon.reload * Math.pow(0.85, S.up.rel),
});

export function applyUpgrade(id) {
  S.up[id]++;
  if (id === 'hp') { S.maxHp += 25; S.hp = S.maxHp; }
  if (id === 'mag') S.mag = stats().mag;
}

export function reload() {
  if (S.reloading || S.mag >= stats().mag) return;
  S.reloading = true; S.reloadT = stats().reload;
  emit('reload');
}

export function updateCombat(dt, fireHeld) {
  S.fireT -= dt;
  if (S.reloading) {
    S.reloadT -= dt;
    if (S.reloadT <= 0) { S.reloading = false; S.mag = stats().mag; }
  } else if (fireHeld && S.fireT <= 0) {
    if (S.mag > 0) shoot(); else { S.fireT = 0.25; emit('empty'); reload(); }
  }
}

// ¿Hay un enemigo justo bajo la mira (sin cajas por medio)? Sirve para el disparo automático táctil.
export function aimingAtEnemy() {
  const p = S.player, cp = Math.cos(p.pitch);
  const dx = -Math.sin(p.yaw) * cp, dy = Math.sin(p.pitch), dz = -Math.cos(p.yaw) * cp;
  const wall = rayWorld(p.x, CFG.eye, p.z, dx, dy, dz);
  for (const e of S.enemies) {
    if (!e.active) continue;
    const h = rayCyl(e, p.x, CFG.eye, p.z, dx, dy, dz);
    if (h && h.t < wall) return true;
  }
  return false;
}

function shoot() {
  const st = stats(), p = S.player;
  S.mag--; S.fireT = st.rate;
  const sp = 0.004 + Math.min(p.speed / 6, 1) * 0.01; // más dispersión al moverse
  const yaw = p.yaw + (Math.random() - 0.5) * sp * 2, pit = p.pitch + (Math.random() - 0.5) * sp * 2;
  const cp = Math.cos(pit);
  const dx = -Math.sin(yaw) * cp, dy = Math.sin(pit), dz = -Math.cos(yaw) * cp;
  const ox = p.x, oy = CFG.eye, oz = p.z;
  let bt = Math.min(CFG.weapon.range, rayWorld(ox, oy, oz, dx, dy, dz)), best = null, head = false;
  for (const e of S.enemies) {
    if (!e.active) continue;
    const h = rayCyl(e, ox, oy, oz, dx, dy, dz);
    if (h && h.t < bt) { bt = h.t; best = e; head = h.head; }
  }
  const end = [ox + dx * bt, oy + dy * bt, oz + dz * bt];
  emit('shot', { end, hit: !!best, head, dir: [dx, dy, dz] });
  if (best) damage(best, st.dmg * (head ? CFG.weapon.headMul : 1), head, end);
}

function damage(e, amt, head, pt) {
  e.hp -= amt; e.hitT = 0.12;
  if (e.hp > 0) { emit('hit', { e, head, pt }); return; }
  e.active = false; S.kills++;
  S.combo = S.comboT > 0 ? Math.min(5, S.combo + 1) : 1;
  S.comboT = 3.5;
  const pts = Math.round(CFG.types[e.type].score * (head ? 1.5 : 1) * S.combo);
  S.score += pts;
  emit('kill', { e, head, pt, pts });
}

// Distancia hasta el borde de la sala o la primera caja.
function rayWorld(ox, oy, oz, dx, dy, dz) {
  const H = CFG.half;
  const ax = (o, d, lo, hi) => (d > 1e-9 ? (hi - o) / d : d < -1e-9 ? (lo - o) / d : Infinity);
  let t = Math.min(ax(ox, dx, -H, H), ax(oy, dy, 0, CFG.height), ax(oz, dz, -H, H));
  for (const b of CFG.crates) t = Math.min(t, slab(ox, oy, oz, dx, dy, dz, b));
  return t;
}

function slab(ox, oy, oz, dx, dy, dz, b) {
  const mn = [b[0] - b[2] / 2, 0, b[1] - b[3] / 2], mx = [b[0] + b[2] / 2, b[4], b[1] + b[3] / 2];
  const o = [ox, oy, oz], d = [dx, dy, dz];
  let t0 = 0, t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return Infinity; continue; }
    let a = (mn[i] - o[i]) / d[i], c = (mx[i] - o[i]) / d[i];
    if (a > c) { const k = a; a = c; c = k; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

// Rayo contra cilindro vertical (el enemigo). Zona alta = cabeza.
function rayCyl(e, ox, oy, oz, dx, dy, dz) {
  const fx = ox - e.x, fz = oz - e.z, a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const b = fx * dx + fz * dz, c = fx * fx + fz * fz - e.r * e.r, disc = b * b - a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  if (t < 0) return null;
  const y = oy + dy * t;
  if (y < 0 || y > e.h) return null;
  return { t, head: y > e.h * 0.78 };
}
