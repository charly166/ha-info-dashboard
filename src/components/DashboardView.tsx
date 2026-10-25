import type { Connection, HassEntities } from 'home-assistant-js-websocket';
import { useDashboardConfig } from '../ha';
import type { Block } from '../types';
import { CalendarGroup } from './CalendarGroup';
import { WeatherGroup } from './WeatherGroup';

const SETTINGS_URL = '/config/integrations/integration/ha_info_dashboard';

export interface PanelHass {
  states: HassEntities;
  connection: Connection;
}

export function DashboardView({ hass, narrow }: { hass: PanelHass; narrow: boolean }) {
  const { states: entities, connection } = hass;
  const config = useDashboardConfig(connection);

  const topbar = (
    <header class="topbar">
      <ha-menu-button hass={hass} narrow={narrow} />
      <span>{config?.settings?.title ?? 'HA Info Dashboard'}</span>
    </header>
  );

  if (!config) return <>{topbar}<p class="muted center">Lade Konfiguration …</p></>;

  if (!config.configured || config.blocks.length === 0) {
    return (
      <>
        {topbar}
        <p class="muted center">
          Noch keine Bausteine eingerichtet.
          <br />
          <a href={SETTINGS_URL}>Einstellungen → Geräte &amp; Dienste → HA Info Dashboard</a> → „Baustein hinzufügen“.
        </p>
      </>
    );
  }

  const groups = new Map<string, Block[]>();
  for (const block of config.blocks) groups.set(block.group, [...(groups.get(block.group) ?? []), block]);

  return (
    <div class={`anim-${config.settings?.animation ?? 'on'}`}>
      {topbar}
      <main class="grid">
        {groups.has('weather') && (
          <WeatherGroup blocks={groups.get('weather')!} entities={entities} connection={connection} />
        )}
        {groups.has('calendar') && (
          <CalendarGroup blocks={groups.get('calendar')!} entities={entities} connection={connection} />
        )}
      </main>
    </div>
  );
}
