/**
 * Die Karte eines Bezirks (Meilenstein 1: ein einzelner Bezirk).
 *
 * Oben ist draußen, dann die Außenmauer, dann der Bezirk, unten die Kernmauer mit dem Haupttor
 * und ganz unten ein Stück der Hauptstadt. Links und rechts liegen die Grenzen zu den Nachbarn
 * mit je einem Seitentor (ab Meilenstein 2 begehbar).
 */

export const BREITE = 13;
export const HOEHE = 22;

export type Boden =
  | 'draussen'
  | 'aussenmauer'
  | 'grenze'
  | 'seitentor'
  | 'rasen'
  | 'weg'
  | 'kies'
  | 'haus'
  | 'kernmauer'
  | 'haupttor'
  | 'kern';

export const ZEILE_AUSSENMAUER = 2;
export const ZEILE_KERNMAUER = 19;
export const TOR_X = 6;
export const ZEILE_SEITENTOR = 10;

export interface Haus {
  x: number;
  y: number;
  b: number;
  h: number;
  dach: 'rot' | 'grau' | 'braun';
}

/** Häuser im Bezirk: stehen nicht im Gras, sondern haben Kies drumherum und einen Weg zur Tür. */
export const HAEUSER: Haus[] = [
  { x: 2, y: 5, b: 2, h: 2, dach: 'rot' },
  { x: 9, y: 8, b: 2, h: 2, dach: 'grau' },
  { x: 2, y: 13, b: 2, h: 2, dach: 'braun' },
];

export function idx(x: number, y: number): number {
  return y * BREITE + x;
}

export function imFeld(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < BREITE && y < HOEHE;
}

function bauGrundkarte(): Boden[] {
  const k: Boden[] = new Array(BREITE * HOEHE).fill('rasen');
  for (let y = 0; y < HOEHE; y++) {
    for (let x = 0; x < BREITE; x++) {
      let b: Boden = 'rasen';
      if (y < ZEILE_AUSSENMAUER) b = 'draussen';
      else if (y === ZEILE_AUSSENMAUER) b = x === 0 || x === BREITE - 1 ? 'grenze' : 'aussenmauer';
      else if (y === ZEILE_KERNMAUER) b = x === TOR_X ? 'haupttor' : 'kernmauer';
      else if (y > ZEILE_KERNMAUER) b = x === 0 || x === BREITE - 1 ? 'kernmauer' : 'kern';
      else if (x === 0 || x === BREITE - 1) b = y === ZEILE_SEITENTOR ? 'seitentor' : 'grenze';
      else if (x === TOR_X) b = 'weg';
      k[idx(x, y)] = b;
    }
  }
  for (const h of HAEUSER) {
    // Kiesstreifen ums Haus
    for (let y = h.y - 1; y <= h.y + h.h; y++) {
      for (let x = h.x - 1; x <= h.x + h.b; x++) {
        if (imFeld(x, y) && k[idx(x, y)] === 'rasen') k[idx(x, y)] = 'kies';
      }
    }
    for (let y = h.y; y < h.y + h.h; y++) {
      for (let x = h.x; x < h.x + h.b; x++) k[idx(x, y)] = 'haus';
    }
    // Weg von der Haustür (unten) zur Straße
    const ty = h.y + h.h;
    const von = Math.min(h.x, TOR_X);
    const bis = Math.max(h.x + h.b - 1, TOR_X);
    for (let x = von; x <= bis; x++) if (k[idx(x, ty)] !== 'haus') k[idx(x, ty)] = 'weg';
  }
  return k;
}

export const GRUNDKARTE: readonly Boden[] = bauGrundkarte();

/** Begehbar, ohne dass etwas zerstört werden muss (Bauwerke kommen extra dazu). */
export function bodenBegehbar(b: Boden): boolean {
  return b === 'draussen' || b === 'rasen' || b === 'weg' || b === 'kies' || b === 'kern';
}

/** Hier darf man bauen. */
export function bodenBebaubar(b: Boden, y: number): boolean {
  return (b === 'rasen' || b === 'weg' || b === 'kies') && y > ZEILE_AUSSENMAUER && y < ZEILE_KERNMAUER;
}

/** Diese Felder sind das Ziel der Toten: die Hauptstadt. */
export function istKern(y: number): boolean {
  return y > ZEILE_KERNMAUER;
}
