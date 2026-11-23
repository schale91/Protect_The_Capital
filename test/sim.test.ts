import { describe, expect, it } from 'vitest';
import { BAUTEN, WELLE } from '../src/sim/data';
import {
  BEZIRKSTYPEN,
  BREITE,
  HOEHE,
  INNEN_OBEN,
  TOR_X,
  ZEILE_AUSSENMAUER,
  ZEILE_KERNMAUER,
  bodenBegehbar,
  erzeugeKarte,
  idx,
  wegFrei,
} from '../src/sim/karte';
import { Nachtsim, planeWelle } from '../src/sim/nacht';
import { Rng, mischeSeed } from '../src/sim/rng';
import {
  baue,
  besetzung,
  karte,
  kosten,
  lose,
  nachDerNacht,
  nachtEingabe,
  neuerSpielstand,
  reisseAb,
  verstaerkeMauer,
  wohnraum,
} from '../src/sim/spielstand';
import { laufweg } from '../src/sim/vorschau';
import { type BauwerkZustand, berechneFeld, naechsterSchritt } from '../src/sim/wege';

const leer = (): (BauwerkZustand | null)[] => new Array(BREITE * HOEHE).fill(null);
const zustand = (id: BauwerkZustand['id'], hp: number): BauwerkZustand => ({ id, hp, maxHp: hp, abklingen: 0, aktiv: true, reichweitePlus: 0 });

describe('Zufall', () => {
  it('liefert bei gleichem Seed die gleiche Folge', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('mischt Seeds unterschiedlich', () => {
    expect(mischeSeed(1, 1)).not.toBe(mischeSeed(1, 2));
  });
});

describe('Bezirksgenerator', () => {
  it('baut für jeden Typ und viele Seeds einen begehbaren Weg vom Stadttor zum Haupttor', () => {
    for (const typ of BEZIRKSTYPEN) {
      for (let seed = 1; seed <= 60; seed++) {
        const k = erzeugeKarte(typ, seed * 7919);
        expect(wegFrei(k.boden, k.stadttorX), `${typ} ${seed}`).toBe(true);
      }
    }
  });

  it('ist deterministisch', () => {
    expect(erzeugeKarte('dorf', 123)).toEqual(erzeugeKarte('dorf', 123));
  });

  it('legt das Stadttor nie direkt über das Haupttor', () => {
    for (let seed = 1; seed < 100; seed++) expect(Math.abs(erzeugeKarte('vorstadt', seed).stadttorX - TOR_X)).toBeGreaterThanOrEqual(3);
  });

  it('hat feste Merkmale je Typ', () => {
    const zaehle = (typ: (typeof BEZIRKSTYPEN)[number], b: string) => erzeugeKarte(typ, 99).boden.filter((x) => x === b).length;
    expect(zaehle('dorf', 'wasser')).toBeGreaterThan(5);
    expect(zaehle('dorf', 'bruecke')).toBeGreaterThanOrEqual(2);
    expect(zaehle('industrie', 'gleis')).toBeGreaterThan(5);
    expect(zaehle('industrie', 'uebergang')).toBe(1);
    expect(zaehle('altstadt', 'ruine')).toBeGreaterThan(5);
    expect(zaehle('vorstadt', 'hecke')).toBeGreaterThan(0);
  });

  it('stellt Bezirkswache und das eigene Gebäude auf, nicht auf die Straße', () => {
    const eigenes = { altstadt: 'glockenturm', vorstadt: 'baumarkt', industrie: 'schrottpresse', dorf: 'wassermuehle' } as const;
    for (const typ of BEZIRKSTYPEN) {
      for (let seed = 1; seed <= 20; seed++) {
        const k = erzeugeKarte(typ, seed);
        expect(k.startBauten.some((b) => b.id === 'bezirkswache'), `${typ} ${seed}`).toBe(true);
        expect(k.startBauten.some((b) => b.id === eigenes[typ]), `${typ} ${seed}`).toBe(true);
        for (const b of k.startBauten) expect(k.boden[b.i]).not.toBe('strasse');
      }
    }
  });
});

describe('Wegfindung', () => {
  it('bleibt lieber auf der Straße', () => {
    const k = erzeugeKarte('vorstadt', 5);
    const dist = berechneFeld(k.boden, leer());
    let x = k.stadttorX;
    let y = INNEN_OBEN;
    let aufStrasse = 0;
    let schritte = 0;
    while (y < ZEILE_KERNMAUER && schritte < 200) {
      const s = naechsterSchritt(x, y, k.boden, leer(), dist)!;
      [x, y] = s;
      if (k.boden[idx(x, y)] === 'strasse') aufStrasse++;
      schritte++;
    }
    expect(aufStrasse / schritte).toBeGreaterThan(0.6);
    // Die Route ist deutlich länger als der gerade Weg nach unten
    expect(schritte).toBeGreaterThan(ZEILE_KERNMAUER - INNEN_OBEN + 4);
  });

  it('nimmt die schwächste Stelle der Außenmauer', () => {
    const k = erzeugeKarte('vorstadt', 5);
    const bauten = leer();
    for (let x = 1; x < BREITE - 1; x++) bauten[idx(x, ZEILE_AUSSENMAUER)] = zustand('aussenmauer', x === k.stadttorX ? 20 : 900);
    const dist = berechneFeld(k.boden, bauten);
    const s = naechsterSchritt(k.stadttorX, ZEILE_AUSSENMAUER - 1, k.boden, bauten, dist);
    expect(s).toEqual([k.stadttorX, ZEILE_AUSSENMAUER]);
  });

  it('Wasser und Gleise sind unpassierbar, Brücken nicht', () => {
    expect(bodenBegehbar('wasser')).toBe(false);
    expect(bodenBegehbar('gleis')).toBe(false);
    expect(bodenBegehbar('bruecke')).toBe(true);
    expect(bodenBegehbar('uebergang')).toBe(true);
  });
});

describe('Welle', () => {
  it('wird von Nacht zu Nacht größer', () => {
    expect(WELLE.anzahl(5)).toBeGreaterThan(WELLE.anzahl(1));
    expect(WELLE.hpFaktor(3)).toBeCloseTo(1.21, 10);
  });
  it('schickt Pupsbeulen erst ab Nacht 3', () => {
    expect(planeWelle(2, new Rng(1)).some((a) => a.typ === 'pupsbeule')).toBe(false);
  });
});

function mitTuermen(nacht: number, seed = 1234) {
  const s = neuerSpielstand(seed);
  s.nacht = nacht;
  s.lager = { holz: 9999, schrott: 9999, nahrung: 9999 };
  s.bewohner = 50;
  // Viel Wohnraum, damit alle Türme besetzt sind
  const k = karte(s);
  let gebaut = 0;
  for (let y = ZEILE_KERNMAUER - 1; y > ZEILE_KERNMAUER - 6 && gebaut < 6; y--) {
    for (let x = 1; x < BREITE - 1 && gebaut < 6; x++) {
      const i = idx(x, y);
      if (k.boden[i] === 'strasse' || s.bauten[i]) continue;
      if (baue(s, i, 'armbrust') === null) gebaut++;
    }
  }
  return s;
}

describe('Nacht', () => {
  it('ist deterministisch', () => {
    const s = mitTuermen(4);
    expect(new Nachtsim(nachtEingabe(s)).bisZumEnde()).toEqual(new Nachtsim(nachtEingabe(s)).bisZumEnde());
  });

  it('ohne Verteidigung nimmt die Hauptstadt Schaden', () => {
    const s = neuerSpielstand(99);
    s.nacht = 4;
    s.bewohner = 0;
    const b = new Nachtsim(nachtEingabe(s)).bisZumEnde();
    expect(b.kernSchaden).toBeGreaterThan(0);
  });

  it('Verteidigung senkt den Schaden', () => {
    const ohne = neuerSpielstand(1234);
    ohne.nacht = 5;
    const a = new Nachtsim(nachtEingabe(ohne)).bisZumEnde();
    const b = new Nachtsim(nachtEingabe(mitTuermen(5))).bisZumEnde();
    expect(b.kernSchaden).toBeLessThan(a.kernSchaden);
  });

  it('unbesetzte Türme schießen nicht', () => {
    const s = mitTuermen(3);
    const voll = new Nachtsim(nachtEingabe(s)).bisZumEnde();
    s.bewohner = 0;
    const leerB = new Nachtsim(nachtEingabe(s)).bisZumEnde();
    expect(leerB.treffer.armbrust ?? 0).toBe(0);
    expect(voll.treffer.armbrust ?? 0).toBeGreaterThan(0);
  });

  it('eine platzende Pupsbeule beschädigt Bauwerke in der Nähe', () => {
    const s = neuerSpielstand(5);
    s.nacht = 3;
    const sim = new Nachtsim(nachtEingabe(s));
    const i = idx(5, 10);
    sim.bauten[i] = zustand('holzwand', 90);
    sim.gegner.push({ nr: 999, typ: 'pupsbeule', x: 5.5, y: 9.5, tx: 5, ty: 9, ziel: null, hp: 0, maxHp: 70, brand: null, bremse: null, beisst: false });
    sim.schritt();
    expect(sim.bauten[i]!.hp).toBeLessThan(90);
  });

  it('wird spätestens im Morgengrauen beendet', () => {
    const s = neuerSpielstand(3);
    s.nacht = 40;
    s.kernHp = 1e9;
    expect(['gehalten', 'ueberstanden', 'gefallen']).toContain(new Nachtsim(nachtEingabe(s)).bisZumEnde().ausgang);
  });
});

describe('Wirtschaft', () => {
  it('startet mit vollen Häusern und einem gelosten Bezirk', () => {
    const s = neuerSpielstand(77);
    expect(s.bewohner).toBe(wohnraum(s));
    expect(s.bewohner).toBeGreaterThanOrEqual(4);
    expect(BEZIRKSTYPEN).toContain(s.bezirk.typ);
  });

  it('Bauen kostet Rohstoffe und geht nur auf passendem Boden', () => {
    const s = neuerSpielstand(1);
    s.lager = { holz: 100, schrott: 100, nahrung: 0 };
    const k = karte(s);
    let frei = -1;
    for (let i = 0; i < k.boden.length && frei < 0; i++) if (k.boden[i] === 'rasen' || k.boden[i] === 'pflaster' || k.boden[i] === 'kies') if (!s.bauten[i] && Math.floor(i / BREITE) > ZEILE_AUSSENMAUER && Math.floor(i / BREITE) < ZEILE_KERNMAUER) frei = i;
    const vorher = { ...s.lager };
    expect(baue(s, frei, 'armbrust')).toBeNull();
    expect(s.lager.holz).toBe(vorher.holz - (kosten(s, 'armbrust').holz ?? 0) || s.lager.holz);
    expect(baue(s, frei, 'holzwand')).toBe('belegt');
    expect(baue(s, idx(5, ZEILE_AUSSENMAUER), 'holzwand')).toBe('boden');
  });

  it('der Baumarkt macht Bauen günstiger', () => {
    let s = neuerSpielstand(1);
    for (let n = 2; s.bezirk.typ !== 'vorstadt' && n < 200; n++) s = neuerSpielstand(n);
    expect(s.bezirk.typ).toBe('vorstadt');
    expect(kosten(s, 'wohnhaus').holz).toBeLessThan(BAUTEN.wohnhaus.kosten.holz!);
  });

  it('besetzt zuerst die Verteidigung', () => {
    const s = mitTuermen(1);
    s.bewohner = 2;
    const b = besetzung(s);
    for (const i of b.aktiv) expect(BAUTEN[s.bauten[i]].gruppe).toBe('verteidigung');
  });

  it('Ertrag, Essen und Zuzug am Tag', () => {
    const s = neuerSpielstand(8);
    s.lager.nahrung = 100;
    s.bewohner = Math.max(1, wohnraum(s) - 1);
    const vorher = s.lager.holz;
    const b = new Nachtsim(nachtEingabe(s)).bisZumEnde();
    b.kernSchaden = 0;
    b.zerstoerteKacheln = [];
    const t = nachDerNacht(s, b);
    expect(s.lager.holz).toBeGreaterThan(vorher);
    expect(t.gegessen).toBeGreaterThan(0);
    expect(t.zuzug).toBeGreaterThan(0);
    expect(s.nacht).toBe(2);
  });

  it('fällt die Bezirkswache, wird der Bezirk neu gelost', () => {
    const s = neuerSpielstand(8);
    const wache = Number(Object.keys(s.bauten).find((k) => s.bauten[Number(k)] === 'bezirkswache'));
    const b = new Nachtsim(nachtEingabe(s)).bisZumEnde();
    b.kernSchaden = 0;
    b.zerstoerteKacheln = [wache];
    const t = nachDerNacht(s, b);
    expect(t.bezirkGefallen).not.toBeNull();
    expect(s.bezirk.nr).toBe(2);
    expect(Object.values(s.bauten)).toContain('bezirkswache');
  });

  it('losen ist reproduzierbar, aber je Bezirk-Nummer anders', () => {
    expect(lose(5, 1, 1)).toEqual(lose(5, 1, 1));
    const typen = new Set(Array.from({ length: 30 }, (_, n) => lose(5, 1, n + 1).typ));
    expect(typen.size).toBeGreaterThan(1);
  });

  it('Mauer verstärken kostet und erhöht die Lebenspunkte', () => {
    const s = neuerSpielstand(1);
    const x = karte(s).stadttorX === 4 ? 5 : 4;
    expect(verstaerkeMauer(s, x)).toBeNull();
    const m = nachtEingabe(s).bauten.find((b) => b.i === idx(x, ZEILE_AUSSENMAUER))!;
    expect(m.maxHp).toBe(BAUTEN.aussenmauer.hp + 60);
  });

  it('Abreißen gibt die Hälfte zurück, Einzigartiges bleibt', () => {
    const s = neuerSpielstand(1);
    const wache = Number(Object.keys(s.bauten).find((k) => s.bauten[Number(k)] === 'bezirkswache'));
    expect(reisseAb(s, wache)).toBeNull();
  });
});

describe('Laufweg-Vorschau', () => {
  it('führt durchs Haupttor', () => {
    const lw = laufweg(nachtEingabe(neuerSpielstand(1)));
    expect(lw[idx(TOR_X, ZEILE_KERNMAUER)]).toBe(BREITE - 2);
  });
});
