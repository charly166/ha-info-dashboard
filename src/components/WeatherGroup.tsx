import type { Connection, HassEntities } from 'home-assistant-js-websocket';
import { useDailyForecast, useForecast } from '../ha';
import type { Block, IndoorConfig, StationConfig } from '../types';
import { Sky, kindOf } from './Sky';
import {
  condition,
  timeOfDay,
  resolveIndoor,
  resolveOutdoor,
  resolvePollen,
  resolveWarnings,
  type Pollen,
  type Reading,
  type Warning,
} from '../weather';

const fmt = (r: Reading | undefined, digits = 0) =>
  r ? `${r.value.toLocaleString('de-DE', { maximumFractionDigits: digits })} ${r.unit}` : '–';

const WARNING_LEVELS = ['', 'Wetterwarnung', 'Markante Wetterwarnung', 'Unwetterwarnung', 'Extreme Unwetterwarnung'];
const hour = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Die laufende Stunde und die folgenden; vergangene Stunden fallen weg. */
function currentAndNext<T extends { datetime: string }>(items: T[], count: number): T[] {
  const start = Date.now() - 60 * 60 * 1000;
  return items.filter((i) => new Date(i.datetime).getTime() > start).slice(0, count);
}

const time = (d: Date) => d.toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

function Metric({ label, value, fallback, tone }: { label: string; value: string; fallback?: boolean; tone?: string }) {
  return (
    <div class="metric">
      <span class="metric-label">{label}</span>
      <span class={`metric-value ${tone ?? ''}`}>
        {value}
        {fallback && <sup title="Wert aus dem Wetterbericht, Messstation nicht verfügbar"> DWD</sup>}
      </span>
    </div>
  );
}

function Detail({
  label,
  value,
  fallback,
  extra,
}: {
  label: string;
  value: string;
  fallback?: boolean;
  extra?: preact.ComponentChildren;
}) {
  return (
    <div class="detail">
      <span class="detail-label">{label}</span>
      <span class="detail-value">
        {value}
        {fallback && <sup title="Wert aus dem Wetterbericht, Messstation nicht verfügbar"> DWD</sup>}
        {extra}
      </span>
    </div>
  );
}

function Warnings({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;
  const top = warnings[0];
  return (
    <section class="warnings" style={{ borderColor: top.color }}>
      {warnings.map((w) => (
        <details key={`${w.event}-${w.start.getTime()}`} style={{ borderLeftColor: w.color }}>
          <summary>
            <strong>{w.event}</strong>
            <span class="muted">
              {WARNING_LEVELS[w.level] ?? `Stufe ${w.level}`} · {time(w.start)} – {time(w.end)}
            </span>
          </summary>
          <p>{w.description}</p>
          <p class="muted">{w.instruction}</p>
        </details>
      ))}
    </section>
  );
}

function PollenRow({ pollen }: { pollen: Pollen[] }) {
  const active = pollen.filter((p) => Math.max(p.today, p.tomorrow, p.inTwoDays) > 0);
  const level = (v: number) => (v <= 0 ? 'none' : v <= 1 ? 'low' : v <= 2 ? 'mid' : 'high');
  return (
    <section class="panel">
      <h2>Pollenflug</h2>
      {active.length === 0 ? (
        <p class="muted">Keine Belastung in den nächsten Tagen.</p>
      ) : (
        <ul class="chips">
          {active.map((p) => (
            <li
              key={p.name}
              class={`chip ${level(p.today)}`}
              title={`Heute: ${p.description || p.today} · Morgen: ${p.tomorrow} · Übermorgen: ${p.inTwoDays}`}
            >
              {p.name}
              <small>
                {' '}
                {p.today} → {p.tomorrow}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function co2Tone(ppm: number | undefined) {
  if (ppm === undefined) return { label: '', tone: '' };
  if (ppm < 800) return { label: 'gut', tone: 'ok' };
  if (ppm < 1200) return { label: 'lüften', tone: 'warn' };
  return { label: 'schlecht', tone: 'bad' };
}

export function WeatherGroup({
  blocks,
  entities,
  connection,
}: {
  blocks: Block[];
  entities: HassEntities;
  connection?: Connection;
}) {
  const data = (type: Block['type']) => blocks.find((b) => b.type === type)?.data;
  const weatherId = data('weather_report')?.weather as string | undefined;
  const station = data('weather_station') as StationConfig | undefined;
  const indoorCfg = data('indoor') as IndoorConfig | undefined;
  const warningIds = data('warnings')?.entities as string[] | undefined;
  const pollenIds = data('pollen')?.entities as string[] | undefined;

  const w = weatherId ? entities[weatherId] : undefined;
  const cond = condition(w?.state);
  const o = resolveOutdoor(entities, station, weatherId);
  const forecast = useDailyForecast(connection, weatherId).slice(0, 5);
  const hourly = currentAndNext(useForecast(connection, weatherId, 'hourly'), 5);
  const warnings = resolveWarnings(entities, warningIds);
  const pollen = resolvePollen(entities, pollenIds);
  const indoor = resolveIndoor(entities, indoorCfg);
  const co2 = co2Tone(indoor.co2?.value);
  const raining = (o.rain?.value ?? 0) > 0;

  const today = forecast[0];
  const place = (w?.attributes.friendly_name as string | undefined) ?? '';
  const apparent = o.apparent;

  return (
    <section class="card weather-group">
      <Sky kind={kindOf(w?.state)} tod={timeOfDay(entities)}>
        <Warnings warnings={warnings} />

        {(weatherId || station) && (
          <>
            <div class="sky-top">
              <span>{place}</span>
              <span>{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>

            <div class="sky-main">
              <div class="sky-temp">{fmt(o.temperature, 1).replace('\u202f', '')}</div>
              <div class="sky-cond">
                {weatherId ? cond.label : 'Außen'}
                {today?.temperature !== undefined && (
                  <span>
                    {' · '}
                    {today.templow !== undefined ? `${Math.round(today.templow)}° / ` : ''}
                    {Math.round(today.temperature)}°
                  </span>
                )}
              </div>
            </div>

            <div class="sky-details">
              {apparent && <Detail label="Gefühlt" value={fmt(apparent, 1)} />}
              <Detail label="Luftfeuchte" value={fmt(o.humidity)} fallback={o.humidity?.fallback} />
              <Detail
                label="Wind"
                value={fmt(o.windSpeed)}
                fallback={o.windSpeed?.fallback}
                extra={
                  o.windLabel && (
                    <span class="wind-dir">
                      {o.windDegrees !== undefined && (
                        <i class="wind-arrow" style={{ transform: `rotate(${o.windDegrees + 180}deg)` }}>↑</i>
                      )}
                      {o.windLabel}
                    </span>
                  )
                }
              />
              {station?.rain_today && <Detail label="Regen heute" value={fmt(o.rainToday, 1)} />}
              {raining && <Detail label="Regen aktuell" value={fmt(o.rain, 1)} />}
            </div>
          </>
        )}

        {hourly.length > 0 && (
          <section class="panel">
            <h2>Heutige Vorhersage</h2>
            <ul class="forecast hourly">
              {hourly.map((h, i) => {
                const c = condition(h.condition);
                return (
                  <li key={h.datetime} title={c.label}>
                    <span class="fc-day">{i === 0 ? 'Jetzt' : hour(h.datetime)}</span>
                    <span class="fc-icon" aria-hidden="true">{c.icon}</span>
                    <span class="fc-temp">{h.temperature !== undefined ? `${Math.round(h.temperature)}°` : '–'}</span>
                    {h.precipitation_probability !== undefined && h.precipitation_probability > 0 && (
                      <span class="fc-rain">{h.precipitation_probability}&nbsp;%</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {forecast.length > 0 && (
          <section class="panel">
            <h2>Vorhersage kommende Tage</h2>
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
                    {d.precipitation_probability !== undefined && d.precipitation_probability > 0 && (
                      <span class="fc-rain">{d.precipitation_probability}&nbsp;%</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {pollenIds && <PollenRow pollen={pollen} />}

        {indoorCfg && (
          <section class="panel">
            <h2>Innen</h2>
            <div class="metrics">
              {indoorCfg.temperature && <Metric label="Temperatur" value={fmt(indoor.temperature, 1)} />}
              {indoorCfg.humidity && <Metric label="Luftfeuchte" value={fmt(indoor.humidity)} />}
              {indoorCfg.co2 && (
                <Metric label="CO₂" value={`${fmt(indoor.co2)}${co2.label ? ` · ${co2.label}` : ''}`} tone={co2.tone} />
              )}
            </div>
          </section>
        )}
      </Sky>
    </section>
  );
}
