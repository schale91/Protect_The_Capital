/**
 * Selbst gebaute Low-Poly-Modelle im Stil der Kenney-Pakete (eine Kachel = 1 Einheit, Ursprung unten mittig).
 * Sie werden ersetzt, sobald passende CC0-Modelle (Graveyard, Castle, Tower Defense Kit) im Projekt liegen.
 */
import * as THREE from 'three';
import type { BauwerkId } from '../sim/data';

const materialien = new Map<string, THREE.MeshStandardMaterial>();

export function mat(farbe: string, opt: { leuchten?: string; staerke?: number } = {}): THREE.MeshStandardMaterial {
  const key = `${farbe}|${opt.leuchten ?? ''}|${opt.staerke ?? 0}`;
  let m = materialien.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: farbe,
      roughness: 0.85,
      metalness: 0,
      flatShading: true,
      emissive: opt.leuchten ? new THREE.Color(opt.leuchten) : new THREE.Color(0),
      emissiveIntensity: opt.staerke ?? 0,
    });
    materialien.set(key, m);
  }
  return m;
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
boxGeo.translate(0, 0.5, 0);

/** Quader mit Ursprung unten mittig. */
export function kiste(b: number, h: number, t: number, farbe: string | THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(boxGeo, typeof farbe === 'string' ? mat(farbe) : farbe);
  m.scale.set(b, h, t);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function zylinder(r: number, h: number, farbe: string | THREE.Material, x = 0, y = 0, z = 0, seiten = 8): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r, h, seiten);
  g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, typeof farbe === 'string' ? mat(farbe) : farbe);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function kegel(r: number, h: number, farbe: string, x = 0, y = 0, z = 0, seiten = 6): THREE.Mesh {
  const g = new THREE.ConeGeometry(r, h, seiten);
  g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, mat(farbe));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}


const F = {
  holz: '#8a5a33',
  holzHell: '#a8723f',
  holzDunkel: '#5e3b22',
  eisen: '#55575e',
  stein: '#8a857c',
  steinDunkel: '#5f5a53',
  hecke: '#2f4a25',
  heckeDunkel: '#243a1c',
};

export function grenze(): THREE.Group {
  const g = new THREE.Group();
  g.add(kiste(0.5, 0.55, 1, F.heckeDunkel));
  g.add(kiste(0.42, 0.12, 0.9, F.hecke, 0, 0.55));
  return g;
}

export function seitentor(): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-0.45, 0.45]) g.add(kiste(0.2, 0.8, 0.12, F.steinDunkel, 0, 0, z));
  for (const z of [-0.25, 0, 0.25]) g.add(kiste(0.1, 0.62, 0.22, F.holz, 0, 0.04, z));
  g.add(kiste(0.12, 0.05, 0.8, F.eisen, 0, 0.45));
  // Schild "Zu"
  g.add(kiste(0.04, 0.16, 0.3, '#c9b458', 0.08, 0.2));
  return g;
}

// ---------- Bauwerke ----------

export interface TurmTeile {
  kopf?: THREE.Object3D;
  stacheln?: THREE.Object3D;
  flammen?: THREE.Mesh[];
}

/** Selbst gebaute Bauwerke, für die es (noch) kein Kenney-Modell gibt. */
export function bauwerk(id: BauwerkId, anteil: number): THREE.Group {
  const g = new THREE.Group();
  const teile: TurmTeile = {};
  g.userData.teile = teile;
  if (id === 'speerfalle') {
    g.add(kiste(0.84, 0.04, 0.84, anteil < 0.5 ? '#2a2018' : '#3a2c20'));
    g.add(kiste(0.72, 0.045, 0.72, '#20180f'));
    const stacheln = new THREE.Group();
    for (let ix = -1; ix <= 1; ix++) {
      for (let iz = -1; iz <= 1; iz++) stacheln.add(kegel(0.045, 0.26, '#b8b8c0', ix * 0.22, 0, iz * 0.22, 4));
    }
    stacheln.position.y = -0.18;
    g.add(stacheln);
    teile.stacheln = stacheln;
  }
  return g;
}

// ---------- Deko ----------

export function laterne(): THREE.Group {
  const g = new THREE.Group();
  g.add(zylinder(0.03, 0.75, '#2b2b2b'));
  g.add(kiste(0.12, 0.03, 0.12, '#2b2b2b', 0, 0.75));
  const glas = kiste(0.09, 0.1, 0.09, mat('#ffe0a0', { leuchten: '#ffcc66', staerke: 2 }), 0, 0.78);
  glas.castShadow = false;
  g.add(glas);
  g.add(kiste(0.13, 0.03, 0.13, '#2b2b2b', 0, 0.88));
  return g;
}

export function truemmer(saat: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const r = Math.sin(saat * 12.9898 + i * 78.233) * 43758.5453;
    const f = r - Math.floor(r);
    const x = (f - 0.5) * 0.7;
    const z = ((f * 7.3) % 1) - 0.5;
    g.add(kiste(0.08 + f * 0.08, 0.04 + f * 0.05, 0.08 + f * 0.06, i % 2 ? '#5e3b22' : '#6b665f', x, 0, z * 0.7));
  }
  return g;
}
