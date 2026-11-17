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
  // Luz de luna fría, sin sombras
  const moon = new THREE.DirectionalLight(0x6f86c0, 0.55); moon.position.set(-18, 30, -22); group.add(moon);

  // ---- Skyline: edificios con ventanas encendidas ----
  const winT = (seed) => tex(128, 256, '#0d1118', (x, w, h) => {
    for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) { const on = ((r * 31 + c * 17 + seed * 7) % 10) < 3; x.fillStyle = on ? (((r + c + seed) % 3) ? '#e8bd6a' : '#9fc6e6') : '#16202c'; x.fillRect(c * 16 + 3, r * 16 + 3, 10, 9); }
  });
  const winMats = [0, 1, 2, 3].map((s) => { const t = winT(s); t.wrapS = t.wrapT = THREE.RepeatWrapping; return new THREE.MeshBasicMaterial({ map: t, color: 0x8c8c9c }); });
  let seedv = 7; const rnd = () => (seedv = (seedv * 16807) % 2147483647) / 2147483647;
  for (let a = 0; a < 34; a++) {
    const ang = (a / 34) * Math.PI * 2 + rnd() * 0.08, dist = 40 + rnd() * 24, w = 8 + rnd() * 10, d = 8 + rnd() * 10, h = 16 + rnd() * 46;
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 8, uv.getY(i) * h / 16);
    const m = new THREE.Mesh(g, winMats[a % 4]); m.position.set(Math.cos(ang) * dist, h / 2 - 4, Math.sin(ang) * dist); m.rotation.y = rnd() * 1.5; group.add(m);
  }
  // Cielo: cúpula con degradado crepuscular y luna
  const skyT = tex(8, 256, '#000', (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#080c22'); g.addColorStop(0.55, '#2a2850'); g.addColorStop(0.8, '#8a4a5a'); g.addColorStop(0.92, '#e08a50'); g.addColorStop(1, '#f0b070'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(76, 24, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -2; group.add(sky);
  const moonM = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.0), fog: false })); moonM.position.set(-40, 42, -50); moonM.lookAt(0, 0, 0); group.add(moonM);

  group.visible = false;
  return { group, lamps, sky };
}
