// Carga de modelos 3D externos (.glb) con GLTFLoader + Draco opcional.
// Si el archivo no existe devuelve null y el juego usa su modelo procedural.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

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
