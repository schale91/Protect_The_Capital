/**
 * Spielinhalte als Daten. Neue Gebäude und Gegner kommen hierher, möglichst ohne neue Sonderlogik.
 * Einheiten: Entfernungen in Kacheln, Zeiten in Sekunden, Tempo in Kacheln pro Sekunde.
 */

export type BauId = 'holzwand' | 'armbrust' | 'molotow' | 'speerfalle';
export type FesteId = 'aussenmauer' | 'haupttor';
export type BauwerkId = BauId | FesteId;

export interface Fernangriff {
  art: 'bolzen' | 'brandflasche';
  reichweite: number;
  schaden: number;
  abklingzeit: number;
  /** Flächenradius, 0 = nur ein Ziel. */
  flaeche: number;
  /** Brand: Schaden pro Sekunde und Dauer. */
  brand?: { proSekunde: number; dauer: number };
}

export interface Falle {
  schaden: number;
  abklingzeit: number;
  /** Verlangsamung: Faktor und Dauer. */
  bremse: { faktor: number; dauer: number };
}

export interface BauDef {
  id: BauwerkId;
  name: string;
  text: string;
  kosten: number;
  hp: number;
  /** Blockiert den Weg (muss zerstört werden) oder ist begehbar (Falle). */
  blockiert: boolean;
  fern?: Fernangriff;
  falle?: Falle;
}

export const BAUTEN: Record<BauwerkId, BauDef> = {
  holzwand: {
    id: 'holzwand',
    name: 'Holzwand',
    text: 'Billig, hält ein bisschen. Die Toten nehmen lieber einen anderen Weg, wenn es einen gibt.',
    kosten: 10,
    hp: 90,
    blockiert: true,
  },
  armbrust: {
    id: 'armbrust',
    name: 'Armbrustturm',
    text: 'Schießt Bolzen auf den Toten, der dem Tor am nächsten ist.',
    kosten: 40,
    hp: 120,
    blockiert: true,
    fern: { art: 'bolzen', reichweite: 3.5, schaden: 12, abklingzeit: 0.9, flaeche: 0 },
  },
  molotow: {
    id: 'molotow',
    name: 'Molotow-Werfer',
    text: 'Wirft Brandflaschen auf Gruppen. Danach riecht es nach Grillabend.',
    kosten: 70,
    hp: 100,
    blockiert: true,
    fern: {
      art: 'brandflasche',
      reichweite: 2.8,
      schaden: 6,
      abklingzeit: 2.6,
      flaeche: 1.1,
      brand: { proSekunde: 4, dauer: 3 },
    },
  },
  speerfalle: {
    id: 'speerfalle',
    name: 'Speerfalle',
    text: 'Begehbar. Sticht zu und bremst alle, die drübergehen.',
    kosten: 25,
    hp: 60,
    blockiert: false,
    falle: { schaden: 18, abklingzeit: 1.4, bremse: { faktor: 0.5, dauer: 1.2 } },
  },
  aussenmauer: {
    id: 'aussenmauer',
    name: 'Außenmauer',
    text: 'Dein Stück der Stadtmauer. Lässt sich verstärken.',
    kosten: 0,
    hp: 60,
    blockiert: true,
  },
  haupttor: {
    id: 'haupttor',
    name: 'Haupttor',
    text: 'Dein Tor zur Hauptstadt. Fällt es, stehen die Toten im Kern.',
    kosten: 0,
    hp: 260,
    blockiert: true,
  },
};

export const BAUBAR: BauId[] = ['holzwand', 'armbrust', 'speerfalle', 'molotow'];

/** Verstärkung der Außenmauer: Lebenspunkte je Stufe und Kosten der nächsten Stufe. */
export const MAUER = {
  hpProStufe: 60,
  maxStufe: 5,
  kosten: (stufe: number) => 15 * (stufe + 1),
};

export type GegnerId = 'schlurfi' | 'sprinter' | 'pupsbeule';

export interface GegnerDef {
  id: GegnerId;
  name: string;
  text: string;
  hp: number;
  tempo: number;
  /** Schaden pro Sekunde an Bauwerken. */
  biss: number;
  /** Schaden an der Hauptstadt, wenn er durchkommt. */
  kernSchaden: number;
  belohnung: number;
  abNacht: number;
  gewicht: number;
  platzt?: { radius: number; schaden: number };
}

export const GEGNER: Record<GegnerId, GegnerDef> = {
  schlurfi: {
    id: 'schlurfi',
    name: 'Schlurfi',
    text: 'Langsam, dumm, viele. Der Klassiker.',
    hp: 30,
    tempo: 0.55,
    biss: 6,
    kernSchaden: 8,
    belohnung: 2,
    abNacht: 1,
    gewicht: 10,
  },
  sprinter: {
    id: 'sprinter',
    name: 'Sprinter-Sigi',
    text: 'Hat zu Lebzeiten Marathon gelaufen. Hört nicht auf.',
    hp: 16,
    tempo: 1.5,
    biss: 3,
    kernSchaden: 6,
    belohnung: 3,
    abNacht: 2,
    gewicht: 5,
  },
  pupsbeule: {
    id: 'pupsbeule',
    name: 'Pupsbeule',
    text: 'Aufgebläht. Platzt beim Tod und beschädigt alles in der Nähe. Es riecht.',
    hp: 70,
    tempo: 0.42,
    biss: 4,
    kernSchaden: 15,
    belohnung: 6,
    abNacht: 3,
    gewicht: 3,
    platzt: { radius: 1.3, schaden: 45 },
  },
};

export const GEGNER_REIHENFOLGE: GegnerId[] = ['schlurfi', 'sprinter', 'pupsbeule'];

/** Wellen: Anzahl, Stärke und Zeitraum der Ankunft je Nacht. */
export const WELLE = {
  anzahl: (nacht: number) => 5 + 3 * nacht,
  /** 1,1 hoch (Nacht - 1), als Schleife statt Math.pow, damit es überall exakt gleich rechnet. */
  hpFaktor: (nacht: number) => {
    let f = 1;
    for (let i = 1; i < nacht; i++) f *= 1.1;
    return f;
  },
  ankunftsDauer: (anzahl: number) => 8 + anzahl * 0.9,
};

export const START = {
  schrott: 120,
  kernHp: 100,
  /** Grundeinkommen pro Tag (Sammler, Plünderung von Ruinen). */
  tageslohn: 30,
  /** So viel heilt die Hauptstadt pro Tag. */
  kernHeilung: 10,
};

export const NACHT = {
  /** Simulationsschritt in Sekunden. */
  dt: 0.1,
  /** Spätestens dann graut der Morgen. */
  maxDauer: 240,
};
