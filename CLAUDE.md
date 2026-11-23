# Protect the Capital: Regeln für Claude

Koop-Browserspiel für Familie und Freunde: Aufbau, Tower Defense und Incremental. Jeden Abend um 18 Uhr
(Europe/Berlin) greifen die Toten an. Das Konzept steht in `docs/SPIELKONZEPT.md`.

## Pull Requests
Claude legt für seine Änderungen selbst einen Pull Request an und führt ihn ohne Rückfrage zusammen,
wenn die Action „Tests“ grün ist und es keine Konflikte gibt (Merge-Commit). Danach kurz sagen, was Alex
noch tun muss (zum Beispiel neu laden oder etwas bei Cloudflare einstellen).

## Kosten
Alles bleibt außerhalb von Claude kostenlos: GitHub Free, Cloudflare Free. Keine Dienste mit Pflicht-Zahlungsmethode,
kein Git LFS, Actions schlank halten (das Repo ist privat, das Kontingent ist begrenzt).

## Technik
- Vite, TypeScript, Three.js (3D, Low-Poly). Keine schwere Spiel-Engine.
- Modelle von Kenney (CC0) unter `public/modelle/`, Herkunft in `docs/QUELLEN.md` eintragen. Nur CC0 oder CC-BY.
- Feste Landschaft wird zu wenigen Meshes verschmolzen; aufs Handy achten (Dreiecke, Zeichenaufrufe, Lichter).
- `src/sim/` ist die Spielsimulation. Sie muss **deterministisch** sein, weil derselbe Code später auf dem Server
  um 18 Uhr rechnet und auf dem Handy als Wiederholung abspielt:
  - kein `Math.random`, nur `src/sim/rng.ts`;
  - kein `Date`, keine Zeitabfragen, keine DOM-Zugriffe;
  - kein `Math.sin`, `Math.cos`, `Math.hypot` oder andere Funktionen, deren Ergebnis zwischen Engines abweichen darf;
    `Math.sqrt` und Grundrechenarten sind in Ordnung;
  - Listen immer in fester Reihenfolge durchlaufen.
- Inhalte (Gebäude, Gegner, Wellen, später Forschung) sind **Daten** in `src/sim/data.ts`, keine Sonderlogik pro Typ,
  wo es sich vermeiden lässt. So kann das Spiel jahrelang wachsen.
- Tests mit Vitest (`npm test`). Neue Spielregeln bekommen einen Test.

## Inhalte
- Keine Namen, Figuren oder Designs aus fremden Werken (Filme, Serien, Spiele). Wir übernehmen nur Archetypen und geben
  ihnen eigene, düster-lustige deutsche Namen.
- Spieltexte auf Deutsch, alltagsnah, mit Augenzwinkern.
- Keine Gedankenstriche (Em-Dash) in Texten.

## Bedienung
- Zuerst fürs Handy (Hochformat, Touch), Desktop muss aber auch gehen.
- Einstellungen und Menüs höchstens zwei Ebenen tief, klare Namen, folgenreiche Aktionen nur mit Bestätigung.
