# HEADSHOT — duelo táctico en primera persona (Three.js)

Un almacén, una pistola de 6 balas y enemigos que se esconden, asoman y te apuntan (láser rojo). Tienes 2 vidas: un tiro al cuerpo te hiere, a la cabeza te mata. Igual para ellos, pero el casco aguanta un tiro en la cabeza.

**PC:** WASD mover · ratón girar (Q/E o flechas) · clic disparar · clic derecho zoom · R recargar · Esc pausa
**Móvil:** ruleta izquierda mover · ruleta derecha mirar · FUEGO · MIRA (zoom)

## Estructura
- `js/game-core.js`, `game-combat.js`, `game-geom.js`: lógica pura (sin render). IA con coberturas, Delta Time, Object Pool.
- `js/view-scene.js`, `view-models.js` (soldado y pistola), `view-textures.js`, `view-fx.js`: render PBR, EffectComposer (Bloom, MSAA, FXAA, ACES) y efectos con pooling.
- `js/loader.js` y `view-mixamo.js`: carga de Y Bot + animaciones Mixamo (FBXLoader, AnimationMixer con transiciones). También GLTFLoader (+Draco) para `enemy.glb` opcional.
- `js/config.js`: mapa, niveles y dificultad de calidad (baja/media/alta, ajuste automático por FPS).

## Ejecutar
Necesita servidor (módulos ES): `npx serve` o GitHub Pages. Three.js se carga desde jsDelivr.

## Créditos
- Pistola animada «Heavy pistol animated» (Sketchfab). Autor y licencia: *pendiente de indicar* (comprobar en la página del modelo; si es CC-BY, hay que citarlo aquí).
- Soldado y animaciones: Mixamo (Y Bot).
- La mano enguantada y el antebrazo de primera persona son procedurales (código propio).
- Música «Tactical Encounter»: creada por el autor del juego con Google Flow Music (condiciones de uso: revisar en la herramienta).
- Contenedor largo y caja de madera del escenario (modelos .glb aportados por el autor). Autor y licencia: *pendiente de indicar*.
