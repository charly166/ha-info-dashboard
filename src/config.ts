/**
 * Zuordnung der Messgrößen zu Home-Assistant-Entitäten.
 * Für eine andere Wetterstation (z. B. Ecowitt) genügt es, hier die Entity-IDs zu tauschen.
 */
export const entities = {
  /** DWD-Wetter: Prognose und Fallback für fehlende Messwerte */
  weather: 'weather.kirchheim_teck',
  /** DWD-Warnsensoren (Attribute warning_1 … warning_n) */
  warnings: ['sensor.stadt_wendlingen_am_neckar_aktuelle_warnstufe'],
  indoor: {
    temperature: 'sensor.wetterstation_temperatur',
    humidity: 'sensor.wetterstation_luftfeuchtigkeit',
    co2: 'sensor.wetterstation_kohlendioxid',
  },
  outdoor: {
    temperature: 'sensor.wetterstation_outdoor_temperatur',
    humidity: 'sensor.wetterstation_outdoor_luftfeuchtigkeit',
    rain: 'sensor.wetterstation_regenmesser_niederschlagsmenge',
    rainToday: 'sensor.wetterstation_regenmesser_niederschlagsmenge_heute',
    windSpeed: 'sensor.wetterstation_windmesser_windgeschwindigkeit',
    windDirection: 'sensor.wetterstation_windmesser_windrichtung',
  },
};

const URL_KEY = 'hid.url';
const TOKEN_KEY = 'hid.token';

export interface Credentials {
  url: string;
  token: string;
}

export function loadCredentials(): Credentials | null {
  try {
    const url = localStorage.getItem(URL_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    return url && token ? { url, token } : null;
  } catch {
    return null;
  }
}

export function saveCredentials(c: Credentials) {
  try {
    localStorage.setItem(URL_KEY, c.url);
    localStorage.setItem(TOKEN_KEY, c.token);
  } catch {
    /* Speicher gesperrt: Zugangsdaten gelten nur für diese Sitzung */
  }
}

export function clearCredentials() {
  try {
    localStorage.removeItem(URL_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignorieren */
  }
}
