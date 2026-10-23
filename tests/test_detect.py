"""Erkennung der passenden Entitäten."""

from __future__ import annotations

from custom_components.ha_info_dashboard.detect import detect, detect_all


def test_weather_report_prefers_dwd(home):
    assert detect(home, "weather_report") == {"weather": "weather.kirchheim_teck"}


def test_weather_station_picks_outdoor_netatmo(home):
    assert detect(home, "weather_station") == {
        "temperature": "sensor.wetterstation_outdoor_temperatur",
        "humidity": "sensor.wetterstation_outdoor_luftfeuchtigkeit",
        "rain": "sensor.wetterstation_regenmesser_niederschlagsmenge",
        "rain_today": "sensor.wetterstation_regenmesser_niederschlagsmenge_heute",
        "wind_speed": "sensor.wetterstation_windmesser_windgeschwindigkeit",
        "wind_direction": "sensor.wetterstation_windmesser_windrichtung",
    }


def test_indoor_picks_main_module(home):
    assert detect(home, "indoor") == {
        "temperature": "sensor.wetterstation_temperatur",
        "humidity": "sensor.wetterstation_luftfeuchtigkeit",
        "co2": "sensor.wetterstation_kohlendioxid",
    }


def test_warnings_skip_advance_level(home):
    assert detect(home, "warnings") == {"entities": ["sensor.stadt_wendlingen_am_neckar_aktuelle_warnstufe"]}


def test_pollen(home):
    assert detect(home, "pollen") == {
        "entities": ["sensor.pollenflug_birke_112", "sensor.pollenflug_graeser_112"]
    }


def test_nothing_detected_on_empty_instance(hass):
    assert detect_all(hass) == {}


def test_dwd_only_is_not_a_weather_station(hass):
    from tests.conftest import add_sensor

    add_sensor(hass, "sensor.x_temperatur", "11", platform="dwd_weather", device_class="temperature")
    assert detect(hass, "weather_station") == {}
    assert detect(hass, "indoor") == {}
