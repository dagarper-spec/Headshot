// Punto de entrada: une lógica, vista, audio e interfaz. Bucle con Delta Time y calidad adaptable.
import { CFG, TIERS, LEVELS } from './config.js';
import * as core from './game-core.js';
import { updateDrones, spawnDrones } from './game-drone.js';
import { stats, reload, updateCombat, aimAssist, spread } from './game-combat.js';
import { loadModel, loadMixamo, loadProps } from './loader.js';
import { createView } from './view-scene.js';
import { loadFps } from './view-fps.js';
import { createFx } from './view-fx.js';
import { rayWorld, surface } from './game-geom.js';
import { input, initInput, poll, resetCrouch } from './input.js';
import { initAudio, sfx, music } from './audio.js';
import { loadSave, writeSave, freshSave } from './save.js';
import { ui } from './ui.js';
import { applyUpgrades, applyWeapon, loadout, renderShop } from './shop.js';
import { renderEquip } from './equip.js';
import { unlocked, evalStars, applyResult, renderLevels, levelLabel } from './progress.js';

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
  let wT = 0, slowT = 0, endTimer = 0, waveT = 0; // cámara lenta al terminar el nivel

  // ----- Eventos de la lógica -> efectos, sonido y UI -----
  const fq = { low: 0.5, medium: 0.75, high: 1 };
  const applyTier = () => { view.setQuality(tier); fx.setQuality(fq[tier] || 1); };
  applyTier(); fx.setBlood(data.blood);
  fx.onTink = (v) => sfx.tink(v);
  const imp = (pt, s) => { if (!s || s.kind === 'sky') return; fx.impact(pt, s.n, s.kind); sfx.imp(s.kind); };
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
    { const k = CFG.weapon.kind; k === 'rev' ? sfx.shotRev() : k === 'smg' ? sfx.shotSmg() : k === 'sniper' ? sfx.shotSniper() : sfx.shot(); } music.duck(); view.shot(); fx.shoot(d.end);
    if (!d.hit) setTimeout(() => imp(d.end, d.surf), 40);
  });
  on('enemyShot', (d) => {
    music.duck();
    const from = view.gunPos(d.e.id) || d.from; view.fire(d.e.id);
    sfx.eshot(); fx.shoot(d.end, from);
    if (!d.hit) imp(d.end, d.surf);
  });
  on('shield', () => { sfx.helmet(); });
  on('armor', (d) => { sfx.armor(); fx.impact(d.pt, [0, 1, 0], 'metal'); if (d.vest) ui.toast('¡Placa antibalas! Otro tiro al cuerpo'); if (d.seg) ui.toast('Invulnerable: ¡derriba sus drones!'); });
  on('reserve', () => { ui.toast('¡Francotirador en la azotea!'); sfx.warn(0.8); });
  on('vestHit', () => { sfx.armor(); ui.toast('El chaleco ha absorbido el impacto'); });
  on('throw', (d) => { sfx.pin(); ui.toast('¡Granada!'); [[0, 1], [0.22, 0.55], [0.38, 0.3]].forEach(([t, v]) => setTimeout(() => sfx.clunk(v), (d.T + t) * 1000)); });
  on('boom', (d) => { fx.boom(d.x, d.y, d.z); sfx.boom(); });
  on('mine', () => sfx.pin());
  on('phase', (d) => { sfx.phase(); ui.banner(d.ph === 2 ? 'FASE 2 · ESCUDO' : 'FASE 3 · SIN ARMADURA', 1600); });
  on('gold', () => { data.items.plano = 1; S.hasPlan = true; writeSave(data); sfx.chest(); sfx.phase(); ui.banner('¡PLANO CONSEGUIDO!', 2200); ui.toast('Plano del revólver: ya puedes comprarlo en la tienda'); });
  on('chest', (d) => {
    sfx.chest();
    ui.toast({ heal: 'Botiquín: +1 vida', vest: 'Chaleco: absorbe 1 tiro', mag: 'Cargador +2 balas', money: 'Dinero: +$' + d.amount, radar: 'Radar: enemigos marcados' }[d.kind]);
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
  on('kill', (d) => { // puntos flotantes, sonido de racha y cámara lenta con golpe de FOV en los headshots
    ui.pop('+' + d.gain + (d.head ? ' HEADSHOT' : ''), d.head); if (d.combo >= 2) sfx.combo(Math.min(d.combo, 6));
    if (d.head) { slowT = Math.max(slowT, 0.5); view.pk = 1; }
  });
  on('droneSpot', () => { ui.toast('¡El dron te ha localizado!'); sfx.warn(0.6); });
  on('droneDown', (d) => { sfx.kill(); sfx.hit(); ui.hitmarker(true, false); fx.impact(d.pt, [0, 1, 0], 'metal', 1.6, false); ui.toast('Dron derribado'); });
  on('droneCrash', (d) => { fx.impact([d.x, 0.1, d.z], [0, 1, 0], 'metal', 2.2, false); sfx.armor(); });
  on('hurt', (d) => { sfx.hurt(); ui.hurt(); fx.shake = d.head ? 1 : 0.6; if (!d.head) ui.toast('Herido: un tiro más y caes'); });
  on('reload', () => { const r = CFG.weapon.reload; sfx.magOut(r * 0.22); sfx.magIn(r * 0.62); sfx.slide(r * 0.86); });
  on('empty', () => sfx.empty());
  on('helmetSave', () => { sfx.helmet && sfx.helmet(); ui.toast('El casco te ha salvado'); });
  on('level', (i) => { const L = S.custom || LEVELS[i]; spawnDrones(S.droneList || []); view.setZone(L.zone || 0); fx.clear(); ui.banner(L.name.toUpperCase(), 1600); sfx.wave(); });
  const finish = () => { slowT = 1.1; endTimer = 1.3; setTimeout(() => music.mode('menu'), 1300); };
  // Modo infinito: al limpiar la oleada se prepara la siguiente en vez de mostrar resultados.
  on('win', () => { if (S.endless) { waveT = 2.2; ui.toast('Oleada superada'); } else finish(); });
  on('over', finish);

  // ----- Menús -----
  const sel = $('quality'); sel.value = data.quality;
  sel.onchange = () => {
    data.quality = sel.value; writeSave(data);
    tier = sel.value === 'auto' ? autoTier() : sel.value; applyTier();
  };
  const bl = $('blood'); bl.value = data.blood; bl.onchange = () => { data.blood = bl.value; writeSave(data); fx.setBlood(data.blood); };
  const vk = (v) => (v <= 50 ? v / 50 : 1 + (v - 50) / 25); // 50 = nivel por defecto, 100 = triple
  const mus = $('music'); mus.value = data.musicVol; music.setVol(vk(data.musicVol)); music.setOn(false); // empieza al pulsar Jugar (gesto del usuario)
  mus.oninput = () => { data.musicVol = +mus.value; data.music = data.musicVol > 0; music.setVol(vk(data.musicVol)); music.setOn(data.music); };
  mus.onchange = () => writeSave(data);
  // ----- Tienda -----
  // Carga bajo demanda el modelo del arma equipada (los GLB pesan ~1,3 MB cada uno).
  const ensureWeapon = async (k, show = true) => { if (k && k !== 'pistol' && !view.hasWeapon(k)) { const g = await loadFps(CFG.models.dir, k); if (g) view.addWeapon(k, g); } if (show) view.setWeapon(k || 'pistol'); };
  window.headshot.ensureWeapon = ensureWeapon;
  applyUpgrades(data); await ensureWeapon(CFG.weapon.kind);
  let shopFrom = 'menu';
  const openShop = (from) => { shopFrom = from; ui.hide(from); renderShop(data, () => writeSave(data)); ui.show('shop'); };
  $('shopBtn').onclick = () => openShop('over');
  $('menuShop').onclick = () => openShop('menu');
  $('shopBack').onclick = () => { ui.hide('shop'); ui.show(shopFrom); syncCont(S.state === 'pause'); };
  const note = () => levelLabel(data.level % LEVELS.length);
  // Dos armas: guarda la munición de la actual, equipa la otra y la muestra (con un breve tiempo de cambio).
  const swapWeapon = () => {
    const ls = loadout(data); if (!ls[1] || S.state !== 'play') return;
    S.ammo[CFG.weapon.kind] = S.mag; S.slot ^= 1; const k = ls[S.slot];
    applyWeapon(data, k); view.setWeapon(k); sfx.slide && sfx.slide(0.5);
    S.mag = S.ammo[k] ?? stats().mag; S.reloading = false; S.fireT = 0.45; input.zoom = false; $('bZoom').classList.remove('on');
    document.body.classList.toggle('sniper', k === 'sniper');
  };
  const launch = (lvl, ez) => { // empieza (o reanuda) la partida; ez: zona del modo infinito (si se indica)
    try { initAudio(); } catch { /* sin audio */ }
    S.hasPlan = !!data.items.plano; 
    music.setOn(data.music); music.mode('game');
    if (!input.touch) canvas.requestPointerLock();
    ui.hide('menu'); ui.hide('over'); ui.show('hud');
    if (input.touch) ui.show('touch');
    if (S.state === 'pause') S.state = 'play';
    else { // consumables comprados: se gastan al empezar el nivel
      data.cons = data.cons || {};
      data.use = data.use || {};
      if (data.cons.cMed > 0 && data.use.cMed !== false) { data.cons.cMed--; S.pre.med = true; }
      if (data.cons.cVest > 0 && data.use.cVest !== false) { data.cons.cVest--; S.pre.vest = true; }
      writeSave(data); resetCrouch(); waveT = 0; applyUpgrades(data); ez != null ? core.startEndless(ez) : core.startLevel(lvl);
      data.cons = data.cons || {}; S.explKind = data.expl && data.cons[data.expl] > 0 ? data.expl : ''; S.explN = S.explKind ? Math.min(data.cons[S.explKind], S.explKind === 'gren' ? 3 : 2) : 0;
      document.body.classList.toggle('sniper', CFG.weapon.kind === 'sniper');
    }
  };
  // Pantalla de equipamiento previa a la misión.
  let eqPlan = null;
  const begin = (lvl, ez) => {
    if (S.state === 'pause') return launch(lvl, ez);
    eqPlan = [lvl, ez]; ensureWeapon(CFG.weapon.kind); ui.hide('menu'); ui.hide('over'); ui.hide('levels'); ui.hide('endless');
    renderEquip.step = 0;
    renderEquip(data, async () => { writeSave(data); applyUpgrades(data); await ensureWeapon(CFG.weapon.kind); });
    ui.show('equip');
  };
  $('eqGo').onclick = async () => { ui.hide('equip'); applyUpgrades(data); const ls = loadout(data); await ensureWeapon(ls[0]); if (ls[1]) await ensureWeapon(ls[1], false); launch(...eqPlan); }; // el modelo del arma debe estar cargado
  $('eqBack').onclick = () => { ui.hide('equip'); ui.menu('HEADSHOT', 'Jugar', ''); S.state = 'menu'; syncCont(false); };
  $('start').onclick = () => begin(0); // Jugar: siempre desde el nivel 1 (o continúa si está en pausa)
  $('cont').onclick = () => { let i = Math.min(data.level, LEVELS.length - 1); while (i > 0 && !unlocked(data, i)) i--; begin(i); };
  // El botón "Continuar: nivel N" solo aparece si ya superaste algún nivel y no estás en pausa.
  const syncCont = (paused) => {
    const c = $('cont'); c.textContent = 'Continuar: ' + levelLabel(Math.min(data.level, LEVELS.length - 1));
    c.classList[!paused && data.level > 0 ? 'remove' : 'add']('hide');
    $('lvlBtn').classList[paused ? 'add' : 'remove']('hide');
    $('menuShop').classList[!paused && (data.level > 0 || data.coins > 0) ? 'remove' : 'add']('hide');
  };
  const openLevels = (from) => { lvFrom = from; ui.hide(from); renderLevels(data, (i) => { ui.hide('levels'); begin(i); }); ui.show('levels'); };
  let lvFrom = 'menu';
  $('cfgBtn').onclick = () => { ui.hide('menu'); ui.show('cfg'); }; $('cfgBack').onclick = () => { ui.hide('cfg'); ui.show('menu'); };
  $('lvlBtn').onclick = () => openLevels('menu'); $('lvlOver').onclick = () => openLevels('over');
  $('lvlBack').onclick = () => { ui.hide('levels'); ui.show(lvFrom); };
  $('again').onclick = () => S.endless ? begin(0, S.endless.zone) : begin(S.state === 'win' && unlocked(data, S.level + 1) && S.level + 1 < LEVELS.length ? S.level + 1 : S.level); // victoria -> siguiente; derrota -> reintentar
  addEventListener('keydown', (e) => { if (e.code === 'Enter' && !$('over').classList.contains('hide')) $('again').click(); });
  // ----- Modo infinito: selector de zona y récords -----
  const openEndless = () => {
    ui.hide('menu'); const el = $('endList'); el.innerHTML = '';
    ['Almacén', 'Azotea'].forEach((n, z) => {
      const ok = z === 0 || unlocked(data, 4), r = data.endless[z], b = document.createElement('button');
      b.className = 'big'; b.disabled = !ok; b.innerHTML = n + '<small>' + (ok ? (r ? 'Récord: oleada ' + r.wave + ' \u00b7 ' + r.pts + ' pts' : 'Sin récord todavía') : 'Desbloquéala en la campaña') + '</small>';
      b.onclick = () => { ui.hide('endless'); begin(0, z); }; el.appendChild(b);
    });
    ui.show('endless');
  };
  $('endBtn').onclick = openEndless; $('endBack').onclick = () => { ui.hide('endless'); ui.show('menu'); };
  $('pHome').onclick = () => $('homeBtn').click();
  $('pCfg').onclick = () => $('cfgBtn').click();
  const pause = () => {
    if (S.state !== 'play') return;
    S.state = 'pause'; input.fire = false; input.zoom = false;
    if (document.pointerLockElement) document.exitPointerLock();
    ui.menu('PAUSA', 'Continuar', note(), true); syncCont(true); music.mode('menu');
  };
  $('homeBtn').onclick = () => { // volver a la portada para elegir modo
    ui.hide('over'); ui.hide('hud'); ui.hide('touch'); S.state = 'menu'; S.endless = null; S.custom = null;
    ui.menu('HEADSHOT', 'Jugar', ''); syncCont(false); music.mode('menu');
  };
  $('bPause').onclick = pause;
  $('restart').onclick = () => { const ez = S.endless ? S.endless.zone : null; S.state = 'menu'; launch(S.level, ez); }; // reinicia el nivel actual
  addEventListener('keydown', (e) => { if (e.code === 'KeyP') pause(); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && !input.touch) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); music.pause(); } else music.setOn(data.music); });
  // Reiniciar todo: doble pulsación para confirmar (botón temporal de pruebas)
  let rsT = 0; const ra = $('resetAll');
  ra.onclick = () => {
    if (!rsT) { ra.textContent = '¿Seguro? Pulsa otra vez'; rsT = setTimeout(() => { rsT = 0; ra.textContent = 'Reiniciar todo el progreso'; }, 3500); return; }
    clearTimeout(rsT); rsT = 0; ra.textContent = 'Progreso borrado';
    for (const k of Object.keys(data)) delete data[k]; Object.assign(data, freshSave()); writeSave(data); applyUpgrades(data); syncCont(false);
    $('quality').value = data.quality; $('blood').value = data.blood; $('music').value = data.musicVol; music.setVol(vk(data.musicVol)); fx.setBlood(data.blood); music.setOn(true);
  };
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
    if (waveT > 0 && (waveT -= raw) <= 0 && S.endless && S.state === 'win') core.nextWave(); // siguiente oleada
    if (endTimer > 0 && (endTimer -= raw) <= 0) { // mostrar resultado tras la cámara lenta
      if (document.pointerLockElement) document.exitPointerLock();
      if (S.endless) { // fin del modo infinito: récord y monedas según los puntos
        const z = S.endless.zone, w = S.endless.wave, pts = S.points, coins = Math.floor(pts / 10), old = data.endless[z], rec = !old || pts > old.pts;
        if (rec) data.endless[z] = { wave: w, pts }; data.coins += coins; writeSave(data);
        ui.end(false, rec ? 'NUEVO RÉCORD' : 'HAS CAÍDO', 'Oleada <b>' + w + '</b> \u00b7 <b>' + pts + '</b> puntos<br>Bajas: <b>' + S.kills + '</b> \u00b7 Mejor racha: <b>x' + S.bestCombo + '</b><br>+<b>' + coins + '</b> monedas', 'Otra vez'); ui.hide('shopBtn'); ui.hide('lvlOver');
      } else if (S.state === 'win') {
        const got = evalStars(S), r = applyResult(data, S.level, got, S.t, S.chestCoins), cb = S.bestCombo >= 3 ? (S.bestCombo - 2) * 20 : 0; data.coins += cb; r.total += cb; // bonus por racha
        data.level = Math.max(data.level, Math.min(S.level + 1, LEVELS.length - 1)); writeSave(data);
        const L = LEVELS[S.level];
        const last = S.level + 1 >= LEVELS.length, nxt = !last && unlocked(data, S.level + 1);
        ui.result({ title: L.boss ? 'ZONA SUPERADA' : 'NIVEL SUPERADO', got, time: S.t, par: L.par, goal: L.goalText, total: r.total, bonus: r.bonus, chest: r.chest, first: r.first, coins: data.coins,
          note: (cb ? 'Racha máx. x' + S.bestCombo + ': +' + cb + ' monedas. ' : '') + (!last && !nxt ? 'Siguiente nivel bloqueado: ' + (LEVELS[S.level + 1].boss ? 'necesitas 5 \u2605 en los niveles de la zona' : 'supera este nivel') : '') }, nxt ? 'Siguiente nivel' : 'Repetir nivel');
        ui.show('shopBtn'); ui.show('lvlOver');
      } else { ui.end(false, 'HAS CAÍDO', 'Aguantaste <b>' + S.t.toFixed(1) + ' s</b>', 'Reintentar'); ui.hide('shopBtn'); ui.show('lvlOver'); }
    }
    { const l = S.explKind ? (S.explKind === 'gren' ? 'GRANADA' : 'MINA') + '<br>\u00d7' + S.explN : 'EXPLO-<br>SIVO', b = $('bGren'); if (b && b._l !== l) { b._l = l; b.innerHTML = l; b.classList.toggle('off', !S.explN); } }
    S.zoom = input.zoom && S.state === 'play'; document.body.classList.toggle('sniperzoom', S.zoom && CFG.weapon.kind === 'sniper');
    S.crouch = input.crouch && S.state === 'play';
    if (input.pulse > 0) input.pulse -= raw;
    if (S.state === 'play') {
      poll(dt);
      // ruletas/teclado -> velocidad angular con Delta Time; ayuda al apuntar y zoom reducen la sensibilidad
      const k = (dt / CFG.player.sens) * (S.zoom ? 0.5 * CFG.weapon.sens * (CFG.weapon.kind === 'sniper' && !input.zl ? 1.7 : 1) : 1) * (input.touch && aimAssist() ? 0.5 : 1);
      core.look(input.dx - input.turn * 2.4 * k + input.rx * 3.3 * k, input.dy + input.ry * 2.3 * k);
      updateDrones(dt); core.update(dt, input);
      if (input.reload) reload();
      if (input.swap) swapWeapon();
      if (input.gren && core.throwExplosive()) { const c = data.cons; c[S.explKind] = Math.max(0, (c[S.explKind] || 0) - 1); writeSave(data); sfx.pin(); }
      view.zl = input.zl;
      updateCombat(dt, input.fire || input.pulse > 0 || (CFG.weapon.auto && input.rHeld())); // pulse = toque en la ruleta derecha
    } else core.update(dt, input);
    input.dx = input.dy = 0; input.reload = false; input.swap = false; input.gren = false;
    sfx.droneHum(S.state === 'play' ? S.drones.reduce((v, d) => (d.on && d.alive ? Math.max(v, 1 - Math.hypot(d.x - S.player.x, d.z - S.player.z) / 22) : v), 0) : 0);
    fx.update(dt); music.update(raw);
    { const km = ui.warn(S.state === 'play' ? view.warn : []); // aviso de apuntado: pitido que se acelera al cargar el tiro
      if (km > 0) { wT -= raw; if (wT <= 0) { sfx.warn(km); wT = 0.5 - 0.38 * km; } } else wT = 0; }
    // retícula reactiva: se abre al moverte, al estar herido y con el retroceso; se cierra al agacharte; con zoom solo queda el punto
    gap += (5 + spread() * 650 + fx.kick * 8 - gap) * Math.min(1, raw * 14);
    xh.style.setProperty('--g', gap.toFixed(1) + 'px'); xh.classList.toggle('zoom', S.zoom);
    const st = stats();
    view.sync(S, now / 1000, dt, fx, S.reloading ? 1 - S.reloadT / st.reload : -1);
    if (S.state !== 'menu') ui.hud(S, st, S.endless ? 'INFINITO' : levelLabel(S.level));
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
