import type { HassEntities } from 'home-assistant-js-websocket';
import { resolveIndoor, type Reading } from '../weather';

const fmt = (r: Reading | undefined, digits = 0) =>
  r ? `${r.value.toLocaleString('de-DE', { maximumFractionDigits: digits })} ${r.unit}` : '–';

function co2Level(ppm: number | undefined) {
  if (ppm === undefined) return { label: '', cls: '' };
  if (ppm < 800) return { label: 'gut', cls: 'ok' };
  if (ppm < 1200) return { label: 'lüften', cls: 'warn' };
  return { label: 'schlecht', cls: 'bad' };
}

export function IndoorCard({ entities }: { entities: HassEntities }) {
  const i = resolveIndoor(entities);
  const co2 = co2Level(i.co2?.value);
  return (
    <section class="card">
      <h2>Innenraum</h2>
      <div class="metrics">
        <div class="metric">
          <span class="metric-label">Temperatur</span>
          <span class="metric-value">{fmt(i.temperature, 1)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Luftfeuchte</span>
          <span class="metric-value">{fmt(i.humidity)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">CO₂</span>
          <span class={`metric-value ${co2.cls}`}>
            {fmt(i.co2)} {co2.label && <small>{co2.label}</small>}
          </span>
        </div>
      </div>
    </section>
  );
}
