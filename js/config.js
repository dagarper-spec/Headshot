// Configuración global: constantes de juego, mapa, niveles y calidad.
export const CFG = {
  half: 14,          // la arena mide 28x28 m
  height: 7.5,
  eye: 1.7,         // altura de los ojos de pie
  eyeCrouch: 1.1,   // ... y agachado
  pool: 3,           // Object Pool de enemigos (máximo por nivel)
  player: { speed: 5, radius: 0.4, hp: 2, sens: 0.0022 }, // 2 vidas: cuerpo = -1, cabeza = muerte
  weapon: { rate: 0.24, mag: 6, reload: 1.5, range: 60 }, // pistola semiautomática de 6 balas
  // walk/run = velocidades (m/s) que coinciden con las animaciones Mixamo de caminar y correr
  enemy: { speed: 3.4, walk: 1.8, run: 4.6, r: 0.3, h: 1.8, hAim: 1.62, hCrouch: 1.38 },
  // Obstáculos [x, z, ancho, fondo, alto, tipo]. Alto == height -> pilar de hormigón.
  // tipo: 'c1' contenedor largo (6,1 m) o 'c3' caja de madera; sin tipo -> caja/pilar procedural.
  crates: [
    [-6, -5, 6.1, 2.43, 2.64, 'c1'], [7.5, -4, 2.43, 6.1, 2.64, 'c1'],
    [0, -0.5, 1.8, 1.8, 1.8, 'c3'], [-4.5, 8.5, 1.6, 1.6, 1.6, 'c3'], [10, 6, 1.8, 1.8, 1.8, 'c3'],
    [-11, -1.5, 1.6, 1.6, 1.6, 'c3'], [3.5, -9, 1.6, 1.6, 1.6, 'c3'], [-7.5, 3, 1.4, 1.4, 1.4, 'c3'],
    [-9, -9, 1, 1, 7.5], [9, -9, 1, 1, 7.5], [-9, 9, 1, 1, 7.5], [9, 9, 1, 1, 7.5],
  ],
  // Modelos .glb opcionales. Si el archivo no existe se usa el soldado procedural.
  models: { enemy: 'assets/models/enemy.glb', dir: 'assets/models/' },
};

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
  { name: 'Primer duelo',    enemies: [{ x: -9, z: -11, helmet: false }], aim: 1.3, react: 0.8, acc: 0.25, burst: 0,    hide: [2.4, 4.2] },
  { name: 'Casco de acero',  enemies: [{ x: 9, z: -11, helmet: true }],   aim: 1.15, react: 0.65, acc: 0.28, burst: 0.1, hide: [2.2, 3.8] },
  { name: 'Francotirador',   enemies: [{ x: -9, z: -11, helmet: true }],  aim: 1.0, react: 0.55, acc: 0.33, burst: 0.2, hide: [1.9, 3.3] },
];
