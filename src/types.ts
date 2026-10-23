/** Konfiguration, die die Integration per WebSocket liefert. */

export type BlockType = 'weather_report' | 'weather_station' | 'indoor' | 'warnings' | 'pollen';

export interface Block {
  id: string;
  type: BlockType;
  group: string;
  title: string;
  data: Record<string, unknown>;
}

export interface DashboardSettings {
  /** on: immer, auto: folgt „Bewegung reduzieren“, off: nie */
  animation: 'on' | 'auto' | 'off';
}

export interface DashboardConfig {
  configured: boolean;
  blocks: Block[];
  settings?: DashboardSettings;
}

export interface StationConfig {
  temperature?: string;
  humidity?: string;
  rain?: string;
  rain_today?: string;
  wind_speed?: string;
  wind_direction?: string;
}

export interface IndoorConfig {
  temperature?: string;
  humidity?: string;
  co2?: string;
}
