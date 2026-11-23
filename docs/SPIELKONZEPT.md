# Spielkonzept: Protect the Capital

Stand: 23.11.2026, Entwurf 1. Alles hier ist verhandelbar.

> Ein düster-lustiges Koop-Spiel für Familie und Freunde, gespielt am Handy:
> Aufbau, Tower Defense und Incremental in einem. Jeden Abend um 18 Uhr kommen die Toten.
> Fällt die Hauptstadt, fangen alle gemeinsam von vorn an, aber stärker.

---

## 1. Spielgefühl

- **Friendslop:** chaotisch, gemeinsam, viel Schadenfreude. Man hilft sich, man schiebt sich die Schuld zu,
  man lacht über die Wiederholung des Angriffs.
- **Incremental:** Ressourcen laufen auch offline weiter. Zahlen werden groß, Automatisierung nimmt Arbeit ab.
- **Tower Defense:** Die Toten suchen sich den Weg des geringsten Widerstands. Den gestaltet man selbst.
- **Stadtaufbau:** Der eigene Bezirk ist Zuhause, Werkstatt und Festung zugleich.
- **Optik:** 3D in Low-Poly-Optik (Kenney-Stil), schräg von oben, düstere Nächte mit Laternen und Feuer,
  viele kleine Witze im Detail.

---

## 2. Die Welt: ein Ring

```
                 Außenmauer (jeder hat sein eigenes Stück)
          ┌─────────────────────────────────────────────┐
          │   Bezirk A   ║ Seitentor ║   Bezirk B        │
          │              ║           ║                   │
          │        ╔═════╩═══════════╩═════╗             │
          │ Seiten-║    KERNSIEDLUNG       ║ Seitentor   │
          │  tor   ║  (gehört allen,       ║             │
          │        ║   Haupttor je Bezirk) ║             │
          │        ╚═════╦═══════════╦═════╝             │
          │   Bezirk D   ║ Seitentor ║   Bezirk C        │
          └─────────────────────────────────────────────┘
```

- **Außen:** Die Außenmauer. Jeder Bezirk besitzt sein eigenes Mauerstück und baut es selbst aus.
- **Bezirke:** Sie liegen im Ring, je Spieler einer. Jeder Bezirk grenzt an zwei Nachbarn und hat zu jedem ein
  **Seitentor**, das sich verstärken lässt.
- **Haupttor:** Jeder Bezirk hat ein eigenes Tor zur Kernsiedlung.
- **Kernsiedlung (Hauptstadt):** Sie gehört allen. Ausbau und Forschung dort sind gemeinsam.
- **Leere Plätze:** Spielen weniger Leute, als Bezirke da sind, werden die freien Bezirke zu „Verwaisten Vierteln“
  mit schwacher Bürgerwehr. Sie sind Risiko und Chance zugleich, denn man kann sie gemeinsam übernehmen.

### Wie die Toten laufen
- Sie greifen die Außenmauer an der schwächsten Stelle an.
- Im Bezirk berechnet ein **Strömungsfeld** (Flow Field) für jede Kachel den „billigsten“ Weg zum Kern.
  Billig heißt: wenig Mauer, wenig Türme, wenig Fallen.
- Ist das eigene Haupttor stärker als das Seitentor zum Nachbarn, **queren die Toten zum Nachbarn**.
  Schlecht ausgebaut heißt also: Man bekommt Besuch von drüben.
- **Freundschaftsdienst und Gemeinheit:** Seitentore lassen sich in der Wachstunde absichtlich öffnen oder verriegeln.
  Das sorgt für Absprachen, Bündnisse und herrliche Beschuldigungen. Ein Protokoll zeigt hinterher, wer wann welches Tor
  geöffnet hat.

---

## 2a. Der Bezirk im Detail (Stand 23.11.2026, nach Rückmeldung von Alex)

Wir sind **sieben Leute**. Der Ring hat also sieben Bezirke um die Hauptstadt.

### Bezirkstypen
Jeder Bezirk wird **zugelost**, und zwar jedes Mal neu, wenn er fällt. Jeder Typ hat eine eigene Grundkarte mit festen
Hindernissen, einem typischen Straßennetz, einem eigenen Gebäude und einem Bonus. Innerhalb eines Typs mischt der Zufall
die Karte, sodass kein Bezirk aussieht wie ein anderer.

| Typ | Gelände und Route | Eigenes Gebäude | Bonus |
|---|---|---|---|
| **Altstadt** | enge, verwinkelte Gassen zwischen Fachwerk-Ruinen, Marktplatz, Kirche; wenig Bauplatz, viele Engstellen | **Glockenturm**: Vorwarnung vor der Nacht, Moral | Forschung |
| **Vorstadt** | breite Straßen mit Kurven, Einfamilienhäuser mit Gärten, Zäune und Hecken; viel Platz | **Baumarkt**: Bauen günstiger | Bewohner |
| **Industriegebiet** | Hallen, Containerstapel, ein Gleisdamm mit nur einem Bahnübergang | **Schrottpresse**: mehr Schrott aus Wracks | Schrott, Strom |
| **Dorf am Bach** | Felder, Scheune, Hühnerstall; ein Bach quer durch mit zwei Brücken als natürliche Engstellen | **Wassermühle**: Mehl und Strom | Nahrung, Wasser |

### Die Route der Toten
- In der Außenmauer gibt es ein **Stadttor**, nie direkt über dem Haupttor. Die Toten kommen vom **Friedhof** hinter
  der Landstraße.
- Vom Stadttor führt ein **Straßennetz** mit Kurven und Kreuzungen zum Haupttor. Die Toten laufen **lieber auf Straßen**;
  querfeldein geht, ist aber langsamer.
- **Feste Hindernisse** je Typ (Häuserblöcke, Bach, Gleisdamm, Hallen) erzwingen Umwege und schaffen Engstellen.
- **Bauen ist frei.** Man darf den Weg verlängern oder sperren, aber was im Weg steht, wird angegriffen.
- Die Außenmauer bleibt angreifbar: Ist das Stadttor stark und ein Mauerstück schwach, brechen sie dort durch.
- Die Karte wird größer als bisher und lässt sich verschieben und zoomen.

### Gebäude: Jedes hat eine Aufgabe und steht im Weg
| Art | Gebäude | Aufgabe |
|---|---|---|
| Wohnen | Wohnhaus, Notunterkunft, **Bezirkswache** (Herz des Bezirks) | Bewohner = Arbeitskräfte |
| Versorgung | Gemüsegarten, Acker, Hühnerstall, Brunnen, Regentonne, später Wasserturm | Nahrung, Wasser |
| Rohstoffe | Holzplatz, Schrottplatz, Steinbruch aus Ruinen, später Generator und Solardach | Holz, Schrott, Stein, Strom |
| Verarbeitung | Werkstatt, Munitionsbank, Apotheke | Bauteile, Munition, Medizin |
| Forschung | Werkstattlabor, Bücherei | Wissen für den Techtree |
| Verteidigung | Türme, Fallen, Barrikaden, Mauern | Kämpfen, bremsen, lenken |
| Besonderes | Lazarett, Funkturm, Lager | Reparieren, Vorwarnung, Lagerplatz |

Gebäude brauchen **Bewohner** als Besatzung. Ohne Leute arbeitet auch der beste Turm nicht.

### Rohstoffe (viele, aber nach und nach)
- **Zum Start:** Holz, Schrott, Nahrung, Bewohner.
- **Über Techtree und Zeitalter dazu:** Stein, Wasser, Strom, Bauteile, Munition, Medizin, Treibstoff, Wissen.
- So gibt es auf Dauer viel Tiefe, ohne dass der erste Abend überfordert.

### Wenn ein Bezirk fällt
- Jeder Bezirk hat eine **Bezirkswache**. Wird sie zerstört oder sind alle Bewohner tot, **fällt der Bezirk**.
- Der Bezirk wird geräumt und **neu gelost** (neuer Typ, neue Karte). Die eigene Chronik bleibt.
- Bis zum Wiederaufbau ist der Bezirk ein Einfallstor: Die Nachbarn bekommen über ihre Seitentore mehr Besuch.
- Fällt die **Hauptstadt**, beginnt für alle eine neue Epoche, und alle Bezirke werden neu gelost.

### Die anderen besuchen
- Über eine **Ringkarte** sieht man alle sieben Bezirke und die Hauptstadt. Ein Tipp auf einen Bezirk öffnet ihn
  zum Anschauen (nicht zum Bauen), mit der Wiederholung seiner letzten Nacht.

## 3. Tagesablauf

| Uhrzeit (Europe/Berlin) | Phase | Was passiert |
|---|---|---|
| ganzer Tag | **Aufbauphase** | Bauen, forschen, sammeln, handeln. Offline läuft die Produktion weiter. |
| 17:30 bis 18:00 | **Wachstunde** | Tore stellen, Notfallaktionen vorbereiten, Absprachen im Chat. |
| 18:00 | **Angriff** | Der Server rechnet die Nacht durch, immer gleich bei gleichen Daten. |
| ab 18:00 | **Wiederholung** | Alle sehen sich den Angriff als Wiedergabe an, mit Zeitlupe, Höhepunkten und Ehrungen. |

- Wer um 18 Uhr nicht online ist, verpasst nichts. Die Verteidigung steht ja.
- **Auszeichnungen nach jeder Nacht:** „Held des Abends“, „Torwächter“, „Hat die Horde zum Nachbarn geschickt“,
  „Pupsbeulen-Opfer“. Das ist der Friendslop-Kern.
- Jede Nacht ist etwas schwerer. Gleichzeitig wachsen Produktion und Forschung, sodass man mithalten kann,
  wenn man klug baut.

---

## 4. Der Fall der Hauptstadt: Roguelike-Schleife

- Fällt die Kernsiedlung, endet die **Epoche** für alle gleichzeitig.
- Alle Bezirke werden geräumt. Was bleibt:
  - **Erinnerungen** (Meta-Währung), berechnet aus überlebten Nächten, besiegten Toten und Errungenschaften.
  - Die **Chronik** (Ebene 3 des Techtrees), in die man Erinnerungen einträgt und damit dauerhafte Vorteile freischaltet.
  - Freigeschaltete Baupläne, Bestiarium-Einträge und kosmetische Dinge.
- Jede neue Epoche bringt einen **Epochen-Modifikator**, über den abgestimmt wird, zum Beispiel
  „Dauerregen: Feuer schwächer, Elektrik gefährlicher“ oder „Mondfinsternis: Nachtjäger kommen früher“.
- Ziel ist, dass ein Neubeginn sich nicht wie Verlust anfühlt, sondern wie ein Schritt weiter.

---

## 5. Der Techtree: „Das Wurzelwerk“

### Recherche: Wie groß sind die größten?
- **Path of Exile:** Laut offizieller Seite umfasst der passive Baum **1.325 Knoten**. Er gilt als einer der größten
  Fertigkeitsbäume überhaupt.
- **Stellaris** und andere 4X-Spiele haben einige hundert Technologien plus **unendlich wiederholbare** Forschung
  mit steigenden Kosten.
- **Aurora 4X:** neun große Forschungsbereiche mit jeweils Dutzenden Technologien, insgesamt mehrere hundert.
- **Antimatter Dimensions** (Incremental) hält Spieler jahrelang mit **gestapelten Prestige-Ebenen** bei der Stange:
  Infinity, Eternity, Reality und danach die Celestials. Jede Ebene ändert die Spielregeln.

Daraus folgt: **Größe allein motiviert nicht zehn Jahre lang.** Was trägt, ist die Kombination aus vielen sinnvollen Knoten,
Ebenen, die neue Mechaniken freischalten, und unendlicher Forschung für das Ende.

### Unsere Schippe obendrauf: fünf Ebenen

| Ebene | Name | Wem gehört sie? | Bleibt nach dem Fall? | Umfang (Ziel) |
|---|---|---|---|---|
| 1 | **Bezirksforschung** | jedem selbst | nein | ca. 720 Knoten in 12 Ästen |
| 2 | **Gemeinschaftsforschung** | allen (Kernsiedlung) | nein | ca. 360 Knoten in 6 Ästen |
| 3 | **Chronik** | jedem selbst | **ja** | ca. 540 Knoten |
| 4 | **Zeitalter** | allen | **ja** | 9 Zeitalter mit je ca. 80 Knoten = 720 |
| 5 | **Endlose Forschung** | jedem und allen | ja | unendlich, mit Meilensteinen alle 25 Stufen |

**Summe handgebauter Knoten: rund 2.340**, also fast doppelt so viel wie Path of Exile, plus unendlich viele
Wiederholungsstufen. Dazu kommt ein **sechster Baum, der den Gegnern gehört** (siehe unten).

### Ebene 1: Bezirksforschung (12 Äste)
1. **Mauern und Tore:** Holz, Stein, Beton, Stahl, Stacheldraht, Fallgitter, Torautomatik
2. **Türme und Fallen:** Wachturm, Armbrust, Speerfalle, Fallgrube, Kreissäge, Flammenwerfer-Turm
3. **Schusswaffen:** Schrotflinte bis Gauss-Gewehr, Munitionsfertigung
4. **Nahkampf und Handwerk:** Spaten, Kettensäge, Rasenmäher-Rüstung
5. **Chemie und Feuer:** Molotow, Napalm, Säure, Löschschaum gegen eigene Brände
6. **Strom und Elektrik:** Generator, Solar, Elektrozaun, Teslaspule
7. **Landwirtschaft und Versorgung:** Gemüse, Hühner, Konserven, Brauerei
8. **Medizin und Seuchenforschung:** Bisswunden behandeln, Impfstoff-Fragmente, Obduktionen (schalten Bestiarium frei)
9. **Bewohner und Moral:** Überlebende anwerben, Schichtpläne, Grillabend gegen Panik
10. **Aufklärung und Funk:** Späher, Funkturm, Drohnen, Vorwarnung über die nächste Nacht
11. **Schrott und Recycling:** Sammler, Schrottpresse, Zombie-Reste verwerten (düster, aber lustig)
12. **Absonderliches:** Voodoo-Puppen, Gartenzwerg-Armee, verfluchte Schallplatten, Köder-Musik

### Ebene 2: Gemeinschaftsforschung (6 Äste)
Haupttore, Kernmauer, Rathaus-Bunker, gemeinsame Werkstätten, Handelsnetz zwischen Bezirken, Großprojekte
(zum Beispiel ein Riesengeschütz auf dem Kirchturm, an dem alle mitbezahlen).

### Ebene 3: Chronik
Dauerhafte Vorteile: Startressourcen, schnellerer Aufbau, zusätzliche Baupläne, mehr Erinnerungen, neue Bezirks-Grundformen,
Spezialisierungen (Baumeister, Chemikerin, Jäger, Bürgermeister).

### Ebene 4: Zeitalter (Prestige-Schichten)
Jedes Zeitalter wird durch einen großen Meilenstein über mehrere Epochen hinweg erreicht und **ändert Regeln**:

1. **Notzeit:** Grundspiel
2. **Wiederaufbau:** Handel zwischen Bezirken, Märkte
3. **Ordnung:** Gesetze, die alle beschließen (zum Beispiel „Ausgangssperre“, „Freibier“)
4. **Funkzeit:** Kontakt zu anderen Welten (andere Freundesgruppen), gemeinsame Ereignisse
5. **Forschungszeit:** Gegenmittel-Projekt, Zombies teilweise zähmbar
6. **Expedition:** Bezirke außerhalb der Außenmauer, Ausflüge in die tote Stadt
7. **Mutationszeit:** Die Toten entwickeln sich schneller, neue Gegnerfamilien
8. **Legenden:** Bosse aus der Folklore, Sagenwelt wird real
9. **Endzeit:** Der Ursprung der Seuche, ein Abschluss, der danach in Endlosschleife weitergeht

### Ebene 5: Endlose Forschung
Wiederholbare Stufen mit exponentiell steigenden Kosten. Alle 25 Stufen ein sichtbarer Meilenstein (neues Aussehen,
kleiner Spezialeffekt), damit es nie nur eine Zahl ist.

### Der Gegner-Baum: „Die Mutation“
Auch die Toten forschen. Jede Nacht sammeln sie Punkte und schalten Eigenschaften frei, abhängig davon,
**wie ihr euch verteidigt**: Viel Feuer bringt feuerfeste Toten, viele Mauern bringen Kletterer und Gräber.
Das verhindert, dass eine einzige Strategie für immer reicht.

### Rechnung für zehn Jahre
- Eine Nacht pro Tag ergibt rund **3.650 Angriffe** in zehn Jahren.
- Frühe Epochen dauern Tage, spätere Wochen bis Monate.
- Zeitalter werden grob im Abstand von ein bis zwei Jahren erreicht, wenn man regelmäßig spielt.
- Saisonale Ereignisse (Halloween, Weihnachten mit „Zombie-Wichteln“, Silvester-Feuerwerk als Waffe)
  sorgen für Abwechslung im Jahreslauf.

---

## 6. Bestiarium

**Wichtig:** Namen und Aussehen aus Filmen, Serien und Spielen sind geschützt. Wir übernehmen die **Spielidee** (das Archetyp),
aber mit **eigenem Namen und eigenem Aussehen**. Das ist auch lustiger. Die Spalte „Vorbild“ ist nur zur Orientierung
und kommt nicht ins Spiel.

### Klassiker und Folklore
| Unser Name | Vorbild (Archetyp) | Eigenschaft |
|---|---|---|
| Schlurfi | klassischer langsamer Untoter (Romero-Filme) | langsam, zahlreich, Grundfutter |
| Nachzehrer | Nachzehrer, deutsche Volkssage | schwächt Nachbarn aus der Ferne, solange er lebt |
| Bokor-Diener | Zombie aus dem haitianischen Volksglauben | gehorcht einem Anführer, fällt um, wenn der stirbt |
| Draugr | nordische Sagenwelt | sehr zäh, wächst mit der Zeit, hortet Schätze |
| Hüpfgeist | Jiangshi, chinesische Folklore | hüpft über niedrige Hindernisse, scheut Spiegel |
| Ghul | Ghul, arabische Folklore | frisst Gefallene und wird dadurch stärker |
| Wiedergänger | Wiedergänger, europäische Sagen | kehrt einmal pro Nacht zurück |

### Aus Film, Serie und Literatur
| Unser Name | Vorbild (Archetyp) | Eigenschaft |
|---|---|---|
| Sprinter-Sigi | rasende Infizierte (28 Days Later) | sehr schnell, wenig Leben |
| Menschenpyramide | Schwarmverhalten (World War Z) | stapelt sich an Mauern hoch und klettert drüber |
| Die Herde | große Herden (The Walking Dead) | riesige Gruppe, folgt Lärm |
| Brunnenbeißer | aufgedunsener Untoter im Brunnen (The Walking Dead) | vergiftet Wasserquellen |
| Nachtjäger | lichtscheue Jäger (Ich bin Legende) | nur nachts, flieht vor Scheinwerfern |
| Hungerwandler | hungrige Nachtzombies (Kingdom) | tagsüber versteckt, nachts in Wellen |
| Gehirnfreund | redende, unzerstörbare Untote (Return of the Living Dead) | ruft Verstärkung, nur durch Verbrennen zu stoppen |
| Romantiker | fühlender Zombie (Warm Bodies) | harmlos, kann bekehrt werden und hilft dann |
| Der Clown | Zombie-Clown (Zombieland) | lenkt Türme ab |

### Aus Spielen
| Unser Name | Vorbild (Archetyp) | Eigenschaft |
|---|---|---|
| Pupsbeule | aufgeblähter Kotzer (Left 4 Dead) | platzt, lockt alle Toten in der Nähe an |
| Kettenraucher | Zungenwürger (Left 4 Dead) | zieht Verteidiger von der Mauer |
| Hechtsprung-Horst | Springer (Left 4 Dead) | springt über Fallen |
| Huckepack-Hansi | Reiter (Left 4 Dead) | lenkt Verteidiger in die falsche Richtung |
| Rammbock-Rudi | Rammer (Left 4 Dead) | schweren Schaden an Toren |
| Spuckspecht | Säurespucker (Left 4 Dead) | Fläche aus Säure, beschädigt Gebäude |
| Schrankwand | Riesen-Untoter (Left 4 Dead) | Boss, wirft Trümmer |
| Heulsuse | sitzende Weinende (Left 4 Dead) | harmlos, bis man sie stört |
| Knackschädel | blinder Klicker (The Last of Us) | blind, ortet über Geräusche |
| Sporensack | Pilz-Aufgeblähter (The Last of Us) | wirft Sporenwolken |
| Rattenkönig | verschmolzene Masse (The Last of Us) | Boss, teilt sich auf |
| Leckmichl | Zungen-Kriecher (Resident Evil) | klettert an Wänden |
| Mantelmann | unaufhaltsamer Verfolger (Resident Evil) | Boss, kommt jede Nacht wieder |
| Köter | Zombiehunde (Resident Evil) | schnell, Rudel |
| Nachtflitzer | Nachtjäger (Dying Light) | sehr gefährlich, nur in langen Nächten |
| Abrissbirne | Zerstörer (Dying Light) | wirft Felsen auf Türme |
| Kreischliese | Schreier (Dying Light, State of Decay) | schreit, lockt Horden, macht Türme panisch |
| Muskelberg | Juggernaut (State of Decay) | sehr viel Leben, langsam |
| Leuchtkäfer | strahlende Untote (7 Days to Die) | regeneriert, glüht im Dunkeln |
| Wutbürger | Zeitungsleser (Plants vs. Zombies) | wird rasend, wenn seine Zeitung zerstört ist |
| Eimerkopf | Eimer-Zombie (Plants vs. Zombies) | Helm aus Haushaltswaren |
| Stabhochspringer | Stabhochspringer (Plants vs. Zombies) | überspringt die erste Mauer |
| Maulwurf-Manni | Gräber (Plants vs. Zombies) | gräbt sich unter der Mauer durch |
| Ballon-Bärbel | Ballon-Zombie (Plants vs. Zombies) | fliegt, nur von Türmen mit Reichweite zu treffen |
| Die Horde | Massenhorden (Days Gone) | hunderte auf einmal, ganz eigene Nacht |

### Deutscher Lokalkolorit (eigene Ideen)
| Unser Name | Eigenschaft |
|---|---|
| Schützenkönig | trägt Uniform, schießt zurück |
| Paketbote | klingelt an jedem Tor, kommt immer wieder, egal wie oft man ihn besiegt |
| Gartenzwerg-Untoter | winzig, kaum zu treffen |
| Bürgermeister-Zombie | Boss, erlässt Verordnungen gegen eure Türme |
| Bauamt-Zombie | stempelt Gebäude ab, die dann eine Nacht lang ausfallen |

### Menschliche Gegner
| Unser Name | Vorbild (Archetyp) | Eigenschaft |
|---|---|---|
| Plünderer | Banden aus vielen Endzeitgeschichten | stehlen Vorräte in der Aufbauphase |
| Die Maskierten | Sekte, die sich als Tote tarnt (The Walking Dead) | mischen sich unter Horden, öffnen Tore |
| Die Beschützer | Schutzgeld-Bande (The Walking Dead) | verlangen Abgaben, sonst Angriff |
| Säuberungskommando | Militär, das alles räumen will | kommt mit Panzern, gegen Tote und Lebende |
| Kopfgeldjäger | Söldner | Auftrag gegen den stärksten Bezirk |

Ziel für zehn Jahre: über **150 Gegnertypen**, freigeschaltet über Zeitalter, Mutationsbaum und saisonale Ereignisse.

---

## 7. Technik (außerhalb von Claude kostenlos)

| Teil | Werkzeug | Warum |
|---|---|---|
| Spiel im Browser | Vite, TypeScript, Three.js | 3D in Low-Poly-Optik, läuft im Browser auch auf dem Handy |
| Hosting | Cloudflare Pages | gratis, automatisch nach jedem Push |
| Server-Logik | Cloudflare Workers | gratis-Kontingent, kein Server zu warten |
| Spielstand je Welt | Durable Objects mit SQLite | ein Objekt pro Welt hält alles zusammen; laut Cloudflare im Gratis-Plan nutzbar |
| Angriff um 18 Uhr | Alarm im Durable Object | startet die Simulation pünktlich |
| Kampfsimulation | eigene, deterministische TypeScript-Engine | läuft gleich auf Server und Handy, darum fälschungssicher und als Wiederholung abspielbar |
| Anmeldung | Einladungslink plus Gerätecode | für Familie und Freunde reicht das, keine Passwörter |
| Grafik | Kenney-Modelle (CC0) plus eigene Low-Poly-Ergänzungen | einheitlicher Stil, kostenlos, ohne Lizenzpflichten |

Gratis-Grenzen laut Cloudflare (Stand der Doku, wird vor dem Start nochmal geprüft): unter anderem 5 GB Speicher je Konto,
5 Millionen gelesene und 100.000 geschriebene Zeilen pro Tag. Für eine Freundesgruppe ist das weit mehr als genug.

---

## 8. Ehrliche Einschätzung

- **Zehn Jahre Inhalt baut man nicht vorab.** Wir bauen das Gerüst so, dass Inhalte (Knoten, Gegner, Ereignisse)
  **Daten sind und keine Programmlogik**. Dann können wir jahrelang nachlegen, ohne alles umzubauen.
- **2.340 Knoten klingen toll, sind aber nur gut, wenn jeder Knoten etwas spürbar ändert.** Lieber 300 gute Knoten zum Start
  und dann wachsen als 2.000 Knoten mit „+1 %“.
- **Fairness bei Ungleichheit:** Wer wenig spielt, darf die anderen nicht dauerhaft runterziehen. Vorschlag: Verwaiste Bezirke
  übernehmen nach einigen Tagen ohne Anmeldung automatisch die Bürgerwehr, und die Nachbarn bekommen einen Bonus.
- **Spieldesign braucht Testen.** Die Balance (wie schwer wird jede Nacht?) wird mehrfach nachjustiert werden müssen.

---

## 9. Fahrplan

| Meilenstein | Inhalt |
|---|---|
| **M1: Spielbarer Kern** | Karte mit einem Bezirk, Mauer, Haupttor, Kern, 3 Türme, 3 Gegnertypen, Angriff per Knopf, deterministische Simulation mit Tests |
| **M1b: Lebendiger Bezirk** (erledigt) | Bezirksgenerator mit vier Typen, Stadttor, Straßennetz, feste Hindernisse, größere Karte; Gebäude mit Aufgaben, Holz, Schrott, Nahrung, Bewohner; Bezirkswache |
| **M2: Mehrspieler** | Ring mit sieben Bezirken, Seitentore, Queren zum Nachbarn, Ringkarte zum Besuchen, Einladungslinks, Angriff um 18 Uhr, Wiederholung, Bezirk fällt und wird neu gelost |
| **M3: Incremental** | Ressourcen, Offline-Produktion, Bezirksforschung mit den ersten 3 Ästen |
| **M4: Roguelike** | Fall der Hauptstadt, Erinnerungen, Chronik, Epochen-Modifikatoren |
| **M5: Friendslop** | Auszeichnungen, Protokoll, Chat, Toröffnen, Wachstunde |
| **danach** | Weitere Äste, Zeitalter, Bestiarium, Mutation, saisonale Ereignisse |

---

## Quellen

- Path of Exile, offizieller passiver Baum: https://pathofexile.com/passive-skill-tree
- Aurora 4X Handbuch, Technologiebaum: https://erikevenson.github.io/aurora-manual/7-research/7.1-technology-tree.html
- Stellaris, Entwicklerforum zur Technologie: https://forum.paradoxplaza.com/forum/threads/dev-team-stellaris-technology-open-beta-released-ef75.1617180/
- Antimatter Dimensions auf Steam: https://store.steampowered.com/app/1399720/Antimatter_Dimensions/
- Cloudflare Durable Objects, Grenzen: https://developers.cloudflare.com/durable-objects/platform/limits/
- Cloudflare Durable Objects, Preise: https://developers.cloudflare.com/durable-objects/platform/pricing/
