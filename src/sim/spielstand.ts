/** Spielstand eines Bezirks und alles, was zwischen den Nächten passiert. */
import { BAUTEN, type BauId, type BauwerkId, MAUER, type Menge, ROHSTOFFE, type Rohstoff, START } from './data';
import {
  BEZIRKSTYPEN,
  BREITE,
  type BezirkTyp,
  type Karte,
  TOR_X,
  ZEILE_AUSSENMAUER,
  ZEILE_KERNMAUER,
  bodenBebaubar,
  erzeugeKarte,
  idx,
} from './karte';
import { type NachtEingabe, type Nachtbilanz } from './nacht';
import { Rng, mischeSeed } from './rng';

export interface Bezirk {
  /** Zählt hoch, jedes Mal wenn der Bezirk fällt und neu gelost wird. */
  nr: number;
  typ: BezirkTyp;
  seed: number;
}

export interface Tagesbericht {
  ertrag: Record<Rohstoff, number>;
  gegessen: number;
  zuzug: number;
  hunger: number;
  geflohen: number;
  /** Der Bezirk ist gefallen und wurde neu gelost. */
  bezirkGefallen: BezirkTyp | null;
}

export interface Spielstand {
  version: 2;
  weltSeed: number;
  epoche: number;
  /** Die nächste Nacht. */
  nacht: number;
  bezirk: Bezirk;
  lager: Record<Rohstoff, number>;
  bewohner: number;
  kernHp: number;
  kernMax: number;
  /** Bauwerke je Kachel-Index (Startgebäude und eigene). */
  bauten: Record<number, BauId>;
  /** Verstärkungsstufe der Außenmauer und des Stadttors je Spalte. */
  mauerStufe: Record<number, number>;
  gefallen: boolean;
  letzteBilanz: Nachtbilanz | null;
  letzterTag: Tagesbericht | null;
}

// ---------- Bezirk losen ----------

export function lose(weltSeed: number, epoche: number, nr: number): Bezirk {
  const seed = mischeSeed(mischeSeed(weltSeed, epoche * 101), nr * 7919);
  const rng = new Rng(seed);
  return { nr, typ: BEZIRKSTYPEN[rng.int(0, BEZIRKSTYPEN.length - 1)], seed };
}

const kartenCache = new Map<string, Karte>();
export function karte(s: Spielstand): Karte {
  const key = `${s.bezirk.typ}:${s.bezirk.seed}`;
  let k = kartenCache.get(key);
  if (!k) {
    k = erzeugeKarte(s.bezirk.typ, s.bezirk.seed);
    kartenCache.set(key, k);
  }
  return k;
}

function bezirkEinrichten(s: Spielstand, bezirk: Bezirk, faktor: number): void {
  s.bezirk = bezirk;
  s.bauten = {};
  s.mauerStufe = {};
  for (const b of karte(s).startBauten) s.bauten[b.i] = b.id;
  s.lager = { holz: 0, schrott: 0, nahrung: 0 };
  for (const r of ROHSTOFFE) s.lager[r] = Math.round(START.lager[r] * faktor);
  s.bewohner = wohnraum(s);
}

export function neuerSpielstand(weltSeed: number, epoche = 1): Spielstand {
  const s: Spielstand = {
    version: 2,
    weltSeed: weltSeed >>> 0,
    epoche,
    nacht: 1,
    bezirk: { nr: 1, typ: 'vorstadt', seed: 0 },
    lager: { holz: 0, schrott: 0, nahrung: 0 },
    bewohner: 0,
    kernHp: START.kernHp,
    kernMax: START.kernHp,
    bauten: {},
    mauerStufe: {},
    gefallen: false,
    letzteBilanz: null,
    letzterTag: null,
  };
  bezirkEinrichten(s, lose(s.weltSeed, epoche, 1), 1);
  return s;
}

// ---------- Bewohner und Besatzung ----------

export function wohnraum(s: Spielstand): number {
  let n = 0;
  for (const id of Object.values(s.bauten)) n += BAUTEN[id].wohnraum ?? 0;
  return n;
}

const VORRANG: Record<string, number> = { verteidigung: 0, besonders: 1, versorgung: 2, feste: 3 };

/** Wer arbeitet wo? Erst die Verteidigung, dann die Besonderen, dann die Versorgung. */
export function besetzung(s: Spielstand): { aktiv: Set<number>; gebraucht: number; frei: number } {
  const stellen = Object.keys(s.bauten)
    .map(Number)
    .filter((i) => BAUTEN[s.bauten[i]].arbeiter > 0)
    .sort((a, b) => VORRANG[BAUTEN[s.bauten[a]].gruppe] - VORRANG[BAUTEN[s.bauten[b]].gruppe] || a - b);
  const aktiv = new Set<number>();
  let frei = s.bewohner;
  let gebraucht = 0;
  for (const i of stellen) {
    const n = BAUTEN[s.bauten[i]].arbeiter;
    gebraucht += n;
    if (frei >= n) {
      aktiv.add(i);
      frei -= n;
    }
  }
  return { aktiv, gebraucht, frei };
}

function aktivesGebaeude(s: Spielstand, id: BauId): number | null {
  const { aktiv } = besetzung(s);
  for (const key of Object.keys(s.bauten)) {
    const i = Number(key);
    if (s.bauten[i] === id && (BAUTEN[id].arbeiter === 0 || aktiv.has(i))) return i;
  }
  return null;
}

// ---------- Kosten ----------

export function kosten(s: Spielstand, id: BauId): Menge {
  const basis = BAUTEN[id].kosten;
  const rabatt = aktivesGebaeude(s, 'baumarkt') !== null ? 1 - START.baumarktRabatt : 1;
  const k: Menge = {};
  for (const r of ROHSTOFFE) if (basis[r]) k[r] = Math.ceil(basis[r]! * rabatt);
  return k;
}

export function bezahlbar(s: Spielstand, k: Menge): boolean {
  return ROHSTOFFE.every((r) => (k[r] ?? 0) <= s.lager[r]);
}

function bezahle(s: Spielstand, k: Menge): void {
  for (const r of ROHSTOFFE) s.lager[r] -= k[r] ?? 0;
}

// ---------- Nacht vorbereiten ----------

function mauerHp(id: 'aussenmauer' | 'stadttor', stufe: number): number {
  return BAUTEN[id].hp + MAUER.hpProStufe * stufe;
}

/** Baut die Eingabe für die Nachtsimulation. Über Tag wird alles Stehende repariert. */
export function nachtEingabe(s: Spielstand): NachtEingabe {
  const k = karte(s);
  const { aktiv } = besetzung(s);
  const bauten: NachtEingabe['bauten'][number][] = [];
  for (let x = 1; x < BREITE - 1; x++) {
    const id = x === k.stadttorX ? 'stadttor' : 'aussenmauer';
    bauten.push({ i: idx(x, ZEILE_AUSSENMAUER), id, maxHp: mauerHp(id, s.mauerStufe[x] ?? 0), aktiv: true, reichweitePlus: 0 });
  }
  bauten.push({ i: idx(TOR_X, ZEILE_KERNMAUER), id: 'haupttor', maxHp: BAUTEN.haupttor.hp, aktiv: true, reichweitePlus: 0 });

  // Glockentürme geben Türmen in der Nähe mehr Reichweite
  const boni: Array<{ x: number; y: number; umkreis: number; plus: number }> = [];
  for (const key of Object.keys(s.bauten)) {
    const i = Number(key);
    const bonus = BAUTEN[s.bauten[i]].reichweiteBonus;
    if (bonus && aktiv.has(i)) boni.push({ x: i % BREITE, y: Math.floor(i / BREITE), ...bonus });
  }
  for (const key of Object.keys(s.bauten)) {
    const i = Number(key);
    const id = s.bauten[i];
    const x = i % BREITE;
    const y = Math.floor(i / BREITE);
    let plus = 0;
    for (const b of boni) if ((b.x - x) * (b.x - x) + (b.y - y) * (b.y - y) <= b.umkreis * b.umkreis) plus = Math.max(plus, b.plus);
    bauten.push({ i, id, maxHp: BAUTEN[id].hp, aktiv: BAUTEN[id].arbeiter === 0 || aktiv.has(i), reichweitePlus: plus });
  }
  bauten.sort((a, b) => a.i - b.i);
  return {
    nacht: s.nacht,
    seed: mischeSeed(mischeSeed(s.weltSeed, s.epoche), s.nacht),
    kernHp: s.kernHp,
    boden: k.boden,
    bauten,
  };
}

// ---------- Bauen ----------

export type BauFehler = 'belegt' | 'boden' | 'kosten';

export function kannBauen(s: Spielstand, i: number, id: BauId): BauFehler | null {
  const y = Math.floor(i / BREITE);
  if (!bodenBebaubar(karte(s).boden[i], y)) return 'boden';
  if (s.bauten[i]) return 'belegt';
  if (!bezahlbar(s, kosten(s, id))) return 'kosten';
  return null;
}

export function baue(s: Spielstand, i: number, id: BauId): BauFehler | null {
  const f = kannBauen(s, i, id);
  if (f) return f;
  bezahle(s, kosten(s, id));
  s.bauten[i] = id;
  return null;
}

/** Abreißen gibt die Hälfte zurück. Einzigartiges (Bezirkswache, Glockenturm, ...) bleibt stehen. */
export function reisseAb(s: Spielstand, i: number): Menge | null {
  const id = s.bauten[i];
  if (!id || BAUTEN[id].einzigartig) return null;
  delete s.bauten[i];
  const zurueck: Menge = {};
  for (const r of ROHSTOFFE) {
    const n = Math.floor((BAUTEN[id].kosten[r] ?? 0) / 2);
    if (n) {
      zurueck[r] = n;
      s.lager[r] += n;
    }
  }
  s.bewohner = Math.min(s.bewohner, wohnraum(s));
  return zurueck;
}

export function mauerKosten(s: Spielstand, x: number): Menge {
  return MAUER.kosten(s.mauerStufe[x] ?? 0);
}

export function verstaerkeMauer(s: Spielstand, x: number): 'max' | 'kosten' | null {
  const stufe = s.mauerStufe[x] ?? 0;
  if (stufe >= MAUER.maxStufe) return 'max';
  const k = MAUER.kosten(stufe);
  if (!bezahlbar(s, k)) return 'kosten';
  bezahle(s, k);
  s.mauerStufe[x] = stufe + 1;
  return null;
}

// ---------- Nach der Nacht ----------

function bezirkFaellt(s: Spielstand): BezirkTyp {
  bezirkEinrichten(s, lose(s.weltSeed, s.epoche, s.bezirk.nr + 1), START.wiederaufbauFaktor);
  return s.bezirk.typ;
}

/** Übernimmt das Ergebnis einer Nacht und rechnet den folgenden Tag ab. */
export function nachDerNacht(s: Spielstand, b: Nachtbilanz): Tagesbericht {
  const bericht: Tagesbericht = {
    ertrag: { holz: 0, schrott: 0, nahrung: 0 },
    gegessen: 0,
    zuzug: 0,
    hunger: 0,
    geflohen: 0,
    bezirkGefallen: null,
  };
  let wacheWeg = false;
  for (const i of b.zerstoerteKacheln) {
    if (s.bauten[i] === 'bezirkswache') wacheWeg = true;
    delete s.bauten[i];
  }
  s.letzteBilanz = b;
  s.kernHp = Math.max(0, s.kernHp - b.kernSchaden);
  s.lager.schrott += b.schrott;
  bericht.ertrag.schrott += b.schrott;

  if (b.ausgang === 'gefallen' || s.kernHp <= 0) {
    s.gefallen = true;
    s.letzterTag = bericht;
    return bericht;
  }

  // Wer kein Dach mehr hat, flieht in die Hauptstadt
  const platz = wohnraum(s);
  if (s.bewohner > platz) {
    bericht.geflohen = s.bewohner - platz;
    s.bewohner = platz;
  }

  if (wacheWeg || s.bewohner <= 0) {
    bericht.bezirkGefallen = bezirkFaellt(s);
  } else {
    // Ertrag der besetzten Gebäude
    const { aktiv } = besetzung(s);
    for (const key of Object.keys(s.bauten)) {
      const i = Number(key);
      const def = BAUTEN[s.bauten[i]];
      if (!def.ertrag || (def.arbeiter > 0 && !aktiv.has(i))) continue;
      for (const r of ROHSTOFFE) {
        const n = def.ertrag[r] ?? 0;
        s.lager[r] += n;
        bericht.ertrag[r] += n;
      }
    }
    // Essen, Hunger, Zuzug
    const bedarf = s.bewohner * START.essenProKopf;
    if (s.lager.nahrung >= bedarf) {
      s.lager.nahrung -= bedarf;
      bericht.gegessen = bedarf;
      const ueberschuss = s.lager.nahrung - s.bewohner;
      if (s.bewohner < platz && ueberschuss >= 0) {
        bericht.zuzug = Math.min(platz - s.bewohner, ueberschuss >= 10 ? 2 : 1);
        s.bewohner += bericht.zuzug;
      }
    } else {
      bericht.gegessen = s.lager.nahrung;
      s.lager.nahrung = 0;
      bericht.hunger = 1;
      s.bewohner -= 1;
      if (s.bewohner <= 0) bericht.bezirkGefallen = bezirkFaellt(s);
    }
  }

  s.kernHp = Math.min(s.kernMax, s.kernHp + START.kernHeilung);
  s.nacht++;
  s.letzterTag = bericht;
  return bericht;
}

// ---------- Speichern ----------

const SPEICHER = 'ptc.spielstand.v2';

export function lade(): Spielstand | null {
  try {
    const roh = localStorage.getItem(SPEICHER);
    if (!roh) return null;
    const s = JSON.parse(roh) as Spielstand;
    return s && s.version === 2 ? s : null;
  } catch {
    return null;
  }
}

export function speichere(s: Spielstand): void {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(s));
  } catch {
    // Ohne Speicher geht es trotzdem weiter, nur eben nicht über einen Neustart hinaus.
  }
}

export function istEigenesBauwerk(id: BauwerkId | undefined): id is BauId {
  return !!id && BAUTEN[id].gruppe !== 'feste';
}
