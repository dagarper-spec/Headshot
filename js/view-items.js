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

export function createItems(scene, nGren = 4, nMine = 6) {
  // granadas + marca roja en el suelo
  const gm = std(0x3c4a2e, 0.6, 0.4), gg = new THREE.SphereGeometry(0.07, 10, 8);
  const ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.1), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const ringG = new THREE.RingGeometry(2.9, 3.2, 40).rotateX(-Math.PI / 2), discG = new THREE.CircleGeometry(3.2, 40).rotateX(-Math.PI / 2);
  const discM = new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const gren = Array.from({ length: nGren }, () => {
    const g = new THREE.Group(), b = new THREE.Mesh(gg, gm); b.scale.set(1, 1.25, 1); g.add(b);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 6), std(0x999999)); cap.position.y = 0.1; g.add(cap);
    const ring = new THREE.Mesh(ringG, ringM), disc = new THREE.Mesh(discG, discM); ring.position.y = disc.position.y = 0.03;
    g.visible = ring.visible = disc.visible = false; scene.add(g, ring, disc); return { g, ring, disc };
  });
  // minas: disco con LED rojo parpadeante (HDR => bloom)
  const mineBody = new THREE.CylinderGeometry(0.22, 0.25, 0.07, 14), ledM = [], mines = Array.from({ length: nMine }, () => {
    const g = new THREE.Group(); g.add(new THREE.Mesh(mineBody, std(0x2d3128, 0.7, 0.4)));
    const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.3, 0.2) }); ledM.push(lm);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), lm); led.position.y = 0.05; g.add(led);
    g.visible = false; scene.add(g); return g;
  });
  // baúl: caja de madera con herrajes y filo dorado brillante
  const chest = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.5), std(0x3b2a1a, 1, 0)); base.position.y = 0.2; chest.add(base);
  const lid = new THREE.Group(); lid.position.set(0, 0.4, -0.25);
  const lidM = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.52), std(0x45311f, 1, 0)); lidM.position.set(0, 0.08, 0.25); lid.add(lidM); chest.add(lid);
  const trimM = new THREE.MeshStandardMaterial({ color: 0x4a4540, emissive: 0xc87a28, emissiveIntensity: 0.3, metalness: 0.5, roughness: 0.85 });
  for (const x of [-0.3, 0.3]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.54), trimM); s.position.set(x, 0.21, 0); chest.add(s); }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.04), trimM); lock.position.set(0, 0.36, 0.27); chest.add(lock);
  chest.traverse((o) => { o.castShadow = true; }); chest.visible = false; scene.add(chest);
  // radar: marcadores rojos visibles a través de paredes
  const radM = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.2), depthTest: false, transparent: true });
  const radar = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), radM); m.renderOrder = 999; m.visible = false; scene.add(m); return m; });

  return {
    sync(S, time) {
      gren.forEach((o, i) => {
        const g = S.gren[i], on = g.on; o.g.visible = on; o.ring.visible = o.disc.visible = on;
        if (!on) return;
        o.g.position.set(g.x, g.y, g.z); o.g.rotation.x = time * 8;
        o.ring.position.set(g.tx, 0.03, g.tz); o.disc.position.set(g.tx, 0.025, g.tz);
        const k = 0.9 + 0.1 * Math.sin(time * 18); o.ring.scale.set(k, 1, k); // late más rápido al final
        ringM.opacity = 0.5 + 0.4 * Math.sin(time * (g.t > g.T ? 28 : 10));
      });
      mines.forEach((m, i) => { const x = S.mines[i]; m.visible = x.on; if (x.on) m.position.set(x.x, 0.035, x.z); });
      const blink = Math.sin(time * 9) > 0 ? 1 : 0.15; ledM.forEach((l) => l.color.setRGB(5 * blink, 0.3 * blink, 0.2 * blink));
      const c = S.chest; chest.visible = !!c;
      if (c) { chest.position.set(c.x, 0, c.z); chest.rotation.y = Math.atan2(-c.x, -c.z); lid.rotation.x += ((c.open ? -1.2 : 0) - lid.rotation.x) * 0.15; trimM.emissiveIntensity = c.open ? 0.05 : 0.35 + 0.25 * Math.sin(time * 3); }
      radar.forEach((m, i) => { const e = S.enemies[i], on = S.radarT > 0 && e && e.active && e.alive; m.visible = on; if (on) { m.position.set(e.x, 2.35, e.z); m.rotation.y = time * 3; } });
    },
  };
}
