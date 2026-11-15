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

// Puntos de cobertura precalculados alrededor de cada caja/pilar.
const SPOTS = [];
for (const b of CFG.crates) {
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, x = b[0] + Math.cos(a) * (b[2] / 2 + 0.7), z = b[1] + Math.sin(a) * (b[3] / 2 + 0.7);
    if (free(x, z, 0.4)) SPOTS.push({ x, z });
  }
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
  if (c) { e.cover = c; e.goal = c; e.next = 'hide'; e.state = 'move'; }
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
        if (e.timer <= 0) { e.goal = pickPeek(e.cover || e); e.next = 'aim'; e.state = 'move'; e.moveT = 0; }
      }
    } else if (e.state === 'move') {
      const gx = e.goal.x - e.x, gz = e.goal.z - e.z, gd = Math.hypot(gx, gz);
      e.moveT += dt; e.crouch = false; e.moving = true;
      e.sp = (e.next === 'aim' ? CFG.enemy.walk : CFG.enemy.run) * (e.spd / CFG.enemy.speed); // asoma andando, huye corriendo
      if (gd < 0.2 || e.moveT > 4.5) {
        e.moving = false;
        if (e.next === 'aim') beginAim(e);
        else { e.state = 'hide'; e.crouch = true; e.timer = lv.hide[0] + Math.random() * (lv.hide[1] - lv.hide[0]); e.react = lv.react; }
      } else {
        turn(e, Math.atan2(gx, gz), dt);
        const st = Math.min(gd, e.sp * dt), ox = e.x, oz = e.z;
        e.x += (gx / gd) * st; e.z += (gz / gd) * st;
        resolve(e, e.r);
        if (Math.hypot(e.x - ox, e.z - oz) < st * 0.4) { e.x += (-gz / gd) * st; e.z += (gx / gd) * st; resolve(e, e.r); } // rodear obstáculo
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
