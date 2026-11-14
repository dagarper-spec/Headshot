// Entrada unificada: teclado + ratón (pointer lock) en escritorio, joystick + arrastre táctil en móvil.
export const input = { mx: 0, mz: 0, dx: 0, dy: 0, turn: 0, fire: false, reload: false, touch: false, noLock: false };

const keys = {};
const stick = { id: -1, ox: 0, oy: 0, x: 0, z: 0 };
const look = { id: -1, x: 0, y: 0 };
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
  const zone = $('stick'), knob = zone.firstElementChild;

  document.addEventListener('touchstart', (e) => {
    if (e.target.closest('.btn,.ov')) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && stick.id < 0) {
        Object.assign(stick, { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, z: 0 });
        zone.style.cssText = `display:block;left:${t.clientX - 55}px;top:${t.clientY - 55}px`;
        knob.style.transform = 'translate(0,0)';
      } else if (look.id < 0) Object.assign(look, { id: t.identifier, x: t.clientX, y: t.clientY });
    }
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) {
        let dx = (t.clientX - stick.ox) / 50, dy = (t.clientY - stick.oy) / 50;
        const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        stick.x = dx; stick.z = -dy;
        knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`;
      } else if (t.identifier === look.id) {
        input.dx += (t.clientX - look.x) * 1.7; input.dy += (t.clientY - look.y) * 1.7;
        look.x = t.clientX; look.y = t.clientY;
      }
    }
  }, { passive: false });

  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) { stick.id = -1; stick.x = stick.z = 0; zone.style.display = 'none'; }
      if (t.identifier === look.id) look.id = -1;
    }
  };
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', end);

  const hold = (el, on, off) => {
    el.addEventListener('touchstart', (e) => { e.preventDefault(); on(); }, { passive: false });
    ['touchend', 'touchcancel'].forEach((n) => el.addEventListener(n, (e) => { e.preventDefault(); off(); }));
  };
  hold($('bFire'), () => { input.fire = true; }, () => { input.fire = false; });
  hold($('bRel'), () => { input.reload = true; }, () => {});
}

// Combina teclado y joystick en los ejes de movimiento.
export function poll() {
  const kx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  input.turn = (keys.ArrowLeft || keys.KeyQ ? 1 : 0) - (keys.ArrowRight || keys.KeyE ? 1 : 0); // giro con teclado
  const kz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  input.mx = Math.max(-1, Math.min(1, kx + stick.x));
  input.mz = Math.max(-1, Math.min(1, kz + stick.z));
}
