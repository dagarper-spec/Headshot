// Cascos del jugador (tienda/equipamiento): geometría detallada en coordenadas de cabeza del soldado (metros, cabeza ~0.2 m).
// light = casco táctico de corte alto con montura NVG y raíles; heavy = casco blindado con orejeras, visor balístico y mentonera.
import * as THREE from 'three';
import { rb, mat, put } from './view-models.js';

// Textura de ruido para dar grano al material (lona/polímero) sin cargar imágenes.
function grain(base, amp = 24, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.6; i++) { const v = (Math.random() - 0.5) * amp; x.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`; x.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Casco: calota esférica con el borde recortado (corte alto sobre las orejas) y deformación de nuca/frente.
function shellGeo(rx, ry, rz, theta, cut, flare, nape = 0) {
  const g = new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, theta), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * rx, y = p.getY(i) * ry, z = p.getZ(i) * rz;
    const side = Math.abs(x) / rx;
    if (y < cut.y0 && side > cut.x0) y = Math.max(y, cut.y0 + (side - cut.x0) * cut.k);       // corte sobre las orejas
    if (flare && y < 0) { x *= 1 + flare * (-y / ry); z *= 1 + flare * 0.5 * (-y / ry); }       // faldón que cubre orejas y nuca
    if (z < 0) y -= nape * Math.pow(-z / rz, 1.6);                                                // la nuca baja para cubrir la parte trasera
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
}

export function buildHelmet(kind) {
  const g = new THREE.Group(), heavy = kind === 'hHeavy';
  const shellMat = new THREE.MeshStandardMaterial({ color: heavy ? 0x4a5058 : 0x6b6a4c, roughness: heavy ? 0.62 : 0.72, metalness: heavy ? 0.25 : 0.08, map: grain(heavy ? '#4a5058' : '#6b6a4c', 30), bumpMap: grain('#808080', 60), bumpScale: 0.6, envMapIntensity: 0.5 });
  const dark = mat(0x16181b, 0.5, 0.6, 0.5), strap = mat(0x1d1f1a, 0.95, 0, 0.1), metal = mat(0x8a9099, 0.35, 0.9, 0.7), rubber = mat(0x0e0f10, 0.9, 0.1, 0.1);
  const sh = new THREE.Mesh(heavy ? shellGeo(0.13, 0.135, 0.145, Math.PI * 0.5, { y0: -0.02, x0: 0.7, k: 0.1 }, 0.1, 0.08) : shellGeo(0.118, 0.128, 0.134, Math.PI * 0.46, { y0: -0.01, x0: 0.6, k: 0.18 }, 0, 0.1), shellMat);
  sh.position.set(0, heavy ? 0.012 : 0.018, -0.006); sh.castShadow = true; g.add(sh);
  // Montura NVG frontal + placa
  put(g, rb(0.06, 0.045, 0.03, 0.008), dark, 0, 0.086, 0.122).rotation.x = -0.35;
  put(g, new THREE.CylinderGeometry(0.013, 0.013, 0.012, 14).rotateX(Math.PI / 2), metal, 0, 0.086, 0.138).rotation.x = -0.35;
  // Raíles laterales con ranuras
  for (const s of [-1, 1]) {
    const r = put(g, rb(0.012, 0.03, 0.08, 0.004), dark, s * (heavy ? 0.131 : 0.12), heavy ? 0.045 : 0.045, 0.01); r.rotation.z = -s * 0.42;
    for (let k = 0; k < 5; k++) { const sl = put(g, rb(0.018, 0.04, 0.006, 0.001), metal, s * (heavy ? 0.1335 : 0.1225), heavy ? 0.045 : 0.045, -0.026 + k * 0.016); sl.rotation.z = -s * 0.42; sl.scale.set(0.5, 0.5, 0.35); }
  }
  // Dial de ajuste trasero y banda elástica
  put(g, rb(0.05, 0.034, 0.024, 0.008), dark, 0, heavy ? 0.0 : -0.03, -0.138);
  put(g, new THREE.CylinderGeometry(0.011, 0.011, 0.012, 14).rotateX(Math.PI / 2), metal, 0, heavy ? 0.0 : -0.03, -0.152);
  // Barbuquejo (correas que bajan por delante de las orejas hasta la barbilla)
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.108, 0.03, 0.015), new THREE.Vector3(s * 0.1, -0.05, 0.03), new THREE.Vector3(s * 0.06, -0.12, 0.068), new THREE.Vector3(s * 0.012, -0.145, 0.09)]), 20, 0.0042, 6), strap); g.add(c);
  }
  put(g, rb(0.03, 0.018, 0.016, 0.005), rubber, 0, -0.145, 0.095); // barbilla
  if (!heavy) { // detalles del casco táctico: cubierta camuflada con cinta y luz química
    put(g, rb(0.085, 0.01, 0.07, 0.003), mat(0x2f3326, 0.9), 0, 0.14, 0.02).rotation.x = -0.12;
    put(g, new THREE.CylinderGeometry(0.004, 0.004, 0.05, 8).rotateX(Math.PI / 2), mat(0x66ff88, 0.4, 0, 0).clone(), 0.06, 0.1, -0.1).material.emissive = new THREE.Color(0x66ff88);
  } else { // casco blindado: orejeras con auriculares, visera balística bajada y cresta superior
    for (const s of [-1, 1]) {
      put(g, new THREE.SphereGeometry(0.036, 18, 14), dark, s * 0.119, -0.008, 0.002).scale.set(0.6, 1.25, 1.1);
      put(g, new THREE.CylinderGeometry(0.003, 0.003, 0.1, 6), metal, s * 0.125, 0.07, -0.06).rotation.set(0.5, 0, s * -0.1);
      put(g, rb(0.016, 0.05, 0.016, 0.004), dark, s * 0.092, -0.07, 0.085).rotation.set(0, 0, 0);
    }
    put(g, rb(0.014, 0.012, 0.19, 0.004), dark, 0, 0.142, 0.0);                                           // cresta
    const vis = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.122, 0.085, 30, 1, true, -Math.PI * 0.42, Math.PI * 0.84), new THREE.MeshStandardMaterial({ color: 0x1b2c3a, roughness: 0.06, metalness: 0.6, transparent: true, opacity: 0.78, envMapIntensity: 1.6, side: THREE.DoubleSide }));
    vis.position.set(0, -0.004, 0.012); vis.rotation.x = 0.1; g.add(vis);
    put(g, rb(0.1, 0.01, 0.014, 0.004), metal, 0, 0.04, 0.138).rotation.x = -0.1;                           // marco superior de la visera
    for (const sx of [-0.06, 0.06]) put(g, new THREE.CylinderGeometry(0.006, 0.006, 0.01, 10).rotateX(Math.PI / 2), metal, sx * 0.8, 0.04, 0.147); // tornillos
        put(g, rb(0.07, 0.026, 0.05, 0.008), dark, 0, -0.0, -0.152);                                              // bolsa trasera
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
