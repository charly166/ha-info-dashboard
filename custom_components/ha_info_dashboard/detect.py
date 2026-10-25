"""Erkennung passender Entitäten für die Bausteine."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from .const import (
    BIRTHDAYS,
    CALENDAR_KINDS,
    GROUP_KINDS,
    INDOOR,
    KIND_TITLES,
    LEAGUE,
    PARCELS,
    POLLEN,
    WARNINGS,
    WASTE,
    WEATHER_REPORT,
    WEATHER_STATION,
)

# Integrationen, die typischerweise Wetterstationen liefern.
STATION_PLATFORMS = frozenset({"netatmo", "ecowitt"})
OUTDOOR_TOKENS = ("outdoor", "aussen", "außen", "draussen", "draußen")
RAIN_TODAY_TOKENS = ("heute", "today", "daily", "tag")
RAIN_OTHER_TOKENS = ("stunde", "hour", "week", "woche", "month", "monat", "year", "jahr", "event", "rate")
GUST_TOKENS = ("gust", "boe", "böe")
WIND_DIRECTION_TOKENS = ("windrichtung", "wind_direction", "wind_bearing", "winddirection")


def _device_class(state: Any, entry: er.RegistryEntry | None) -> str | None:
    if dc := state.attributes.get("device_class"):
        return dc
    if entry:
        return entry.device_class or entry.original_device_class
    return None


def _sensors(hass: HomeAssistant) -> Iterable[tuple[str, str, str | None, str]]:
    """Liefert (entity_id, objekt_id, device_class, plattform) aller Sensoren."""
    registry = er.async_get(hass)
    for state in hass.states.async_all("sensor"):
        entry = registry.async_get(state.entity_id)
        yield (
            state.entity_id,
            state.entity_id.split(".", 1)[1],
            _device_class(state, entry),
            entry.platform if entry else "",
        )


def _pick(
    hass: HomeAssistant,
    *,
    device_class: str | None = None,
    require: tuple[str, ...] = (),
    avoid: tuple[str, ...] = (),
    prefer: tuple[str, ...] = (),
    prefer_stations: bool = True,
) -> str | None:
    """Wählt den bestpassenden Sensor oder None."""
    best: tuple[float, str] | None = None
    for entity_id, name, dc, platform in _sensors(hass):
        if device_class is not None and dc != device_class:
            continue
        if require and not any(t in name for t in require):
            continue
        if any(t in name for t in avoid):
            continue
        score = 4.0 if prefer_stations and platform in STATION_PLATFORMS else 0.0
        score += 2.0 * sum(t in name for t in prefer)
        score -= len(name) / 100  # bei Gleichstand der kürzere (Hauptmodul)
        if best is None or score > best[0]:
            best = (score, entity_id)
    return best[1] if best else None


def _by_platform(hass: HomeAssistant, platform: str) -> list[str]:
    registry = er.async_get(hass)
    return sorted(
        state.entity_id
        for state in hass.states.async_all("sensor")
        if (entry := registry.async_get(state.entity_id)) and entry.platform == platform
    )


def detect_weather_report(hass: HomeAssistant) -> dict[str, Any] | None:
    registry = er.async_get(hass)
    ids = sorted(s.entity_id for s in hass.states.async_all("weather"))
    if not ids:
        return None
    dwd = [i for i in ids if (e := registry.async_get(i)) and e.platform == "dwd_weather"]
    return {"weather": (dwd or ids)[0]}


def detect_weather_station(hass: HomeAssistant) -> dict[str, Any] | None:
    found = {
        "temperature": _pick(hass, device_class="temperature", prefer=OUTDOOR_TOKENS),
        "humidity": _pick(hass, device_class="humidity", prefer=OUTDOOR_TOKENS),
        "rain": _pick(
            hass,
            device_class="precipitation",
            avoid=RAIN_TODAY_TOKENS + RAIN_OTHER_TOKENS,
        ),
        "rain_today": _pick(hass, device_class="precipitation", require=RAIN_TODAY_TOKENS),
        "wind_speed": _pick(hass, device_class="wind_speed", avoid=GUST_TOKENS),
        "wind_direction": _pick(hass, require=WIND_DIRECTION_TOKENS),
    }
    # Ohne Sensor einer bekannten Stationsplattform ist es nur geraten.
    registry = er.async_get(hass)
    from_station = any(
        (e := registry.async_get(v)) and e.platform in STATION_PLATFORMS
        for v in found.values()
        if v
    )
    found = {k: v for k, v in found.items() if v}
    return found if found and from_station else None


def detect_indoor(hass: HomeAssistant) -> dict[str, Any] | None:
    found = {
        "temperature": _pick(hass, device_class="temperature", avoid=OUTDOOR_TOKENS),
        "humidity": _pick(hass, device_class="humidity", avoid=OUTDOOR_TOKENS),
        "co2": _pick(hass, device_class="carbon_dioxide"),
    }
    registry = er.async_get(hass)
    from_station = any(
        (e := registry.async_get(v)) and e.platform in STATION_PLATFORMS
        for v in found.values()
        if v
    )
    found = {k: v for k, v in found.items() if v}
    return found if found and from_station else None


def detect_warnings(hass: HomeAssistant) -> dict[str, Any] | None:
    ids = [
        i
        for i in _by_platform(hass, "dwd_weather_warnings")
        if not any(t in i for t in ("vorwarn", "advance"))
    ]
    return {"entities": ids} if ids else None


def detect_pollen(hass: HomeAssistant) -> dict[str, Any] | None:
    ids = _by_platform(hass, "dwd_pollenflug")
    return {"entities": ids} if ids else None


def _calendars(hass: HomeAssistant) -> list[tuple[str, str, str]]:
    """(entity_id, Name in Kleinschreibung, Plattform) aller Kalender."""
    registry = er.async_get(hass)
    return [
        (
            s.entity_id,
            f"{s.entity_id} {s.attributes.get('friendly_name', '')}".lower(),
            entry.platform if (entry := registry.async_get(s.entity_id)) else "",
        )
        for s in hass.states.async_all("calendar")
        if s.state != "unavailable"
    ]


def detect_birthdays(hass: HomeAssistant) -> dict[str, Any] | None:
    ids = sorted(i for i, name, _ in _calendars(hass) if "geburtstag" in name or "birthday" in name)
    return {"entities": ids} if ids else None


def detect_waste(hass: HomeAssistant) -> dict[str, Any] | None:
    calendars = _calendars(hass)
    # Die Plattform ist eindeutig; Namen allein führen leicht zu Doppelungen.
    ids = [i for i, _, p in calendars if p == "waste_collection_schedule"]
    ids = ids or [i for i, name, _ in calendars if any(t in name for t in ("abfall", "müll", "muell", "waste"))]
    return {"entities": sorted(ids)} if ids else None


def detect_parcels(hass: HomeAssistant) -> dict[str, Any] | None:
    """Sammelsensoren des Paket Trackers (HACS): alle offenen und heute zugestellte Pakete."""
    ids = _by_platform(hass, "parcel_tracker")
    found = {
        "open": next((i for i in ids if i.endswith("_unterwegs")), None),
        "delivered": next((i for i in ids if i.endswith("_zugestellt_heute")), None),
    }
    return {k: v for k, v in found.items() if v} if found["open"] else None


def detect_league(hass: HomeAssistant) -> dict[str, Any] | None:
    ids = [i for i in _by_platform(hass, "ligatracker") if i.endswith("_spieltage")]
    return {"entities": ids} if ids else None


CALENDAR_DETECTORS = {
    BIRTHDAYS: detect_birthdays,
    WASTE: detect_waste,
    PARCELS: detect_parcels,
    LEAGUE: detect_league,
}

DETECTORS = {
    WEATHER_REPORT: detect_weather_report,
    WEATHER_STATION: detect_weather_station,
    INDOOR: detect_indoor,
    WARNINGS: detect_warnings,
    POLLEN: detect_pollen,
}


def detect(hass: HomeAssistant, kind: str) -> dict[str, Any]:
    """Vorschlag für einen Baustein (leer, wenn nichts erkannt wurde)."""
    return (DETECTORS | CALENDAR_DETECTORS)[kind](hass) or {}


detect_kind = detect


def detect_all(hass: HomeAssistant) -> dict[str, dict[str, Any]]:
    """Alle erkannten Bausteine (Kalender-Arten unter ihrem Namen); nicht erkannte fehlen."""
    found = {t: d for t in DETECTORS if (d := detect(hass, t))}
    found.update({k: d for k in CALENDAR_KINDS if (d := detect_kind(hass, k))})
    return found


def to_subentry(kind: str, data: dict[str, Any]) -> tuple[str, dict[str, Any], str]:
    """(Gruppe, Daten, Titel) zu einem Erkennungsergebnis."""
    group = next(g for g, kinds in GROUP_KINDS.items() if kind in kinds)
    return group, {"kind": kind, **data}, KIND_TITLES[kind]
