"""Config-Flow, Untereinträge und WebSocket-Konfiguration."""

from __future__ import annotations

from unittest.mock import patch

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResultType

from pytest_homeassistant_custom_component.common import MockConfigEntry

DOMAIN = "ha_info_dashboard"


async def _setup(hass):
    with patch("homeassistant.components.panel_custom.async_register_panel"):
        result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
        assert result["type"] is FlowResultType.FORM
        assert "Wetterstation" in result["description_placeholders"]["detected"]
        result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
        await hass.async_block_till_done()
    return result


async def test_initial_setup_creates_detected_blocks(home):
    result = await _setup(home)
    assert result["type"] is FlowResultType.CREATE_ENTRY
    entry = home.config_entries.async_entries(DOMAIN)[0]
    assert {s.subentry_type for s in entry.subentries.values()} == {"weather"}
    assert {s.data["kind"] for s in entry.subentries.values()} == {
        "weather_report",
        "weather_station",
        "indoor",
        "warnings",
        "pollen",
    }


async def test_initial_setup_can_deselect_blocks(home):
    result = await home.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    with patch("homeassistant.components.panel_custom.async_register_panel"):
        result = await home.config_entries.flow.async_configure(
            result["flow_id"], {"pollen": False, "indoor": False}
        )
        await home.async_block_till_done()
    entry = home.config_entries.async_entries(DOMAIN)[0]
    types = {s.data["kind"] for s in entry.subentries.values()}
    assert "pollen" not in types and "indoor" not in types and "weather_report" in types


async def test_empty_instance_creates_entry_without_blocks(hass):
    with patch("homeassistant.components.panel_custom.async_register_panel"):
        result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
        await hass.async_block_till_done()
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert hass.config_entries.async_entries(DOMAIN)[0].subentries == {}


async def test_single_instance(home):
    await _setup(home)
    result = await home.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"


async def test_add_subentry_prefilled_and_unique(home):
    await _setup(home)
    entry = home.config_entries.async_entries(DOMAIN)[0]
    # alle Wetter-Bausteine existieren schon -> Hinzufügen bricht ab
    result = await home.config_entries.subentries.async_init(
        (entry.entry_id, "weather"), context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "already_configured"


async def test_add_and_reconfigure_subentry(home):
    with patch("homeassistant.components.panel_custom.async_register_panel"):
        result = await home.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
        await home.config_entries.flow.async_configure(result["flow_id"], {"pollen": False, "indoor": False})
        await home.async_block_till_done()
        entry = home.config_entries.async_entries(DOMAIN)[0]
        flow = home.config_entries.subentries

        result = await flow.async_init((entry.entry_id, "weather"), context={"source": config_entries.SOURCE_USER})
        assert result["step_id"] == "user"
        options = result["data_schema"].schema["kind"].config["options"]
        assert set(options) == {"indoor", "pollen"}
        result = await flow.async_configure(result["flow_id"], {"kind": "pollen"})
        assert result["step_id"] == "pollen"
        # erkannte Sensoren sind vorbelegt
        suggested = {str(k): k.description["suggested_value"] for k in result["data_schema"].schema}
        assert suggested == {"entities": ["sensor.pollenflug_birke_112", "sensor.pollenflug_graeser_112"]}
        # leere Auswahl wird abgelehnt
        result = await flow.async_configure(result["flow_id"], {"entities": []})
        assert result["errors"] == {"base": "no_entity"}
        result = await flow.async_configure(result["flow_id"], {"entities": ["sensor.pollenflug_birke_112"]})
        assert result["type"] is FlowResultType.CREATE_ENTRY

        pollen = next(s for s in entry.subentries.values() if s.data["kind"] == "pollen")
        assert pollen.subentry_type == "weather" and pollen.title == "Pollen"
        result = await flow.async_init(
            (entry.entry_id, "weather"),
            context={"source": config_entries.SOURCE_RECONFIGURE, "subentry_id": pollen.subentry_id},
        )
        assert result["step_id"] == "pollen"
        result = await flow.async_configure(result["flow_id"], {"entities": ["sensor.pollenflug_graeser_112"]})
        assert result["type"] is FlowResultType.ABORT
        assert result["reason"] == "reconfigure_successful"
        assert pollen.data == {"kind": "pollen", "entities": ["sensor.pollenflug_graeser_112"]}


async def test_migrate_version_1_moves_weather_blocks_into_the_group(home):
    from pytest_homeassistant_custom_component.common import MockConfigEntry
    from homeassistant.config_entries import ConfigSubentryData

    entry = MockConfigEntry(
        domain=DOMAIN,
        version=1,
        subentries_data=[
            ConfigSubentryData(
                data={"entities": ["sensor.pollenflug_birke_112"]}, subentry_type="pollen", title="Pollen", unique_id="pollen"
            ),
            ConfigSubentryData(
                data={"weather": "weather.kirchheim_teck"},
                subentry_type="weather_report",
                title="Wetterbericht",
                unique_id="weather_report",
            ),
            ConfigSubentryData(
                data={"kind": "waste", "entities": ["calendar.abfall"]}, subentry_type="calendar", title="Müllkalender", unique_id="waste"
            ),
        ],
    )
    entry.add_to_hass(home)
    with patch("homeassistant.components.panel_custom.async_register_panel"):
        assert await home.config_entries.async_setup(entry.entry_id)
        await home.async_block_till_done()

    assert entry.version == 2
    blocks = {s.data["kind"]: s for s in entry.subentries.values()}
    assert set(blocks) == {"pollen", "weather_report", "waste"}
    assert {s.subentry_type for s in blocks.values() if s.data["kind"] != "waste"} == {"weather"}
    assert blocks["waste"].subentry_type == "calendar"
    assert blocks["pollen"].data == {"kind": "pollen", "entities": ["sensor.pollenflug_birke_112"]}
    assert blocks["pollen"].title == "Pollen" and blocks["pollen"].unique_id == "pollen"


async def test_websocket_pushes_config_and_updates(home, hass_ws_client):
    await _setup(home)
    client = await hass_ws_client(home)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/subscribe_config"})
    assert (await client.receive_json())["success"]
    first = (await client.receive_json())["event"]
    assert first["configured"] is True
    by_type = {b["type"]: b for b in first["blocks"]}
    assert by_type["weather_report"]["data"] == {"kind": "weather_report", "weather": "weather.kirchheim_teck"}
    assert by_type["weather_report"]["group"] == "weather"

    entry = home.config_entries.async_entries(DOMAIN)[0]
    pollen = next(s for s in entry.subentries.values() if s.data["kind"] == "pollen")
    home.config_entries.async_update_subentry(
        entry, pollen, data={"kind": "pollen", "entities": ["sensor.pollenflug_birke_112"]}
    )
    await home.async_block_till_done()
    update = (await client.receive_json())["event"]
    assert {b["type"]: b for b in update["blocks"]}["pollen"]["data"] == {
        "kind": "pollen",
        "entities": ["sensor.pollenflug_birke_112"],
    }


async def test_websocket_unconfigured(hass, hass_ws_client):
    from homeassistant.setup import async_setup_component

    assert await async_setup_component(hass, DOMAIN, {})
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/subscribe_config"})
    await client.receive_json()
    assert (await client.receive_json())["event"] == {
        "configured": False,
        "blocks": [],
        "settings": {"animation": "on", "title": "Info"},
    }


async def test_unload_removes_panel(home):
    await _setup(home)
    entry = home.config_entries.async_entries(DOMAIN)[0]
    with patch("custom_components.ha_info_dashboard.frontend.async_remove_panel") as remove:
        assert await home.config_entries.async_unload(entry.entry_id)
    remove.assert_called_once_with(home, "info-dashboard")


async def test_options_flow_sets_animation_and_pushes_it(home, hass_ws_client):
    await _setup(home)
    client = await hass_ws_client(home)
    await client.send_json({"id": 1, "type": f"{DOMAIN}/subscribe_config"})
    await client.receive_json()
    assert (await client.receive_json())["event"]["settings"] == {"animation": "on", "title": "Info"}

    entry = home.config_entries.async_entries(DOMAIN)[0]
    result = await home.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    result = await home.config_entries.options.async_configure(result["flow_id"], {"animation": "auto"})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await home.async_block_till_done()
    assert (await client.receive_json())["event"]["settings"] == {"animation": "auto", "title": "Info"}
