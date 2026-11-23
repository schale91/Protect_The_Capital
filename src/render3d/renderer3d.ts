/**
 * 3D-Darstellung des Bezirks mit Three.js. Die Spiellogik (src/sim) weiß davon nichts.
 * Eine Kachel ist eine Einheit groß. Norden (Zeile 0, draußen) liegt hinten, die Hauptstadt vorn.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BAUTEN, type BauwerkId, GEGNER, type GegnerId } from '../sim/data';
import {
  BREITE,
  INNEN_OBEN,
  INNEN_UNTEN,
  type Karte,
  imFeld,
  HOEHE,
  TOR_X,
  ZEILE_AUSSENMAUER,
  ZEILE_KERNMAUER,
  ZEILE_SEITENTOR,
  idx,
  istKern,
} from '../sim/karte';
import type { Ereignis, Gegner } from '../sim/nacht';
import type { BauwerkZustand } from '../sim/wege';
import { type Figur, type Modelle, type StadtModell, type Teil, ladeModelle } from './lader';
import {
  type Kasten,
  type Richtung,
  andreaskreuz,
  baumarkt,
  bezirkswache,
  container,
  drehungFuer,
  garten,
  gleis,
  halle,
  hecke,
  holzplatz,
  kirchenschiff,
  ruine,
  scheune,
  schrottplatz,
  schrottpresse,
  turm,
  wassermuehle,
  wohnhaus,
  zufall,
} from './bezirk3d';
import { type TurmTeile, bauwerk, grenze, kiste, mat, seitentor, truemmer } from './modelle';

export interface Vorschau {
  i: number;
  art: BauwerkId | 'verstaerken' | 'abreissen';
  ok: boolean;
}

export interface Ansicht {
  bauten: readonly (BauwerkZustand | null)[];
  mauerStufe: Readonly<Record<number, number>>;
  gegner: readonly Gegner[];
  nacht: boolean;
  vorschau: Vorschau | null;
  laufweg: Uint16Array | null;
}

/** Kachel-Mitte in Weltkoordinaten. */
export function welt(x: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(x - (BREITE - 1) / 2, 0, y - (HOEHE - 1) / 2);
}

const BODEN_Y = 0.06;

/** Welche Richtungen die Kenney-Straßenteile ohne Drehung verbinden (aus den Modellen abgelesen). */
const STRASSE_BASIS: Record<'gerade' | 'kurve' | 'einmuendung', Richtung[]> = {
  gerade: ['N', 'S'],
  kurve: ['S', 'O'],
  einmuendung: ['O', 'W', 'S'],
};

interface Zombie3D {
  obj: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  aktionen: Map<string, THREE.AnimationAction>;
  aktuell: string;
  typ: GegnerId;
  x: number;
  y: number;
  balken: Balken;
}

interface Sterbender {
  obj: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  rest: number;
}

interface Bau3D {
  key: string;
  obj: THREE.Object3D;
  balken: Balken | null;
}

interface Effekt {
  obj: THREE.Object3D;
  alter: number;
  dauer: number;
  update: (t: number, e: Effekt) => void;
  licht?: THREE.PointLight;
}

class Balken {
  readonly gruppe = new THREE.Group();
  private readonly vorne: THREE.Sprite;
  private static hinten = new THREE.SpriteMaterial({ color: '#1a1420', depthTest: false });
  private static rot = new THREE.SpriteMaterial({ color: '#e0453a', depthTest: false });
  private static gelb = new THREE.SpriteMaterial({ color: '#e6c35c', depthTest: false });

  constructor(
    private readonly breite: number,
    farbe: 'rot' | 'gelb',
  ) {
    const h = new THREE.Sprite(Balken.hinten);
    h.scale.set(breite + 0.04, 0.08, 1);
    h.renderOrder = 10;
    this.vorne = new THREE.Sprite(farbe === 'rot' ? Balken.rot : Balken.gelb);
    this.vorne.center.set(0, 0.5);
    this.vorne.position.x = -breite / 2;
    this.vorne.scale.set(breite, 0.05, 1);
    this.vorne.renderOrder = 11;
    this.gruppe.add(h, this.vorne);
  }

  setze(anteil: number): void {
    this.gruppe.visible = anteil < 0.999;
    this.vorne.scale.x = Math.max(0.001, this.breite * Math.max(0, anteil));
  }
}

const textCache = new Map<string, THREE.SpriteMaterial>();
function textSprite(text: string, farbe: string): THREE.Sprite {
  const key = text + farbe;
  let m = textCache.get(key);
  if (!m) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const ctx = c.getContext('2d')!;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#120e14';
    ctx.strokeText(text, 128, 48);
    ctx.fillStyle = farbe;
    ctx.fillText(text, 128, 48);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true });
    textCache.set(key, m);
  }
  const s = new THREE.Sprite(m.clone());
  s.scale.set(0.9, 0.34, 1);
  s.renderOrder = 20;
  return s;
}

const AUSSEHEN: Record<GegnerId, { farbe: string; skala: [number, number, number]; gang: string; tempo: number }> = {
  schlurfi: { farbe: '#ffffff', skala: [1.25, 1.25, 1.25], gang: 'walk', tempo: 0.7 },
  sprinter: { farbe: '#ffb0a0', skala: [1.15, 1.3, 1.15], gang: 'sprint', tempo: 1.1 },
  pupsbeule: { farbe: '#d9e07a', skala: [1.9, 1.3, 1.9], gang: 'walk', tempo: 0.45 },
};

export class Renderer3D {
  readonly bereit: Promise<void>;
  private readonly gl: THREE.WebGLRenderer;
  private readonly szene = new THREE.Scene();
  private readonly kamera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  private readonly hemi = new THREE.HemisphereLight('#c3cbd8', '#3a3328', 1.1);
  private readonly sonne = new THREE.DirectionalLight('#ffd9b0', 1.8);
  private readonly laternenLichter: THREE.PointLight[] = [];
  private readonly feuerLichter: THREE.PointLight[] = [];
  private readonly kernLicht = new THREE.PointLight('#ffb35c', 0, 7, 1.6);
  private readonly blitz: THREE.Mesh;
  private modelle: Modelle | null = null;

  private readonly bauGruppe = new THREE.Group();
  private readonly bauten = new Map<number, Bau3D>();
  private readonly zombies = new Map<number, Zombie3D>();
  private sterbende: Sterbender[] = [];
  private effekte: Effekt[] = [];
  private readonly flecken = new THREE.Group();
  private readonly spuren: THREE.InstancedMesh;
  private letzterLaufweg: Uint16Array | null = null;
  private readonly vorschauGruppe = new THREE.Group();
  private vorschauKey = '';
  private readonly bewohner: Array<{ mixer: THREE.AnimationMixer; aktionen: Map<string, THREE.AnimationAction>; aktuell?: string }> = [];
  private nachtWert = 0;
  private wackeln = 0;

  // Kamera-Steuerung
  private zoom = 1;
  private readonly fokus = new THREE.Vector3(0, 0, 0.6);
  private grundAbstand = 30;
  private readonly zeiger = new Map<number, { x: number; y: number }>();
  private wischStrecke = 0;
  private pinchStart = 0;
  private zoomStart = 1;
  private tippen: ((x: number, y: number) => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;

    this.szene.background = new THREE.Color('#59626c');
    this.szene.fog = new THREE.Fog('#59626c', 30, 60);

    this.sonne.position.set(-8, 16, 10);
    this.sonne.castShadow = true;
    this.sonne.shadow.mapSize.set(2048, 2048);
    const sc = this.sonne.shadow.camera;
    sc.left = -12;
    sc.right = 12;
    sc.top = 16;
    sc.bottom = -16;
    sc.near = 1;
    sc.far = 50;
    this.sonne.shadow.bias = -0.0006;
    this.szene.add(this.hemi, this.sonne, this.sonne.target);

    for (const y of [5, 11, 17]) {
      const l = new THREE.PointLight('#ffc874', 0, 5.5, 1.5);
      const p = welt(TOR_X, y);
      l.position.set(p.x - 0.45, 0.9, p.z);
      this.laternenLichter.push(l);
      this.szene.add(l);
    }
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight('#ff8a2a', 0, 4, 1.6);
      this.feuerLichter.push(l);
      this.szene.add(l);
    }
    const kp = welt(TOR_X, HOEHE - 1);
    this.kernLicht.position.set(kp.x, 1.4, kp.z);
    this.szene.add(this.kernLicht);

    this.blitz = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.MeshBasicMaterial({ color: '#c81e14', transparent: true, opacity: 0, depthTest: false }),
    );
    this.blitz.position.z = -0.5;
    this.blitz.renderOrder = 100;
    this.kamera.add(this.blitz);
    this.szene.add(this.kamera);

    this.szene.add(this.bauGruppe, this.flecken, this.vorschauGruppe);

    const spurGeo = new THREE.PlaneGeometry(0.12, 0.2);
    spurGeo.rotateX(-Math.PI / 2);
    this.spuren = new THREE.InstancedMesh(
      spurGeo,
      new THREE.MeshBasicMaterial({ color: '#c0302a', transparent: true, opacity: 0.55, depthWrite: false }),
      BREITE * HOEHE * 2,
    );
    this.spuren.count = 0;
    this.spuren.renderOrder = 2;
    this.szene.add(this.spuren);

    this.steuerung();
    this.bereit = ladeModelle().then((m) => {
      this.modelle = m;
      this.baueUmgebung();
      if (this.karte) this.baueBezirk(this.karte);
    });
  }

  // ---------- Öffentliche Schnittstelle ----------

  /** Neuer oder anderer Bezirk: Gelände neu aufbauen. */
  setzeKarte(k: Karte): void {
    if (this.karte && this.karte.seed === k.seed && this.karte.typ === k.typ) return;
    this.karte = k;
    for (const b of this.bauten.values()) this.bauGruppe.remove(b.obj);
    this.bauten.clear();
    if (this.modelle) this.baueBezirk(k);
  }

  private karte: Karte | null = null;
  private readonly wasserMat = new THREE.MeshStandardMaterial({ color: '#3c78a6', roughness: 0.25, metalness: 0.1, flatShading: true });
  private readonly bezirkGruppe = new THREE.Group();

  beimTippen(f: (x: number, y: number) => void): void {
    this.tippen = f;
  }

  groesse(b: number, h: number): void {
    this.gl.setSize(b, h, true);
    this.kamera.aspect = b / h;
    this.kamera.updateProjectionMatrix();
    this.grundAbstand = this.passenderAbstand();
    this.kameraSetzen();
  }

  neueNacht(): void {
    for (const e of this.effekte) this.szene.remove(e.obj);
    this.effekte = [];
    this.flecken.clear();
  }

  ereignisse(liste: readonly Ereignis[]): void {
    for (const e of liste) {
      switch (e.art) {
        case 'bolzen':
          this.bolzen(e.vonX, e.vonY, e.nachX, e.nachY);
          break;
        case 'brandflasche':
          this.zieleTurm(e.vonX, e.vonY, e.nachX, e.nachY);
          this.feuer(e.nachX, e.nachY, e.r);
          break;
        case 'falle':
          this.falle(e.i);
          break;
        case 'platzt':
          this.wolke(e.x, e.y, e.r);
          this.text(e.x, e.y, 'Pfffft!', '#cfe06a', 1.3);
          this.fleck(e.x, e.y, '#6f7a24', 0.55, 0.6);
          break;
        case 'tot':
          this.fleck(e.x, e.y, '#4a0f0f', 0.22 + Math.random() * 0.1, 0.9);
          this.text(e.x, e.y, `+${GEGNER[e.typ].belohnung}`, '#e6c35c', 0.9);
          break;
        case 'zerstoert': {
          const x = (e.i % BREITE) + 0.5;
          const y = Math.floor(e.i / BREITE) + 0.5;
          const t = truemmer(e.i);
          const p = welt(x - 0.5, y - 0.5);
          t.position.set(p.x, BODEN_Y, p.z);
          this.flecken.add(t);
          this.staub(x, y);
          break;
        }
        case 'kern':
          this.wackeln = 0.35;
          this.text(e.x + 0.5, HOEHE - 1.5, `-${e.schaden}`, '#ff6b5e', 1.1);
          this.effekte.push({
            obj: new THREE.Object3D(),
            alter: 0,
            dauer: 0.4,
            update: (t) => ((this.blitz.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t)),
          });
          for (const b of this.bewohner) this.spiele(b, 'emote-no', true);
          break;
        case 'ankunft':
          break;
      }
    }
  }

  zeichne(a: Ansicht, sekunden: number, dt: number): void {
    this.nachtWert += ((a.nacht ? 1 : 0) - this.nachtWert) * Math.min(1, dt * 2);
    this.licht(sekunden);
    if (this.modelle) {
      this.aktualisiereBauten(a);
      this.aktualisiereZombies(a.gegner, dt);
      this.aktualisiereVorschau(a.vorschau);
      this.aktualisiereSpuren(a.nacht ? null : a.laufweg);
      for (const b of this.bewohner) b.mixer.update(dt);
    }
    this.aktualisiereEffekte(dt, sekunden);
    if (this.wackeln > 0) this.wackeln = Math.max(0, this.wackeln - dt);
    this.kameraSetzen();
    this.gl.render(this.szene, this.kamera);
  }

  /** Bilder für Knöpfe und Bestiarium, gerendert mit einer kleinen eigenen Kamera. */
  bildVon(art: BauwerkId | 'verstaerken' | 'abreissen' | GegnerId | Teil): string {
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight('#ffffff', '#55504a', 2.2));
    const d = new THREE.DirectionalLight('#fff2e0', 2);
    d.position.set(2, 4, 3);
    s.add(d);
    let obj: THREE.Object3D;
    let ziel = new THREE.Vector3(0, 0.45, 0);
    let abstand = 2.1;
    if (art.includes('/')) {
      obj = this.teil(art as Teil);
      const box = new THREE.Box3().setFromObject(obj);
      const groesse = box.getSize(new THREE.Vector3());
      ziel = box.getCenter(new THREE.Vector3());
      abstand = Math.max(groesse.x, groesse.y, groesse.z) * 2.2;
    } else if (art === 'verstaerken') {
      obj = this.bauModell('aussenmauer', 1, 3);
      ziel = new THREE.Vector3(0, 0.5, 0);
      abstand = 2.4;
    } else if (art === 'abreissen') {
      obj = new THREE.Group();
      obj.add(kiste(0.12, 0.7, 0.12, '#8a5a33', 0, 0, 0));
      obj.add(kiste(0.5, 0.22, 0.22, '#8d8d93', 0, 0.62, 0));
      obj.add(kiste(0.8, 0.06, 0.8, '#b8342c', 0, 0, 0));
    } else if (art in GEGNER) {
      obj = this.zombieModell(art as GegnerId).obj;
      ziel = new THREE.Vector3(0, 0.32, 0);
      abstand = art === 'pupsbeule' ? 2.1 : 1.5;
    } else {
      obj = this.bauModell(art as BauwerkId, 1, 0);
      if (art === 'armbrust' || art === 'molotow') {
        ziel = new THREE.Vector3(0, 0.55, 0);
        abstand = 2.5;
      }
    }
    s.add(obj);
    const k = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    k.position.set(abstand * 0.75, abstand * 0.85, abstand);
    k.lookAt(ziel);
    const rt = new THREE.WebGLRenderTarget(96, 96, { colorSpace: THREE.SRGBColorSpace });
    const alt = this.gl.getClearAlpha();
    this.gl.setClearAlpha(0);
    s.background = null;
    this.gl.setRenderTarget(rt);
    this.gl.clear();
    this.gl.render(s, k);
    const pixel = new Uint8Array(96 * 96 * 4);
    this.gl.readRenderTargetPixels(rt, 0, 0, 96, 96, pixel);
    this.gl.setRenderTarget(null);
    this.gl.setClearAlpha(alt);
    rt.dispose();
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    const ctx = c.getContext('2d')!;
    const bild = ctx.createImageData(96, 96);
    // WebGL liest von unten nach oben
    for (let y = 0; y < 96; y++) bild.data.set(pixel.subarray((95 - y) * 384, (96 - y) * 384), y * 384);
    ctx.putImageData(bild, 0, 0);
    return c.toDataURL();
  }

  // ---------- Welt aufbauen ----------

  private kachel(name: StadtModell, x: number, y: number, dreh = 0, faerben?: string): THREE.Object3D {
    const o = this.modelle!.stadt[name].clone();
    const p = welt(x, y);
    o.position.set(p.x, 0, p.z);
    o.rotation.y = dreh;
    if (faerben) {
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (mesh.isMesh) mesh.material = this.getoent(mesh.material as THREE.MeshStandardMaterial, faerben);
      });
    }
    this.statisch.add(o);
    return o;
  }

  /** Kopie eines Kenney-Teils, optional eingefärbt. */
  private teil(name: Teil, faerben?: string): THREE.Object3D {
    const o = this.modelle!.teile[name].clone();
    if (faerben) {
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (mesh.isMesh) mesh.material = this.getoent(mesh.material as THREE.MeshStandardMaterial, faerben);
      });
    }
    return o;
  }

  /** Bauwerke aus den Kenney-Bausätzen. Ursprung unten mittig auf der Kachel. */
  bauModell(id: BauwerkId, anteil: number, mauerStufe: number, i = -1): THREE.Group {
    const g = new THREE.Group();
    const teile: TurmTeile = {};
    g.userData.teile = teile;
    const kaputt = anteil < 0.5 ? '#8f8a84' : undefined;
    switch (id) {
      case 'aussenmauer': {
        const art: Teil = mauerStufe === 0 ? 'burg/wall-narrow-wood' : mauerStufe <= 2 ? 'burg/wall-half' : 'burg/wall';
        const w = this.teil(art, kaputt);
        const hoehe = (0.42 + mauerStufe * 0.07) * (0.45 + 0.55 * anteil);
        w.scale.set(1, hoehe, 1);
        // Die Burgmauer-Modelle laufen von Natur aus von vorn nach hinten, unsere Mauer von links nach rechts
        w.rotation.y = Math.PI / 2;
        g.add(w);
        if (anteil < 0.75) g.add(truemmer(mauerStufe * 7 + 3));
        break;
      }
      case 'stadttor':
      case 'haupttor': {
        const rahmen = this.teil('burg/wall-doorway', id === 'stadttor' ? '#d7c3a0' : '#b9b0a4');
        rahmen.scale.set(1, 0.75, 1);
        rahmen.rotation.y = Math.PI / 2;
        g.add(rahmen);
        if (anteil > 0) {
          const gitter = this.teil('burg/metal-gate', kaputt);
          gitter.rotation.y = Math.PI / 2;
          gitter.scale.set(1.25, 0.95 * (0.35 + 0.65 * anteil), 1.25);
          g.add(gitter);
        }
        break;
      }
      case 'armbrust': {
        g.add(this.teil('verteidigung/tower-square-bottom-a', kaputt));
        const kopf = new THREE.Group();
        kopf.position.y = 0.5;
        kopf.add(this.teil('verteidigung/weapon-ballista'));
        g.add(kopf);
        teile.kopf = kopf;
        break;
      }
      case 'molotow': {
        g.add(this.teil('verteidigung/tower-round-bottom-a', kaputt));
        const kopf = new THREE.Group();
        kopf.position.y = 0.6;
        kopf.add(this.teil('verteidigung/weapon-catapult'));
        g.add(kopf);
        teile.kopf = kopf;
        // Glimmende Lunte, damit man ihn nachts findet
        const glut = kiste(0.06, 0.06, 0.06, mat('#ffb347', { leuchten: '#ff7a1a', staerke: 2.5 }), 0.28, 0.6, 0.28);
        glut.castShadow = false;
        g.add(glut);
        teile.flammen = [glut];
        break;
      }
      case 'holzwand': {
        const zaun = this.teil('ueberleben/fence-fortified', kaputt);
        zaun.scale.set(2, 1.1 * (0.5 + 0.5 * anteil), 2);
        zaun.position.z = 0.45;
        g.add(zaun);
        break;
      }
      case 'speerfalle':
        return bauwerk('speerfalle', anteil);
      case 'wohnhaus':
        g.add(wohnhaus(this.kasten, this.karte?.typ ?? 'vorstadt', i, this.tuerRichtung(i)));
        break;
      case 'garten':
        g.add(garten(this.kasten, i));
        break;
      case 'holzplatz':
        g.add(holzplatz(this.kasten));
        break;
      case 'schrottplatz':
        g.add(schrottplatz(this.kasten));
        break;
      case 'bezirkswache':
        g.add(bezirkswache(this.kasten));
        break;
      case 'glockenturm':
        g.add(turm(this.kasten, 'kirche'));
        break;
      case 'baumarkt':
        g.add(baumarkt(this.kasten));
        break;
      case 'schrottpresse':
        g.add(schrottpresse(this.kasten));
        break;
      case 'wassermuehle': {
        const m = wassermuehle(this.kasten);
        g.add(m.gruppe);
        teile.rad = m.rad;
        break;
      }
    }
    if (anteil < 0.5 && id !== 'aussenmauer' && id !== 'stadttor' && id !== 'haupttor') g.add(truemmer(i + 11));
    return g;
  }

  private readonly kasten: Kasten = { teil: (n, f) => this.teil(n, f) };

  /** Haustüren zeigen zur nächsten Straße, sonst nach Süden. */
  private tuerRichtung(i: number): Richtung {
    if (i < 0 || !this.karte) return 'S';
    const x = i % BREITE;
    const y = Math.floor(i / BREITE);
    const proben: Array<[Richtung, number, number]> = [['S', 0, 1], ['O', 1, 0], ['W', -1, 0], ['N', 0, -1]];
    for (const [r, dx, dy] of proben) {
      if (imFeld(x + dx, y + dy) && this.istStrasse(x + dx, y + dy)) return r;
    }
    return 'S';
  }

  private istStrasse(x: number, y: number): boolean {
    if (!this.karte) return false;
    if (y === ZEILE_AUSSENMAUER) return x === this.karte.stadttorX;
    if (y === ZEILE_KERNMAUER) return x === TOR_X;
    if (!imFeld(x, y)) return false;
    const b = this.karte.boden[idx(x, y)];
    return b === 'strasse' || b === 'uebergang' || (b === 'bruecke' && this.brueckeAufStrasse(x, y));
  }

  private brueckeAufStrasse(x: number, y: number): boolean {
    const k = this.karte!;
    for (const dy of [-1, 1]) {
      let yy = y + dy;
      while (imFeld(x, yy) && (k.boden[idx(x, yy)] === 'bruecke' || k.boden[idx(x, yy)] === 'wasser')) yy += dy;
      if (imFeld(x, yy) && k.boden[idx(x, yy)] === 'strasse') return true;
    }
    return false;
  }

  private readonly toene = new Map<string, THREE.MeshStandardMaterial>();
  private readonly statisch = new THREE.Group();

  /** Eingefärbte Materialien werden geteilt, damit die Grafikkarte wenig umschalten muss. */
  private getoent(m: THREE.MeshStandardMaterial, farbe: string): THREE.MeshStandardMaterial {
    const key = `${m.uuid}|${farbe}`;
    let neu = this.toene.get(key);
    if (!neu) {
      neu = m.clone();
      neu.color = new THREE.Color(farbe);
      this.toene.set(key, neu);
    }
    return neu;
  }

  /**
   * Fasst alle festen Teile der Landschaft zu wenigen großen Meshes zusammen (eins je Material und Schattenart).
   * Aus über tausend Zeichenaufrufen werden so ein paar Dutzend.
   */
  private verschmelzeStatisch(ziel: THREE.Object3D = this.szene): void {
    this.statisch.updateMatrixWorld(true);
    const eimer = new Map<string, { material: THREE.Material; schatten: boolean; geos: THREE.BufferGeometry[] }>();
    this.statisch.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      }
      if (!g.attributes.uv) {
        g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      g = g.applyMatrix4(m.matrixWorld);
      g.morphAttributes = {};
      const key = `${m.material.uuid}|${m.castShadow}`;
      let e = eimer.get(key);
      if (!e) {
        e = { material: m.material, schatten: m.castShadow, geos: [] };
        eimer.set(key, e);
      }
      e.geos.push(g);
    });
    for (const e of eimer.values()) {
      const geo = mergeGeometries(e.geos, false);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, e.material);
      mesh.castShadow = e.schatten;
      mesh.receiveShadow = true;
      ziel.add(mesh);
    }
    this.statisch.clear();
  }

  /** Das Gelände des Bezirks. Wird neu gebaut, wenn ein neuer Bezirk gelost wird. */
  private baueBezirk(k: Karte): void {
    for (const c of [...this.bezirkGruppe.children]) {
      this.bezirkGruppe.remove(c);
      (c as THREE.Mesh).geometry?.dispose();
    }
    if (!this.bezirkGruppe.parent) this.szene.add(this.bezirkGruppe);
    const setze = (o: THREE.Object3D, x: number, y: number, hoehe = BODEN_Y) => {
      const p = welt(x, y);
      o.position.x += p.x;
      o.position.z += p.z;
      o.position.y += hoehe;
      this.statisch.add(o);
      return o;
    };
    const boden = (x: number, y: number) => (imFeld(x, y) ? k.boden[idx(x, y)] : 'grenze');
    // Schon einmal gesetzte Kirchen-, Hallen- und Scheunenblöcke merken, damit nur ein Turm entsteht
    let kirchturm = false;
    for (let y = INNEN_OBEN; y <= INNEN_UNTEN; y++) {
      for (let x = 1; x < BREITE - 1; x++) {
        const b = boden(x, y);
        const r = zufall(x, y, k.seed % 97);
        switch (b) {
          case 'rasen':
          case 'hecke': {
            const farbe = new THREE.Color('#4f6b3a').offsetHSL((r - 0.5) * 0.01, (r - 0.5) * 0.04, (r - 0.5) * 0.018);
            setze(kiste(1, BODEN_Y, 1, `#${farbe.getHexString()}`), x, y, 0);
            if (b === 'hecke') setze(hecke(boden(x - 1, y) === 'hecke' || boden(x + 1, y) === 'hecke'), x, y);
            else if (r < 0.06) {
              const blume = this.teil(r < 0.03 ? 'natur/flower_redA' : 'natur/flower_yellowA');
              blume.position.set((r - 0.03) * 8, 0, 0.3);
              setze(blume, x, y);
            }
            break;
          }
          case 'strasse':
          case 'uebergang':
            this.strassenKachel(x, y, setze);
            if (b === 'uebergang') {
              setze(gleis(), x, y, 0.005).scale.set(1, 0.4, 1);
              setze(andreaskreuz(), x + 0.42, y + 0.42);
            }
            break;
          case 'pflaster':
            setze(this.modelle!.stadt.pavement.clone(), x, y, 0).traverse((m) => this.toenen(m, r < 0.5 ? '#b3aca0' : '#a9a294'));
            break;
          case 'kies':
            setze(this.modelle!.stadt.pavement.clone(), x, y, 0).traverse((m) => this.toenen(m, '#b7a991'));
            break;
          case 'feld': {
            setze(kiste(1, BODEN_Y * 0.8, 1, '#5a4430'), x, y, 0);
            const reihe = this.teil('natur/crops_dirtDoubleRow');
            setze(reihe, x, y, 0.02);
            const pflanze: Teil = r < 0.5 ? 'natur/crops_wheatStageB' : 'natur/crops_cornStageD';
            for (const dx of [-0.25, 0.25]) {
              const p = this.teil(pflanze);
              p.position.set(dx, 0, 0);
              p.scale.setScalar(pflanze === 'natur/crops_cornStageD' ? 0.55 : 0.8);
              setze(p, x, y);
            }
            break;
          }
          case 'wasser':
          case 'bruecke': {
            // Bachbett etwas tiefer, Wasseroberfläche knapp unter dem Rasen
            setze(kiste(1, 0.015, 1, '#3d4a30'), x, y, 0);
            setze(kiste(1, 0.035, 1, this.wasserMat), x, y, 0);
            // Uferkante zu Land hin
            for (const [dx, dy] of [[0, -1], [0, 1]] as const) {
              const n = boden(x + dx, y + dy);
              if (n !== 'wasser' && n !== 'bruecke') setze(kiste(1, 0.07, 0.08, '#5b4a36', 0, 0, dy * 0.46), x, y, 0);
            }
            if (b === 'bruecke') {
              const br = this.teil('natur/bridge_wood');
              br.rotation.y = Math.PI / 2;
              br.scale.set(1, 0.6, 1);
              setze(br, x, y, 0.0);
            }
            break;
          }
          case 'gleis':
            setze(kiste(1, BODEN_Y, 1, '#4f6b3a'), x, y, 0);
            setze(gleis(), x, y);
            break;
          case 'ruine':
            setze(kiste(1, BODEN_Y, 1, '#8c857a'), x, y, 0);
            setze(ruine(this.kasten, x * 31 + y), x, y);
            break;
          case 'kirche':
            setze(kiste(1, BODEN_Y, 1, '#a9a294'), x, y, 0);
            if (!kirchturm) {
              kirchturm = true;
              setze(turm(this.kasten, 'kirche'), x, y);
            } else setze(kirchenschiff(this.kasten), x, y);
            break;
          case 'halle':
            setze(kiste(1, BODEN_Y, 1, '#8f8a82'), x, y, 0);
            setze(halle(this.kasten, boden(x, y - 1) === 'halle' || boden(x, y + 1) === 'halle'), x, y);
            break;
          case 'container':
            setze(kiste(1, BODEN_Y, 1, '#8f8a82'), x, y, 0);
            setze(container(x * 13 + y * 7), x, y);
            break;
          case 'scheune':
            setze(kiste(1, BODEN_Y, 1, '#7d6a50'), x, y, 0);
            setze(scheune(this.kasten), x, y);
            break;
          default:
            setze(kiste(1, BODEN_Y, 1, '#4f6b3a'), x, y, 0);
        }
      }
    }
    // Laternen an der Straße, mit Licht für die Nacht
    const strassen: Array<[number, number]> = [];
    for (let y = INNEN_OBEN; y <= INNEN_UNTEN; y++) for (let x = 1; x < BREITE - 1; x++) if (boden(x, y) === 'strasse') strassen.push([x, y]);
    const ziele = [INNEN_OBEN + 3, Math.round((INNEN_OBEN + INNEN_UNTEN) / 2), INNEN_UNTEN - 2];
    ziele.forEach((zy, n) => {
      const kandidaten = strassen.filter(([, y]) => Math.abs(y - zy) <= 2);
      const wahl = kandidaten[Math.floor(zufall(n, zy, k.seed % 31) * kandidaten.length)] ?? strassen[n];
      if (!wahl) return;
      const lampe = this.teil('friedhof/lightpost-single');
      lampe.scale.setScalar(0.6);
      setze(lampe, wahl[0] + 0.4, wahl[1] - 0.4);
      const p = welt(wahl[0] + 0.4, wahl[1] - 0.4);
      this.laternenLichter[n]?.position.set(p.x, 0.9, p.z);
    });
    this.verschmelzeStatisch(this.bezirkGruppe);
  }

  /** Straßenkachel passend zu den Nachbarn: gerade, Kurve, Einmündung, Kreuzung. */
  private strassenKachel(x: number, y: number, setze: (o: THREE.Object3D, x: number, y: number, h?: number) => THREE.Object3D): void {
    const dirs: Richtung[] = [];
    if (this.istStrasse(x + 1, y)) dirs.push('O');
    if (this.istStrasse(x, y - 1)) dirs.push('N');
    if (this.istStrasse(x - 1, y)) dirs.push('W');
    if (this.istStrasse(x, y + 1)) dirs.push('S');
    let modell: StadtModell = 'road-straight';
    let basis: Richtung[] = STRASSE_BASIS.gerade;
    if (dirs.length === 4) {
      modell = 'road-intersection';
      basis = ['O', 'N', 'W', 'S'];
    } else if (dirs.length === 3) {
      modell = 'road-split';
      basis = STRASSE_BASIS.einmuendung;
    } else if (dirs.length === 2 && !(dirs.includes('O') && dirs.includes('W')) && !(dirs.includes('N') && dirs.includes('S'))) {
      modell = 'road-corner';
      basis = STRASSE_BASIS.kurve;
    }
    let ziel = dirs;
    if (dirs.length <= 1) ziel = dirs.includes('O') || dirs.includes('W') ? ['O', 'W'] : ['N', 'S'];
    const k = drehungFuer(basis, ziel) ?? 0;
    const o = this.modelle!.stadt[modell].clone();
    o.rotation.y = k * (Math.PI / 2);
    o.traverse((m) => this.toenen(m, '#bdb6ad'));
    setze(o, x, y, 0);
  }

  private toenen(o: THREE.Object3D, farbe: string): void {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = this.getoent(m.material as THREE.MeshStandardMaterial, farbe);
  }

  /** Alles außerhalb des Bezirks: Landstraße, Friedhof, Wald, Mauern, Hauptstadt. Wird einmal gebaut. */
  private baueUmgebung(): void {
    for (let y = 0; y < HOEHE; y++) {
      for (let x = 0; x < BREITE; x++) {
        const innen = y >= INNEN_OBEN && y <= INNEN_UNTEN && x > 0 && x < BREITE - 1;
        if (innen) continue;
        const p = welt(x, y);
        if (y < ZEILE_AUSSENMAUER) this.kachel('road-straight', x, y, Math.PI / 2, '#8a8580');
        else if (y > ZEILE_KERNMAUER && x > 0 && x < BREITE - 1) this.kachel('pavement', x, y, 0, '#d9c8b0');
        else this.kachel('grass', x, y, 0, '#7d8a72');
        let deko: THREE.Object3D | null = null;
        if (y > ZEILE_AUSSENMAUER && y < ZEILE_KERNMAUER) deko = y === ZEILE_SEITENTOR ? seitentor() : grenze();
        else if (y >= ZEILE_KERNMAUER && (y === ZEILE_KERNMAUER || x === 0 || x === BREITE - 1) && x !== TOR_X) {
          const eckturm = x === 0 || x === BREITE - 1;
          deko = this.teil(eckturm ? 'burg/tower-square' : 'burg/wall', '#a39b90');
          deko.scale.set(1, eckturm ? 0.95 : 0.75, 1);
          if (!eckturm) deko.rotation.y = Math.PI / 2;
          if (eckturm && y === ZEILE_KERNMAUER) {
            const fahne = this.teil('burg/flag');
            fahne.position.y = 1.25;
            deko.add(fahne);
          }
        }
        if (deko) {
          deko.position.set(p.x, BODEN_Y, p.z);
          this.statisch.add(deko);
        }
      }
    }

    // Hinter der Landstraße der Friedhof, an den Seiten dunkler Kiefernwald (ohne Schattenwurf, spart Leistung)
    this.friedhof();
    for (let y = 0; y < HOEHE; y++) {
      for (const x of [-2, -1, BREITE, BREITE + 1]) {
        const r = Math.abs(Math.sin(x * 4.1 + y * 7.7) * 9871.3) % 1;
        this.kachel('grass', x, y, 0, '#5d6b55');
        const baum = this.teil(r < 0.5 ? 'friedhof/pine' : 'friedhof/pine-crooked', '#9aa58f');
        const p = welt(x, y);
        baum.position.set(p.x + (r - 0.5) * 0.3, BODEN_Y, p.z);
        baum.rotation.y = r * 6.28;
        baum.scale.setScalar(0.5 + r * 0.15);
        baum.traverse((m) => (m.castShadow = false));
        this.statisch.add(baum);
      }
    }
    const umland = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat('#2a3326'));
    umland.rotation.x = -Math.PI / 2;
    umland.position.y = -0.01;
    umland.receiveShadow = true;
    this.szene.add(umland);
    // Die Hauptstadt hinter der Kernmauer: Häuser, Rathaus, Brunnen
    const skyline: StadtModell[] = ['building-small-b', 'building-small-c', 'building-garage', 'building-small-a', 'building-small-d'];
    for (let y = HOEHE; y < HOEHE + 6; y++) {
      for (let x = -2; x < BREITE + 2; x++) {
        const r = Math.abs(Math.sin(x * 3.3 + y * 5.1) * 3571.7) % 1;
        this.kachel('pavement', x, y, 0, '#d9c8b0');
        // Die ersten Reihen bleiben frei, damit die Häuser nicht die Sicht verdecken
        if (y < HOEHE + 2 || (x === TOR_X && y < HOEHE + 3)) continue;
        const haus = this.kachel(skyline[Math.floor(r * skyline.length)], x, y, Math.PI, undefined);
        haus.position.y = BODEN_Y;
      }
    }
    const rathaus = this.kachel('building-small-c', TOR_X, HOEHE + 3, Math.PI);
    rathaus.position.y = BODEN_Y;
    rathaus.scale.set(1.6, 1.7, 1.2);
    // Marktplatz der Hauptstadt
    const markt = (n: Teil, x: number, y: number, dreh: number, skala: number) => {
      const o = this.teil(n);
      const p = welt(x, y);
      o.position.set(p.x, BODEN_Y, p.z);
      o.rotation.y = dreh;
      o.scale.setScalar(skala);
      this.statisch.add(o);
    };
    markt('markt/fountain-round', 3, HOEHE - 1.1, 0, 0.6);
    markt('markt/stall-red', 0.6, HOEHE + 0.4, Math.PI / 2, 0.8);
    markt('markt/stall-green', 11.4, HOEHE + 0.4, -Math.PI / 2, 0.8);
    markt('markt/cart', 8.6, HOEHE + 0.5, 0.5, 0.75);
    for (const x of [1.6, 10.4]) markt('markt/lantern', x, HOEHE - 2.4, 0, 0.65);
    markt('stadtrand/detail-dumpster-closed', 12.1, HOEHE + 1.3, -Math.PI / 2, 0.9);
    this.endzeitDeko();
    this.verschmelzeStatisch();

    // Bewohner der Hauptstadt, die nervös herumstehen
    const leute: Array<[Figur, number, number, number]> = [
      ['character-female-a', 4.2, HOEHE - 1.1, Math.PI * 0.9],
      ['character-male-a', 8.3, HOEHE - 1.2, Math.PI * 1.1],
      ['character-worker', 9.4, HOEHE - 0.7, Math.PI],
    ];
    for (const [figur, x, y, dreh] of leute) {
      const f = this.figur(figur);
      const p = welt(x, y);
      f.obj.position.set(p.x, BODEN_Y, p.z);
      f.obj.rotation.y = dreh;
      f.obj.scale.setScalar(0.85);
      this.szene.add(f.obj);
      this.bewohner.push(f);
      this.spiele(f, 'idle');
    }
  }

  /** Wracks auf der Landstraße, Notlager in der Hauptstadt. */
  private endzeitDeko(): void {
    const setze = (o: THREE.Object3D, x: number, y: number, dreh: number, skala = 1, hoehe = BODEN_Y) => {
      const p = welt(x, y);
      o.position.set(p.x, hoehe, p.z);
      o.rotation.y = dreh;
      o.scale.multiplyScalar(skala);
      this.statisch.add(o);
    };
    // Liegengebliebene Autos draußen, verrußt
    setze(this.teil('autos/sedan', '#7d7670'), 1.6, 0.6, Math.PI / 2 + 0.3, 0.36);
    setze(this.teil('autos/taxi', '#8a8068'), 8.3, 0.4, -Math.PI / 2 + 0.15, 0.36);
    setze(this.teil('autos/police', '#7a7a80'), 11.2, 1.2, Math.PI / 2 - 0.5, 0.36);
    setze(this.teil('autos/van', '#6f6a66'), -1.4, 0.8, 0.2, 0.36);
    setze(this.teil('autos/debris-tire'), 4.2, 1.3, 0.8, 0.45, BODEN_Y + 0.13);
    setze(this.teil('autos/debris-door'), 5.4, 0.2, 1.2, 0.45);
    setze(this.teil('autos/cone'), 3.3, 1.4, 0, 0.35);
    setze(this.teil('stadtrand/detail-barrier-strong-damaged'), 6.4, 1.3, 0.1, 0.8);
    setze(this.teil('stadtrand/detail-barrier-strong-type-a'), 7.2, 1.35, -0.1, 0.8);
    setze(this.teil('autos/cone'), 9.7, 1.5, 0, 0.35);
    // Notlager der Geflüchteten in der Hauptstadt
    const unten = HOEHE;
    setze(this.teil('ueberleben/tent'), 1.4, unten + 1.6, 0.4, 1.1);
    setze(this.teil('ueberleben/tent'), 2.6, unten + 1.8, -0.3, 1.1);
    setze(this.teil('ueberleben/tent'), 10.4, unten + 1.7, 0.2, 1.1);
    setze(this.teil('ueberleben/campfire-pit'), 2, unten + 0.9, 0, 1.4);
    setze(this.teil('ueberleben/workbench'), 9.2, unten - 0.35, Math.PI, 1.3);
    setze(this.teil('ueberleben/barrel'), 7.6, HOEHE - 1.6, 0, 1.2);
    setze(this.teil('ueberleben/barrel'), 7.9, HOEHE - 1.4, 0, 1.2);
    setze(this.teil('ueberleben/box-large'), 4.6, HOEHE - 1.6, 0.3, 1.2);
    setze(this.teil('ueberleben/box'), 4.9, HOEHE - 1.2, 0.1, 1.2);
    setze(this.teil('ueberleben/signpost'), TOR_X + 0.6, ZEILE_AUSSENMAUER + 1.2, Math.PI, 1.3);
    // Lagerfeuer-Schein
    const feuer = new THREE.PointLight('#ff9a40', 0, 3, 1.6);
    const p = welt(2, unten + 0.9);
    feuer.position.set(p.x, 0.5, p.z);
    this.lagerfeuer = feuer;
    this.szene.add(feuer);
  }

  private lagerfeuer: THREE.PointLight | null = null;

  /** Der Friedhof hinter der Landstraße. Von hier kommen sie. */
  private friedhof(): void {
    const setze = (n: Teil, x: number, y: number, dreh = 0, skala = 1, schatten = true) => {
      const o = this.teil(n);
      const p = welt(x, y);
      o.position.set(p.x, BODEN_Y, p.z);
      o.rotation.y = dreh;
      o.scale.setScalar(skala);
      if (!schatten) o.traverse((m) => (m.castShadow = false));
      this.statisch.add(o);
      return o;
    };
    for (let y = -6; y < 0; y++) {
      for (let x = -2; x < BREITE + 2; x++) this.kachel('grass', x, y, 0, y >= -4 ? '#55604c' : '#4a5543');
    }
    // Eisenzaun zur Straße, mit Tor gegenüber dem Haupttor
    for (let x = -2; x < BREITE + 2; x++) {
      setze(x === TOR_X ? 'friedhof/iron-fence-border-gate' : 'friedhof/iron-fence', x, -1, Math.PI, 1);
    }
    // Gräberreihen
    const steine: Teil[] = ['friedhof/gravestone-cross', 'friedhof/gravestone-round', 'friedhof/gravestone-bevel', 'friedhof/gravestone-broken'];
    for (let y = -2; y >= -4; y--) {
      for (let x = 0; x < BREITE; x++) {
        if (x === TOR_X || (x <= 3 && y <= -3) || (x >= 9 && y <= -3)) continue;
        const r = Math.abs(Math.sin(x * 7.1 + y * 3.7) * 1371.3) % 1;
        if (r < 0.18) continue;
        setze(steine[Math.floor(r * steine.length)], x + (r - 0.5) * 0.2, y - 0.25, (r - 0.5) * 0.3, 0.75);
        setze('friedhof/grave', x, y + 0.15, 0, 0.55, false);
      }
    }
    setze('friedhof/crypt-small', 1.6, -3.6, 0, 1.2);
    setze('friedhof/crypt', 10.4, -3.5, 0, 1.3);
    setze('friedhof/lightpost-single', TOR_X - 0.8, -1.3, 0, 0.7);
    setze('friedhof/fire-basket', TOR_X + 0.8, -1.3, 0, 1);
    setze('friedhof/pumpkin-carved', 4.3, -1.5, 0.4, 0.9);
    setze('friedhof/pumpkin-carved', 8.6, -1.6, -0.6, 0.8);
    // Dahinter dunkler Wald
    for (let y = -6; y <= -5; y++) {
      for (let x = -2; x < BREITE + 2; x++) {
        const r = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        setze(r < 0.5 ? 'friedhof/pine' : 'friedhof/pine-crooked', x + (r - 0.5) * 0.4, y, r * 6.28, 0.55 + r * 0.2, false);
      }
    }
    // Schein vom Feuerkorb
    const glut = new THREE.PointLight('#ff8a3a', 0, 3.5, 1.6);
    const p = welt(TOR_X + 0.8, -1.3);
    glut.position.set(p.x, 0.5, p.z);
    this.feuerkorb = glut;
    this.szene.add(glut);
  }

  private feuerkorb: THREE.PointLight | null = null;

  private figur(name: Figur): { obj: THREE.Object3D; mixer: THREE.AnimationMixer; aktionen: Map<string, THREE.AnimationAction> } {
    const vorlage = this.modelle!.figuren[name];
    const obj = SkeletonUtils.clone(vorlage.szene);
    const mixer = new THREE.AnimationMixer(obj);
    const aktionen = new Map<string, THREE.AnimationAction>();
    for (const clip of vorlage.animationen) aktionen.set(clip.name, mixer.clipAction(clip));
    return { obj, mixer, aktionen };
  }

  private spiele(
    f: { mixer: THREE.AnimationMixer; aktionen: Map<string, THREE.AnimationAction>; aktuell?: string },
    name: string,
    einmal = false,
    tempo = 1,
  ): void {
    const a = f.aktionen.get(name);
    if (!a) return;
    if (f.aktuell === name && !einmal) {
      a.timeScale = tempo;
      return;
    }
    const alt = f.aktuell ? f.aktionen.get(f.aktuell) : undefined;
    a.reset();
    a.timeScale = tempo;
    a.setLoop(einmal ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = einmal;
    a.play();
    if (alt && alt !== a) a.crossFadeFrom(alt, 0.2, false);
    f.aktuell = name;
    if (einmal && name !== 'die') {
      // Danach zurück zum Herumstehen
      const zurueck = (ev: { action: THREE.AnimationAction }) => {
        if (ev.action !== a) return;
        f.mixer.removeEventListener('finished', zurueck);
        this.spiele(f, 'idle');
      };
      f.mixer.addEventListener('finished', zurueck);
    }
  }

  private zombieModell(typ: GegnerId): Zombie3D {
    const f = this.figur('character-zombie');
    const a = AUSSEHEN[typ];
    if (a.farbe !== '#ffffff') {
      f.obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          const neu = (m.material as THREE.MeshStandardMaterial).clone();
          neu.color = new THREE.Color(a.farbe);
          m.material = neu;
        }
      });
    }
    f.obj.scale.set(...a.skala);
    const balken = new Balken(0.5, 'rot');
    balken.gruppe.position.y = 0.95 / a.skala[1];
    f.obj.add(balken.gruppe);
    const z: Zombie3D = { ...f, aktuell: '', typ, x: 0, y: 0, balken };
    this.spiele(z, a.gang, false, a.tempo);
    return z;
  }

  // ---------- Laufende Aktualisierung ----------

  private aktualisiereBauten(a: Ansicht): void {
    for (let i = 0; i < a.bauten.length; i++) {
      const b = a.bauten[i];
      const alt = this.bauten.get(i);
      if (!b) {
        if (alt) {
          this.bauGruppe.remove(alt.obj);
          this.bauten.delete(i);
        }
        continue;
      }
      const anteil = b.hp / b.maxHp;
      const stufe = anteil >= 0.98 ? 4 : Math.floor(anteil * 4);
      const x = i % BREITE;
      const mauer = b.id === 'aussenmauer' ? (a.mauerStufe[x] ?? 0) : 0;
      const key = `${b.id}:${stufe}:${mauer}`;
      if (alt && alt.key === key) {
        alt.balken?.setze(anteil);
        continue;
      }
      if (alt) this.bauGruppe.remove(alt.obj);
      const obj = this.bauModell(b.id, stufe / 4, mauer, i);
      const p = welt(x, Math.floor(i / BREITE));
      obj.position.set(p.x, BODEN_Y, p.z);
      if (b.id === 'holzwand') obj.rotation.y = this.wandDrehung(i, a.bauten);
      const balken = new Balken(0.7, 'gelb');
      balken.gruppe.position.y = b.id === 'armbrust' || b.id === 'molotow' ? 1.25 : 1.0;
      obj.add(balken.gruppe);
      balken.setze(anteil);
      // Turmkopf behält seine Blickrichtung
      const altKopf = (alt?.obj.userData.teile as TurmTeile | undefined)?.kopf;
      const neuKopf = (obj.userData.teile as TurmTeile | undefined)?.kopf;
      if (altKopf && neuKopf) neuKopf.rotation.y = altKopf.rotation.y;
      this.bauGruppe.add(obj);
      this.bauten.set(i, { key, obj, balken });
    }
  }

  /** Holzwände richten sich nach Nachbarwänden aus. */
  private wandDrehung(i: number, bauten: readonly (BauwerkZustand | null)[]): number {
    const x = i % BREITE;
    const istWand = (j: number) => bauten[j]?.id === 'holzwand';
    const links = x > 0 && istWand(i - 1);
    const rechts = x < BREITE - 1 && istWand(i + 1);
    const oben = istWand(i - BREITE);
    const unten = istWand(i + BREITE);
    return (oben || unten) && !(links || rechts) ? Math.PI / 2 : 0;
  }

  private aktualisiereZombies(gegner: readonly Gegner[], dt: number): void {
    const da = new Set<number>();
    for (const g of gegner) {
      da.add(g.nr);
      let z = this.zombies.get(g.nr);
      if (!z) {
        z = this.zombieModell(g.typ);
        z.x = g.x;
        z.y = g.y;
        this.szene.add(z.obj);
        this.zombies.set(g.nr, z);
      }
      const dx = g.x - z.x;
      const dy = g.y - z.y;
      if (dx * dx + dy * dy > 1e-6) {
        const ziel = Math.atan2(dx, dy);
        let diff = ziel - z.obj.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        z.obj.rotation.y += diff * Math.min(1, dt * 10);
      }
      z.x = g.x;
      z.y = g.y;
      const p = welt(g.x - 0.5, g.y - 0.5);
      // Kleiner Versatz je Zombie, damit eine Gruppe nicht wie einer aussieht
      const vx = (((g.nr * 0.618) % 1) - 0.5) * 0.35;
      const vz = (((g.nr * 0.414) % 1) - 0.5) * 0.25;
      z.obj.position.set(p.x + vx, BODEN_Y, p.z + vz);
      const a = AUSSEHEN[g.typ];
      if (g.beisst) this.spiele(z, 'attack-melee-right', false, 0.9);
      else this.spiele(z, a.gang, false, a.tempo * (g.bremse ? g.bremse.faktor : 1));
      z.balken.setze(g.hp / g.maxHp);
      z.mixer.update(dt);
    }
    for (const [nr, z] of this.zombies) {
      if (da.has(nr)) continue;
      this.zombies.delete(nr);
      if (istKern(Math.floor(z.y))) {
        this.szene.remove(z.obj);
        continue;
      }
      z.balken.gruppe.visible = false;
      this.spiele(z, 'die', true, 1.2);
      this.sterbende.push({ obj: z.obj, mixer: z.mixer, rest: 1.6 });
    }
    this.sterbende = this.sterbende.filter((s) => {
      s.rest -= dt;
      s.mixer.update(dt);
      if (s.rest < 0.5) s.obj.position.y -= dt * 0.6;
      if (s.rest <= 0) {
        this.szene.remove(s.obj);
        return false;
      }
      return true;
    });
  }

  private aktualisiereVorschau(v: Vorschau | null): void {
    const key = v ? `${v.i}:${v.art}:${v.ok}` : '';
    if (key === this.vorschauKey) return;
    this.vorschauKey = key;
    this.vorschauGruppe.clear();
    if (!v) return;
    const x = v.i % BREITE;
    const y = Math.floor(v.i / BREITE);
    const p = welt(x, y);
    const farbe = v.ok ? '#ffe08a' : '#ff5a50';
    const rahmen = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.98, 0.02, 0.98)),
      new THREE.LineBasicMaterial({ color: farbe }),
    );
    rahmen.position.set(p.x, BODEN_Y + 0.02, p.z);
    this.vorschauGruppe.add(rahmen);
    if (v.art === 'verstaerken' || v.art === 'abreissen') return;
    const geist = this.bauModell(v.art, 1, 0);
    const geistMat = new THREE.MeshStandardMaterial({ color: farbe, transparent: true, opacity: 0.55, depthWrite: false });
    geist.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = geistMat;
        m.castShadow = false;
      }
    });
    geist.position.set(p.x, BODEN_Y, p.z);
    this.vorschauGruppe.add(geist);
    const fern = BAUTEN[v.art].fern;
    if (fern) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(fern.reichweite - 0.04, fern.reichweite, 64),
        new THREE.MeshBasicMaterial({ color: farbe, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, BODEN_Y + 0.03, p.z);
      this.vorschauGruppe.add(ring);
      const flaeche = new THREE.Mesh(
        new THREE.CircleGeometry(fern.reichweite, 64),
        new THREE.MeshBasicMaterial({ color: farbe, transparent: true, opacity: 0.12, depthWrite: false }),
      );
      flaeche.rotation.x = -Math.PI / 2;
      flaeche.position.set(p.x, BODEN_Y + 0.025, p.z);
      this.vorschauGruppe.add(flaeche);
    }
  }

  private aktualisiereSpuren(lw: Uint16Array | null): void {
    if (lw === this.letzterLaufweg) return;
    this.letzterLaufweg = lw;
    let n = 0;
    if (lw) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < lw.length; i++) {
        // Nur die Hauptrouten zeigen, nicht jeden möglichen Schritt
        if (lw[i] < 3) continue;
        const p = welt(i % BREITE, Math.floor(i / BREITE));
        for (const [dx, dz] of [[-0.12, -0.15], [0.12, 0.15]]) {
          m.compose(new THREE.Vector3(p.x + dx, BODEN_Y + 0.015, p.z + dz), q, s);
          this.spuren.setMatrixAt(n++, m);
        }
      }
    }
    this.spuren.count = n;
    this.spuren.instanceMatrix.needsUpdate = true;
  }

  private licht(sekunden: number): void {
    const n = this.nachtWert;
    const tag = new THREE.Color('#59626c');
    const nacht = new THREE.Color('#0c0f1c');
    const himmel = tag.clone().lerp(nacht, n);
    (this.szene.background as THREE.Color).copy(himmel);
    (this.szene.fog as THREE.Fog).color.copy(himmel);
    (this.szene.fog as THREE.Fog).near = 30 - n * 10;
    this.hemi.intensity = 1.1 - n * 0.45;
    this.hemi.color.set('#c3cbd8').lerp(new THREE.Color('#5a6fa8'), n);
    this.sonne.intensity = 1.8 - n * 0.95;
    this.sonne.color.set('#ffd9b0').lerp(new THREE.Color('#8fa8ff'), n);
    const flackern = 1 + Math.sin(sekunden * 11) * 0.06 + Math.sin(sekunden * 23) * 0.04;
    for (const l of this.laternenLichter) l.intensity = (0.4 + n * 5) * flackern;
    this.kernLicht.intensity = (0.5 + n * 6) * flackern;
    if (this.feuerkorb) this.feuerkorb.intensity = (0.4 + n * 3.5) * (1 + Math.sin(sekunden * 13 + 1) * 0.15);
    if (this.lagerfeuer) this.lagerfeuer.intensity = (0.3 + n * 3) * (1 + Math.sin(sekunden * 17) * 0.15);
  }

  private aktualisiereEffekte(dt: number, sekunden: number): void {
    for (const e of this.effekte) {
      e.alter += dt;
      e.update(Math.min(1, e.alter / e.dauer), e);
    }
    const fertig = this.effekte.filter((e) => e.alter >= e.dauer);
    for (const e of fertig) {
      this.szene.remove(e.obj);
      if (e.licht) e.licht.intensity = 0;
    }
    this.effekte = this.effekte.filter((e) => e.alter < e.dauer);
    // Flammen an Türmen flackern
    const f = Math.floor(sekunden * 12);
    for (const b of this.bauten.values()) {
      const teile = b.obj.userData.teile as TurmTeile | undefined;
      teile?.flammen?.forEach((m, k) => m.scale.set(0.07, 0.07 + (((f + k * 3) % 4) * 0.02), 0.07));
      if (teile?.rad) teile.rad.rotation.z = sekunden * 0.8;
    }
  }

  // ---------- Effekte ----------

  private effekt(obj: THREE.Object3D, dauer: number, update: Effekt['update'], licht?: THREE.PointLight): void {
    this.szene.add(obj);
    this.effekte.push({ obj, alter: 0, dauer, update, licht });
  }

  private turmBei(x: number, y: number): Bau3D | undefined {
    return this.bauten.get(idx(Math.floor(x), Math.floor(y)));
  }

  private zieleTurm(vonX: number, vonY: number, nachX: number, nachY: number): void {
    const kopf = (this.turmBei(vonX, vonY)?.obj.userData.teile as TurmTeile | undefined)?.kopf;
    if (kopf) kopf.rotation.y = Math.atan2(nachX - vonX, nachY - vonY);
  }

  private bolzen(vonX: number, vonY: number, nachX: number, nachY: number): void {
    this.zieleTurm(vonX, vonY, nachX, nachY);
    const a = welt(vonX - 0.5, vonY - 0.5).setY(0.95);
    const b = welt(nachX - 0.5, nachY - 0.5).setY(0.35);
    const bolzen = kiste(0.03, 0.03, 0.3, mat('#e8e0d0', { leuchten: '#fff3c0', staerke: 0.6 }));
    bolzen.castShadow = false;
    bolzen.position.copy(a);
    bolzen.lookAt(b);
    this.effekt(bolzen, 0.18, (t) => bolzen.position.lerpVectors(a, b, t));
  }

  private feuer(x: number, y: number, r: number): void {
    const g = new THREE.Group();
    const p = welt(x - 0.5, y - 0.5);
    g.position.set(p.x, BODEN_Y, p.z);
    const flammen: THREE.Mesh[] = [];
    const farben = ['#ffd166', '#ff9a3c', '#e0452a'];
    for (let k = 0; k < 14; k++) {
      const w = (k / 14) * Math.PI * 2;
      const d = (0.25 + ((k * 0.37) % 1) * 0.75) * r * 0.8;
      const fl = kiste(0.12, 0.2, 0.12, mat(farben[k % 3], { leuchten: farben[k % 3], staerke: 2 }));
      fl.castShadow = false;
      fl.position.set(Math.cos(w) * d, 0, Math.sin(w) * d);
      flammen.push(fl);
      g.add(fl);
    }
    const licht = this.feuerLichter.find((l) => l.intensity === 0) ?? this.feuerLichter[0];
    licht.position.set(p.x, 0.8, p.z);
    this.effekt(
      g,
      1.6,
      (t, e) => {
        const takt = Math.floor(e.alter * 14);
        flammen.forEach((fl, k) => {
          const h = 0.15 + (((takt + k * 5) % 7) / 7) * 0.35;
          fl.scale.set(0.12 * (1 - t * 0.5), h * (1 - t), 0.12 * (1 - t * 0.5));
        });
        licht.intensity = 3 * (1 - t) * (0.85 + ((takt % 3) * 0.1));
      },
      licht,
    );
  }

  private falle(i: number): void {
    const teile = this.bauten.get(i)?.obj.userData.teile as TurmTeile | undefined;
    const st = teile?.stacheln;
    if (!st) return;
    this.effekt(new THREE.Object3D(), 0.45, (t) => {
      st.position.y = t < 0.2 ? -0.18 + (t / 0.2) * 0.2 : 0.02 - ((t - 0.2) / 0.8) * 0.2;
    });
  }

  private wolke(x: number, y: number, r: number): void {
    const p = welt(x - 0.5, y - 0.5);
    const kugel = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: '#9fb03c', transparent: true, opacity: 0.5, flatShading: true, depthWrite: false }),
    );
    kugel.position.set(p.x, 0.4, p.z);
    this.effekt(kugel, 1.5, (t) => {
      kugel.scale.setScalar(r * (0.4 + t * 0.8));
      (kugel.material as THREE.MeshStandardMaterial).opacity = 0.5 * (1 - t);
    });
  }

  private staub(x: number, y: number): void {
    const p = welt(x - 0.5, y - 0.5);
    const kugel = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: '#a09682', transparent: true, opacity: 0.6, flatShading: true, depthWrite: false }),
    );
    kugel.position.set(p.x, 0.3, p.z);
    this.effekt(kugel, 0.8, (t) => {
      kugel.scale.setScalar(0.3 + t * 0.7);
      (kugel.material as THREE.MeshStandardMaterial).opacity = 0.6 * (1 - t);
    });
  }

  private fleck(x: number, y: number, farbe: string, r: number, deckkraft: number): void {
    const p = welt(x - 0.5, y - 0.5);
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 7),
      new THREE.MeshStandardMaterial({ color: farbe, transparent: true, opacity: deckkraft, depthWrite: false, roughness: 0.4 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = (x * 7 + y * 3) % 6;
    m.position.set(p.x, BODEN_Y + 0.01, p.z);
    m.receiveShadow = true;
    this.flecken.add(m);
  }

  private text(x: number, y: number, text: string, farbe: string, dauer: number): void {
    const s = textSprite(text, farbe);
    const p = welt(x - 0.5, y - 0.5);
    s.position.set(p.x, 1.1, p.z);
    this.effekt(s, dauer, (t) => {
      s.position.y = 1.1 + t * 0.6;
      (s.material as THREE.SpriteMaterial).opacity = 1 - t;
    });
  }

  // ---------- Kamera ----------

  private kameraRichtung(): THREE.Vector3 {
    // Schräg von vorn (aus Richtung Hauptstadt) auf den Bezirk
    return new THREE.Vector3(0, Math.sin(THREE.MathUtils.degToRad(58)), Math.cos(THREE.MathUtils.degToRad(58)));
  }

  private passenderAbstand(): number {
    const richtung = this.kameraRichtung();
    const ecken = [
      new THREE.Vector3(-BREITE / 2, 0, -HOEHE / 2 - 0.2),
      new THREE.Vector3(BREITE / 2, 0, -HOEHE / 2 - 0.2),
      new THREE.Vector3(-BREITE / 2, 0, HOEHE / 2),
      new THREE.Vector3(BREITE / 2, 0, HOEHE / 2),
      new THREE.Vector3(-BREITE / 2, 1, -HOEHE / 2 + 2.5),
      new THREE.Vector3(BREITE / 2, 1, -HOEHE / 2 + 2.5),
    ];
    const k = this.kamera.clone();
    let lo = 5;
    let hi = 120;
    for (let n = 0; n < 30; n++) {
      const mitte = (lo + hi) / 2;
      k.position.copy(this.fokus).addScaledVector(richtung, mitte);
      k.lookAt(this.grundFokus());
      k.updateMatrixWorld();
      const passt = ecken.every((e) => {
        const v = e.clone().project(k);
        return Math.abs(v.x) <= 0.97 && Math.abs(v.y) <= 0.97 && v.z < 1;
      });
      if (passt) hi = mitte;
      else lo = mitte;
    }
    return hi;
  }

  private grundFokus(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 0.6);
  }

  private kameraSetzen(): void {
    const r = this.kameraRichtung();
    const abstand = this.grundAbstand * this.zoom;
    // Verschieben nur so weit, dass der Bezirk im Bild bleibt
    const grenzeX = (BREITE / 2) * (1 - this.zoom);
    const grenzeZ = (HOEHE / 2) * (1 - this.zoom);
    this.fokus.x = THREE.MathUtils.clamp(this.fokus.x, -grenzeX, grenzeX);
    this.fokus.z = THREE.MathUtils.clamp(this.fokus.z, 0.6 - grenzeZ, 0.6 + grenzeZ);
    this.kamera.position.copy(this.fokus).addScaledVector(r, abstand);
    if (this.wackeln > 0) {
      this.kamera.position.x += (Math.random() - 0.5) * 0.25;
      this.kamera.position.y += (Math.random() - 0.5) * 0.25;
    }
    this.kamera.lookAt(this.fokus);
  }

  private steuerung(): void {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.zeiger.size === 1) this.wischStrecke = 0;
      if (this.zeiger.size === 2) {
        const [a, b] = [...this.zeiger.values()];
        this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomStart = this.zoom;
        this.wischStrecke = 999;
      }
    });
    c.addEventListener('pointermove', (e) => {
      const alt = this.zeiger.get(e.pointerId);
      if (!alt) return;
      const neu = { x: e.clientX, y: e.clientY };
      this.zeiger.set(e.pointerId, neu);
      if (this.zeiger.size === 1) {
        const dx = neu.x - alt.x;
        const dy = neu.y - alt.y;
        this.wischStrecke += Math.abs(dx) + Math.abs(dy);
        if (this.wischStrecke > 10) {
          const proPixel = (this.grundAbstand * this.zoom * 0.62) / c.clientHeight;
          this.fokus.x -= dx * proPixel;
          this.fokus.z -= dy * proPixel * 1.25;
        }
      } else if (this.zeiger.size === 2) {
        const [a, b] = [...this.zeiger.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchStart > 0) this.zoom = THREE.MathUtils.clamp((this.zoomStart * this.pinchStart) / d, 0.4, 1);
      }
    });
    const ende = (e: PointerEvent) => {
      const war = this.zeiger.get(e.pointerId);
      this.zeiger.delete(e.pointerId);
      if (war && this.zeiger.size === 0 && this.wischStrecke <= 10 && this.tippen) {
        const k = this.kachelBei(e.clientX, e.clientY);
        if (k) this.tippen(k[0], k[1]);
      }
    };
    c.addEventListener('pointerup', ende);
    c.addEventListener('pointercancel', (e) => {
      this.zeiger.delete(e.pointerId);
      this.wischStrecke = 999;
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom = THREE.MathUtils.clamp(this.zoom * (1 + Math.sign(e.deltaY) * 0.1), 0.4, 1);
      },
      { passive: false },
    );
  }

  kachelBei(clientX: number, clientY: number): [number, number] | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const strahl = new THREE.Raycaster();
    strahl.setFromCamera(ndc, this.kamera);
    const ebene = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BODEN_Y);
    const punkt = new THREE.Vector3();
    if (!strahl.ray.intersectPlane(ebene, punkt)) return null;
    const x = Math.floor(punkt.x + BREITE / 2);
    const y = Math.floor(punkt.z + HOEHE / 2);
    if (x < 0 || y < 0 || x >= BREITE || y >= HOEHE) return null;
    // Bei der Außenmauer zählt auch ein Tipp knapp davor oder dahinter (sie ist hoch und schmal)
    if (Math.abs(y - ZEILE_AUSSENMAUER) === 1 && punkt.y >= 0) {
      const genau = punkt.z + HOEHE / 2 - y;
      if (y < ZEILE_AUSSENMAUER && genau > 0.8) return [x, ZEILE_AUSSENMAUER];
    }
    return [x, y];
  }
}
