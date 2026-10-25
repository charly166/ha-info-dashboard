import type { Block } from './types';

/**
 * Dashboard aus den eingerichteten Bausteinen: Wetter links, Termine in der Mitte, Pakete und Ligen rechts.
 * Home Assistant bietet dazu „Dashboard übernehmen“ an; danach lässt es sich frei bearbeiten.
 */
export function buildDashboard(blocks: Block[], title = 'Info') {
  const has = (type: string) => blocks.some((b) => b.type === type);
  const weather: object[] = [];
  const dates: object[] = [];
  const more: object[] = [];

  if (has('weather_report') || has('weather_station')) {
    weather.push({ type: 'custom:ha-info-weather-card', show_warnings: false, show_pollen: false, show_indoor: false });
  }
  if (has('warnings')) weather.push({ type: 'custom:ha-info-warnings-card' });
  if (has('pollen')) weather.push({ type: 'custom:ha-info-pollen-card' });
  if (has('indoor')) weather.push({ type: 'custom:ha-info-indoor-card' });

  if (has('birthdays')) dates.push({ type: 'custom:ha-info-birthdays-card' });
  if (has('waste')) dates.push({ type: 'custom:ha-info-waste-card' });

  if (has('parcels')) more.push({ type: 'custom:ha-info-parcels-card' });
  const leagues = (blocks.find((b) => b.type === 'league')?.data.entities as string[] | undefined) ?? [];
  for (const entity of leagues) more.push({ type: 'custom:ha-info-league-card', entity });

  const sections = [weather, dates, more].filter((cards) => cards.length > 0).map((cards) => ({ type: 'grid', cards }));

  return {
    title,
    views: [
      {
        type: 'sections',
        title,
        path: 'info',
        max_columns: 3,
        sections:
          sections.length > 0
            ? sections
            : [
                {
                  type: 'grid',
                  cards: [
                    {
                      type: 'markdown',
                      content:
                        'Noch keine Bausteine eingerichtet. Öffne **Einstellungen → Geräte & Dienste → HA Info Dashboard** und füge Bausteine hinzu.',
                    },
                  ],
                },
              ],
      },
    ],
  };
}
