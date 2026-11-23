/**
 * Zeichnet den Bezirk. Die Welt wird in echter Pixelgröße (16 px je Kachel) auf eine kleine Leinwand gemalt
 * und dann ohne Weichzeichnen auf die Anzeige hochskaliert. So bleibt alles knackig pixelig.
 */
import { BAUTEN, type BauwerkId, GEGNER } from '../sim/data';
import { BREITE, GRUNDKARTE, HAEUSER, HOEHE, TOR_X, idx } from '../sim/karte';
import type { Ereignis, Gegner } from '../sim/nacht';
import type { BauwerkZustand } from '../sim/wege';
import {
  PX,
  gegnerBild,
  hash,
  leinwand,
  pixel,
  zeichneBauwerk,
  zeichneDraussen,
  zeichneGrenze,
  zeichneHaus,
  zeichneKies,
  zeichneLaterne,
  zeichneMauer,
  zeichnePflaster,
  zeichneRasen,
  zeichneRathaus,
  zeichneSeitentor,
  zeichneTor,
} from './sprites';

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
  /** Wie oft die Toten voraussichtlich über eine Kachel laufen. */
  laufweg: Uint16Array | null;
}

interface Effekt {
  art: 'bolzen' | 'feuer' | 'wolke' | 'falle' | 'staub' | 'text' | 'blitz';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r?: number;
  text?: string;
  farbe?: string;
  alter: number;
  dauer: number;
}

interface Fleck {
  x: number;
  y: number;
  art: 'blut' | 'truemmer' | 'schleim';
  s: number;
}

const WB = BREITE * PX;
const WH = HOEHE * PX;

const LATERNEN: Array<[number, number]> = [
  [TOR_X, 4],
  [TOR_X, 9],
  [TOR_X, 14],
  [TOR_X, 18],
];

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly welt: HTMLCanvasElement;
  private readonly w: CanvasRenderingContext2D;
  private readonly licht: HTMLCanvasElement;
  private readonly l: CanvasRenderingContext2D;
  private boden!: HTMLCanvasElement;
  private readonly gegnerBilder = new Map<string, HTMLCanvasElement>();
  private readonly bauBilder = new Map<string, HTMLCanvasElement>();
  private effekte: Effekt[] = [];
  private flecken: Fleck[] = [];
  private wackeln = 0;
  private skala = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    [this.welt, this.w] = leinwand(WB, WH);
    [this.licht, this.l] = leinwand(WB, WH);
    this.baueBoden();
  }

  /** Passt die Anzeige an den verfügbaren Platz an (ganzzahlige Vergrößerung je Gerätepixel). */
  groesse(platzB: number, platzH: number): void {
    const dpr = window.devicePixelRatio || 1;
    // Anzeige füllt den Platz; intern wird ganzzahlig vergrößert, der Browser skaliert den Rest pixelgenau.
    const passend = Math.min(platzB / WB, platzH / WH);
    const s = Math.max(1, Math.ceil(passend * dpr));
    this.skala = s;
    this.canvas.width = WB * s;
    this.canvas.height = WH * s;
    this.canvas.style.width = `${Math.floor(WB * passend)}px`;
    this.canvas.style.height = `${Math.floor(WH * passend)}px`;
  }

  /** Welche Kachel liegt unter dem Finger? */
  kachelBei(clientX: number, clientY: number): [number, number] | null {
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - r.left) / r.width) * BREITE);
    const y = Math.floor(((clientY - r.top) / r.height) * HOEHE);
    if (x < 0 || y < 0 || x >= BREITE || y >= HOEHE) return null;
    return [x, y];
  }

  neueNacht(): void {
    this.effekte = [];
    this.flecken = [];
  }

  /** Übernimmt Ereignisse aus der Simulation als Effekte. */
  ereignisse(liste: readonly Ereignis[]): void {
    for (const e of liste) {
      switch (e.art) {
        case 'bolzen':
          this.effekte.push({ art: 'bolzen', x: e.vonX, y: e.vonY, x2: e.nachX, y2: e.nachY, alter: 0, dauer: 0.15 });
          break;
        case 'brandflasche':
          this.effekte.push({ art: 'feuer', x: e.nachX, y: e.nachY, r: e.r, alter: 0, dauer: 1.6 });
          break;
        case 'falle': {
          const x = (e.i % BREITE) + 0.5;
          const y = Math.floor(e.i / BREITE) + 0.5;
          this.effekte.push({ art: 'falle', x, y, alter: 0, dauer: 0.3 });
          break;
        }
        case 'platzt':
          this.effekte.push({ art: 'wolke', x: e.x, y: e.y, r: e.r, alter: 0, dauer: 1.4 });
          this.effekte.push({ art: 'text', x: e.x, y: e.y - 0.4, text: 'Pfffft!', farbe: '#c9d36a', alter: 0, dauer: 1.2 });
          this.flecken.push({ x: e.x, y: e.y, art: 'schleim', s: hash(e.x * 100, e.y * 100) });
          break;
        case 'tot':
          this.flecken.push({ x: e.x, y: e.y, art: 'blut', s: hash(e.x * 97, e.y * 89) });
          this.effekte.push({
            art: 'text',
            x: e.x,
            y: e.y - 0.3,
            text: `+${GEGNER[e.typ].belohnung}`,
            farbe: '#e6c35c',
            alter: 0,
            dauer: 0.8,
          });
          break;
        case 'zerstoert': {
          const x = (e.i % BREITE) + 0.5;
          const y = Math.floor(e.i / BREITE) + 0.5;
          this.flecken.push({ x, y, art: 'truemmer', s: hash(x, y, 3) });
          this.effekte.push({ art: 'staub', x, y, alter: 0, dauer: 0.7 });
          break;
        }
        case 'kern':
          this.wackeln = 0.35;
          this.effekte.push({ art: 'blitz', x: 0, y: 0, alter: 0, dauer: 0.35 });
          this.effekte.push({ art: 'text', x: e.x + 0.5, y: HOEHE - 1.6, text: `-${e.schaden}`, farbe: '#ff6b5e', alter: 0, dauer: 1 });
          break;
        case 'ankunft':
          break;
      }
    }
  }

  zeichne(a: Ansicht, sekunden: number, dt: number): void {
    const w = this.w;
    w.imageSmoothingEnabled = false;
    w.drawImage(this.boden, 0, 0);
    this.zeichneMauern(a, sekunden);

    // Flecken (Blut, Schleim, Trümmer) unter allem anderen
    for (const f of this.flecken) this.zeichneFleck(f);

    if (a.laufweg && !a.nacht) this.zeichneLaufweg(a.laufweg);

    // Bauwerke
    const phase = Math.floor(sekunden * 6);
    for (let i = 0; i < a.bauten.length; i++) {
      const b = a.bauten[i];
      if (!b || b.id === 'aussenmauer' || b.id === 'haupttor') continue;
      const x = (i % BREITE) * PX;
      const y = Math.floor(i / BREITE) * PX;
      w.drawImage(this.bauBild(b.id, b.hp / b.maxHp, phase), x, y);
      if (b.hp < b.maxHp) this.balken(x + 2, y + 14, 12, b.hp / b.maxHp, '#c9b458');
    }

    // Gegner, nach Höhe sortiert, damit untere vorne stehen
    const sortiert = [...a.gegner].sort((p, q) => p.y - q.y || p.nr - q.nr);
    for (const g of sortiert) this.zeichneGegner(g, sekunden);

    this.zeichneEffekte(dt);
    if (a.vorschau) this.zeichneVorschau(a.vorschau);

    this.zeichneLicht(a, sekunden);

    // Auf die Anzeige skalieren, mit Wackeln bei Treffern auf die Hauptstadt
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d0b10';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    let ox = 0;
    let oy = 0;
    if (this.wackeln > 0) {
      this.wackeln = Math.max(0, this.wackeln - dt);
      ox = Math.round((Math.random() - 0.5) * 4 * this.skala);
      oy = Math.round((Math.random() - 0.5) * 4 * this.skala);
    }
    ctx.drawImage(this.welt, ox, oy, WB * this.skala, WH * this.skala);
    this.zeichneTexte();
  }

  // ---------- Teile ----------

  private baueBoden(): void {
    const [c, ctx] = leinwand(WB, WH);
    const [kachel, k] = leinwand(PX, PX);
    for (let y = 0; y < HOEHE; y++) {
      for (let x = 0; x < BREITE; x++) {
        k.clearRect(0, 0, PX, PX);
        const b = GRUNDKARTE[idx(x, y)];
        switch (b) {
          case 'draussen':
            zeichneDraussen(k, x, y);
            break;
          case 'rasen':
            zeichneRasen(k, x, y);
            break;
          case 'weg':
            zeichnePflaster(k, x, y);
            break;
          case 'kies':
          case 'haus':
            zeichneKies(k, x, y);
            break;
          case 'kern':
            zeichnePflaster(k, x, y, true);
            break;
          case 'grenze':
            zeichneGrenze(k, x, y);
            break;
          case 'seitentor':
            zeichneSeitentor(k);
            break;
          case 'kernmauer':
            zeichneMauer(k, 2, 1, true);
            break;
          case 'aussenmauer':
          case 'haupttor':
            zeichnePflaster(k, x, y);
            break;
        }
        ctx.drawImage(kachel, x * PX, y * PX);
      }
    }
    for (const h of HAEUSER) ctx.drawImage(zeichneHaus(h.b, h.h, h.dach), h.x * PX, h.y * PX);

    // Hauptstadt: Rathaus, Brunnen, Bänke
    ctx.drawImage(zeichneRathaus(), (TOR_X - 1) * PX, (HOEHE - 2) * PX);
    this.brunnen(ctx, 2 * PX + 8, (HOEHE - 1) * PX);
    for (const bx of [9, 10]) {
      pixel(ctx, bx * PX + 3, (HOEHE - 1) * PX + 2, 10, 3, '#6b4a2e');
      pixel(ctx, bx * PX + 3, (HOEHE - 1) * PX + 5, 1, 3, '#2b2b2b');
      pixel(ctx, bx * PX + 12, (HOEHE - 1) * PX + 5, 1, 3, '#2b2b2b');
    }

    // Laternen am Weg
    const [lat, lk] = leinwand(PX, PX);
    zeichneLaterne(lk);
    for (const [lx, ly] of LATERNEN) ctx.drawImage(lat, lx * PX - 8, ly * PX - 4, 12, 12);
    this.boden = c;
  }

  private brunnen(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    pixel(ctx, cx - 7, cy - 5, 14, 10, '#5f5b55');
    pixel(ctx, cx - 6, cy - 6, 12, 12, '#5f5b55');
    pixel(ctx, cx - 5, cy - 4, 10, 8, '#2f4d5e');
    pixel(ctx, cx - 4, cy - 3, 3, 1, '#5d8aa0');
    pixel(ctx, cx - 1, cy - 1, 2, 2, '#8c877d');
  }

  private zeichneMauern(a: Ansicht, sekunden: number): void {
    const w = this.w;
    const [kachel, k] = leinwand(PX, PX);
    for (let x = 1; x < BREITE - 1; x++) {
      const i = idx(x, 2);
      const b = a.bauten[i];
      if (!b) continue;
      k.clearRect(0, 0, PX, PX);
      zeichneMauer(k, a.mauerStufe[x] ?? 0, b.hp / b.maxHp);
      w.drawImage(kachel, x * PX, 2 * PX);
      if (b.hp < b.maxHp) this.balken(x * PX + 2, 2 * PX + 13, 12, b.hp / b.maxHp, '#c9b458');
    }
    const ti = idx(TOR_X, HOEHE - 3);
    const tor = a.bauten[ti];
    if (tor) {
      k.clearRect(0, 0, PX, PX);
      zeichneTor(k, tor.hp / tor.maxHp);
      w.drawImage(kachel, TOR_X * PX, (HOEHE - 3) * PX);
      if (tor.hp < tor.maxHp) this.balken(TOR_X * PX + 1, (HOEHE - 3) * PX + 13, 14, tor.hp / tor.maxHp, '#e07b28');
    } else if (Math.floor(sekunden * 4) % 2 === 0) {
      pixel(w, TOR_X * PX + 2, (HOEHE - 3) * PX + 2, 12, 12, 'rgba(200,40,30,0.35)');
    }
  }

  private bauBild(id: BauwerkId, anteil: number, phase: number): HTMLCanvasElement {
    const stufe = anteil >= 0.95 ? 4 : Math.floor(anteil * 4);
    const key = `${id}:${stufe}:${id === 'molotow' ? phase % 2 : 0}`;
    let c = this.bauBilder.get(key);
    if (!c) {
      const [neu, ctx] = leinwand(PX, PX);
      zeichneBauwerk(ctx, id, stufe / 4, phase % 2);
      this.bauBilder.set(key, neu);
      c = neu;
    }
    return c;
  }

  private zeichneGegner(g: Gegner, sekunden: number): void {
    const w = this.w;
    const schritt = Math.floor(sekunden * 4 + g.nr) % 2;
    const key = `${g.typ}:${schritt}`;
    let bild = this.gegnerBilder.get(key);
    if (!bild) {
      bild = gegnerBild(g.typ, schritt);
      this.gegnerBilder.set(key, bild);
    }
    // Kleiner Versatz je Gegner, damit eine Gruppe nicht wie ein einziger aussieht
    const vx = Math.round((hash(g.nr, 1) - 0.5) * 6);
    const vy = Math.round((hash(g.nr, 2) - 0.5) * 4);
    const wippen = g.beisst ? (Math.floor(sekunden * 10) % 2) : schritt;
    const x = Math.round(g.x * PX) - 6 + vx + (g.beisst ? wippen : 0);
    const y = Math.round(g.y * PX) - 8 + vy - (g.beisst ? 0 : wippen);
    // Schatten
    pixel(w, x + 3, y + 11, 6, 2, 'rgba(0,0,0,0.35)');
    w.drawImage(bild, x, y);
    if (g.brand) {
      const f = Math.floor(sekunden * 8) % 2 === 0;
      pixel(w, x + 4, y - 1, 2, 2, f ? '#ffd166' : '#e07b28');
      pixel(w, x + 7, y, 2, 2, f ? '#e07b28' : '#ffd166');
    }
    if (g.bremse) pixel(w, x + 2, y + 12, 8, 1, '#8fb3d9');
    if (g.hp < g.maxHp) this.balken(x + 1, y - 3, 10, g.hp / g.maxHp, '#d6312b');
  }

  private zeichneFleck(f: Fleck): void {
    const w = this.w;
    const x = Math.round(f.x * PX);
    const y = Math.round(f.y * PX);
    if (f.art === 'blut') {
      pixel(w, x - 3, y - 1, 6, 3, '#5a1212');
      pixel(w, x - 2, y - 2, 4, 5, '#5a1212');
      if (f.s < 0.5) pixel(w, x + 3, y + 2, 1, 1, '#5a1212');
    } else if (f.art === 'schleim') {
      pixel(w, x - 6, y - 3, 12, 6, 'rgba(120,140,40,0.55)');
      pixel(w, x - 4, y - 5, 8, 10, 'rgba(120,140,40,0.55)');
    } else {
      for (let k = 0; k < 7; k++) {
        const dx = Math.round((hash(k, f.s * 1000, 1) - 0.5) * 12);
        const dy = Math.round((hash(k, f.s * 1000, 2) - 0.5) * 12);
        pixel(w, x + dx, y + dy, 2, 2, k % 2 ? '#5e3b22' : '#6b665f');
      }
    }
  }

  private zeichneLaufweg(lw: Uint16Array): void {
    const w = this.w;
    for (let i = 0; i < lw.length; i++) {
      const n = lw[i];
      if (!n) continue;
      const x = (i % BREITE) * PX;
      const y = Math.floor(i / BREITE) * PX;
      const a = Math.min(0.55, 0.15 + n * 0.05);
      w.fillStyle = `rgba(190,40,40,${a})`;
      // Fußspuren
      w.fillRect(x + 4, y + 3, 2, 3);
      w.fillRect(x + 9, y + 9, 2, 3);
    }
  }

  private zeichneVorschau(v: Vorschau): void {
    const w = this.w;
    const x = (v.i % BREITE) * PX;
    const y = Math.floor(v.i / BREITE) * PX;
    if (v.art !== 'verstaerken' && v.art !== 'abreissen') {
      w.globalAlpha = 0.6;
      w.drawImage(this.bauBild(v.art, 1, 0), x, y);
      w.globalAlpha = 1;
      const fern = BAUTEN[v.art].fern;
      if (fern) {
        w.strokeStyle = v.ok ? 'rgba(255,230,150,0.8)' : 'rgba(255,90,80,0.8)';
        w.lineWidth = 1;
        w.beginPath();
        w.arc(x + 8, y + 8, fern.reichweite * PX, 0, Math.PI * 2);
        w.stroke();
      }
    }
    w.strokeStyle = v.ok ? '#ffe08a' : '#ff5a50';
    w.lineWidth = 1;
    w.strokeRect(x + 0.5, y + 0.5, PX - 1, PX - 1);
  }

  private zeichneEffekte(dt: number): void {
    const w = this.w;
    for (const e of this.effekte) {
      e.alter += dt;
      const t = e.alter / e.dauer;
      switch (e.art) {
        case 'bolzen': {
          const x1 = e.x * PX;
          const y1 = e.y * PX;
          const x2 = e.x2! * PX;
          const y2 = e.y2! * PX;
          const px = x1 + (x2 - x1) * Math.min(1, t * 1.5);
          const py = y1 + (y2 - y1) * Math.min(1, t * 1.5);
          pixel(w, Math.round(px) - 1, Math.round(py) - 1, 2, 2, '#e8e0d0');
          break;
        }
        case 'feuer': {
          const r = (e.r ?? 1) * PX;
          for (let k = 0; k < 14; k++) {
            const a = hash(k, Math.floor(e.alter * 10), 3) * Math.PI * 2;
            const d = hash(k, Math.floor(e.alter * 10), 4) * r * (1 - t * 0.5);
            const fx = Math.round(e.x * PX + Math.cos(a) * d);
            const fy = Math.round(e.y * PX + Math.sin(a) * d);
            pixel(w, fx, fy, 2, 2, k % 3 === 0 ? '#ffd166' : k % 3 === 1 ? '#e07b28' : '#b8342c');
          }
          break;
        }
        case 'wolke': {
          const r = (e.r ?? 1) * PX * (0.5 + t * 0.7);
          w.fillStyle = `rgba(150,170,60,${0.45 * (1 - t)})`;
          w.beginPath();
          w.arc(e.x * PX, e.y * PX, r, 0, Math.PI * 2);
          w.fill();
          break;
        }
        case 'falle': {
          const x = Math.round(e.x * PX);
          const y = Math.round(e.y * PX);
          for (const [dx, dy] of [[-4, -4], [0, -4], [4, -4], [-4, 0], [0, 0], [4, 0], [-4, 4], [0, 4], [4, 4]]) {
            pixel(w, x + dx, y + dy - 3, 1, 4, '#d8d8de');
          }
          break;
        }
        case 'staub': {
          w.fillStyle = `rgba(160,150,130,${0.6 * (1 - t)})`;
          w.beginPath();
          w.arc(e.x * PX, e.y * PX, 4 + t * 10, 0, Math.PI * 2);
          w.fill();
          break;
        }
        case 'blitz':
          w.fillStyle = `rgba(200,30,20,${0.3 * (1 - t)})`;
          w.fillRect(0, 0, WB, WH);
          break;
        case 'text':
          break;
      }
    }
    this.effekte = this.effekte.filter((e) => e.alter < e.dauer || e.art === 'text');
  }

  /** Texte werden in voller Auflösung gezeichnet, damit sie lesbar bleiben. */
  private zeichneTexte(): void {
    const ctx = this.ctx;
    const s = this.skala;
    ctx.font = `bold ${Math.round(6 * s)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (const e of this.effekte) {
      if (e.art !== 'text') continue;
      const t = e.alter / e.dauer;
      ctx.globalAlpha = Math.max(0, 1 - t);
      const x = e.x * PX * s;
      const y = (e.y * PX - t * 8) * s;
      ctx.fillStyle = '#000';
      ctx.fillText(e.text!, x + s * 0.6, y + s * 0.6);
      ctx.fillStyle = e.farbe ?? '#fff';
      ctx.fillText(e.text!, x, y);
    }
    ctx.globalAlpha = 1;
    this.effekte = this.effekte.filter((e) => e.alter < e.dauer);
  }

  private zeichneLicht(a: Ansicht, sekunden: number): void {
    const l = this.l;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, WB, WH);
    l.fillStyle = a.nacht ? 'rgba(10,8,28,0.62)' : 'rgba(40,20,10,0.12)';
    l.fillRect(0, 0, WB, WH);
    if (a.nacht) {
      l.globalCompositeOperation = 'destination-out';
      const flackern = 1 + Math.sin(sekunden * 9) * 0.04;
      const loch = (x: number, y: number, r: number, staerke: number) => {
        const g = l.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,0,0,${staerke})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        l.fillStyle = g;
        l.fillRect(x - r, y - r, r * 2, r * 2);
      };
      for (const [lx, ly] of LATERNEN) loch(lx * PX - 2, ly * PX + 2, 30 * flackern, 0.9);
      loch(TOR_X * PX + 8, (HOEHE - 1.2) * PX, 46, 0.95);
      for (let i = 0; i < a.bauten.length; i++) {
        const b = a.bauten[i];
        if (!b || !BAUTEN[b.id].fern) continue;
        loch((i % BREITE) * PX + 8, Math.floor(i / BREITE) * PX + 8, 22 * flackern, 0.8);
      }
      for (const e of this.effekte) {
        if (e.art === 'feuer') loch(e.x * PX, e.y * PX, 26 * flackern, 0.9);
      }
      l.globalCompositeOperation = 'source-over';
      // Warmer Schein auf den Lichtern
      for (const e of this.effekte) {
        if (e.art !== 'feuer') continue;
        l.fillStyle = 'rgba(255,140,40,0.10)';
        l.beginPath();
        l.arc(e.x * PX, e.y * PX, 18, 0, Math.PI * 2);
        l.fill();
      }
    }
    this.w.drawImage(this.licht, 0, 0);
  }

  private balken(x: number, y: number, b: number, anteil: number, farbe: string): void {
    pixel(this.w, x, y, b, 2, '#1a1420');
    pixel(this.w, x, y, Math.max(1, Math.round(b * Math.max(0, anteil))), 2, farbe);
  }
}
