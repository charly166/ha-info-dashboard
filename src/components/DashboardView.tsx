import type { Connection, HassEntities } from 'home-assistant-js-websocket';
import { useDashboardConfig } from '../ha';
import type { Block } from '../types';
import { WeatherGroup } from './WeatherGroup';

const SETTINGS_URL = '/config/integrations/integration/ha_info_dashboard';

export function DashboardView({ entities, connection }: { entities: HassEntities; connection?: Connection }) {
  const config = useDashboardConfig(connection);

  if (!config) return <p class="muted center">Lade Konfiguration …</p>;

  if (!config.configured || config.blocks.length === 0) {
    return (
      <p class="muted center">
        Noch keine Bausteine eingerichtet.
        <br />
        <a href={SETTINGS_URL}>Einstellungen → Geräte &amp; Dienste → HA Info Dashboard</a> → „Baustein hinzufügen“.
      </p>
    );
  }

  const groups = new Map<string, Block[]>();
  for (const block of config.blocks) groups.set(block.group, [...(groups.get(block.group) ?? []), block]);

  return (
    <main class="grid">
      {groups.has('weather') && (
        <WeatherGroup blocks={groups.get('weather')!} entities={entities} connection={connection} />
      )}
    </main>
  );
}
