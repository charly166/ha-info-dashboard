import type { HassEntities } from 'home-assistant-js-websocket';
import { resolveWarnings } from '../weather';

const LEVELS = ['', 'Wetterwarnung', 'Markante Wetterwarnung', 'Unwetterwarnung', 'Extreme Unwetterwarnung'];

const time = (d: Date) =>
  d.toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

export function WarningsCard({ entities }: { entities: HassEntities }) {
  const warnings = resolveWarnings(entities);

  return (
    <section class="card">
      <h2>Wetterwarnungen</h2>
      {warnings.length === 0 ? (
        <p class="muted">Keine Warnungen aktiv.</p>
      ) : (
        <ul class="warnings">
          {warnings.map((w) => (
            <li key={`${w.event}-${w.start.getTime()}`} style={{ borderLeftColor: w.color }}>
              <details>
                <summary>
                  <strong>{w.event}</strong>
                  <span class="muted">
                    {LEVELS[w.level] ?? `Stufe ${w.level}`} · {time(w.start)} – {time(w.end)}
                  </span>
                </summary>
                <p>{w.description}</p>
                <p class="muted">{w.instruction}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
