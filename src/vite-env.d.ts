/// <reference types="vite/client" />

import 'preact';

declare module 'preact' {
  namespace JSX {
    interface IntrinsicElements {
      /** Menü-Schaltfläche von Home Assistant (öffnet die Seitenleiste). */
      'ha-menu-button': Record<string, unknown>;
    }
  }
}
