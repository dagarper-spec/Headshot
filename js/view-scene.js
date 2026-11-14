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
import { makeMaterials, uvs } from './view-textures.js';

const std = (color, rough, metal = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 0.5, ...extra });

export function createView(canvas, tier, model) {
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

  for (const b of CFG.crates) { // cajas y pilares (misma lista que la colisión)
    if (b[4] >= HT - 0.01) { add(new THREE.BoxGeometry(b[2], HT, b[3]), M.pillar, b[0], HT / 2, b[1]); continue; }
    const m = M.crate.clone(); m.color.setScalar(0.75 + Math.random() * 0.4);
    add(new THREE.BoxGeometry(b[2], b[4], b[3]), m, b[0], b[4] / 2, b[1]).rotation.y = 0;
  }

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
  const gun = new THREE.Group();
  const metal = std(0x1a1c20, 0.35, 0.9), poly = std(0x2b2e34, 0.6, 0.1);
  const part = (geo, mat, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; gun.add(m); return m;
  };
  part(new THREE.BoxGeometry(0.06, 0.09, 0.42), metal, 0, 0, 0);
  part(new THREE.BoxGeometry(0.05, 0.06, 0.3), poly, 0, 0.005, -0.34);
  part(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 10), metal, 0, 0.015, -0.62, Math.PI / 2);
  part(new THREE.BoxGeometry(0.045, 0.14, 0.06), poly, 0, -0.11, 0.1, 0.25);
  part(new THREE.BoxGeometry(0.04, 0.16, 0.07), poly, 0, -0.12, -0.1, -0.1);
  part(new THREE.BoxGeometry(0.05, 0.08, 0.22), poly, 0, -0.01, 0.3);
  part(new THREE.BoxGeometry(0.012, 0.02, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.1) }), 0, 0.058, -0.2);
  gun.position.set(0.2, -0.2, -0.45);
  camera.add(gun);

  // ---------- Enemigos (un slot visual por cada enemigo del pool) ----------
  function humanoid() {
    const g = new THREE.Group();
    const skin = std(0xc49a7a, 0.7, 0, { envMapIntensity: 0.2 }), cloth = std(0x556b3a, 0.9, 0, { envMapIntensity: 0.2 });
    const pants = std(0x2b2f3a, 0.9), eye = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff2200, emissiveIntensity: 4 });
    const mesh = (geo, mat, x, y, z, parent = g) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
    };
    mesh(new THREE.CapsuleGeometry(0.22, 0.5, 6, 14), cloth, 0, 1.15, 0).scale.z = 0.7;
    mesh(new THREE.SphereGeometry(0.16, 18, 14), skin, 0, 1.62, 0);
    mesh(new THREE.SphereGeometry(0.025, 8, 6), eye, -0.06, 1.64, 0.14);
    mesh(new THREE.SphereGeometry(0.025, 8, 6), eye, 0.06, 1.64, 0.14);
    const limb = (mat, r, len, x, y, rot) => { // pivote en el hombro/cadera
      const p = new THREE.Group(); p.position.set(x, y, 0); p.rotation.x = rot; g.add(p);
      mesh(new THREE.CapsuleGeometry(r, len, 5, 10), mat, 0, -len / 2 - r, 0, p); return p;
    };
    g.userData = { armL: limb(cloth, 0.07, 0.5, -0.3, 1.42, -1.35), armR: limb(cloth, 0.07, 0.5, 0.3, 1.42, -1.35),
      legL: limb(pants, 0.1, 0.55, -0.12, 0.86, 0), legR: limb(pants, 0.1, 0.55, 0.12, 0.86, 0), cloth, skin };
    return g;
  }

  const slots = [];
  for (let i = 0; i < CFG.pool; i++) {
    const g = new THREE.Group(), s = { g, type: '', mixer: null, flash: [] };
    if (model) { // modelo .glb externo
      const inner = SkeletonUtils.clone(model.scene);
      inner.scale.setScalar(model.scale); inner.position.y = model.offsetY;
      inner.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); s.flash.push(o.material); } });
      g.add(inner);
      if (model.clips.length) {
        s.mixer = new THREE.AnimationMixer(inner);
        const clip = model.clips.find((c) => /run|walk/i.test(c.name)) || model.clips[0];
        const a = s.mixer.clipAction(clip); a.play(); a.time = Math.random() * clip.duration;
      }
    } else {
      const h = humanoid(); g.add(h); s.h = h.userData; s.flash.push(h.userData.cloth, h.userData.skin);
    }
    g.visible = false; scene.add(g); slots.push(s);
  }

  // ---------- Calidad adaptable ----------
  function resize() {
    const w = innerWidth, h = innerHeight, pr = Math.min(devicePixelRatio || 1, q.maxDpr) * q.scale;
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
  const view = {
    scene, camera,
    // rp: progreso de recarga 0..1 (o -1); fx aporta retroceso y temblor.
    sync(S, time, dt, fx, rp) {
      const p = S.player, bob = Math.sin(time * 9) * Math.min(p.speed / 6, 1);
      const sh = fx.shake;
      camera.position.set(p.x, CFG.eye + bob * 0.04, p.z);
      eu.set(p.pitch + (Math.random() - 0.5) * sh * 0.03 + fx.kick * 0.012, p.yaw + (Math.random() - 0.5) * sh * 0.03, 0, 'YXZ');
      camera.rotation.copy(eu);
      const rl = rp >= 0 ? Math.sin(rp * Math.PI) : 0;
      gun.position.set(0.2 + bob * 0.004, -0.2 + bob * 0.006 - rl * 0.12, -0.45 + fx.kick * 0.07);
      gun.rotation.set(fx.kick * 0.1 - rl * 0.7, 0, rl * 0.4);
      lamps[1].intensity = 380 * (Math.random() < 0.03 ? 0.3 : 1); // lámpara que parpadea
      panels[1].color.setScalar(lamps[1].intensity < 380 ? 0.8 : 4);
      slots.forEach((s, i) => {
        const e = S.enemies[i];
        s.g.visible = e.active;
        if (!e.active) return;
        if (s.type !== e.type) { // nuevo tipo: escala y color
          s.type = e.type;
          const T = CFG.types[e.type], sy = T.h / 1.8;
          s.g.scale.set(sy * T.sw, sy, sy * T.sw);
          if (s.h) s.h.cloth.color.setHex(T.tint);
        }
        s.g.position.set(e.x, 0, e.z); s.g.rotation.y = e.face;
        const f = e.hitT > 0 ? 0.7 : 0;
        s.flash.forEach((m) => m.emissive.setRGB(f, f * 0.85, f * 0.7));
        if (s.mixer) s.mixer.update(dt * (e.spd / 2.4));
        else {
          const ph = time * e.spd * 2.6 + i, u = s.h;
          u.legL.rotation.x = Math.sin(ph) * 0.7; u.legR.rotation.x = -Math.sin(ph) * 0.7;
          u.armL.rotation.x = -1.35 + Math.sin(ph + 1) * 0.18; u.armR.rotation.x = -1.35 - Math.sin(ph + 1) * 0.18;
          s.g.position.y = Math.abs(Math.sin(ph)) * 0.05;
        }
      });
    },
    render() { if (q.bloom || q.fxaa) composer.render(); else renderer.render(scene, camera); },
    setQuality, resize,
  };
  return view;
}
