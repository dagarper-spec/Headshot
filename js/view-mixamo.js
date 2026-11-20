// Soldado animado: personaje Mixamo (Y Bot) + AnimationMixer con transiciones suaves.
// El equipo (casco, chaleco, cinturón, pistola) se fija a los huesos del esqueleto.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { camoTexture, webbingTexture } from './view-textures.js';
import { rb, mat, buildPistol } from './view-models.js';

const ROLE_TINT = { flank: 0x2f66c0, grenadier: 0xd9741f, shield: 0x4a4f57, sniper: 0x3f8a3a }; // color por rol cuando el nivel no fija uno
const FADE = 0.2;       // segundos de mezcla entre animaciones
const WALK_V = 1.78, RUN_V = 4.8; // m/s que "recorren" las animaciones originales (para no patinar)
let TX;

// Fija obj a un hueso conservando la posición/orientación que tiene en el mundo en la pose de referencia.
function mount(bone, obj, pos, basis) {
  const m = new THREE.Matrix4();
  if (basis) m.makeBasis(...basis);
  m.setPosition(pos);
  m.premultiply(new THREE.Matrix4().copy(bone.matrixWorld).invert());
  m.decompose(obj.position, obj.quaternion, obj.scale);
  bone.add(obj);
}

export function createMixamoSoldier(model) {
  TX = TX || { camo: camoTexture(), web: webbingTexture() };
  const body = SkeletonUtils.clone(model.scene);
  body.scale.setScalar(0.01); // el FBX viene en centímetros
  const root = new THREE.Group(); root.add(body);

  // Materiales propios (uno por soldado, para poder iluminar el impacto)
  const flash = [], fab = [];
  const fabric = () => new THREE.MeshStandardMaterial({ map: TX.camo, bumpMap: TX.camo, bumpScale: 0.8, color: 0xc4c4b4, roughness: 0.92, envMapIntensity: 0.25 });
  // Detalle por zona (coordenadas de la pose de referencia, en cm): botas, guantes, pasamontañas oscuro y rodilleras; tinte fuerte con el dibujo del camuflaje.
  const suit = (m) => {
    const ut = { value: new THREE.Color(1, 1, 1) }, uu = { value: 0 }; m.userData.ut = ut; m.userData.uu = uu;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTint = ut; sh.uniforms.uUse = uu;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBP; uniform vec3 uTint; uniform float uUse;')
        .replace('#include <map_fragment>', `#include <map_fragment>
        { float l = dot(sampledDiffuseColor.rgb, vec3(0.333)); vec3 t = uTint; float g = dot(t, vec3(0.333)); t = clamp(mix(vec3(g), t, 1.5), 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, t * (0.38 + 1.15 * l), uUse);
          float boot = 1.0 - smoothstep(18.0, 22.0, vBP.y), glove = smoothstep(70.0, 74.0, abs(vBP.x)), head = smoothstep(150.0, 153.0, vBP.y) * (1.0 - glove);
          float knee = (smoothstep(42.0, 44.0, vBP.y) - smoothstep(58.0, 60.0, vBP.y)) * (1.0 - smoothstep(30.0, 36.0, abs(vBP.x)));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.17, 0.15), knee * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.065, 0.07), max(max(boot, glove), head * 0.95)); }`);
    };
    return m;
  };
  const joint = () => new THREE.MeshStandardMaterial({ color: 0x202326, roughness: 0.55, metalness: 0.3 });
  body.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.name.includes('Joints') ? joint() : suit(fabric());
    o.castShadow = true; o.frustumCulled = false; flash.push(o.material); if (!o.name.includes('Joints')) fab.push(o.material);
  });
  root.updateMatrixWorld(true);

  const bone = (n) => body.getObjectByName('mixamorig' + n);
  const at = (n) => bone(n).getWorldPosition(new THREE.Vector3());

  // ---- Casco con gafas ----
  const helmet = new THREE.Group();
  const hm = new THREE.MeshStandardMaterial({ map: TX.camo, color: 0xb0b0a0, roughness: 0.55, metalness: 0.2, envMapIntensity: 0.5 });
  const dark = mat(0x070b0e, 0.1, 0.8, 1), strap = mat(0x15171a, 0.8);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.56), hm);
  dome.scale.set(1, 0.95, 1.12); dome.position.y = 0.02;
  const brim = new THREE.Mesh(rb(0.2, 0.02, 0.07, 0.008), hm); brim.position.set(0, 0.07, 0.12);
  const gog = new THREE.Mesh(rb(0.17, 0.055, 0.05, 0.02), dark); gog.position.set(0, -0.03, 0.105);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.006, 6, 28).rotateX(Math.PI / 2), strap); band.position.y = 0.045;
  helmet.add(dome, brim, gog, band);
  helmet.traverse((o) => { o.castShadow = true; });
  mount(bone('Head'), helmet, at('Head').add(new THREE.Vector3(0, 0.09, 0.0)));

  // ---- Chaleco con cargadores y cinturón ----
  const vest = new THREE.Group(), vm = new THREE.MeshStandardMaterial({ map: TX.web, bumpMap: TX.web, bumpScale: 1.5, roughness: 0.85 });
  const pouch = mat(0x1d2023, 0.7);
  const add = (g, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(vest, rb(0.37, 0.34, 0.25, 0.06), vm, 0, 0, 0);
  for (const x of [-0.1, 0, 0.1]) add(vest, rb(0.08, 0.1, 0.05, 0.02), pouch, x, -0.04, 0.145);
  add(vest, rb(0.14, 0.17, 0.05, 0.02), pouch, 0, 0.06, -0.14);
  mount(bone('Spine2'), vest, at('Spine2').add(new THREE.Vector3(0, 0.0, 0.01)));
  const plate = new THREE.Group(); add(plate, rb(0.3, 0.28, 0.035, 0.015), mat(0x3a4048, 0.45, 0.8), 0, 0.02, 0.165); add(plate, rb(0.22, 0.04, 0.04, 0.01), mat(0x8a8f94, 0.5, 0.7), 0, 0.12, 0.17);
  mount(bone('Spine2'), plate, at('Spine2').add(new THREE.Vector3(0, 0.0, 0.01)));
  const belt = new THREE.Group();
  add(belt, rb(0.35, 0.05, 0.24, 0.015), strap, 0, 0, 0);
  add(belt, rb(0.06, 0.14, 0.055, 0.015), pouch, 0.2, -0.08, 0.02);
  mount(bone('Hips'), belt, at('Hips').add(new THREE.Vector3(0, 0.07, 0)));

  // ---- Pistola en la mano derecha (en T-pose: dedos hacia -X, pulgar hacia +Z) ----
  const gun = buildPistol(), muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, -0.17); gun.add(muzzle);
  const bx = new THREE.Vector3(0, 1, 0), by = new THREE.Vector3(0, 0, 1), bz = new THREE.Vector3(1, 0, 0);
  const grip = new THREE.Vector3(0, -0.06, 0.07).applyMatrix4(new THREE.Matrix4().makeBasis(bx, by, bz));
  const palm = at('RightHand').add(new THREE.Vector3(-0.045, 0, 0));
  mount(bone('RightHand'), gun, palm.sub(grip), [bx, by, bz]);

  // ---- AnimationMixer: un clip por estado ----
  const mixer = new THREE.AnimationMixer(body), act = {};
  const ONCE = { death: 1, rise: 1, reload: 1, throw: 1 }, FALL = { strafe: 'aim', rise: 'idle', reload: 'hide', throw: 'hide' };
  const A = (k) => { // acción perezosa: los clips extra llegan después de abrir el juego
    if (!act[k] && model.clips[k]) { const a = mixer.clipAction(model.clips[k]); if (ONCE[k]) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } act[k] = a; }
    return act[k] || null;
  };
  let cur = '', curName = '', curTint = -1;

  return {
    root, helmet, flash, fab, gun, muzzle,
    // Elige la animación según el estado del enemigo y mezcla con la anterior.
    update(e, dt) {
      let want = !e.alive ? 'death' : e.thrA > 0 ? 'throw' : e.aiming ? (e.strafe ? (e.strafe > 0 ? 'strafeL' : 'strafeR') : 'aim')
        : e.moving ? (e.next === 'aim' ? 'walk' : 'run') : e.riseT > 0 ? 'rise' : e.rlT > 0 && e.crouch ? 'reload' : e.crouch ? 'hide' : 'idle';
      let name = want.startsWith('strafe') ? 'strafe' : want;
      if (!A(name)) { name = FALL[name] || 'idle'; want = name; }
      if (want !== cur) {
        const a = A(name), dur = a.getClip().duration;
        a.reset().setEffectiveWeight(1).fadeIn(name === 'death' ? 0.08 : FADE);
        if (name === 'throw') a.timeScale = 3;                       // 8 s -> ~2,7 s; la granada sale a 1,25 s
        else if (name === 'reload') a.timeScale = dur / 2.2;
        else if (name === 'rise') a.timeScale = dur / 0.5;
        else if (name === 'strafe') { a.timeScale = want === 'strafeL' ? -0.7 : 0.7; if (want === 'strafeL') a.time = dur - 0.01; } // el clip va hacia la derecha; a la izquierda se reproduce al revés
        a.play();
        if (act[curName] && act[curName] !== a) act[curName].fadeOut(name === 'death' ? 0.08 : FADE);
        cur = want; curName = name;
      }
      A('walk').timeScale = (e.sp || WALK_V) / WALK_V;   // los pies siguen la velocidad real
      A('run').timeScale = (e.sp || RUN_V) / RUN_V;
      const tt = e.tint || ROLE_TINT[e.role] || 0;
      if (tt !== curTint) { curTint = tt; for (const m of fab) { m.userData.uu.value = tt ? 1 : 0; if (tt) m.userData.ut.value.setHex(tt); } }
      helmet.visible = e.helmet; plate.visible = !!e.vest;
      mixer.update(dt);
      root.updateMatrixWorld(true);
    },
    // Reinicia el ciclo de disparo para que el retroceso coincida con el tiro.
    fire() { const a = A('aim'); if (a) a.time = 0; },
  };
}
