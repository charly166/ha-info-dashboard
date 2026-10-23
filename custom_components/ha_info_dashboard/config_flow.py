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
    ANIMATION_ON,
    CONF_ANIMATION,
    DOMAIN,
    INDOOR,
    POLLEN,
    SUBENTRY_TITLES,
    WARNINGS,
    WEATHER_REPORT,
    WEATHER_STATION,
)
from .detect import detect, detect_all


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


SUBENTRY_FLOWS: dict[str, type[ConfigSubentryFlow]] = {t: _make_flow(t) for t in SPECS}


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
                    ConfigSubentryData(
                        data=data,
                        subentry_type=subentry_type,
                        title=SUBENTRY_TITLES[subentry_type],
                        unique_id=subentry_type,
                    )
                    for subentry_type, data in chosen.items()
                ],
            )

        summary = "\n".join(
            f"- **{SUBENTRY_TITLES[t]}**: " + ", ".join(f"`{v}`" for v in _flatten(d))
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
