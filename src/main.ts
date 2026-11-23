import './stil.css';
import { Renderer3D, type Vorschau } from './render3d/renderer3d';
import { BAUBAR, BAUTEN, type BauId, GEGNER, GEGNER_REIHENFOLGE, MAUER, NACHT } from './sim/data';
import { BREITE, GRUNDKARTE, ZEILE_AUSSENMAUER, idx } from './sim/karte';
import { type Nachtbilanz, Nachtsim } from './sim/nacht';
import {
  type Spielstand,
  baue,
  kannBauen,
  lade,
  nachDerNacht,
  nachtEingabe,
  neuerSpielstand,
  reisseAb,
  speichere,
  verstaerkeMauer,
} from './sim/spielstand';
import { bautenAusEingabe, laufweg } from './sim/vorschau';
import { setzeTon, spiele, tonAn, tonStarten, toeneFuer } from './ton';

// Ton darf erst nach der ersten Berührung starten
window.addEventListener('pointerdown', tonStarten, { capture: true });

type Werkzeug = BauId | 'verstaerken' | 'abreissen';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('karte');
const buehne = $('buehne');
const renderer = new Renderer3D(canvas);

let stand: Spielstand = lade() ?? neuerSpielstand(neuerSeed());
let werkzeug: Werkzeug | null = null;
let vorschau: Vorschau | null = null;
let sim: Nachtsim | null = null;
let tempo = 1;
let rest = 0;
let endeWarten = 0;
let tagBauten = bautenAusEingabe(nachtEingabe(stand));
let tagLaufweg = laufweg(nachtEingabe(stand));

function neuerSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

function tagNeuBerechnen(): void {
  const e = nachtEingabe(stand);
  tagBauten = bautenAusEingabe(e);
  tagLaufweg = laufweg(e);
}

// ---------- Anzeige oben ----------

function hud(): void {
  $('hud-nacht').textContent = sim ? `Nacht ${stand.nacht}` : `Tag ${stand.nacht}`;
  $('hud-schrott').textContent = `⚙ ${stand.schrott}`;
  const hp = sim ? Math.max(0, sim.kernHp) : stand.kernHp;
  $('hud-kern').style.width = `${(100 * hp) / stand.kernMax}%`;
  $('hud-kern').title = `${Math.ceil(hp)} von ${stand.kernMax}`;
  $<HTMLButtonElement>('nacht-knopf').textContent = `Nacht ${stand.nacht} starten`;
  for (const knopf of document.querySelectorAll<HTMLButtonElement>('.werkzeug')) {
    const w = knopf.dataset.werkzeug as Werkzeug;
    knopf.classList.toggle('aktiv', w === werkzeug);
    if (w in BAUTEN) knopf.classList.toggle('zu-teuer', stand.schrott < BAUTEN[w as BauId].kosten);
  }
}

let toastZeit = 0;
function toast(text: string): void {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  const jetzt = Date.now();
  toastZeit = jetzt;
  setTimeout(() => {
    if (toastZeit === jetzt) t.hidden = true;
  }, 2200);
}

function info(html: string): void {
  $('info').innerHTML = html;
}

// ---------- Werkzeuge ----------

function werkzeugLeiste(): void {
  const leiste = $('werkzeuge');
  leiste.innerHTML = '';
  const eintraege: Array<{ w: Werkzeug; name: string; preis: string; bild: string }> = BAUBAR.map((id) => ({
    w: id,
    name: BAUTEN[id].name.replace('Molotow-Werfer', 'Molotow').replace('Armbrustturm', 'Armbrust'),
    preis: `${BAUTEN[id].kosten}`,
    bild: renderer.bildVon(id),
  }));
  eintraege.push({
    w: 'verstaerken',
    name: 'Mauer',
    preis: 'ab 15',
    bild: renderer.bildVon('verstaerken'),
  });
  eintraege.push({
    w: 'abreissen',
    name: 'Abreißen',
    preis: '+50 %',
    bild: renderer.bildVon('abreissen'),
  });
  for (const e of eintraege) {
    const b = document.createElement('button');
    b.className = 'werkzeug';
    b.dataset.werkzeug = e.w;
    b.innerHTML = `<img alt="" src="${e.bild}"><span>${e.name}</span><span class="preis">${e.preis}</span>`;
    b.addEventListener('click', () => waehle(e.w));
    leiste.append(b);
  }
}

function waehle(w: Werkzeug): void {
  spiele('klick', 0.4);
  werkzeug = werkzeug === w ? null : w;
  vorschau = null;
  if (!werkzeug) info('Wähle unten ein Bauwerk und tippe auf ein Feld.');
  else if (werkzeug === 'verstaerken')
    info('<b>Mauer verstärken:</b> Tippe auf ein Stück der Außenmauer (oben). Die Toten suchen sich die schwächste Stelle.');
  else if (werkzeug === 'abreissen') info('<b>Abreißen:</b> Tippe auf ein eigenes Bauwerk. Du bekommst die Hälfte zurück.');
  else info(`<b>${BAUTEN[werkzeug].name}</b> (${BAUTEN[werkzeug].kosten} Schrott): ${BAUTEN[werkzeug].text}`);
  hud();
}

// ---------- Tippen auf die Karte ----------

renderer.beimTippen((x, y) => {
  if (sim) return;
  const i = idx(x, y);
  if (!werkzeug) {
    beschreibeFeld(x, y);
    return;
  }
  const zweitesMal = vorschau?.i === i && vorschau.art === werkzeug;

  if (werkzeug === 'verstaerken') {
    if (y !== ZEILE_AUSSENMAUER || x < 1 || x >= BREITE - 1) {
      toast('Verstärken kann man nur die Außenmauer ganz oben.');
      return;
    }
    const stufe = stand.mauerStufe[x] ?? 0;
    if (!zweitesMal) {
      const ok = stufe < MAUER.maxStufe && stand.schrott >= MAUER.kosten(stufe);
      vorschau = { i, art: 'verstaerken', ok };
      info(
        stufe >= MAUER.maxStufe
          ? '<b>Mauer:</b> Dieses Stück ist schon voll verstärkt.'
          : `<b>Mauer Stufe ${stufe} → ${stufe + 1}</b> für ${MAUER.kosten(stufe)} Schrott. Nochmal tippen zum Verstärken.`,
      );
      return;
    }
    const f = verstaerkeMauer(stand, x);
    if (f === 'schrott') toast('Zu wenig Schrott.');
    else if (f === 'max') toast('Mehr geht hier nicht.');
    else gebaut(`Mauer verstärkt auf Stufe ${stand.mauerStufe[x]}.`);
    vorschau = null;
    return;
  }

  if (werkzeug === 'abreissen') {
    const id = stand.bauten[i];
    if (!id) {
      toast('Hier steht nichts Eigenes zum Abreißen.');
      return;
    }
    if (!zweitesMal) {
      vorschau = { i, art: 'abreissen', ok: true };
      info(`<b>${BAUTEN[id].name} abreißen?</b> Nochmal tippen, du bekommst ${Math.floor(BAUTEN[id].kosten / 2)} Schrott zurück.`);
      return;
    }
    const zurueck = reisseAb(stand, i);
    vorschau = null;
    gebaut(`Abgerissen, ${zurueck} Schrott zurück.`);
    return;
  }

  const fehler = kannBauen(stand, i, werkzeug);
  if (!zweitesMal) {
    vorschau = { i, art: werkzeug, ok: !fehler };
    if (fehler === 'boden') info('Hier kann man nicht bauen. Gebaut wird zwischen Außenmauer und Haupttor.');
    else if (fehler === 'belegt') info('Hier steht schon etwas.');
    else if (fehler === 'schrott') info(`Zu wenig Schrott: ${BAUTEN[werkzeug].name} kostet ${BAUTEN[werkzeug].kosten}.`);
    else info(`<b>${BAUTEN[werkzeug].name}</b> hier bauen? Nochmal tippen. Der Kreis zeigt die Reichweite.`);
    return;
  }
  if (fehler) {
    toast(fehler === 'schrott' ? 'Zu wenig Schrott.' : 'Hier geht das nicht.');
    return;
  }
  baue(stand, i, werkzeug);
  vorschau = null;
  gebaut(`${BAUTEN[werkzeug].name} gebaut.`);
});

function gebaut(text: string): void {
  spiele(text.startsWith('Abgerissen') ? 'hacken' : 'holz', 0.5);
  speichere(stand);
  tagNeuBerechnen();
  info(text + ' Die roten Fußspuren zeigen, wo die Toten jetzt langlaufen.');
  hud();
}

function beschreibeFeld(x: number, y: number): void {
  const i = idx(x, y);
  const eigenes = stand.bauten[i];
  if (eigenes) return info(`<b>${BAUTEN[eigenes].name}:</b> ${BAUTEN[eigenes].text}`);
  const b = GRUNDKARTE[i];
  const texte: Record<string, string> = {
    draussen: '<b>Draußen:</b> Von hier kommen sie.',
    aussenmauer: `<b>Außenmauer</b>, Stufe ${stand.mauerStufe[x] ?? 0}. Wird über Tag repariert.`,
    grenze: '<b>Bezirksgrenze:</b> Dahinter liegt der Bezirk eines Nachbarn (kommt bald).',
    seitentor: '<b>Seitentor zum Nachbarn:</b> Noch verriegelt. Ab dem Mehrspieler-Teil können die Toten hier rüber.',
    rasen: '<b>Rasen:</b> Hier kann man bauen.',
    weg: '<b>Weg:</b> Hier kann man bauen, auch Fallen.',
    kies: '<b>Kies:</b> Hier kann man bauen.',
    haus: '<b>Wohnhaus:</b> Die Nachbarn halten die Tür zu.',
    kernmauer: '<b>Mauer der Hauptstadt:</b> Gehört allen. Die Toten kommen nur durchs Haupttor.',
    haupttor: '<b>Haupttor:</b> Dein Tor zur Hauptstadt. Wird über Tag repariert.',
    kern: '<b>Hauptstadt:</b> Gehört allen. Jeder Tote, der hier ankommt, kostet Lebenspunkte.',
  };
  info(texte[b] ?? '');
}

// ---------- Nacht ----------

$('nacht-knopf').addEventListener('click', () => {
  if (sim) return;
  sim = new Nachtsim(nachtEingabe(stand));
  renderer.neueNacht();
  werkzeug = null;
  vorschau = null;
  rest = 0;
  endeWarten = 0;
  $('werkzeuge').hidden = true;
  $('nacht-knopf').hidden = true;
  $('nacht-steuerung').hidden = false;
  $('nacht-anzeige').hidden = false;
  spiele('glocke2', 0.6);
  info(`<b>Es ist 18 Uhr.</b> ${sim.anzahlGesamt} Tote sind unterwegs. Halte durch!`);
  hud();
});

$('tempo').addEventListener('click', () => {
  tempo = tempo === 1 ? 2 : tempo === 2 ? 4 : 1;
  $('tempo').textContent = `Tempo ${tempo}×`;
});

$('ueberspringen').addEventListener('click', () => {
  if (!sim) return;
  while (!sim.ende) sim.schritt();
  endeWarten = 0.01;
});

function nachtVorbei(b: Nachtbilanz): void {
  sim = null;
  nachDerNacht(stand, b);
  speichere(stand);
  tagNeuBerechnen();
  $('werkzeuge').hidden = false;
  $('nacht-knopf').hidden = false;
  $('nacht-steuerung').hidden = true;
  $('nacht-anzeige').hidden = true;
  zeigeBilanz(b);
  spiele(b.ausgang === 'gefallen' ? 'glocke' : 'muenzen2', 0.6);
  info('Der Tag bricht an. Mauer und Tor sind geflickt, Zerstörtes musst du neu bauen.');
  hud();
}

function zeigeBilanz(b: Nachtbilanz): void {
  const titel =
    b.ausgang === 'gefallen'
      ? 'Die Hauptstadt ist gefallen'
      : b.kernSchaden === 0
        ? `Nacht ${b.nacht}: gehalten!`
        : `Nacht ${b.nacht} überstanden`;
  $('bilanz-titel').textContent = titel;
  const zeilen: string[] = [];
  for (const t of GEGNER_REIHENFOLGE) {
    if (b.getoetet[t]) zeilen.push(`<span>${GEGNER[t].name} erledigt</span><span class="zahl">${b.getoetet[t]}</span>`);
  }
  zeilen.push(`<span>Bis zur Hauptstadt durchgekommen</span><span class="zahl">${b.durchgekommen}</span>`);
  zeilen.push(`<span>Schaden an der Hauptstadt</span><span class="zahl">${b.kernSchaden}</span>`);
  zeilen.push(`<span>Schrott von den Toten</span><span class="zahl">+${b.schrott}</span>`);
  if (b.ausgang !== 'gefallen') zeilen.push(`<span>Sammler über Tag</span><span class="zahl">+30</span>`);
  const zerstoert = Object.entries(b.zerstoert)
    .filter(([id]) => id !== 'aussenmauer' && id !== 'haupttor')
    .map(([id, n]) => `${n}× ${BAUTEN[id as BauId].name}`);
  if (zerstoert.length) zeilen.push(`<span>Verloren</span><span class="zahl">${zerstoert.join(', ')}</span>`);
  const ehrungen = b.auszeichnungen.map((a) => `<div class="ehrung">${a}</div>`).join('');
  const gefallen =
    b.ausgang === 'gefallen'
      ? `<p class="leise">Alle fangen gemeinsam von vorn an. Ab einem der nächsten Meilensteine bleiben Erinnerungen,
         die ihr in die Chronik eintragt und die euch beim nächsten Mal stärker machen.</p>`
      : '';
  $('bilanz-inhalt').innerHTML = `<div class="zeilen">${zeilen.join('')}</div>${ehrungen}${gefallen}`;
  $('bilanz-weiter').textContent = b.ausgang === 'gefallen' ? 'Neue Epoche beginnen' : 'Weiter zum Tag';
  $<HTMLDialogElement>('bilanz').showModal();
}

$('bilanz-weiter').addEventListener('click', () => {
  $<HTMLDialogElement>('bilanz').close();
  if (stand.gefallen) {
    stand = neuerSpielstand(neuerSeed(), stand.epoche + 1);
    speichere(stand);
    tagNeuBerechnen();
    info(`Epoche ${stand.epoche} beginnt. Neue Mauern, neues Glück.`);
    hud();
  }
});

// ---------- Menü ----------

$('menue-knopf').addEventListener('click', () => {
  const liste = $('bestiarium');
  liste.innerHTML = '';
  for (const t of GEGNER_REIHENFOLGE) {
    const g = GEGNER[t];
    const bild = renderer.bildVon(t);
    const d = document.createElement('div');
    d.className = 'bestie';
    d.innerHTML = `<img alt="" src="${bild}"><div><b>${g.name}</b> (ab Nacht ${g.abNacht})<br><span class="leise">${g.text}</span></div>`;
    liste.append(d);
  }
  $<HTMLInputElement>('ton-schalter').checked = tonAn();
  $<HTMLDialogElement>('menue').showModal();
});

$('ton-schalter').addEventListener('change', (e) => {
  setzeTon((e.target as HTMLInputElement).checked);
  spiele('schalter', 0.5);
});

$('menue-zu').addEventListener('click', () => $<HTMLDialogElement>('menue').close());

$('neu-anfangen').addEventListener('click', () => {
  if (!confirm('Wirklich ganz von vorn anfangen? Dein Bezirk wird geräumt.')) return;
  stand = neuerSpielstand(neuerSeed());
  speichere(stand);
  tagNeuBerechnen();
  $<HTMLDialogElement>('menue').close();
  info('Neuer Anfang. Wähle unten ein Bauwerk und tippe auf ein Feld.');
  hud();
});

// ---------- Hauptschleife ----------

function anpassen(): void {
  const r = buehne.getBoundingClientRect();
  renderer.groesse(Math.floor(r.width), Math.floor(r.height));
}
new ResizeObserver(anpassen).observe(buehne);

let letzte = performance.now();
function schleife(jetzt: number): void {
  // Auf langsamen Geräten mehrere Schritte pro Bild rechnen, damit die Nacht nicht zäh wird
  const dt = Math.min(0.25, (jetzt - letzte) / 1000);
  letzte = jetzt;
  if (sim) {
    if (!sim.ende) {
      rest += dt * tempo;
      while (rest >= NACHT.dt && !sim.ende) {
        rest -= NACHT.dt;
        sim.schritt();
        renderer.ereignisse(sim.ereignisse);
        toeneFuer(sim.ereignisse);
      }
      $('nacht-anzeige').textContent = `Noch ${sim.nochUnterwegs} Tote`;
      hud();
    } else {
      endeWarten += dt;
      if (endeWarten > 1.2) nachtVorbei(sim.ergebnis());
    }
  }
  renderer.zeichne(
    sim
      ? { bauten: sim.bauten, mauerStufe: stand.mauerStufe, gegner: sim.gegner, nacht: true, vorschau: null, laufweg: null }
      : { bauten: tagBauten, mauerStufe: stand.mauerStufe, gegner: [], nacht: false, vorschau, laufweg: tagLaufweg },
    jetzt / 1000,
    dt * (sim ? tempo : 1),
  );
  requestAnimationFrame(schleife);
}

hud();
void renderer.bereit.then(() => werkzeugLeiste());
if (stand.gefallen && stand.letzteBilanz) zeigeBilanz(stand.letzteBilanz);
else if (stand.nacht === 1 && Object.keys(stand.bauten).length === 0) {
  info('<b>Willkommen in deinem Bezirk.</b> Um 18 Uhr kommen die Toten von oben. Bau Türme zwischen Mauer und Tor, dann starte die Nacht.');
}
anpassen();
requestAnimationFrame(schleife);
