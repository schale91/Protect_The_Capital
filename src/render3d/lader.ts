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

/** Weitere Kenney-Pakete (CC0), je Ordner mit eigener Farbtextur. */
export const BAUSAETZE = {
  burg: [
    'wall',
    'wall-half',
    'wall-narrow-wood',
    'wall-doorway',
    'metal-gate',
    'tower-square',
    'flag',
    'tower-square-base',
    'tower-square-mid-windows',
    'tower-square-top-roof-high',
  ],
  verteidigung: ['tower-square-bottom-a', 'tower-round-bottom-a', 'weapon-ballista', 'weapon-catapult'],
  ueberleben: ['fence-fortified', 'barrel', 'box', 'box-large', 'campfire-pit', 'tent', 'workbench', 'signpost', 'resource-planks'],
  autos: ['sedan', 'taxi', 'police', 'van', 'debris-tire', 'debris-door', 'cone'],
  friedhof: [
    'crypt',
    'crypt-small',
    'gravestone-cross',
    'gravestone-round',
    'gravestone-broken',
    'gravestone-bevel',
    'grave',
    'iron-fence',
    'iron-fence-border-gate',
    'pine-crooked',
    'pine',
    'lightpost-single',
    'fire-basket',
    'pumpkin-carved',
  ],
  vorstadt: ['building-type-a', 'building-type-c', 'building-type-h', 'building-type-m', 'planter', 'tree-small', 'tree-large'],
  markt: [
    'stall-red',
    'stall-green',
    'cart',
    'fountain-round',
    'lantern',
    'wall',
    'wall-broken',
    'wall-door',
    'wall-window-shutters',
    'roof-gable',
    'roof-high-gable',
    'chimney',
  ],
  stadtrand: [
    'detail-dumpster-closed',
    'detail-barrier-strong-damaged',
    'detail-barrier-strong-type-a',
    'wall-b',
    'roof-metal-type-a',
    'detail-dumpster-open',
    'pallet',
  ],
  natur: [
    'ground_riverOpen',
    'bridge_wood',
    'crops_dirtDoubleRow',
    'crops_dirtRow',
    'crops_wheatStageB',
    'crops_cornStageD',
    'crop_pumpkin',
    'crop_carrot',
    'fence_simple',
    'plant_bush',
    'plant_bushLarge',
    'log_stack',
    'stump_round',
    'tree_oak',
    'flower_redA',
    'flower_yellowA',
  ],
} as const;

type Bausatz = keyof typeof BAUSAETZE;
export type Teil = { [K in Bausatz]: `${K}/${(typeof BAUSAETZE)[K][number]}` }[Bausatz];

export type StadtModell = (typeof STADT)[number];
export type Figur = (typeof FIGUREN)[number];

export interface Modelle {
  stadt: Record<StadtModell, THREE.Object3D>;
  figuren: Record<Figur, { szene: THREE.Object3D; animationen: THREE.AnimationClip[] }>;
  teile: Record<Teil, THREE.Object3D>;
}

const basis = import.meta.env.BASE_URL;

export async function ladeModelle(): Promise<Modelle> {
  const loader = new GLTFLoader();
  const stadt = {} as Modelle['stadt'];
  const figuren = {} as Modelle['figuren'];
  const teile = {} as Modelle['teile'];
  const alleTeile = (Object.keys(BAUSAETZE) as Bausatz[]).flatMap((k) =>
    (BAUSAETZE[k] as readonly string[]).map((n) => `${k}/${n}` as Teil),
  );
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
    ...alleTeile.map(async (n) => {
      const g = await loader.loadAsync(`${basis}modelle/${n}.glb`);
      g.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      teile[n] = g.scene;
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
  return { stadt, figuren, teile };
}
