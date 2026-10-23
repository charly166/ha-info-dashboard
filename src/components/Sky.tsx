import type { TimeOfDay } from '../weather';

export type Kind = 'clear' | 'partly' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';

const KINDS: Record<string, Kind> = {
  sunny: 'clear',
  'clear-night': 'clear',
  partlycloudy: 'partly',
  windy: 'partly',
  cloudy: 'cloudy',
  'windy-variant': 'cloudy',
  exceptional: 'cloudy',
  rainy: 'rain',
  pouring: 'rain',
  lightning: 'storm',
  'lightning-rainy': 'storm',
  snowy: 'snow',
  'snowy-rainy': 'snow',
  hail: 'snow',
  fog: 'fog',
};

export const kindOf = (condition?: string): Kind => KINDS[condition ?? ''] ?? 'partly';

const PALETTE: Record<TimeOfDay, Record<Kind, [string, string]>> = {
  day: {
    clear: ['#2f7fd6', '#8cc8f5'],
    partly: ['#4a8cd0', '#9ccbea'],
    cloudy: ['#6f7f8f', '#aab6c1'],
    rain: ['#4e5b69', '#7b8895'],
    storm: ['#2f3744', '#566274'],
    snow: ['#7f93a8', '#c3cfda'],
    fog: ['#8b979f', '#c5ccd1'],
  },
  twilight: {
    clear: ['#3b4a8c', '#f2a15f'],
    partly: ['#4b4f86', '#e5a578'],
    cloudy: ['#555b78', '#b69a98'],
    rain: ['#3f4660', '#8a8798'],
    storm: ['#2a2e45', '#5b5870'],
    snow: ['#5f6b8a', '#c4b4be'],
    fog: ['#6c7287', '#bdb5b9'],
  },
  night: {
    clear: ['#0a1635', '#1f3566'],
    partly: ['#101c3a', '#2b3f6b'],
    cloudy: ['#1b2433', '#35425a'],
    rain: ['#141a26', '#2a3446'],
    storm: ['#0f131c', '#272f40'],
    snow: ['#222c3e', '#4a5a74'],
    fog: ['#2a3340', '#4b5666'],
  },
};

const CLOUDS: Record<Kind, number> = { clear: 0, partly: 2, cloudy: 5, rain: 5, storm: 5, snow: 4, fog: 0 };
const DROPS: Partial<Record<Kind, number>> = { rain: 45, storm: 60 };
const FLAKES: Partial<Record<Kind, number>> = { snow: 36 };

/** Gleichbleibende Pseudo-Zufallszahl, damit Animationen bei Updates nicht neu starten. */
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Animierter Himmel: Farbverlauf, Sonne/Mond/Sterne, Wolken, Regen, Schnee, Nebel, Blitze. */
export function Sky({ kind, tod, children }: { kind: Kind; tod: TimeOfDay; children?: preact.ComponentChildren }) {
  const [a, b] = PALETTE[tod][kind];
  const showBody = kind === 'clear' || kind === 'partly';
  const showStars = tod !== 'day' && (kind === 'clear' || kind === 'partly');
  const dark = kind === 'rain' || kind === 'storm';

  return (
    <div class={`sky ${tod} ${kind}`} style={{ background: `linear-gradient(180deg, ${a}, ${b})` }}>
      <div class="sky-layer" aria-hidden="true">
        {showStars &&
          range(28).map((i) => (
            <i
              key={`s${i}`}
              class="star"
              style={{
                left: `${rnd(i, 1) * 100}%`,
                top: `${rnd(i, 2) * 55}%`,
                animationDelay: `${rnd(i, 3) * 4}s`,
                opacity: tod === 'twilight' ? 0.5 : 1,
              }}
            />
          ))}

        {showBody && (tod === 'night' ? <i class="moon" /> : <i class="sun" />)}

        {range(CLOUDS[kind]).map((i) => (
          <i
            key={`c${i}`}
            class={`cloud ${dark ? 'dark' : ''}`}
            style={{
              top: `${4 + rnd(i, 4) * 38}%`,
              width: `${120 + rnd(i, 5) * 120}px`,
              height: `${34 + rnd(i, 6) * 26}px`,
              animationDuration: `${50 + rnd(i, 7) * 50}s`,
              animationDelay: `-${rnd(i, 8) * 80}s`,
              opacity: kind === 'partly' ? 0.75 : 0.6 + rnd(i, 9) * 0.3,
            }}
          />
        ))}

        {range(DROPS[kind] ?? 0).map((i) => (
          <i
            key={`r${i}`}
            class="drop"
            style={{
              left: `${rnd(i, 10) * 100}%`,
              animationDuration: `${0.55 + rnd(i, 11) * 0.45}s`,
              animationDelay: `-${rnd(i, 12) * 2}s`,
            }}
          />
        ))}

        {range(FLAKES[kind] ?? 0).map((i) => (
          <i
            key={`f${i}`}
            class="flake"
            style={{
              left: `${rnd(i, 13) * 100}%`,
              width: `${3 + rnd(i, 14) * 4}px`,
              height: `${3 + rnd(i, 14) * 4}px`,
              animationDuration: `${6 + rnd(i, 15) * 6}s`,
              animationDelay: `-${rnd(i, 16) * 12}s`,
            }}
          />
        ))}

        {kind === 'fog' && (
          <>
            <i class="fog-band" style={{ top: '30%' }} />
            <i class="fog-band slow" style={{ top: '55%' }} />
          </>
        )}

        {kind === 'storm' && <i class="flash" />}
      </div>
      <div class="sky-content">{children}</div>
    </div>
  );
}
