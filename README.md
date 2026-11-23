# Protect the Capital

Ein düster-lustiges Koop-Spiel im Browser: Jeder verteidigt seinen eigenen Bezirk, die Hauptstadt in der Mitte
gehört allen. Jeden Abend um 18 Uhr kommen die Toten. Fällt die Hauptstadt, fangen alle gemeinsam von vorn an,
mit Erinnerungen, die sie in die Chronik eintragen.

- Konzept: [docs/SPIELKONZEPT.md](docs/SPIELKONZEPT.md)
- Stand: Meilenstein 1 in 3D (ein Bezirk, Angriff per Knopf, Spielstand im Browser)
- Grafik: Modelle von [Kenney](https://kenney.nl) (CC0), siehe [docs/QUELLEN.md](docs/QUELLEN.md)

## Entwickeln

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # Tests
npm run build    # fertige Dateien in dist/
```

## Veröffentlichen (Cloudflare, kostenlos)

Cloudflare baut das Spiel nach jedem Push auf `main` selbst. Einmalig einrichten:

1. Bei Cloudflare ein kostenloses Konto anlegen (keine Zahlungsmethode nötig).
2. **Workers & Pages → Erstellen → Pages → Mit Git verbinden**, GitHub verbinden und dieses Repo auswählen.
3. Build-Befehl: `npm run build`, Ausgabeordner: `dist`, Umgebungsvariable `NODE_VERSION` = `22`.
4. Speichern. Danach gibt es eine Adresse wie `protect-the-capital.pages.dev`.
