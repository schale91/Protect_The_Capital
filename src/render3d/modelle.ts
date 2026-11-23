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
  stein: '#8a857c',
  steinHell: '#a39d92',
  steinDunkel: '#5f5a53',
  holz: '#8a5a33',
  holzHell: '#a8723f',
  holzDunkel: '#5e3b22',
  eisen: '#55575e',
  hecke: '#2f4a25',
  heckeDunkel: '#243a1c',
};

// ---------- Mauern und Tore ----------

/** Ein Stück Außenmauer. Stufe macht sie höher und beschlägt sie mit Eisen. */
export function aussenmauer(stufe: number, anteil: number): THREE.Group {
  const g = new THREE.Group();
  const h = 0.55 + stufe * 0.08;
  const sinken = 0.35 + 0.65 * Math.max(0, anteil);
  const farbe = anteil < 0.5 ? F.steinDunkel : F.stein;
  g.add(kiste(1, h * sinken, 0.5, farbe));
  for (const x of [-0.33, 0.33]) g.add(kiste(0.22, 0.14, 0.5, F.steinHell, x, h * sinken));
  for (let s = 0; s < stufe; s++) g.add(kiste(1.01, 0.04, 0.52, F.eisen, 0, 0.12 + s * 0.09));
  if (anteil < 0.75) {
    // Abgebröckelte Steine davor
    g.add(kiste(0.14, 0.08, 0.12, F.steinDunkel, -0.2, 0, -0.34));
    g.add(kiste(0.1, 0.06, 0.1, F.steinDunkel, 0.25, 0, -0.38));
  }
  return g;
}

export function haupttor(anteil: number): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.42, 0.42]) {
    g.add(kiste(0.2, 1.0, 0.6, F.steinDunkel, x));
    g.add(kiste(0.26, 0.1, 0.66, F.steinHell, x, 1.0));
  }
  g.add(kiste(1.04, 0.16, 0.6, F.stein, 0, 0.9));
  if (anteil > 0) {
    const holz = anteil < 0.4 ? F.holzDunkel : F.holz;
    for (const x of [-0.24, 0, 0.24]) g.add(kiste(0.22, 0.88 * (0.4 + 0.6 * anteil), 0.12, holz, x));
    g.add(kiste(0.66, 0.05, 0.14, F.eisen, 0, 0.2));
    g.add(kiste(0.66, 0.05, 0.14, F.eisen, 0, 0.62 * (0.4 + 0.6 * anteil)));
  }
  return g;
}

export function kernmauer(): THREE.Group {
  const g = new THREE.Group();
  g.add(kiste(1, 0.85, 0.6, F.steinDunkel));
  for (const x of [-0.33, 0.33]) g.add(kiste(0.24, 0.16, 0.6, F.stein, x, 0.85));
  return g;
}

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

export function bauwerk(id: BauwerkId, anteil: number): THREE.Group {
  const g = new THREE.Group();
  const teile: TurmTeile = {};
  g.userData.teile = teile;
  const dunkel = anteil < 0.5;
  switch (id) {
    case 'holzwand': {
      for (let i = 0; i < 5; i++) {
        const x = -0.4 + i * 0.2;
        const h = 0.55 + ((i * 37) % 5) * 0.03;
        g.add(zylinder(0.085, h * (0.5 + 0.5 * anteil), dunkel ? F.holzDunkel : F.holz, x, 0, 0, 6));
        g.add(kegel(0.085, 0.12, F.holzHell, x, h * (0.5 + 0.5 * anteil), 0));
      }
      g.add(kiste(0.98, 0.07, 0.06, F.holzDunkel, 0, 0.18, 0.09));
      g.add(kiste(0.98, 0.07, 0.06, F.holzDunkel, 0, 0.4 * (0.5 + 0.5 * anteil), 0.09));
      break;
    }
    case 'armbrust': {
      const holz = dunkel ? F.holzDunkel : F.holz;
      for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) g.add(kiste(0.09, 0.72, 0.09, holz, x, 0, z));
      g.add(kiste(0.08, 0.05, 0.64, F.holzDunkel, -0.3, 0.3));
      g.add(kiste(0.08, 0.05, 0.64, F.holzDunkel, 0.3, 0.3));
      g.add(kiste(0.86, 0.08, 0.86, F.holzHell, 0, 0.72));
      for (const [x, z, b, t] of [[0, -0.4, 0.86, 0.05], [0, 0.4, 0.86, 0.05], [-0.4, 0, 0.05, 0.86], [0.4, 0, 0.05, 0.86]]) {
        g.add(kiste(b, 0.14, t, holz, x, 0.8, z));
      }
      const kopf = new THREE.Group();
      kopf.position.set(0, 0.8, 0);
      kopf.add(kiste(0.08, 0.07, 0.5, '#3a2616', 0, 0.06, 0.05));
      kopf.add(kiste(0.56, 0.05, 0.05, F.eisen, 0, 0.08, 0.24));
      kopf.add(kiste(0.03, 0.03, 0.4, '#d8d0b8', 0, 0.12, 0.12));
      kopf.add(kiste(0.12, 0.12, 0.12, '#3a2616', 0, 0, -0.1));
      g.add(kopf);
      teile.kopf = kopf;
      // Fackel
      g.add(kiste(0.04, 0.22, 0.04, F.holzDunkel, 0.36, 0.86, 0.36));
      const flamme = kiste(0.07, 0.09, 0.07, mat('#ffb347', { leuchten: '#ff8a1e', staerke: 2.2 }), 0.36, 1.08, 0.36);
      flamme.castShadow = false;
      g.add(flamme);
      teile.flammen = [flamme];
      break;
    }
    case 'molotow': {
      g.add(zylinder(0.27, 0.55, dunkel ? '#3a2e24' : '#4a3b2c', 0, 0, 0, 10));
      for (const y of [0.1, 0.42]) g.add(zylinder(0.285, 0.05, F.eisen, 0, y, 0, 10));
      teile.flammen = [];
      for (const [x, z] of [[-0.12, 0], [0.1, -0.1], [0.08, 0.12]]) {
        g.add(zylinder(0.045, 0.2, '#3f6b4a', x, 0.55, z, 6));
        g.add(kiste(0.05, 0.05, 0.05, '#e8e0d0', x, 0.75, z));
        const f = kiste(0.06, 0.08, 0.06, mat('#ffd166', { leuchten: '#ff7a1a', staerke: 2.5 }), x, 0.8, z);
        f.castShadow = false;
        g.add(f);
        teile.flammen.push(f);
      }
      // Wurfarm
      const arm = new THREE.Group();
      arm.position.set(0, 0.55, 0);
      arm.add(kiste(0.06, 0.06, 0.5, F.holz, 0.2, 0, -0.1));
      g.add(arm);
      teile.kopf = arm;
      break;
    }
    case 'speerfalle': {
      g.add(kiste(0.84, 0.04, 0.84, '#3a2c20'));
      g.add(kiste(0.72, 0.045, 0.72, '#20180f'));
      const stacheln = new THREE.Group();
      for (let ix = -1; ix <= 1; ix++) {
        for (let iz = -1; iz <= 1; iz++) stacheln.add(kegel(0.045, 0.26, '#b8b8c0', ix * 0.22, 0, iz * 0.22, 4));
      }
      stacheln.position.y = -0.18;
      g.add(stacheln);
      teile.stacheln = stacheln;
      break;
    }
    case 'aussenmauer':
      return aussenmauer(0, anteil);
    case 'haupttor':
      return haupttor(anteil);
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
