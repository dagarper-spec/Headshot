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
import { CFG, QUALITY, ZONES } from './config.js';
import { buildRoof } from './view-roof.js';
import { createDrones } from './view-drone.js';
import { createItems, buildShield } from './view-items.js';
import { makeMaterials, uvs } from './view-textures.js';
import { buildSoldier, buildViewPistol, poseSoldier } from './view-models.js';
import { createMixamoSoldier } from './view-mixamo.js';
import { createFps, WDEF } from './view-fps.js';
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

  const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 130);
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

  const n0 = scene.children.length; // todo lo siguiente (hasta las lámparas) es la zona 1
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

  const z1 = new THREE.Group(); scene.children.slice(n0).forEach((c) => z1.add(c)); scene.add(z1);
  const roof = buildRoof(ZONES[1].crates, H), rlamps = roof.lamps; scene.add(roof.group);
  const hemi = scene.children.find((c) => c.isHemisphereLight), ENV = [
    { bg: 0x07080a, fog: [0x0b0d11, 0.03], hemi: 0.5, exp: 1.1 }, { bg: 0xb99c9c, fog: [0xb99c9c, 0.0105], hemi: 0.5, exp: 1.15 }];
  const drones = createDrones(scene, 2);
  // Reflejos de la azotea: entorno generado desde su propio cielo (charcos, metales)
  const ENV_ROOM = scene.environment, pm2 = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(); es.add(roof.envSky());
  const ENV_ROOF = pm2.fromScene(es, 0.02).texture; pm2.dispose();
  let zone = 0;
  // Cambia el escenario visible: almacén (zona 0) o azotea (zona 1).
  function setZone(z) {
    zone = z; z1.visible = z === 0; roof.group.visible = z === 1;
    const e = ENV[z]; scene.background.setHex(e.bg); scene.fog.color.setHex(e.fog[0]); scene.fog.density = e.fog[1]; hemi.intensity = e.hemi; renderer.toneMappingExposure = e.exp; scene.environment = z === 1 ? ENV_ROOF : ENV_ROOM;
  }

  // ---------- Arma en primera persona ----------
  // Armas cargadas: pistola animada (Desert Eagle + manos), revólver, subfusil y francotirador. Solo está visible la equipada.
  const WP = {}; let weapon = 'pistol';
  const addW = (kind, gltf) => {
    if (WP[kind]) return;
    const fpsv = gltf ? createFps(gltf, kind) : null, gun = fpsv ? fpsv.root : buildViewPistol(), d = WDEF[kind];
    gun.name = 'gun_' + kind; gun.scale.setScalar(fpsv ? 0.0095 : 0.85); gun.visible = kind === weapon; camera.add(gun);
    WP[kind] = { fpsv, gun, GB: fpsv ? d.base : [0.17, -0.17, -0.38], GZY: fpsv ? d.zy : -0.12, k: d.k || 1 };
  };
  addW('pistol', fpsData);

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

  const items = createItems(scene, 4, 6, camera);

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
    [...lamps, ...rlamps].forEach((l, i) => {
      const k = i % 4; // las 4 lámparas de cada zona se reparten por calidad
      l.visible = k < q.lights;
      l.castShadow = q.shadow > 0 && k < q.spots && i < lamps.length; // las farolas de la azotea no proyectan: lo hace el sol
      if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; }
      l.shadow.mapSize.set(q.shadow || 512, q.shadow || 512);
    });
    const sn = roof.sun; sn.castShadow = q.shadow > 0; if (sn.shadow.map) { sn.shadow.map.dispose(); sn.shadow.map = null; } sn.shadow.mapSize.set(Math.min(q.shadow || 1024, 2048), Math.min(q.shadow || 1024, 2048));
    bloom.enabled = q.bloom; fxaa.enabled = q.fxaa;
    [composer.renderTarget1, composer.renderTarget2].forEach((t) => { t.samples = q.msaa; t.dispose(); });
    resize();
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  setQuality(tier);
  addEventListener('resize', resize);

  // ---------- Sincronización con el estado ----------
  const eu = new THREE.Euler();
  let drawT = 0, zk = 0, wasRl = false; // zk: 0 = cadera, 1 = apuntando con zoom
  const view = {
    setZone,
    setWeapon(k) { weapon = WP[k] ? k : 'pistol'; wasRl = false; drawT = 1; for (const n in WP) WP[n].gun.visible = n === weapon; },
    addWeapon(kind, gltf) { addW(kind, gltf); },
    hasWeapon: (k) => !!WP[k],
    pk: 0, zl: 1, warn: [], // enemigos que te apuntan: {a: ángulo en pantalla, k: carga 0..1} (lo lee la interfaz)
    scene, camera,
    // rp: progreso de recarga 0..1 (o -1); fx aporta retroceso y temblor.
    sync(S, time, dt, fx, rp) {
      const p = S.player, bob = Math.sin(time * 9) * Math.min(p.speed / 5, 1);
      zk += ((S.zoom ? 1 : 0) - zk) * Math.min(1, dt * 12);
      view.pk = Math.max(0, view.pk - dt * 5); const asp = camera.aspect, base = asp > 1 ? Math.min(75, 2 * Math.atan(Math.tan(0.8727) / asp) * 57.296) : 75, rk = base / 75; // horizontal máx ~100° en apaisado: todo se ve más cerca
      const f = base - ((weapon === 'sniper' ? (view.zl ? 58 : 45) : 33) * zk + view.pk * 9) * rk; // pk: golpe de FOV al matar
      if (Math.abs(camera.fov - f) > 0.05) { camera.fov = f; camera.updateProjectionMatrix(); }
      const hurt = S.hp < S.maxHp, sway = hurt ? 0.0035 : 0.0012; // herido = puntería temblorosa
      const dead = S.state === 'over' ? Math.min(S.deathT, 0.7) : 0;
      camera.position.set(p.x, S.eye + bob * 0.035 - dead * 1.4, p.z);
      eu.set(p.pitch + Math.sin(time * 1.7) * sway + (Math.random() - 0.5) * fx.shake * 0.03 + fx.kick * 0.02,
        p.yaw + Math.cos(time * 1.3) * sway + (Math.random() - 0.5) * fx.shake * 0.03, dead * 0.5, 'YXZ');
      camera.rotation.copy(eu);
      const rl = rp >= 0 ? Math.sin(rp * Math.PI) : 0;
      const od = drawT; drawT = Math.max(0, drawT - dt / 0.5); const dw = od * od; // sacar arma: sube desde abajo girada y se asienta
      if (od > 0 && drawT <= 0 && WP[weapon].fpsv) WP[weapon].fpsv.fire(); // remate: la corredera/cerrojo se acomoda
      const w = WP[weapon], { fpsv, gun, GB, GZY } = w;
      if (fpsv) {
        if (rp >= 0 && !wasRl) fpsv.reload(CFG.weapon.reload); wasRl = rp >= 0; fpsv.update(dt, rp);
        const ax = Math.max(0.55, Math.min(1, camera.aspect / 1.5)); // en pantallas verticales el arma se acerca al centro
        gun.position.set(GB[0] * ax * (1 - zk) + bob * 0.003, GB[1] + (GZY - GB[1]) * zk + bob * 0.004 - rl * 0.03, GB[2] + fx.kick * 0.05 * w.k + 0.03 * zk + dw * 0.08);
        gun.position.y -= dw * 0.3;
        gun.rotation.set(fx.kick * 0.18 * w.k - rl * 0.25 - dw * 0.7, dw * 0.25, rl * 0.3 + dw * 0.35);
        if (weapon === 'sniper') gun.visible = zk < 0.55; // con el visor (zoom) se oculta el arma para ver a través de la mira
      } else {
        gun.position.set(0.17 * (1 - zk) + bob * 0.003, -0.17 + 0.05 * zk + bob * 0.005 - rl * 0.14, -0.38 + fx.kick * 0.05 + 0.04 * zk);
        gun.position.y -= dw * 0.3;
        gun.rotation.set(fx.kick * 0.22 - rl * 0.8 - dw * 0.7, dw * 0.25, rl * 0.5 + dw * 0.35);
      }
      if (zone === 1) { roof.sky.position.set(p.x, 0, p.z); roof.update(time); }
      drones.sync(S, time); items.sync(S, time);
      lamps[1].intensity = 380 * (Math.random() < 0.03 ? 0.3 : 1); // lámpara que parpadea
      panels[1].color.setScalar(lamps[1].intensity < 380 ? 0.8 : 4);
      const k = Math.min(1, dt * 9);
      view.warn.length = 0;
      slots.forEach((s, i) => {
        const e = S.enemies[i];
        s.g.visible = e.active;
        if (!e.active) { s.laser.visible = s.dot.visible = s.bars.visible = false; return; }
        if (s.mx && s.tint !== e.tint) { s.tint = e.tint; s.mx.fab.forEach((m) => m.color.setHex(e.tint || 0xc4c4b4)); }
        { const ar = (e.helmet ? 1 : 0) + (e.shield ? 1 : 0) + (e.vest ? 1 : 0), arMax = Math.max(e.arMax || 0, ar);
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
        L.visible = false; s.dot.visible = show;
        if (show) {
          const gp = view.gunPos(i) || [e.x + Math.sin(e.face) * 0.6, 1.5, e.z + Math.cos(e.face) * 0.6];
          const dx = p.x - gp[0], dy = S.eye - gp[1], dz = p.z - gp[2], d = Math.hypot(dx, dy, dz);
          s.dot.position.set(gp[0], gp[1], gp[2]); s.dot.scale.setScalar((0.4 + 1.6 * e.aimK) * (e.role === 'sniper' ? 2.4 : 1)); // brillo que crece en la boca del arma
          const v = new THREE.Vector3(e.x, 1.4, e.z).applyMatrix4(camera.matrixWorldInverse); // ángulo respecto a donde miras (0 = delante)
          view.warn.push({ a: Math.atan2(v.x, -v.z), k: e.aimK });
        }
      });
    },
    // Posición en el mundo de la boca del arma del enemigo i (solo con modelo Mixamo).
    gunPos(i) { const m = slots[i].mx; if (!m) return null; const v = m.muzzle.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z]; },
    fire(i) { if (slots[i].mx) slots[i].mx.fire(); },
    shot() { const f = WP[weapon].fpsv; if (f) f.fire(); }, // retroceso de la corredera del jugador
    get viewH() { return vh; },
    // Boca del arma y ventana de expulsión del jugador en el mundo (para fogonazo y casquillos).
    muzzle(out) { const fpsv = WP[weapon].fpsv; if (fpsv) return fpsv.muzzle.getWorldPosition(out); return out.set(0.17, -0.12, -0.62).applyMatrix4(camera.matrixWorld); },
    ejector(out) { const fpsv = WP[weapon].fpsv; if (fpsv) return fpsv.ejector.getWorldPosition(out); return out.set(0.1, -0.1, -0.4).applyMatrix4(camera.matrixWorld); },
    render() { if (q.bloom || q.fxaa) composer.render(); else renderer.render(scene, camera); },
    setQuality, resize,
  };
  return view;
}
