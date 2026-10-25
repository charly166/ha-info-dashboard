"""HA Info Dashboard: Informations-Dashboard als Seitenleisten-Panel."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from pathlib import Path
from types import MappingProxyType
from typing import Any

import voluptuous as vol

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry, ConfigSubentry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.typing import ConfigType
from homeassistant.exceptions import HomeAssistantError
from homeassistant.loader import async_get_integration
from homeassistant.util import dt as dt_util

from .const import (
    ANIMATION_ON,
    CALENDAR,
    CONF_ANIMATION,
    CONF_PANEL_ICON,
    CONF_PANEL_TITLE,
    DOMAIN,
    PANEL_ELEMENT,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    SIGNAL_CONFIG_UPDATED,
    SUBENTRY_TITLES,
    URL_BASE,
    WEATHER,
)

_LOGGER = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent / "static"
MODULE_FILE = "ha-info-dashboard.js"


def build_config(hass: HomeAssistant) -> dict[str, Any]:
    """Konfiguration für das Frontend: ein Eintrag pro Baustein."""
    entries = hass.config_entries.async_entries(DOMAIN)
    blocks = [
        {
            "id": subentry.subentry_id,
            "type": subentry.data.get("kind", subentry.subentry_type),
            "group": subentry.subentry_type,
            "title": subentry.title,
            "data": dict(subentry.data),
        }
        for entry in entries
        for subentry in entry.subentries.values()
    ]
    options = entries[0].options if entries else {}
    settings = {
        "animation": options.get(CONF_ANIMATION, ANIMATION_ON),
        "title": options.get(CONF_PANEL_TITLE) or PANEL_TITLE,
    }
    return {"configured": bool(entries), "blocks": blocks, "settings": settings}


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe_config"})
@callback
def ws_subscribe_config(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Sendet die Konfiguration sofort und bei jeder Änderung."""

    @callback
    def forward() -> None:
        connection.send_message(websocket_api.event_message(msg["id"], build_config(hass)))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL_CONFIG_UPDATED, forward)
    connection.send_result(msg["id"])
    forward()


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_config"})
@callback
def ws_get_config(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Einmalige Abfrage der Konfiguration, z. B. für die Dashboard-Strategie."""
    connection.send_result(msg["id"], build_config(hass))


def _iso(value: Any) -> str:
    return value.isoformat() if isinstance(value, (date, datetime)) else str(value)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/calendar_events",
        vol.Required("entities"): [str],
        vol.Required("days"): vol.All(int, vol.Range(min=1, max=31)),
    }
)
@websocket_api.async_response
async def ws_calendar_events(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Termine der eingerichteten Kalender ab heute 0 Uhr für die nächsten `days` Tage."""
    allowed = {
        entity_id
        for block in build_config(hass)["blocks"]
        if block["group"] == CALENDAR
        for entity_id in block["data"].get("entities", [])
    }
    start = dt_util.start_of_local_day()
    events: list[dict[str, Any]] = []
    for entity_id in dict.fromkeys(e for e in msg["entities"] if e in allowed):
        try:
            response = await hass.services.async_call(
                "calendar",
                "get_events",
                {
                    "entity_id": entity_id,
                    "start_date_time": start,
                    "end_date_time": start + timedelta(days=msg["days"]),
                },
                blocking=True,
                return_response=True,
            )
        except HomeAssistantError as err:  # ein nicht erreichbarer Kalender darf die anderen nicht blockieren
            _LOGGER.warning("Kalender %s nicht lesbar: %s", entity_id, err)
            continue
        for event in response.get(entity_id, {}).get("events", []):
            events.append(
                {
                    "entity_id": entity_id,
                    "summary": event.get("summary", ""),
                    "start": _iso(event["start"]),
                    "end": _iso(event.get("end", event["start"])),
                }
            )
    connection.send_result(msg["id"], events)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    websocket_api.async_register_command(hass, ws_subscribe_config)
    websocket_api.async_register_command(hass, ws_get_config)
    websocket_api.async_register_command(hass, ws_calendar_events)
    await hass.http.async_register_static_paths(
        [StaticPathConfig(URL_BASE, str(STATIC_DIR), cache_headers=False)]
    )
    return True


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Version 1 hatte je Wetter-Baustein einen eigenen Untereintrags-Typ; jetzt gibt es die Gruppe "weather"."""
    if entry.version == 1:
        for subentry in list(entry.subentries.values()):
            if subentry.subentry_type not in SUBENTRY_TITLES:
                continue
            hass.config_entries.async_remove_subentry(entry, subentry.subentry_id)
            hass.config_entries.async_add_subentry(
                entry,
                ConfigSubentry(
                    data=MappingProxyType({"kind": subentry.subentry_type, **subentry.data}),
                    subentry_type=WEATHER,
                    title=subentry.title,
                    unique_id=subentry.subentry_type,
                ),
            )
        hass.config_entries.async_update_entry(entry, version=2)
    return True


def _panel_settings(entry: ConfigEntry) -> tuple[str, str]:
    return (
        entry.options.get(CONF_PANEL_TITLE) or PANEL_TITLE,
        entry.options.get(CONF_PANEL_ICON) or PANEL_ICON,
    )


async def _async_register_panel(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Legt das Seitenleisten-Panel mit dem gewählten Titel und Icon an; ein vorhandenes wird ersetzt."""
    title, icon = _panel_settings(entry)
    data = hass.data.setdefault(DOMAIN, {})
    if data.get("panel") == (title, icon):
        return
    if data.get("panel"):
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_ELEMENT,
        module_url=data["module_url"],
        sidebar_title=title,
        sidebar_icon=icon,
        require_admin=False,
    )
    data["panel"] = (title, icon)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    version = (await async_get_integration(hass, DOMAIN)).version
    module_url = f"{URL_BASE}/{MODULE_FILE}?v={version}"
    data = hass.data.setdefault(DOMAIN, {})
    data["module_url"] = module_url
    # Auf jeder Seite laden, damit die Karten in allen Dashboards verfügbar sind.
    frontend.add_extra_js_url(hass, module_url)
    await _async_register_panel(hass, entry)

    async def _config_changed(hass: HomeAssistant, entry: ConfigEntry) -> None:
        await _async_register_panel(hass, entry)
        async_dispatcher_send(hass, SIGNAL_CONFIG_UPDATED)

    entry.async_on_unload(entry.add_update_listener(_config_changed))
    async_dispatcher_send(hass, SIGNAL_CONFIG_UPDATED)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = hass.data.get(DOMAIN, {})
    if data.pop("panel", None):
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
    if module_url := data.pop("module_url", None):
        frontend.remove_extra_js_url(hass, module_url)
    async_dispatcher_send(hass, SIGNAL_CONFIG_UPDATED)
    return True
