import { useEffect, useState } from 'preact/hooks';
import type { Connection } from 'home-assistant-js-websocket';
import type { DashboardConfig } from './types';

const DOMAIN = 'ha_info_dashboard';

/** Konfiguration der Integration; wird bei jeder Änderung neu geliefert. */
export function useDashboardConfig(connection: Connection | undefined): DashboardConfig | undefined {
  const [config, setConfig] = useState<DashboardConfig>();

  useEffect(() => {
    if (!connection) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    connection
      .subscribeMessage<DashboardConfig>(setConfig, { type: `${DOMAIN}/subscribe_config` })
      .then((u) => {
        if (cancelled) u();
        else unsub = u;
      })
      .catch(() => setConfig({ configured: false, blocks: [] }));
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [connection]);

  return config;
}

export interface ForecastDay {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation?: number;
  precipitation_probability?: number;
}

export type ForecastType = 'daily' | 'hourly';

export function useForecast(
  connection: Connection | undefined,
  entityId: string | undefined,
  type: ForecastType = 'daily',
): ForecastDay[] {
  const [forecast, setForecast] = useState<ForecastDay[]>([]);

  useEffect(() => {
    if (!connection || !entityId) {
      setForecast([]);
      return;
    }
    let unsub: (() => void) | undefined;
    let cancelled = false;
    connection
      .subscribeMessage<{ forecast: ForecastDay[] }>((msg) => setForecast(msg.forecast ?? []), {
        type: 'weather/subscribe_forecast',
        forecast_type: type,
        entity_id: entityId,
      })
      .then((u) => {
        if (cancelled) u();
        else unsub = u;
      })
      .catch(() => setForecast([]));
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [connection, entityId, type]);

  return forecast;
}

export const useDailyForecast = (c: Connection | undefined, id: string | undefined) => useForecast(c, id, 'daily');
