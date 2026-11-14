// Geometría pura (sin render): rayos, línea de visión y colisiones con cajas.
import { CFG } from './config.js';

// Rayo contra caja [x,z,w,d,h]. Devuelve la distancia de entrada o Infinity.
export function slab(ox, oy, oz, dx, dy, dz, b) {
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

// Distancia hasta el borde de la sala o la primera caja.
export function rayWorld(ox, oy, oz, dx, dy, dz) {
  const H = CFG.half;
  const ax = (o, d, lo, hi) => (d > 1e-9 ? (hi - o) / d : d < -1e-9 ? (lo - o) / d : Infinity);
  let t = Math.min(ax(ox, dx, -H, H), ax(oy, dy, 0, CFG.height), ax(oz, dz, -H, H));
  for (const b of CFG.crates) t = Math.min(t, slab(ox, oy, oz, dx, dy, dz, b));
  return t;
}

// Rayo contra el cilindro vertical de un enemigo. Los últimos 27 cm son la cabeza.
// pad agranda el cilindro (se usa para la ayuda al apuntar).
export function rayCyl(e, ox, oy, oz, dx, dy, dz, pad = 0) {
  const r = e.r + pad, fx = ox - e.x, fz = oz - e.z, a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const b = fx * dx + fz * dz, c = fx * fx + fz * fz - r * r, disc = b * b - a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  if (t < 0) return null;
  const y = oy + dy * t;
  if (y < -pad || y > e.h + pad) return null;
  return { t, head: y > e.h - 0.27 };
}

// ¿Hay alguna caja entre dos puntos? (línea de visión)
export function blocked(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz);
  if (d < 1e-6) return false;
  for (const b of CFG.crates) if (slab(ax, ay, az, dx / d, dy / d, dz / d, b) < d) return true;
  return false;
}

// ¿Cabe un círculo de radio r en (x,z) sin tocar cajas ni paredes?
export function free(x, z, r) {
  if (Math.abs(x) > CFG.half - r || Math.abs(z) > CFG.half - r) return false;
  for (const b of CFG.crates) {
    const cx = Math.max(b[0] - b[2] / 2, Math.min(x, b[0] + b[2] / 2));
    const cz = Math.max(b[1] - b[3] / 2, Math.min(z, b[1] + b[3] / 2));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return false;
  }
  return true;
}
