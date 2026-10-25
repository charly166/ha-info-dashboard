/** Kleine Mülltonne in der Farbe der Abfallart. */
export function BinIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M5.5 8.5h13l-1.2 12a1.5 1.5 0 0 1-1.5 1.3H8.2a1.5 1.5 0 0 1-1.5-1.3z" fill={color} stroke="rgba(0,0,0,0.35)" stroke-width="0.8" />
      <rect x="3.5" y="5" width="17" height="3.6" rx="1.4" fill={color} stroke="rgba(0,0,0,0.35)" stroke-width="0.8" />
      <rect x="3.5" y="5" width="17" height="3.6" rx="1.4" fill="rgba(255,255,255,0.25)" />
      <rect x="9.5" y="2.6" width="5" height="2.4" rx="1" fill={color} stroke="rgba(0,0,0,0.35)" stroke-width="0.8" />
      <path d="M9.5 11.5v7M12 11.5v7M14.5 11.5v7" stroke="rgba(0,0,0,0.3)" stroke-width="1" stroke-linecap="round" />
    </svg>
  );
}
