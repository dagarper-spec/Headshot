// Modelos procedurales detallados: soldado articulado y pistola en primera persona.
// Cajas de bordes redondeados + cápsulas + cilindros cónicos con proporciones humanas reales (1.8 m).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { camoTexture, webbingTexture } from './view-textures.js';

const rb = (w, h, d, r = 0.03) => new RoundedBoxGeometry(w, h, d, 3, r);
const mat = (color, rough = 0.9, metal = 0, env = 0.3) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: env });

function put(parent, geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o;
}

// Pistola con el cañón hacia -Z. La usan el soldado (en la mano) y el jugador (en cámara).
export function buildPistol() {
  const g = new THREE.Group(), metal = mat(0x16181b, 0.3, 0.9, 0.6), poly = mat(0x23262b, 0.55, 0.1, 0.4);
  put(g, rb(0.03, 0.036, 0.2, 0.008), metal, 0, 0.02, -0.02);               // corredera
  put(g, new THREE.CylinderGeometry(0.009, 0.009, 0.05, 10).rotateX(Math.PI / 2), metal, 0, 0.02, -0.14); // boca
  put(g, rb(0.028, 0.026, 0.17, 0.008), poly, 0, -0.012, 0);                // armazón
  put(g, rb(0.03, 0.095, 0.045, 0.012), poly, 0, -0.07, 0.07).rotation.x = 0.22; // empuñadura
  put(g, rb(0.008, 0.03, 0.05, 0.003), poly, 0, -0.04, -0.03);              // guardamonte
  put(g, rb(0.008, 0.01, 0.01, 0.002), metal, 0, 0.044, -0.1);              // punto de mira
  put(g, rb(0.016, 0.01, 0.01, 0.002), metal, 0, 0.044, 0.07);              // alza
  return g;
}

// Pistola de primera persona con guante y manga.
export function buildViewPistol() {
  const g = new THREE.Group(), glove = mat(0x1a1a1a, 0.7), sleeve = mat(0x4b5340, 0.95);
  g.add(buildPistol());
  put(g, rb(0.06, 0.085, 0.085, 0.022), glove, 0.004, -0.075, 0.075);       // mano
  put(g, rb(0.02, 0.03, 0.06, 0.008), glove, -0.032, -0.03, 0.05).rotation.y = 0.3; // pulgar
  put(g, rb(0.075, 0.08, 0.4, 0.03), sleeve, 0.01, -0.1, 0.32).rotation.x = -0.18;   // antebrazo
  return g;
}

let TX; // texturas compartidas por todos los soldados
const tex = () => TX || (TX = { camo: camoTexture(), web: webbingTexture() });

// Soldado táctico. Devuelve un Group con userData = referencias a las articulaciones.
export function buildSoldier() {
  const t = tex();
  const fab = (o) => new THREE.MeshStandardMaterial({ roughness: 0.95, envMapIntensity: 0.25, bumpScale: 0.8, ...o });
  const M = {
    shirt: fab({ map: t.camo, bumpMap: t.camo }), pants: fab({ map: t.camo, bumpMap: t.camo, color: 0x9a9a8a }),
    vest: fab({ map: t.web, bumpMap: t.web, bumpScale: 1.5, roughness: 0.85 }),
    helm: fab({ map: t.camo, bumpMap: t.camo, color: 0xb8b8a8, roughness: 0.6 }),
    boot: mat(0x14120f, 0.45, 0.1), skin: mat(0xc99a7c, 0.55, 0, 0.2), gog: mat(0x0a1218, 0.08, 0.8, 1),
    glove: mat(0x1a1a1a, 0.7), mask: mat(0x1c1e20, 0.95), pad: mat(0x1d2023, 0.7), eye: mat(0xf2f0ea, 0.3),
    iris: mat(0x1b0f08, 0.2), brow: mat(0x2a1a10, 0.9), strap: mat(0x15171a, 0.8),
  };
  M.skin.emissive = new THREE.Color(0x140704); // piel algo cálida en sombra
  const g = new THREE.Group(), u = {}, flash = Object.values(M).filter((m) => m !== M.gog);
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 16);
  const ball = (r) => new THREE.SphereGeometry(r, 14, 10);

  const hips = new THREE.Group(); hips.position.y = 0.95; g.add(hips);
  put(hips, rb(0.34, 0.2, 0.22, 0.06), M.pants, 0, 0, 0);                      // pelvis
  put(hips, rb(0.355, 0.05, 0.235, 0.015), M.strap, 0, 0.1, 0);                // cinturón
  put(hips, rb(0.04, 0.03, 0.01, 0.004), M.gog, 0, 0.1, 0.12);                 // hebilla
  put(hips, rb(0.06, 0.14, 0.055, 0.015), M.pad, 0.2, -0.04, 0.02);            // funda
  put(hips, rb(0.05, 0.1, 0.04, 0.012), M.pad, -0.19, -0.02, 0.04);            // cartuchera

  const torso = new THREE.Group(); torso.position.y = 0.1; hips.add(torso);
  put(torso, new THREE.CylinderGeometry(0.15, 0.16, 0.26, 20), M.shirt, 0, 0.13, 0).scale.z = 0.72; // abdomen
  put(torso, new THREE.CylinderGeometry(0.2, 0.165, 0.32, 24), M.shirt, 0, 0.38, 0).scale.z = 0.7;  // pecho cónico
  put(torso, rb(0.385, 0.33, 0.25, 0.06), M.vest, 0, 0.37, 0);                  // chaleco
  for (const x of [-0.1, 0, 0.1]) put(torso, rb(0.08, 0.1, 0.05, 0.02), M.pad, x, 0.3, 0.15); // cargadores
  put(torso, rb(0.1, 0.07, 0.04, 0.015), M.pad, -0.1, 0.46, 0.14);             // bolsillo
  put(torso, rb(0.045, 0.1, 0.04, 0.012), M.pad, 0.15, 0.47, 0.13);            // radio
  put(torso, new THREE.CylinderGeometry(0.004, 0.004, 0.16, 5), M.strap, 0.17, 0.6, 0.12); // antena
  put(torso, rb(0.14, 0.17, 0.05, 0.02), M.pad, 0, 0.42, -0.14);               // placa trasera
  put(torso, new THREE.CylinderGeometry(0.055, 0.065, 0.1, 16), M.skin, 0, 0.58, 0); // cuello
  put(torso, new THREE.CylinderGeometry(0.07, 0.08, 0.04, 16), M.mask, 0, 0.55, 0);  // cuello de tela
  for (const s of [-1, 1]) { // hombros
    put(torso, ball(0.07), M.shirt, s * 0.215, 0.5, 0);
    put(torso, rb(0.12, 0.05, 0.14, 0.02), M.vest, s * 0.2, 0.55, 0);
  }

  const head = new THREE.Group(); head.position.y = 0.71; torso.add(head);
  put(head, new THREE.SphereGeometry(0.105, 28, 22), M.skin, 0, 0, 0).scale.set(0.88, 1.12, 1.02);
  put(head, new THREE.SphereGeometry(0.02, 10, 8), M.skin, 0, -0.012, 0.105).scale.set(0.8, 1.1, 1.2); // nariz
  put(head, rb(0.17, 0.07, 0.085, 0.03), M.mask, 0, -0.058, 0.05);              // pasamontañas
  for (const s of [-1, 1]) {
    put(head, ball(0.015), M.eye, s * 0.04, 0.02, 0.092).scale.set(1, 0.7, 0.6);  // ojos
    put(head, ball(0.008), M.iris, s * 0.04, 0.02, 0.099);
    put(head, rb(0.045, 0.01, 0.015, 0.004), M.brow, s * 0.04, 0.05, 0.093).rotation.z = -s * 0.18; // cejas
    put(head, ball(0.02), M.skin, s * 0.097, -0.005, 0).scale.set(0.5, 1.3, 1);   // orejas
  }
  const helmet = new THREE.Group(); head.add(helmet); u.helmet = helmet;
  put(helmet, new THREE.SphereGeometry(0.135, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.56), M.helm, 0, 0.02, 0.005).scale.set(1, 0.95, 1.1);
  put(helmet, rb(0.2, 0.02, 0.06, 0.008), M.helm, 0, 0.075, 0.115);             // visera
  put(helmet, new THREE.TorusGeometry(0.133, 0.006, 6, 28).rotateX(Math.PI / 2), M.strap, 0, 0.05, 0.005); // cinta
  put(helmet, rb(0.2, 0.05, 0.05, 0.02), M.gog, 0, 0.095, 0.1).rotation.x = -0.35; // gafas subidas al casco
  put(helmet, rb(0.05, 0.04, 0.04, 0.01), M.pad, 0, 0.135, 0.07);                // soporte NVG

  const arm = (s) => { // brazo: hombro -> codo -> mano con dedos
    const sh = new THREE.Group(); sh.position.set(s * 0.225, 0.5, 0); torso.add(sh);
    put(sh, cap(0.055, 0.24), M.shirt, 0, -0.175, 0);
    const el = new THREE.Group(); el.position.y = -0.35; sh.add(el);
    put(el, ball(0.052), M.shirt, 0, 0, 0);                                      // codo
    put(el, rb(0.1, 0.07, 0.1, 0.03), M.pad, 0, 0.0, -0.01);                     // codera
    put(el, cap(0.045, 0.2), M.shirt, 0, -0.145, 0);
    put(el, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), M.strap, 0, -0.27, 0); // puño
    const hand = new THREE.Group(); hand.position.set(0, -0.32, 0.01); el.add(hand);
    put(hand, rb(0.07, 0.04, 0.09, 0.015), M.glove, 0, 0, 0);                    // palma
    for (let k = 0; k < 4; k++) put(hand, rb(0.014, 0.014, 0.055, 0.005), M.glove, -0.027 + k * 0.018, -0.025, 0.03); // dedos
    put(hand, rb(0.016, 0.016, 0.05, 0.005), M.glove, s * 0.04, -0.005, 0.03).rotation.y = -s * 0.5; // pulgar
    return { sh, el };
  };
  const aR = arm(1), aL = arm(-1);
  const gun = buildPistol(); gun.position.set(0, -0.33, 0.045); gun.rotation.x = -Math.PI / 2; aR.el.add(gun);

  const leg = (s) => { // pierna: cadera -> rodilla -> pie
    const th = new THREE.Group(); th.position.set(s * 0.1, -0.06, 0); hips.add(th);
    put(th, ball(0.08), M.pants, 0, 0, 0);                                       // cadera
    put(th, new THREE.CylinderGeometry(0.078, 0.06, 0.45, 18), M.pants, 0, -0.225, 0);
    const kn = new THREE.Group(); kn.position.y = -0.45; th.add(kn);
    put(kn, ball(0.06), M.pants, 0, 0, 0);                                       // rodilla
    put(kn, rb(0.11, 0.1, 0.07, 0.035), M.pad, 0, 0, 0.05);                      // rodillera
    put(kn, new THREE.CylinderGeometry(0.06, 0.046, 0.4, 18), M.pants, 0, -0.2, 0);
    const boot = new THREE.Group(); boot.position.y = -0.41; kn.add(boot);
    put(boot, new THREE.CylinderGeometry(0.062, 0.058, 0.1, 14), M.boot, 0, 0.04, 0); // caña de la bota
    put(boot, rb(0.1, 0.08, 0.27, 0.035), M.boot, 0, -0.01, 0.06);
    put(boot, rb(0.1, 0.05, 0.08, 0.02), M.pad, 0, -0.005, 0.15);                // puntera
    put(boot, rb(0.105, 0.03, 0.28, 0.012), M.strap, 0, -0.05, 0.06);            // suela
    return { th, kn, boot };
  };
  const lR = leg(1), lL = leg(-1);

  Object.assign(u, { hips, torso, head, aR, aL, lR, lL, flash });
  g.userData = u;
  return g;
}

// Pose procedural. o = { ph: fase de paso, crouch 0..1, aim 0..1, move 0..1, flinch 0..1 }
export function poseSoldier(u, o) {
  const c = o.crouch, a = o.aim, sw = Math.sin(o.ph) * o.move;
  u.hips.position.y = 0.95 - c * 0.43 + Math.abs(Math.sin(o.ph)) * 0.02 * o.move;
  u.torso.rotation.x = 0.06 + c * 0.3 - o.flinch * 0.35;
  u.head.rotation.x = -u.torso.rotation.x * 0.8;
  const k = 1 - c * 0.5;
  u.lR.th.rotation.x = -c * 1.3 + sw * 0.75 * k; u.lL.th.rotation.x = -c * 1.3 - sw * 0.75 * k;
  u.lR.kn.rotation.x = c * 2.0 + Math.max(0, -sw) * 1.0; u.lL.kn.rotation.x = c * 2.0 + Math.max(0, sw) * 1.0;
  for (const l of [u.lR, u.lL]) l.boot.rotation.x = -(l.th.rotation.x + l.kn.rotation.x); // pie plano
  // brazos: pistola en posición baja -> extendida con las dos manos al apuntar
  const up = -0.5 - a * 0.95 - o.flinch * 0.5, fo = -1.0 + a * 0.9;
  u.aR.sh.rotation.set(up + sw * 0.15 * (1 - a), 0, -0.06 + a * 0.05); u.aR.el.rotation.x = fo;
  u.aL.sh.rotation.set(up - sw * 0.15 * (1 - a), 0, 0.06 - a * 0.3); u.aL.el.rotation.x = fo - a * 0.05;
}
