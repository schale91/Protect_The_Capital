/**
 * Die Karte eines Bezirks und ihr Generator.
 *
 * Oben ist draußen (Landstraße, dahinter der Friedhof), dann die Außenmauer mit dem Stadttor, dann der Bezirk,
 * unten die Kernmauer mit dem Haupttor und ganz unten ein Stück der Hauptstadt. Links und rechts liegen die
 * Grenzen zu den Nachbarn mit je einem Seitentor (ab Meilenstein 2 begehbar).
 *
 * Jeder Bezirk hat einen Typ (Altstadt, Vorstadt, Industriegebiet, Dorf am Bach). Der Generator baut daraus
 * mit einem Seed eine eigene Karte: Straßennetz vom Stadttor zum Haupttor, feste Hindernisse, Startgebäude.
 * Er ist deterministisch: gleicher Seed und Typ ergeben immer die gleiche Karte.
 */
import type { BauId } from './data';
import { Rng } from './rng';

export const BREITE = 15;
export const HOEHE = 26;
export const ZEILE_AUSSENMAUER = 2;
export const ZEILE_KERNMAUER = 23;
export const TOR_X = 7;
export const ZEILE_SEITENTOR = 12;
/** Innenbereich des Bezirks (Zeilen). */
export const INNEN_OBEN = ZEILE_AUSSENMAUER + 1;
export const INNEN_UNTEN = ZEILE_KERNMAUER - 1;

export type Boden =
  | 'draussen'
  | 'aussenmauer'
  | 'grenze'
  | 'seitentor'
  | 'rasen'
  | 'strasse'
  | 'pflaster'
  | 'kies'
  | 'feld'
  | 'wasser'
  | 'bruecke'
  | 'gleis'
  | 'uebergang'
  | 'ruine'
  | 'halle'
  | 'kirche'
  | 'scheune'
  | 'container'
  | 'hecke'
  | 'kernmauer'
  | 'haupttor'
  | 'kern';

export type BezirkTyp = 'altstadt' | 'vorstadt' | 'industrie' | 'dorf';
export const BEZIRKSTYPEN: BezirkTyp[] = ['altstadt', 'vorstadt', 'industrie', 'dorf'];

export const BEZIRK_NAME: Record<BezirkTyp, string> = {
  altstadt: 'Altstadt',
  vorstadt: 'Vorstadt',
  industrie: 'Industriegebiet',
  dorf: 'Dorf am Bach',
};

export interface Karte {
  typ: BezirkTyp;
  seed: number;
  boden: Boden[];
  stadttorX: number;
  /** Gebäude, die beim Start schon stehen. */
  startBauten: Array<{ i: number; id: BauId }>;
}

export function idx(x: number, y: number): number {
  return y * BREITE + x;
}

export function imFeld(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < BREITE && y < HOEHE;
}

/** Die Toten können hier laufen (ohne Bauwerke gerechnet). */
export function bodenBegehbar(b: Boden): boolean {
  return (
    b === 'draussen' ||
    b === 'rasen' ||
    b === 'strasse' ||
    b === 'pflaster' ||
    b === 'kies' ||
    b === 'feld' ||
    b === 'bruecke' ||
    b === 'uebergang' ||
    b === 'kern'
  );
}

/** Wie mühsam das Gelände ist: Kosten für die Wegfindung und Bremse beim Laufen. Straßen sind am bequemsten. */
export const GELAENDE: Partial<Record<Boden, { kosten: number; tempo: number }>> = {
  draussen: { kosten: 1, tempo: 1 },
  strasse: { kosten: 1, tempo: 1 },
  bruecke: { kosten: 1, tempo: 1 },
  uebergang: { kosten: 1, tempo: 1 },
  kern: { kosten: 1, tempo: 1 },
  pflaster: { kosten: 1.15, tempo: 0.95 },
  kies: { kosten: 1.35, tempo: 0.85 },
  rasen: { kosten: 2.2, tempo: 0.72 },
  feld: { kosten: 2.8, tempo: 0.58 },
};

/** Hier darf man bauen. */
export function bodenBebaubar(b: Boden, y: number): boolean {
  return (
    (b === 'rasen' || b === 'strasse' || b === 'pflaster' || b === 'kies' || b === 'feld') &&
    y >= INNEN_OBEN &&
    y <= INNEN_UNTEN
  );
}

/** Diese Felder sind das Ziel der Toten: die Hauptstadt. */
export function istKern(y: number): boolean {
  return y > ZEILE_KERNMAUER;
}

// ---------- Generator ----------

interface Bau {
  boden: Boden[];
  rng: Rng;
  strasse: Set<number>;
  start: Array<{ i: number; id: BauId }>;
}

function grundgeruest(): Boden[] {
  const k: Boden[] = new Array(BREITE * HOEHE).fill('rasen');
  for (let y = 0; y < HOEHE; y++) {
    for (let x = 0; x < BREITE; x++) {
      let b: Boden = 'rasen';
      const rand = x === 0 || x === BREITE - 1;
      if (y < ZEILE_AUSSENMAUER) b = 'draussen';
      else if (y === ZEILE_AUSSENMAUER) b = rand ? 'grenze' : 'aussenmauer';
      else if (y === ZEILE_KERNMAUER) b = x === TOR_X ? 'haupttor' : 'kernmauer';
      else if (y > ZEILE_KERNMAUER) b = rand ? 'kernmauer' : 'kern';
      else if (rand) b = y === ZEILE_SEITENTOR ? 'seitentor' : 'grenze';
      k[idx(x, y)] = b;
    }
  }
  return k;
}

function frei(b: Bau, x: number, y: number): boolean {
  return x >= 1 && x <= BREITE - 2 && y >= INNEN_OBEN && y <= INNEN_UNTEN && b.boden[idx(x, y)] === 'rasen';
}

function setze(b: Bau, x: number, y: number, boden: Boden): void {
  if (x < 1 || x > BREITE - 2 || y < INNEN_OBEN || y > INNEN_UNTEN) return;
  b.boden[idx(x, y)] = boden;
}

function strassenStueck(b: Bau, x: number, y: number): void {
  setze(b, x, y, 'strasse');
  b.strasse.add(idx(x, y));
}

/** Gerades Stück, erst senkrecht, dann waagerecht. */
function verbinde(b: Bau, ax: number, ay: number, bx: number, by: number): void {
  const sy = Math.sign(by - ay);
  for (let y = ay; y !== by; y += sy) strassenStueck(b, ax, y);
  const sx = Math.sign(bx - ax);
  for (let x = ax; x !== bx; x += sx) strassenStueck(b, x, by);
  strassenStueck(b, bx, by);
}

/**
 * Hauptstraße vom Stadttor zum Haupttor im Zickzack. Liefert die Knickpunkte, damit Bach und Gleis
 * die Straße genau einmal kreuzen können.
 */
function hauptstrasse(b: Bau, stadttorX: number, knicke: number): Array<[number, number]> {
  const punkte: Array<[number, number]> = [[stadttorX, INNEN_OBEN]];
  const links = stadttorX < TOR_X;
  let seiteLinks = !links;
  const abstand = (INNEN_UNTEN - 2 - (INNEN_OBEN + 2)) / knicke;
  for (let k = 0; k < knicke; k++) {
    const y = Math.round(INNEN_OBEN + 3 + k * abstand + b.rng.int(0, Math.max(0, Math.floor(abstand) - 3)));
    const x = seiteLinks ? b.rng.int(2, 5) : b.rng.int(9, 12);
    punkte.push([punkte[punkte.length - 1][0], y]);
    punkte.push([x, y]);
    seiteLinks = !seiteLinks;
  }
  const letzte = punkte[punkte.length - 1];
  punkte.push([letzte[0], INNEN_UNTEN - 1]);
  punkte.push([TOR_X, INNEN_UNTEN - 1]);
  punkte.push([TOR_X, INNEN_UNTEN]);
  for (let n = 1; n < punkte.length; n++) verbinde(b, punkte[n - 1][0], punkte[n - 1][1], punkte[n][0], punkte[n][1]);
  return punkte;
}

/**
 * Riegel unter jedem waagerechten Straßenstück: eine Häuserzeile, Hecke oder Hallenwand, damit die Toten
 * der Straße folgen müssen. Jeder Riegel hat eine Lücke, durch die sie abkürzen können, wenn man sie
 * nicht selbst zumauert.
 */
function riegel(b: Bau, punkte: Array<[number, number]>, boden: Boden, luecke: Boden): void {
  // Knicke liegen paarweise: (x_alt, y) -> (x_neu, y), dann geht es bei x_neu nach unten
  for (let n = 2; n < punkte.length - 3; n += 2) {
    const [xk, yk] = punkte[n];
    const xAlt = punkte[n - 1][0];
    const y = yk + 1;
    if (y > INNEN_UNTEN - 2) continue;
    const kandidaten: number[] = [];
    for (let x = 1; x < BREITE - 1; x++) {
      if (x === xk) continue;
      if (b.strasse.has(idx(x, y)) || b.boden[idx(x, y)] !== 'rasen') continue;
      b.boden[idx(x, y)] = boden;
      // Die Lücke liegt in der Mitte, nicht dort, wo die Straße herkommt oder weitergeht
      if (Math.abs(x - xk) > 2 && Math.abs(x - xAlt) > 2) kandidaten.push(x);
    }
    if (kandidaten.length) b.boden[idx(kandidaten[b.rng.int(0, kandidaten.length - 1)], y)] = luecke;
  }
}

/** Stichstraße (Sackgasse) waagerecht von einem Straßenpunkt aus. */
function stichstrasse(b: Bau, laenge: number): void {
  const liste = [...b.strasse];
  for (let versuch = 0; versuch < 20; versuch++) {
    const i = liste[b.rng.int(0, liste.length - 1)];
    const x = i % BREITE;
    const y = Math.floor(i / BREITE);
    if (y < INNEN_OBEN + 2 || y > INNEN_UNTEN - 3) continue;
    const r = b.rng.next() < 0.5 ? -1 : 1;
    let ok = true;
    for (let s = 1; s <= laenge; s++) if (!frei(b, x + r * s, y) || !frei(b, x + r * s, y - 1) || !frei(b, x + r * s, y + 1)) ok = false;
    if (!ok) continue;
    for (let s = 1; s <= laenge; s++) strassenStueck(b, x + r * s, y);
    return;
  }
}

/** Rechteck auf freiem Rasen, ohne die Straße zu berühren, wenn `abstand` gesetzt ist. */
function rechteck(b: Bau, breite: number, hoehe: number, boden: Boden, abstand: boolean, versuche = 40): boolean {
  for (let v = 0; v < versuche; v++) {
    const x0 = b.rng.int(1, BREITE - 1 - breite);
    const y0 = b.rng.int(INNEN_OBEN + 1, INNEN_UNTEN - hoehe);
    let ok = true;
    for (let y = y0 - (abstand ? 1 : 0); y < y0 + hoehe + (abstand ? 1 : 0) && ok; y++) {
      for (let x = x0 - (abstand ? 1 : 0); x < x0 + breite + (abstand ? 1 : 0) && ok; x++) {
        const innen = x >= x0 && x < x0 + breite && y >= y0 && y < y0 + hoehe;
        if (innen && !frei(b, x, y)) ok = false;
        if (!innen && imFeld(x, y) && b.strasse.has(idx(x, y)) && abstand) ok = false;
      }
    }
    if (!ok) continue;
    for (let y = y0; y < y0 + hoehe; y++) for (let x = x0; x < x0 + breite; x++) setze(b, x, y, boden);
    return true;
  }
  return false;
}

/** Freie Kachel direkt an der Straße, für Gebäude mit Zufahrt. */
function anDerStrasse(b: Bau, yMin = INNEN_OBEN + 1, yMax = INNEN_UNTEN - 1): number | null {
  const kandidaten: number[] = [];
  for (let y = yMin; y <= yMax; y++) {
    for (let x = 1; x < BREITE - 1; x++) {
      if (!frei(b, x, y) || b.start.some((s) => s.i === idx(x, y))) continue;
      const nachbarStrasse = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => b.strasse.has(idx(x + dx, y + dy)));
      if (nachbarStrasse) kandidaten.push(idx(x, y));
    }
  }
  if (!kandidaten.length) return null;
  return kandidaten[b.rng.int(0, kandidaten.length - 1)];
}

function startBau(b: Bau, id: BauId, yMin?: number, yMax?: number): void {
  const i = anDerStrasse(b, yMin, yMax);
  if (i === null) return;
  b.start.push({ i, id });
}

/** Ein waagerechtes Hindernisband (Bach, Gleis), das die Straße nur an Brücken oder Übergängen kreuzt. */
function band(b: Bau, y: number, boden: Boden, kreuzung: Boden, schlaengeln: boolean): void {
  let yy = y;
  for (let x = 1; x < BREITE - 1; x++) {
    const ziel = idx(x, yy);
    if (b.strasse.has(ziel)) b.boden[ziel] = kreuzung;
    else b.boden[ziel] = boden;
    if (schlaengeln && x < BREITE - 2 && b.rng.next() < 0.25) {
      const neu = Math.max(y - 1, Math.min(y + 1, yy + (b.rng.next() < 0.5 ? -1 : 1)));
      if (neu !== yy) {
        // senkrechtes Zwischenstück, damit der Bach durchgehend ist
        const zwischen = idx(x, neu);
        if (b.strasse.has(zwischen)) b.boden[zwischen] = kreuzung;
        else if (b.boden[zwischen] !== kreuzung) b.boden[zwischen] = boden;
        yy = neu;
      }
    }
  }
}

function altstadt(b: Bau, stadttorX: number): void {
  riegel(b, hauptstrasse(b, stadttorX, 4), 'ruine', 'pflaster');
  stichstrasse(b, 2);
  stichstrasse(b, 3);
  // Marktplatz und Kirche
  rechteck(b, 3, 3, 'pflaster', false);
  rechteck(b, 2, 2, 'kirche', true);
  // Dichte Bebauung: Ruinen in kleinen Blöcken, dazwischen Gassen
  for (let n = 0; n < 16; n++) rechteck(b, b.rng.int(1, 2), b.rng.int(1, 2), 'ruine', false, 15);
  // Der Rest ist Kopfsteinpflaster, ein paar Hinterhöfe bleiben grün
  for (let i = 0; i < b.boden.length; i++) {
    const y = Math.floor(i / BREITE);
    if (b.boden[i] === 'rasen' && y >= INNEN_OBEN && y <= INNEN_UNTEN && b.rng.next() < 0.6) b.boden[i] = 'pflaster';
  }
  startBau(b, 'bezirkswache', 10, 16);
  startBau(b, 'glockenturm');
  for (let n = 0; n < 3; n++) startBau(b, 'wohnhaus');
  startBau(b, 'garten');
}

function vorstadt(b: Bau, stadttorX: number): void {
  riegel(b, hauptstrasse(b, stadttorX, 3), 'hecke', 'kies');
  stichstrasse(b, 3);
  stichstrasse(b, 3);
  stichstrasse(b, 2);
  // Grundstücke: Hecken trennen Gärten voneinander
  for (let n = 0; n < 7; n++) rechteck(b, b.rng.next() < 0.5 ? 1 : 3, b.rng.next() < 0.5 ? 3 : 1, 'hecke', true, 20);
  startBau(b, 'bezirkswache', 10, 16);
  startBau(b, 'baumarkt');
  for (let n = 0; n < 5; n++) startBau(b, 'wohnhaus');
  for (let n = 0; n < 2; n++) startBau(b, 'garten');
  // Zufahrten als Kies
  for (const s of b.start) {
    const x = s.i % BREITE;
    const y = Math.floor(s.i / BREITE);
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (frei(b, x + dx, y + dy) && b.rng.next() < 0.5) setze(b, x + dx, y + dy, 'kies');
  }
}

function industrie(b: Bau, stadttorX: number): void {
  const p = hauptstrasse(b, stadttorX, 2);
  riegel(b, p, 'container', 'kies');
  // Gleisdamm zwischen erstem und zweitem Knick: Die Straße kreuzt ihn genau einmal
  const y1 = p[1][1];
  const y2 = p[3][1];
  const yg = y1 + 1 < y2 - 1 ? b.rng.int(y1 + 1, y2 - 1) : y1 + 1;
  band(b, yg, 'gleis', 'uebergang', false);
  for (let n = 0; n < 5; n++) rechteck(b, b.rng.int(2, 3), b.rng.int(2, 3), 'halle', true, 30);
  for (let n = 0; n < 9; n++) rechteck(b, 1, 1, 'container', false, 10);
  for (let i = 0; i < b.boden.length; i++) {
    const y = Math.floor(i / BREITE);
    if (b.boden[i] === 'rasen' && y >= INNEN_OBEN && y <= INNEN_UNTEN && b.rng.next() < 0.55) b.boden[i] = 'kies';
  }
  startBau(b, 'bezirkswache', 10, 16);
  startBau(b, 'schrottpresse');
  for (let n = 0; n < 2; n++) startBau(b, 'wohnhaus');
  startBau(b, 'schrottplatz');
}

function dorf(b: Bau, stadttorX: number): void {
  const p = hauptstrasse(b, stadttorX, 3);
  riegel(b, p, 'hecke', 'rasen');
  // Bach zwischen zweitem und drittem Knick, er kreuzt die Straße nur an der Brücke
  const y2 = p[3][1];
  const y3 = p[5][1];
  const yb = y2 + 2 < y3 - 2 ? b.rng.int(y2 + 2, y3 - 2) : y2 + 2;
  band(b, yb, 'wasser', 'bruecke', true);
  // Zweite Brücke: ein Fußweg über den Bach
  const wasser = [];
  for (let x = 2; x < BREITE - 2; x++) for (let y = yb - 1; y <= yb + 1; y++) if (b.boden[idx(x, y)] === 'wasser') wasser.push(idx(x, y));
  const fern = wasser.filter((i) => Math.abs((i % BREITE) - p[3][0]) > 4);
  if (fern.length) b.boden[fern[b.rng.int(0, fern.length - 1)]] = 'bruecke';
  for (let n = 0; n < 4; n++) rechteck(b, b.rng.int(2, 4), b.rng.int(2, 3), 'feld', false, 30);
  rechteck(b, 2, 2, 'scheune', true, 30);
  startBau(b, 'bezirkswache', 8, 18);
  startBau(b, 'wassermuehle');
  for (let n = 0; n < 3; n++) startBau(b, 'wohnhaus');
  for (let n = 0; n < 2; n++) startBau(b, 'garten');
  startBau(b, 'holzplatz');
}

/** Gibt es einen Weg vom Stadttor zum Haupttor (ohne Bauwerke)? */
export function wegFrei(boden: readonly Boden[], stadttorX: number): boolean {
  const start = idx(stadttorX, INNEN_OBEN);
  const ziel = idx(TOR_X, INNEN_UNTEN);
  const gesehen = new Uint8Array(BREITE * HOEHE);
  const schlange = [start];
  gesehen[start] = 1;
  while (schlange.length) {
    const i = schlange.shift()!;
    if (i === ziel) return true;
    const x = i % BREITE;
    const y = Math.floor(i / BREITE);
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!imFeld(nx, ny)) continue;
      const j = idx(nx, ny);
      if (gesehen[j] || !bodenBegehbar(boden[j])) continue;
      gesehen[j] = 1;
      schlange.push(j);
    }
  }
  return false;
}

export function erzeugeKarte(typ: BezirkTyp, seed: number): Karte {
  const rng = new Rng(seed);
  const b: Bau = { boden: grundgeruest(), rng, strasse: new Set(), start: [] };
  // Stadttor nie direkt über dem Haupttor
  const stadttorX = rng.next() < 0.5 ? rng.int(2, 4) : rng.int(10, 12);
  if (typ === 'altstadt') altstadt(b, stadttorX);
  else if (typ === 'vorstadt') vorstadt(b, stadttorX);
  else if (typ === 'industrie') industrie(b, stadttorX);
  else dorf(b, stadttorX);
  return { typ, seed, boden: b.boden, stadttorX, startBauten: b.start };
}
