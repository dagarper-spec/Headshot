// Decoración procedural del almacén: estanterías industriales, barriles, palés, tuberías, señales y marcas de suelo.
// Cada objeto se funde en 1-2 mallas (geometría combinada con colores por vértice) para gastar pocas llamadas de dibujo.
import * as THREE from 'three';

const GREY = new THREE.Color(0x6b655c);
// Combina cajas/cilindros [{geo, x,y,z, color, ry}] en una sola BufferGeometry con colores por vértice.
function merge(items) {
  const P = [], N = [], U = [], C = [], I = []; let off = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  for (const it of items) {
    const g = it.geo.clone(); e.set(it.rx || 0, it.ry || 0, it.rz || 0); q.setFromEuler(e);
    m.compose(new THREE.Vector3(it.x || 0, it.y || 0, it.z || 0), q, new THREE.Vector3(1, 1, 1)); g.applyMatrix4(m);
    col.set(it.color); col.lerp(GREY, 0.3).multiplyScalar(0.62); // pintura desgastada y sucia
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(g.attributes.normal.getX(i), g.attributes.normal.getY(i), g.attributes.normal.getZ(i)); U.push(g.attributes.uv.getX(i), g.attributes.uv.getY(i)); const y = p.getY(i) + (it.y || 0) * 0, k = (0.78 + Math.random() * 0.3) * (0.72 + 0.28 * Math.min(1, Math.max(0, (it.y || 0) / 0.9))); C.push(col.r * k, col.g * k, col.b * k); }
    for (const k of g.index.array) I.push(k + off);
    off += p.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); out.setIndex(I);
  return out;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, n = 16) => new THREE.CylinderGeometry(r, r, h, n);
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); };
const mesh = (geo, mat, shadow = true) => { const o = new THREE.Mesh(geo, mat); o.castShadow = shadow; o.receiveShadow = true; return o; };

// Textura de mugre: manchas, óxido, rayones y churretes verticales (se multiplica con el color de vértice).
let GRIME;
function grime() {
  if (GRIME) return GRIME;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#b8b2a6'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { const v = 80 + Math.random() * 110; x.fillStyle = `rgba(${v},${v * 0.95},${v * 0.85},0.35)`; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 28, 0, 7); x.fill(); }
  for (let i = 0; i < 38; i++) { x.fillStyle = `rgba(${120 + Math.random() * 40},${55 + Math.random() * 25},20,${0.18 + Math.random() * 0.25})`; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 14, 0, 7); x.fill(); } // óxido
  for (let i = 0; i < 40; i++) { const px = Math.random() * 256; const g = x.createLinearGradient(0, 0, 0, 256); x.fillStyle = `rgba(30,24,18,${0.1 + Math.random() * 0.18})`; x.fillRect(px, Math.random() * 120, 1 + Math.random() * 3, 40 + Math.random() * 130); } // churretes
  x.strokeStyle = 'rgba(235,230,215,0.3)'; x.lineWidth = 1; for (let i = 0; i < 40; i++) { x.beginPath(); const a = Math.random() * 256, b = Math.random() * 256; x.moveTo(a, b); x.lineTo(a + (Math.random() - 0.5) * 40, b + (Math.random() - 0.5) * 40); x.stroke(); } // rayones
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let MAT;
function mats() {
  if (MAT) return MAT;
  MAT = {
    steel: new THREE.MeshStandardMaterial({ vertexColors: true, map: grime(), roughness: 0.78, metalness: 0.4 }),
    stuff: new THREE.MeshStandardMaterial({ vertexColors: true, map: grime(), roughness: 0.95, metalness: 0 }),
    barrel: new THREE.MeshStandardMaterial({ vertexColors: true, map: grime(), roughness: 0.72, metalness: 0.4 }),
    wood: new THREE.MeshStandardMaterial({ vertexColors: true, map: grime(), roughness: 0.97, metalness: 0 }),
  };
  return MAT;
}

// Estantería metálica: postes azules, vigas naranjas, baldas y carga (cajas de cartón y cubetas). Eje largo = X.
export function buildShelf(b) {
  const L = Math.max(b[2], b[3]), D = Math.min(b[2], b[3]), H = b[4], m = mats();
  const frame = [], cargo = [], levels = [0.18, 0.98, 1.78, H - 0.1];
  for (const sx of [-L / 2 + 0.04, -L / 6, L / 6, L / 2 - 0.04]) for (const sz of [-D / 2 + 0.04, D / 2 - 0.04]) frame.push({ geo: box(0.07, H, 0.07), x: sx, y: H / 2, z: sz, color: 0x1f4e8c });
  levels.forEach((y, li) => {
    for (const sz of [-D / 2 + 0.04, D / 2 - 0.04]) frame.push({ geo: box(L, 0.09, 0.06), x: 0, y, z: sz, color: 0xd9741a });
    frame.push({ geo: box(L - 0.1, 0.03, D - 0.06), x: 0, y: y + 0.05, z: 0, color: 0x8b8f93 });
    if (li === levels.length - 1) return;
    let x = -L / 2 + 0.2;
    while (x < L / 2 - 0.45) { // carga aleatoria sobre la balda
      const w = 0.4 + Math.random() * 0.35, h = 0.25 + Math.random() * 0.4, d = D - 0.2 - Math.random() * 0.1;
      if (Math.random() < 0.18) { x += 0.5; continue; } // hueco
      const kind = Math.random(); let color = shade(0xb48a56, 0.8 + Math.random() * 0.35);
      if (kind > 0.78) color = 0x2a4a7a; else if (kind > 0.66) color = 0xcfcfc8; // cubeta azul / bulto envuelto en plástico
      cargo.push({ geo: box(w, h, d), x: x + w / 2, y: y + 0.065 + h / 2, z: 0, color });
      if (kind <= 0.66) cargo.push({ geo: box(0.05, 0.004, d + 0.002), x: x + w / 2, y: y + 0.067 + h, z: 0, color: 0xd9c9a0 }); // cinta adhesiva
      x += w + 0.04 + Math.random() * 0.08;
    }
  });
  const g = new THREE.Group();
  g.add(mesh(merge(frame), m.steel), mesh(merge(cargo), m.stuff));
  g.position.set(b[0], 0, b[1]); g.rotation.y = b[3] > b[2] ? Math.PI / 2 : 0;
  return g;
}

// Grupo de 3 barriles con aros y tapa.
export function buildBarrels(b) {
  const m = mats(), items = [], colors = [0x1d4f91, 0x9a2a1f, 0x2f5a35];
  [[-0.3, -0.24], [0.32, -0.2], [0.0, 0.3]].forEach(([x, z], i) => {
    const c = colors[(i + Math.floor(Math.random() * 3)) % 3];
    items.push({ geo: cyl(0.29, 0.98), x, y: 0.49, z, color: c });
    for (const y of [0.14, 0.49, 0.84]) items.push({ geo: cyl(0.302, 0.045), x, y, z, color: shade(c, 0.55) });
    items.push({ geo: cyl(0.26, 0.02), x, y: 0.985, z, color: shade(c, 1.3) });
    items.push({ geo: cyl(0.03, 0.03, 8), x: x + 0.12, y: 1.0, z: z + 0.05, color: 0x888888 });
  });
  const g = new THREE.Group(); g.add(mesh(merge(items), m.barrel)); g.position.set(b[0], 0, b[1]); g.rotation.y = Math.random() * 6;
  return g;
}

function textTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// Elementos decorativos sin colisión: palés, tuberías del techo, señales, bandas de peligro y marcas del suelo.
export function buildDecor(scene, half, HT) {
  const m = mats(), H = half;
  // Palés de madera en el suelo (planos, se puede pisar)
  const pal = [], slat = 0x9a7a4b;
  const pallet = (x, z, ry, n = 1) => {
    const it = [];
    for (let k = 0; k < n; k++) {
      const y = k * 0.16;
      for (const rx of [-0.5, 0, 0.5]) it.push({ geo: box(0.12, 0.09, 1.0), x: rx, y: y + 0.045, z: 0, color: shade(slat, 0.75) });
      for (let s = 0; s < 5; s++) it.push({ geo: box(1.2, 0.025, 0.16), x: 0, y: y + 0.105, z: -0.42 + s * 0.21, color: shade(slat, 0.85 + Math.random() * 0.3) });
    }
    const o = mesh(merge(it), m.wood, false); o.position.set(x, 0, z); o.rotation.y = ry; scene.add(o);
  };
  pallet(-11.5, -12, 0.1, 2); pallet(11.5, -12.3, -0.2, 1); pallet(12.4, 3.6, Math.PI / 2, 1); pallet(-12.2, -9, 1.5, 1); pallet(2, 12.4, 0.05, 2); pallet(-1, -12.6, 0.3, 1);

  // Tuberías y conducto bajo el techo
  const pipes = [];
  for (const [z, r, c] of [[-4.5, 0.13, 0x6b7076], [-4.1, 0.07, 0x9a2a1f], [5.2, 0.16, 0x5c6168], [5.7, 0.07, 0x2c4f7a]]) pipes.push({ geo: cyl(r, H * 2 - 0.2, 14), x: 0, y: HT - 1.15 + (r > 0.1 ? 0 : 0.12), z, rz: Math.PI / 2, color: c });
  for (const x of [-10, -5, 0, 5, 10]) { pipes.push({ geo: box(0.05, 0.9, 0.05), x, y: HT - 0.7, z: -4.3, color: 0x44484d }); pipes.push({ geo: box(0.05, 0.9, 0.05), x, y: HT - 0.7, z: 5.45, color: 0x44484d }); }
  pipes.push({ geo: box(H * 2 - 4, 0.5, 0.7), x: 0, y: HT - 0.5, z: 11, color: 0x6a6f73 }); // conducto de ventilación
  scene.add(mesh(merge(pipes), m.steel, false));

  // Bandas de peligro en la base de las paredes (amarillo/negro)
  const haz = textTex(256, 32, (x, w, h) => { x.fillStyle = '#d8ab00'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; for (let i = -h; i < w + h; i += 40) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + 20, h); x.lineTo(i + 20 + h, 0); x.lineTo(i + h, 0); x.fill(); } });
  haz.wrapS = THREE.RepeatWrapping; haz.repeat.set(14, 1);
  const hm = new THREE.MeshStandardMaterial({ map: haz, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  [[0, -H, 0], [0, H, Math.PI], [-H, 0, Math.PI / 2], [H, 0, -Math.PI / 2]].forEach(([x, z, r]) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, 0.3), hm); p.position.set(x, 0.15, z); p.rotation.y = r;
    p.position.x += Math.sin(r) * 0.01; p.position.z += Math.cos(r) * 0.01; p.receiveShadow = true; scene.add(p);
  });

  // Marcas de suelo: pasillo amarillo y número de zona
  const ym = new THREE.MeshStandardMaterial({ color: 0xcaa200, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const [x, z, w, d] of [[0, 8.2, 26, 0.12], [0, -8.2, 26, 0.12], [-8.2, 0, 0.12, 16.4], [8.2, 0, 0.12, 16.4]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ym); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.004, z); p.receiveShadow = true; scene.add(p);
  }
  const zone = textTex(256, 128, (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, w, h); x.fillStyle = '#d8d8d0'; x.font = 'bold 96px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('B-3', w / 2, h / 2 + 4); });
  const zp = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshStandardMaterial({ map: zone, transparent: true, roughness: 0.9, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  zp.rotation.x = -Math.PI / 2; zp.position.set(-3, 0.005, 12.3); scene.add(zp);

  // Señales en las paredes: salida (verde, brilla) y peligro
  const exit = textTex(256, 96, (x, w, h) => { x.fillStyle = '#0a7a3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = 'bold 54px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SALIDA', w / 2, h / 2 + 3); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(5, 5, w - 10, h - 10); });
  const ex = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.56), new THREE.MeshBasicMaterial({ map: exit, color: new THREE.Color(1.6, 1.6, 1.6) }));
  ex.position.set(0, 3.2, -H + 0.02); scene.add(ex);
  const dan = textTex(192, 192, (x, w, h) => { x.fillStyle = '#e0b400'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; x.beginPath(); x.moveTo(w / 2, 22); x.lineTo(w - 22, h - 40); x.lineTo(22, h - 40); x.closePath(); x.lineWidth = 12; x.strokeStyle = '#111'; x.stroke(); x.font = 'bold 84px Arial'; x.textAlign = 'center'; x.fillText('!', w / 2, h - 62); x.font = 'bold 22px Arial'; x.fillText('PELIGRO', w / 2, h - 12); });
  for (const [x, y, z, r] of [[-H + 0.02, 1.9, 2, Math.PI / 2], [H - 0.02, 2.1, -6, -Math.PI / 2], [-6, 1.9, H - 0.02, Math.PI]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshStandardMaterial({ map: dan, roughness: 0.6 })); s.position.set(x, y, z); s.rotation.y = r; scene.add(s);
  }

  // Cuadro eléctrico con pilotos luminosos
  const panel = new THREE.Group();
  const pb = mesh(box(0.14, 1.1, 0.75), new THREE.MeshStandardMaterial({ color: 0x6d7378, roughness: 0.5, metalness: 0.6 })); panel.add(pb);
  [[0.4, 0xff2a1a], [0.25, 0xff2a1a], [0.1, 0x20ff50]].forEach(([dz, c], i) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(4) })); l.position.set(-0.08, 0.4 - i * 0.12, -0.25 + (i % 2) * 0.2); panel.add(l); });
  panel.position.set(H - 0.08, 1.5, 6.5); scene.add(panel);
}
