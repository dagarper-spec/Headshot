// Elementos de juego visibles: granadas (con marca de impacto), minas, baúl, radar y escudos. Solo LEEN el estado.
import * as THREE from 'three';

const std = (color, rough = 0.6, metal = 0.5, emi = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: emi ? color : 0x000000, emissiveIntensity: emi });

export function buildShield() { // escudo antidisturbios: placa oscura con visor y marco
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.0, 0.05), std(0x2b3036, 0.5, 0.7)); g.add(plate);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.06, 0.03), std(0x15181b, 0.6, 0.6)); frame.position.z = -0.02; g.add(frame);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), new THREE.MeshStandardMaterial({ color: 0x0a1218, roughness: 0.1, metalness: 0.9 })); win.position.y = 0.3; g.add(win);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.06), std(0xc9a227, 0.7, 0.3)); bar.position.y = -0.1; g.add(bar);
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

export function createItems(scene, nGren = 4, nMine = 6, camera) {
  const camQ = camera ? camera.quaternion : new THREE.Quaternion();
  // granadas + marca roja en el suelo
  // Granada de mano tipo piña: cuerpo con gajos (textura), cuello metálico y cuchara; gira en el aire y deja una estela de humo.
  const gTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#4c5a36'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#1d2412'; x.lineWidth = 4;
    for (let i = 0; i <= 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
    for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '20,24,10' : '120,130,90'},.12)`; x.fillRect(Math.random() * 128, Math.random() * 128, 3, 3); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const gm = new THREE.MeshStandardMaterial({ map: gTex, bumpMap: gTex, bumpScale: 2, roughness: 0.55, metalness: 0.35 }), gg = new THREE.SphereGeometry(0.045, 14, 12), metal = std(0x8a8d90, 0.4, 0.9);
  const ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.1), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const ringG = new THREE.RingGeometry(3.05, 3.2, 48).rotateX(-Math.PI / 2), discG = new THREE.CircleGeometry(3.2, 40).rotateX(-Math.PI / 2);
  const discM = new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
  const puffM = new THREE.MeshBasicMaterial({ color: 0xb8b8b0, transparent: true, opacity: 0, depthWrite: false });
  const puffG = new THREE.PlaneGeometry(1, 1);
  const gren = Array.from({ length: nGren }, () => {
    const g = new THREE.Group(), body = new THREE.Group(), b = new THREE.Mesh(gg, gm); b.scale.set(1, 1.3, 1); body.add(b);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.03, 8), metal); neck.position.y = 0.062; body.add(neck);
    const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.085, 0.02), metal); spoon.position.set(0.03, 0.03, 0); spoon.rotation.z = -0.25; body.add(spoon);
    body.scale.setScalar(1.5); g.add(body);
    const ring = new THREE.Mesh(ringG, ringM), disc = new THREE.Mesh(discG, discM); ring.position.y = disc.position.y = 0.03;
    const puffs = Array.from({ length: 10 }, () => { const p = new THREE.Mesh(puffG, puffM.clone()); p.visible = false; scene.add(p); return { m: p, t: 9, pos: new THREE.Vector3() }; });
    g.visible = ring.visible = disc.visible = false; scene.add(g, ring, disc); return { g, body, ring, disc, puffs, pi: 0, pt: 0 };
  });
  // minas: disco con LED rojo parpadeante (HDR => bloom)
  const mineBody = new THREE.CylinderGeometry(0.22, 0.25, 0.07, 14), ledM = [], mines = Array.from({ length: nMine }, () => {
    const g = new THREE.Group(); g.add(new THREE.Mesh(mineBody, std(0x2d3128, 0.7, 0.4)));
    const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.3, 0.2) }); ledM.push(lm);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), lm); led.position.y = 0.05; g.add(led);
    g.visible = false; scene.add(g); return g;
  });
  // baúl: caja de madera desgastada con herrajes viejos; el dorado (plano) tiene herrajes de latón que brillan
  const mkChest = (trim, glow) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.5), std(0x3b2a1a, 1, 0)); base.position.y = 0.2; g.add(base);
    const lid = new THREE.Group(); lid.position.set(0, 0.4, -0.25);
    const lidM = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.52), std(0x45311f, 1, 0)); lidM.position.set(0, 0.08, 0.25); lid.add(lidM); g.add(lid);
    const trimM = new THREE.MeshStandardMaterial(trim);
    for (const x of [-0.3, 0.3]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.54), trimM); s.position.set(x, 0.21, 0); g.add(s); }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.04), trimM); lock.position.set(0, 0.36, 0.27); g.add(lock);
    g.traverse((o) => { o.castShadow = true; }); g.visible = false; scene.add(g);
    return { g, lid, trimM, glow };
  };
  const chests = { norm: mkChest({ color: 0x4a4540, emissive: 0xc87a28, emissiveIntensity: 0.3, metalness: 0.5, roughness: 0.85 }, 0.3), gold: mkChest({ color: 0xb8902a, emissive: 0xffb000, emissiveIntensity: 1.4, metalness: 0.9, roughness: 0.35 }, 1.4) };
  // radar: marcadores rojos visibles a través de paredes
  const radM = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.2), depthTest: false, transparent: true });
  const radar = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), radM); m.renderOrder = 999; m.visible = false; scene.add(m); return m; });

  return {
    sync(S, time) {
      gren.forEach((o, i) => {
        const g = S.gren[i], on = g.on; o.g.visible = on; o.ring.visible = o.disc.visible = on && !g.own;
        if (!on) return;
        o.g.position.set(g.x, g.y, g.z); o.body.rotation.set(time * 9, time * 3, time * 6);
        o.pt -= 0.016; if (o.pt <= 0 && g.t < g.T) { o.pt = 0.04; const p = o.puffs[o.pi++ % o.puffs.length]; p.t = 0; p.pos.set(g.x, g.y, g.z); p.m.visible = true; }
        o.ring.position.set(g.tx, 0.03, g.tz); o.disc.position.set(g.tx, 0.025, g.tz);
        const k = 0.9 + 0.1 * Math.sin(time * 18); o.ring.scale.set(k, 1, k); // late más rápido al final
        ringM.opacity = 0.5 + 0.4 * Math.sin(time * (g.t > g.T ? 28 : 10));
      });
      gren.forEach((o) => o.puffs.forEach((p) => { if (!p.m.visible) return; p.t += 0.016; const k = p.t / 0.7; if (k >= 1) { p.m.visible = false; return; }
        p.m.position.copy(p.pos); p.m.position.y += k * 0.2; p.m.scale.setScalar(0.08 + 0.3 * k); p.m.material.opacity = 0.35 * (1 - k); p.m.quaternion.copy(camQ); }));
      mines.forEach((m, i) => { const x = S.mines[i]; m.visible = x.on; if (x.on) m.position.set(x.x, 0.035, x.z); });
      const blink = Math.sin(time * 9) > 0 ? 1 : 0.15; ledM.forEach((l) => l.color.setRGB(5 * blink, 0.3 * blink, 0.2 * blink));
      for (const [k, c] of [['norm', S.chest], ['gold', S.gold]]) {
        const h = chests[k]; h.g.visible = !!c; if (!c) continue;
        h.g.position.set(c.x, 0, c.z); h.g.rotation.y = Math.atan2(-c.x, -c.z); h.lid.rotation.x += ((c.open ? -1.2 : 0) - h.lid.rotation.x) * 0.15;
        h.trimM.emissiveIntensity = c.open ? 0.05 : h.glow * (0.7 + 0.35 * Math.sin(time * 3));
      }
      radar.forEach((m, i) => { const e = S.enemies[i], on = S.radarT > 0 && e && e.active && e.alive; m.visible = on; if (on) { m.position.set(e.x, 2.35, e.z); m.rotation.y = time * 3; } });
    },
  };
}
