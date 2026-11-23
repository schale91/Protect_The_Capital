/**
 * Gelände und Gebäude eines Bezirks aus Kenney-Teilen (CC0) und ein paar eigenen Low-Poly-Formen.
 * Alle Funktionen liefern Objekte mit Ursprung unten mittig auf einer Kachel (eine Kachel = 1 Einheit).
 */
import * as THREE from 'three';
import type { BezirkTyp } from '../sim/karte';
import type { Teil } from './lader';
import { kiste, mat } from './modelle';

export interface Kasten {
  teil(name: Teil, faerben?: string): THREE.Object3D;
}

/** Richtungen gegen den Uhrzeigersinn, wie eine Drehung um +90 Grad sie weiterschiebt. */
export type Richtung = 'O' | 'N' | 'W' | 'S';
const RICHTUNGEN: Richtung[] = ['O', 'N', 'W', 'S'];

/** Drehung (in 90-Grad-Schritten), die die Grundrichtungen eines Modells auf die gewünschten bringt. */
export function drehungFuer(basis: Richtung[], ziel: Richtung[]): number | null {
  for (let k = 0; k < 4; k++) {
    const gedreht = basis.map((r) => RICHTUNGEN[(RICHTUNGEN.indexOf(r) + k) % 4]);
    if (gedreht.length === ziel.length && gedreht.every((r) => ziel.includes(r))) return k;
  }
  return null;
}

export function zufall(x: number, y: number, salz = 0): number {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233 + salz * 37.719) * 43758.5453) % 1;
}

// ---------- Häuser ----------

/** Fachwerkhaus auf einer Kachel. Die Tür zeigt in Richtung `tuer`. */
export function fachwerkhaus(k: Kasten, tuer: Richtung, saat: number, dach = '#ffffff'): THREE.Group {
  const g = new THREE.Group();
  for (const r of RICHTUNGEN) {
    const art: Teil = r === tuer ? 'markt/wall-door' : zufall(saat, RICHTUNGEN.indexOf(r)) < 0.6 ? 'markt/wall-window-shutters' : 'markt/wall';
    const w = k.teil(art);
    w.rotation.y = RICHTUNGEN.indexOf(r) * (Math.PI / 2);
    g.add(w);
  }
  const d = k.teil(zufall(saat, 9) < 0.5 ? 'markt/roof-gable' : 'markt/roof-high-gable', dach === '#ffffff' ? undefined : dach);
  d.position.y = 1;
  d.rotation.y = tuer === 'N' || tuer === 'S' ? Math.PI / 2 : 0;
  g.add(d);
  if (zufall(saat, 3) < 0.5) {
    const s = k.teil('markt/chimney');
    s.position.y = 1;
    s.scale.y = 0.6;
    g.add(s);
  }
  g.scale.setScalar(0.8);
  return g;
}

export function ruine(k: Kasten, saat: number): THREE.Group {
  const g = new THREE.Group();
  RICHTUNGEN.forEach((_, n) => {
    const r = zufall(saat, n);
    if (r < 0.3) return;
    const w = k.teil(r < 0.75 ? 'markt/wall-broken' : 'markt/wall', '#c9bfb2');
    w.rotation.y = n * (Math.PI / 2);
    w.scale.y = 0.6 + r * 0.4;
    g.add(w);
  });
  g.add(kiste(0.3, 0.08, 0.25, '#7d7468', (zufall(saat, 7) - 0.5) * 0.4, 0, (zufall(saat, 8) - 0.5) * 0.4));
  g.add(kiste(0.18, 0.06, 0.2, '#6b5a48', (zufall(saat, 5) - 0.5) * 0.4, 0, (zufall(saat, 6) - 0.5) * 0.4));
  g.scale.setScalar(0.85);
  return g;
}

export function kirchenschiff(k: Kasten): THREE.Group {
  const g = new THREE.Group();
  const block = k.teil('burg/tower-square-base', '#bdb4a6');
  block.scale.set(1, 0.85, 1);
  g.add(block);
  const dach = k.teil('markt/roof-high-gable', '#7a4a3a');
  dach.position.y = 0.85;
  dach.scale.set(0.95, 0.8, 0.95);
  g.add(dach);
  return g;
}

export function turm(k: Kasten, oben: 'kirche' | 'wache'): THREE.Group {
  const g = new THREE.Group();
  g.add(k.teil('burg/tower-square-base', '#c4bbad'));
  const mitte = k.teil('burg/tower-square-mid-windows', '#c4bbad');
  mitte.position.y = 1;
  g.add(mitte);
  const spitze = k.teil('burg/tower-square-top-roof-high');
  spitze.position.y = 2;
  g.add(spitze);
  g.scale.set(0.8, oben === 'kirche' ? 0.85 : 0.7, 0.8);
  return g;
}

export function halle(k: Kasten, quer: boolean): THREE.Group {
  const g = new THREE.Group();
  const w = k.teil('stadtrand/wall-b');
  w.scale.set(1, 0.8, 1);
  g.add(w);
  const d = k.teil('stadtrand/roof-metal-type-a');
  d.position.y = 0.8;
  d.scale.set(0.88, 0.6, 1);
  d.rotation.y = quer ? Math.PI / 2 : 0;
  g.add(d);
  return g;
}

export function scheune(k: Kasten): THREE.Group {
  const g = new THREE.Group();
  RICHTUNGEN.forEach((_, n) => {
    const w = k.teil('markt/wall', '#b45a44');
    w.rotation.y = n * (Math.PI / 2);
    g.add(w);
  });
  const d = k.teil('markt/roof-high-gable', '#6b4a32');
  d.position.y = 1;
  g.add(d);
  g.scale.setScalar(0.85);
  return g;
}

const CONTAINER = ['#b8442f', '#2f6fa8', '#3f8a4a', '#d0882a', '#7a7f86'];
export function container(saat: number): THREE.Group {
  const g = new THREE.Group();
  const lagen = zufall(saat, 1) < 0.5 ? 2 : 1;
  for (let n = 0; n < lagen; n++) {
    const farbe = CONTAINER[Math.floor(zufall(saat, n + 2) * CONTAINER.length)];
    const c = kiste(0.88, 0.38, 0.42, farbe, 0, n * 0.38, n === 1 ? 0.05 : 0);
    g.add(c);
    for (let r = -3; r <= 3; r++) g.add(kiste(0.02, 0.34, 0.44, shade(farbe), r * 0.12, n * 0.38 + 0.02, n === 1 ? 0.05 : 0));
  }
  g.rotation.y = zufall(saat, 9) < 0.5 ? 0 : Math.PI / 2;
  return g;
}

function shade(farbe: string): string {
  return `#${new THREE.Color(farbe).multiplyScalar(0.75).getHexString()}`;
}

export function hecke(waagerecht: boolean): THREE.Group {
  const g = new THREE.Group();
  const h = kiste(1, 0.5, 0.5, '#2c4423');
  g.add(h);
  for (let n = -1; n <= 1; n++) g.add(kiste(0.3, 0.12, 0.42, '#365a2b', n * 0.32, 0.5, 0));
  g.rotation.y = waagerecht ? 0 : Math.PI / 2;
  return g;
}

/** Gleisdamm mit Schwellen und Schienen, Schienen laufen von West nach Ost. */
export function gleis(): THREE.Group {
  const g = new THREE.Group();
  g.add(kiste(1, 0.1, 0.9, '#8a8274'));
  for (let n = -2; n <= 2; n++) g.add(kiste(0.12, 0.04, 0.62, '#5a3e28', n * 0.2, 0.1, 0));
  for (const z of [-0.18, 0.18]) g.add(kiste(1, 0.05, 0.04, '#9aa0a8', 0, 0.13, z));
  return g;
}

/** Andreaskreuz neben dem Bahnübergang. */
export function andreaskreuz(): THREE.Group {
  const g = new THREE.Group();
  g.add(kiste(0.04, 0.55, 0.04, '#d8d8d8'));
  const a = kiste(0.04, 0.32, 0.04, '#c83a2e', 0, 0.38, 0);
  a.rotation.x = 0.7;
  const b = kiste(0.04, 0.32, 0.04, '#c83a2e', 0, 0.38, 0);
  b.rotation.x = -0.7;
  g.add(a, b);
  return g;
}

// ---------- Gebäude des Spielers ----------

export function wohnhaus(k: Kasten, typ: BezirkTyp, saat: number, tuer: Richtung): THREE.Object3D {
  if (typ === 'vorstadt' || typ === 'industrie') {
    const arten: Teil[] = ['vorstadt/building-type-a', 'vorstadt/building-type-c', 'vorstadt/building-type-h'];
    const h = k.teil(arten[Math.floor(zufall(saat, 4) * arten.length)]);
    h.scale.setScalar(0.72);
    const d = drehungFuer(['S'], [tuer]) ?? 0;
    h.rotation.y = d * (Math.PI / 2);
    return h;
  }
  return fachwerkhaus(k, tuer, saat, typ === 'dorf' ? '#c07a5a' : '#ffffff');
}

export function garten(k: Kasten, saat: number): THREE.Group {
  const g = new THREE.Group();
  const beet = k.teil('natur/crops_dirtDoubleRow');
  beet.scale.set(0.9, 1, 0.9);
  g.add(beet);
  const pflanzen: Teil[] = ['natur/crop_carrot', 'natur/crop_pumpkin'];
  for (let n = 0; n < 3; n++) {
    const p = k.teil(pflanzen[Math.floor(zufall(saat, n) * 2)]);
    p.position.set(-0.28 + n * 0.28, 0.04, n % 2 ? 0.2 : -0.18);
    p.scale.setScalar(0.7);
    g.add(p);
  }
  const zaun = k.teil('natur/fence_simple');
  zaun.scale.setScalar(0.95);
  g.add(zaun);
  return g;
}

export function holzplatz(k: Kasten): THREE.Group {
  const g = new THREE.Group();
  const stapel = k.teil('natur/log_stack');
  stapel.position.set(-0.15, 0, 0);
  stapel.scale.setScalar(1.3);
  g.add(stapel);
  const stumpf = k.teil('natur/stump_round');
  stumpf.position.set(0.3, 0, 0.25);
  g.add(stumpf);
  const bretter = k.teil('ueberleben/resource-planks');
  bretter.position.set(0.25, 0, -0.25);
  g.add(bretter);
  return g;
}

export function schrottplatz(k: Kasten): THREE.Group {
  const g = new THREE.Group();
  const c = k.teil('stadtrand/detail-dumpster-open');
  c.position.set(-0.15, 0, -0.1);
  c.scale.setScalar(0.9);
  g.add(c);
  const reifen = k.teil('autos/debris-tire');
  reifen.position.set(0.3, 0.12, 0.25);
  reifen.scale.setScalar(0.45);
  g.add(reifen);
  const tuer = k.teil('autos/debris-door');
  tuer.position.set(0.3, 0, -0.2);
  tuer.rotation.y = 0.6;
  tuer.scale.setScalar(0.5);
  g.add(tuer);
  const palette = k.teil('stadtrand/pallet');
  palette.scale.setScalar(0.45);
  palette.position.set(-0.2, 0, 0.3);
  g.add(palette);
  return g;
}

export function bezirkswache(k: Kasten): THREE.Group {
  const g = new THREE.Group();
  const unten = k.teil('burg/tower-square-base', '#c4bbad');
  unten.scale.set(0.9, 0.8, 0.9);
  g.add(unten);
  const dach = k.teil('markt/roof-high-gable', '#8a3328');
  dach.position.y = 0.8;
  dach.scale.setScalar(0.9);
  g.add(dach);
  const fahne = k.teil('burg/flag');
  fahne.position.set(0.3, 1.5, 0.3);
  fahne.scale.setScalar(0.7);
  g.add(fahne);
  return g;
}

export function baumarkt(k: Kasten): THREE.Object3D {
  const h = k.teil('vorstadt/building-type-m', '#ffbf80');
  h.scale.setScalar(0.68);
  return h;
}

export function schrottpresse(k: Kasten): THREE.Group {
  const g = halle(k, false);
  const c = k.teil('stadtrand/detail-dumpster-open');
  c.position.set(0, 0, 0.55);
  c.scale.setScalar(0.6);
  g.add(c);
  return g;
}

export function wassermuehle(k: Kasten): { gruppe: THREE.Group; rad: THREE.Object3D } {
  const g = new THREE.Group();
  g.add(fachwerkhaus(k, 'S', 17, '#c07a5a'));
  const rad = new THREE.Group();
  const holz = mat('#6b4a2e');
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 5, 12), holz);
  rad.add(ring);
  for (let n = 0; n < 6; n++) {
    const speiche = kiste(0.03, 0.6, 0.05, holz, 0, -0.3, 0);
    const halter = new THREE.Group();
    halter.add(speiche);
    halter.rotation.z = (n / 6) * Math.PI;
    rad.add(halter);
  }
  rad.rotation.y = Math.PI / 2;
  const halterung = new THREE.Group();
  halterung.position.set(0.48, 0.32, 0);
  halterung.add(rad);
  g.add(halterung);
  return { gruppe: g, rad };
}
