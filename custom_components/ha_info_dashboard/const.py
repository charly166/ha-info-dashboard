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

SUBENTRY_GROUPS: dict[str, str] = {
    WEATHER_REPORT: "weather",
    WEATHER_STATION: "weather",
    INDOOR: "weather",
    WARNINGS: "weather",
    POLLEN: "weather",
}

SUBENTRY_TITLES: dict[str, str] = {
    WEATHER_REPORT: "Wetterbericht",
    WEATHER_STATION: "Wetterstation",
    INDOOR: "Innen",
    WARNINGS: "Warnmeldungen",
    POLLEN: "Pollen",
}

CONF_ANIMATION = "animation"
ANIMATION_ON = "on"
ANIMATION_AUTO = "auto"
ANIMATION_OFF = "off"
ANIMATION_OPTIONS = [ANIMATION_ON, ANIMATION_AUTO, ANIMATION_OFF]
