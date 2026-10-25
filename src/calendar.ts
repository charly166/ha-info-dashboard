import type { HassEntities } from 'home-assistant-js-websocket';
import type { CalendarEvent } from './ha';

const DAY = 24 * 60 * 60 * 1000;

/** Beginn des Tages in Ortszeit; reine Datumswerte (ganztägig) werden nicht als UTC gelesen. */
export function localDay(value: string): Date {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = d ? new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3])) : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export const isAllDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** „Heute“, „Morgen“, sonst Wochentag und Datum. */
export function dayLabel(date: Date, now = new Date()): string {
  const diff = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      DAY,
  );
  if (diff <= 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

export interface Occurrence {
  date: Date;
  summary: string;
  /** Uhrzeit bei Terminen mit Zeit, sonst leer */
  time: string;
}

/** Termine nach Tag sortiert; gleiche Termine mehrerer Kalender erscheinen nur einmal. */
export function occurrences(events: CalendarEvent[]): Occurrence[] {
  const seen = new Set<string>();
  const out: Occurrence[] = [];
  for (const e of events) {
    const date = localDay(e.start);
    const key = `${date.getTime()}|${e.summary.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      date,
      summary: e.summary,
      time: isAllDay(e.start)
        ? ''
        : new Date(e.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.summary.localeCompare(b.summary, 'de'));
}

/** Farbe der Tonne je Abfallart; ohne Treffer eine neutrale graue Tonne. */
const WASTE_BINS: [RegExp, string][] = [
  [/bio/i, '#8d6e63'],
  [/papier|blau/i, '#1e88e5'],
  [/gelb|wertstoff|verpackung/i, '#fdd835'],
  [/rest|schwarz|grau/i, '#546e7a'],
  [/sperr/i, '#a1887f'],
  [/grün|garten|baum/i, '#43a047'],
];

export const wasteColor = (summary: string) => WASTE_BINS.find(([re]) => re.test(summary))?.[1] ?? '#90a4ae';

export interface Parcel {
  number: string;
  name: string;
  carrier?: string;
  eta_from?: string | null;
  eta_to?: string | null;
}

const CARRIERS: Record<string, string> = { dhl: 'DHL', dpd: 'DPD', gls: 'GLS', ups: 'UPS', hermes: 'Hermes' };

export const carrierLabel = (c?: string) => (c ? (CARRIERS[c.toLowerCase()] ?? c.charAt(0).toUpperCase() + c.slice(1)) : '');

export function parcelsOf(entities: HassEntities, id?: string): Parcel[] {
  const list = id ? entities[id]?.attributes.parcels : undefined;
  return Array.isArray(list) ? (list as Parcel[]) : [];
}

/** Zustelltermin als Text, z. B. „Heute“ oder „Mo, 26.10. – Di, 27.10.“. */
export function etaLabel(p: Parcel, now = new Date()): string {
  if (!p.eta_from) return '';
  const from = new Date(p.eta_from);
  const to = p.eta_to ? new Date(p.eta_to) : from;
  const a = dayLabel(from, now);
  const b = dayLabel(to, now);
  return a === b ? a : `${a} – ${b}`;
}
