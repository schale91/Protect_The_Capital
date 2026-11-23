/** Soundeffekte (Kenney, CC0) über Web Audio. Ohne Ton geht das Spiel genauso. */
import type { Ereignis } from './sim/nacht';

const DATEIEN = {
  flasche: 'impactGlass_medium_000',
  falle: 'impactMetal_light_001',
  matsch1: 'impactSoft_heavy_000',
  matsch2: 'impactSoft_heavy_001',
  matsch3: 'impactSoft_heavy_002',
  platzt: 'impactSoft_heavy_004',
  rumms: 'impactPunch_heavy_000',
  holz: 'impactWood_heavy_000',
  stein: 'impactMining_000',
  glocke: 'impactBell_heavy_000',
  glocke2: 'impactBell_heavy_001',
  schuss: 'drawKnife2',
  hacken: 'chop',
  muenzen: 'handleCoins',
  muenzen2: 'handleCoins2',
  riegel: 'metalLatch',
  klick: 'click2',
  schalter: 'switch2',
} as const;

export type Ton = keyof typeof DATEIEN;

const SCHLUESSEL = 'ptc.ton';
let ctx: AudioContext | null = null;
const puffer = new Map<Ton, AudioBuffer>();
const zuletzt = new Map<Ton, number>();
let an = (() => {
  try {
    return localStorage.getItem(SCHLUESSEL) !== 'aus';
  } catch {
    return true;
  }
})();

export function tonAn(): boolean {
  return an;
}

export function setzeTon(wert: boolean): void {
  an = wert;
  try {
    localStorage.setItem(SCHLUESSEL, wert ? 'an' : 'aus');
  } catch {
    // egal
  }
}

/** Browser erlauben Ton erst nach einer Berührung. Deshalb beim ersten Tippen starten. */
export function tonStarten(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const basis = import.meta.env.BASE_URL;
  for (const [name, datei] of Object.entries(DATEIEN) as Array<[Ton, string]>) {
    fetch(`${basis}toene/${datei}.ogg`)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx!.decodeAudioData(b))
      .then((p) => puffer.set(name, p))
      .catch(() => {
        // Format nicht unterstützt: dann eben leise
      });
  }
}

export function spiele(name: Ton, lautstaerke = 0.6, mindestAbstand = 0.06): void {
  if (!an || !ctx) return;
  const p = puffer.get(name);
  if (!p) return;
  const jetzt = ctx.currentTime;
  if (jetzt - (zuletzt.get(name) ?? -1) < mindestAbstand) return;
  zuletzt.set(name, jetzt);
  const quelle = ctx.createBufferSource();
  quelle.buffer = p;
  quelle.playbackRate.value = 0.92 + Math.random() * 0.16;
  const g = ctx.createGain();
  g.gain.value = lautstaerke;
  quelle.connect(g).connect(ctx.destination);
  quelle.start();
}

/** Töne zu den Ereignissen einer Nacht. */
export function toeneFuer(liste: readonly Ereignis[]): void {
  for (const e of liste) {
    switch (e.art) {
      case 'bolzen':
        spiele('schuss', 0.25, 0.08);
        break;
      case 'brandflasche':
        spiele('flasche', 0.45, 0.1);
        break;
      case 'falle':
        spiele('falle', 0.4, 0.1);
        break;
      case 'tot':
        spiele((['matsch1', 'matsch2', 'matsch3'] as const)[Math.floor(Math.random() * 3)], 0.45, 0.05);
        break;
      case 'platzt':
        spiele('platzt', 0.8, 0.1);
        spiele('rumms', 0.5, 0.1);
        break;
      case 'zerstoert':
        spiele(e.id === 'aussenmauer' || e.id === 'haupttor' ? 'stein' : 'holz', 0.7, 0.1);
        break;
      case 'kern':
        spiele('glocke', 0.55, 0.4);
        break;
      case 'ankunft':
        break;
    }
  }
}
