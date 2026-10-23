<p align="center">
  <img src="assets/logo.webp" alt="HA Info Dashboard – Ihr zentrales Informations-Zentrum" width="600">
</p>

# ha-info-dashboard

Informations-Dashboard für Home Assistant: eine statische Single-Page-App (Vite, Preact, TypeScript), die per WebSocket live mit Home Assistant spricht. Das Layout passt sich an: 1 Spalte (Smartphone), 3 Spalten (Wand-Tablet), maximal 4 Spalten (Browser).

## Funktionen

- **Wetter:** aktuelle Werte der eigenen Wetterstation (Temperatur, Luftfeuchte, Regen, Wind), 5-Tage-Prognose vom DWD. Fehlt ein Messwert, springt die Anzeige auf die DWD-Station zurück (Kennzeichnung „DWD“).
- **Wetterwarnungen:** DWD-Warnungen mit Zeitraum und Handlungsempfehlung.
- **Innenraum:** Temperatur, Luftfeuchte und CO₂.

## Installation über HACS

1. In HACS → Dreipunkt-Menü → **Benutzerdefinierte Repositories** dieses Repository hinzufügen (Typ **Dashboard**).
2. **HA Info Dashboard** installieren und Home Assistant neu laden.
3. Als Seitenleisten-Panel einbinden, in `configuration.yaml`:

```yaml
panel_custom:
  - name: ha-info-dashboard
    sidebar_title: Info
    sidebar_icon: mdi:view-dashboard
    module_url: /hacsfiles/ha-info-dashboard/ha-info-dashboard.js
```

Alternativ lässt sich das Element als Karte `custom:ha-info-dashboard` in einem Dashboard mit Ansichtstyp **Panel** nutzen. Zugangsdaten sind nicht nötig, das Dashboard nutzt die Anmeldung von Home Assistant (auch in der Companion-App).

## Entitäten anpassen

Die Zuordnung der Messgrößen zu Entitäten steht in [`src/config.ts`](src/config.ts). Für eine andere Wetterstation (z. B. Ecowitt) genügt es, dort die Entity-IDs auszutauschen und neu zu bauen.

## Entwicklung

Voraussetzung ist Node.js ≥ 20.

```bash
npm install
npm run dev          # eigenständige App mit Zugriffstoken-Abfrage
npm run build:panel  # HACS-Paket: dist/ha-info-dashboard.js
npm run build        # eigenständige App: dist-app/
```

Die eigenständige App fragt beim ersten Start nach der Adresse von Home Assistant und einem langlebigen Zugriffstoken (HA → Profil → Sicherheit). Beides wird nur im `localStorage` des Browsers gespeichert. Wird sie über HTTPS ausgeliefert, muss auch Home Assistant über HTTPS erreichbar sein.

## Release

Beim Veröffentlichen eines GitHub-Releases baut ein Workflow `ha-info-dashboard.js` und hängt die Datei an das Release an. HACS lädt sie von dort.

## Lizenz

[MIT](LICENSE)
