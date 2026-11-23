/** Voraussichtlicher Laufweg der Toten, damit man sieht, wo die Verteidigung hingehört. */
import { BREITE, GRUNDKARTE, HOEHE, idx, istKern } from './karte';
import type { NachtEingabe } from './nacht';
import { type BauwerkZustand, berechneFeld, naechsterSchritt } from './wege';

export function bautenAusEingabe(e: NachtEingabe): (BauwerkZustand | null)[] {
  const bauten: (BauwerkZustand | null)[] = new Array(BREITE * HOEHE).fill(null);
  for (const b of e.bauten) bauten[b.i] = { id: b.id, hp: b.maxHp, maxHp: b.maxHp, abklingen: 0 };
  return bauten;
}

/** Zählt für jede Kachel, wie viele der möglichen Startpunkte über sie laufen. */
export function laufweg(e: NachtEingabe): Uint16Array {
  const bauten = bautenAusEingabe(e);
  const dist = berechneFeld(GRUNDKARTE, bauten);
  const zaehler = new Uint16Array(BREITE * HOEHE);
  for (let sx = 1; sx < BREITE - 1; sx++) {
    let x = sx;
    let y = 0;
    for (let k = 0; k < 200 && !istKern(y); k++) {
      const s = naechsterSchritt(x, y, GRUNDKARTE, bauten, dist);
      if (!s) break;
      [x, y] = s;
      zaehler[idx(x, y)]++;
    }
  }
  return zaehler;
}
