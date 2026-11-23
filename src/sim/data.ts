/**
 * Spielinhalte als Daten. Neue Gebäude und Gegner kommen hierher, möglichst ohne neue Sonderlogik.
 * Einheiten: Entfernungen in Kacheln, Zeiten in Sekunden, Tempo in Kacheln pro Sekunde.
 */

// ---------- Rohstoffe ----------

export type Rohstoff = 'holz' | 'schrott' | 'nahrung';
export const ROHSTOFFE: Rohstoff[] = ['holz', 'schrott', 'nahrung'];
export const ROHSTOFF_NAME: Record<Rohstoff, string> = { holz: 'Holz', schrott: 'Schrott', nahrung: 'Nahrung' };
export type Menge = Partial<Record<Rohstoff, number>>;

// ---------- Bauwerke ----------

export type BauId =
  | 'holzwand'
  | 'armbrust'
  | 'speerfalle'
  | 'molotow'
  | 'wohnhaus'
  | 'garten'
  | 'holzplatz'
  | 'schrottplatz'
  | 'bezirkswache'
  | 'glockenturm'
  | 'baumarkt'
  | 'schrottpresse'
  | 'wassermuehle';
export type FesteId = 'aussenmauer' | 'stadttor' | 'haupttor';
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

export type Gruppe = 'verteidigung' | 'versorgung' | 'besonders' | 'feste';

export interface BauDef {
  id: BauwerkId;
  name: string;
  text: string;
  gruppe: Gruppe;
  kosten: Menge;
  hp: number;
  /** Blockiert den Weg (muss zerstört werden) oder ist begehbar (Falle). */
  blockiert: boolean;
  /** So viele Bewohner braucht es, um zu arbeiten. */
  arbeiter: number;
  /** Ertrag pro Tag, wenn besetzt. */
  ertrag?: Menge;
  /** Wohnraum für Bewohner. */
  wohnraum?: number;
  /** Nur einmal je Bezirk, kann nicht gebaut, nur übernommen werden. */
  einzigartig?: boolean;
  fern?: Fernangriff;
  falle?: Falle;
  /** Türme in diesem Umkreis bekommen mehr Reichweite (Glockenturm). */
  reichweiteBonus?: { umkreis: number; plus: number };
}

export const BAUTEN: Record<BauwerkId, BauDef> = {
  holzwand: {
    id: 'holzwand',
    name: 'Holzwand',
    text: 'Billig, hält ein bisschen. Die Toten nehmen lieber einen anderen Weg, wenn es einen gibt.',
    gruppe: 'verteidigung',
    kosten: { holz: 10 },
    hp: 90,
    blockiert: true,
    arbeiter: 0,
  },
  armbrust: {
    id: 'armbrust',
    name: 'Armbrustturm',
    text: 'Schießt Bolzen auf den Toten, der dem Tor am nächsten ist. Braucht einen Schützen.',
    gruppe: 'verteidigung',
    kosten: { holz: 20, schrott: 15 },
    hp: 120,
    blockiert: true,
    arbeiter: 1,
    fern: { art: 'bolzen', reichweite: 3.5, schaden: 12, abklingzeit: 0.9, flaeche: 0 },
  },
  speerfalle: {
    id: 'speerfalle',
    name: 'Speerfalle',
    text: 'Begehbar. Sticht zu und bremst alle, die drübergehen. Am besten auf die Straße.',
    gruppe: 'verteidigung',
    kosten: { schrott: 15, holz: 5 },
    hp: 60,
    blockiert: false,
    arbeiter: 0,
    falle: { schaden: 18, abklingzeit: 1.4, bremse: { faktor: 0.5, dauer: 1.2 } },
  },
  molotow: {
    id: 'molotow',
    name: 'Molotow-Werfer',
    text: 'Wirft Brandflaschen auf Gruppen. Danach riecht es nach Grillabend. Braucht einen Werfer.',
    gruppe: 'verteidigung',
    kosten: { schrott: 35, holz: 15 },
    hp: 100,
    blockiert: true,
    arbeiter: 1,
    fern: {
      art: 'brandflasche',
      reichweite: 2.8,
      schaden: 6,
      abklingzeit: 2.6,
      flaeche: 1.1,
      brand: { proSekunde: 4, dauer: 3 },
    },
  },
  wohnhaus: {
    id: 'wohnhaus',
    name: 'Wohnhaus',
    text: 'Platz für drei Bewohner. Neue Leute ziehen zu, wenn genug Essen da ist.',
    gruppe: 'versorgung',
    kosten: { holz: 30, schrott: 5 },
    hp: 150,
    blockiert: true,
    arbeiter: 0,
    wohnraum: 3,
  },
  garten: {
    id: 'garten',
    name: 'Gemüsegarten',
    text: 'Kohl, Möhren, Kürbisse. Ein Gärtner versorgt fünf Leute am Tag.',
    gruppe: 'versorgung',
    kosten: { holz: 10 },
    hp: 40,
    blockiert: false,
    arbeiter: 1,
    ertrag: { nahrung: 6 },
  },
  holzplatz: {
    id: 'holzplatz',
    name: 'Holzplatz',
    text: 'Bäume fällen, Bretter sägen. Ein Arbeiter liefert Holz.',
    gruppe: 'versorgung',
    kosten: { schrott: 10 },
    hp: 80,
    blockiert: true,
    arbeiter: 1,
    ertrag: { holz: 12 },
  },
  schrottplatz: {
    id: 'schrottplatz',
    name: 'Schrottplatz',
    text: 'Wracks ausschlachten. Ein Arbeiter liefert Schrott.',
    gruppe: 'versorgung',
    kosten: { holz: 15 },
    hp: 80,
    blockiert: true,
    arbeiter: 1,
    ertrag: { schrott: 10 },
  },
  bezirkswache: {
    id: 'bezirkswache',
    name: 'Bezirkswache',
    text: 'Das Herz deines Bezirks. Hier wohnen vier Leute. Fällt sie, fällt der Bezirk.',
    gruppe: 'besonders',
    kosten: {},
    hp: 350,
    blockiert: true,
    arbeiter: 0,
    wohnraum: 4,
    ertrag: { holz: 5, schrott: 5, nahrung: 2 },
    einzigartig: true,
  },
  glockenturm: {
    id: 'glockenturm',
    name: 'Glockenturm',
    text: 'Nur in der Altstadt. Der Türmer sieht weit: Türme in der Nähe schießen eine Kachel weiter.',
    gruppe: 'besonders',
    kosten: {},
    hp: 250,
    blockiert: true,
    arbeiter: 1,
    einzigartig: true,
    reichweiteBonus: { umkreis: 4, plus: 1 },
  },
  baumarkt: {
    id: 'baumarkt',
    name: 'Baumarkt',
    text: 'Nur in der Vorstadt. Solange jemand an der Kasse steht, kostet Bauen ein Fünftel weniger.',
    gruppe: 'besonders',
    kosten: {},
    hp: 200,
    blockiert: true,
    arbeiter: 1,
    einzigartig: true,
  },
  schrottpresse: {
    id: 'schrottpresse',
    name: 'Schrottpresse',
    text: 'Nur im Industriegebiet. Presst Wracks zu viel Schrott.',
    gruppe: 'besonders',
    kosten: {},
    hp: 220,
    blockiert: true,
    arbeiter: 1,
    einzigartig: true,
    ertrag: { schrott: 16 },
  },
  wassermuehle: {
    id: 'wassermuehle',
    name: 'Wassermühle',
    text: 'Nur im Dorf am Bach. Mahlt Mehl: viel Nahrung.',
    gruppe: 'besonders',
    kosten: {},
    hp: 200,
    blockiert: true,
    arbeiter: 1,
    einzigartig: true,
    ertrag: { nahrung: 14 },
  },
  aussenmauer: {
    id: 'aussenmauer',
    name: 'Außenmauer',
    text: 'Dein Stück der Stadtmauer. Lässt sich verstärken.',
    gruppe: 'feste',
    kosten: {},
    hp: 150,
    blockiert: true,
    arbeiter: 0,
  },
  stadttor: {
    id: 'stadttor',
    name: 'Stadttor',
    text: 'Das Tor in der Außenmauer. Ist es schwächer als die Mauer, kommen die Toten hier herein.',
    gruppe: 'feste',
    kosten: {},
    hp: 80,
    blockiert: true,
    arbeiter: 0,
  },
  haupttor: {
    id: 'haupttor',
    name: 'Haupttor',
    text: 'Dein Tor zur Hauptstadt. Fällt es, stehen die Toten im Kern.',
    gruppe: 'feste',
    kosten: {},
    hp: 260,
    blockiert: true,
    arbeiter: 0,
  },
};

export const BAUBAR: BauId[] = ['holzwand', 'armbrust', 'speerfalle', 'molotow', 'wohnhaus', 'garten', 'holzplatz', 'schrottplatz'];

/** Verstärkung von Außenmauer und Stadttor: Lebenspunkte je Stufe und Kosten der nächsten Stufe. */
export const MAUER = {
  hpProStufe: 60,
  maxStufe: 5,
  kosten: (stufe: number): Menge => ({ holz: 10 * (stufe + 1), schrott: 5 * (stufe + 1) }),
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
  lager: { holz: 90, schrott: 70, nahrung: 30 } as Record<Rohstoff, number>,
  kernHp: 100,
  /** So viel heilt die Hauptstadt pro Tag. */
  kernHeilung: 10,
  /** Jeder Bewohner isst so viel am Tag. */
  essenProKopf: 1,
  /** Rabatt des Baumarkts. */
  baumarktRabatt: 0.2,
  /** Nach dem Fall eines Bezirks gibt es Hilfe zum Wiederaufbau. */
  wiederaufbauFaktor: 1.5,
};

export const NACHT = {
  /** Simulationsschritt in Sekunden. */
  dt: 0.1,
  /** Spätestens dann graut der Morgen. */
  maxDauer: 240,
};
