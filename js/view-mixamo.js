// Soldado animado: personaje Mixamo (Y Bot) + AnimationMixer con transiciones suaves.
// El equipo (casco, chaleco, cinturón, pistola) se fija a los huesos del esqueleto.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { camoTexture, webbingTexture } from './view-textures.js';
import { rb, mat, buildPistol } from './view-models.js';

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
  const flash = [];
  const fabric = () => new THREE.MeshStandardMaterial({ map: TX.camo, bumpMap: TX.camo, bumpScale: 0.8, color: 0xc4c4b4, roughness: 0.92, envMapIntensity: 0.25 });
  const joint = () => new THREE.MeshStandardMaterial({ color: 0x202326, roughness: 0.55, metalness: 0.3 });
  body.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.name.includes('Joints') ? joint() : fabric();
    o.castShadow = true; o.frustumCulled = false; flash.push(o.material);
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
  for (const k in model.clips) act[k] = mixer.clipAction(model.clips[k]);
  act.death.setLoop(THREE.LoopOnce, 1); act.death.clampWhenFinished = true;
  let cur = '';

  return {
    root, helmet, flash, gun, muzzle,
    // Elige la animación según el estado del enemigo y mezcla con la anterior.
    update(e, dt) {
      const want = !e.alive ? 'death' : e.aiming ? 'aim' : e.moving ? (e.next === 'aim' ? 'walk' : 'run') : e.crouch ? 'hide' : 'idle';
      if (want !== cur) {
        const a = act[want];
        a.reset().setEffectiveWeight(1).fadeIn(want === 'death' ? 0.08 : FADE).play();
        if (act[cur]) act[cur].fadeOut(want === 'death' ? 0.08 : FADE);
        cur = want;
      }
      act.walk.timeScale = (e.sp || WALK_V) / WALK_V;   // los pies siguen la velocidad real
      act.run.timeScale = (e.sp || RUN_V) / RUN_V;
      helmet.visible = e.helmet;
      mixer.update(dt);
      root.updateMatrixWorld(true);
    },
    // Reinicia el ciclo de disparo para que el retroceso coincida con el tiro.
    fire() { if (act.aim) act.aim.time = 0; },
  };
}
