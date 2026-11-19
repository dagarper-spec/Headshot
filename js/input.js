// Entrada unificada: teclado + ratón (pointer lock) en escritorio, joystick + arrastre táctil en móvil.
export const input = { mx: 0, mz: 0, dx: 0, dy: 0, rx: 0, ry: 0, turn: 0, fire: false, reload: false, touch: false, noLock: false, zoom: false, crouch: false, pulse: 0, rHeld: () => false, swap: false, zl: 1 };
const zlLabel = () => { const b = document.getElementById('bZl'); if (b) b.innerHTML = 'ZOOM<br>' + (input.zl ? 2 : 1); };

const keys = {};
const pads = { L: { id: -1, x: 0, y: 0, el: null }, R: { id: -1, x: 0, y: 0, el: null } }; // ruletas táctiles
let edgeT = 0;
const $ = (id) => document.getElementById(id);

const toggleCrouch = () => {
  input.crouch = !input.crouch;
  const b = document.getElementById('bCrouch'); if (b) b.classList.toggle('on', input.crouch);
};
export const resetCrouch = () => { input.crouch = false; const b = document.getElementById('bCrouch'); if (b) b.classList.remove('on'); };

export function initInput(canvas) {
  input.touch = matchMedia('(pointer:coarse)').matches; // solo si el puntero principal es táctil

  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyR') input.reload = true;
    if (e.code === 'KeyQ' && !e.repeat) input.swap = true;
    if (e.code === 'KeyX' && !e.repeat) { input.zl ^= 1; zlLabel(); }
    if (e.code === 'KeyC' && !e.repeat) toggleCrouch();
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
    const ok = document.pointerLockElement === canvas || input.noLock;
    if (e.button === 0 && ok) input.fire = true;
    if (e.button === 2 && ok) input.zoom = true; // botón derecho: apuntar con zoom
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) input.fire = false; if (e.button === 2) input.zoom = false; });
  addEventListener('wheel', (e) => { if (document.pointerLockElement && input.zoom) { input.zl = e.deltaY < 0 ? 1 : 0; zlLabel(); } }, { passive: true }); // rueda: cambia el zoom del sniper
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  if (!input.touch) return;
  pads.L.el = $('sL'); pads.R.el = $('sR');

  // Ruleta fija: la posición del dedo respecto al centro da el valor (-1..1).
  const setPad = (p, t) => {
    const r = p.el.getBoundingClientRect();
    // izquierda: centro fijo. derecha: el origen es donde pones el dedo (así un toque no mueve la cámara)
    const cx = p === pads.R ? p.ox : r.left + r.width / 2, cy = p === pads.R ? p.oy : r.top + r.height / 2;
    let dx = (t.clientX - cx) / 50, dy = (t.clientY - cy) / 50;
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    p.mv = Math.max(p.mv || 0, l);
    p.x = dx; p.y = dy;
    p.el.firstElementChild.style.transform = `translate(${dx * r.width * 0.3}px,${dy * r.width * 0.3}px)`;
  };
  // Mantener el dedo quieto en la ruleta derecha dispara en continuo (armas automáticas); sigue disparando aunque luego apuntes.
  input.rHeld = () => { const p = pads.R; if (p.id < 0) return false; if (!p.fireOn && !p.noFire) { if (p.mv > 0.3) p.noFire = true; else if (performance.now() - p.t0 > 220) p.fireOn = true; } return !!p.fireOn; }; // quieto = dispara; si arrastras antes, solo apuntas
  const reset = (p) => { p.fireOn = p.noFire = false; p.id = -1; p.x = p.y = 0; p.el.firstElementChild.style.transform = 'translate(0,0)'; };
  for (const p of [pads.L, pads.R]) {
    p.el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (p.id >= 0) return;
      const t = e.changedTouches[0]; p.id = t.identifier;
      p.ox = t.clientX; p.oy = t.clientY; p.t0 = e.timeStamp; p.mv = 0; // hora real del toque (no la del frame)
      setPad(p, t);
    }, { passive: false });
  }
  document.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) for (const p of [pads.L, pads.R]) if (t.identifier === p.id) setPad(p, t);
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) for (const p of [pads.L, pads.R]) {
      if (t.identifier !== p.id) continue;
      // toque corto y sin arrastrar en la ruleta derecha = disparo
      if (p === pads.R && e.type === 'touchend' && e.timeStamp - p.t0 < 230 && p.mv < 0.3) input.pulse = 0.15;
      reset(p);
    }
  };
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', end);

  const hold = (el, on, off) => {
    if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); on(); }, { passive: false });
    ['touchend', 'touchcancel'].forEach((n) => el.addEventListener(n, (e) => { e.preventDefault(); off(); }));
  };
  hold($('bZoom'), () => { input.zoom = !input.zoom; $('bZoom').classList.toggle('on', input.zoom); }, () => {});
  hold($('bCrouch'), toggleCrouch, () => {});
  hold($('bRel'), () => { input.reload = true; }, () => {});
  hold($('bSwap'), () => { input.swap = true; }, () => {});
  hold($('bGren'), () => {}, () => {}); // explosivo: de momento sin función
  hold($('bZl'), () => { input.zl ^= 1; zlLabel(); }, () => {});
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
