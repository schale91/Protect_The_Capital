/** Spielstand eines Bezirks und alles, was zwischen den Nächten passiert. */
import { BAUTEN, type BauId, MAUER, START } from './data';
import {
  BREITE,
  GRUNDKARTE,
  TOR_X,
  ZEILE_AUSSENMAUER,
  ZEILE_KERNMAUER,
  bodenBebaubar,
  idx,
} from './karte';
import { type NachtEingabe, type Nachtbilanz } from './nacht';
import { mischeSeed } from './rng';

export interface Spielstand {
  version: 1;
  weltSeed: number;
  epoche: number;
  /** Die nächste Nacht. */
  nacht: number;
  schrott: number;
  kernHp: number;
  kernMax: number;
  /** Eigene Bauwerke je Kachel-Index. */
  bauten: Record<number, BauId>;
  /** Verstärkungsstufe der Außenmauer je Spalte. */
  mauerStufe: Record<number, number>;
  gefallen: boolean;
  letzteBilanz: Nachtbilanz | null;
}

export function neuerSpielstand(weltSeed: number, epoche = 1): Spielstand {
  return {
    version: 1,
    weltSeed: weltSeed >>> 0,
    epoche,
    nacht: 1,
    schrott: START.schrott,
    kernHp: START.kernHp,
    kernMax: START.kernHp,
    bauten: {},
    mauerStufe: {},
    gefallen: false,
    letzteBilanz: null,
  };
}

export function mauerHp(stufe: number): number {
  return BAUTEN.aussenmauer.hp + MAUER.hpProStufe * stufe;
}

/** Baut die Eingabe für die Nachtsimulation. Über Tag wird alles Stehende repariert. */
export function nachtEingabe(s: Spielstand): NachtEingabe {
  const bauten: NachtEingabe['bauten'][number][] = [];
  for (let x = 1; x < BREITE - 1; x++) {
    bauten.push({ i: idx(x, ZEILE_AUSSENMAUER), id: 'aussenmauer', maxHp: mauerHp(s.mauerStufe[x] ?? 0) });
  }
  bauten.push({ i: idx(TOR_X, ZEILE_KERNMAUER), id: 'haupttor', maxHp: BAUTEN.haupttor.hp });
  for (const key of Object.keys(s.bauten)) {
    const i = Number(key);
    const id = s.bauten[i];
    bauten.push({ i, id, maxHp: BAUTEN[id].hp });
  }
  bauten.sort((a, b) => a.i - b.i);
  return {
    nacht: s.nacht,
    seed: mischeSeed(mischeSeed(s.weltSeed, s.epoche), s.nacht),
    kernHp: s.kernHp,
    bauten,
  };
}

export type BauFehler = 'belegt' | 'boden' | 'schrott';

export function kannBauen(s: Spielstand, i: number, id: BauId): BauFehler | null {
  const y = Math.floor(i / BREITE);
  if (!bodenBebaubar(GRUNDKARTE[i], y)) return 'boden';
  if (s.bauten[i]) return 'belegt';
  if (s.schrott < BAUTEN[id].kosten) return 'schrott';
  return null;
}

export function baue(s: Spielstand, i: number, id: BauId): BauFehler | null {
  const f = kannBauen(s, i, id);
  if (f) return f;
  s.bauten[i] = id;
  s.schrott -= BAUTEN[id].kosten;
  return null;
}

/** Abreißen gibt die Hälfte zurück. */
export function reisseAb(s: Spielstand, i: number): number {
  const id = s.bauten[i];
  if (!id) return 0;
  delete s.bauten[i];
  const zurueck = Math.floor(BAUTEN[id].kosten / 2);
  s.schrott += zurueck;
  return zurueck;
}

export function verstaerkeMauer(s: Spielstand, x: number): 'max' | 'schrott' | null {
  const stufe = s.mauerStufe[x] ?? 0;
  if (stufe >= MAUER.maxStufe) return 'max';
  const kosten = MAUER.kosten(stufe);
  if (s.schrott < kosten) return 'schrott';
  s.schrott -= kosten;
  s.mauerStufe[x] = stufe + 1;
  return null;
}

/** Übernimmt das Ergebnis einer Nacht in den Spielstand. */
export function nachDerNacht(s: Spielstand, b: Nachtbilanz): void {
  for (const i of b.zerstoerteKacheln) delete s.bauten[i];
  s.schrott += b.schrott + START.tageslohn;
  s.kernHp = Math.max(0, s.kernHp - b.kernSchaden);
  s.letzteBilanz = b;
  if (b.ausgang === 'gefallen' || s.kernHp <= 0) {
    s.gefallen = true;
    return;
  }
  s.kernHp = Math.min(s.kernMax, s.kernHp + START.kernHeilung);
  s.nacht++;
}

const SPEICHER = 'ptc.spielstand.v1';

export function lade(): Spielstand | null {
  try {
    const roh = localStorage.getItem(SPEICHER);
    if (!roh) return null;
    const s = JSON.parse(roh) as Spielstand;
    return s && s.version === 1 ? s : null;
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
