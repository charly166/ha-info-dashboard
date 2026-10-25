import { render } from 'preact';
import type { Connection, HassEntities } from 'home-assistant-js-websocket';
import { BirthdaysCard, LeagueCard, ParcelsCard, WasteCard } from './components/CalendarGroup';
import { IndoorCard, PollenCard, WarningsCard, WeatherGroup } from './components/WeatherGroup';
import { useDashboardConfig } from './ha';
import { adoptStyles } from './shell';
import { buildDashboard } from './strategy';
import type { Block, DashboardConfig } from './types';

interface CardHass {
  states: HassEntities;
  connection: Connection;
  callWS: <T>(message: { type: string }) => Promise<T>;
}

interface CardContext {
  blocks: Block[];
  entities: HassEntities;
  connection: Connection;
  config: Record<string, unknown>;
}

interface CardDef {
  tag: string;
  name: string;
  description: string;
  /** Liefert null, wenn der zugehörige Baustein nicht eingerichtet ist. */
  render: (ctx: CardContext) => preact.ComponentChildren;
}

const SETTINGS_PATH = '/config/integrations/integration/ha_info_dashboard';

const group = (blocks: Block[], name: string) => blocks.filter((b) => b.group === name);

const CARDS: CardDef[] = [
  {
    tag: 'ha-info-weather-card',
    name: 'Info: Wetter',
    description: 'Wetterbericht mit animiertem Himmel, Messwerten, Sonnenzeiten und Prognose.',
    render: ({ blocks, entities, connection, config }) => {
      const weather = group(blocks, 'weather');
      const hasMain = weather.some((b) => b.type === 'weather_report' || b.type === 'weather_station');
      return hasMain ? (
        <WeatherGroup
          blocks={weather}
          entities={entities}
          connection={connection}
          show={{
            warnings: config.show_warnings !== false,
            pollen: config.show_pollen !== false,
            indoor: config.show_indoor !== false,
          }}
        />
      ) : null;
    },
  },
  {
    tag: 'ha-info-warnings-card',
    name: 'Info: Wetterwarnungen',
    description: 'DWD-Warnmeldungen auf dem Himmel der Wetterlage.',
    render: ({ blocks, entities }) => <WarningsCard blocks={group(blocks, 'weather')} entities={entities} />,
  },
  {
    tag: 'ha-info-pollen-card',
    name: 'Info: Pollenflug',
    description: 'DWD-Pollenflug-Gefahrenindex für heute bis übermorgen.',
    render: ({ blocks, entities }) => <PollenCard blocks={group(blocks, 'weather')} entities={entities} />,
  },
  {
    tag: 'ha-info-indoor-card',
    name: 'Info: Innenraum',
    description: 'Temperatur, Luftfeuchte und CO₂ im Haus.',
    render: ({ blocks, entities }) => <IndoorCard blocks={group(blocks, 'weather')} entities={entities} />,
  },
  {
    tag: 'ha-info-birthdays-card',
    name: 'Info: Geburtstage',
    description: 'Die Geburtstage der nächsten 3 Tage.',
    render: ({ blocks, entities, connection }) => (
      <BirthdaysCard blocks={group(blocks, 'calendar')} entities={entities} connection={connection} />
    ),
  },
  {
    tag: 'ha-info-waste-card',
    name: 'Info: Müllabfuhr',
    description: 'Die Abholtermine der nächsten 7 Tage mit Tonne in der Farbe der Abfallart.',
    render: ({ blocks, entities, connection }) => (
      <WasteCard blocks={group(blocks, 'calendar')} entities={entities} connection={connection} />
    ),
  },
  {
    tag: 'ha-info-parcels-card',
    name: 'Info: Pakete',
    description: 'Offene und heute zugestellte Pakete (Paket Tracker).',
    render: ({ blocks, entities }) => <ParcelsCard blocks={group(blocks, 'calendar')} entities={entities} />,
  },
  {
    tag: 'ha-info-league-card',
    name: 'Info: Fußball-Liga',
    description: 'Der nächste Spieltag einer Liga (HA Liga Tracker). Mit `entity` wählst du die Liga.',
    render: ({ blocks, entities, config }) => (
      <LeagueCard blocks={group(blocks, 'calendar')} entities={entities} entity={config.entity as string | undefined} />
    ),
  },
];

function NotConfigured({ name }: { name: string }) {
  const open = (e: Event) => {
    e.preventDefault();
    history.pushState(null, '', SETTINGS_PATH);
    window.dispatchEvent(new CustomEvent('location-changed'));
  };
  return (
    <section class="card">
      <div class="card-body muted">
        „{name}“ ist noch nicht eingerichtet.
        <br />
        <a href={SETTINGS_PATH} onClick={open}>
          Einstellungen → Geräte &amp; Dienste → HA Info Dashboard
        </a>
      </div>
    </section>
  );
}

function CardRoot({ hass, def, config }: { hass: CardHass; def: CardDef; config: Record<string, unknown> }) {
  const dashboard: DashboardConfig | undefined = useDashboardConfig(hass.connection);
  if (!dashboard) return null;
  const body = def.render({ blocks: dashboard.blocks, entities: hass.states, connection: hass.connection, config });
  return <div class={`anim-${dashboard.settings?.animation ?? 'on'}`}>{body ?? <NotConfigured name={def.name} />}</div>;
}

function defineCard(def: CardDef) {
  class InfoCard extends HTMLElement {
    private root = this.attachShadow({ mode: 'open' });
    private mount = document.createElement('div');
    private _hass?: CardHass;
    private _config: Record<string, unknown> = {};

    constructor() {
      super();
      adoptStyles(this.root);
      this.root.append(this.mount);
    }

    setConfig(config: Record<string, unknown>) {
      this._config = config ?? {};
      this.update();
    }

    set hass(hass: CardHass) {
      this._hass = hass;
      this.update();
    }

    connectedCallback() {
      this.update();
    }

    /** Beendet die Abonnements der Karte, wenn sie aus dem Dashboard entfernt wird. */
    disconnectedCallback() {
      render(null, this.mount);
    }

    getCardSize() {
      return 6;
    }

    getGridOptions() {
      return { columns: 12, min_columns: 6, rows: 'auto' };
    }

    static getStubConfig() {
      return {};
    }

    private update() {
      if (this.isConnected && this._hass) render(<CardRoot hass={this._hass} def={def} config={this._config} />, this.mount);
    }
  }
  if (!customElements.get(def.tag)) customElements.define(def.tag, InfoCard);
}

const STRATEGY = 'ha-info-dashboard';

/** Erzeugt das Dashboard aus den eingerichteten Bausteinen („Dashboard hinzufügen“ → HA Info Dashboard). */
class InfoDashboardStrategy extends HTMLElement {
  static async generate(_config: unknown, hass: CardHass) {
    const config = await hass.callWS<DashboardConfig>({ type: 'ha_info_dashboard/get_config' });
    return buildDashboard(config.blocks, config.settings?.title);
  }
}

const PREVIEW =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#3a7bd5"/><circle cx="118" cy="30" r="14" fill="#ffd54a"/><rect x="10" y="48" width="46" height="42" rx="6" fill="#fff" opacity=".35"/><rect x="62" y="48" width="46" height="42" rx="6" fill="#fff" opacity=".35"/><rect x="114" y="48" width="36" height="42" rx="6" fill="#fff" opacity=".35"/></svg>',
  );

export function registerCards() {
  const w = window as unknown as { customCards?: { type: string }[]; customStrategies?: { type: string }[] };

  w.customCards ??= [];
  for (const def of CARDS) {
    defineCard(def);
    if (!w.customCards.some((c) => c.type === def.tag)) {
      w.customCards.push({ type: def.tag, name: def.name, description: def.description, preview: false } as never);
    }
  }

  if (!customElements.get(`ll-strategy-dashboard-${STRATEGY}`)) {
    customElements.define(`ll-strategy-dashboard-${STRATEGY}`, InfoDashboardStrategy);
  }
  w.customStrategies ??= [];
  if (!w.customStrategies.some((s) => s.type === STRATEGY)) {
    w.customStrategies.push({
      type: STRATEGY,
      strategyType: 'dashboard',
      name: 'HA Info Dashboard',
      description: 'Erzeugt aus den eingerichteten Bausteinen ein Dashboard, das du danach frei anpassen kannst.',
      images: { light: PREVIEW, dark: PREVIEW },
    } as never);
  }
}
