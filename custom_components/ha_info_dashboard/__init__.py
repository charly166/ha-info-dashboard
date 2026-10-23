"""HA Info Dashboard: Informations-Dashboard als Seitenleisten-Panel."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration

from .const import (
    ANIMATION_ON,
    CONF_ANIMATION,
    DOMAIN,
    PANEL_ELEMENT,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    SIGNAL_CONFIG_UPDATED,
    SUBENTRY_GROUPS,
    URL_BASE,
)

STATIC_DIR = Path(__file__).parent / "static"
MODULE_FILE = "ha-info-dashboard.js"


def build_config(hass: HomeAssistant) -> dict[str, Any]:
    """Konfiguration für das Frontend: ein Eintrag pro Baustein."""
    entries = hass.config_entries.async_entries(DOMAIN)
    blocks = [
        {
            "id": subentry.subentry_id,
            "type": subentry.subentry_type,
            "group": SUBENTRY_GROUPS.get(subentry.subentry_type, "other"),
            "title": subentry.title,
            "data": dict(subentry.data),
        }
        for entry in entries
        for subentry in entry.subentries.values()
    ]
    animation = entries[0].options.get(CONF_ANIMATION, ANIMATION_ON) if entries else ANIMATION_ON
    return {"configured": bool(entries), "blocks": blocks, "settings": {"animation": animation}}


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


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    websocket_api.async_register_command(hass, ws_subscribe_config)
    await hass.http.async_register_static_paths(
        [StaticPathConfig(URL_BASE, str(STATIC_DIR), cache_headers=False)]
    )
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    version = (await async_get_integration(hass, DOMAIN)).version
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_ELEMENT,
        module_url=f"{URL_BASE}/{MODULE_FILE}?v={version}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=False,
    )

    async def _config_changed(hass: HomeAssistant, _entry: ConfigEntry) -> None:
        async_dispatcher_send(hass, SIGNAL_CONFIG_UPDATED)

    entry.async_on_unload(entry.add_update_listener(_config_changed))
    async_dispatcher_send(hass, SIGNAL_CONFIG_UPDATED)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    frontend.async_remove_panel(hass, PANEL_URL_PATH)
    async_dispatcher_send(hass, SIGNAL_CONFIG_UPDATED)
    return True
