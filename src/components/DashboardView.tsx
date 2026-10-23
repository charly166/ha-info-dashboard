import type { Connection, HassEntities } from 'home-assistant-js-websocket';
import { WeatherCard } from './WeatherCard';
import { WarningsCard } from './WarningsCard';
import { IndoorCard } from './IndoorCard';

export function DashboardView({ entities, connection }: { entities: HassEntities; connection?: Connection }) {
  return (
    <main class="grid">
      <WeatherCard entities={entities} connection={connection} />
      <WarningsCard entities={entities} />
      <IndoorCard entities={entities} />
    </main>
  );
}
