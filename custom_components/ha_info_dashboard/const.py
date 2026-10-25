"""Konstanten für HA Info Dashboard."""

from __future__ import annotations

DOMAIN = "ha_info_dashboard"

URL_BASE = "/ha_info_dashboard_static"
PANEL_URL_PATH = "info-dashboard"
PANEL_ELEMENT = "ha-info-dashboard"
PANEL_TITLE = "Info"
PANEL_ICON = "mdi:view-dashboard"

SIGNAL_CONFIG_UPDATED = f"{DOMAIN}_config_updated"

# Bausteine (Untereinträge) und die Gruppe, zu der sie im Dashboard gehören.
WEATHER_REPORT = "weather_report"
WEATHER_STATION = "weather_station"
INDOOR = "indoor"
WARNINGS = "warnings"
POLLEN = "pollen"

# Kalender-Bausteine: ein Untereintrag "calendar" je Art (kind).
CALENDAR = "calendar"
BIRTHDAYS = "birthdays"
WASTE = "waste"
PARCELS = "parcels"
LEAGUE = "league"
CALENDAR_KINDS = [BIRTHDAYS, WASTE, PARCELS, LEAGUE]
CALENDAR_KIND_TITLES: dict[str, str] = {
    BIRTHDAYS: "Geburtstage",
    WASTE: "Müllkalender",
    PARCELS: "Pakete",
    LEAGUE: "Fußball-Liga",
}

# Untereinträge sind nach Gruppen geordnet (Typ = Gruppe, Art = Baustein in "kind").
WEATHER = "weather"
GROUP_KINDS: dict[str, list[str]] = {
    WEATHER: [WEATHER_REPORT, WEATHER_STATION, INDOOR, WARNINGS, POLLEN],
    CALENDAR: CALENDAR_KINDS,
}

SUBENTRY_TITLES: dict[str, str] = {
    WEATHER_REPORT: "Wetterbericht",
    WEATHER_STATION: "Wetterstation",
    INDOOR: "Innen",
    WARNINGS: "Warnmeldungen",
    POLLEN: "Pollen",
}

KIND_TITLES: dict[str, str] = {**SUBENTRY_TITLES, **CALENDAR_KIND_TITLES}
GROUP_TITLES: dict[str, str] = {WEATHER: "Wetter", CALENDAR: "Kalender-Infos"}

CONF_ANIMATION = "animation"
CONF_PANEL_TITLE = "panel_title"
CONF_PANEL_ICON = "panel_icon"
ANIMATION_ON = "on"
ANIMATION_AUTO = "auto"
ANIMATION_OFF = "off"
ANIMATION_OPTIONS = [ANIMATION_ON, ANIMATION_AUTO, ANIMATION_OFF]
