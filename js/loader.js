// Carga de modelos 3D externos (.glb) con GLTFLoader + Draco opcional.
// Si el archivo no existe devuelve null y el juego usa su modelo procedural.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

let loader;
function getLoader() {
  if (loader) return loader;
  loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  loader.setDRACOLoader(draco);
  return loader;
}

// Normaliza el modelo a `height` metros con los pies en y=0 y mirando a +Z.
export async function loadModel(url, height = 1.8) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) throw new Error('404');
    const gltf = await getLoader().loadAsync(url);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const k = height / (size.y || 1);
    gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    return { scene: gltf.scene, clips: gltf.animations || [], scale: k, offsetY: -box.min.y * k };
  } catch {
    console.info('[loader] sin modelo en ' + url + ', se usa el procedural');
    return null;
  }
}

// Mixamo: personaje "Y Bot" + animaciones sin skin (todas comparten el esqueleto mixamorig).
const ANIMS = { idle: 'idle', walk: 'walk', run: 'run', aim: 'gunplay', hide: 'hide', death: 'death' };
export async function loadMixamo(dir) {
  try {
    const L = new FBXLoader();
    const [body, ...files] = await Promise.all([L.loadAsync(dir + 'ybot.fbx'), ...Object.values(ANIMS).map((f) => L.loadAsync(dir + f + '.fbx'))]);
    const clips = {};
    Object.keys(ANIMS).forEach((k, i) => {
      const c = files[i].animations[0]; c.name = k;
      if (k === 'walk' || k === 'run') // quitar el movimiento incorporado: el desplazamiento lo manda la lógica del juego
        c.tracks.forEach((t) => { if (/Hips\.position$/.test(t.name)) for (let j = 2; j < t.values.length; j += 3) t.values[j] = t.values[2]; });
      clips[k] = c;
    });
    return { mixamo: true, scene: body, clips };
  } catch (e) {
    console.info('[loader] sin animaciones Mixamo: ' + (e.message || e));
    return null;
  }
}
