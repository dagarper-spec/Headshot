// Render de los drones: cuerpo oscuro, 4 rotores girando, cámara ventral y piloto LED (ámbar; rojo cuando te ve). Solo lee el estado.
import * as THREE from 'three';

export function createDrones(scene, n = 2) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.5, metalness: 0.6 }), mid = new THREE.MeshStandardMaterial({ color: 0x3b4148, roughness: 0.45, metalness: 0.7 });
  const bladeM = new THREE.MeshBasicMaterial({ color: 0x9aa0a8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const list = Array.from({ length: n }, () => {
    const g = new THREE.Group(), tilt = new THREE.Group(); g.add(tilt);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.26), dark); tilt.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.16), mid); top.position.y = 0.065; tilt.add(top);
    const cam = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mid); cam.position.set(0, -0.08, 0.07); tilt.add(cam);
    const ledM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.9, 0.1) }), led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), ledM); led.position.set(0, -0.09, 0.125); tilt.add(led);
    const rotors = [];
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.03), dark); arm.position.set(sx * 0.2, 0.0, sz * 0.15); arm.rotation.y = -sx * sz * 0.6; tilt.add(arm);
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8), mid); motor.position.set(sx * 0.33, 0.03, sz * 0.25); tilt.add(motor);
      const r = new THREE.Group(); r.position.set(sx * 0.33, 0.065, sz * 0.25);
      r.add(new THREE.Mesh(new THREE.CircleGeometry(0.17, 18).rotateX(-Math.PI / 2), bladeM));
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.008, 0.03), dark); r.add(bl); tilt.add(r); rotors.push(r);
    }
    g.scale.setScalar(1.8); g.visible = false; scene.add(g);
    return { g, tilt, ledM, rotors };
  });
  return {
    sync(S, time) {
      list.forEach((o, i) => {
        const d = S.drones[i]; if (!d || !d.on) { o.g.visible = false; return; }
        o.g.visible = true; o.g.position.set(d.x, d.y, d.z);
        if (d.alive) {
          o.rotors.forEach((r, k) => { r.rotation.y = time * 60 * (k % 2 ? 1 : -1); });
          o.tilt.rotation.set(Math.sin(time * 2 + i) * 0.04, 0, Math.min(0.25, d.tilt * 0.05) * Math.sin(time));
          o.g.rotation.y = Math.atan2(S.player.x - d.x, S.player.z - d.z); // la cámara mira al jugador
          o.ledM.color.setRGB(...(d.seen ? [4, 0.2, 0.1] : [1.8, 0.9, 0.1])); o.ledM.color.multiplyScalar(0.6 + 0.4 * Math.sin(time * (d.seen ? 14 : 4)));
        } else { o.tilt.rotation.set(d.tilt * 0.7, 0, d.tilt * 0.5); o.ledM.color.setRGB(0.1, 0.02, 0.02); }
      });
    },
  };
}
