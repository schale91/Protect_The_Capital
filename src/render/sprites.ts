/**
 * Pixelgrafik, im Code gezeichnet. Jede Kachel ist 16 x 16 Pixel, Gegner sind 12 x 12.
 * Später können hier fertige Pixel-Pakete (CC0) oder eigene Zeichnungen eingesetzt werden.
 */
import type { BauwerkId, GegnerId } from '../sim/data';

export const PX = 16;

type Ctx = CanvasRenderingContext2D;

function leinwand(b: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = b;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function p(ctx: Ctx, x: number, y: number, b: number, h: number, farbe: string): void {
  ctx.fillStyle = farbe;
  ctx.fillRect(x, y, b, h);
}

/** Kleiner, stabiler Pseudo-Zufall nur fürs Aussehen (nicht für die Simulation). */
export function hash(a: number, b: number, c = 0): number {
  let h = Math.imul(a ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul(b + 0x3c6ef372, 0x9e3779b1) ^ Math.imul(c + 7, 0x85ebca77);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

// ---------- Farben ----------
const F = {
  umriss: '#1a1420',
  rasen: ['#3d5a2c', '#456634', '#355026', '#4d6e38'],
  draussen: ['#3a332e', '#332c28', '#423a33', '#2c2622'],
  pflaster: '#6b665f',
  pflasterFuge: '#4f4a44',
  kies: ['#7d7568', '#6e675b', '#8a8274', '#5f5a50'],
  stein: '#78746c',
  steinHell: '#8c877d',
  steinDunkel: '#4e4a44',
  holz: '#8a5a33',
  holzHell: '#a66f40',
  holzDunkel: '#5e3b22',
  eisen: '#5a5a62',
  eisenHell: '#8d8d93',
  blut: '#6e1515',
  hecke: ['#24361d', '#2d4423', '#1d2c17'],
};

// ---------- Böden ----------

export function zeichneRasen(ctx: Ctx, kx: number, ky: number): void {
  p(ctx, 0, 0, PX, PX, F.rasen[0]);
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      const r = hash(kx * 16 + x, ky * 16 + y, 1);
      if (r < 0.18) p(ctx, x, y, 1, 1, F.rasen[1]);
      else if (r < 0.3) p(ctx, x, y, 1, 1, F.rasen[2]);
      else if (r < 0.33) p(ctx, x, y, 1, 1, F.rasen[3]);
    }
  }
  const r = hash(kx, ky, 2);
  if (r < 0.12) {
    // Blümchen, damit es nicht trostlos wird
    const x = 3 + Math.floor(hash(kx, ky, 3) * 10);
    const y = 3 + Math.floor(hash(kx, ky, 4) * 10);
    const farbe = r < 0.06 ? '#c9b458' : '#a8506a';
    p(ctx, x, y, 1, 1, farbe);
    p(ctx, x - 1, y, 1, 1, farbe);
    p(ctx, x + 1, y, 1, 1, farbe);
    p(ctx, x, y - 1, 1, 1, farbe);
    p(ctx, x, y + 1, 1, 1, '#2d4423');
  } else if (r < 0.2) {
    const x = 2 + Math.floor(hash(kx, ky, 5) * 12);
    const y = 2 + Math.floor(hash(kx, ky, 6) * 12);
    p(ctx, x, y, 1, 2, F.rasen[2]);
    p(ctx, x + 1, y - 1, 1, 3, F.rasen[2]);
    p(ctx, x + 2, y, 1, 2, F.rasen[2]);
  }
}

export function zeichneDraussen(ctx: Ctx, kx: number, ky: number): void {
  p(ctx, 0, 0, PX, PX, F.draussen[0]);
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      const r = hash(kx * 16 + x, ky * 16 + y, 11);
      if (r < 0.15) p(ctx, x, y, 1, 1, F.draussen[1]);
      else if (r < 0.25) p(ctx, x, y, 1, 1, F.draussen[2]);
      else if (r < 0.28) p(ctx, x, y, 1, 1, F.draussen[3]);
    }
  }
  if (hash(kx, ky, 12) < 0.25) {
    // Riss im Asphalt
    let x = Math.floor(hash(kx, ky, 13) * 14) + 1;
    for (let y = 0; y < PX; y += 1) {
      p(ctx, x, y, 1, 1, '#211c19');
      if (hash(kx, y, 14) < 0.4) x += hash(kx, y, 15) < 0.5 ? -1 : 1;
      x = Math.max(0, Math.min(15, x));
    }
  }
  if (hash(kx, ky, 16) < 0.1) {
    p(ctx, 5, 6, 4, 3, F.blut);
    p(ctx, 4, 7, 6, 1, F.blut);
    p(ctx, 9, 10, 1, 1, F.blut);
  }
}

export function zeichnePflaster(ctx: Ctx, kx: number, ky: number, warm = false): void {
  p(ctx, 0, 0, PX, PX, warm ? '#776c60' : F.pflaster);
  const fuge = warm ? '#584e44' : F.pflasterFuge;
  for (let y = 0; y < PX; y += 4) {
    p(ctx, 0, y, PX, 1, fuge);
    const versatz = (y / 4) % 2 === 0 ? 0 : 3;
    for (let x = versatz; x < PX; x += 6) p(ctx, x, y, 1, 4, fuge);
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(hash(kx, ky, 20 + i) * 16);
    const y = Math.floor(hash(kx, ky, 30 + i) * 16);
    p(ctx, x, y, 1, 1, warm ? '#867a6c' : '#77726a');
  }
}

export function zeichneKies(ctx: Ctx, kx: number, ky: number): void {
  p(ctx, 0, 0, PX, PX, F.kies[0]);
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      const r = hash(kx * 16 + x, ky * 16 + y, 40);
      if (r < 0.2) p(ctx, x, y, 1, 1, F.kies[1]);
      else if (r < 0.32) p(ctx, x, y, 1, 1, F.kies[2]);
      else if (r < 0.38) p(ctx, x, y, 1, 1, F.kies[3]);
    }
  }
}

/** Mauerstück. Stufe macht sie dicker (Metallbänder), Schaden macht Risse. */
export function zeichneMauer(ctx: Ctx, stufe: number, anteil: number, kern = false): void {
  const grund = kern ? '#5f5b55' : F.stein;
  p(ctx, 0, 0, PX, PX, F.steinDunkel);
  for (let y = 1; y < PX; y += 5) {
    const versatz = ((y - 1) / 5) % 2 === 0 ? 0 : 4;
    for (let x = -versatz; x < PX; x += 8) {
      p(ctx, x + 1, y, 6, 4, grund);
      p(ctx, x + 1, y, 6, 1, F.steinHell);
    }
  }
  // Zinnen oben
  for (let x = 0; x < PX; x += 4) p(ctx, x, 0, 2, 2, F.steinHell);
  for (let s = 0; s < stufe; s++) {
    p(ctx, 0, 3 + s * 2, PX, 1, F.eisenHell);
    p(ctx, 0, 4 + s * 2, PX, 1, F.eisen);
  }
  zeichneRisse(ctx, anteil, 50);
}

function zeichneRisse(ctx: Ctx, anteil: number, salz: number): void {
  if (anteil >= 0.95) return;
  const risse = Math.ceil((1 - anteil) * 6);
  for (let i = 0; i < risse; i++) {
    let x = 2 + Math.floor(hash(i, salz, 1) * 12);
    let y = 2 + Math.floor(hash(i, salz, 2) * 6);
    for (let k = 0; k < 6; k++) {
      p(ctx, x, y, 1, 1, '#1d1a18');
      x += hash(i, k, salz) < 0.5 ? -1 : 1;
      y += 1;
    }
  }
}

export function zeichneGrenze(ctx: Ctx, kx: number, ky: number): void {
  p(ctx, 0, 0, PX, PX, F.hecke[2]);
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      const r = hash(kx * 16 + x, ky * 16 + y, 60);
      if (r < 0.35) p(ctx, x, y, 1, 1, F.hecke[0]);
      else if (r < 0.5) p(ctx, x, y, 1, 1, F.hecke[1]);
    }
  }
  // Bauzaun mitten durch
  p(ctx, 7, 0, 2, PX, '#3b3f44');
  for (let y = 1; y < PX; y += 4) p(ctx, 6, y, 4, 1, '#6c7178');
}

export function zeichneSeitentor(ctx: Ctx): void {
  p(ctx, 0, 0, PX, PX, F.holzDunkel);
  for (let x = 1; x < PX; x += 3) p(ctx, x, 1, 2, 14, F.holz);
  p(ctx, 0, 4, PX, 2, F.eisen);
  p(ctx, 0, 10, PX, 2, F.eisen);
  // Schild "zu"
  p(ctx, 4, 6, 8, 4, '#c9b458');
  p(ctx, 5, 7, 6, 2, '#8a2a20');
}

export function zeichneTor(ctx: Ctx, anteil: number): void {
  p(ctx, 0, 0, PX, PX, F.steinDunkel);
  p(ctx, 1, 1, 14, 15, F.holzDunkel);
  for (let x = 2; x < 15; x += 3) p(ctx, x, 2, 2, 14, F.holz);
  p(ctx, 7, 1, 2, 15, F.holzDunkel);
  p(ctx, 1, 4, 14, 2, F.eisen);
  p(ctx, 1, 11, 14, 2, F.eisen);
  p(ctx, 5, 8, 2, 2, F.eisenHell);
  p(ctx, 9, 8, 2, 2, F.eisenHell);
  zeichneRisse(ctx, anteil, 70);
}

// ---------- Bauwerke ----------

export function zeichneBauwerk(ctx: Ctx, id: BauwerkId, anteil: number, phase = 0): void {
  switch (id) {
    case 'holzwand': {
      for (let x = 0; x < PX; x += 4) {
        p(ctx, x, 2, 4, 13, F.holzDunkel);
        p(ctx, x + 1, 1, 2, 14, F.holz);
        p(ctx, x + 1, 1, 1, 14, F.holzHell);
        p(ctx, x + 1, 0, 2, 1, F.holzHell);
      }
      p(ctx, 0, 5, PX, 1, F.eisen);
      p(ctx, 0, 11, PX, 1, F.eisen);
      zeichneRisse(ctx, anteil, 80);
      break;
    }
    case 'armbrust': {
      // Plattform mit Brettern
      p(ctx, 1, 1, 14, 14, F.holzDunkel);
      for (let y = 2; y < 14; y += 3) p(ctx, 2, y, 12, 2, F.holz);
      p(ctx, 1, 1, 2, 2, F.holzHell);
      p(ctx, 13, 1, 2, 2, F.holzHell);
      p(ctx, 1, 13, 2, 2, F.holzHell);
      p(ctx, 13, 13, 2, 2, F.holzHell);
      // Armbrust
      p(ctx, 7, 3, 2, 10, '#3a2616');
      p(ctx, 3, 5, 10, 1, F.eisenHell);
      p(ctx, 2, 6, 2, 1, F.eisenHell);
      p(ctx, 12, 6, 2, 1, F.eisenHell);
      p(ctx, 7, 2, 2, 1, '#d8d0b8');
      p(ctx, 4, 6, 8, 1, '#c9c1a8');
      zeichneRisse(ctx, anteil, 90);
      break;
    }
    case 'molotow': {
      // Fass mit Flaschen und Wurfarm
      p(ctx, 2, 3, 12, 11, '#2f2a26');
      p(ctx, 3, 4, 10, 9, '#4a3b2c');
      p(ctx, 3, 6, 10, 1, F.eisen);
      p(ctx, 3, 10, 10, 1, F.eisen);
      for (const x of [4, 7, 10]) {
        p(ctx, x, 1, 2, 4, '#3f6b4a');
        p(ctx, x, 0, 2, 1, '#e8e0d0');
      }
      const flamme = phase % 2 === 0;
      p(ctx, 7, 0, 2, 1, flamme ? '#ffd166' : '#e07b28');
      p(ctx, 4, 0, 2, 1, flamme ? '#e07b28' : '#ffd166');
      p(ctx, 13, 12, 2, 3, F.holz);
      p(ctx, 1, 12, 2, 3, F.holz);
      zeichneRisse(ctx, anteil, 100);
      break;
    }
    case 'speerfalle': {
      p(ctx, 2, 2, 12, 12, '#3a2c20');
      p(ctx, 3, 3, 10, 10, '#2a2018');
      for (let y = 4; y < 13; y += 3) {
        for (let x = 4; x < 13; x += 3) {
          p(ctx, x, y, 1, 1, F.eisenHell);
          p(ctx, x, y + 1, 1, 1, F.eisen);
        }
      }
      break;
    }
    case 'aussenmauer':
    case 'haupttor':
      break;
  }
}

// ---------- Haus (über mehrere Kacheln) ----------

export function zeichneHaus(b: number, h: number, dach: 'rot' | 'grau' | 'braun'): HTMLCanvasElement {
  const [c, ctx] = leinwand(b * PX, h * PX);
  const farben = {
    rot: ['#7a2e24', '#93392c', '#5e2219'],
    grau: ['#4b5058', '#5c626b', '#363a40'],
    braun: ['#5e432c', '#735236', '#46311f'],
  }[dach];
  const w = b * PX;
  const hh = h * PX;
  p(ctx, 0, 0, w, hh, F.umriss);
  p(ctx, 1, 1, w - 2, hh - 2, farben[0]);
  // Dachziegel-Reihen
  for (let y = 2; y < hh - 1; y += 3) p(ctx, 1, y, w - 2, 1, farben[2]);
  // First in der Mitte
  p(ctx, 1, Math.floor(hh / 2) - 1, w - 2, 2, farben[1]);
  // Schornstein
  p(ctx, w - 9, 3, 4, 5, '#5a4a42');
  p(ctx, w - 9, 3, 4, 1, '#2a2420');
  // Dachfenster
  p(ctx, 5, hh - 9, 5, 4, '#2a2a33');
  p(ctx, 6, hh - 8, 3, 2, '#d9b45a');
  return c;
}

// ---------- Gegner ----------

const PALETTE: Record<string, string> = {
  k: '#1a1420',
  G: '#7f9a5a',
  g: '#5b7340',
  r: '#e03a30',
  m: '#2a1a1a',
  B: '#3d5a80',
  b: '#7a1f1f',
  P: '#5b4636',
  S: '#2b2b2b',
  W: '#e8e0d0',
  R: '#b8342c',
  Y: '#b9b45a',
  y: '#8f8a3c',
  V: '#6b3f7a',
};

const GEGNER_PIXEL: Record<GegnerId, string[]> = {
  schlurfi: [
    '....GGGG....',
    '...GgGGGG...',
    '...GrGGrG...',
    '...GGGGGG...',
    '....GmmG....',
    '.GGBBBBBBGG.',
    '.g.BBBBBB.g.',
    '...BBbBBB...',
    '...BBBBbB...',
    '...PPPPPP...',
    '...PP..PP...',
    '...SS..SS...',
  ],
  sprinter: [
    '....GGGG....',
    '...GGGGgG...',
    '...GrGGrG...',
    '...GGmmGG...',
    '..RRRRRRRR..',
    '.G.RRWWRR.G.',
    '...RRRRRR...',
    '...RRbRRR...',
    '...RR..RR...',
    '..RR....RR..',
    '..WS....SW..',
    '............',
  ],
  pupsbeule: [
    '....GGGG....',
    '...GrGGrG...',
    '...GGmmGG...',
    '..YYYYYYYY..',
    '.YYVYYYYVYY.',
    'GYYYYYVYYYYG',
    'YYVYYYYYYVYY',
    'YyYYYVYYYYyY',
    '.YyYYYYYYyY.',
    '..YYYYYYYY..',
    '...PP..PP...',
    '...SS..SS...',
  ],
};

export function gegnerBild(typ: GegnerId, schritt: number): HTMLCanvasElement {
  const zeilen = GEGNER_PIXEL[typ];
  const [c, ctx] = leinwand(12, 12);
  for (let y = 0; y < 12; y++) {
    let zeile = (zeilen[y] ?? '').padEnd(12, '.').slice(0, 12);
    // Laufanimation: Beine wechseln
    if (schritt === 1 && y === 11) zeile = '.' + zeile.slice(0, 11);
    if (schritt === 1 && y === 10) zeile = zeile.slice(1) + '.';
    for (let x = 0; x < 12; x++) {
      const ch = zeile[x];
      if (ch === '.') continue;
      p(ctx, x, y, 1, 1, PALETTE[ch] ?? '#ff00ff');
    }
  }
  return c;
}

// ---------- Hauptstadt-Deko ----------

export function zeichneRathaus(): HTMLCanvasElement {
  const [c, ctx] = leinwand(3 * PX, 2 * PX);
  const w = 3 * PX;
  p(ctx, 2, 4, w - 4, 2 * PX - 6, F.umriss);
  p(ctx, 3, 5, w - 6, 2 * PX - 8, '#6e3a2e');
  for (let y = 7; y < 2 * PX - 3; y += 3) p(ctx, 3, y, w - 6, 1, '#552a20');
  p(ctx, 3, 15, w - 6, 2, '#8a4a3a');
  // Turm mit Uhr
  p(ctx, w / 2 - 5, 0, 10, 14, F.umriss);
  p(ctx, w / 2 - 4, 1, 8, 12, '#7d746a');
  p(ctx, w / 2 - 2, 3, 4, 4, '#e8e0d0');
  p(ctx, w / 2, 4, 1, 2, F.umriss);
  p(ctx, w / 2, 5, 2, 1, F.umriss);
  // Fahne
  p(ctx, w / 2 + 4, 0, 1, 5, '#2b2b2b');
  p(ctx, w / 2 + 5, 0, 4, 3, '#b8342c');
  return c;
}

export function zeichneLaterne(ctx: Ctx): void {
  p(ctx, 7, 4, 2, 11, '#2b2b2b');
  p(ctx, 5, 13, 6, 2, '#2b2b2b');
  p(ctx, 5, 1, 6, 4, '#2b2b2b');
  p(ctx, 6, 2, 4, 2, '#ffd98a');
}

export { leinwand, p as pixel };
