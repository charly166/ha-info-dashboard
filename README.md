<p align="center">
  <img src="assets/logo.webp" alt="HA Info Dashboard – Ihr zentrales Informations-Zentrum" width="600">
</p>

# ha-info-dashboard

Informations-Dashboard für Home Assistant: eine statische Single-Page-App (Vite, Preact, TypeScript), die per WebSocket live mit Home Assistant spricht. Das Layout passt sich an: 1 Spalte (Smartphone), 3 Spalten (Wand-Tablet), maximal 4 Spalten (Browser).

## Funktionen

Das Dashboard besteht aus **Bausteinen**, die du in Home Assistant einrichtest. Der Assistent erkennt passende Entitäten selbst und schlägt sie vor. Bausteine vom Typ **Wetter**:

| Baustein | Inhalt | Erkennung |
|---|---|---|
| Wetterbericht | aktuelle Lage und 5-Tage-Prognose | `weather.*` (bevorzugt DWD) |
| Wetterstation | Temperatur, Luftfeuchte, Regen, Wind | Netatmo, Ecowitt |
| Innen | Temperatur, Luftfeuchte, CO₂ | Hauptmodul der Wetterstation |
| Warnmeldungen | DWD-Warnungen mit Zeitraum und Handlungsempfehlung | `dwd_weather_warnings` |
| Pollen | DWD-Pollenflug-Gefahrenindex für heute bis übermorgen | `dwd_pollenflug` |

Alle Wetter-Bausteine erscheinen zusammen in einer Karte. Der Wetterbericht zeigt einen animierten Himmel, der sich an Wetterlage und Tageszeit (Sonnenhöhe von `sun.sun`) anpasst: Sonne, Mond und Sterne, ziehende Wolken, Regen, Schnee, Nebel und Gewitter. Bei aktivierter Einstellung „Bewegung reduzieren“ des Geräts stehen die Animationen still. Farben und Hintergrund folgen dem Home-Assistant-Theme und damit der Profil-Einstellung (Auto, Hell, Dunkel). Fehlt ein Messwert der Wetterstation, springt die Anzeige auf den Wetterbericht zurück (Kennzeichnung „DWD“). Das Raster zeigt 1 Spalte (Smartphone), 3 (Wand-Tablet) oder höchstens 4 (Browser).

## Installation über HACS

1. In HACS → Dreipunkt-Menü → **Benutzerdefinierte Repositories** dieses Repository hinzufügen (Typ **Integration**) und **HA Info Dashboard** herunterladen.
2. Home Assistant neu starten.
3. **Einstellungen → Geräte & Dienste → Integration hinzufügen → HA Info Dashboard.** Der Assistent zeigt die erkannten Bausteine; du wählst aus, was eingerichtet werden soll.
4. Fertig: in der Seitenleiste erscheint der Eintrag **Info**. Es sind weder `configuration.yaml` noch Dashboard-Ressourcen nötig.

Bausteine änderst du unter **Einstellungen → Geräte & Dienste → HA Info Dashboard** (Zahnrad am Baustein → Neu konfigurieren) und fügst sie dort mit **Baustein hinzufügen** hinzu. Änderungen erscheinen sofort im Dashboard.

### Umstieg von Version 0.1

Version 0.1 war ein reines Frontend-Paket. Vor dem Umstieg bitte entfernen:
- das HACS-Paket **HA Info Dashboard** (Typ Dashboard) und seine Dashboard-Ressource,
- den `panel_custom`-Eintrag in der `configuration.yaml`.

## Entwicklung

Voraussetzungen: Node.js ≥ 20 und [uv](https://docs.astral.sh/uv/).

```bash
npm install
npm run build        # baut das Frontend nach custom_components/ha_info_dashboard/static/

uv venv --python 3.14 .venv
uv pip install --python .venv/bin/python -r requirements_test.txt
.venv/bin/python -m pytest
```

Aufbau:
- `custom_components/ha_info_dashboard/`: die Integration (Config-Flow mit Erkennung, Bausteine als Untereinträge, Panel, WebSocket-Schnittstelle).
- `src/`: das Frontend (Preact, TypeScript). Es bekommt `hass` von Home Assistant und die Bausteine per WebSocket von der Integration.

## Release

Beim Veröffentlichen eines GitHub-Releases baut ein Workflow das Frontend, setzt die Version aus dem Tag in die `manifest.json` und hängt `ha_info_dashboard.zip` an. HACS lädt das Paket von dort.

## Lizenz

[MIT](LICENSE)
