/** Visueller Editor für die Karten-Optionen (Hintergrund, Animation, Anzeige). */

type Schema = { name: string; selector: Record<string, unknown> };

const BACKGROUND: Schema = { name: 'background', selector: { boolean: {} } };
const ANIMATION: Schema = {
  name: 'animation',
  selector: {
    select: {
      mode: 'dropdown',
      options: [
        { value: 'inherit', label: 'Wie in den Einstellungen der Integration' },
        { value: 'on', label: 'Immer an' },
        { value: 'auto', label: 'Automatisch (Systemeinstellung beachten)' },
        { value: 'off', label: 'Aus' },
      ],
    },
  },
};
const flag = (name: string): Schema => ({ name, selector: { boolean: {} } });

const SCHEMAS: Record<string, Schema[]> = {
  'ha-info-weather-card': [BACKGROUND, ANIMATION, flag('show_warnings'), flag('show_pollen'), flag('show_indoor')],
  'ha-info-warnings-card': [BACKGROUND, ANIMATION],
  'ha-info-pollen-card': [BACKGROUND, ANIMATION],
  'ha-info-indoor-card': [BACKGROUND, ANIMATION],
  'ha-info-birthdays-card': [BACKGROUND],
  'ha-info-waste-card': [BACKGROUND],
  'ha-info-parcels-card': [BACKGROUND],
  'ha-info-league-card': [
    BACKGROUND,
    { name: 'entity', selector: { entity: { domain: 'sensor', integration: 'ligatracker' } } },
  ],
};

const LABELS: Record<string, string> = {
  background: 'Hintergrund anzeigen',
  animation: 'Animation',
  show_warnings: 'Wetterwarnungen anzeigen',
  show_pollen: 'Pollenflug anzeigen',
  show_indoor: 'Innenraum anzeigen',
  entity: 'Liga (Sensor „Spieltage“)',
};

/** Schalter, die standardmäßig an sind; im YAML steht nur, was abweicht. */
const ON_BY_DEFAULT = ['background', 'show_warnings', 'show_pollen', 'show_indoor'];

type Config = Record<string, unknown>;

interface HaForm extends HTMLElement {
  hass?: unknown;
  data?: Config;
  schema?: Schema[];
  computeLabel?: (schema: Schema) => string;
}

export class InfoCardEditor extends HTMLElement {
  cardType = '';
  private _config: Config = {};
  private _hass?: unknown;
  private form?: HaForm;

  setConfig(config: Config) {
    this._config = config ?? {};
    this.render();
  }

  set hass(hass: unknown) {
    this._hass = hass;
    if (this.form) this.form.hass = hass;
  }

  private render() {
    if (!this.form) {
      const form = document.createElement('ha-form') as HaForm;
      form.computeLabel = (schema) => LABELS[schema.name] ?? schema.name;
      form.addEventListener('value-changed', (ev) => {
        ev.stopPropagation();
        this.changed((ev as CustomEvent<{ value: Config }>).detail.value);
      });
      this.form = form;
      this.append(form);
    }
    this.form.hass = this._hass;
    this.form.schema = SCHEMAS[this.cardType] ?? [BACKGROUND];
    this.form.data = this.display(this._config);
  }

  /** Werte, die der Editor anzeigt: fehlende Angaben zeigen ihren Standard. */
  private display(config: Config): Config {
    const names = (SCHEMAS[this.cardType] ?? [BACKGROUND]).map((s) => s.name);
    const data: Config = { ...config };
    for (const key of ON_BY_DEFAULT) if (names.includes(key)) data[key] = config[key] !== false;
    if (names.includes('animation')) data.animation = (config.animation as string | undefined) ?? 'inherit';
    return data;
  }

  private changed(value: Config) {
    const config: Config = { ...this._config, ...value };
    for (const key of ON_BY_DEFAULT) if (config[key] !== false) delete config[key];
    if (config.animation === 'inherit' || config.animation === undefined) delete config.animation;
    if (!config.entity) delete config.entity;
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }
}

export function registerEditor() {
  if (!customElements.get('ha-info-card-editor')) customElements.define('ha-info-card-editor', InfoCardEditor);
}
