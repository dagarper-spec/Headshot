// Lógica pura del duelo (sin Three.js ni DOM): estado, jugador, IA enemiga con coberturas y niveles.
import { CFG, LEVELS } from './config.js';
import { blocked, free, rayWorld } from './game-geom.js';

// Bus de eventos mínimo: la lógica emite, la vista/audio/UI escuchan.
const L = {};
export const on = (e, f) => (L[e] || (L[e] = [])).push(f);
export const emit = (e, d) => { (L[e] || []).forEach((f) => f(d)); };

export const S = {
  state: 'menu', // menu | play | pause | win | over
  level: 0, t: 0, grace: 0, deathT: 0, zoom: false, crouch: false, eye: 1.7,
  hp: 2, maxHp: 2, mag: 6, reloadT: 0, fireT: 0, reloading: false, latch: false,
  player: { x: 0, z: 11, yaw: 0, pitch: 0, speed: 0 },
  enemies: [], // Object Pool reutilizado en cada nivel
};
for (let i = 0; i < CFG.pool; i++) {
  S.enemies.push({ id: i, active: false, alive: false, x: 0, z: 0, hp: 2, helmet: false, crouch: true, state: 'hide',
    next: 'hide', timer: 0, react: 0, aimT: 0, aimK: 0, shots: 0, aiming: false, moving: false, sees: false, hitT: 0,
    face: 0, cover: null, goal: null, moveT: 0, lost: 0, spd: 3, sp: 0, r: 0.3, h: 1.38, deadT: 0, acc: 0.4 });
}

// Puntos de cobertura precalculados: a lo largo del perímetro de cada contenedor/pilar (a 0,7 m de distancia).
const SPOTS = [];
for (const b of CFG.crates) {
  const hx = b[2] / 2 + 0.7, hz = b[3] / 2 + 0.7, per = 4 * (hx + hz), n = Math.max(8, Math.round(per / 1.6));
  for (let k = 0; k < n; k++) { // punto k sobre el rectángulo (recorrido uniforme)
    let t = (k / n) * per, x, z;
    if (t < 2 * hx) { x = -hx + t; z = -hz; } else if ((t -= 2 * hx) < 2 * hz) { x = hx; z = -hz + t; }
    else if ((t -= 2 * hz) < 2 * hx) { x = hx - t; z = hz; } else { t -= 2 * hx; x = -hx; z = hz - t; }
    if (free(b[0] + x, b[1] + z, 0.5)) SPOTS.push({ x: b[0] + x, z: b[1] + z });
  }
}

// ---------- Navegación: rejilla de 0,5 m + A* (8 vecinos). Los enemigos rodean los contenedores en vez de atascarse ----------
const CELL = 0.5, NN = Math.round((CFG.half * 2) / CELL), NAVR = 0.48;
const WALK = new Uint8Array(NN * NN);
for (let iz = 0; iz < NN; iz++) for (let ix = 0; ix < NN; ix++) WALK[iz * NN + ix] = free(-CFG.half + (ix + 0.5) * CELL, -CFG.half + (iz + 0.5) * CELL, NAVR) ? 1 : 0;
const cellOf = (v) => Math.max(0, Math.min(NN - 1, Math.floor((v + CFG.half) / CELL)));
const centerOf = (i) => -CFG.half + (i + 0.5) * CELL;

function nearestWalk(ix, iz) { // celda transitable más cercana (por si el punto cae dentro de un obstáculo)
  if (WALK[iz * NN + ix]) return [ix, iz];
  for (let r = 1; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const x = ix + dx, z = iz + dz;
    if (Math.max(Math.abs(dx), Math.abs(dz)) === r && x >= 0 && z >= 0 && x < NN && z < NN && WALK[z * NN + x]) return [x, z];
  }
  return null;
}
const lineFree = (ax, az, bx, bz) => { // ¿se puede ir en línea recta? (muestreo cada 0,25 m)
  const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.25);
  for (let i = 1; i < n; i++) { const t = i / n; if (!free(ax + (bx - ax) * t, az + (bz - az) * t, 0.4)) return false; }
  return true;
};

// Devuelve la lista de puntos intermedios hasta (gx,gz) o null si no hay camino.
function findPath(sx, sz, gx, gz) {
  const s0 = nearestWalk(cellOf(sx), cellOf(sz)), g0 = nearestWalk(cellOf(gx), cellOf(gz));
  if (!s0 || !g0) return null;
  const start = s0[1] * NN + s0[0], goal = g0[1] * NN + g0[0];
  const G = new Float32Array(NN * NN).fill(1e9), from = new Int32Array(NN * NN).fill(-1), closed = new Uint8Array(NN * NN);
  const heap = [[0, start]]; G[start] = 0;
  const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const gxC = goal % NN, gzC = (goal / NN) | 0;
  while (heap.length) {
    const [, cur] = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) break;
    const cx = cur % NN, cz = (cur / NN) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= NN || nz >= NN || !WALK[nz * NN + nx]) continue;
      if (dx && dz && (!WALK[cz * NN + nx] || !WALK[nz * NN + cx])) continue; // sin cortar esquinas
      const ni = nz * NN + nx, g = G[cur] + (dx && dz ? 1.414 : 1);
      if (g < G[ni]) { G[ni] = g; from[ni] = cur; push([g + Math.hypot(gxC - nx, gzC - nz), ni]); }
    }
  }
  if (from[goal] < 0 && goal !== start) return null;
  const cells = []; for (let c = goal; c !== -1; c = from[c]) cells.push({ x: centerOf(c % NN), z: centerOf((c / NN) | 0) });
  cells.reverse(); cells[0] = { x: sx, z: sz }; cells.push({ x: gx, z: gz });
  const out = []; let i = 0; // suavizado: saltar al punto más lejano visible en línea recta
  while (i < cells.length - 1) { let j = cells.length - 1; while (j > i + 1 && !lineFree(cells[i].x, cells[i].z, cells[j].x, cells[j].z)) j--; out.push(cells[j]); i = j; }
  return out;
}

// Asigna destino y calcula la ruta (si no hay ruta, va en línea recta).
function setGoal(e, goal, next) {
  e.goal = goal; e.next = next; e.state = 'move'; e.moveT = 0; e.stuckT = 0;
  e.path = findPath(e.x, e.z, goal.x, goal.z) || [goal];
}

const lvl = () => LEVELS[S.level];

export function startLevel(i) {
  S.level = i % LEVELS.length;
  const lv = lvl();
  Object.assign(S, { t: 0, grace: 3, deathT: 0, hp: CFG.player.hp, maxHp: CFG.player.hp, mag: CFG.weapon.mag,
    reloading: false, fireT: 0, latch: false, zoom: false, crouch: false, eye: CFG.eye, state: 'play' });
  Object.assign(S.player, { x: 0, z: 11, yaw: 0, pitch: 0, speed: 0 });
  S.enemies.forEach((e) => { e.active = false; e.alive = false; });
  lv.enemies.forEach((d, k) => {
    const e = S.enemies[k];
    Object.assign(e, { active: true, alive: true, x: d.x, z: d.z, hp: 2, helmet: !!d.helmet, crouch: true, state: 'hide',
      next: 'hide', timer: 1.5 + k * 0.7, react: lv.react, aimT: 0, aimK: 0, shots: 0, aiming: false, moving: false,
      sees: false, hitT: 0, face: 0, cover: null, goal: null, moveT: 0, lost: 0, spd: CFG.enemy.speed, deadT: 0, acc: lv.acc });
    retreat(e);
  });
  emit('level', S.level);
}

export function look(dx, dy) {
  const p = S.player;
  p.yaw -= dx * CFG.player.sens;
  p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch - dy * CFG.player.sens));
}

// Paso de simulación. dt en segundos (Delta Time) => independiente de los FPS.
export function update(dt, inp) {
  if (S.state === 'win' || S.state === 'over') {
    if (S.state === 'over') S.deathT += dt;
    for (const e of S.enemies) if (e.active && !e.alive) { e.deadT += dt; if (e.deadT > 3) e.active = false; }
    return;
  }
  if (S.state !== 'play') return;
  S.t += dt; S.grace = Math.max(0, S.grace - dt);
  S.eye += ((S.crouch ? CFG.eyeCrouch : CFG.eye) - S.eye) * Math.min(1, dt * 10); // agacharse/levantarse suave
  movePlayer(dt, inp);
  updateEnemies(dt);
}

function movePlayer(dt, inp) {
  const p = S.player, sp = CFG.player.speed * (S.zoom ? 0.55 : 1) * (S.crouch ? 0.55 : 1);
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
    else {
      const px = hx + r - Math.abs(o.x - b[0]), pz = hz + r - Math.abs(o.z - b[1]);
      if (px < pz) o.x += (o.x >= b[0] ? 1 : -1) * px; else o.z += (o.z >= b[1] ? 1 : -1) * pz;
    }
  }
}

// ---------- IA enemiga: esconderse -> asomar -> apuntar (aviso láser) -> disparar -> cambiar de cobertura ----------

// Mejor cobertura: oculta (agachado) la vista del jugador, a distancia razonable y cerca del enemigo.
function pickCover(e) {
  const p = S.player;
  let best = null, bs = 1e9;
  for (const c of SPOTS) {
    const dp = Math.hypot(c.x - p.x, c.z - p.z);
    if (dp < 5 || dp > 21) continue;
    if (!blocked(c.x, 1.25, c.z, p.x, S.eye, p.z)) continue;
    if (S.enemies.some((o) => o !== e && o.active && o.alive && o.goal && Math.hypot(o.goal.x - c.x, o.goal.z - c.z) < 1.5)) continue;
    const de = Math.hypot(c.x - e.x, c.z - e.z);
    const sc = de + Math.random() * 5 + (de < 1 ? 6 : 0);
    if (sc < bs) { bs = sc; best = c; }
  }
  return best;
}

// Punto desde el que asomarse: el más cercano a la cobertura con visión del jugador.
function pickPeek(c) {
  const p = S.player, dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1, tx = -dz / d, tz = dx / d;
  for (const o of [0, 0.8, -0.8, 1.4, -1.4, 2.1, -2.1]) {
    const x = c.x + tx * o, z = c.z + tz * o;
    if (free(x, z, 0.35) && !blocked(x, S.eye - 0.05, z, p.x, S.eye, p.z)) return { x, z };
  }
  return { x: c.x, z: c.z };
}

function retreat(e) {
  const c = pickCover(e);
  e.aiming = false; e.moveT = 0;
  if (c) { e.cover = c; setGoal(e, c, 'hide'); }
  else { e.state = 'hide'; e.timer = 1; e.crouch = true; }
}

function beginAim(e) {
  const lv = lvl();
  e.state = 'aim'; e.crouch = false; e.moving = false; e.aiming = true;
  e.aimT = e.aimDur = lv.aim; e.shots = Math.random() < lv.burst ? 2 : 1; e.lost = 0;
}

function turn(e, target, dt) { // giro suave hacia un ángulo
  let d = target - e.face;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  e.face += d * Math.min(1, dt * 12);
}

function updateEnemies(dt) {
  const p = S.player, lv = lvl();
  for (const e of S.enemies) {
    if (!e.active) continue;
    if (!e.alive) { e.deadT += dt; if (e.deadT > 3) e.active = false; continue; }
    e.hitT -= dt; e.timer -= dt;
    e.h = e.crouch ? CFG.enemy.hCrouch : e.aiming ? CFG.enemy.hAim : CFG.enemy.h;
    e.sees = !blocked(e.x, e.crouch ? 1.25 : 1.65, e.z, p.x, S.eye, p.z);
    const toP = Math.atan2(p.x - e.x, p.z - e.z);
    if (e.state === 'hide') {
      e.crouch = true; e.moving = false; turn(e, toP, dt);
      if (S.grace > 0) continue;
      if (e.sees) { e.react -= dt; if (e.react <= 0) beginAim(e); }
      else {
        e.react = lv.react;
        if (e.timer <= 0) setGoal(e, pickPeek(e.cover || e), 'aim');
      }
    } else if (e.state === 'move') {
      const last = !e.path || e.path.length <= 1, wp = e.path && e.path.length ? e.path[0] : e.goal;
      const gx = wp.x - e.x, gz = wp.z - e.z, gd = Math.hypot(gx, gz);
      e.moveT += dt; e.crouch = false; e.moving = true;
      e.sp = (e.next === 'aim' ? CFG.enemy.walk : CFG.enemy.run) * (e.spd / CFG.enemy.speed); // asoma andando, huye corriendo
      if ((last && gd < 0.2) || e.moveT > 8) {
        e.moving = false;
        if (e.next === 'aim') beginAim(e);
        else { e.state = 'hide'; e.crouch = true; e.timer = lv.hide[0] + Math.random() * (lv.hide[1] - lv.hide[0]); e.react = lv.react; }
      } else if (!last && gd < 0.25) e.path.shift(); // siguiente punto de la ruta
      else {
        turn(e, Math.atan2(gx, gz), dt);
        const st = Math.min(gd, e.sp * dt), ox = e.x, oz = e.z;
        e.x += (gx / gd) * st; e.z += (gz / gd) * st;
        resolve(e, e.r);
        // atascado (avanza menos de la mitad de lo esperado): recalcular la ruta; si sigue, abandonar el destino
        if (Math.hypot(e.x - ox, e.z - oz) < st * 0.5) {
          e.stuckT += dt;
          if (e.stuckT > 0.5) { e.path = findPath(e.x, e.z, e.goal.x, e.goal.z) || [e.goal]; e.stuckT = 0; e.stuckN = (e.stuckN || 0) + 1; if (e.stuckN > 3) { e.stuckN = 0; e.moveT = 9; } }
        } else e.stuckT = 0;
      }
    } else if (e.state === 'aim') {
      e.aiming = true; e.moving = false; e.crouch = false; turn(e, toP, dt);
      if (!e.sees) { e.lost += dt; if (e.lost > 0.9) retreat(e); continue; }
      e.lost = 0; e.aimT -= dt;
      e.aimK = Math.max(0, Math.min(1, 1 - e.aimT / (e.aimDur || 1)));
      if (e.aimT <= 0) {
        enemyShoot(e); e.shots--; e.aimT = e.aimDur = 0.5; e.aimK = 0;
        if (e.shots <= 0) retreat(e);
      }
    }
  }
}

function enemyShoot(e) {
  const p = S.player, dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz);
  const from = [e.x + Math.sin(e.face) * 0.55, 1.5, e.z + Math.cos(e.face) * 0.55];
  const sees = e.sees; // misma visión que usó para decidir disparar
  const acc = Math.max(0.12, e.acc * (1 - dist / 45) * (p.speed > 1 ? 0.65 : 1) * (S.crouch ? 0.75 : 1)); // agachado = blanco más pequeño
  let end, hit = false, head = false;
  if (sees && Math.random() < acc) { hit = true; head = Math.random() < 0.3; end = [p.x, head ? S.eye : S.eye - 0.5, p.z]; }
  else if (sees) end = [p.x + (Math.random() - 0.5) * 1.4, 0.4 + Math.random() * 1.6, p.z + (Math.random() - 0.5) * 1.4];
  else { // tapado: la bala golpea la caja
    const d = [p.x - from[0], S.eye - from[1], p.z - from[2]], l = Math.hypot(...d), t = rayWorld(from[0], from[1], from[2], d[0] / l, d[1] / l, d[2] / l);
    end = [from[0] + (d[0] / l) * t, from[1] + (d[1] / l) * t, from[2] + (d[2] / l) * t];
  }
  emit('enemyShot', { e, from, end, hit, head });
  if (hit) hurtPlayer(head);
}

function hurtPlayer(head) {
  S.hp = head ? 0 : S.hp - 1;
  emit('hurt', { head });
  if (S.hp <= 0) { S.hp = 0; S.state = 'over'; S.deathT = 0; emit('over', { head }); }
}

// El jugador impacta a un enemigo: cabeza = muerte (el casco absorbe el primer tiro); cuerpo = -1 vida.
export function damageEnemy(e, head, pt) {
  e.hitT = 0.35;
  if (head) {
    if (e.helmet) { e.helmet = false; emit('helmet', { e, pt }); retreat(e); return; }
    e.hp = 0;
  } else e.hp -= 1;
  if (e.hp > 0) { e.acc *= 0.7; emit('hit', { e, head, pt }); retreat(e); return; }
  e.alive = false; e.aiming = false; e.moving = false; e.deadT = 0;
  emit('kill', { e, head, pt });
  if (!S.enemies.some((o) => o.active && o.alive)) { S.state = 'win'; emit('win', { time: S.t }); }
}
