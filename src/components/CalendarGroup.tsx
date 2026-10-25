import type { Connection, HassEntities } from 'home-assistant-js-websocket';
import { useCalendarEvents } from '../ha';
import type { Block } from '../types';
import { ThemeArt, type Theme } from './ThemeArt';
import { carrierLabel, dayLabel, etaLabel, occurrences, parcelsOf, wasteIcon } from '../calendar';

const time = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Karte mit Überschrift und themenbezogenem Hintergrund. */
function Card({
  theme,
  title,
  note,
  children,
}: {
  theme: Theme;
  title: string;
  note?: string;
  children: preact.ComponentChildren;
}) {
  return (
    <section class={`card info-card themed theme-${theme}`}>
      <ThemeArt theme={theme} />
      <div class="card-body">
        <h2>{title}</h2>
        {children}
        {note && <p class="card-note">{note}</p>}
      </div>
    </section>
  );
}

function Birthdays({ entities, connection }: { entities: string[]; connection?: Connection }) {
  const items = occurrences(useCalendarEvents(connection, entities, 3));
  if (items.length === 0) return null;
  return (
    <Card theme="birthdays" title="Geburtstage">
      <ul class="rows">
        {items.map((o) => (
          <li key={`${o.date.getTime()}${o.summary}`}>
            <span class="row-icon" aria-hidden="true">🎂</span>
            <span class="row-main">{o.summary}</span>
            <span class="row-side">{dayLabel(o.date)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Waste({ entities, connection }: { entities: string[]; connection?: Connection }) {
  const items = occurrences(useCalendarEvents(connection, entities, 7));
  if (items.length === 0) return null;
  return (
    <Card theme="waste" title="Müllabfuhr">
      <ul class="rows">
        {items.map((o) => (
          <li key={`${o.date.getTime()}${o.summary}`}>
            <span class="row-icon" aria-hidden="true">{wasteIcon(o.summary)}</span>
            <span class="row-main">{o.summary}</span>
            <span class="row-side">{dayLabel(o.date)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Parcels({ data, entities }: { data: Record<string, unknown>; entities: HassEntities }) {
  const open = parcelsOf(entities, data.open as string | undefined);
  const delivered = parcelsOf(entities, data.delivered as string | undefined);
  // Ein Paket, das schon als zugestellt gilt, soll nicht zusätzlich als offen erscheinen.
  const deliveredNumbers = new Set(delivered.map((p) => p.number));
  const pending = open.filter((p) => !deliveredNumbers.has(p.number));
  if (pending.length === 0 && delivered.length === 0) return null;
  return (
    <Card theme="parcels" title="Pakete" note="Daten: Paket Tracker (HACS)">
      <ul class="rows">
        {pending.map((p) => (
          <li key={p.number}>
            <span class="row-icon" aria-hidden="true">📦</span>
            <span class="row-main">
              {p.name}
              <small> {carrierLabel(p.carrier)}</small>
            </span>
            <span class="row-side">{etaLabel(p) || 'unterwegs'}</span>
          </li>
        ))}
        {delivered.map((p) => (
          <li key={p.number} class="done">
            <span class="row-icon" aria-hidden="true">✅</span>
            <span class="row-main">
              {p.name}
              <small> {carrierLabel(p.carrier)}</small>
            </span>
            <span class="row-side">zugestellt</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface LeagueMatch {
  home: string;
  home_short?: string;
  home_logo?: string;
  away: string;
  away_short?: string;
  away_logo?: string;
  score: [number, number] | null;
  kickoff: string;
  finished: boolean;
  live?: boolean;
}

interface LeagueOverview {
  competition?: { name: string; logo?: string };
  next?: { name: string; matches: LeagueMatch[] } | null;
}

function Team({ name, logo }: { name: string; logo?: string }) {
  return (
    <span class="team">
      {logo && <img src={logo} alt="" loading="lazy" />}
      <span>{name}</span>
    </span>
  );
}

function League({ id, entities }: { id: string; entities: HassEntities }) {
  const data = entities[id]?.attributes as LeagueOverview | undefined;
  const day = data?.next;
  if (!day || day.matches.length === 0) return null;

  const byDay = new Map<string, LeagueMatch[]>();
  for (const m of [...day.matches].sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
    const label = dayLabel(new Date(m.kickoff));
    byDay.set(label, [...(byDay.get(label) ?? []), m]);
  }

  return (
    <Card theme="league" title={data?.competition?.name ?? 'Liga'} note="Daten: HA Liga Tracker">
      <p class="muted matchday">{day.name}</p>
      {[...byDay].map(([label, matches]) => (
        <div key={label}>
          <h3>{label}</h3>
          <ul class="rows matches">
            {matches.map((m) => (
              <li key={m.kickoff + m.home}>
                <span class="row-side kickoff">
                  {m.score && (m.finished || m.live) ? `${m.score[0]}:${m.score[1]}` : time(m.kickoff)}
                </span>
                <span class="row-main versus">
                  <Team name={m.home_short || m.home} logo={m.home_logo} />
                  <Team name={m.away_short || m.away} logo={m.away_logo} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}

export function CalendarGroup({
  blocks,
  entities,
  connection,
}: {
  blocks: Block[];
  entities: HassEntities;
  connection?: Connection;
}) {
  const kind = (k: string) => blocks.find((b) => b.data.kind === k)?.data;
  const birthdays = kind('birthdays');
  const waste = kind('waste');
  const parcels = kind('parcels');
  const league = kind('league');
  return (
    <>
      {birthdays && <Birthdays entities={birthdays.entities as string[]} connection={connection} />}
      {waste && <Waste entities={waste.entities as string[]} connection={connection} />}
      {parcels && <Parcels data={parcels} entities={entities} />}
      {league && (league.entities as string[]).map((id) => <League key={id} id={id} entities={entities} />)}
    </>
  );
}
