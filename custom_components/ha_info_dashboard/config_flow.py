"""Config-Flow: Einrichtung mit Erkennung; Bausteine sind Untereinträge, nach Gruppen geordnet."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    SOURCE_RECONFIGURE,
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    ConfigSubentryData,
    ConfigSubentryFlow,
    OptionsFlow,
    SubentryFlowResult,
)
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    EntitySelector,
    EntitySelectorConfig,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .const import (
    ANIMATION_ON,
    ANIMATION_OPTIONS,
    BIRTHDAYS,
    CONF_ANIMATION,
    DOMAIN,
    GROUP_KINDS,
    GROUP_TITLES,
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
from .detect import detect, detect_all, to_subentry


@dataclass(frozen=True)
class Field:
    key: str
    selector: EntitySelector
    required: bool = False


def _sensor(device_class: str | None = None, *, multiple: bool = False) -> EntitySelector:
    config: dict[str, Any] = {"domain": "sensor", "multiple": multiple}
    if device_class:
        config["device_class"] = device_class
    return EntitySelector(EntitySelectorConfig(**config))


def _calendar(*, multiple: bool = True) -> EntitySelector:
    return EntitySelector(EntitySelectorConfig(domain="calendar", multiple=multiple))


# Felder je Baustein-Art; Pakete und Liga lesen die Sensoren der jeweiligen HACS-Erweiterung.
SPECS: dict[str, tuple[Field, ...]] = {
    WEATHER_REPORT: (Field("weather", EntitySelector(EntitySelectorConfig(domain="weather")), True),),
    WEATHER_STATION: (
        Field("temperature", _sensor("temperature")),
        Field("humidity", _sensor("humidity")),
        Field("rain", _sensor("precipitation")),
        Field("rain_today", _sensor("precipitation")),
        Field("wind_speed", _sensor("wind_speed")),
        Field("wind_direction", _sensor()),
    ),
    INDOOR: (
        Field("temperature", _sensor("temperature")),
        Field("humidity", _sensor("humidity")),
        Field("co2", _sensor("carbon_dioxide")),
    ),
    WARNINGS: (Field("entities", _sensor(multiple=True), True),),
    POLLEN: (Field("entities", _sensor(multiple=True), True),),
    BIRTHDAYS: (Field("entities", _calendar(), True),),
    WASTE: (Field("entities", _calendar(), True),),
    PARCELS: (
        Field("open", EntitySelector(EntitySelectorConfig(domain="sensor", integration="parcel_tracker")), True),
        Field("delivered", EntitySelector(EntitySelectorConfig(domain="sensor", integration="parcel_tracker"))),
    ),
    LEAGUE: (
        Field(
            "entities",
            EntitySelector(EntitySelectorConfig(domain="sensor", integration="ligatracker", multiple=True)),
            True,
        ),
    ),
}

HINTS: dict[str, dict[str, str]] = {
    "de": {
        WEATHER_REPORT: "Wetter-Entität für aktuelle Lage und Prognose (z. B. DWD).",
        WEATHER_STATION: "Messwerte deiner eigenen Wetterstation (z. B. Netatmo oder Ecowitt). Fehlende Werte werden aus dem Wetterbericht ergänzt.",
        INDOOR: "Raumklima aus dem Hauptmodul deiner Wetterstation.",
        WARNINGS: "Sensoren der DWD-Warnmeldungen (aktuelle Warnstufe).",
        POLLEN: "Sensoren des DWD-Pollenflug-Gefahrenindex.",
        BIRTHDAYS: "Kalender mit Geburtstagen; angezeigt werden die kommenden 3 Tage.",
        WASTE: "Kalender mit den Abholterminen (z. B. Waste Collection Schedule); angezeigt werden die kommenden 7 Tage.",
        PARCELS: "Benötigt die HACS-Erweiterung „Paket Tracker“. Wähle den Sensor „Pakete unterwegs“ (alle offenen Pakete) und „Pakete zugestellt heute“.",
        LEAGUE: "Benötigt die HACS-Erweiterung „HA Liga Tracker“. Wähle den Sensor „Spieltage“ je Liga; angezeigt wird der nächste Spieltag.",
    },
    "en": {
        WEATHER_REPORT: "Weather entity for current conditions and forecast (e.g. DWD).",
        WEATHER_STATION: "Readings from your own weather station (e.g. Netatmo or Ecowitt). Missing values fall back to the weather report.",
        INDOOR: "Indoor climate from your weather station's main module.",
        WARNINGS: "DWD weather warning sensors (current warning level).",
        POLLEN: "DWD pollen forecast index sensors.",
        BIRTHDAYS: "Calendar with birthdays; the next 3 days are shown.",
        WASTE: "Calendar with pickup dates (e.g. Waste Collection Schedule); the next 7 days are shown.",
        PARCELS: "Requires the HACS integration “Paket Tracker”. Pick the “Pakete unterwegs” sensor (all open parcels) and “Pakete zugestellt heute”.",
        LEAGUE: "Requires the HACS integration “HA Liga Tracker”. Pick the “Spieltage” sensor of each league; the next matchday is shown.",
    },
}


def _clean(data: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in data.items() if v not in (None, "", [])}


class GroupSubentryFlow(ConfigSubentryFlow):
    """Bausteine einer Gruppe (Wetter, Kalender-Infos): erst die Art wählen, dann die Entitäten.

    Jede Art hat einen eigenen Schritt (`async_step_<art>`), damit die Beschriftungen passen.
    """

    group: str

    def _used(self) -> set[str]:
        return {
            s.data.get("kind")
            for s in self._get_entry().subentries.values()
            if s.subentry_type == self.group
        }

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        free = [k for k in GROUP_KINDS[self.group] if k not in self._used()]
        if not free:
            return self.async_abort(reason="already_configured")
        if user_input is not None:
            return await getattr(self, f"async_step_{user_input['kind']}")()
        schema = vol.Schema(
            {
                vol.Required("kind", default=free[0]): SelectSelector(
                    SelectSelectorConfig(
                        options=free, translation_key=f"{self.group}_kind", mode=SelectSelectorMode.LIST
                    )
                )
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        kind = self._get_reconfigure_subentry().data["kind"]
        return await getattr(self, f"async_step_{kind}")()

    def _form(self, kind: str, user_input: dict[str, Any] | None) -> SubentryFlowResult:
        spec = SPECS[kind]
        reconfigure = self.source == SOURCE_RECONFIGURE
        errors: dict[str, str] = {}

        if user_input is not None:
            data = _clean(user_input)
            if any(f.required and f.key not in data for f in spec):
                errors["base"] = "no_entity"
            else:
                data = {"kind": kind, **data}
                if reconfigure:
                    return self.async_update_and_abort(
                        self._get_entry(), self._get_reconfigure_subentry(), data=data
                    )
                return self.async_create_entry(title=KIND_TITLES[kind], data=data, unique_id=kind)
            defaults = user_input
        elif reconfigure:
            defaults = dict(self._get_reconfigure_subentry().data)
        else:
            defaults = detect(self.hass, kind)

        schema = {
            (vol.Required if f.required else vol.Optional)(
                f.key, description={"suggested_value": defaults.get(f.key)}
            ): f.selector
            for f in spec
        }
        lang = "de" if self.hass.config.language.startswith("de") else "en"
        return self.async_show_form(
            step_id=kind,
            data_schema=vol.Schema(schema),
            errors=errors,
            description_placeholders={"kind": KIND_TITLES[kind], "hint": HINTS[lang][kind]},
        )


def _make_group_flow(group: str) -> type[GroupSubentryFlow]:
    steps: dict[str, Any] = {"group": group}
    for kind in GROUP_KINDS[group]:

        async def step(self: GroupSubentryFlow, user_input: dict[str, Any] | None = None, _kind: str = kind):
            return self._form(_kind, user_input)

        steps[f"async_step_{kind}"] = step
    return type(f"{group.title()}SubentryFlow", (GroupSubentryFlow,), steps)


SUBENTRY_FLOWS: dict[str, type[ConfigSubentryFlow]] = {g: _make_group_flow(g) for g in GROUP_KINDS}


class HaInfoDashboardOptionsFlow(OptionsFlow):
    """Allgemeine Einstellungen des Dashboards."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        current = self.config_entry.options.get(CONF_ANIMATION, ANIMATION_ON)
        schema = vol.Schema(
            {
                vol.Required(CONF_ANIMATION, default=current): SelectSelector(
                    SelectSelectorConfig(
                        options=ANIMATION_OPTIONS,
                        translation_key=CONF_ANIMATION,
                        mode=SelectSelectorMode.DROPDOWN,
                    )
                )
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)


class HaInfoDashboardConfigFlow(ConfigFlow, domain=DOMAIN):
    """Einmalige Einrichtung; erkannte Bausteine werden direkt mit angelegt."""

    VERSION = 2

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return HaInfoDashboardOptionsFlow()

    @classmethod
    @callback
    def async_get_supported_subentry_types(cls, config_entry: ConfigEntry) -> dict[str, type[ConfigSubentryFlow]]:
        return SUBENTRY_FLOWS

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        detected = detect_all(self.hass)

        if user_input is not None or not detected:
            chosen = detected if user_input is None else {t: d for t, d in detected.items() if user_input.get(t)}
            return self.async_create_entry(
                title="HA Info Dashboard",
                data={},
                subentries=[
                    ConfigSubentryData(data=data, subentry_type=subentry_type, title=title, unique_id=key)
                    for key, found in chosen.items()
                    for subentry_type, data, title in [to_subentry(key, found)]
                ],
            )

        lines: list[str] = []
        for group, kinds in GROUP_KINDS.items():
            found = [k for k in kinds if k in detected]
            if found:
                lines.append(f"**{GROUP_TITLES[group]}**")
                lines += [f"- {KIND_TITLES[k]}: " + ", ".join(f"`{v}`" for v in _flatten(detected[k])) for k in found]
        summary = "\n".join(lines)
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({vol.Optional(t, default=True): bool for t in detected}),
            description_placeholders={"detected": summary},
        )


def _flatten(data: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for value in data.values():
        out.extend(value if isinstance(value, list) else [value])
    return out
