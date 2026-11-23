import { describe, expect, it } from 'vitest';
import { BAUTEN, WELLE } from '../src/sim/data';
import { BREITE, GRUNDKARTE, HOEHE, TOR_X, ZEILE_AUSSENMAUER, ZEILE_KERNMAUER, idx } from '../src/sim/karte';
import { Nachtsim, planeWelle } from '../src/sim/nacht';
import { Rng, mischeSeed } from '../src/sim/rng';
import { baue, nachDerNacht, nachtEingabe, neuerSpielstand, verstaerkeMauer } from '../src/sim/spielstand';
import { type BauwerkZustand, berechneFeld, naechsterSchritt } from '../src/sim/wege';

const leer = (): (BauwerkZustand | null)[] => new Array(BREITE * HOEHE).fill(null);

describe('Zufall', () => {
  it('liefert bei gleichem Seed die gleiche Folge', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('bleibt im Bereich', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(1, 11);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(11);
    }
  });
  it('mischt Seeds unterschiedlich', () => {
    expect(mischeSeed(1, 1)).not.toBe(mischeSeed(1, 2));
  });
});

describe('Karte', () => {
  it('hat oben die Außenmauer und unten das Haupttor', () => {
    expect(GRUNDKARTE[idx(5, ZEILE_AUSSENMAUER)]).toBe('aussenmauer');
    expect(GRUNDKARTE[idx(TOR_X, ZEILE_KERNMAUER)]).toBe('haupttor');
    expect(GRUNDKARTE[idx(5, HOEHE - 1)]).toBe('kern');
  });
});

describe('Wegfindung', () => {
  it('findet ohne Mauern den Weg durchs Haupttor', () => {
    const dist = berechneFeld(GRUNDKARTE, leer());
    expect(dist[idx(5, 0)]).toBeLessThan(Infinity);
    // Direkt vor dem Tor ist es billiger als weiter oben.
    expect(dist[idx(TOR_X, ZEILE_KERNMAUER - 1)]).toBeLessThan(dist[idx(TOR_X, 5)]);
  });

  it('läuft um eine Wand herum, wenn der Umweg billiger ist', () => {
    const bauten = leer();
    const wand = idx(TOR_X, ZEILE_KERNMAUER - 2);
    bauten[wand] = { id: 'holzwand', hp: 90, maxHp: 90, abklingen: 0 };
    const dist = berechneFeld(GRUNDKARTE, bauten);
    const s = naechsterSchritt(TOR_X, ZEILE_KERNMAUER - 3, GRUNDKARTE, bauten, dist);
    expect(s).not.toEqual([TOR_X, ZEILE_KERNMAUER - 2]);
  });

  it('nimmt die schwächste Stelle der Außenmauer', () => {
    const bauten = leer();
    for (let x = 1; x < BREITE - 1; x++) {
      bauten[idx(x, ZEILE_AUSSENMAUER)] = { id: 'aussenmauer', hp: x === 3 ? 10 : 400, maxHp: 400, abklingen: 0 };
    }
    const dist = berechneFeld(GRUNDKARTE, bauten);
    const s = naechsterSchritt(3, ZEILE_AUSSENMAUER - 1, GRUNDKARTE, bauten, dist);
    expect(s).toEqual([3, ZEILE_AUSSENMAUER]);
    // Von weiter weg lohnt sich der Weg zur Lücke.
    const t = naechsterSchritt(5, ZEILE_AUSSENMAUER - 1, GRUNDKARTE, bauten, dist);
    expect(t).toEqual([4, ZEILE_AUSSENMAUER - 1]);
  });
});

describe('Welle', () => {
  it('wird von Nacht zu Nacht größer', () => {
    expect(WELLE.anzahl(5)).toBeGreaterThan(WELLE.anzahl(1));
    expect(WELLE.hpFaktor(3)).toBeCloseTo(1.21, 10);
  });
  it('schickt Pupsbeulen erst ab Nacht 3', () => {
    expect(planeWelle(1, new Rng(1)).some((a) => a.typ === 'pupsbeule')).toBe(false);
    expect(planeWelle(2, new Rng(1)).some((a) => a.typ === 'pupsbeule')).toBe(false);
  });
});

function verteidigt(nacht: number) {
  const s = neuerSpielstand(1234);
  s.nacht = nacht;
  s.schrott = 10000;
  for (const x of [3, 5, 7, 9]) expect(baue(s, idx(x, ZEILE_KERNMAUER - 2), 'armbrust')).toBeNull();
  expect(baue(s, idx(TOR_X, ZEILE_KERNMAUER - 1), 'speerfalle')).toBeNull();
  expect(baue(s, idx(4, 10), 'molotow')).toBeNull();
  expect(baue(s, idx(8, 12), 'molotow')).toBeNull();
  return s;
}

describe('Nacht', () => {
  it('ist deterministisch', () => {
    const s = verteidigt(4);
    const a = new Nachtsim(nachtEingabe(s)).bisZumEnde();
    const b = new Nachtsim(nachtEingabe(s)).bisZumEnde();
    expect(a).toEqual(b);
  });

  it('ohne Verteidigung nimmt die Hauptstadt Schaden', () => {
    const s = neuerSpielstand(99);
    s.nacht = 3;
    const b = new Nachtsim(nachtEingabe(s)).bisZumEnde();
    expect(b.kernSchaden).toBeGreaterThan(0);
  });

  it('mit Verteidigung kommt in der ersten Nacht keiner durch', () => {
    const b = new Nachtsim(nachtEingabe(verteidigt(1))).bisZumEnde();
    expect(b.ausgang).toBe('gehalten');
    expect(b.kernSchaden).toBe(0);
    expect(b.schrott).toBeGreaterThan(0);
  });

  it('Verteidigung senkt den Schaden', () => {
    const ohne = neuerSpielstand(1234);
    ohne.nacht = 5;
    const a = new Nachtsim(nachtEingabe(ohne)).bisZumEnde();
    const b = new Nachtsim(nachtEingabe(verteidigt(5))).bisZumEnde();
    expect(b.kernSchaden).toBeLessThan(a.kernSchaden);
  });

  it('eine platzende Pupsbeule beschädigt Bauwerke in der Nähe', () => {
    const s = neuerSpielstand(5);
    s.nacht = 3;
    const sim = new Nachtsim(nachtEingabe(s));
    const i = idx(5, 10);
    sim.bauten[i] = { id: 'holzwand', hp: 90, maxHp: 90, abklingen: 0 };
    sim.gegner.push({
      nr: 999, typ: 'pupsbeule', x: 5.5, y: 9.5, tx: 5, ty: 9, ziel: null,
      hp: 0, maxHp: 70, brand: null, bremse: null, beisst: false,
    });
    sim.schritt();
    expect(sim.bauten[i]!.hp).toBeLessThan(90);
    expect(sim.ereignisse.some((e) => e.art === 'platzt')).toBe(true);
  });

  it('wird spätestens im Morgengrauen beendet', () => {
    const s = neuerSpielstand(3);
    s.nacht = 40;
    s.kernHp = 1e9;
    const b = new Nachtsim(nachtEingabe(s)).bisZumEnde();
    expect(['gehalten', 'ueberstanden', 'gefallen']).toContain(b.ausgang);
  });
});

describe('Spielstand', () => {
  it('Bauen kostet Schrott und geht nicht doppelt', () => {
    const s = neuerSpielstand(1);
    const i = idx(5, 8);
    expect(baue(s, i, 'armbrust')).toBeNull();
    expect(s.schrott).toBe(120 - BAUTEN.armbrust.kosten);
    expect(baue(s, i, 'holzwand')).toBe('belegt');
    expect(baue(s, idx(5, ZEILE_AUSSENMAUER), 'holzwand')).toBe('boden');
  });

  it('Mauer verstärken erhöht die Lebenspunkte', () => {
    const s = neuerSpielstand(1);
    expect(verstaerkeMauer(s, 4)).toBeNull();
    const e = nachtEingabe(s);
    const mauer = e.bauten.find((b) => b.i === idx(4, ZEILE_AUSSENMAUER))!;
    expect(mauer.maxHp).toBe(BAUTEN.aussenmauer.hp + 60);
  });

  it('nach der Nacht geht es mit der nächsten weiter, Zerstörtes ist weg', () => {
    const s = verteidigt(2);
    const b = new Nachtsim(nachtEingabe(s)).bisZumEnde();
    b.zerstoerteKacheln.push(idx(4, 10));
    nachDerNacht(s, b);
    expect(s.nacht).toBe(3);
    expect(s.bauten[idx(4, 10)]).toBeUndefined();
  });
});

import { laufweg } from '../src/sim/vorschau';

describe('Laufweg-Vorschau', () => {
  it('führt durchs Haupttor', () => {
    const lw = laufweg(nachtEingabe(neuerSpielstand(1)));
    expect(lw[idx(TOR_X, ZEILE_KERNMAUER)]).toBe(BREITE - 2);
  });
});
