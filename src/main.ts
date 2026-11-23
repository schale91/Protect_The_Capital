import './stil.css';
import { Renderer3D, type Vorschau } from './render3d/renderer3d';
import {
  BAUBAR,
  BAUTEN,
  type BauId,
  GEGNER,
  GEGNER_REIHENFOLGE,
  type Gruppe,
  type Menge,
  NACHT,
  ROHSTOFFE,
  ROHSTOFF_NAME,
  type Rohstoff,
} from './sim/data';
import { BEZIRK_NAME, BREITE, type BezirkTyp, ZEILE_AUSSENMAUER, idx } from './sim/karte';
import { type Nachtbilanz, Nachtsim } from './sim/nacht';
import {
  type Spielstand,
  type Tagesbericht,
  baue,
  besetzung,
  bezahlbar,
  kannBauen,
  karte,
  kosten,
  lade,
  mauerKosten,
  nachDerNacht,
  nachtEingabe,
  neuerSpielstand,
  reisseAb,
  speichere,
  verstaerkeMauer,
  wohnraum,
} from './sim/spielstand';
import { bautenAusEingabe, laufweg } from './sim/vorschau';
import goldSterne from './ui/abzeichen/gold-sterne.png';
import goldWinkel from './ui/abzeichen/gold-winkel.png';
import silberWinkel from './ui/abzeichen/silber-winkel.png';
import bronzeKleeblatt from './ui/abzeichen/bronze-kleeblatt.png';
import bronzeStreifen from './ui/abzeichen/bronze-streifen.png';
import schwarzRaute from './ui/abzeichen/schwarz-raute.png';
import schwarzFluegel from './ui/abzeichen/schwarz-fluegel.png';
import { setzeTon, spiele, tonAn, tonStarten, toeneFuer } from './ton';

// Ton darf erst nach der ersten Berührung starten
window.addEventListener('pointerdown', tonStarten, { capture: true });

type Werkzeug = BauId | 'verstaerken' | 'abreissen';
type Reiter = 'verteidigung' | 'versorgung' | 'werkzeug';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('karte');
const buehne = $('buehne');
const renderer = new Renderer3D(canvas);

let stand: Spielstand = lade() ?? neuerSpielstand(neuerSeed());
let werkzeug: Werkzeug | null = null;
let reiter: Reiter = 'verteidigung';
let vorschau: Vorschau | null = null;
let sim: Nachtsim | null = null;
let tempo = 1;
let rest = 0;
let endeWarten = 0;
let tagBauten = bautenAusEingabe(nachtEingabe(stand));
let tagLaufweg = laufweg(nachtEingabe(stand));
renderer.setzeKarte(karte(stand));

const BEZIRK_TEXT: Record<BezirkTyp, string> = {
  altstadt: 'Enge Gassen zwischen Fachwerk-Ruinen. Der Glockenturm gibt Türmen in der Nähe mehr Reichweite.',
  vorstadt: 'Breite Straßen, Gärten und Hecken. Der Baumarkt macht alles Bauen ein Fünftel billiger.',
  industrie: 'Hallen, Container und ein Gleisdamm mit nur einem Übergang. Die Schrottpresse liefert viel Schrott.',
  dorf: 'Felder, Scheune und ein Bach mit zwei Brücken. Die Wassermühle liefert viel Nahrung.',
};

function neuerSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

function tagNeuBerechnen(): void {
  const e = nachtEingabe(stand);
  tagBauten = bautenAusEingabe(e);
  tagLaufweg = laufweg(e);
  renderer.setzeKarte(karte(stand));
}

// ---------- Bilder ----------

const bilder: Partial<Record<Rohstoff | 'bewohner', string>> = {};

function preis(m: Menge): string {
  const teile = ROHSTOFFE.filter((r) => m[r]).map((r) => `<span class="kosten"><img alt="" src="${bilder[r] ?? ''}">${m[r]}</span>`);
  return teile.length ? teile.join('') : 'gratis';
}

function preisText(m: Menge): string {
  return ROHSTOFFE.filter((r) => m[r])
    .map((r) => `${m[r]} ${ROHSTOFF_NAME[r]}`)
    .join(', ');
}

// ---------- Anzeige oben ----------

function hud(): void {
  $('hud-nacht').textContent = sim ? `Nacht ${stand.nacht}` : `Tag ${stand.nacht}`;
  for (const r of ROHSTOFFE) $(`hud-${r}`).textContent = `${stand.lager[r]}`;
  const b = besetzung(stand);
  $('hud-bewohner').textContent = `${stand.bewohner}/${wohnraum(stand)}`;
  $('hud-bewohner').parentElement!.classList.toggle('mangel', b.gebraucht > stand.bewohner);
  $('hud-bewohner').parentElement!.title =
    b.gebraucht > stand.bewohner
      ? `Bewohner: Es fehlen ${b.gebraucht - stand.bewohner} Leute für alle Arbeitsplätze`
      : `Bewohner: ${b.frei} ohne Arbeit`;
  const hp = sim ? Math.max(0, sim.kernHp) : stand.kernHp;
  $('hud-kern').style.width = `calc(${(100 * hp) / stand.kernMax}% + 16px)`;
  $('hud-kern').title = `${Math.ceil(hp)} von ${stand.kernMax}`;
  $<HTMLButtonElement>('nacht-knopf').textContent = `Nacht ${stand.nacht} starten`;
  for (const knopf of document.querySelectorAll<HTMLButtonElement>('.werkzeug')) {
    const w = knopf.dataset.werkzeug as Werkzeug;
    knopf.classList.toggle('aktiv', w === werkzeug);
    if (w in BAUTEN) knopf.classList.toggle('zu-teuer', !bezahlbar(stand, kosten(stand, w as BauId)));
  }
  for (const r of document.querySelectorAll<HTMLButtonElement>('.reiter')) r.classList.toggle('aktiv', r.dataset.reiter === reiter);
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
  }, 2600);
}

function info(html: string): void {
  $('info').innerHTML = html;
}

// ---------- Werkzeuge ----------

const REITER_GRUPPE: Record<Reiter, Gruppe | null> = { verteidigung: 'verteidigung', versorgung: 'versorgung', werkzeug: null };

function werkzeugLeiste(): void {
  const leiste = $('werkzeuge');
  leiste.innerHTML = '';
  const eintraege: Array<{ w: Werkzeug; name: string; preis: string; bild: string }> = [];
  const gruppe = REITER_GRUPPE[reiter];
  if (gruppe) {
    for (const id of BAUBAR.filter((b) => BAUTEN[b].gruppe === gruppe)) {
      eintraege.push({
        w: id,
        name: BAUTEN[id].name.replace('Molotow-Werfer', 'Molotow').replace('Armbrustturm', 'Armbrust').replace('Gemüsegarten', 'Garten'),
        preis: preis(kosten(stand, id)),
        bild: renderer.bildVon(id),
      });
    }
  } else {
    eintraege.push({ w: 'verstaerken', name: 'Mauer', preis: 'je Stufe', bild: renderer.bildVon('verstaerken') });
    eintraege.push({ w: 'abreissen', name: 'Abreißen', preis: '½ zurück', bild: renderer.bildVon('abreissen') });
  }
  for (const e of eintraege) {
    const b = document.createElement('button');
    b.className = 'werkzeug';
    b.dataset.werkzeug = e.w;
    b.innerHTML = `<img alt="" src="${e.bild}"><span>${e.name}</span><span class="preis">${e.preis}</span>`;
    b.addEventListener('click', () => waehle(e.w));
    leiste.append(b);
  }
  hud();
}

for (const r of document.querySelectorAll<HTMLButtonElement>('.reiter')) {
  r.addEventListener('click', () => {
    spiele('klick', 0.35);
    reiter = r.dataset.reiter as Reiter;
    werkzeug = null;
    vorschau = null;
    werkzeugLeiste();
  });
}

function bauInfo(id: BauId): string {
  const d = BAUTEN[id];
  const teile = [`<b>${d.name}</b> (${preisText(kosten(stand, id)) || 'gratis'}): ${d.text}`];
  if (d.ertrag) teile.push(`Ertrag am Tag: ${preisText(d.ertrag)}.`);
  if (d.arbeiter) teile.push(`Braucht ${d.arbeiter} Bewohner.`);
  return teile.join(' ');
}

function waehle(w: Werkzeug): void {
  spiele('klick', 0.4);
  werkzeug = werkzeug === w ? null : w;
  vorschau = null;
  if (!werkzeug) info('Wähle unten ein Bauwerk und tippe auf ein Feld.');
  else if (werkzeug === 'verstaerken')
    info('<b>Mauer verstärken:</b> Tippe auf ein Stück der Außenmauer oder das Stadttor. Die Toten suchen sich die schwächste Stelle.');
  else if (werkzeug === 'abreissen') info('<b>Abreißen:</b> Tippe auf ein eigenes Bauwerk. Du bekommst die Hälfte zurück.');
  else info(bauInfo(werkzeug));
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
      toast('Verstärken kann man nur die Außenmauer und das Stadttor ganz oben.');
      return;
    }
    const stufe = stand.mauerStufe[x] ?? 0;
    const k = mauerKosten(stand, x);
    if (!zweitesMal) {
      vorschau = { i, art: 'verstaerken', ok: stufe < 5 && bezahlbar(stand, k) };
      const was = x === karte(stand).stadttorX ? 'Stadttor' : 'Mauer';
      info(
        stufe >= 5
          ? `<b>${was}:</b> Schon voll verstärkt.`
          : `<b>${was} Stufe ${stufe} → ${stufe + 1}</b> für ${preisText(k)}. Nochmal tippen zum Verstärken.`,
      );
      return;
    }
    const f = verstaerkeMauer(stand, x);
    if (f === 'kosten') toast('Dafür reicht das Lager nicht.');
    else if (f === 'max') toast('Mehr geht hier nicht.');
    else gebaut(`Verstärkt auf Stufe ${stand.mauerStufe[x]}.`);
    vorschau = null;
    return;
  }

  if (werkzeug === 'abreissen') {
    const id = stand.bauten[i];
    if (!id) {
      toast('Hier steht nichts Eigenes zum Abreißen.');
      return;
    }
    if (BAUTEN[id].einzigartig) {
      toast(`${BAUTEN[id].name} kann man nicht abreißen.`);
      return;
    }
    if (!zweitesMal) {
      vorschau = { i, art: 'abreissen', ok: true };
      const zurueck: Menge = {};
      for (const r of ROHSTOFFE) if (BAUTEN[id].kosten[r]) zurueck[r] = Math.floor(BAUTEN[id].kosten[r]! / 2);
      info(`<b>${BAUTEN[id].name} abreißen?</b> Nochmal tippen, du bekommst ${preisText(zurueck) || 'nichts'} zurück.`);
      return;
    }
    const zurueck = reisseAb(stand, i);
    vorschau = null;
    gebaut(`Abgerissen, ${preisText(zurueck ?? {}) || 'nichts'} zurück.`);
    return;
  }

  const fehler = kannBauen(stand, i, werkzeug);
  if (!zweitesMal) {
    vorschau = { i, art: werkzeug, ok: !fehler };
    if (fehler === 'boden') info('Hier kann man nicht bauen. Auf Wasser, Gleisen, Ruinen, Hallen und Hecken geht es nicht.');
    else if (fehler === 'belegt') info('Hier steht schon etwas.');
    else if (fehler === 'kosten') info(`Zu teuer: ${BAUTEN[werkzeug].name} kostet ${preisText(kosten(stand, werkzeug))}.`);
    else
      info(
        `<b>${BAUTEN[werkzeug].name}</b> hier bauen? Nochmal tippen.${BAUTEN[werkzeug].fern ? ' Der Kreis zeigt die Reichweite.' : ''}`,
      );
    return;
  }
  if (fehler) {
    toast(fehler === 'kosten' ? 'Dafür reicht das Lager nicht.' : 'Hier geht das nicht.');
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
  werkzeugLeiste();
  info(text + ' Die roten Fußspuren zeigen, wo die Toten jetzt langlaufen.');
}

function beschreibeFeld(x: number, y: number): void {
  const i = idx(x, y);
  const eigenes = stand.bauten[i];
  if (eigenes) {
    const { aktiv } = besetzung(stand);
    const d = BAUTEN[eigenes];
    const besetzt = d.arbeiter === 0 ? '' : aktiv.has(i) ? ' Ist besetzt.' : ' <b>Steht leer:</b> Es fehlen Bewohner.';
    return info(`<b>${d.name}:</b> ${d.text}${d.ertrag ? ` Ertrag: ${preisText(d.ertrag)} am Tag.` : ''}${besetzt}`);
  }
  const k = karte(stand);
  const b = y === ZEILE_AUSSENMAUER && x === k.stadttorX ? 'stadttor' : k.boden[i];
  const texte: Record<string, string> = {
    draussen: '<b>Landstraße:</b> Dahinter liegt der Friedhof. Von dort kommen sie.',
    aussenmauer: `<b>Außenmauer</b>, Stufe ${stand.mauerStufe[x] ?? 0}. Wird über Tag repariert.`,
    stadttor: `<b>Stadttor</b>, Stufe ${stand.mauerStufe[x] ?? 0}. Ist es schwächer als die Mauer, kommen die Toten hier herein.`,
    grenze: '<b>Bezirksgrenze:</b> Dahinter liegt der Bezirk eines Nachbarn (kommt bald).',
    seitentor: '<b>Seitentor zum Nachbarn:</b> Noch verriegelt. Ab dem Mehrspieler-Teil können die Toten hier rüber.',
    rasen: '<b>Rasen:</b> Hier kann man bauen. Die Toten laufen hier langsamer als auf der Straße.',
    strasse: '<b>Straße:</b> Hier laufen die Toten am liebsten. Gut für Fallen.',
    pflaster: '<b>Kopfsteinpflaster:</b> Hier kann man bauen.',
    kies: '<b>Kies:</b> Hier kann man bauen.',
    feld: '<b>Acker:</b> Hier kann man bauen. Die Toten stapfen hier nur mühsam durch.',
    wasser: '<b>Bach:</b> Hier kommt keiner durch, nur über die Brücken.',
    bruecke: '<b>Brücke:</b> Eine Engstelle, wie gemacht für Fallen davor und Türme daneben.',
    gleis: '<b>Gleisdamm:</b> Unpassierbar, nur am Bahnübergang kommt man rüber.',
    uebergang: '<b>Bahnübergang:</b> Die einzige Stelle über die Gleise.',
    ruine: '<b>Ruine:</b> Hier steht nur noch Gemäuer. Kein Durchkommen.',
    kirche: '<b>Kirche:</b> Massives Gemäuer. Kein Durchkommen.',
    halle: '<b>Lagerhalle:</b> Kein Durchkommen.',
    container: '<b>Container:</b> Kein Durchkommen.',
    scheune: '<b>Scheune:</b> Kein Durchkommen.',
    hecke: '<b>Hecke:</b> Kein Durchkommen.',
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
  $('reiter').hidden = true;
  $('nacht-knopf').hidden = true;
  $('nacht-steuerung').hidden = false;
  $('nacht-anzeige').hidden = false;
  spiele('glocke2', 0.6);
  info(`<b>Es ist 18 Uhr.</b> ${sim.anzahlGesamt} Tote kommen vom Friedhof. Halte durch!`);
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
  const tag = nachDerNacht(stand, b);
  speichere(stand);
  tagNeuBerechnen();
  $('werkzeuge').hidden = false;
  $('reiter').hidden = false;
  $('nacht-knopf').hidden = false;
  $('nacht-steuerung').hidden = true;
  $('nacht-anzeige').hidden = true;
  werkzeugLeiste();
  zeigeBilanz(b, tag);
  spiele(b.ausgang === 'gefallen' || tag.bezirkGefallen ? 'glocke' : 'muenzen2', 0.6);
  info(
    tag.bezirkGefallen
      ? `<b>Neuer Bezirk: ${BEZIRK_NAME[stand.bezirk.typ]}.</b> ${BEZIRK_TEXT[stand.bezirk.typ]}`
      : 'Der Tag bricht an. Mauer und Tore sind geflickt, Zerstörtes musst du neu bauen.',
  );
  hud();
}

/** Abzeichen (Kenney Ranks Pack) zu jeder Ehrung. */
function abzeichen(titel: string): string {
  const liste: Array<[string, string]> = [
    ['Weiße Weste', goldSterne],
    ['Fließband', goldWinkel],
    ['Fleißigstes', silberWinkel],
    ['Nasenklammer', bronzeKleeblatt],
    ['Brennholz', bronzeStreifen],
    ['Tür auf', schwarzRaute],
    ['Hereinspaziert', schwarzRaute],
    ['Licht aus', schwarzFluegel],
  ];
  return liste.find(([anfang]) => titel.startsWith(anfang))?.[1] ?? silberWinkel;
}

function zeile(text: string, wert: number, zeichen = true): string {
  const klasse = wert > 0 ? ' plus' : wert < 0 ? ' minus' : '';
  return `<span>${text}</span><span class="zahl${klasse}">${zeichen && wert > 0 ? '+' : ''}${wert}</span>`;
}

function zeigeBilanz(b: Nachtbilanz, tag: Tagesbericht | null): void {
  const titel =
    b.ausgang === 'gefallen'
      ? 'Die Hauptstadt ist gefallen'
      : tag?.bezirkGefallen
        ? 'Dein Bezirk ist gefallen'
        : b.kernSchaden === 0
          ? `Nacht ${b.nacht}: gehalten!`
          : `Nacht ${b.nacht} überstanden`;
  $('bilanz-titel').textContent = titel;
  const zeilen: string[] = [];
  for (const t of GEGNER_REIHENFOLGE) if (b.getoetet[t]) zeilen.push(zeile(`${GEGNER[t].name} erledigt`, b.getoetet[t], false));
  zeilen.push(zeile('Bis zur Hauptstadt durchgekommen', -b.durchgekommen, false));
  const zerstoert = Object.entries(b.zerstoert)
    .filter(([id]) => id !== 'aussenmauer' && id !== 'haupttor' && id !== 'stadttor')
    .map(([id, n]) => `${n}× ${BAUTEN[id as BauId].name}`);
  if (zerstoert.length) zeilen.push(`<span>Verloren</span><span class="zahl minus">${zerstoert.join(', ')}</span>`);

  let tagHtml = '';
  if (tag && b.ausgang !== 'gefallen') {
    const t: string[] = [];
    if (tag.bezirkGefallen) {
      t.push(`<span>Neu gelost</span><span class="zahl">${BEZIRK_NAME[tag.bezirkGefallen]}</span>`);
    } else {
      for (const r of ROHSTOFFE) if (tag.ertrag[r]) t.push(zeile(`${ROHSTOFF_NAME[r]}`, tag.ertrag[r]));
      if (tag.gegessen) t.push(zeile('Gegessen', -tag.gegessen));
      if (tag.zuzug) t.push(zeile('Neue Bewohner', tag.zuzug));
      if (tag.hunger) t.push(zeile('Verhungert oder fortgezogen', -tag.hunger));
      if (tag.geflohen) t.push(zeile('Ohne Dach geflohen', -tag.geflohen));
    }
    tagHtml = `<h3>Der Tag danach</h3><div class="zeilen">${t.join('')}</div>`;
    if (tag.bezirkGefallen) {
      tagHtml += `<p class="leise">Die Bezirkswache ist gefallen oder niemand ist mehr da. Du fängst mit einem neuen Bezirk
        an: ${BEZIRK_NAME[tag.bezirkGefallen]}. Es gibt etwas mehr Material zum Wiederaufbau.</p>`;
    }
  }
  const ehrungen = b.auszeichnungen
    .map((a) => {
      const [kopf, ...rest] = a.split(': ');
      return `<div class="ehrung"><img alt="" src="${abzeichen(kopf)}"><div><b>${kopf}</b>${rest.join(': ')}</div></div>`;
    })
    .join('');
  const gefallen =
    b.ausgang === 'gefallen'
      ? `<p class="leise">Alle fangen gemeinsam von vorn an. Ab einem der nächsten Meilensteine bleiben Erinnerungen,
         die ihr in die Chronik eintragt und die euch beim nächsten Mal stärker machen.</p>`
      : '';
  $('bilanz-inhalt').innerHTML = `<h3>Die Nacht</h3><div class="zeilen">${zeilen.join('')}</div>${tagHtml}${ehrungen}${gefallen}`;
  $('bilanz-weiter').textContent = b.ausgang === 'gefallen' ? 'Neue Epoche beginnen' : 'Weiter zum Tag';
  $<HTMLDialogElement>('bilanz').showModal();
}

$('bilanz-weiter').addEventListener('click', () => {
  $<HTMLDialogElement>('bilanz').close();
  if (stand.gefallen) {
    stand = neuerSpielstand(neuerSeed(), stand.epoche + 1);
    speichere(stand);
    tagNeuBerechnen();
    werkzeugLeiste();
    info(`Epoche ${stand.epoche} beginnt. Dein neuer Bezirk: <b>${BEZIRK_NAME[stand.bezirk.typ]}</b>. ${BEZIRK_TEXT[stand.bezirk.typ]}`);
    hud();
  }
});

// ---------- Menü ----------

$('menue-knopf').addEventListener('click', () => {
  $('bezirk-info').innerHTML = `<b>${BEZIRK_NAME[stand.bezirk.typ]}</b> (Bezirk Nr. ${stand.bezirk.nr} in Epoche ${stand.epoche})<br>
    <span class="leise">${BEZIRK_TEXT[stand.bezirk.typ]}</span>`;
  const liste = $('bestiarium');
  liste.innerHTML = '';
  for (const t of GEGNER_REIHENFOLGE) {
    const g = GEGNER[t];
    const d = document.createElement('div');
    d.className = 'bestie';
    d.innerHTML = `<img alt="" src="${renderer.bildVon(t)}"><div><b>${g.name}</b> (ab Nacht ${g.abNacht})<br><span class="leise">${g.text}</span></div>`;
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
  if (!confirm('Wirklich ganz von vorn anfangen? Dein Bezirk wird geräumt und neu gelost.')) return;
  stand = neuerSpielstand(neuerSeed());
  speichere(stand);
  tagNeuBerechnen();
  werkzeugLeiste();
  $<HTMLDialogElement>('menue').close();
  info(`Neuer Anfang. Dein Bezirk: <b>${BEZIRK_NAME[stand.bezirk.typ]}</b>. ${BEZIRK_TEXT[stand.bezirk.typ]}`);
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
void renderer.bereit.then(() => {
  bilder.holz = renderer.bildVon('natur/log_stack');
  bilder.schrott = renderer.bildVon('autos/debris-tire');
  bilder.nahrung = renderer.bildVon('natur/crop_pumpkin');
  bilder.bewohner = renderer.bildVon('wohnhaus');
  for (const r of ROHSTOFFE) $<HTMLImageElement>(`symbol-${r}`).src = bilder[r]!;
  $<HTMLImageElement>('symbol-bewohner').src = bilder.bewohner;
  $<HTMLImageElement>('symbol-tag').src = renderer.bildVon('schlurfi');
  $<HTMLImageElement>('symbol-kern').src = renderer.bildVon('burg/flag');
  werkzeugLeiste();
  hud();
  $('laden').classList.add('weg');
  setTimeout(() => $('laden').remove(), 700);
});
if (stand.gefallen && stand.letzteBilanz) zeigeBilanz(stand.letzteBilanz, stand.letzterTag);
else if (stand.nacht === 1) {
  info(`<b>Dein Bezirk: ${BEZIRK_NAME[stand.bezirk.typ]}.</b> ${BEZIRK_TEXT[stand.bezirk.typ]}`);
}
anpassen();
requestAnimationFrame(schleife);
