// Entrada unificada: teclado + ratón (pointer lock) en escritorio, joystick + arrastre táctil en móvil.
export const input = { mx: 0, mz: 0, dx: 0, dy: 0, rx: 0, ry: 0, turn: 0, fire: false, reload: false, touch: false, noLock: false };

const keys = {};
const pads = { L: { id: -1, x: 0, y: 0, el: null }, R: { id: -1, x: 0, y: 0, el: null } }; // ruletas táctiles
let edgeT = 0;
const $ = (id) => document.getElementById(id);

export function initInput(canvas) {
  input.touch = matchMedia('(pointer:coarse)').matches; // solo si el puntero principal es táctil

  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyR') input.reload = true;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; input.fire = false; });

  document.addEventListener('mousemove', (e) => {
    // con pointer lock siempre; si el navegador lo bloquea, mirar arrastrando con el botón pulsado
    if (document.pointerLockElement === canvas || (input.noLock && e.buttons)) { input.dx += e.movementX; input.dy += e.movementY; }
  });
  document.addEventListener('pointerlockerror', () => { input.noLock = true; });
  document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && (document.pointerLockElement === canvas || input.noLock)) input.fire = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) input.fire = false; });

  if (!input.touch) return;
  pads.L.el = $('sL'); pads.R.el = $('sR');

  // Ruleta fija: la posición del dedo respecto al centro da el valor (-1..1).
  const setPad = (p, t) => {
    const r = p.el.getBoundingClientRect();
    let dx = (t.clientX - r.left - r.width / 2) / 50, dy = (t.clientY - r.top - r.height / 2) / 50;
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    p.x = dx; p.y = dy;
    p.el.firstElementChild.style.transform = `translate(${dx * 38}px,${dy * 38}px)`;
  };
  const reset = (p) => { p.id = -1; p.x = p.y = 0; p.el.firstElementChild.style.transform = 'translate(0,0)'; };
  for (const p of [pads.L, pads.R]) {
    p.el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (p.id >= 0) return;
      const t = e.changedTouches[0]; p.id = t.identifier; setPad(p, t);
    }, { passive: false });
  }
  document.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) for (const p of [pads.L, pads.R]) if (t.identifier === p.id) setPad(p, t);
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) for (const p of [pads.L, pads.R]) if (t.identifier === p.id) reset(p);
  };
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', end);

  const hold = (el, on, off) => {
    el.addEventListener('touchstart', (e) => { e.preventDefault(); on(); }, { passive: false });
    ['touchend', 'touchcancel'].forEach((n) => el.addEventListener(n, (e) => { e.preventDefault(); off(); }));
  };
  const fireOn = () => { input.fire = true; }, fireOff = () => { input.fire = false; };
  hold($('bFire'), fireOn, fireOff); hold($('bFireL'), fireOn, fireOff);
  hold($('bRel'), () => { input.reload = true; }, () => {});
}

// Zona muerta + curva: salida suave y precisa cerca del centro, rápida en el borde.
function shape(x, y, pow) {
  const m = Math.hypot(x, y);
  if (m < 0.12) return [0, 0, m];
  const k = Math.pow((m - 0.12) / 0.88, pow) / m;
  return [x * k, y * k, m];
}

// Combina teclado y ruletas. dt: segundos (para la aceleración al empujar la ruleta al máximo).
export function poll(dt) {
  const [lx, ly] = shape(pads.L.x, pads.L.y, 1);
  const [rx, ry, rm] = shape(pads.R.x, pads.R.y, 1.8);
  edgeT = rm > 0.92 ? edgeT + dt : 0;
  const boost = 1 + 0.6 * Math.min(1, edgeT / 0.35);
  input.rx = rx * boost; input.ry = ry * boost;
  const kx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const kz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  input.turn = (keys.ArrowLeft || keys.KeyQ ? 1 : 0) - (keys.ArrowRight || keys.KeyE ? 1 : 0);
  input.mx = Math.max(-1, Math.min(1, kx + lx));
  input.mz = Math.max(-1, Math.min(1, kz - ly));
}
