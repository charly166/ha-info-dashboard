import type { HassEntities } from 'home-assistant-js-websocket';
import type { Connection } from 'home-assistant-js-websocket';
import { entities as cfg } from '../config';
import { useDailyForecast } from '../ha';
import { condition, resolveOutdoor, type Reading } from '../weather';

const fmt = (r: Reading | undefined, digits = 0) =>
  r ? `${r.value.toLocaleString('de-DE', { maximumFractionDigits: digits })} ${r.unit}` : '–';

function Metric({ label, value, fallback }: { label: string; value: string; fallback?: boolean }) {
  return (
    <div class="metric">
      <span class="metric-label">{label}</span>
      <span class="metric-value">
        {value}
        {fallback && <sup title="Wert vom DWD, Messstation nicht verfügbar"> DWD</sup>}
      </span>
    </div>
  );
}

export function WeatherCard({ entities, connection }: { entities: HassEntities; connection?: Connection }) {
  const w = entities[cfg.weather];
  const cond = condition(w?.state);
  const o = resolveOutdoor(entities);
  const forecast = useDailyForecast(connection, cfg.weather).slice(0, 5);
  const raining = (o.rain?.value ?? 0) > 0;

  return (
    <section class="card weather">
      <header class="weather-now">
        <span class="weather-icon" aria-hidden="true">{cond.icon}</span>
        <div>
          <div class="weather-temp">{fmt(o.temperature, 1)}</div>
          <div class="weather-cond">{cond.label}</div>
        </div>
      </header>

      <div class="metrics">
        <Metric label="Luftfeuchte" value={fmt(o.humidity)} fallback={o.humidity?.fallback} />
        <Metric
          label="Wind"
          value={`${fmt(o.wind.speed)}${o.wind.label ? ` · ${o.wind.label}` : ''}`}
          fallback={o.wind.speed?.fallback}
        />
        <Metric label="Regen heute" value={fmt(o.rainToday, 1)} />
        {raining && <Metric label="Regen aktuell" value={fmt(o.rain, 1)} />}
      </div>

      {forecast.length > 0 && (
        <ul class="forecast">
          {forecast.map((d) => {
            const c = condition(d.condition);
            return (
              <li key={d.datetime} title={c.label}>
                <span class="fc-day">{new Date(d.datetime).toLocaleDateString('de-DE', { weekday: 'short' })}</span>
                <span class="fc-icon" aria-hidden="true">{c.icon}</span>
                <span class="fc-temp">
                  {d.temperature !== undefined ? `${Math.round(d.temperature)}°` : '–'}
                  {d.templow !== undefined && <small> {Math.round(d.templow)}°</small>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
