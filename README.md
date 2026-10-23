<p align="center">
  <img src="assets/logo.webp" alt="HA Info Dashboard – Ihr zentrales Informations-Zentrum" width="600">
</p>

# ha-info-dashboard

Informations-Dashboard für Home Assistant: eine statische Single-Page-App (Vite, Preact, TypeScript), die per WebSocket live mit Home Assistant spricht. Das Layout passt sich an: 1 Spalte (Smartphone), 3 Spalten (Wand-Tablet), maximal 4 Spalten (Browser).

## Funktionen

- **Wetter:** aktuelle Werte der eigenen Wetterstation (Temperatur, Luftfeuchte, Regen, Wind), 5-Tage-Prognose vom DWD. Fehlt ein Messwert, springt die Anzeige auf die DWD-Station zurück (Kennzeichnung „DWD“).
- **Wetterwarnungen:** DWD-Warnungen mit Zeitraum und Handlungsempfehlung.
- **Innenraum:** Temperatur, Luftfeuchte und CO₂.

## Einrichtung

Voraussetzung ist Node.js ≥ 20.

```bash
npm install
npm run dev
```

Beim ersten Start fragt das Dashboard nach der Adresse von Home Assistant und einem langlebigen Zugriffstoken (HA → Profil → Sicherheit). Beides wird nur im `localStorage` des Browsers gespeichert.

### Entitäten anpassen

Die Zuordnung der Messgrößen zu Entitäten steht in [`src/config.ts`](src/config.ts). Für eine andere Wetterstation (z. B. Ecowitt) genügt es, dort die Entity-IDs auszutauschen.

### Bereitstellen

```bash
npm run build
```

Den Inhalt von `dist/` kopierst du z. B. nach `/config/www/ha-info-dashboard/`. Das Dashboard ist dann unter `http://<ha-adresse>:8123/local/ha-info-dashboard/` erreichbar. Wird die Seite über HTTPS ausgeliefert, muss auch Home Assistant über HTTPS erreichbar sein.

## Lizenz

[MIT](LICENSE)
