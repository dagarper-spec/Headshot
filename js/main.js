// Punto de entrada: une lógica, vista, audio e interfaz. Bucle con Delta Time y calidad adaptable.
import { CFG, TIERS, LEVELS } from './config.js';
import * as core from './game-core.js';
import { stats, reload, updateCombat, aimAssist, spread } from './game-combat.js';
import { loadModel, loadMixamo, loadProps } from './loader.js';
import { createView } from './view-scene.js';
import { loadFps } from './view-fps.js';
import { createFx } from './view-fx.js';
import { rayWorld, surface } from './game-geom.js';
import { input, initInput, poll, resetCrouch } from './input.js';
import { initAudio, sfx, music } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { ui } from './ui.js';
import { reward, applyUpgrades, renderShop } from './shop.js';

const { S, on } = core;
const canvas = document.getElementById('c');
const data = loadSave();
const $ = (id) => document.getElementById(id);

initInput(canvas);
if (input.touch) document.body.classList.add('touch');
window.headshot = { S, core, input }; // acceso para pruebas y depuración

// Calidad inicial según dispositivo (móvil -> más baja). Auto reduce si los FPS caen.
function autoTier() {
  const cores = navigator.hardwareConcurrency || 4;
  if (input.touch) return cores >= 6 ? 'medium' : 'low';
  return cores <= 4 ? 'medium' : 'high';
}
let tier = data.quality === 'auto' ? autoTier() : data.quality;

async function boot() {
  const model = (await loadMixamo(CFG.models.dir)) || (await loadModel(CFG.models.enemy)); // Mixamo > .glb > procedural
  const props = await loadProps(CFG.models.dir); // contenedores del escenario (opcional)
  const fpsData = await loadFps(CFG.models.dir); // pistola animada + mano (opcional)
  let view;
  try { view = createView(canvas, tier, model, fpsData, props); } catch (e) { // si el render avanzado falla, reintentar en calidad baja
    console.warn('createView falló, reintento en baja', e); tier = 'low'; view = createView(canvas, 'low', model, fpsData, props);
  }
  const fx = createFx(view.scene, view.camera, view);
  window.headshot.fx = fx; window.headshot.view = view; // depuración
  let slowT = 0, endTimer = 0; // cámara lenta al terminar el nivel

  // ----- Eventos de la lógica -> efectos, sonido y UI -----
  const fq = { low: 0.5, medium: 0.75, high: 1 };
  const applyTier = () => { view.setQuality(tier); fx.setQuality(fq[tier] || 1); };
  applyTier(); fx.setBlood(data.blood);
  fx.onTink = (v) => sfx.tink(v);
  const imp = (pt, s) => { if (!s) return; fx.impact(pt, s.n, s.kind); sfx.imp(s.kind); };
  // Sangre que salpica en la pared/suelo detrás del enemigo, en la dirección del disparo.
  const splatBehind = (pt, dir, size) => {
    if (!dir) return;
    const t = rayWorld(pt[0], pt[1], pt[2], dir[0], dir[1], dir[2]);
    if (t > 9) return;
    const q = [pt[0] + dir[0] * t, pt[1] + dir[1] * t, pt[2] + dir[2] * t], sf = surface(q[0], q[1], q[2]);
    fx.splat(q, sf.n, size);
    fx.splat([q[0] + (Math.random() - 0.5) * 0.7, q[1] + (Math.random() - 0.5) * 0.6, q[2] + (Math.random() - 0.5) * 0.7], sf.n, size * 0.6);
    fx.splat([pt[0] + (Math.random() - 0.5) * 0.6, 0.004, pt[2] + (Math.random() - 0.5) * 0.6], [0, 1, 0], size * 1.3); // salpicadura en el suelo
  };
  on('shot', (d) => {
    sfx.shot(); music.duck(); view.shot(); fx.shoot(d.end);
    if (!d.hit) setTimeout(() => imp(d.end, d.surf), 40);
  });
  on('enemyShot', (d) => {
    music.duck();
    const from = view.gunPos(d.e.id) || d.from; view.fire(d.e.id);
    sfx.eshot(); fx.shoot(d.end, from);
    if (!d.hit) imp(d.end, d.surf);
  });
  on('hit', (d) => { sfx.hit(); ui.hitmarker(false, false); fx.blood(d.pt, d.dir || [0, 0, 0], 1); splatBehind(d.pt, d.dir, 0.4); });
  on('helmet', (d) => {
    sfx.helmet(); ui.hitmarker(false, true); fx.impact(d.pt, d.dir ? [-d.dir[0], -d.dir[1], -d.dir[2]] : [0, 1, 0], 'metal', 1.5, false);
    ui.toast('¡Casco fuera! Otro tiro a la cabeza');
  });
  on('kill', (d) => {
    d.head ? sfx.killHead() : sfx.kill(); sfx.hit(); ui.hitmarker(true, d.head);
    fx.blood(d.pt, d.dir || [0, 0, 0], d.head ? 2.4 : 1.5); splatBehind(d.pt, d.dir, d.head ? 0.8 : 0.55);
    const x = d.e.x, z = d.e.z; setTimeout(() => fx.pool(x, z), 500); // el charco crece bajo el cuerpo
  });
  on('hurt', (d) => { sfx.hurt(); ui.hurt(); fx.shake = d.head ? 1 : 0.6; if (!d.head) ui.toast('Herido: un tiro más y caes'); });
  on('reload', () => { const r = CFG.weapon.reload; sfx.magOut(r * 0.22); sfx.magIn(r * 0.62); sfx.slide(r * 0.86); });
  on('empty', () => sfx.empty());
  on('level', (i) => { fx.clear(); ui.banner(LEVELS[i].name.toUpperCase(), 1600); sfx.wave(); });
  const finish = () => { slowT = 1.1; endTimer = 1.3; };
  on('win', finish);
  on('over', finish);

  // ----- Menús -----
  const sel = $('quality'); sel.value = data.quality;
  sel.onchange = () => {
    data.quality = sel.value; writeSave(data);
    tier = sel.value === 'auto' ? autoTier() : sel.value; applyTier();
  };
  const bl = $('blood'); bl.value = data.blood; bl.onchange = () => { data.blood = bl.value; writeSave(data); fx.setBlood(data.blood); };
  const mus = $('music'); mus.value = data.music ? '1' : '0'; music.setOn(false); // empieza al pulsar Jugar (gesto del usuario)
  mus.onchange = () => { data.music = mus.value === '1'; writeSave(data); music.setOn(data.music && S.state !== 'menu'); };
  // ----- Tienda -----
  applyUpgrades(data);
  let shopFrom = 'menu';
  const openShop = (from) => { shopFrom = from; ui.hide(from); renderShop(data, () => writeSave(data)); ui.show('shop'); };
  $('shopBtn').onclick = () => openShop('over');
  $('menuShop').onclick = () => openShop('menu');
  $('shopBack').onclick = () => { ui.hide('shop'); ui.show(shopFrom); syncCont(S.state === 'pause'); };
  const note = () => 'Nivel ' + (data.level + 1) + ': ' + LEVELS[data.level % LEVELS.length].name;
  const begin = (lvl) => {
    try { initAudio(); } catch { /* sin audio */ }
    music.setOn(data.music);
    if (!input.touch) canvas.requestPointerLock();
    ui.hide('menu'); ui.hide('over'); ui.show('hud');
    if (input.touch) ui.show('touch');
    if (S.state === 'pause') S.state = 'play'; else { resetCrouch(); core.startLevel(lvl); }
  };
  $('start').onclick = () => begin(0); // Jugar: siempre desde el nivel 1 (o continúa si está en pausa)
  $('cont').onclick = () => begin(data.level);
  // El botón "Continuar: nivel N" solo aparece si ya superaste algún nivel y no estás en pausa.
  const syncCont = (paused) => {
    const c = $('cont'); c.textContent = 'Continuar: nivel ' + (data.level + 1);
    c.classList[!paused && data.level > 0 ? 'remove' : 'add']('hide');
    $('menuShop').classList[!paused && (data.level > 0 || data.coins > 0) ? 'remove' : 'add']('hide');
  };
  $('again').onclick = () => begin(S.state === 'win' ? S.level + 1 : S.level); // victoria -> siguiente; derrota -> reintentar
  addEventListener('keydown', (e) => { if (e.code === 'Enter' && !$('over').classList.contains('hide')) $('again').click(); });
  const pause = () => {
    if (S.state !== 'play') return;
    S.state = 'pause'; input.fire = false; input.zoom = false;
    if (document.pointerLockElement) document.exitPointerLock();
    ui.menu('PAUSA', 'Continuar', note(), true); syncCont(true);
  };
  $('bPause').onclick = pause;
  $('restart').onclick = () => { S.state = 'menu'; begin(S.level); }; // reinicia el nivel actual
  addEventListener('keydown', (e) => { if (e.code === 'KeyP') pause(); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && !input.touch) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); music.pause(); } else music.setOn(data.music && S.state !== 'menu'); });
  ui.menu('HEADSHOT', 'Jugar', ''); syncCont(false);

  // ----- Bucle principal con Delta Time -----
  const xh = $('xh'); let gap = 5;
  let prev = performance.now(), acc = 0, frames = 0, warm = 2;
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = Math.min((now - prev) / 1000, 0.05); // limitar saltos (pestaña en segundo plano)
    prev = now;
    if (slowT > 0) slowT -= raw;
    const dt = raw * (slowT > 0 ? 0.25 : 1); // cámara lenta
    if (endTimer > 0 && (endTimer -= raw) <= 0) { // mostrar resultado tras la cámara lenta
      if (document.pointerLockElement) document.exitPointerLock();
      if (S.state === 'win') {
        const r = reward(S.level, S.t); data.coins += r;
        data.level = Math.max(data.level, (S.level + 1) % LEVELS.length); writeSave(data);
        ui.end(true, 'NIVEL SUPERADO', 'Tiempo <b>' + S.t.toFixed(1) + ' s</b> (par ' + LEVELS[S.level].par + ' s)<br>Recompensa <b>+$' + r + '</b> · Total <b>$' + data.coins + '</b>', 'Siguiente nivel');
        ui.show('shopBtn');
      } else { ui.end(false, 'HAS CAÍDO', 'Aguantaste <b>' + S.t.toFixed(1) + ' s</b>', 'Reintentar'); ui.hide('shopBtn'); }
    }
    S.zoom = input.zoom && S.state === 'play';
    S.crouch = input.crouch && S.state === 'play';
    if (input.pulse > 0) input.pulse -= raw;
    if (S.state === 'play') {
      poll(dt);
      // ruletas/teclado -> velocidad angular con Delta Time; ayuda al apuntar y zoom reducen la sensibilidad
      const k = (dt / CFG.player.sens) * (S.zoom ? 0.5 : 1) * (input.touch && aimAssist() ? 0.5 : 1);
      core.look(input.dx - input.turn * 2.4 * k + input.rx * 3.3 * k, input.dy + input.ry * 2.3 * k);
      core.update(dt, input);
      if (input.reload) reload();
      updateCombat(dt, input.fire || input.pulse > 0); // pulse = toque en la ruleta derecha
    } else core.update(dt, input);
    input.dx = input.dy = 0; input.reload = false;
    fx.update(dt); music.update(raw);
    // retícula reactiva: se abre al moverte, al estar herido y con el retroceso; se cierra al agacharte; con zoom solo queda el punto
    gap += (5 + spread() * 650 + fx.kick * 8 - gap) * Math.min(1, raw * 14);
    xh.style.setProperty('--g', gap.toFixed(1) + 'px'); xh.classList.toggle('zoom', S.zoom);
    const st = stats();
    view.sync(S, now / 1000, dt, fx, S.reloading ? 1 - S.reloadT / st.reload : -1);
    if (S.state !== 'menu') ui.hud(S, st, LEVELS[S.level].name);
    view.render();

    // Calidad adaptable: si la media de FPS baja de 40 durante 2 s, bajar un nivel.
    acc += raw; frames++;
    if (acc >= 2) {
      const fps = frames / acc; acc = 0; frames = 0;
      if (warm > 0) warm--;
      else if (S.state === 'play' && fps < 40 && data.quality === 'auto' && TIERS.indexOf(tier) > 0) {
        tier = TIERS[TIERS.indexOf(tier) - 1]; applyTier(); warm = 1;
        ui.toast('Calidad ajustada: ' + tier);
      }
    }
  }
  requestAnimationFrame(frame);
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('menu').insertAdjacentHTML('beforeend', '<p class="err">Error al iniciar: ' + e.message + '</p>');
});
