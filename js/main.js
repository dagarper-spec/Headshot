// Punto de entrada: une lógica, vista, audio e interfaz. Bucle con Delta Time y calidad adaptable.
import { CFG, TIERS, UPGRADES } from './config.js';
import * as core from './game-core.js';
import { stats, applyUpgrade, reload, updateCombat, aimingAtEnemy } from './game-combat.js';
import { loadModel } from './loader.js';
import { createView } from './view-scene.js';
import { createFx } from './view-fx.js';
import { input, initInput, poll } from './input.js';
import { initAudio, sfx } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { ui } from './ui.js';

const { S, on } = core;
const canvas = document.getElementById('c');
const data = loadSave();
const $ = (id) => document.getElementById(id);

initInput(canvas);

// Calidad inicial según dispositivo (móvil -> más baja). Auto reduce si los FPS caen.
function autoTier() {
  const cores = navigator.hardwareConcurrency || 4;
  if (input.touch) return cores >= 6 ? 'medium' : 'low';
  return cores <= 4 ? 'medium' : 'high';
}
let tier = data.quality === 'auto' ? autoTier() : data.quality;

async function boot() {
  const model = await loadModel(CFG.models.enemy);
  const view = createView(canvas, tier, model);
  const fx = createFx(view.scene, view.camera);

  // ----- Eventos de la lógica -> efectos, sonido y UI -----
  on('shot', (d) => {
    sfx.shot(); fx.shoot(d.end);
    if (d.hit) fx.burst(...d.end, 1.6, 0.1, 0.05, d.head ? 14 : 8, 3);
    else fx.burst(...d.end, 2.4, 1.6, 0.6, 6, 3.5);
  });
  on('hit', (d) => { (d.head ? sfx.head : sfx.hit)(); ui.hitmarker(false, d.head); });
  on('kill', (d) => {
    sfx.kill(); ui.hitmarker(true, d.head);
    fx.burst(d.e.x, d.e.h * 0.55, d.e.z, 1.8, 0.08, 0.04, 30, 5);
  });
  on('hurt', () => { sfx.hurt(); ui.hurt(); fx.shake = 0.6; });
  on('reload', () => sfx.reload());
  on('empty', () => sfx.empty());
  on('wave', (w) => { ui.banner('OLEADA ' + w); sfx.wave(); });
  on('waveclear', (w) => {
    if (document.pointerLockElement) document.exitPointerLock();
    const pick = UPGRADES.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    ui.upgrades(pick, (id) => {
      applyUpgrade(id); sfx.up(); core.nextWave();
      if (!input.touch) canvas.requestPointerLock();
    });
    ui.banner('OLEADA ' + w + ' SUPERADA', 1500);
  });
  on('over', () => {
    if (document.pointerLockElement) document.exitPointerLock();
    const isNew = S.score > data.best;
    if (isNew) { data.best = S.score; data.wave = S.wave; writeSave(data); }
    ui.over(S, data, isNew);
  });

  // ----- Menús -----
  const best = () => (data.best ? { score: data.best, wave: data.wave } : null);
  const sel = $('quality'); sel.value = data.quality;
  sel.onchange = () => {
    data.quality = sel.value; writeSave(data);
    tier = sel.value === 'auto' ? autoTier() : sel.value; view.setQuality(tier);
  };
  const chk = $('auto'); chk.checked = data.auto;
  chk.onchange = () => { data.auto = chk.checked; writeSave(data); };
  const begin = () => {
    initAudio();
    if (!input.touch) canvas.requestPointerLock();
    ui.hide('menu'); ui.hide('over'); ui.show('hud');
    if (input.touch) ui.show('touch');
    if (S.state === 'pause') S.state = 'play'; else core.startGame();
  };
  $('start').onclick = begin;
  $('again').onclick = begin;
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && S.state === 'play' && !input.touch) {
      S.state = 'pause'; input.fire = false; ui.menu('PAUSA', 'Continuar', best());
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.state === 'play') { S.state = 'pause'; input.fire = false; ui.menu('PAUSA', 'Continuar', best()); }
  });
  ui.menu('HEADSHOT', 'Jugar', best());

  // ----- Bucle principal con Delta Time -----
  let prev = performance.now(), acc = 0, frames = 0, warm = 2;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - prev) / 1000, 0.05); // limitar saltos (pestaña en segundo plano)
    prev = now;
    if (S.state === 'play') {
      poll(dt);
      const k = dt / CFG.player.sens; // ruleta derecha / teclado -> velocidad angular (rad/s) con Delta Time
      core.look(input.dx - input.turn * 2.4 * k + input.rx * 3.3 * k, input.dy + input.ry * 2.3 * k);
      core.update(dt, input);
      if (input.reload) reload();
      updateCombat(dt, input.fire || (input.touch && data.auto && aimingAtEnemy()));
    }
    input.dx = input.dy = 0; input.reload = false;
    fx.update(dt);
    const st = stats();
    view.sync(S, now / 1000, dt, fx, S.reloading ? 1 - S.reloadT / st.reload : -1);
    if (S.state !== 'menu') ui.hud(S, st);
    view.render();

    // Calidad adaptable: si la media de FPS baja de 40 durante 2 s, bajar un nivel.
    acc += dt; frames++;
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
