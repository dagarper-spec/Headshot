// Arma en primera persona: pistola animada (disparo/recarga, modelo externo) + mano enguantada procedural.
// El modelo está en cm con +Z hacia delante; el grupo `vm` lo escala y gira para colgarlo de la cámara (-Z).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { rb, mat, put } from './view-models.js';

export async function loadFps(dir) {
  try { return await new GLTFLoader().loadAsync(dir + 'pistol.glb'); } // null => el juego usa la pistola procedural
  catch (e) { console.info('[fps] sin pistola externa: ' + (e.message || e)); return null; }
}

// Mano derecha enguantada agarrando la empuñadura (medidas en cm, espacio de la pistola).
function buildHand() {
  const g = new THREE.Group();
  const glove = mat(0x17181a, 0.55, 0.05), skin = mat(0xc99a7c, 0.55, 0, 0.2), sleeve = mat(0x4b5340, 0.95), cuff = mat(0x111214, 0.7);
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 12);
  put(g, rb(2.1, 7.4, 8.2, 0.9), glove, -3.4, -3.4, -3.2);                       // dorso/palma sobre el lateral de la empuñadura
  put(g, rb(2.3, 7.4, 2.6, 0.9), glove, -3.2, -3.4, -7.6);                       // talón de la mano
  [-0.4, -2.5, -4.5, -6.3].forEach((y, i) => {                                   // 4 dedos rodeando el frente de la empuñadura
    const len = 5.2 - (i === 3 ? 0.8 : 0);
    const f = put(g, cap(0.95 - i * 0.05, len), glove, -0.9, y, 2.4); f.rotation.z = Math.PI / 2;
    put(g, new THREE.SphereGeometry(0.95 - i * 0.05, 10, 8), skin, 1.9, y, 2.4);  // punta del dedo (sin guante)
    put(g, new THREE.SphereGeometry(1.0 - i * 0.05, 10, 8), glove, -3.4, y, 1.4); // nudillo
  });
  const th = put(g, cap(1.0, 5.4), glove, -3.0, 2.2, -1.6); th.rotation.x = Math.PI / 2 - 0.1; // pulgar a lo largo del armazón
  put(g, new THREE.SphereGeometry(1.0, 10, 8), skin, -3.0, 2.0, 2.0);
  // antebrazo: cilindro cónico entre la muñeca y el codo (hacia la cámara)
  const limb = (A, B, r1, r2, m) => {
    const a = new THREE.Vector3(...A), b = new THREE.Vector3(...B), d = b.clone().sub(a);
    const o = put(g, new THREE.CylinderGeometry(r2, r1, d.length(), 20), m, 0, 0, 0);
    o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
  };
  limb([-3.6, -3.4, -9.0], [-4.6, -5.4, -14.5], 3.3, 3.5, cuff);              // puño del guante
  limb([-4.4, -4.8, -13.5], [-10, -13, -46], 3.9, 4.8, sleeve);               // manga
  return g;
}

export function createFps(gltf) {
  const vm = new THREE.Group(), rig = new THREE.Group(), outer = new THREE.Group(); // outer: el juego mueve/inclina este grupo
  vm.add(rig); vm.rotation.y = Math.PI; outer.add(vm);
  const root = gltf.scene; rig.add(root);
  const talon = root.getObjectByName('Talon');
  talon.add(buildHand()); // la mano sigue a la pistola en la recarga
  rig.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

  const mixer = new THREE.AnimationMixer(root), act = {};
  for (const c of gltf.animations) { const a = mixer.clipAction(c); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; act[c.name] = a; }

  return {
    root: outer, rig, talon, mixer,
    fire() { if (act.fire && !(act.reload && act.reload.isRunning())) act.fire.reset().play(); }, // retroceso de corredera
    reload(dur = 1.5) { const a = act.reload; if (a) { a.reset(); a.timeScale = a.getClip().duration / dur; a.play(); } },                                       // cargador fuera/dentro
    reloading() { return !!(act.reload && act.reload.isRunning()); },
    update(dt) { mixer.update(dt); },
  };
}
