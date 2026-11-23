/**
 * Wegfindung der Toten: ein Strömungsfeld (Flow Field).
 *
 * Für jede Kachel steht drin, wie "teuer" der Weg von dort bis zur Hauptstadt ist.
 * Bauwerke, die im Weg stehen, kosten so viel, wie es dauert, sie kaputtzubeißen.
 * Deshalb suchen sich die Toten immer den Weg des geringsten Widerstands.
 */
import { BAUTEN } from './data';
import { BREITE, HOEHE, type Boden, bodenBegehbar, idx, istKern } from './karte';

export interface BauwerkZustand {
  id: keyof typeof BAUTEN;
  hp: number;
  maxHp: number;
  abklingen: number;
}

/** Wie viele Lebenspunkte eine Kachel "Umweg" wert sind. */
export const HP_PRO_SCHRITT = 8;

/** Feste Reihenfolge der Nachbarn: runter, links, rechts, hoch. */
export const NACHBARN: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [-1, 0],
  [1, 0],
  [0, -1],
];

/** Kosten, um eine Kachel zu betreten. Infinity = unpassierbar. */
export function betretKosten(boden: Boden, bau: BauwerkZustand | null): number {
  if (bau && BAUTEN[bau.id].blockiert) return 1 + bau.hp / HP_PRO_SCHRITT;
  // Zerstörte Mauer- und Torstücke sind Trümmer und damit begehbar.
  if (bodenBegehbar(boden) || boden === 'aussenmauer' || boden === 'haupttor') return 1;
  return Infinity;
}

export function berechneFeld(boden: readonly Boden[], bauten: readonly (BauwerkZustand | null)[]): Float64Array {
  const n = BREITE * HOEHE;
  const dist = new Float64Array(n).fill(Infinity);
  const kosten = new Float64Array(n);
  const fertig = new Uint8Array(n);
  for (let i = 0; i < n; i++) kosten[i] = betretKosten(boden[i], bauten[i]);
  for (let y = 0; y < HOEHE; y++) {
    if (!istKern(y)) continue;
    for (let x = 0; x < BREITE; x++) if (boden[idx(x, y)] === 'kern') dist[idx(x, y)] = 0;
  }
  // Dijkstra mit linearer Suche: Die Karte ist klein, das reicht und bleibt einfach.
  for (;;) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (!fertig[i] && dist[i] < bestD) {
        bestD = dist[i];
        best = i;
      }
    }
    if (best < 0) break;
    fertig[best] = 1;
    // Erst das Ziel betreten wurde bezahlt; die Kachel selbst kostet beim Betreten kosten[best].
    if (kosten[best] === Infinity && bestD > 0) continue;
    const bx = best % BREITE;
    const by = (best - bx) / BREITE;
    const ueber = bestD + kosten[best];
    for (const [dx, dy] of NACHBARN) {
      const x = bx + dx;
      const y = by + dy;
      if (x < 0 || y < 0 || x >= BREITE || y >= HOEHE) continue;
      const j = idx(x, y);
      if (!fertig[j] && ueber < dist[j]) dist[j] = ueber;
    }
  }
  return dist;
}

/**
 * Nächster Schritt von (x, y): der Nachbar mit dem günstigsten Weg.
 * Gibt null zurück, wenn es keinen Weg gibt.
 */
export function naechsterSchritt(
  x: number,
  y: number,
  boden: readonly Boden[],
  bauten: readonly (BauwerkZustand | null)[],
  dist: Float64Array,
): [number, number] | null {
  let best: [number, number] | null = null;
  let bestWert = Infinity;
  for (const [dx, dy] of NACHBARN) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= BREITE || ny >= HOEHE) continue;
    const j = idx(nx, ny);
    const wert = betretKosten(boden[j], bauten[j]) + dist[j];
    if (wert < bestWert) {
      bestWert = wert;
      best = [nx, ny];
    }
  }
  return best;
}
