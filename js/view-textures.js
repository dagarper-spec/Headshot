// Texturas procedurales PBR (color + relieve + rugosidad) generadas con canvas.
// Sustituibles por texturas de Poly Haven (CC0) cambiando los mapas de cada material.
import * as THREE from 'three';

const rnd = Math.random;

function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function grain(g, s, amt) { // ruido fino por píxel
  const d = g.getImageData(0, 0, s, s), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const n = (rnd() - 0.5) * amt;
    p[i] += n; p[i + 1] += n; p[i + 2] += n;
  }
  g.putImageData(d, 0, 0);
}

function blots(g, s, n, col, r0, r1) { // manchas suaves (óxido, humedad, aceite)
  for (let i = 0; i < n; i++) {
    const x = rnd() * s, y = rnd() * s, r = r0 + rnd() * (r1 - r0);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function concrete(g, s) {
  g.fillStyle = '#6a6a66'; g.fillRect(0, 0, s, s);
  blots(g, s, 30, 'rgba(30,30,30,.35)', s * 0.05, s * 0.2);
  blots(g, s, 20, 'rgba(150,150,140,.25)', s * 0.05, s * 0.15);
  g.strokeStyle = 'rgba(20,20,20,.55)'; g.lineWidth = Math.max(2, s / 128); // juntas de dilatación
  g.strokeRect(0, 0, s, s);
  g.lineWidth = 1;
  for (let i = 0; i < 6; i++) { // grietas
    g.beginPath(); let x = rnd() * s, y = rnd() * s; g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (rnd() - 0.5) * s * 0.12; y += (rnd() - 0.2) * s * 0.1; g.lineTo(x, y); }
    g.stroke();
  }
  grain(g, s, 38);
}

function corrugated(g, s) {
  const w = s / 32;
  for (let x = 0; x < s; x += w) { // chapa ondulada
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, '#3d4247'); gr.addColorStop(0.5, '#6c737a'); gr.addColorStop(1, '#3a3f44');
    g.fillStyle = gr; g.fillRect(x, 0, w, s);
  }
  blots(g, s, 26, 'rgba(120,60,20,.5)', s * 0.03, s * 0.14); // óxido
  blots(g, s, 14, 'rgba(10,10,10,.45)', s * 0.04, s * 0.16);
  g.fillStyle = 'rgba(0,0,0,.5)';
  g.fillRect(0, 0, s, 3); g.fillRect(0, s / 2, s, 3);
  grain(g, s, 30);
}

function wood(g, s) {
  g.fillStyle = '#7d5a37'; g.fillRect(0, 0, s, s);
  const n = 6, h = s / n;
  for (let i = 0; i < n; i++) { // tablones
    g.fillStyle = `rgba(${40 + rnd() * 40},${20 + rnd() * 20},0,.35)`; g.fillRect(0, i * h, s, h);
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, i * h, s, 2);
    for (let k = 0; k < 14; k++) { // vetas
      g.strokeStyle = 'rgba(40,22,8,.35)'; g.beginPath();
      const y = i * h + rnd() * h; g.moveTo(0, y); g.lineTo(s, y + (rnd() - 0.5) * 6); g.stroke();
    }
  }
  g.strokeStyle = '#3c2a18'; g.lineWidth = s / 14; g.strokeRect(0, 0, s, s); // marco
  g.lineWidth = s / 24; g.beginPath(); g.moveTo(0, 0); g.lineTo(s, s); g.stroke();
  grain(g, s, 30);
}

function roughMap(g, s) { // gris alto = rugoso; manchas oscuras = zonas satinadas
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, s, s);
  blots(g, s, 14, 'rgba(70,70,70,.8)', s * 0.06, s * 0.22);
  grain(g, s, 40);
}

export function makeMaterials(size) {
  const std = (o) => new THREE.MeshStandardMaterial({ envMapIntensity: 0.3, ...o });
  const conc = canvasTex(size, concrete), metal = canvasTex(size, corrugated), box = canvasTex(size, wood);
  const rough = canvasTex(size, roughMap, false);
  return {
    floor: std({ map: conc, bumpMap: conc, bumpScale: 1.5, roughnessMap: rough, roughness: 1, metalness: 0.05 }),
    pillar: std({ map: conc, bumpMap: conc, bumpScale: 1.2, roughness: 0.9, color: 0xb0b0b0 }),
    wall: std({ map: metal, bumpMap: metal, bumpScale: 2.5, roughness: 0.65, metalness: 0.6 }),
    ceil: std({ map: metal, bumpMap: metal, bumpScale: 2, roughness: 0.8, metalness: 0.4, color: 0x888888 }),
    crate: std({ map: box, bumpMap: box, bumpScale: 2, roughness: 0.85 }),
    beam: std({ color: 0x24272b, roughness: 0.5, metalness: 0.85 }),
  };
}

// Escala las UV de una geometría para repetir la textura.
export function uvs(geo, u, v) {
  const a = geo.attributes.uv;
  for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * u, a.getY(i) * v);
  return geo;
}
