"""Config-Flow: Einrichtung mit Erkennung und Bausteine als Untereinträge."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    OptionsFlow,
    ConfigFlowResult,
    ConfigSubentryData,
    ConfigSubentryFlow,
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
    ANIMATION_OPTIONS,
    CALENDAR,
    CALENDAR_KIND_TITLES,
    CALENDAR_KINDS,
    LEAGUE,
    PARCELS,
    ANIMATION_ON,
    CONF_ANIMATION,
    DOMAIN,
    INDOOR,
    POLLEN,
    SUBENTRY_TITLES,
    WASTE,
    BIRTHDAYS,
    WARNINGS,
    WEATHER_REPORT,
    WEATHER_STATION,
)
from .detect import detect, detect_all, detect_kind, to_subentry


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
}


def _clean(data: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in data.items() if v not in (None, "", [])}


class BlockSubentryFlow(ConfigSubentryFlow):
    """Gemeinsamer Ablauf für alle Bausteine; die Felder kommen aus SPECS."""

    subentry_type: str

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        entry = self._get_entry()
        if any(s.subentry_type == self.subentry_type for s in entry.subentries.values()):
            return self.async_abort(reason="already_configured")
        return self._form("user", user_input, detect(self.hass, self.subentry_type))

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        return self._form("reconfigure", user_input, dict(self._get_reconfigure_subentry().data))

    def _form(self, step_id: str, user_input: dict[str, Any] | None, defaults: dict[str, Any]) -> SubentryFlowResult:
        spec = SPECS[self.subentry_type]
        errors: dict[str, str] = {}

        if user_input is not None:
            data = _clean(user_input)
            if not data:
                errors["base"] = "no_entity"
            else:
                if step_id == "reconfigure":
                    return self.async_update_and_abort(
                        self._get_entry(), self._get_reconfigure_subentry(), data=data
                    )
                return self.async_create_entry(
                    title=SUBENTRY_TITLES[self.subentry_type], data=data, unique_id=self.subentry_type
                )
            defaults = user_input

        schema: dict[Any, Any] = {}
        for field in spec:
            marker = vol.Required if field.required else vol.Optional
            schema[marker(field.key, description={"suggested_value": defaults.get(field.key)})] = field.selector
        return self.async_show_form(step_id=step_id, data_schema=vol.Schema(schema), errors=errors)


def _make_flow(subentry_type: str) -> type[BlockSubentryFlow]:
    return type(
        f"{subentry_type.title().replace('_', '')}SubentryFlow",
        (BlockSubentryFlow,),
        {"subentry_type": subentry_type},
    )


def _calendar(*, multiple: bool = True) -> EntitySelector:
    return EntitySelector(EntitySelectorConfig(domain="calendar", multiple=multiple))


# Felder je Kalender-Art; Pakete und Liga lesen die Sensoren der jeweiligen HACS-Erweiterung.
CALENDAR_SPECS: dict[str, tuple[Field, ...]] = {
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

CALENDAR_HINTS: dict[str, dict[str, str]] = {
    "de": {
        BIRTHDAYS: "Kalender mit Geburtstagen; angezeigt werden die kommenden 3 Tage.",
        WASTE: "Kalender mit den Abholterminen (z. B. Waste Collection Schedule); angezeigt werden die kommenden 7 Tage.",
        PARCELS: "Benötigt die HACS-Erweiterung „Paket Tracker“. Wähle den Sensor „Pakete unterwegs“ (alle offenen Pakete) und „Pakete zugestellt heute“.",
        LEAGUE: "Benötigt die HACS-Erweiterung „HA Liga Tracker“. Wähle den Sensor „Spieltage“ je Liga; angezeigt wird der nächste Spieltag.",
    },
    "en": {
        BIRTHDAYS: "Calendar with birthdays; the next 3 days are shown.",
        WASTE: "Calendar with pickup dates (e.g. Waste Collection Schedule); the next 7 days are shown.",
        PARCELS: "Requires the HACS integration “Paket Tracker”. Pick the “Pakete unterwegs” sensor (all open parcels) and “Pakete zugestellt heute”.",
        LEAGUE: "Requires the HACS integration “HA Liga Tracker”. Pick the “Spieltage” sensor of each league; the next matchday is shown.",
    },
}


class CalendarSubentryFlow(ConfigSubentryFlow):
    """Kalender-Bausteine: erst die Art wählen, dann die Entität(en)."""

    _kind: str

    def _used(self) -> set[str]:
        return {
            s.data.get("kind")
            for s in self._get_entry().subentries.values()
            if s.subentry_type == CALENDAR
        }

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        free = [k for k in CALENDAR_KINDS if k not in self._used()]
        if not free:
            return self.async_abort(reason="already_configured")
        if user_input is not None:
            self._kind = user_input["kind"]
            return await self.async_step_entities()
        schema = vol.Schema(
            {
                vol.Required("kind", default=free[0]): SelectSelector(
                    SelectSelectorConfig(options=free, translation_key="calendar_kind", mode=SelectSelectorMode.LIST)
                )
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    async def async_step_entities(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        return self._form("entities", user_input, detect_kind(self.hass, self._kind))

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        subentry = self._get_reconfigure_subentry()
        self._kind = subentry.data["kind"]
        return self._form("reconfigure", user_input, dict(subentry.data))

    def _form(self, step_id: str, user_input: dict[str, Any] | None, defaults: dict[str, Any]) -> SubentryFlowResult:
        spec = CALENDAR_SPECS[self._kind]
        errors: dict[str, str] = {}
        if user_input is not None:
            data = _clean(user_input)
            if any(f.required and f.key not in data for f in spec):
                errors["base"] = "no_entity"
            else:
                data = {"kind": self._kind, **data}
                if step_id == "reconfigure":
                    return self.async_update_and_abort(
                        self._get_entry(), self._get_reconfigure_subentry(), data=data
                    )
                return self.async_create_entry(
                    title=CALENDAR_KIND_TITLES[self._kind], data=data, unique_id=self._kind
                )
            defaults = user_input
        schema = {
            (vol.Required if f.required else vol.Optional)(
                f.key, description={"suggested_value": defaults.get(f.key)}
            ): f.selector
            for f in spec
        }
        lang = "de" if self.hass.config.language.startswith("de") else "en"
        return self.async_show_form(
            step_id=step_id,
            data_schema=vol.Schema(schema),
            errors=errors,
            description_placeholders={
                "kind": CALENDAR_KIND_TITLES[self._kind],
                "hint": CALENDAR_HINTS[lang][self._kind],
            },
        )


SUBENTRY_FLOWS: dict[str, type[ConfigSubentryFlow]] = {t: _make_flow(t) for t in SPECS}
SUBENTRY_FLOWS[CALENDAR] = CalendarSubentryFlow


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

    VERSION = 1

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

        summary = "\n".join(
            f"- **{SUBENTRY_TITLES.get(t) or CALENDAR_KIND_TITLES[t]}**: " + ", ".join(f"`{v}`" for v in _flatten(d))
            for t, d in detected.items()
        )
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
