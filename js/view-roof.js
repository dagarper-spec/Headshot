// Zona 2: azotea al anochecer. Suelo de grava/alquitrán, parapeto, caseta de escalera, aires acondicionados, conductos,
// muros bajos, chimeneas, helipuerto pintado, cielo degradado y skyline con ventanas iluminadas. Solo render.
import * as THREE from 'three';

// Textura de lienzo con ruido; draw(ctx, w, h) pinta encima de la base.
function tex(w, h, base, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  draw && draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const speck = (x, w, h, n, cols, size = 2) => { for (let i = 0; i < n; i++) { x.fillStyle = cols[(Math.random() * cols.length) | 0]; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * size, 1 + Math.random() * size); } };
// Escala las UV de una caja para que la textura se repita por metro (evita texturas estiradas).
const boxUV = (w, h, d, tile = 2) => {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  return g;
};

export function buildRoof(crates, H) {
  const group = new THREE.Group(), lamps = [];
  const st = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.05, envMapIntensity: 0.35, ...o });
  const add = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; group.add(m); return m; };

  // ---- Suelo: alquitrán con grava, juntas y manchas ----
  const floorT = tex(256, 256, '#34373a', (x, w, h) => {
    speck(x, w, h, 5000, ['#25282b', '#4a4d50', '#2c2f31', '#5a5750'], 2);
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(10,10,12,${0.08 + Math.random() * 0.1})`; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 10 + Math.random() * 25, Math.random() * 3, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.strokeRect(0, 0, w, h);
  }, [7, 7]);
  const floor = add(new THREE.PlaneGeometry(H * 2, H * 2), st({ map: floorT, bumpMap: floorT, bumpScale: 1.4, roughness: 0.95 }), 0, 0, 0, false); floor.rotation.x = -Math.PI / 2;

  // Helipuerto desgastado en el centro + marcas
  const padT = tex(512, 512, 'rgba(0,0,0,0)', (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = '#c9b22a'; x.lineWidth = 14; x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 20, 0, 7); x.stroke();
    x.fillStyle = '#c9b22a'; x.font = 'bold 260px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', w / 2, h / 2 + 12);
    for (let i = 0; i < 2600; i++) { x.globalCompositeOperation = 'destination-out'; x.fillStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.5})`; x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 7, 2 + Math.random() * 5); }
  });
  const pad = add(new THREE.PlaneGeometry(9, 9), new THREE.MeshStandardMaterial({ map: padT, transparent: true, roughness: 1, opacity: 0.85, depthWrite: false }), 0.5, 0.012, 0.5, false); pad.rotation.x = -Math.PI / 2;

  // ---- Parapeto perimetral (1,2 m) con remate ----
  const parT = tex(256, 128, '#6a6862', (x, w, h) => { speck(x, w, h, 1800, ['#55534e', '#7d7a73', '#4a4944'], 3); x.fillStyle = 'rgba(40,30,20,.18)'; for (let i = 0; i < 14; i++) x.fillRect(Math.random() * w, 0, 2 + Math.random() * 6, 30 + Math.random() * 90); });
  const parM = st({ map: parT, bumpMap: parT, bumpScale: 1.2 }), cap = st({ color: 0x8b8982, roughness: 0.8 });
  for (const [x, z, w, d] of [[0, -H - 0.25, 2 * H + 1, 0.5], [0, H + 0.25, 2 * H + 1, 0.5], [-H - 0.25, 0, 0.5, 2 * H], [H + 0.25, 0, 0.5, 2 * H]]) {
    add(boxUV(w, 1.2, d), parM, x, 0.6, z); add(new THREE.BoxGeometry(w + (d < w ? 0 : 0.1), 0.1, d + 0.2), cap, x, 1.25, z);
  }

  // ---- Obstáculos de colisión (mismo listado que la lógica) ----
  const concT = tex(256, 256, '#77756e', (x, w, h) => { speck(x, w, h, 2500, ['#5f5d57', '#8a877f', '#4e4c47'], 3); for (let i = 0; i < 10; i++) { x.fillStyle = `rgba(50,35,25,${0.1 + Math.random() * 0.12})`; x.fillRect(Math.random() * w, 0, 3 + Math.random() * 8, 40 + Math.random() * 200); } });
  const brickT = tex(256, 128, '#7a4a3a', (x, w, h) => { x.strokeStyle = 'rgba(30,20,15,.55)'; x.lineWidth = 3; for (let r = 0; r < 8; r++) { const y = r * 16; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); for (let c = (r % 2) * 16; c < w; c += 32) { x.beginPath(); x.moveTo(c, y); x.lineTo(c, y + 16); x.stroke(); } } speck(x, w, h, 1500, ['#5c3528', '#93604c', '#6a4033'], 3); });
  const metalT = tex(128, 128, '#8e9296', (x, w, h) => { speck(x, w, h, 800, ['#777b80', '#a2a6aa', '#6a5648'], 2); x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 2; for (let i = 16; i < w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); } for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(150,80,30,${0.15 + Math.random() * 0.15})`; x.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 14, 4 + Math.random() * 10); } });
  const doorT = tex(128, 192, '#4a4d50', (x, w, h) => { x.strokeStyle = '#25272a'; x.lineWidth = 6; x.strokeRect(4, 4, w - 8, h - 8); for (let y = 24; y < h - 10; y += 14) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(12, y, w - 24, 3); } x.fillStyle = '#b8b060'; x.fillRect(w - 24, h / 2, 8, 22); speck(x, w, h, 400, ['#6a4a30', '#3a3c3f'], 3); });
  const concM = st({ map: concT, bumpMap: concT, bumpScale: 1 }), brickM = st({ map: brickT, bumpMap: brickT, bumpScale: 2 }), metalM = st({ map: metalT, bumpMap: metalT, bumpScale: 0.6, roughness: 0.6, metalness: 0.5 });
  const fanM = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.7, metalness: 0.6 }), doorM = st({ map: doorT, roughness: 0.6, metalness: 0.5 });
  for (const b of crates) {
    const [x, z, w, d, h, type] = b;
    if (type === 'stair') { // caseta de escalera: hormigón, puerta metálica y lámpara de pared
      add(boxUV(w, h, d), concM, x, h / 2, z); add(new THREE.BoxGeometry(w + 0.2, 0.15, d + 0.2), cap0(), x, h + 0.07, z);
      const door = add(new THREE.PlaneGeometry(1.1, 2.1), doorM, x, 1.05, z + d / 2 + 0.012, false); void door;
      const lm = add(new THREE.BoxGeometry(0.3, 0.1, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.6, 1.4) }), x, 2.5, z + d / 2 + 0.08, false); void lm;
    } else if (type === 'ac') { // unidad exterior con rejilla de ventilador
      add(boxUV(w, h, d, 1.2), metalM, x, h / 2, z);
      const top = add(new THREE.CylinderGeometry(Math.min(w, d) * 0.38, Math.min(w, d) * 0.38, 0.05, 20), fanM, x, h + 0.02, z);
      for (let k = 0; k < 3; k++) { const bl = add(new THREE.BoxGeometry(Math.min(w, d) * 0.7, 0.01, 0.07), metalM, x, h + 0.05, z, false); bl.rotation.y = k * 1.05; void top; }
    } else if (type === 'vent') { // conducto con juntas
      add(boxUV(w, h, d, 1.2), metalM, x, h / 2, z);
      const long = w > d; for (let k = -1; k <= 1; k += 2) add(new THREE.BoxGeometry(long ? 0.12 : w + 0.12, h + 0.12, long ? d + 0.12 : 0.12), metalM, x + (long ? k * w * 0.32 : 0), h / 2, z + (long ? 0 : k * d * 0.32));
    } else if (type === 'wall') { // muro bajo de ladrillo con remate
      add(boxUV(w, h, d, 1.2), brickM, x, h / 2, z); add(new THREE.BoxGeometry(w + 0.1, 0.08, d + 0.1), cap0(), x, h + 0.04, z);
    } else if (type === 'chim') { // chimenea de hormigón con sombrerete metálico
      add(boxUV(w, h, d), concM, x, h / 2, z); add(new THREE.BoxGeometry(w + 0.4, 0.12, d + 0.4), metalM, x, h + 0.06, z);
    } else add(boxUV(w, h, d), concM, x, h / 2, z);
  }
  function cap0() { return cap; }

  // ---- Farolas junto al parapeto: mástil + cabeza emisiva + foco hacia el centro ----
  const postM = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.6, metalness: 0.7 }), headM = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.4, 2.4) });
  [[-13.2, -6], [13.2, -6], [-13.2, 8], [13.2, 8]].forEach(([x, z], i) => {
    add(new THREE.CylinderGeometry(0.05, 0.07, 4.6, 8), postM, x, 2.3, z); const dir = Math.sign(-x);
    add(new THREE.BoxGeometry(0.9, 0.06, 0.06), postM, x + dir * 0.4, 4.6, z, false);
    add(new THREE.BoxGeometry(0.4, 0.08, 0.22), headM, x + dir * 0.85, 4.55, z, false);
    const s = new THREE.SpotLight(0xffd9a8, 260, 0, Math.PI / 2.8, 0.75, 2); s.position.set(x + dir * 0.85, 4.5, z); s.target.position.set(dir * -1 * 2, 0, z * 0.3);
    s.shadow.bias = -0.0005; s.shadow.normalBias = 0.03; group.add(s, s.target); lamps.push(s);
  });
  // ---- Sol bajo de atardecer: luz cálida con sombras largas (el render decide si proyecta según la calidad) ----
  const SUN = new THREE.Vector3(-26, 11, -19).normalize();
  const sun = new THREE.DirectionalLight(0xffc48a, 2.6); sun.position.copy(SUN).multiplyScalar(40); sun.target.position.set(0, 0, 0);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -19; sun.shadow.camera.right = sun.shadow.camera.top = 19; sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; group.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x7f95d0, 0.55); fill.position.set(20, 18, 24); group.add(fill); // relleno frío del cielo opuesto

  // ---- Detalles de realismo: charcos, grietas, basura, cables, hierbajos, antenas, remates del parapeto ----
  let seedv = 11; const rnd = () => (seedv = (seedv * 16807) % 2147483647) / 2147483647;
  const inCrate = (x, z, r) => crates.some((b) => Math.abs(x - b[0]) < b[2] / 2 + r && Math.abs(z - b[1]) < b[3] / 2 + r);
  const scatter = (n, r, fn) => { let k = 0, t = 0; while (k < n && t++ < 400) { const x = (rnd() - 0.5) * 2 * (H - 1.4), z = (rnd() - 0.5) * 2 * (H - 1.4); if (inCrate(x, z, r)) continue; fn(x, z, k++); } };
  const decalM = (map, o = {}) => new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, ...o });
  const flat = (geo, mat, x, y, z, rot = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(-Math.PI / 2, 0, rot); m.receiveShadow = true; group.add(m); return m; };
  // charcos: mancha irregular con alpha; reflejan el cielo (entorno de la azotea)
  const blobT = tex(128, 128, 'rgba(0,0,0,0)', (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i <= 28; i++) { const a = (i / 28) * Math.PI * 2, r = 52 + Math.sin(a * 3 + 1) * 8 + Math.sin(a * 5) * 5 + (i % 3) * 1.5; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r * 0.78); } x.fill(); });
  const pudM = new THREE.MeshStandardMaterial({ map: blobT, color: 0x0c1119, roughness: 0.03, metalness: 0.1, envMapIntensity: 1.7, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  scatter(7, 1.8, () => { const p = flat(new THREE.PlaneGeometry(1, 1), pudM, 0, 0.016, 0, rnd() * 3); const sc = 1.3 + rnd() * 2.4; p.scale.set(sc, sc * (0.6 + rnd() * 0.4), 1); p.position.set(0, 0.016, 0); Object.assign(p.position, { x: p.position.x, z: p.position.z }); });
  // (los charcos se recolocan abajo con scatter para evitar obstáculos)
  group.children.filter((c) => c.material === pudM).forEach((c) => group.remove(c));
  scatter(7, 1.6, () => { const p = flat(new THREE.PlaneGeometry(1, 1), pudM, 0, 0.016, 0, rnd() * 3); const sc = 1.2 + rnd() * 2.2; p.scale.set(sc, sc * (0.6 + rnd() * 0.4), 1); }); // posición asignada justo después
  group.children.filter((c) => c.material === pudM).forEach((c) => { for (let t = 0; t < 60; t++) { const x = (rnd() - 0.5) * 2 * (H - 2), z = (rnd() - 0.5) * 2 * (H - 2); if (!inCrate(x, z, 1.4) && Math.hypot(x - 0.5, z - 0.5) > 6) { c.position.x = x; c.position.z = z; break; } } });
  // grietas y manchas de aceite
  const crackT = tex(256, 256, 'rgba(0,0,0,0)', (x, w, h) => { x.clearRect(0, 0, w, h); x.strokeStyle = 'rgba(8,8,10,.85)'; x.lineCap = 'round';
    const branch = (px, py, a, len, wd) => { if (len < 8 || wd < 0.4) return; x.lineWidth = wd; x.beginPath(); x.moveTo(px, py); let cx = px, cy = py; for (let i = 0; i < 6; i++) { a += (rnd() - 0.5) * 0.9; cx += Math.cos(a) * len / 6; cy += Math.sin(a) * len / 6; x.lineTo(cx, cy); } x.stroke(); if (rnd() < 0.8) branch(cx, cy, a + 0.7, len * 0.6, wd * 0.6); if (rnd() < 0.6) branch(cx, cy, a - 0.8, len * 0.55, wd * 0.6); };
    branch(20 + rnd() * 40, 128, rnd() * 0.6, 120, 2.6); });
  const oilT = tex(128, 128, 'rgba(0,0,0,0)', (x, w, h) => { x.clearRect(0, 0, w, h); const g = x.createRadialGradient(64, 64, 4, 64, 64, 56); g.addColorStop(0, 'rgba(5,5,8,.7)'); g.addColorStop(0.7, 'rgba(10,10,14,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  scatter(12, 1, (x, z) => flat(new THREE.PlaneGeometry(2.6, 2.6), decalM(crackT), x, 0.012, z, rnd() * 6.28));
  scatter(6, 1, (x, z) => { const o = flat(new THREE.PlaneGeometry(1.4, 1.4), decalM(oilT), x, 0.013, z, rnd() * 6.28); o.scale.set(0.7 + rnd(), 0.7 + rnd(), 1); });
  // basura y cachivaches sueltos (sin colisión)
  const cardM = st({ color: 0xa5875c, roughness: 0.95 }), tireM = st({ color: 0x151515, roughness: 0.9 }), bucketM = st({ color: 0x8c2e1e, roughness: 0.6 }), pipeM = st({ color: 0x6f747a, roughness: 0.5, metalness: 0.7 });
  scatter(3, 0.6, (x, z) => { const b = add(new THREE.BoxGeometry(0.5, 0.28, 0.4), cardM, x, 0.14, z); b.rotation.y = rnd() * 6; add(new THREE.BoxGeometry(0.06, 0.002, 0.41), st({ color: 0xd8c9a0, roughness: 0.6 }), x, 0.282, z, false).rotation.y = b.rotation.y; });
  scatter(2, 0.6, (x, z) => { const t = add(new THREE.TorusGeometry(0.3, 0.11, 8, 18), tireM, x, 0.11, z); t.rotation.x = Math.PI / 2; });
  scatter(2, 0.5, (x, z) => add(new THREE.CylinderGeometry(0.17, 0.13, 0.3, 12), bucketM, x, 0.15, z));
  scatter(3, 0.9, (x, z) => { const p = add(new THREE.CylinderGeometry(0.06, 0.06, 1.2 + rnd(), 8).rotateZ(Math.PI / 2), pipeM, x, 0.06, z); p.rotation.y = rnd() * 3; });
  // cables de goma tendidos entre equipos
  const cableM = new THREE.MeshStandardMaterial({ color: 0x0f0f11, roughness: 0.6 });
  const routes = [[[11.5, -3.4], [8, -1], [5, -2.6]], [[5, -3.5], [2, -2], [-3, -3.2]], [[-9.5, -9], [-8, -5], [-5.5, -2.8]], [[12, -8.2], [10, -5.5], [11.2, -3.4]]];
  routes.forEach((r) => { const pts = r.map(([x, z], i) => new THREE.Vector3(x, i === 0 || i === r.length - 1 ? 0.5 : 0.025, z)); const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.025, 6), cableM); m.castShadow = true; group.add(m); });
  // hierbajos secos entre grietas, junto al parapeto y a los obstáculos
  const grassT = tex(64, 64, 'rgba(0,0,0,0)', (x, w, h) => { x.clearRect(0, 0, w, h); for (let i = 0; i < 16; i++) { const bx = 8 + rnd() * 48, l = 22 + rnd() * 34; x.strokeStyle = ['#6b7a3a', '#8a8a45', '#556b2f', '#a39a55'][i % 4]; x.lineWidth = 1.6; x.beginPath(); x.moveTo(bx, 64); x.quadraticCurveTo(bx + (rnd() - 0.5) * 18, 64 - l * 0.6, bx + (rnd() - 0.5) * 26, 64 - l); x.stroke(); } });
  const grassM = new THREE.MeshStandardMaterial({ map: grassT, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1 });
  const tuft = (x, z, s) => { for (let k = 0; k < 2; k++) { const q = new THREE.Mesh(new THREE.PlaneGeometry(s, s), grassM); q.position.set(x, s / 2, z); q.rotation.y = k * Math.PI / 2 + rnd(); group.add(q); } };
  for (let i = 0; i < 34; i++) { const side = i % 4, t = (rnd() - 0.5) * 2 * (H - 1), e = H - 0.3; tuft(side < 2 ? t : (side === 2 ? -e : e), side < 2 ? (side === 0 ? -e : e) : t, 0.25 + rnd() * 0.3); }
  crates.forEach((b) => { if (rnd() < 0.7) tuft(b[0] + (rnd() - 0.5) * b[2], b[1] + (b[3] / 2 + 0.12) * (rnd() < 0.5 ? 1 : -1), 0.22 + rnd() * 0.25); });
  // remates del parapeto: banda de impermeabilización oscura, desagües y manchas de óxido
  const flashM = st({ color: 0x1d1f21, roughness: 0.9 }), scupM = new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 1 });
  for (const [x, z, w, d, nx, nz] of [[0, -H, 2 * H, 0.06, 0, 1], [0, H, 2 * H, 0.06, 0, -1], [-H, 0, 0.06, 2 * H, 1, 0], [H, 0, 0.06, 2 * H, -1, 0]]) {
    add(new THREE.BoxGeometry(w, 0.09, d), flashM, x + nx * 0.03, 0.045, z + nz * 0.03, false);
    for (const t of [-9, -3.5, 4, 10]) { const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.13), scupM); sc.position.set(nx ? x + nx * 0.005 : t, 0.13, nz ? z + nz * 0.005 : t); sc.rotation.y = nz > 0 ? 0 : nz < 0 ? Math.PI : nx > 0 ? Math.PI / 2 : -Math.PI / 2; group.add(sc);
      const rs = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.9), decalM(rustT(), { opacity: 0.55 })); rs.position.set(nx ? x + nx * 0.006 : t, 0.62, nz ? z + nz * 0.006 : t); rs.rotation.y = sc.rotation.y; group.add(rs); }
  }
  function rustT() { if (!rustT.t) rustT.t = tex(32, 128, 'rgba(0,0,0,0)', (x, w, h) => { x.clearRect(0, 0, w, h); const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(120,60,25,.8)'); g.addColorStop(1, 'rgba(120,60,25,0)'); x.fillStyle = g; x.fillRect(8, 0, 16, h); speck(x, w, h, 40, ['rgba(60,30,10,.4)'], 2); }); return rustT.t; }
  // antenas, parabólica y turbinas de ventilación sobre los volúmenes altos
  const spinners = [], dishM = st({ color: 0xd2d4d6, roughness: 0.4, metalness: 0.5 }), mastM = st({ color: 0x2b2e32, roughness: 0.5, metalness: 0.8 });
  crates.forEach((b) => {
    const [x, z, w, d, h, type] = b;
    if (type === 'stair') {
      const dish = add(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, 0.95), dishM, x - w * 0.22, h + 0.5, z - d * 0.15); dish.rotation.set(-1.0, 0.5, 0); dish.material.side = THREE.DoubleSide;
      add(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 6), mastM, x - w * 0.22, h + 0.28, z - d * 0.15);
      add(new THREE.CylinderGeometry(0.015, 0.02, 2.6, 6), mastM, x + w * 0.3, h + 1.4, z + d * 0.25);
      add(new THREE.BoxGeometry(0.6, 0.02, 0.02), mastM, x + w * 0.3, h + 2.3, z + d * 0.25); add(new THREE.BoxGeometry(0.45, 0.02, 0.02), mastM, x + w * 0.3, h + 1.8, z + d * 0.25);
    } else if (type === 'chim') {
      const tg = new THREE.Group(); tg.position.set(x, h + 0.12, z); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), dishM); tg.add(dome);
      for (let k = 0; k < 10; k++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.2), dishM); v.position.set(Math.cos(k * 0.628) * 0.27, 0.13, Math.sin(k * 0.628) * 0.27); v.rotation.y = -k * 0.628 + 0.6; tg.add(v); }
      tg.traverse((o) => { o.castShadow = true; }); group.add(tg); spinners.push(tg);
      add(new THREE.CylinderGeometry(0.15, 0.2, 0.5, 8), mastM, x + w * 0.2, h + 0.3, z - d * 0.2);
    }
  });

  // ---- Skyline iluminado por el sol: fachadas de colores, ventanas escasas, azoteas con depósitos y antenas ----
  const FAC = ['#56657a', '#8a5c4c', '#9a9078', '#6a727c'];
  const winT = (seed) => tex(128, 256, FAC[seed], (x, w, h) => {
    speck(x, w, h, 500, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.05)'], 4);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { const k = (r * 31 + c * 17 + seed * 7) % 9; if (k < 2) { x.fillStyle = '#f4f1e6'; x.fillRect(c * 32 + 7, r * 32 + 6, 18, 20); } else if (k < 4) { x.fillStyle = 'rgba(10,16,26,.4)'; x.fillRect(c * 32 + 7, r * 32 + 6, 18, 20); } }
  });
  const winMats = [0, 1, 2, 3].map((q) => { const t = winT(q); t.wrapS = t.wrapT = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0.08, envMapIntensity: 0.7 }); });
  const beaconM = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.2, 0.15), fog: false }); let tallest = 0, tallestPos = null;
  for (let a = 0; a < 34; a++) {
    const ang = (a / 34) * Math.PI * 2 + rnd() * 0.08, dist = 40 + rnd() * 24, w = 8 + rnd() * 10, d = 8 + rnd() * 10, h = 16 + rnd() * 46;
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 8, uv.getY(i) * h / 16);
    const bx = Math.cos(ang) * dist, bz = Math.sin(ang) * dist, by = h / 2 - 4, ry = rnd() * 1.5;
    const m = new THREE.Mesh(g, winMats[a % 4]); m.position.set(bx, by, bz); m.rotation.y = ry; group.add(m);
    const top = by + h / 2; // remate: cuerpo de máquinas, depósito de agua o antena
    const mech = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 2.2, d * 0.4), winMats[(a + 1) % 4]); mech.position.set(bx, top + 1.1, bz); mech.rotation.y = ry; group.add(mech);
    if (rnd() < 0.5) { const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.4, 12), mastM); tank.position.set(bx + w * 0.25, top + 1.2, bz - d * 0.2); group.add(tank); }
    if (rnd() < 0.6) { const an = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 7 + rnd() * 6, 5), mastM); an.position.set(bx - w * 0.2, top + 4, bz + d * 0.2); group.add(an); }
    if (h > tallest) { tallest = h; tallestPos = [bx, top + 2.4, bz]; }
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), beaconM); beacon.position.set(...tallestPos); group.add(beacon);

  // ---- Cielo: cúpula con degradado de atardecer, nubes y disco solar con halo (el horizonte está en el ecuador de la esfera) ----
  const skyT = tex(1024, 512, '#000', (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b4584'); g.addColorStop(0.2, '#4f6fb2'); g.addColorStop(0.36, '#9a9cc2'); g.addColorStop(0.44, '#e2a9a2'); g.addColorStop(0.485, '#f9c58a'); g.addColorStop(0.5, '#ffdca4'); g.addColorStop(0.52, '#8a6b70'); g.addColorStop(1, '#2a2833');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 110; i++) { // nubes: manchas alargadas con borde suave, más cálidas cerca del horizonte
      const cx = rnd() * w, cy = h * (0.12 + rnd() * 0.33), rw = 50 + rnd() * 130, rh = 7 + rnd() * 16, warm = (cy / h - 0.12) / 0.33;
      for (let k = 0; k < 6; k++) { const px = cx + (rnd() - 0.5) * rw, py = cy + (rnd() - 0.5) * rh * 0.6, gr = x.createRadialGradient(px, py, 0, px, py, rw * 0.5); gr.addColorStop(0, `rgba(${Math.round(150 + 105 * warm)},${Math.round(130 + 60 * warm)},${Math.round(160 - 20 * warm)},${0.12 + rnd() * 0.12})`); gr.addColorStop(1, 'rgba(255,200,160,0)'); x.save(); x.translate(px, py); x.scale(1, rh / rw * 1.6); x.translate(-px, -py); x.fillStyle = gr; x.beginPath(); x.arc(px, py, rw * 0.5, 0, 7); x.fill(); x.restore(); }
    }
  });
  const skyM = new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(76, 32, 20), skyM); sky.renderOrder = -2; group.add(sky);
  const glowT = tex(128, 128, 'rgba(0,0,0,0)', (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,235,1)'); g.addColorStop(0.12, 'rgba(255,225,160,.9)'); g.addColorStop(0.4, 'rgba(255,170,90,.35)'); g.addColorStop(1, 'rgba(255,140,70,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
  const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: new THREE.Color(2.4, 1.9, 1.3), blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sunSpr.scale.set(30, 30, 1); sunSpr.position.copy(SUN).multiplyScalar(70); sky.add(sunSpr);
  const envSky = () => new THREE.Mesh(sky.geometry, skyM); // malla gemela para generar el entorno de reflejos

  group.visible = false;
  // Animación ligera: turbinas girando, baliza roja parpadeando
  const update = (time) => { spinners.forEach((s, i) => { s.rotation.y = time * (1.6 + i * 0.3); }); beaconM.color.setRGB(5, 0.2, 0.15).multiplyScalar(Math.sin(time * 2.4) > 0.55 ? 1 : 0.08); };
  return { group, lamps, sky, sun, update, envSky };
}
