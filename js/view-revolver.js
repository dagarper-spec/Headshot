// Revólver .357 en primera persona (modelo procedural): armazón, cañón con cinta, tambor giratorio, empuñadura de madera, guante y manga.
import * as THREE from 'three';

export function buildRevolver() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const steel = new THREE.MeshStandardMaterial({ color: 0x6b727c, roughness: 0.3, metalness: 0.8 }), blued = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.3, metalness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a6330, roughness: 0.6, metalness: 0.05 }), glove = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.75 }), sleeve = new THREE.MeshStandardMaterial({ color: 0x4b5340, roughness: 0.95 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); inner.add(m); return m; };
  const cyl = (r, l, n = 14) => new THREE.CylinderGeometry(r, r, l, n).rotateX(Math.PI / 2);
  add(new THREE.BoxGeometry(0.034, 0.07, 0.15), steel, 0, 0, 0.0);                       // armazón
  add(cyl(0.0125, 0.2), blued, 0, 0.022, -0.17);                                          // cañón
  add(new THREE.BoxGeometry(0.014, 0.014, 0.2), steel, 0, 0.042, -0.17);                  // cinta superior
  add(new THREE.BoxGeometry(0.008, 0.016, 0.012), steel, 0, 0.056, -0.255);               // punto de mira
  add(new THREE.BoxGeometry(0.01, 0.014, 0.012), steel, 0, 0.044, 0.06);                  // alza
  const drum = new THREE.Group(); drum.position.set(0, 0.012, -0.045); inner.add(drum);
  const body = new THREE.Mesh(cyl(0.038, 0.07, 18), steel); drum.add(body);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, h = new THREE.Mesh(cyl(0.009, 0.072, 8), new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 1 })); h.position.set(Math.cos(a) * 0.026, Math.sin(a) * 0.026, 0); drum.add(h); }
  add(new THREE.BoxGeometry(0.03, 0.095, 0.052), wood, 0, -0.075, 0.075, 0.38, 0, 0);     // empuñadura
  add(new THREE.BoxGeometry(0.008, 0.02, 0.026), blued, 0, 0.044, 0.085, -0.5, 0, 0);    // martillo
  add(new THREE.TorusGeometry(0.026, 0.004, 6, 14, Math.PI), blued, 0, -0.035, 0.012, 0, Math.PI / 2, 0).rotation.z = Math.PI; // guardamonte
  // mano enguantada y manga
  add(new THREE.BoxGeometry(0.062, 0.085, 0.07), glove, 0.004, -0.07, 0.085, 0.38, 0, 0);
  for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.016, 0.014, 0.06), glove, -0.028 + k * 0.019, -0.068 + k * 0.012, 0.05, 0, 0, 0).rotation.x = 0.4 + k * 0.1;
  add(new THREE.BoxGeometry(0.018, 0.018, 0.06), glove, 0.04, -0.01, 0.07, 0, -0.5, 0);  // pulgar
  add(new THREE.BoxGeometry(0.075, 0.075, 0.3), sleeve, 0.02, -0.16, 0.26, 0.9, 0, 0.1);
  inner.rotation.y = 0.16; g.scale.setScalar(1);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.022, -0.275); inner.add(muzzle);
  g.userData = { drum, muzzle };
  g.visible = false;
  return g;
}
