import type { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { entities as cfg } from './config';

const UNAVAILABLE = new Set(['unavailable', 'unknown', '']);

export interface Reading {
  value: number;
  unit: string;
  /** true, wenn der Wert aus dem DWD-Fallback stammt */
  fallback: boolean;
}

function num(e: HassEntity | undefined): number | undefined {
  if (!e || UNAVAILABLE.has(e.state)) return undefined;
  const n = Number(e.state);
  return Number.isFinite(n) ? n : undefined;
}

function reading(e: HassEntity | undefined, fallback?: Reading): Reading | undefined {
  const value = num(e);
  if (value !== undefined) return { value, unit: e?.attributes.unit_of_measurement ?? '', fallback: false };
  return fallback ? { ...fallback, fallback: true } : undefined;
}

function weatherAttr(w: HassEntity | undefined, key: string, unit: string): Reading | undefined {
  const v = w?.attributes[key];
  return typeof v === 'number' ? { value: v, unit, fallback: true } : undefined;
}

const SECTORS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const SECTOR_LABEL: Record<string, string> = { n: 'N', ne: 'NO', e: 'O', se: 'SO', s: 'S', sw: 'SW', w: 'W', nw: 'NW' };

export interface Wind {
  speed?: Reading;
  /** Himmelsrichtung, aus der der Wind weht (0 = Nord) */
  degrees?: number;
  label?: string;
}

function windDirection(raw: string | number | undefined): { degrees: number; label: string } | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (Number.isFinite(n)) {
    const idx = Math.round((((n % 360) + 360) % 360) / 45) % 8;
    return { degrees: n, label: SECTOR_LABEL[SECTORS[idx]] };
  }
  const idx = SECTORS.indexOf(String(raw).toLowerCase());
  return idx < 0 ? undefined : { degrees: idx * 45, label: SECTOR_LABEL[SECTORS[idx]] };
}

export function resolveOutdoor(all: HassEntities) {
  const w = all[cfg.weather];
  const o = cfg.outdoor;
  const dirEntity = all[o.windDirection];
  const dir = windDirection(dirEntity && !UNAVAILABLE.has(dirEntity.state) ? dirEntity.state : w?.attributes.wind_bearing);
  const wind: Wind = {
    speed: reading(all[o.windSpeed], weatherAttr(w, 'wind_speed', 'km/h')),
    degrees: dir?.degrees,
    label: dir?.label,
  };
  return {
    temperature: reading(all[o.temperature], weatherAttr(w, 'temperature', '°C')),
    humidity: reading(all[o.humidity], weatherAttr(w, 'humidity', '%')),
    rain: reading(all[o.rain]),
    rainToday: reading(all[o.rainToday]),
    wind,
  };
}

export function resolveIndoor(all: HassEntities) {
  const i = cfg.indoor;
  return {
    temperature: reading(all[i.temperature]),
    humidity: reading(all[i.humidity]),
    co2: reading(all[i.co2]),
  };
}

export interface Warning {
  event: string;
  level: number;
  color: string;
  headline: string;
  description: string;
  instruction: string;
  start: Date;
  end: Date;
}

export function resolveWarnings(all: HassEntities): Warning[] {
  const out: Warning[] = [];
  for (const id of cfg.warnings) {
    const a = all[id]?.attributes;
    const count = Number(a?.warning_count ?? 0);
    for (let n = 1; n <= count; n++) {
      const w = a?.[`warning_${n}`];
      if (!w) continue;
      out.push({
        event: w.event,
        level: w.level,
        color: w.color,
        headline: w.headline,
        description: w.description,
        instruction: w.instruction,
        start: new Date(w.start_time),
        end: new Date(w.end_time),
      });
    }
  }
  return out.sort((a, b) => b.level - a.level || a.start.getTime() - b.start.getTime());
}

const CONDITIONS: Record<string, [string, string]> = {
  'clear-night': ['Klar', '🌙'],
  cloudy: ['Bewölkt', '☁️'],
  exceptional: ['Außergewöhnlich', '⚠️'],
  fog: ['Nebel', '🌫️'],
  hail: ['Hagel', '🌨️'],
  lightning: ['Gewitter', '🌩️'],
  'lightning-rainy': ['Gewitter, Regen', '⛈️'],
  partlycloudy: ['Teils bewölkt', '⛅'],
  pouring: ['Starkregen', '🌧️'],
  rainy: ['Regen', '🌦️'],
  snowy: ['Schnee', '❄️'],
  'snowy-rainy': ['Schneeregen', '🌨️'],
  sunny: ['Sonnig', '☀️'],
  windy: ['Windig', '💨'],
  'windy-variant': ['Windig, bewölkt', '💨'],
};

export function condition(key: string | undefined): { label: string; icon: string } {
  const [label, icon] = CONDITIONS[key ?? ''] ?? [key ?? '–', '❔'];
  return { label, icon };
}
