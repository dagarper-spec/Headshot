// Arma en primera persona: pistola animada (disparo/recarga, modelo externo) + manos enguantadas procedurales.
// La mano derecha agarra la empuñadura; la izquierda aparece al recargar para sacar y meter el cargador.
// El modelo está en cm con +Z hacia delante; el grupo `vm` lo escala y gira para colgarlo de la cámara (-Z).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rb, put } from './view-models.js';

// Definición de cada arma (cm, +Z hacia delante): boca, expulsión, posición de la mano derecha (r),
// mano izquierda fija en el guardamanos (hold) y colocación en cámara (base, zy = altura al apuntar).
export const WDEF = {
  pistol: { file: 'pistol.glb', muzzle: [0, 6.0, 26.5], ejector: [-2.4, 8.4, 3.0], r: [0, 0, 0], base: [0.13, -0.2, -0.32], zy: -0.1 },
  rev:    { file: 'revolver.glb', muzzle: [0, 6.5, 33], ejector: [0, 4, 6], r: [1.5, 0.6, 3.6], base: [0.13, -0.2, -0.3], zy: -0.1 },
  smg:    { file: 'smg.glb', muzzle: [0, 5.2, 38.6], ejector: [-1.6, 9, 14], r: [1.5, 0.2, 4.5], hold: [0, -3, 27], base: [0.13, -0.21, -0.3], zy: -0.11 },
  sniper: { file: 'sniper.glb', muzzle: [0, 7.6, 107.7], ejector: [-2.5, 8, 12], r: [1.5, 0.4, 2.5], hold: [0, -9.5, 40], base: [0.13, -0.19, -0.2], zy: -0.115 },
};
export async function loadFps(dir, kind = 'pistol') {
  try { return await new GLTFLoader().loadAsync(dir + WDEF[kind].file); } // null => el juego usa la pistola procedural
  catch (e) { console.info('[fps] sin modelo ' + kind + ': ' + (e.message || e)); return null; }
}

// Animaciones propias de las armas nuevas (el modelo solo trae las piezas): corredera/cerrojo al disparar y cargador al recargar.
function makeClips(root, kind) {
  const T = (n, key, t, v) => { const o = root.getObjectByName(n); return o ? new THREE.VectorKeyframeTrack(n + '.position', t, v.flatMap((d) => [o.position.x, o.position.y + (key === 'y' ? d : 0), o.position.z + (key === 'z' ? d : 0)])) : null; };
  const fire = [], reload = [];
  if (kind === 'smg') { fire.push(T('bolt', 'z', [0, 0.03, 0.09], [0, -4.5, 0])); reload.push(T('clip', 'y', [0, 0.3, 0.45, 0.62, 1], [0, -22, -22, -2, 0]), T('bolt', 'z', [0, 0.7, 0.82, 1], [0, 0, -4.5, 0])); }
  if (kind === 'sniper') { reload.push(T('clip', 'y', [0, 0.25, 0.45, 0.6, 0.7], [0, -9, -9, -1, 0]), T('bolt', 'z', [0, 0.72, 0.84, 1], [0, 0, -7, 0]), T('boltrear', 'z', [0, 0.72, 0.84, 1], [0, 0, -7, 0])); fire.push(T('bolt', 'z', [0, 0.35, 0.5, 0.65], [0, 0, -7, 0]), T('boltrear', 'z', [0, 0.35, 0.5, 0.65], [0, 0, -7, 0])); }
  if (kind === 'rev') { // el tambor se abre hacia la izquierda, las balas salen y se cargan una a una, y se cierra
    const c = root.getObjectByName('clip');
    if (c) {
      const q0 = c.quaternion.clone(), q1 = q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.5));
      reload.push(new THREE.VectorKeyframeTrack('clip.position', [0, 0.16, 0.84, 1], [c.position.x, c.position.y, c.position.z, c.position.x + 4.5, c.position.y - 1.6, c.position.z, c.position.x + 4.5, c.position.y - 1.6, c.position.z, c.position.x, c.position.y, c.position.z]));
      reload.push(new THREE.QuaternionKeyframeTrack('clip.quaternion', [0, 0.16, 0.84, 1], [...q0.toArray(), ...q1.toArray(), ...q1.toArray(), ...q0.toArray()]));
      for (let i = 1; i <= 6; i++) { const b = root.getObjectByName('bullet' + i); if (!b) continue; const k = b.scale; reload.push(new THREE.VectorKeyframeTrack(b.name + '.scale', [0, 0.2, 0.22, 0.32 + i * 0.07, 0.38 + i * 0.07, 1], [k.x, k.y, k.z, k.x, k.y, k.z, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001, k.x, k.y, k.z, k.x, k.y, k.z])); }
    }
  }
  const mk = (n, d, tr) => { tr = tr.filter(Boolean); return tr.length ? new THREE.AnimationClip(n, d, tr) : null; };
  return [mk('fire', kind === 'sniper' ? 0.65 : 0.09, fire), mk('reload', 1, reload)].filter(Boolean);
}

// Relieve de tela/cuero generado en un canvas (para que el guante no se vea liso).
function weaveTex(rep) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) { const v = 90 + Math.random() * 90; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 1 + Math.random() * 2); }
  x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; for (let i = 0; i < 128; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}
const fabric = (color, rough, rep) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05, bumpMap: weaveTex(rep), bumpScale: 0.6 });

// Antebrazo cónico entre dos puntos (cm).
function limb(g, A, B, r1, r2, m) {
  const a = new THREE.Vector3(...A), b = new THREE.Vector3(...B), d = b.clone().sub(a);
  const o = put(g, new THREE.CylinderGeometry(r2, r1, d.length(), 20), m, 0, 0, 0);
  o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
}

const M = { glove: null, pad: null, strap: null, skin: null, sleeve: null, cuff: null };
function mats() {
  if (M.glove) return M;
  M.glove = fabric(0x1b1c1f, 0.62, 3); M.pad = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.45, metalness: 0.3 });
  M.strap = fabric(0x3a3d40, 0.8, 2); M.skin = new THREE.MeshStandardMaterial({ color: 0xc99a7c, roughness: 0.6 });
  M.sleeve = fabric(0x4b5340, 0.95, 4); M.cuff = fabric(0x111214, 0.7, 3);
  return M;
}
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 12);
const ball = (r) => new THREE.SphereGeometry(r, 12, 9);

// Mano derecha agarrando la empuñadura (cm, espacio de la pistola).
function buildRightHand() {
  const g = new THREE.Group(), m = mats();
  put(g, rb(2.0, 7.4, 8.0, 0.95), m.glove, -3.5, -3.4, -3.3);                    // dorso de la mano
  put(g, rb(0.7, 5.6, 5.6, 0.45), m.pad, -4.75, -3.2, -3.3);                     // protector de los nudillos
  put(g, rb(2.3, 7.2, 2.8, 0.9), m.glove, -3.3, -3.4, -7.7);                     // talón de la mano
  [-2.7, -4.6, -6.4].forEach((y, i) => {                                         // 3 dedos que rodean el frente de la empuñadura
    const r = 0.95 - i * 0.07;
    put(g, ball(r + 0.05), m.glove, -3.5, y, 0.9);                               // nudillo
    put(g, cap(r, 1.6), m.glove, -3.4, y, 2.2).rotation.x = Math.PI / 2;         // 1ª falange hacia delante
    put(g, ball(r), m.glove, -3.2, y, 3.2);                                      // articulación
    const f2 = put(g, cap(r, 2.8), m.glove, -1.5, y, 3.35); f2.rotation.z = Math.PI / 2; // 2ª falange rodea la empuñadura
    put(g, ball(r * 0.95), m.skin, 0.55, y, 3.35);                               // yema (guante sin dedos)
  });
  put(g, ball(1.0), m.glove, -3.5, -0.8, 0.9);                                   // índice sobre el gatillo
  put(g, cap(0.9, 4.2), m.glove, -3.0, -0.7, 3.3).rotation.x = Math.PI / 2;
  put(g, ball(0.82), m.skin, -2.9, -0.55, 6.0);
  const th = put(g, cap(1.0, 4.4), m.glove, -3.1, 2.1, -1.6); th.rotation.x = Math.PI / 2 - 0.08; // pulgar sobre el armazón
  put(g, ball(0.95), m.glove, -3.0, 2.05, 1.0); put(g, cap(0.85, 1.6), m.skin, -2.9, 2.0, 2.2).rotation.x = Math.PI / 2;
  limb(g, [-3.5, -3.4, -9.0], [-4.6, -5.4, -14.5], 3.3, 3.5, m.cuff);           // puño del guante
  put(g, rb(1.2, 1.6, 4.6, 0.3), m.strap, -6.6, -4.1, -11.6).rotation.set(0.35, 0, 0.1); // tira de velcro
  limb(g, [-4.4, -4.8, -13.5], [-10, -13, -46], 3.9, 4.8, m.sleeve);             // manga
  return g;
}

// Mano izquierda: sujeta el cargador por debajo (origen = base del cargador).
function buildLeftHand() {
  const g = new THREE.Group(), m = mats();
  put(g, rb(5.2, 1.9, 8.8, 0.95), m.glove, 0, -1.3, 0);                          // palma bajo el cargador
  put(g, rb(4.6, 0.7, 5.6, 0.35), m.pad, 0, -2.45, -0.5);
  [-3.4, -1.15, 1.1, 3.3].forEach((z, i) => {                                    // 4 dedos subiendo por el lado
    const r = 0.88 - (i === 3 ? 0.1 : 0);
    put(g, cap(r, 3.0), m.glove, 2.7, 0.7, z);
    put(g, ball(r * 0.95), m.skin, 2.5, 2.8, z);
  });
  const th = put(g, cap(0.95, 2.6), m.glove, 0.3, -0.2, 5.6); th.rotation.z = Math.PI / 2 - 0.2; // pulgar
  put(g, ball(0.85), m.skin, -1.5, 0.1, 5.5);
  limb(g, [4.5, -3.2, -6.5], [6.6, -5.2, -12.5], 3.3, 3.5, m.cuff);
  limb(g, [6.0, -4.6, -12], [16, -14, -48], 3.9, 4.8, m.sleeve);
  return g;
}

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const GUN = []; // mallas de todas las armas cargadas (para cambiar su acabado)
export function createFps(gltf, kind = 'pistol') {
  const def = WDEF[kind];
  const vm = new THREE.Group(), rig = new THREE.Group(), outer = new THREE.Group(); // outer: el juego mueve/inclina este grupo
  vm.add(rig); vm.rotation.y = Math.PI; outer.add(vm);
  const root = gltf.scene; rig.add(root);
  const talon = root.getObjectByName('Talon');
  const rh = buildRightHand(); rh.userData.hand = true; rh.position.set(...def.r); talon.add(rh); // la mano derecha sigue al arma
  // Puntos de referencia: boca del cañón y ventana de expulsión (para fogonazo y casquillos)
  const muzzle = new THREE.Object3D(); muzzle.position.set(...def.muzzle); talon.add(muzzle);
  const ejector = new THREE.Object3D(); ejector.position.set(...def.ejector); talon.add(ejector);

  // Mano izquierda (solo visible al recargar)
  const left = buildLeftHand(); left.userData.hand = true; left.visible = false; rig.add(left);
  const clipNode = root.getObjectByName('clip');
  let clipMesh = null, clipLP = null; const LREST = new THREE.Vector3(16, -36, -26), tmpV = new THREE.Vector3(), tgt = new THREE.Vector3();
  if (clipNode) {
    clipNode.traverse((o) => { if (o.isMesh && !clipMesh) clipMesh = o; });
    if (clipMesh) { // base del cargador (en reposo) expresada en coordenadas locales de su malla
      rig.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(clipMesh), bot = new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
      clipLP = clipMesh.worldToLocal(bot.clone());
    }
  }
  rig.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  // Mallas de la pistola (sin manos) para poder cambiar su acabado
  root.traverse((o) => { if (!o.isMesh) return; let a = o, hand = false; while (a) { if (a.userData.hand) hand = true; a = a.parent; } if (!hand) { o.userData.orig = o.material; GUN.push(o); } });

  const mixer = new THREE.AnimationMixer(root), act = {};
  const clips = kind === 'pistol' ? gltf.animations : makeClips(root, kind);
  for (const c of clips) { const a = mixer.clipAction(c); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; act[c.name] = a; }

  return {
    root: outer, rig, talon, mixer, muzzle, ejector,
    fire() { if (act.fire && !(act.reload && act.reload.isRunning())) act.fire.reset().play(); }, // retroceso de corredera
    reload(dur = 1.5) { const a = act.reload; if (a) { a.reset(); a.timeScale = a.getClip().duration / dur; a.play(); } },
    reloading() { return !!(act.reload && act.reload.isRunning()); },
    // rp: progreso de la recarga 0..1 (-1 si no recarga). La mano izquierda sigue la base del cargador.
    update(dt, rp = -1) {
      mixer.update(dt);
      const w = rp >= 0 ? sstep(0, 0.16, rp) * (1 - sstep(0.66, 0.86, rp)) : 0;
      left.visible = w > 0.01 || !!def.hold; if (def.hold && w <= 0.01) left.position.set(...def.hold);
      if (w > 0.01 && clipMesh && clipLP) {
        rig.updateMatrixWorld(true);
        tmpV.copy(clipLP); clipMesh.localToWorld(tmpV); rig.worldToLocal(tmpV);
        tgt.copy(tmpV).add(new THREE.Vector3(0, -0.4, 0.2));
        left.position.lerpVectors(def.hold ? tmpV.set(...def.hold) : LREST, tgt, w);
        left.rotation.set(0, 0, (1 - w) * 0.35); // llega algo girada
      }
    },
  };
}

// Cosmético: cambia el color de los guantes (hex) o restaura el original ('' / 0).
export function setGlove(hex) { const m = mats(); m.glove.color.set(hex || 0x1b1c1f); }

// Cosmético: acabado de la pistola (null = original). skin = { color, metal, rough }.
export function setSkin(skin) {
  for (const o of GUN) {
    const orig = o.userData.orig; if (!orig) continue;
    if (!skin) { o.material = orig; continue; }
    o.material = [].concat(orig).map((m) => { const c = m.clone(); c.map = null; c.bumpMap = null; c.color.set(skin.color); c.metalness = skin.metal; c.roughness = skin.rough; c.envMapIntensity = skin.metal > 0.7 ? 1.5 : 0.6; c.needsUpdate = true; return c; });
    if (o.material.length === 1) o.material = o.material[0];
  }
}
