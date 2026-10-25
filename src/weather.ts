import type { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import type { IndoorConfig, StationConfig } from './types';

const UNAVAILABLE = new Set(['unavailable', 'unknown', '']);

const entity = (all: HassEntities, id?: string): HassEntity | undefined => (id ? all[id] : undefined);

export interface Reading {
  value: number;
  unit: string;
  /** true, wenn der Wert aus dem Wetterbericht stammt statt von der Messstation */
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

export interface SunTimes {
  rising?: Date;
  setting?: Date;
}

/** Nächster Sonnenaufgang und -untergang (sun.sun). */
export function resolveSun(all: HassEntities): SunTimes {
  const a = all['sun.sun']?.attributes;
  const date = (v: unknown) => {
    const d = typeof v === 'string' ? new Date(v) : undefined;
    return d && !Number.isNaN(d.getTime()) ? d : undefined;
  };
  return { rising: date(a?.next_rising), setting: date(a?.next_setting) };
}

export type TimeOfDay = 'day' | 'twilight' | 'night';

/** Tageszeit aus der Sonnenhöhe (sun.sun), ersatzweise aus der Uhrzeit. */
export function timeOfDay(all: HassEntities, now = new Date()): TimeOfDay {
  const elevation = Number(all['sun.sun']?.attributes.elevation);
  if (Number.isFinite(elevation)) return elevation > 6 ? 'day' : elevation > -6 ? 'twilight' : 'night';
  const h = now.getHours();
  return h >= 8 && h < 18 ? 'day' : h >= 6 && h < 20 ? 'twilight' : 'night';
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

/** Außenwerte: Messstation, wo vorhanden, sonst der Wetterbericht. */
export function resolveOutdoor(all: HassEntities, station: StationConfig = {}, weatherId?: string) {
  const w = entity(all, weatherId);
  const dirEntity = entity(all, station.wind_direction);
  const dir = windDirection(dirEntity && !UNAVAILABLE.has(dirEntity.state) ? dirEntity.state : w?.attributes.wind_bearing);
  return {
    temperature: reading(entity(all, station.temperature), weatherAttr(w, 'temperature', '°C')),
    humidity: reading(entity(all, station.humidity), weatherAttr(w, 'humidity', '%')),
    rain: reading(entity(all, station.rain)),
    rainToday: reading(entity(all, station.rain_today)),
    windSpeed: reading(entity(all, station.wind_speed), weatherAttr(w, 'wind_speed', 'km/h')),
    windLabel: dir?.label,
    windDegrees: dir?.degrees,
    apparent: weatherAttr(w, 'apparent_temperature', '°C'),
  };
}

export function resolveIndoor(all: HassEntities, cfg: IndoorConfig = {}) {
  return {
    temperature: reading(entity(all, cfg.temperature)),
    humidity: reading(entity(all, cfg.humidity)),
    co2: reading(entity(all, cfg.co2)),
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

export function resolveWarnings(all: HassEntities, ids: string[] = []): Warning[] {
  const out: Warning[] = [];
  for (const id of ids) {
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

export interface Pollen {
  name: string;
  today: number;
  tomorrow: number;
  inTwoDays: number;
  description: string;
}

const POLLEN_NAMES: Record<string, string> = { Graeser: 'Gräser', Beifuss: 'Beifuß' };

export function resolvePollen(all: HassEntities, ids: string[] = []): Pollen[] {
  const out: Pollen[] = [];
  for (const id of ids) {
    const e = all[id];
    if (!e) continue;
    const raw = /Pollenflug\s+(.+?)(\s+\d+)?$/.exec(String(e.attributes.friendly_name ?? ''))?.[1] ?? id.split('.')[1];
    out.push({
      name: POLLEN_NAMES[raw] ?? raw,
      today: num(e) ?? 0,
      tomorrow: Number(e.attributes.state_tomorrow ?? 0),
      inTwoDays: Number(e.attributes.state_in_2_days ?? 0),
      description: String(e.attributes.state_today_desc ?? ''),
    });
  }
  return out.sort((a, b) => b.today - a.today || b.tomorrow - a.tomorrow || a.name.localeCompare(b.name, 'de'));
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
