import { useEffect, useState } from 'preact/hooks';
import {
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  ERR_INVALID_AUTH,
  type Connection,
  type HassEntities,
} from 'home-assistant-js-websocket';
import type { Credentials } from './config';

export type Status = 'connecting' | 'ready' | 'disconnected' | 'error';

export interface HassState {
  status: Status;
  error?: string;
  connection?: Connection;
  entities: HassEntities;
}

export function useHass(creds: Credentials): HassState {
  const [state, setState] = useState<HassState>({ status: 'connecting', entities: {} });

  useEffect(() => {
    let conn: Connection | undefined;
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const auth = createLongLivedTokenAuth(creds.url, creds.token);
        conn = await createConnection({ auth });
        if (cancelled) return conn.close();
        conn.addEventListener('ready', () => setState((s) => ({ ...s, status: 'ready' })));
        conn.addEventListener('disconnected', () => setState((s) => ({ ...s, status: 'disconnected' })));
        unsub = subscribeEntities(conn, (entities) =>
          setState({ status: 'ready', connection: conn, entities }),
        );
      } catch (e) {
        if (cancelled) return;
        const error = e === ERR_INVALID_AUTH ? 'Token ungültig' : 'Verbindung zu Home Assistant fehlgeschlagen';
        setState({ status: 'error', error, entities: {} });
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
      conn?.close();
    };
  }, [creds.url, creds.token]);

  return state;
}

export interface ForecastDay {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation?: number;
  precipitation_probability?: number;
}

export function useDailyForecast(connection: Connection | undefined, entityId: string): ForecastDay[] {
  const [forecast, setForecast] = useState<ForecastDay[]>([]);

  useEffect(() => {
    if (!connection) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    connection
      .subscribeMessage<{ forecast: ForecastDay[] }>((msg) => setForecast(msg.forecast ?? []), {
        type: 'weather/subscribe_forecast',
        forecast_type: 'daily',
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
  }, [connection, entityId]);

  return forecast;
}
