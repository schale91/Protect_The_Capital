/** Lädt die Kenney-Modelle (CC0) einmalig. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const STADT = [
  'grass',
  'grass-trees',
  'grass-trees-tall',
  'pavement',
  'pavement-fountain',
  'road-straight',
  'road-straight-lightposts',
  'road-corner',
  'road-intersection',
  'road-split',
  'building-small-a',
  'building-small-b',
  'building-small-c',
  'building-small-d',
  'building-garage',
] as const;

export const FIGUREN = [
  'character-zombie',
  'character-raider',
  'character-soldier',
  'character-worker',
  'character-female-a',
  'character-male-a',
] as const;

export type StadtModell = (typeof STADT)[number];
export type Figur = (typeof FIGUREN)[number];

export interface Modelle {
  stadt: Record<StadtModell, THREE.Object3D>;
  figuren: Record<Figur, { szene: THREE.Object3D; animationen: THREE.AnimationClip[] }>;
}

const basis = import.meta.env.BASE_URL;

export async function ladeModelle(): Promise<Modelle> {
  const loader = new GLTFLoader();
  const stadt = {} as Modelle['stadt'];
  const figuren = {} as Modelle['figuren'];
  await Promise.all([
    ...STADT.map(async (n) => {
      const g = await loader.loadAsync(`${basis}modelle/kenney/${n}.glb`);
      g.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = !n.startsWith('grass') && !n.startsWith('pavement') && !n.startsWith('road') || n === 'grass-trees' || n === 'grass-trees-tall';
          o.receiveShadow = true;
        }
      });
      stadt[n] = g.scene;
    }),
    ...FIGUREN.map(async (n) => {
      const g = await loader.loadAsync(`${basis}modelle/figuren/${n}.glb`);
      g.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
        }
      });
      figuren[n] = { szene: g.scene, animationen: g.animations };
    }),
  ]);
  return { stadt, figuren };
}
