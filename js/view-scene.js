// Renderizado: escena, almacén, enemigos, arma y EffectComposer (Bloom + MSAA/FXAA + tone mapping ACES).
// Solo LEE el estado del juego; nunca lo modifica.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CFG, QUALITY } from './config.js';
import { createItems, buildShield } from './view-items.js';
import { makeMaterials, uvs } from './view-textures.js';
import { buildSoldier, buildViewPistol, poseSoldier } from './view-models.js';
import { createMixamoSoldier } from './view-mixamo.js';
import { createFps } from './view-fps.js';
import { buildShelf, buildBarrels, buildDecor } from './view-props.js';

const std = (color, rough, metal = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 0.5, ...extra });

export function createView(canvas, tier, model, fpsData, props) {
  let q = QUALITY[tier];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier === 'low', powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080a);
  scene.fog = new THREE.FogExp2(0x0b0d11, 0.03);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; // reflejos IBL sin descargar HDRI
  pm.dispose();
  scene.add(new THREE.HemisphereLight(0x8899aa, 0x1a1410, 0.5));

  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 80);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // ---------- Post-procesado ----------
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: q.msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.6, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const fxaa = new ShaderPass(FXAAShader);
  composer.addPass(fxaa);

  // ---------- Mundo ----------
  const M = makeMaterials(q.tex);
  const lamps = [], panels = [];
  const H = CFG.half, HT = CFG.height, W = H * 2;
  const add = (geo, mat, x, y, z, cast = true, recv = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; scene.add(m); return m;
  };
  const plane = (w, h, u, v) => uvs(new THREE.PlaneGeometry(w, h), u, v);

  add(plane(W, W, 7, 7), M.floor, 0, 0, 0, false).rotation.x = -Math.PI / 2;
  add(plane(W, W, 5, 5), M.ceil, 0, HT, 0, false).rotation.x = Math.PI / 2;
  [[0, -H, 0], [0, H, Math.PI], [-H, 0, Math.PI / 2], [H, 0, -Math.PI / 2]].forEach(([x, z, r]) => {
    add(plane(W, HT, 7, 2), M.wall, x, HT / 2, z, false).rotation.y = r;
  });
  const beam = new THREE.BoxGeometry(W, 0.4, 0.5);
  for (let z = -10; z <= 10; z += 5) add(beam, M.beam, 0, HT - 0.35, z);

  // Coloca un contenedor GLB ajustado a la caja de colisión [x,z,w,d,h] (eje largo del modelo = X; si la caja es más
  // fondo que ancho se gira 90°). Los de color liso (c2) se pintan con el tono indicado en b[6].
  const addContainer = (src, b) => {
    const box = new THREE.Box3().setFromObject(src), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const turn = b[3] > b[2], w = turn ? b[3] : b[2], d = turn ? b[2] : b[3];
    const o = src.clone(true), g = new THREE.Group();
    o.position.set(-c.x, -box.min.y, -c.z); g.add(o);
    g.scale.set(w / sz.x, b[4] / sz.y, d / sz.z);
    g.position.set(b[0], 0, b[1]); g.rotation.y = turn ? Math.PI / 2 : 0;
    o.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = m.receiveShadow = true;
      m.material = m.material.clone();
      if (b[6] !== undefined) { m.material.color.set(b[6]).multiplyScalar(0.85); m.material.metalness = 0.35; m.material.roughness = 0.65; }
      else { m.material.metalness = Math.min(m.material.metalness, 0.4); m.material.roughness = Math.max(0.55, m.material.roughness); }
    });
    scene.add(g);
  };

  for (const b of CFG.crates) { // contenedores y pilares (misma lista que la colisión)
    if (b[4] >= HT - 0.01) { add(new THREE.BoxGeometry(b[2], HT, b[3]), M.pillar, b[0], HT / 2, b[1]); continue; }
    if (b[5] === 'shelf') { scene.add(buildShelf(b)); continue; }
    if (b[5] === 'barrel') { scene.add(buildBarrels(b)); continue; }
    if (props && props[b[5]]) { addContainer(props[b[5]], b); continue; }   // contenedor externo
    const m = M.crate.clone(); m.color.setScalar(0.75 + Math.random() * 0.4);  // sin modelo: caja procedural
    add(new THREE.BoxGeometry(b[2], b[4], b[3]), m, b[0], b[4] / 2, b[1]);
  }

  buildDecor(scene, H, HT); // palés, tuberías, señales y marcas

  // Lámparas industriales: panel emisivo (HDR => bloom) + foco de luz
  [[-6, -6], [6, 6], [6, -6], [-6, 6]].forEach(([x, z]) => {
    const pm2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.6, 3) });
    add(new THREE.BoxGeometry(1.8, 0.12, 0.5), pm2, x, HT - 0.62, z, false, false);
    panels.push(pm2);
    const s = new THREE.SpotLight(0xffe2bd, 380, 0, Math.PI / 2.6, 0.7, 2);
    s.position.set(x, HT - 0.7, z); s.target.position.set(x, 0, z);
    s.shadow.bias = -0.0004; s.shadow.normalBias = 0.03;
    scene.add(s, s.target); lamps.push(s);
  });

  // ---------- Arma en primera persona ----------
  // Pistola externa animada (Desert Eagle + mano enguantada) o, si no hay modelo, la procedural.
  const fpsv = fpsData ? createFps(fpsData) : null;
  const gun = fpsv ? fpsv.root : buildViewPistol();
  const GB = fpsv ? [0.13, -0.2, -0.32] : [0.17, -0.17, -0.38], GZY = fpsv ? -0.1 : -0.12; // posición base y altura al apuntar
  gun.scale.setScalar(fpsv ? 0.0095 : 0.85);
  gun.position.set(...GB);
  camera.add(gun);

  // ---------- Enemigos (un slot visual por cada enemigo del pool) ----------
  const lg = new THREE.CylinderGeometry(0.005, 0.005, 1, 5).rotateX(Math.PI / 2);
  const slots = [], barG = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0);
  for (let i = 0; i < CFG.pool; i++) {
    const g = new THREE.Group(), s = { g, mixer: null, flash: [], cr: 1, aim: 0, mv: 0, ph: i * 2 };
    g.rotation.order = 'YXZ';
    if (model && model.mixamo) { s.mx = createMixamoSoldier(model); g.add(s.mx.root); s.flash = s.mx.flash; } // Y Bot + animaciones Mixamo
    else if (model) { // modelo .glb externo (sin pose procedural)
      const inner = SkeletonUtils.clone(model.scene);
      inner.scale.setScalar(model.scale); inner.position.y = model.offsetY;
      inner.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); s.flash.push(o.material); } });
      g.add(inner);
      if (model.clips.length) {
        s.mixer = new THREE.AnimationMixer(inner);
        const clip = model.clips.find((c) => /run|walk/i.test(c.name)) || model.clips[0];
        const a = s.mixer.clipAction(clip); a.play(); a.time = Math.random() * clip.duration;
      }
    } else { const h = buildSoldier(); g.add(h); s.h = h.userData; s.flash = h.userData.flash; }
    s.shield = buildShield(); s.shield.position.set(0.12, 1.0, 0.5); s.shield.visible = false; g.add(s.shield);
    s.laser = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.1), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    s.dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 0.4, 0.25) }));
    s.laser.visible = s.dot.visible = false; scene.add(s.laser, s.dot); // destello rojo en la boca del arma
    // barras de vida (rojo) y armadura (azul) sobre la cabeza: grupo que mira a la cámara, relleno anclado a la izquierda
    s.bars = new THREE.Group(); s.bars.visible = false; scene.add(s.bars);
    const bar = (col, y) => { const bg = new THREE.Mesh(barG, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false })),
      f = new THREE.Mesh(barG, new THREE.MeshBasicMaterial({ color: col, depthWrite: false }));
      bg.scale.set(0.58, 0.085, 1); f.scale.set(0.54, 0.05, 1); bg.position.set(-0.29, y, 0); f.position.set(-0.27, y, 0.001);
      bg.renderOrder = 998; f.renderOrder = 999; s.bars.add(bg, f); return { bg, f }; };
    s.bHp = bar(0xe8503a, 0); s.bAr = bar(0x5aa8ff, 0.1); s.tint = -1;
    g.visible = false; scene.add(g); slots.push(s);
  }

  const items = createItems(scene, 4, 6);

  // ---------- Calidad adaptable ----------
  let vh = innerHeight; // altura real de render en píxeles (la usan las partículas)
  function resize() {
    const w = innerWidth, h = innerHeight, pr = Math.min(devicePixelRatio || 1, q.maxDpr) * q.scale; vh = h * pr;
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    composer.setPixelRatio(pr); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
  }

  function setQuality(name) {
    q = QUALITY[name];
    renderer.shadowMap.enabled = q.shadow > 0;
    lamps.forEach((l, i) => {
      l.visible = i < q.lights;
      l.castShadow = q.shadow > 0 && i < q.spots;
      if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; }
      l.shadow.mapSize.set(q.shadow || 512, q.shadow || 512);
    });
    bloom.enabled = q.bloom; fxaa.enabled = q.fxaa;
    [composer.renderTarget1, composer.renderTarget2].forEach((t) => { t.samples = q.msaa; t.dispose(); });
    resize();
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  setQuality(tier);
  addEventListener('resize', resize);

  // ---------- Sincronización con el estado ----------
  const eu = new THREE.Euler();
  let zk = 0, wasRl = false; // zk: 0 = cadera, 1 = apuntando con zoom
  const view = {
    scene, camera,
    // rp: progreso de recarga 0..1 (o -1); fx aporta retroceso y temblor.
    sync(S, time, dt, fx, rp) {
      const p = S.player, bob = Math.sin(time * 9) * Math.min(p.speed / 5, 1);
      zk += ((S.zoom ? 1 : 0) - zk) * Math.min(1, dt * 12);
      const f = 75 - 33 * zk;
      if (Math.abs(camera.fov - f) > 0.05) { camera.fov = f; camera.updateProjectionMatrix(); }
      const hurt = S.hp < S.maxHp, sway = hurt ? 0.0035 : 0.0012; // herido = puntería temblorosa
      const dead = S.state === 'over' ? Math.min(S.deathT, 0.7) : 0;
      camera.position.set(p.x, S.eye + bob * 0.035 - dead * 1.4, p.z);
      eu.set(p.pitch + Math.sin(time * 1.7) * sway + (Math.random() - 0.5) * fx.shake * 0.03 + fx.kick * 0.02,
        p.yaw + Math.cos(time * 1.3) * sway + (Math.random() - 0.5) * fx.shake * 0.03, dead * 0.5, 'YXZ');
      camera.rotation.copy(eu);
      const rl = rp >= 0 ? Math.sin(rp * Math.PI) : 0;
      if (fpsv) {
        if (rp >= 0 && !wasRl) fpsv.reload(CFG.weapon.reload); wasRl = rp >= 0; fpsv.update(dt, rp);
        gun.position.set(GB[0] * (1 - zk) + bob * 0.003, GB[1] + (GZY - GB[1]) * zk + bob * 0.004 - rl * 0.02, GB[2] + fx.kick * 0.05 + 0.03 * zk);
        gun.rotation.set(fx.kick * 0.18, 0, 0);
      } else {
        gun.position.set(0.17 * (1 - zk) + bob * 0.003, -0.17 + 0.05 * zk + bob * 0.005 - rl * 0.14, -0.38 + fx.kick * 0.05 + 0.04 * zk);
        gun.rotation.set(fx.kick * 0.22 - rl * 0.8, 0, rl * 0.5);
      }
      items.sync(S, time);
      lamps[1].intensity = 380 * (Math.random() < 0.03 ? 0.3 : 1); // lámpara que parpadea
      panels[1].color.setScalar(lamps[1].intensity < 380 ? 0.8 : 4);
      const k = Math.min(1, dt * 9);
      slots.forEach((s, i) => {
        const e = S.enemies[i];
        s.g.visible = e.active;
        if (!e.active) { s.laser.visible = s.dot.visible = s.bars.visible = false; return; }
        if (s.mx && s.tint !== e.tint) { s.tint = e.tint; s.mx.fab.forEach((m) => m.color.setHex(e.tint || 0xc4c4b4)); }
        { const ar = (e.helmet ? 1 : 0) + (e.shield ? 1 : 0), arMax = e.boss || e.role === 'shield' || e.role === 'grenadier' || e.helmet || e.shield ? 1 : 0;
          s.bars.visible = e.alive; s.bars.position.set(e.x, 2.12 - 0.45 * s.cr, e.z); s.bars.quaternion.copy(camera.quaternion);
          s.bHp.f.scale.x = Math.max(0.001, 0.54 * Math.max(0, e.hp) / 2);
          s.bAr.bg.visible = s.bAr.f.visible = arMax > 0 || e.boss; s.bAr.f.scale.x = Math.max(0.001, 0.54 * ar / Math.max(1, arMax)); }
        s.g.position.set(e.x, 0, e.z); s.g.rotation.y = e.face;
        s.g.rotation.x = e.alive || s.mx ? 0 : -Math.min(1, e.deadT / 0.45) * 1.5; // cae hacia atrás al morir
        s.cr += ((e.crouch && e.alive ? 1 : 0) - s.cr) * k;
        s.aim += ((e.aiming && e.alive ? 1 : 0) - s.aim) * k;
        s.mv += ((e.moving && e.alive ? 1 : 0) - s.mv) * k;
        s.ph += dt * e.spd * 2.8 * s.mv;
        s.shield.visible = !!e.shield && e.alive; // escudo: arriba al avanzar, abajo al apuntar
        s.shield.position.y += ((e.shieldUp ? 1.0 : 0.55) - s.shield.position.y) * k; s.shield.rotation.x += ((e.shieldUp ? 0 : 0.7) - s.shield.rotation.x) * k;
        const fl = e.hitT > 0 && e.alive ? 0.5 : 0;
        s.flash.forEach((m) => m.emissive.setRGB(fl, fl * 0.8, fl * 0.7));
        if (s.mx) s.mx.update(e, dt);
        else if (s.h) {
          s.h.helmet.visible = e.helmet;
          poseSoldier(s.h, { ph: s.ph, crouch: s.cr, aim: s.aim, move: s.mv, flinch: e.hitT > 0 && e.alive ? 1 : 0 });
        } else if (s.mixer) s.mixer.update(dt * s.mv);
        // láser rojo: avisa de que te está apuntando (más intenso cuanto más cerca del disparo)
        const L = s.laser, show = e.alive && e.aiming && e.sees;
        L.visible = s.dot.visible = show;
        if (show) {
          const gp = view.gunPos(i) || [e.x + Math.sin(e.face) * 0.6, 1.5, e.z + Math.cos(e.face) * 0.6];
          const dx = p.x - gp[0], dy = S.eye - gp[1], dz = p.z - gp[2], d = Math.hypot(dx, dy, dz);
          L.position.set(gp[0] + dx / 2, gp[1] + dy / 2, gp[2] + dz / 2); L.scale.z = d; L.lookAt(p.x, S.eye, p.z);
          L.material.opacity = 0.25 + 0.75 * e.aimK;
          s.dot.position.set(gp[0], gp[1], gp[2]); s.dot.scale.setScalar(0.5 + 1.8 * e.aimK);
        }
      });
    },
    // Posición en el mundo de la boca del arma del enemigo i (solo con modelo Mixamo).
    gunPos(i) { const m = slots[i].mx; if (!m) return null; const v = m.muzzle.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z]; },
    fire(i) { if (slots[i].mx) slots[i].mx.fire(); },
    shot() { if (fpsv) fpsv.fire(); }, // retroceso de la corredera del jugador
    get viewH() { return vh; },
    // Boca del arma y ventana de expulsión del jugador en el mundo (para fogonazo y casquillos).
    muzzle(out) { if (fpsv) return fpsv.muzzle.getWorldPosition(out); return out.set(0.17, -0.12, -0.62).applyMatrix4(camera.matrixWorld); },
    ejector(out) { if (fpsv) return fpsv.ejector.getWorldPosition(out); return out.set(0.1, -0.1, -0.4).applyMatrix4(camera.matrixWorld); },
    render() { if (q.bloom || q.fxaa) composer.render(); else renderer.render(scene, camera); },
    setQuality, resize,
  };
  return view;
}
