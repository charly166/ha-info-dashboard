"""Gemeinsame Testfixtures."""

from __future__ import annotations

import pytest

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from pytest_homeassistant_custom_component.common import MockConfigEntry

pytest_plugins = "pytest_homeassistant_custom_component"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Lädt custom_components in allen Tests."""


def add_sensor(
    hass: HomeAssistant,
    entity_id: str,
    state: str,
    *,
    platform: str,
    device_class: str | None = None,
    attributes: dict | None = None,
) -> None:
    domain, object_id = entity_id.split(".")
    er.async_get(hass).async_get_or_create(
        domain, platform, f"{platform}-{object_id}", suggested_object_id=object_id, original_device_class=device_class
    )
    attrs = dict(attributes or {})
    if device_class:
        attrs["device_class"] = device_class
    hass.states.async_set(entity_id, state, attrs)


@pytest.fixture
def home(hass: HomeAssistant) -> HomeAssistant:
    """Eine Instanz, die der echten nachempfunden ist (Netatmo, DWD)."""
    add_sensor(hass, "weather.kirchheim_teck", "rainy", platform="dwd_weather")
    add_sensor(hass, "weather.openweathermap", "sunny", platform="openweathermap")

    n = {"platform": "netatmo"}
    add_sensor(hass, "sensor.wetterstation_temperatur", "21.9", device_class="temperature", **n)
    add_sensor(hass, "sensor.wetterstation_bad_temperatur", "21", device_class="temperature", **n)
    add_sensor(hass, "sensor.wetterstation_outdoor_temperatur", "14.5", device_class="temperature", **n)
    add_sensor(hass, "sensor.wetterstation_luftfeuchtigkeit", "43", device_class="humidity", **n)
    add_sensor(hass, "sensor.wetterstation_bad_luftfeuchtigkeit", "45", device_class="humidity", **n)
    add_sensor(hass, "sensor.wetterstation_outdoor_luftfeuchtigkeit", "64", device_class="humidity", **n)
    add_sensor(hass, "sensor.wetterstation_kohlendioxid", "556", device_class="carbon_dioxide", **n)
    add_sensor(hass, "sensor.wetterstation_regenmesser_niederschlagsmenge", "0", device_class="precipitation", **n)
    add_sensor(hass, "sensor.wetterstation_regenmesser_niederschlagsmenge_heute", "0", device_class="precipitation", **n)
    add_sensor(
        hass, "sensor.wetterstation_regenmesser_niederschlagsmenge_letzte_stunde", "0", device_class="precipitation", **n
    )
    add_sensor(hass, "sensor.wetterstation_windmesser_windgeschwindigkeit", "4", device_class="wind_speed", **n)
    add_sensor(hass, "sensor.wetterstation_windmesser_windrichtung", "e", device_class="enum", **n)

    # Wetterdaten vom DWD, die nicht als Wetterstation durchgehen dürfen
    add_sensor(hass, "sensor.kirchheim_teck_temperatur", "11.5", device_class="temperature", platform="dwd_weather")
    add_sensor(hass, "sensor.kirchheim_teck_windgeschwindigkeit", "17", device_class="wind_speed", platform="dwd_weather")

    w = {"platform": "dwd_weather_warnings"}
    add_sensor(hass, "sensor.stadt_wendlingen_am_neckar_aktuelle_warnstufe", "2", **w)
    add_sensor(hass, "sensor.stadt_wendlingen_am_neckar_vorwarnstufe", "0", **w)

    for p in ("birke", "graeser"):
        add_sensor(hass, f"sensor.pollenflug_{p}_112", "0", platform="dwd_pollenflug")
    return hass


@pytest.fixture
def entry() -> MockConfigEntry:
    return MockConfigEntry(domain="ha_info_dashboard", title="HA Info Dashboard", data={})
