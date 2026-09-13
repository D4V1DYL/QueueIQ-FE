/**
 * QueueIQ Vision API client.
 *
 * Mirrors the contract served by `QueueIQ-AI/server.py`. Everything here is
 * framework-free so it can be unit-tested with plain Node.
 */
export type Signal = 'green' | 'amber' | 'red' | 'closed';
export type Tier = 'full' | 'heuristic' | 'mock';
export type Fullness =
  | 'empty'
  | 'light'
  | 'medium'
  | 'full'
  | 'no_basket_with_items';

export type Shopper = {
  id: string;
  fullness: Fullness;
  confidence: number;
  est_items: number;
  est_sec: number;
  remaining_sec: number;
  source: 'basket' | 'carry-region' | 'mock' | 'scenario';
  person_box: number[] | null;
  crop_box: number[] | null;
  detail: Record<string, unknown>;
  position: number;
};

export type Lane = {
  id: number;
  name: string;
  open: boolean;
  wait_sec: number;
  signal: Signal;
  shoppers: Shopper[];
  n_shoppers: number;
  total_items: number;
  avg_fullness: number | null;
  root_cause: string;
  last_analyzed_at: number | null;
  /** Server time (s) when the front shopper started being served. */
  front_started_at: number | null;
  frame_url: string | null;
  n_detected_total: number | null;
  inference_ms: number | null;
  completed: number;
  /** Name of the video file being played as a virtual camera, if any. */
  video_source: string | null;
};

export type VideoInfo = { name: string; size_mb: number };

export type Snapshot = {
  ts: number;
  tier: Tier;
  lanes: Lane[];
  recommendation: {
    lane_id: number | null;
    lane_name: string | null;
    wait_sec: number | null;
    reason: string;
  };
  totals: { shoppers: number; items: number; completed: number };
};

export type Health = {
  ok: boolean;
  service: string;
  version: string;
  vendor: string;
  uptime_sec: number;
  tier: Tier;
  device: string;
  models: {
    person_detector: string | null;
    basket_detector: string | null;
    fullness: string | null;
  };
  thresholds: { green_max_sec: number; amber_max_sec: number };
  avg_inference_ms: number | null;
  load_error: string | null;
};

export type LearningRecord = {
  n: number;
  item_count: number;
  predicted_sec: number;
  actual_sec: number;
  abs_pct_error: number;
  rolling_accuracy: number;
  source: 'synthetic' | 'live';
  intercept: number;
  slope: number;
};

export type ModelSummary = {
  intercept: number;
  slope: number;
  formula: string;
  n_updates: number;
  n_synthetic: number;
  n_live: number;
  accuracy_first10: number | null;
  accuracy_last10: number | null;
  history: LearningRecord[];
};

export type LogEntry = {
  id: number;
  text: string;
  kind: 'info' | 'detect' | 'learn' | 'system';
  lane_id: number | null;
  ts: number;
};

export type AnalyzeResponse = {
  result: {
    tier: Tier;
    n_person: number;
    n_detected_total: number;
    total_sec: number;
    status: Signal;
    inference_ms: number;
    detections: unknown[];
  };
  lane: Lane;
  recommendation: Snapshot['recommendation'];
};

export type CompleteResponse = {
  actual_sec: number | null;
  measured_sec: number | null;
  learned: LearningRecord | null;
  /** Set when the measured time was too short to be a real checkout. */
  skipped_reason: string | null;
  lane: Lane;
};

export const API_STORAGE_KEY = 'queueiq-api-base';
export const API_PORT = 8000;
export const DEFAULT_API_BASE = `http://127.0.0.1:${API_PORT}`;

/**
 * Where the vision server lives when nothing was configured.
 *
 * Over plain HTTP the dashboard and the API sit on the same machine on
 * different ports, so http://192.168.1.3:4173 talks to
 * http://192.168.1.3:8000 — a LAN demo needs no setup.
 *
 * Over HTTPS a direct call to port 8000 would be blocked as mixed content, so
 * the only workable shape is a reverse proxy serving both from one origin. The
 * default therefore drops the port and calls the page's own origin, which is
 * what the Caddy configuration in DEPLOY.md sets up.
 */
export function defaultApiBase(origin?: {
  protocol: string;
  hostname: string;
}): string {
  const loc =
    origin ?? (typeof window !== 'undefined' ? window.location : undefined);
  if (!loc || !loc.hostname) return DEFAULT_API_BASE;
  if (loc.protocol === 'https:') return `https://${loc.hostname}`;
  if (loc.protocol === 'http:') return `http://${loc.hostname}:${API_PORT}`;
  return DEFAULT_API_BASE;
}

/**
 * API base baked in when the dashboard is built — typically the Hugging Face
 * Space URL. Set VITE_QUEUEIQ_API (or NEXT_PUBLIC_QUEUEIQ_API) for `npm run
 * build`; empty when neither is set.
 */
export function configuredApiBase(): string {
  let value: string | undefined;
  try {
    value = import.meta.env.VITE_QUEUEIQ_API;
  } catch {}
  if (!value) {
    try {
      value = process.env.NEXT_PUBLIC_QUEUEIQ_API;
    } catch {}
  }
  return value ? normalizeBase(value) : '';
}

/**
 * Resolve the API base: ?api= in the URL → saved override → the build-time
 * VITE_QUEUEIQ_API → same host as the page. The query parameter is
 * remembered, so a demo link such as /live?api=192.168.1.50:8000 only has to
 * be opened once.
 */
export function getApiBase(): string {
  if (typeof window === 'undefined') return DEFAULT_API_BASE;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('api');
    if (fromUrl) {
      const base = normalizeBase(fromUrl);
      setApiBase(base);
      return base;
    }
  } catch {}
  try {
    const saved = window.localStorage.getItem(API_STORAGE_KEY);
    if (saved) return normalizeBase(saved);
  } catch {}
  return configuredApiBase() || defaultApiBase();
}

export function normalizeBase(url: string): string {
  let u = url.trim();
  if (!u) return DEFAULT_API_BASE;
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u.replace(/\/+$/, '');
}

export function setApiBase(url: string) {
  try {
    window.localStorage.setItem(API_STORAGE_KEY, normalizeBase(url));
  } catch {}
}

/** Resolve a server-relative resource (e.g. frame_url) against the base. */
export const absolute = (base: string, path: string | null) =>
  path ? (path.startsWith('http') ? path : `${base}${path}`) : null;

/** mm:ss formatting for wait times. */
export const duration = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.ceil(n % 60)).padStart(2, '0')}`;

export const signalLabel = (s: Signal, recommended = false) =>
  s === 'closed'
    ? 'Offline'
    : recommended
      ? 'Recommended'
      : s === 'green'
        ? 'Short wait'
        : s === 'amber'
          ? 'Moderate wait'
          : 'Long wait';

export const fullnessLabel = (f: Fullness) =>
  f === 'no_basket_with_items' ? 'hand-carried' : f;

export const tierLabel = (t: Tier | undefined) =>
  t === 'full'
    ? 'LIVE AI · YOLO + CLASSIFIER'
    : t === 'heuristic'
      ? 'LIVE AI · YOLO + CV HEURISTIC'
      : t === 'mock'
        ? 'MOCK INFERENCE'
        : 'OFFLINE';

export const tierDescription = (t: Tier | undefined) =>
  t === 'full'
    ? 'Person detection by YOLOv8 and basket fullness by the trained MobileNetV2 classifier.'
    : t === 'heuristic'
      ? 'Person detection by YOLOv8. Fullness uses an edge/colour heuristic because no trained classifier file was found on the server.'
      : t === 'mock'
        ? 'Server is running without PyTorch. Detections are deterministic placeholders so the interface can be demonstrated.'
        : 'No connection to the vision server.';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  base: string,
  path: string,
  init?: RequestInit,
  timeoutMs = 20000,
): Promise<T> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, { ...init, signal: ctrl.signal });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok)
      throw new ApiError(
        res.status,
        (body && (body.detail ?? body.message)) || `HTTP ${res.status}`,
      );
    return body as T;
  } finally {
    clearTimeout(id);
  }
}

export function createClient(base: string) {
  return {
    base,
    health: () => request<Health>(base, '/health', undefined, 4000),
    lanes: () => request<Snapshot>(base, '/api/lanes', undefined, 6000),
    model: () => request<ModelSummary>(base, '/api/model'),
    examples: () => request<string[]>(base, '/api/examples'),
    videos: () => request<VideoInfo[]>(base, '/api/videos'),
    playVideo: (laneId: number, name: string, interval_sec = 2) =>
      request<Lane>(base, `/api/lanes/${laneId}/video`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, interval_sec, loop: true }),
      }),
    stopVideo: (laneId: number) =>
      request<Lane>(base, `/api/lanes/${laneId}/video/stop`, {
        method: 'POST',
      }),
    analyzeLane(laneId: number, source: File | Blob | { example: string }) {
      const fd = new FormData();
      if ('example' in source) fd.set('example', source.example);
      else fd.set('file', source, 'frame.jpg');
      return request<AnalyzeResponse>(
        base,
        `/api/lanes/${laneId}/analyze`,
        { method: 'POST', body: fd },
        60000,
      );
    },
    complete: (laneId: number, actual_sec?: number) =>
      request<CompleteResponse>(base, `/api/lanes/${laneId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(actual_sec != null ? { actual_sec } : {}),
      }),
    setOpen: (laneId: number, open: boolean) =>
      request<Lane>(base, `/api/lanes/${laneId}/open`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ open }),
      }),
    scenario: (name: 'seed' | 'surge' | 'cctv' | 'clear') =>
      request<Snapshot>(base, '/api/demo/scenario', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      }),
    resetModel: (warm_start = true) =>
      request<ModelSummary>(base, '/api/model/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ warm_start }),
      }),
  };
}

export type Client = ReturnType<typeof createClient>;

export const DEFAULT_THRESHOLDS = { green_max_sec: 120, amber_max_sec: 240 };

export function signalFor(
  waitSec: number,
  open: boolean,
  t = DEFAULT_THRESHOLDS,
): Signal {
  if (!open) return 'closed';
  if (waitSec <= t.green_max_sec) return 'green';
  if (waitSec <= t.amber_max_sec) return 'amber';
  return 'red';
}

/**
 * Re-derive countdown-dependent fields for the current server time. The
 * server only pushes a snapshot when something changes, so the page ticks
 * this locally once per second. `nowServerSec` is the server clock estimate
 * (snapshot.ts + seconds elapsed since it was received).
 */
export function deriveSnapshot(
  s: Snapshot,
  nowServerSec: number,
  t = DEFAULT_THRESHOLDS,
): Snapshot {
  const lanes = s.lanes.map((l) => {
    const shoppers = l.shoppers.map((sh, i) => ({
      ...sh,
      remaining_sec:
        i === 0 && l.front_started_at
          ? Math.max(0, sh.est_sec - (nowServerSec - l.front_started_at))
          : sh.est_sec,
    }));
    const wait_sec = Math.round(
      shoppers.reduce((n, sh) => n + sh.remaining_sec, 0),
    );
    return { ...l, shoppers, wait_sec, signal: signalFor(wait_sec, l.open, t) };
  });
  const open = lanes.filter((l) => l.open);
  const best = open.length
    ? open.reduce((a, b) =>
        b.wait_sec < a.wait_sec || (b.wait_sec === a.wait_sec && b.id < a.id)
          ? b
          : a,
      )
    : null;
  return {
    ...s,
    lanes,
    recommendation: best
      ? {
          lane_id: best.id,
          lane_name: best.name,
          wait_sec: best.wait_sec,
          reason: best.root_cause,
        }
      : {
          lane_id: null,
          lane_name: null,
          wait_sec: null,
          reason: 'No open lanes.',
        },
  };
}

/** Downsample the learning history so the chart stays readable. */
export function chartSeries(history: LearningRecord[], maxPoints = 140) {
  if (history.length <= maxPoints) return history;
  const step = Math.ceil(history.length / maxPoints);
  const out = history.filter((_, i) => i % step === 0);
  if (out[out.length - 1] !== history[history.length - 1])
    out.push(history[history.length - 1]);
  return out;
}
