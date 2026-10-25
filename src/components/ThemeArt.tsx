/** Themenbezogene Hintergründe der Kalender-Karten; statisch, damit sie auf jedem Gerät sparsam bleiben. */

export type Theme = 'birthdays' | 'waste' | 'parcels' | 'league';

const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const FLAG_COLORS = ['#ffd23f', '#3bceac', '#ff6b6b', '#6ec6ff', '#ffffff', '#ff9ff3'];
const CONFETTI_COLORS = ['#ffd23f', '#3bceac', '#ff6b6b', '#6ec6ff', '#ffffff', '#ff9ff3'];

/** Wimpelkette „HAPPY BIRTHDAY“ entlang einer durchhängenden Schnur. */
function Garland() {
  const letters = 'HAPPY BIRTHDAY'.split('');
  const p0 = [0, 10];
  const p1 = [160, 58];
  const p2 = [320, 10];
  const point = (t: number) => {
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  };
  const angle = (t: number) => {
    const u = 1 - t;
    const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };
  return (
    <g>
      <path d={`M${p0} Q${p1} ${p2}`} fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1.5" />
      {letters.map((ch, i) => {
        const t = (i + 0.5) / letters.length;
        const [x, y] = point(t);
        const flag = FLAG_COLORS[i % FLAG_COLORS.length];
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${angle(t)})`}>
            {ch === ' ' ? (
              <circle cx="0" cy="5" r="5" fill="#ff6b6b" />
            ) : (
              <>
                <path d="M-10 0 L10 0 L0 28 Z" fill={flag} />
                <text x="0" y="11" text-anchor="middle" font-size="12" font-weight="700" font-family="system-ui, sans-serif" fill="#2d1b5e">
                  {ch}
                </text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

function Birthdays() {
  return (
    <>
      <svg class="art" viewBox="0 0 320 400" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
        {range(26).map((i) => {
          const x = rnd(i, 1) * 316;
          const y = 92 + rnd(i, 2) * 300;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={4 + rnd(i, 3) * 4}
              height={7 + rnd(i, 4) * 4}
              rx="1"
              fill={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
              opacity="0.75"
              transform={`rotate(${rnd(i, 5) * 180} ${x} ${y})`}
            />
          );
        })}
      </svg>
      <svg class="art art-top" viewBox="0 0 320 90" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
        <Garland />
      </svg>
    </>
  );
}

function Waste() {
  return (
    <svg class="art art-bottom-wide" viewBox="0 0 320 84" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
      {/* Straße */}
      <rect x="0" y="64" width="320" height="20" fill="#3b4048" />
      {range(8).map((i) => (
        <rect key={i} x={10 + i * 42} y="73" width="22" height="3" rx="1.5" fill="#f5d76e" />
      ))}
      {/* Müllwagen: Aufbau, Presse, Fahrerhaus, Räder */}
      <rect x="150" y="22" width="92" height="38" rx="5" fill="#2e8b57" />
      <rect x="150" y="22" width="14" height="38" rx="3" fill="#256f46" />
      <rect x="172" y="30" width="58" height="4" rx="2" fill="#256f46" opacity="0.7" />
      <rect x="172" y="40" width="58" height="4" rx="2" fill="#256f46" opacity="0.7" />
      <path d="M242 60 V34 Q242 30 246 30 H262 L276 44 V60 Z" fill="#f4f4f0" />
      <path d="M254 35 H262 L270 44 H254 Z" fill="#8fd3ff" />
      <rect x="244" y="52" width="32" height="4" fill="#d9d9d3" />
      {[172, 258].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="62" r="9" fill="#1e2126" />
          <circle cx={cx} cy="62" r="4" fill="#9aa0a8" />
        </g>
      ))}
      {/* Tonne am Straßenrand */}
      <rect x="112" y="40" width="22" height="24" rx="3" fill="#6c757d" />
      <rect x="109" y="36" width="28" height="6" rx="2" fill="#495057" />
    </svg>
  );
}

function Box({ x, y, w, h, rotate = 0 }: { x: number; y: number; w: number; h: number; rotate?: number }) {
  return (
    <g transform={`rotate(${rotate} ${x + w / 2} ${y + h})`}>
      <rect x={x} y={y} width={w} height={h} rx="2" fill="#d9a566" stroke="#a9763f" stroke-width="1.5" />
      <rect x={x + w / 2 - 5} y={y} width="10" height={h} fill="#f1e0b8" opacity="0.9" />
      <rect x={x + 5} y={y + h - 11} width="16" height="7" rx="1" fill="#fff" opacity="0.85" />
    </g>
  );
}

function Parcels() {
  return (
    <svg class="art art-bottom-wide" viewBox="0 0 320 84" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
      <rect x="150" y="76" width="170" height="6" rx="3" fill="rgba(0,0,0,0.25)" />
      <Box x={170} y={30} w={70} h={46} />
      <Box x={246} y={44} w={58} h={32} />
      <Box x={184} y={6} w={44} h={24} rotate={-6} />
    </svg>
  );
}

function League() {
  return (
    <>
      <svg class="art" viewBox="0 0 320 400" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
        <g fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2">
          <line x1="0" y1="1" x2="320" y2="1" />
          <circle cx="160" cy="1" r="46" />
          <line x1="14" y1="0" x2="14" y2="400" />
        </g>
        <circle cx="160" cy="1" r="3" fill="rgba(255,255,255,0.6)" />
      </svg>
      <svg class="art art-bottom" viewBox="0 0 80 80" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
        <path d="M14 80 A40 40 0 0 0 54 40" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2" />
        <line x1="14" y1="80" x2="14" y2="44" stroke="#f5f5f5" stroke-width="2" />
        <path d="M14 44 L30 50 L14 56 Z" fill="#ff5252" />
      </svg>
    </>
  );
}

export function ThemeArt({ theme }: { theme: Theme }) {
  switch (theme) {
    case 'birthdays':
      return <Birthdays />;
    case 'waste':
      return <Waste />;
    case 'parcels':
      return <Parcels />;
    case 'league':
      return <League />;
  }
}
