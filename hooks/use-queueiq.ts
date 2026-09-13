'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  createClient,
  getApiBase,
  type Client,
  type Health,
  type LogEntry,
  type ModelSummary,
  type Snapshot,
} from '@/lib/api';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

const noopSubscribe = () => () => {};

export type QueueIQState = {
  base: string;
  status: ConnectionStatus;
  health: Health | null;
  snapshot: Snapshot | null;
  receivedAt: number;
  model: ModelSummary | null;
  log: LogEntry[];
  lastError: string;
};

/**
 * Subscribes to the vision server's Server-Sent Events stream and keeps a
 * local mirror of lanes, model parameters and the activity log. Reconnects
 * automatically; `status` flips to `offline` while the server is unreachable.
 */
export function useQueueIQ(baseOverride?: string) {
  // The API address depends on the browser (?api=, a saved override, the page
  // host), so it is unknown while the page is server-rendered. The server
  // snapshot is '' and the real address arrives on the first client render,
  // which keeps the server HTML and hydration identical (React error #418).
  const resolvedBase = useSyncExternalStore(
    noopSubscribe,
    getApiBase,
    () => '',
  );
  const [override, setOverride] = useState<string | null>(baseOverride ?? null);
  const base = override ?? resolvedBase;
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [health, setHealth] = useState<Health | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  // Local clock (s) at which `snapshot` arrived, for client-side countdowns.
  const [receivedAt, setReceivedAt] = useState(0);
  const [model, setModel] = useState<ModelSummary | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [lastError, setLastError] = useState('');
  const clientRef = useRef<Client>(createClient(base));

  useEffect(() => {
    if (!base) return; // still hydrating: the address is not known yet
    clientRef.current = createClient(base);
    let closed = false;
    const es = new EventSource(`${base}/api/events`);
    es.addEventListener('snapshot', (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setHealth(d.health);
      setSnapshot(d.lanes);
      setReceivedAt(Date.now() / 1000);
      setModel(d.model);
      setLog(d.log ?? []);
      setStatus('online');
      setLastError('');
    });
    es.addEventListener('lanes', (e) => {
      setSnapshot(JSON.parse((e as MessageEvent).data));
      setReceivedAt(Date.now() / 1000);
    });
    es.addEventListener('model', (e) =>
      setModel(JSON.parse((e as MessageEvent).data)),
    );
    es.addEventListener('log', (e) =>
      setLog((l) => [JSON.parse((e as MessageEvent).data), ...l].slice(0, 60)),
    );
    es.onerror = () => {
      if (!closed) setStatus('offline');
    };
    const healthTimer = setInterval(() => {
      clientRef.current
        .health()
        .then(setHealth)
        .catch(() => {});
    }, 15000);
    return () => {
      closed = true;
      es.close();
      clearInterval(healthTimer);
    };
  }, [base]);

  const run = useCallback(
    async <T>(fn: (c: Client) => Promise<T>): Promise<T | null> => {
      try {
        const out = await fn(clientRef.current);
        setLastError('');
        return out;
      } catch (e) {
        setLastError((e as Error).message || 'Request failed');
        return null;
      }
    },
    [],
  );

  return {
    state: {
      base,
      status,
      health,
      snapshot,
      receivedAt,
      model,
      log,
      lastError,
    } as QueueIQState,
    setBase: (b: string) => {
      setStatus('connecting');
      setOverride(b);
    },
    run,
    clearError: () => setLastError(''),
  };
}
