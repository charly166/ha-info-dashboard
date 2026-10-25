"""Panel (Titel, Icon), Karten-Skript und get_config."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from homeassistant import config_entries
from homeassistant.components import frontend
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.setup import async_setup_component

DOMAIN = "ha_info_dashboard"
REGISTER = "homeassistant.components.panel_custom.async_register_panel"
REMOVE = "custom_components.ha_info_dashboard.frontend.async_remove_panel"


async def _setup(hass):
    with patch(REGISTER, new=AsyncMock()) as register:
        result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
        await hass.config_entries.flow.async_configure(result["flow_id"], {})
        await hass.async_block_till_done()
    return hass.config_entries.async_entries(DOMAIN)[0], register


async def test_panel_uses_default_title_and_icon(home):
    _, register = await _setup(home)
    kwargs = register.call_args.kwargs
    assert kwargs["sidebar_title"] == "Info"
    assert kwargs["sidebar_icon"] == "mdi:view-dashboard"
    assert kwargs["frontend_url_path"] == "info-dashboard"


async def test_changing_title_and_icon_replaces_the_panel(home):
    entry, _ = await _setup(home)
    with patch(REGISTER, new=AsyncMock()) as register, patch(REMOVE) as remove:
        result = await home.config_entries.options.async_init(entry.entry_id)
        result = await home.config_entries.options.async_configure(
            result["flow_id"],
            {"panel_title": "Zuhause", "panel_icon": "mdi:home", "animation": "on"},
        )
        assert result["type"] is FlowResultType.CREATE_ENTRY
        await home.async_block_till_done()
    remove.assert_called_once_with(home, "info-dashboard")
    assert register.call_args.kwargs["sidebar_title"] == "Zuhause"
    assert register.call_args.kwargs["sidebar_icon"] == "mdi:home"


async def test_unchanged_panel_is_not_registered_again(home):
    entry, _ = await _setup(home)
    with patch(REGISTER, new=AsyncMock()) as register, patch(REMOVE) as remove:
        # ein Baustein ändert sich, Titel und Icon bleiben
        sub = next(iter(entry.subentries.values()))
        home.config_entries.async_update_subentry(entry, sub, data=dict(sub.data))
        await home.async_block_till_done()
    register.assert_not_called()
    remove.assert_not_called()


async def test_empty_title_is_rejected(home):
    entry, _ = await _setup(home)
    result = await home.config_entries.options.async_init(entry.entry_id)
    result = await home.config_entries.options.async_configure(
        result["flow_id"], {"panel_title": "   ", "panel_icon": "mdi:home", "animation": "on"}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"panel_title": "title_required"}


async def test_script_is_loaded_on_every_page_and_removed_on_unload(home):
    entry, _ = await _setup(home)
    urls = home.data[frontend.DATA_EXTRA_MODULE_URL].urls
    assert any(u.startswith("/ha_info_dashboard_static/ha-info-dashboard.js") for u in urls)
    with patch(REMOVE):
        assert await home.config_entries.async_unload(entry.entry_id)
    assert not any(u.startswith("/ha_info_dashboard_static/") for u in home.data[frontend.DATA_EXTRA_MODULE_URL].urls)


async def test_get_config_returns_blocks_and_title(home, hass_ws_client):
    entry, _ = await _setup(home)
    home.config_entries.async_update_entry(entry, options={"panel_title": "Zuhause"})
    client = await hass_ws_client(home)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_config"})
    result = (await client.receive_json())["result"]
    assert result["configured"] is True
    assert result["settings"]["title"] == "Zuhause"
    assert {b["type"] for b in result["blocks"]} >= {"weather_report", "pollen"}


async def test_get_config_without_entry(hass, hass_ws_client):
    assert await async_setup_component(hass, DOMAIN, {})
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/get_config"})
    assert (await client.receive_json())["result"]["configured"] is False
