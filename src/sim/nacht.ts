/**
 * Die Nacht: deterministische Simulation eines Angriffs.
 *
 * Gleiche Eingabe ergibt immer das gleiche Ergebnis. So kann später der Server um 18 Uhr rechnen
 * und das Handy denselben Angriff als Wiederholung abspielen.
 */
import {
  BAUTEN,
  type BauwerkId,
  GEGNER,
  GEGNER_REIHENFOLGE,
  type GegnerId,
  NACHT,
  WELLE,
} from './data';
import { BREITE, type Boden, GRUNDKARTE, HOEHE, idx, istKern } from './karte';
import { Rng } from './rng';
import { type BauwerkZustand, berechneFeld, naechsterSchritt } from './wege';

export interface NachtEingabe {
  nacht: number;
  seed: number;
  kernHp: number;
  /** Bauwerk je Kachel (Index), inklusive Außenmauer und Haupttor. */
  bauten: ReadonlyArray<{ i: number; id: BauwerkId; maxHp: number }>;
}

export interface Gegner {
  nr: number;
  typ: GegnerId;
  x: number;
  y: number;
  tx: number;
  ty: number;
  ziel: [number, number] | null;
  hp: number;
  maxHp: number;
  brand: { proSekunde: number; rest: number } | null;
  bremse: { faktor: number; rest: number } | null;
  beisst: boolean;
}

export type Ereignis =
  | { art: 'bolzen'; vonX: number; vonY: number; nachX: number; nachY: number }
  | { art: 'brandflasche'; vonX: number; vonY: number; nachX: number; nachY: number; r: number }
  | { art: 'falle'; i: number }
  | { art: 'platzt'; x: number; y: number; r: number }
  | { art: 'tot'; x: number; y: number; typ: GegnerId }
  | { art: 'zerstoert'; i: number; id: BauwerkId }
  | { art: 'kern'; x: number; schaden: number }
  | { art: 'ankunft'; typ: GegnerId; x: number };

export type Ausgang = 'gehalten' | 'ueberstanden' | 'gefallen';

export interface Nachtbilanz {
  nacht: number;
  ausgang: Ausgang;
  dauer: number;
  getoetet: Record<GegnerId, number>;
  durchgekommen: number;
  kernSchaden: number;
  schrott: number;
  zerstoert: Partial<Record<BauwerkId, number>>;
  /** Kacheln, deren Bauwerk zerstört wurde. */
  zerstoerteKacheln: number[];
  treffer: Partial<Record<BauwerkId, number>>;
  geplatzt: number;
  auszeichnungen: string[];
}

interface Ankunft {
  zeit: number;
  typ: GegnerId;
  x: number;
}

/** Plant die Welle einer Nacht. */
export function planeWelle(nacht: number, rng: Rng): Ankunft[] {
  const anzahl = WELLE.anzahl(nacht);
  const dauer = WELLE.ankunftsDauer(anzahl);
  const typen = GEGNER_REIHENFOLGE.filter((t) => GEGNER[t].abNacht <= nacht);
  const summe = typen.reduce((s, t) => s + GEGNER[t].gewicht, 0);
  const liste: Ankunft[] = [];
  for (let k = 0; k < anzahl; k++) {
    let w = rng.next() * summe;
    let typ = typen[0];
    for (const t of typen) {
      w -= GEGNER[t].gewicht;
      if (w < 0) {
        typ = t;
        break;
      }
    }
    // Auf ganze Simulationsschritte runden, damit die Reihenfolge eindeutig ist.
    const zeit = Math.round((rng.next() * dauer) / NACHT.dt) * NACHT.dt;
    liste.push({ zeit, typ, x: rng.int(1, BREITE - 2) });
  }
  liste.sort((a, b) => a.zeit - b.zeit);
  return liste;
}

const leereZaehlung = (): Record<GegnerId, number> => ({ schlurfi: 0, sprinter: 0, pupsbeule: 0 });

export class Nachtsim {
  readonly boden: Boden[] = [...GRUNDKARTE];
  readonly bauten: (BauwerkZustand | null)[] = new Array(BREITE * HOEHE).fill(null);
  gegner: Gegner[] = [];
  zeit = 0;
  kernHp: number;
  ende: Ausgang | null = null;
  /** Ereignisse des letzten Schritts (für Grafik und Ton). */
  ereignisse: Ereignis[] = [];
  dist: Float64Array;

  private readonly plan: Ankunft[];
  private planPos = 0;
  private naechsteNr = 1;
  private feldVeraltet = false;
  private readonly bilanz: Nachtbilanz;
  private readonly hpFaktor: number;

  constructor(readonly eingabe: NachtEingabe) {
    this.kernHp = eingabe.kernHp;
    for (const b of eingabe.bauten) {
      this.bauten[b.i] = { id: b.id, hp: b.maxHp, maxHp: b.maxHp, abklingen: 0 };
    }
    this.dist = berechneFeld(this.boden, this.bauten);
    const rng = new Rng(eingabe.seed);
    this.plan = planeWelle(eingabe.nacht, rng);
    this.hpFaktor = WELLE.hpFaktor(eingabe.nacht);
    this.bilanz = {
      nacht: eingabe.nacht,
      ausgang: 'ueberstanden',
      dauer: 0,
      getoetet: leereZaehlung(),
      durchgekommen: 0,
      kernSchaden: 0,
      schrott: 0,
      zerstoert: {},
      zerstoerteKacheln: [],
      treffer: {},
      geplatzt: 0,
      auszeichnungen: [],
    };
  }

  get anzahlGesamt(): number {
    return this.plan.length;
  }

  get nochUnterwegs(): number {
    return this.plan.length - this.planPos + this.gegner.length;
  }

  /** Ein Simulationsschritt. */
  schritt(): void {
    if (this.ende) return;
    const dt = NACHT.dt;
    this.ereignisse = [];

    this.ankuenfte();
    this.bewegen(dt);
    this.tuerme(dt);
    this.sterben();
    if (this.feldVeraltet) {
      this.dist = berechneFeld(this.boden, this.bauten);
      this.feldVeraltet = false;
    }

    this.zeit = Math.round((this.zeit + dt) * 1000) / 1000;
    if (this.kernHp <= 0) this.beende('gefallen');
    else if (this.planPos >= this.plan.length && this.gegner.length === 0) this.beende('gehalten');
    else if (this.zeit >= NACHT.maxDauer) this.beende('ueberstanden');
  }

  /** Rechnet die ganze Nacht durch. */
  bisZumEnde(): Nachtbilanz {
    while (!this.ende) this.schritt();
    return this.ergebnis();
  }

  ergebnis(): Nachtbilanz {
    return this.bilanz;
  }

  private beende(a: Ausgang): void {
    this.ende = a;
    this.bilanz.ausgang = a;
    this.bilanz.dauer = this.zeit;
    this.bilanz.auszeichnungen = auszeichnungen(this.bilanz);
  }

  private ankuenfte(): void {
    while (this.planPos < this.plan.length && this.plan[this.planPos].zeit <= this.zeit + 1e-9) {
      const a = this.plan[this.planPos++];
      const def = GEGNER[a.typ];
      const hp = Math.round(def.hp * this.hpFaktor);
      this.gegner.push({
        nr: this.naechsteNr++,
        typ: a.typ,
        x: a.x + 0.5,
        y: 0.5,
        tx: a.x,
        ty: 0,
        ziel: null,
        hp,
        maxHp: hp,
        brand: null,
        bremse: null,
        beisst: false,
      });
      this.ereignisse.push({ art: 'ankunft', typ: a.typ, x: a.x });
    }
  }

  private bewegen(dt: number): void {
    const weg: Gegner[] = [];
    for (const g of this.gegner) {
      const def = GEGNER[g.typ];
      if (g.brand) {
        g.hp -= g.brand.proSekunde * dt;
        g.brand.rest -= dt;
        if (g.brand.rest <= 1e-9) g.brand = null;
      }
      let tempo = def.tempo;
      if (g.bremse) {
        tempo *= g.bremse.faktor;
        g.bremse.rest -= dt;
        if (g.bremse.rest <= 1e-9) g.bremse = null;
      }
      if (g.hp <= 0) continue;

      g.beisst = false;
      if (!g.ziel) {
        const s = naechsterSchritt(g.tx, g.ty, this.boden, this.bauten, this.dist);
        if (!s) continue;
        const j = idx(s[0], s[1]);
        const bau = this.bauten[j];
        if (bau && BAUTEN[bau.id].blockiert) {
          // Im Weg steht etwas: draufbeißen.
          g.beisst = true;
          bau.hp -= def.biss * dt;
          if (bau.hp <= 0) this.zerstoere(j);
          continue;
        }
        g.ziel = s;
      }
      const zx = g.ziel[0] + 0.5;
      const zy = g.ziel[1] + 0.5;
      const dx = zx - g.x;
      const dy = zy - g.y;
      const rest = Math.abs(dx) + Math.abs(dy);
      const schritt = tempo * dt;
      if (rest <= schritt) {
        g.x = zx;
        g.y = zy;
        g.tx = g.ziel[0];
        g.ty = g.ziel[1];
        g.ziel = null;
        if (istKern(g.ty)) {
          this.kernHp -= def.kernSchaden;
          this.bilanz.kernSchaden += def.kernSchaden;
          this.bilanz.durchgekommen++;
          this.ereignisse.push({ art: 'kern', x: g.tx, schaden: def.kernSchaden });
          weg.push(g);
        }
      } else {
        g.x += Math.sign(dx) * Math.min(schritt, Math.abs(dx));
        g.y += Math.sign(dy) * Math.min(schritt, Math.abs(dy));
      }
    }
    if (weg.length) this.gegner = this.gegner.filter((g) => !weg.includes(g));
  }

  private tuerme(dt: number): void {
    for (let i = 0; i < this.bauten.length; i++) {
      const b = this.bauten[i];
      if (!b) continue;
      const def = BAUTEN[b.id];
      if (!def.fern && !def.falle) continue;
      b.abklingen -= dt;
      if (b.abklingen > 1e-9) continue;
      const bx = (i % BREITE) + 0.5;
      const by = Math.floor(i / BREITE) + 0.5;

      if (def.fern) {
        const f = def.fern;
        const r2 = f.reichweite * f.reichweite;
        let ziel: Gegner | null = null;
        let zielWert = Infinity;
        for (const g of this.gegner) {
          if (g.hp <= 0) continue;
          const dx = g.x - bx;
          const dy = g.y - by;
          if (dx * dx + dy * dy > r2) continue;
          const wert = this.dist[idx(Math.floor(g.x), Math.floor(g.y))];
          if (wert < zielWert || (wert === zielWert && ziel && g.nr < ziel.nr)) {
            zielWert = wert;
            ziel = g;
          }
        }
        if (!ziel) continue;
        b.abklingen = f.abklingzeit;
        this.bilanz.treffer[b.id] = (this.bilanz.treffer[b.id] ?? 0) + 1;
        if (f.flaeche <= 0) {
          ziel.hp -= f.schaden;
          this.ereignisse.push({ art: 'bolzen', vonX: bx, vonY: by, nachX: ziel.x, nachY: ziel.y });
        } else {
          const fr2 = f.flaeche * f.flaeche;
          const mx = ziel.x;
          const my = ziel.y;
          for (const g of this.gegner) {
            const dx = g.x - mx;
            const dy = g.y - my;
            if (dx * dx + dy * dy > fr2) continue;
            g.hp -= f.schaden;
            if (f.brand) g.brand = { proSekunde: f.brand.proSekunde, rest: f.brand.dauer };
          }
          this.ereignisse.push({ art: 'brandflasche', vonX: bx, vonY: by, nachX: mx, nachY: my, r: f.flaeche });
        }
      } else if (def.falle) {
        const fl = def.falle;
        let ausgeloest = false;
        for (const g of this.gegner) {
          if (g.hp <= 0) continue;
          if (idx(Math.floor(g.x), Math.floor(g.y)) !== i) continue;
          g.hp -= fl.schaden;
          g.bremse = { faktor: fl.bremse.faktor, rest: fl.bremse.dauer };
          ausgeloest = true;
        }
        if (ausgeloest) {
          b.abklingen = fl.abklingzeit;
          this.bilanz.treffer[b.id] = (this.bilanz.treffer[b.id] ?? 0) + 1;
          this.ereignisse.push({ art: 'falle', i });
        }
      }
    }
  }

  private sterben(): void {
    const tote = this.gegner.filter((g) => g.hp <= 0);
    if (!tote.length) return;
    this.gegner = this.gegner.filter((g) => g.hp > 0);
    for (const g of tote) {
      const def = GEGNER[g.typ];
      this.bilanz.getoetet[g.typ]++;
      this.bilanz.schrott += def.belohnung;
      this.ereignisse.push({ art: 'tot', x: g.x, y: g.y, typ: g.typ });
      if (def.platzt) {
        this.bilanz.geplatzt++;
        const r2 = def.platzt.radius * def.platzt.radius;
        for (let i = 0; i < this.bauten.length; i++) {
          const b = this.bauten[i];
          if (!b) continue;
          const dx = (i % BREITE) + 0.5 - g.x;
          const dy = Math.floor(i / BREITE) + 0.5 - g.y;
          if (dx * dx + dy * dy > r2) continue;
          b.hp -= def.platzt.schaden;
          if (b.hp <= 0) this.zerstoere(i);
        }
        this.ereignisse.push({ art: 'platzt', x: g.x, y: g.y, r: def.platzt.radius });
      }
    }
  }

  private zerstoere(i: number): void {
    const b = this.bauten[i];
    if (!b) return;
    this.bauten[i] = null;
    this.bilanz.zerstoert[b.id] = (this.bilanz.zerstoert[b.id] ?? 0) + 1;
    this.bilanz.zerstoerteKacheln.push(i);
    this.ereignisse.push({ art: 'zerstoert', i, id: b.id });
    this.feldVeraltet = true;
    // Wer gerade in diese Richtung lief, sucht sich neu einen Weg.
    for (const g of this.gegner) if (g.ziel && idx(g.ziel[0], g.ziel[1]) === i) g.ziel = null;
  }
}

/** Kleine Ehrungen nach jeder Nacht. Später mit Spielernamen. */
export function auszeichnungen(b: Nachtbilanz): string[] {
  const liste: string[] = [];
  const getoetet = b.getoetet.schlurfi + b.getoetet.sprinter + b.getoetet.pupsbeule;
  if (b.ausgang === 'gefallen') liste.push('Licht aus: Die Hauptstadt ist gefallen.');
  else if (b.kernSchaden === 0) liste.push('Weiße Weste: Kein Toter hat die Hauptstadt gesehen.');
  if (b.zerstoert.haupttor) liste.push('Tür auf, Tote rein: Das Haupttor ist zerlegt worden.');
  if (b.geplatzt > 0) {
    liste.push(`Nasenklammer-Orden: ${b.geplatzt} ${b.geplatzt === 1 ? 'Pupsbeule ist' : 'Pupsbeulen sind'} geplatzt.`);
  }
  if ((b.zerstoert.holzwand ?? 0) >= 2) liste.push(`Brennholz-Lieferant: ${b.zerstoert.holzwand} Holzwände zu Kleinholz verarbeitet.`);
  let bester: BauwerkId | null = null;
  for (const id of Object.keys(b.treffer) as BauwerkId[]) {
    if (!bester || (b.treffer[id] ?? 0) > (b.treffer[bester] ?? 0)) bester = id;
  }
  if (bester) liste.push(`Fleißigstes Bauwerk: ${BAUTEN[bester].name} mit ${b.treffer[bester]} Einsätzen.`);
  if (getoetet >= 30) liste.push(`Fließband-Medaille: ${getoetet} Tote zur Ruhe gebettet.`);
  return liste;
}
