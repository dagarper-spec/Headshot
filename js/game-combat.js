// Combate del jugador: pistola semiautomática de 6 balas, disparo hitscan y ayuda al apuntar.
import { CFG } from './config.js';
import { S, emit, damageEnemy, shieldBlocks } from './game-core.js';
import { rayWorld, rayCyl, surface } from './game-geom.js';
import { raySphere, killDrone } from './game-drone.js';

export const maxMag = () => CFG.weapon.mag + S.magBonus;
export const stats = () => ({ mag: maxMag(), reload: CFG.weapon.reload });

export function reload() {
  if (S.reloading || S.mag >= maxMag()) return;
  S.st.reloads++; S.reloading = true; S.reloadT = CFG.weapon.reload;
  emit('reload');
}

// Semiautomática: un disparo por pulsación (latch hasta soltar).
export function updateCombat(dt, fireHeld) {
  S.fireT -= dt;
  if (!fireHeld) S.latch = false;
  if (S.reloading) {
    S.reloadT -= dt;
    if (S.reloadT <= 0) { S.reloading = false; S.mag = maxMag(); }
  } else if (fireHeld && (!S.latch || CFG.weapon.auto) && S.fireT <= 0) {
    S.latch = true;
    if (S.mag > 0) shoot(); else { S.fireT = 0.3; emit('empty'); reload(); }
  }
}

const dirOf = (yaw, pitch) => {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
};

// ¿Hay un enemigo cerca de la mira? Se usa para frenar el giro (ayuda al apuntar táctil).
export function aimAssist() {
  const p = S.player, [dx, dy, dz] = dirOf(p.yaw, p.pitch);
  const wall = rayWorld(p.x, S.eye, p.z, dx, dy, dz);
  for (const e of S.enemies) {
    if (!e.active || !e.alive) continue;
    const h = rayCyl(e, p.x, S.eye, p.z, dx, dy, dz, 0.5);
    if (h && h.t < wall) return true;
  }
  for (const d of S.drones) if (d.on && d.alive && raySphere(p.x, S.eye, p.z, dx, dy, dz, d, 0.5) < wall) return true;
  return false;
}

// Dispersión actual (radianes aprox.): sube al moverte o estar herido; baja al apuntar con zoom. La usa también la retícula.
export const spread = () => (0.002 + Math.min(S.player.speed / 5, 1) * 0.012 + (S.hp < S.maxHp ? 0.008 : 0)) * (S.zoom ? CFG.weapon.zoomK : CFG.weapon.spreadK) * (S.crouch ? 0.7 : 1) * (CFG.weapon.stab || 1);

function shoot() {
  const p = S.player;
  S.mag--; S.fireT = CFG.weapon.rate;
  const sp = spread();
  const [dx, dy, dz] = dirOf(p.yaw + (Math.random() - 0.5) * sp * 2, p.pitch + (Math.random() - 0.5) * sp * 2);
  const ox = p.x, oy = S.eye, oz = p.z;
  let bt = Math.min(CFG.weapon.range, rayWorld(ox, oy, oz, dx, dy, dz)), best = null, head = false;
  for (const e of S.enemies) {
    if (!e.active || !e.alive) continue;
    const h = rayCyl(e, ox, oy, oz, dx, dy, dz);
    if (h && h.t < bt) { bt = h.t; best = e; head = h.head; }
  }
  let drone = null;
  for (const d of S.drones) { if (!d.on || !d.alive) continue; const t = raySphere(ox, oy, oz, dx, dy, dz, d); if (t < bt) { bt = t; drone = d; best = null; head = false; } }
  const end = [ox + dx * bt, oy + dy * bt, oz + dz * bt];
  if (drone) { emit('shot', { end, hit: true, head: false, dir: [dx, dy, dz], surf: null }); killDrone(drone, end, [dx, dy, dz]); return; }
  if (best && shieldBlocks(best, [dx, dy, dz])) { // el escudo lo detiene
    emit('shot', { end, hit: false, head: false, dir: [dx, dy, dz], surf: { kind: 'metal', n: [-dx, -dy, -dz] } }); emit('shield', { pt: end });
    return;
  }
  emit('shot', { end, hit: !!best, head, dir: [dx, dy, dz], surf: best ? null : surface(end[0], end[1], end[2]) });
  if (best) damageEnemy(best, head, end, [dx, dy, dz]);
}
