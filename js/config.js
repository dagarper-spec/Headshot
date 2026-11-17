// Configuración global: constantes de juego, mapa, niveles y calidad.
export const CFG = {
  half: 14,          // la arena mide 28x28 m
  height: 7.5,
  eye: 1.7,         // altura de los ojos de pie
  eyeCrouch: 1.1,   // ... y agachado
  pool: 3,           // Object Pool de enemigos (máximo por nivel)
  player: { speed: 5, radius: 0.4, hp: 2, sens: 0.0022 }, // 2 vidas: cuerpo = -1, cabeza = muerte
  weapon: { rate: 0.24, mag: 6, reload: 1.5, range: 60, kind: 'pistol' }, // pistola semiautomática de 6 balas
  // walk/run = velocidades (m/s) que coinciden con las animaciones Mixamo de caminar y correr
  enemy: { speed: 3.4, walk: 1.8, run: 4.6, r: 0.3, h: 1.8, hAim: 1.62, hCrouch: 1.38 },
  // Obstáculos [x, z, ancho, fondo, alto, tipo]. Alto == height -> pilar de hormigón.
  // tipo: 'c1' contenedor largo (6,1 m), 'c3' caja de madera, 'shelf' estantería, 'barrel' barriles; sin tipo -> pilar.
  crates: [
    [-6, -5, 6.1, 2.43, 2.64, 'c1'], [7.5, -4, 2.43, 6.1, 2.64, 'c1'],
    [0, -0.5, 1.8, 1.8, 1.8, 'c3'], [-4.5, 8.5, 1.6, 1.6, 1.6, 'c3'], [10, 6, 1.8, 1.8, 1.8, 'c3'],
    [-11, -1.5, 1.6, 1.6, 1.6, 'c3'], [3.5, -9, 1.6, 1.6, 1.6, 'c3'], [-7.5, 3, 1.4, 1.4, 1.4, 'c3'],
    // estanterías contra las paredes y grupos de barriles (procedurales)
    [-3.5, -13.55, 4, 0.8, 2.6, 'shelf'], [4.5, -13.55, 4, 0.8, 2.6, 'shelf'], [13.55, 2, 0.8, 4, 2.6, 'shelf'],
    [-13.55, 9, 0.8, 4, 2.6, 'shelf'], [-6, 13.55, 4, 0.8, 2.6, 'shelf'],
    [-12.3, -6.5, 1.3, 1.3, 1.0, 'barrel'], [12.2, -11.2, 1.3, 1.3, 1.0, 'barrel'], [12.2, 11.5, 1.3, 1.3, 1.0, 'barrel'], [-12.2, 12.2, 1.3, 1.3, 1.0, 'barrel'],
    [-9, -9, 1, 1, 7.5], [9, -9, 1, 1, 7.5], [-9, 9, 1, 1, 7.5], [9, 9, 1, 1, 7.5],
  ],
  // (los obstáculos de cada zona están en ZONES; setZone() los vuelca en CFG.crates, que usan colisiones, IA y render)
  // Modelos .glb opcionales. Si el archivo no existe se usa el soldado procedural.
  models: { enemy: 'assets/models/enemy.glb', dir: 'assets/models/' },
};

// Zonas: cada una con su lista de obstáculos [x, z, ancho, fondo, alto, tipo] y altura de techo (la azotea no tiene).
// Tipos de la azotea: 'stair' caseta de escalera, 'ac' aire acondicionado, 'vent' conducto, 'wall' muro bajo (1,2 m: agachado te cubre), 'chim' chimenea.
export const ZONES = [
  { name: 'Almacén', height: 7.5, crates: CFG.crates.map((b) => b.slice()) },
  { name: 'Azotea', height: 40, crates: [
    [-9.5, -10.5, 3.2, 3.2, 3.2, 'stair'], [11.5, -2, 2.6, 2.6, 3.2, 'stair'],
    [5, -3.5, 2.6, 1.3, 1.4, 'ac'], [-5.5, -2, 2.6, 1.3, 1.4, 'ac'], [12, -9.5, 1.3, 2.6, 1.4, 'ac'], [-12, 3.5, 1.3, 2.6, 1.4, 'ac'],
    [-2, -11, 5, 1.1, 1.3, 'vent'], [-11, -4.5, 1.1, 5, 1.3, 'vent'],
    [0, -6.5, 5, 0.45, 1.2, 'wall'], [-6, 6, 0.45, 4, 1.2, 'wall'], [7, 5, 4, 0.45, 1.2, 'wall'], [3.5, -9.5, 0.45, 3, 1.2, 'wall'],
    [8, -7.5, 1.5, 1.5, 4, 'chim'],
  ] },
];
export function setZone(z) {
  CFG.zone = z; CFG.height = ZONES[z].height;
  CFG.crates.length = 0; CFG.crates.push(...ZONES[z].crates.map((b) => b.slice()));
}

// msaa = muestras del antialiasing por hardware en el EffectComposer.
export const QUALITY = {
  low:    { scale: 0.65, maxDpr: 1,   shadow: 0,    bloom: false, fxaa: false, msaa: 0, lights: 2, spots: 0, tex: 256 },
  medium: { scale: 0.85, maxDpr: 1.5, shadow: 1024, bloom: true,  fxaa: true,  msaa: 0, lights: 3, spots: 1, tex: 256 },
  high:   { scale: 1,    maxDpr: 2,   shadow: 2048, bloom: true,  fxaa: true,  msaa: 4, lights: 4, spots: 2, tex: 512 },
};
export const TIERS = ['low', 'medium', 'high'];

// Niveles: un solo soldado por nivel (el casco aguanta 1 tiro a la cabeza).
// aim = segundos que apunta antes de disparar (con aviso rojo), react = reacción al verte,
// acc = precisión base, burst = probabilidad de disparar 2 veces seguidas, hide = [mín, máx] segundos escondido.
export const LEVELS = [
  { zone: 0, name: 'Primer duelo',   par: 20, pay: 200, goal: 'norel', goalText: 'Sin recargar',
    enemies: [{ x: -9, z: -11, helmet: false }], aim: 1.3, react: 0.8, acc: 0.25, burst: 0, hide: [2.4, 4.2], chest: [12.6, -7.5] },
  { zone: 0, gold: [-13, -13], name: 'Casco de acero', par: 25, pay: 250, goal: 'head', goalText: 'Acierta un headshot',
    enemies: [{ x: 9, z: -11, helmet: true, role: 'flank', vest: true, tint: 0x6f86a8 }], aim: 1.15, react: 0.65, acc: 0.28, burst: 0.1, hide: [2.2, 3.8], chest: [-12.7, 4.2] },
  { zone: 0, name: 'Escudo y fuego', par: 35, pay: 300, goal: 'nodmg', goalText: 'Sin recibir daño',
    enemies: [{ x: -9, z: -11, role: 'shield', shield: true, tint: 0xb07a68 }, { x: 10, z: -10, role: 'grenadier', helmet: true }], aim: 1.15, react: 0.65, acc: 0.28, burst: 0.1, hide: [2.0, 3.5], chest: [12.6, 8] },
  { zone: 0, name: 'El Capataz',     par: 60, pay: 600, goal: 'nodmg', goalText: 'Sin perder ninguna vida', boss: true,
    enemies: [{ x: 0, z: -11, helmet: true, role: 'flank', boss: true, tint: 0x5a5d62 }], aim: 1.0, react: 0.55, acc: 0.3, burst: 0.2, hide: [1.8, 3.2], chest: [-12.7, -11.5] },
  // ---- Zona 2: azotea ----
  { zone: 1, name: 'Guardia nocturna', par: 30, pay: 350, goal: 'head', goalText: 'Acierta un headshot',
    enemies: [{ x: 8, z: -11, helmet: false }, { x: -5.5, z: -8.5, helmet: false, tint: 0x6a7f5a }], aim: 1.2, react: 0.7, acc: 0.27, burst: 0.1, hide: [2.2, 3.8], chest: [13.0, 8.5] },
  { zone: 1, name: 'Ojo en el cielo', par: 40, pay: 400, goal: 'drone', goalText: 'Derriba el dron en 12 s', drones: [{ x: 0, z: -2 }],
    enemies: [{ x: 10.5, z: -10.5, helmet: false, role: 'flank', tint: 0x5a5d62 }], aim: 1.15, react: 0.65, acc: 0.27, burst: 0.1, hide: [2.2, 3.6], chest: [-13, -10] },
  { zone: 1, name: 'Francotirador', par: 45, pay: 450, goal: 'nodmg', goalText: 'Sin recibir daño', snipeAim: 2.4,
    enemies: [{ x: 4, z: -12.5, role: 'sniper', tint: 0x4a5a3a }, { x: 8.5, z: -3, role: 'flank', tint: 0x9a8a62 }], aim: 1.1, react: 0.6, acc: 0.27, burst: 0.1, hide: [2.2, 3.6], chest: [-13, 11.5] },
  { zone: 1, name: 'Jefe de Seguridad', par: 75, pay: 800, goal: 'nodmg', goalText: 'Sin perder ninguna vida', boss: true, snipeAim: 2.8,
    drones: [{ x: -4, z: -4 }, { x: 4, z: -5 }],
    enemies: [{ x: 0, z: -11.5, boss: true, seg: true, vest: true, role: 'flank', tint: 0x2e3238 }, { x: 4, z: -12.5, later: true, role: 'sniper', tint: 0x4a5a3a }], aim: 0.95, react: 0.5, acc: 0.3, burst: 0.2, hide: [1.6, 3], chest: [13, -13] },
];
