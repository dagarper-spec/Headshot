// Drones de vigilancia: vuelan en órbita alrededor del jugador y, si tienen línea de visión, lo "marcan" (los soldados apuntan más rápido y mejor).
// Se derriban de un tiro. Lógica pura (sin render).
import { CFG } from './config.js';
import { S, emit } from './game-core.js';
import { blocked } from './game-geom.js';

export const DRONE_R = 0.3; // radio de impacto

// Coloca los drones del nivel (d = [{x,z}]) y apaga el resto del pool.
export function spawnDrones(list) {
  S.drones.forEach((d, i) => {
    const c = list[i]; Object.assign(d, { on: !!c, alive: !!c, x: c ? c.x : 0, y: 3.6, z: c ? c.z : 0, vy: 0, ang: Math.random() * 6.28, dir: Math.random() < 0.5 ? 1 : -1, rad: 7.5, t: 0, shiftT: 1.2, dodgeT: 0.2, vx: 0, vz: 0, seen: false, tilt: 0, tx: 0, tz: 0, deadT: 0 });
  });
  S.droneSeen = false;
}

// Rayo contra esfera; devuelve distancia o Infinity.
export function raySphere(ox, oy, oz, dx, dy, dz, d, r = DRONE_R) {
  const fx = ox - d.x, fy = oy - d.y, fz = oz - d.z, b = fx * dx + fy * dy + fz * dz, c = fx * fx + fy * fy + fz * fz - r * r, disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc); return t > 0 ? t : Infinity;
}

// ¿Quedan enemigos o drones vivos? Si no, victoria.
export function checkWin() {
  if (S.state !== 'play') return;
  if (!S.enemies.some((o) => o.active && o.alive) && !S.drones.some((d) => d.on && d.alive)) { S.state = 'win'; emit('win', { time: S.t }); }
}

export function killDrone(d, pt, dir) {
  d.alive = false; d.vy = 0; d.deadT = 0; if (!S.st.droneT) S.st.droneT = Math.max(0.01, S.t);
  emit('droneDown', { d, pt, dir }); checkWin();
}

// Paso: órbita con cambios de radio/sentido, caída al ser derribado y detección del jugador.
export function updateDrones(dt) {
  const p = S.player; let seen = false;
  for (const d of S.drones) {
    if (!d.on) continue;
    if (!d.alive) { // caída libre y choque
      d.vy -= 9 * dt; d.y += d.vy * dt; d.tilt += dt * 6;
      if (d.y <= 0.12) { d.y = 0.12; if (!d.crashed) { d.crashed = true; emit('droneCrash', { x: d.x, z: d.z }); } }
      d.deadT += dt; if (d.deadT > 4) d.on = false;
      continue;
    }
    d.crashed = false; d.t += dt; d.shiftT -= dt;
    if (d.shiftT <= 0) { d.shiftT = 0.9 + Math.random() * 1.4; d.rad = 4 + Math.random() * 6; if (Math.random() < 0.5) d.dir *= -1; }
    d.ang += d.dir * 0.85 * dt;
    // esquiva: si la mira del jugador pasa cerca, el dron da un salto lateral brusco
    d.dodgeT -= dt;
    const lx = -Math.sin(p.yaw) * Math.cos(p.pitch), ly = Math.sin(p.pitch), lz = -Math.cos(p.yaw) * Math.cos(p.pitch);
    const ex = d.x - p.x, ey = d.y - S.eye, ez = d.z - p.z, el = Math.hypot(ex, ey, ez) || 1;
    const aimed = (lx * ex + ly * ey + lz * ez) / el > 0.995; d.aimedT = aimed ? (d.aimedT || 0) + dt : 0; // reacciona tras ~0,12 s apuntándole
    if (d.dodgeT <= 0 && d.aimedT > 0.12) { const s = Math.random() < 0.5 ? 1 : -1; d.vx = -lz * s * 11; d.vz = lx * s * 11; d.vy = (Math.random() - 0.5) * 3; d.dodgeT = 0.8 + Math.random() * 0.6; }
    d.x += d.vx * dt; d.z += d.vz * dt; d.vx *= Math.max(0, 1 - dt * 2.5); d.vz *= Math.max(0, 1 - dt * 2.5);
    d.tx = Math.max(-12, Math.min(12, p.x + Math.cos(d.ang) * d.rad)); d.tz = Math.max(-12, Math.min(12, p.z + Math.sin(d.ang) * d.rad));
    const k = Math.min(1, dt * 2.6), ox = d.x, oz = d.z;
    d.x += (d.tx - d.x) * k; d.z += (d.tz - d.z) * k; d.vy = (d.vy || 0) * Math.max(0, 1 - dt * 3); d.y = Math.max(2.2, Math.min(4.6, 3.6 + Math.sin(d.t * 2.3) * 0.6 + (d.yo = ((d.yo || 0) + d.vy * dt) * (1 - dt * 0.8))));
    d.tilt = Math.hypot(d.x - ox, d.z - oz) / Math.max(dt, 1e-4);
    d.seen = Math.hypot(d.x - p.x, d.z - p.z) < 17 && !blocked(d.x, d.y, d.z, p.x, S.eye, p.z);
    if (d.seen) seen = true;
  }
  if (seen && !S.droneSeen) emit('droneSpot');
  S.droneSeen = seen;
}
