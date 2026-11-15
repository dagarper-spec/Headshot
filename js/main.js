// Punto de entrada: une lógica, vista, audio e interfaz. Bucle con Delta Time y calidad adaptable.
import { CFG, TIERS, LEVELS } from './config.js';
import * as core from './game-core.js';
import { stats, reload, updateCombat, aimAssist } from './game-combat.js';
import { loadModel, loadMixamo } from './loader.js';
import { createView } from './view-scene.js';
import { loadFps } from './view-fps.js';
import { createFx } from './view-fx.js';
import { input, initInput, poll, resetCrouch } from './input.js';
import { initAudio, sfx } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { ui } from './ui.js';

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
  const fpsData = await loadFps(CFG.models.dir); // pistola animada + mano (opcional)
  let view;
  try { view = createView(canvas, tier, model, fpsData); } catch (e) { // si el render avanzado falla, reintentar en calidad baja
    console.warn('createView falló, reintento en baja', e); tier = 'low'; view = createView(canvas, 'low', model, fpsData);
  }
  const fx = createFx(view.scene, view.camera);
  let slowT = 0, endTimer = 0; // cámara lenta al terminar el nivel

  // ----- Eventos de la lógica -> efectos, sonido y UI -----
  on('shot', (d) => {
    sfx.shot(); view.shot(); fx.shoot(d.end);
    if (!d.hit) fx.burst(...d.end, 2.4, 1.6, 0.6, 7, 3.5); // chispas en la pared/caja
  });
  on('enemyShot', (d) => {
    const from = view.gunPos(d.e.id) || d.from; view.fire(d.e.id);
    sfx.eshot(); fx.shoot(d.end, from);
    fx.burst(...from, 3, 2, 0.8, 6, 2);
    if (!d.hit) fx.burst(...d.end, 2.4, 1.6, 0.6, 6, 3);
  });
  on('hit', (d) => { sfx.hit(); ui.hitmarker(false, false); fx.burst(...d.pt, 1.6, 0.1, 0.05, 12, 3); });
  on('helmet', (d) => { sfx.head(); ui.hitmarker(false, true); fx.burst(...d.pt, 3, 2.6, 1.6, 22, 5); ui.toast('¡Casco fuera! Otro tiro a la cabeza'); });
  on('kill', (d) => { sfx.kill(); ui.hitmarker(true, d.head); fx.burst(...d.pt, 1.8, 0.08, 0.04, 34, 5); });
  on('hurt', (d) => { sfx.hurt(); ui.hurt(); fx.shake = d.head ? 1 : 0.6; if (!d.head) ui.toast('Herido: un tiro más y caes'); });
  on('reload', () => sfx.reload());
  on('empty', () => sfx.empty());
  on('level', (i) => { ui.banner(LEVELS[i].name.toUpperCase(), 1600); sfx.wave(); });
  const finish = () => { slowT = 1.1; endTimer = 1.3; };
  on('win', finish);
  on('over', finish);

  // ----- Menús -----
  const sel = $('quality'); sel.value = data.quality;
  sel.onchange = () => {
    data.quality = sel.value; writeSave(data);
    tier = sel.value === 'auto' ? autoTier() : sel.value; view.setQuality(tier);
  };
  const note = () => 'Nivel ' + (data.level + 1) + ': ' + LEVELS[data.level % LEVELS.length].name;
  const begin = (lvl) => {
    try { initAudio(); } catch { /* sin audio */ }
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
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  ui.menu('HEADSHOT', 'Jugar', ''); syncCont(false);

  // ----- Bucle principal con Delta Time -----
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
        data.level = Math.max(data.level, (S.level + 1) % LEVELS.length); writeSave(data);
        ui.end(true, 'NIVEL SUPERADO', 'Tiempo <b>' + S.t.toFixed(1) + ' s</b>', 'Siguiente nivel');
      } else ui.end(false, 'HAS CAÍDO', 'Aguantaste <b>' + S.t.toFixed(1) + ' s</b>', 'Reintentar');
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
    fx.update(dt);
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
        tier = TIERS[TIERS.indexOf(tier) - 1]; view.setQuality(tier); warm = 1;
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
