"""Kalender-Bausteine: Erkennung, Einrichtung und Termin-Abfrage."""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

import pytest

from homeassistant import config_entries
from homeassistant.core import SupportsResponse
from homeassistant.data_entry_flow import FlowResultType, InvalidData
from homeassistant.util import dt as dt_util

from custom_components.ha_info_dashboard.detect import detect_all, detect_kind

from .conftest import add_sensor

DOMAIN = "ha_info_dashboard"


@pytest.fixture
def calendars(hass):
    add_sensor(hass, "calendar.geburtstage", "off", platform="ical", attributes={"friendly_name": "Geburtstage"})
    add_sensor(hass, "calendar.familie", "off", platform="ical", attributes={"friendly_name": "Familie"})
    add_sensor(
        hass, "calendar.abfall_esslingen", "off", platform="waste_collection_schedule",
        attributes={"friendly_name": "Abfall"},
    )
    add_sensor(hass, "calendar.abfall_doppelt", "off", platform="ical", attributes={"friendly_name": "Abfall"})
    p = {"platform": "parcel_tracker"}
    add_sensor(hass, "sensor.pakete_unterwegs", "0", **p)
    add_sensor(hass, "sensor.pakete_zugestellt_heute", "0", **p)
    add_sensor(hass, "sensor.pakete_heute", "0", **p)
    add_sensor(hass, "sensor.bundesliga_spieltage", "1. Spieltag", platform="ligatracker")
    add_sensor(hass, "sensor.vfb_stuttgart_ubersicht", "1", platform="ligatracker")
    return hass


def test_detection(calendars):
    assert detect_kind(calendars, "birthdays") == {"entities": ["calendar.geburtstage"]}
    assert detect_kind(calendars, "waste") == {"entities": ["calendar.abfall_esslingen"]}
    assert detect_kind(calendars, "parcels") == {
        "open": "sensor.pakete_unterwegs",
        "delivered": "sensor.pakete_zugestellt_heute",
    }
    assert detect_kind(calendars, "league") == {"entities": ["sensor.bundesliga_spieltage"]}
    assert set(detect_all(calendars)) == {"birthdays", "waste", "parcels", "league"}


async def test_nothing_detected(hass):
    assert detect_all(hass) == {}


async def test_initial_setup_creates_calendar_blocks(calendars):
    with patch("homeassistant.components.panel_custom.async_register_panel"):
        result = await calendars.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
        result = await calendars.config_entries.flow.async_configure(result["flow_id"], {"waste": False})
        await calendars.async_block_till_done()
    entry = calendars.config_entries.async_entries(DOMAIN)[0]
    blocks = {s.data["kind"]: s for s in entry.subentries.values() if s.subentry_type == "calendar"}
    assert set(blocks) == {"birthdays", "parcels", "league"}
    assert blocks["parcels"].data == {
        "kind": "parcels",
        "open": "sensor.pakete_unterwegs",
        "delivered": "sensor.pakete_zugestellt_heute",
    }
    assert blocks["birthdays"].title == "Geburtstage"


async def _entry(hass):
    with patch("homeassistant.components.panel_custom.async_register_panel"):
        result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
        assert result["type"] is FlowResultType.CREATE_ENTRY
        await hass.async_block_till_done()
    return hass.config_entries.async_entries(DOMAIN)[0]


async def test_add_calendar_block_choose_kind_then_entity(hass):
    entry = await _entry(hass)
    add_sensor(hass, "calendar.geburtstage", "off", platform="ical", attributes={"friendly_name": "Geburtstage"})
    flow = hass.config_entries.subentries
    result = await flow.async_init((entry.entry_id, "calendar"), context={"source": config_entries.SOURCE_USER})
    assert result["step_id"] == "user"
    result = await flow.async_configure(result["flow_id"], {"kind": "birthdays"})
    assert result["step_id"] == "entities"
    assert "Geburtstage" in result["description_placeholders"]["kind"]
    result = await flow.async_configure(result["flow_id"], {"entities": []})
    assert result["errors"] == {"base": "no_entity"}
    result = await flow.async_configure(result["flow_id"], {"entities": ["calendar.geburtstage"]})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    block = next(iter(entry.subentries.values()))
    assert block.data == {"kind": "birthdays", "entities": ["calendar.geburtstage"]}

    # die Art ist vergeben und nicht mehr wählbar
    result = await flow.async_init((entry.entry_id, "calendar"), context={"source": config_entries.SOURCE_USER})
    options = result["data_schema"].schema["kind"].config["options"]
    assert "birthdays" not in options and "waste" in options

    result = await flow.async_init(
        (entry.entry_id, "calendar"),
        context={"source": config_entries.SOURCE_RECONFIGURE, "subentry_id": block.subentry_id},
    )
    assert result["step_id"] == "reconfigure"
    result = await flow.async_configure(result["flow_id"], {"entities": ["calendar.familie"]})
    assert result["reason"] == "reconfigure_successful"
    assert block.data == {"kind": "birthdays", "entities": ["calendar.familie"]}


async def test_parcels_need_open_sensor(hass):
    entry = await _entry(hass)
    flow = hass.config_entries.subentries
    result = await flow.async_init((entry.entry_id, "calendar"), context={"source": config_entries.SOURCE_USER})
    result = await flow.async_configure(result["flow_id"], {"kind": "parcels"})
    with pytest.raises(InvalidData):  # „open“ ist Pflicht
        await flow.async_configure(result["flow_id"], {"delivered": "sensor.pakete_zugestellt_heute"})


async def test_calendar_events_only_for_configured_calendars(hass, hass_ws_client):
    entry = await _entry(hass)
    start = dt_util.start_of_local_day()
    calls = []

    async def get_events(call):
        calls.append(call.data["entity_id"])
        assert call.data["end_date_time"] - call.data["start_date_time"] == timedelta(days=3)
        return {
            call.data["entity_id"][0] if isinstance(call.data["entity_id"], list) else call.data["entity_id"]: {
                "events": [
                    {"summary": "Anna", "start": start.date().isoformat(), "end": (start + timedelta(days=1)).date().isoformat()}
                ]
            }
        }

    hass.services.async_register("calendar", "get_events", get_events, supports_response=SupportsResponse.ONLY)
    hass.config_entries.async_add_subentry(
        entry,
        config_entries.ConfigSubentry(
            data={"kind": "birthdays", "entities": ["calendar.geburtstage"]},
            subentry_type="calendar",
            title="Geburtstage",
            unique_id="birthdays",
        ),
    )
    await hass.async_block_till_done()

    client = await hass_ws_client(hass)
    await client.send_json(
        {"id": 1, "type": f"{DOMAIN}/calendar_events", "entities": ["calendar.geburtstage", "calendar.geheim"], "days": 3}
    )
    msg = await client.receive_json()
    assert msg["success"]
    assert msg["result"] == [
        {
            "entity_id": "calendar.geburtstage",
            "summary": "Anna",
            "start": start.date().isoformat(),
            "end": (start + timedelta(days=1)).date().isoformat(),
        }
    ]
    assert len(calls) == 1  # der nicht eingerichtete Kalender wird nicht gelesen
