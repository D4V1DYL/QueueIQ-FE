import assert from 'node:assert/strict';
import {
  absolute,
  chartSeries,
  duration,
  fullnessLabel,
  normalizeBase,
  signalLabel,
  tierLabel,
  type LearningRecord,
} from '../lib/api.ts';

// API base normalisation: scheme added, trailing slashes removed, blank → default.
assert.equal(normalizeBase('192.168.1.10:8000/'), 'http://192.168.1.10:8000');
assert.equal(normalizeBase('https://vision.local///'), 'https://vision.local');
assert.equal(normalizeBase('   '), 'http://127.0.0.1:8000');

// Server-relative frame URLs resolve against the base; absolute URLs pass through.
assert.equal(
  absolute('http://h:8000', '/api/lanes/1/frame.jpg?v=3'),
  'http://h:8000/api/lanes/1/frame.jpg?v=3',
);
assert.equal(absolute('http://h:8000', 'http://x/y.jpg'), 'http://x/y.jpg');
assert.equal(absolute('http://h:8000', null), null);

// Wait-time formatting.
assert.equal(duration(0), '0:00');
assert.equal(duration(133.2), '2:14');
assert.equal(duration(412.8), '6:53');

// Labels mirror the server's signal vocabulary (green/amber/red/closed).
assert.equal(signalLabel('closed'), 'Offline');
assert.equal(signalLabel('green', true), 'Recommended');
assert.equal(signalLabel('green'), 'Short wait');
assert.equal(signalLabel('amber'), 'Moderate wait');
assert.equal(signalLabel('red'), 'Long wait');
assert.equal(fullnessLabel('no_basket_with_items'), 'hand-carried');
assert.equal(fullnessLabel('full'), 'full');
assert.equal(tierLabel(undefined), 'OFFLINE');
assert.match(tierLabel('heuristic'), /HEURISTIC/);
assert.match(tierLabel('mock'), /MOCK/);

// Chart downsampling keeps the first and last learning records.
const history: LearningRecord[] = Array.from({ length: 500 }, (_, i) => ({
  n: i + 1,
  item_count: 5,
  predicted_sec: 50,
  actual_sec: 55,
  abs_pct_error: 9,
  rolling_accuracy: 91,
  source: i < 120 ? 'synthetic' : 'live',
  intercept: 20,
  slope: 7,
}));
const series = chartSeries(history, 100);
assert.ok(series.length <= 101 && series.length >= 100);
assert.equal(series[0].n, 1);
assert.equal(series[series.length - 1].n, 500);
assert.deepEqual(chartSeries(history.slice(0, 10)), history.slice(0, 10));

console.log(
  'PASS: API base normalisation, frame URL resolution, duration/label formatting, chart downsampling.',
);

// Client-side countdown: front shopper's remaining time follows the server clock,
// lane signal and recommendation are re-derived, and nothing goes negative.
{
  const { deriveSnapshot } = await import('../lib/api.ts');
  const shopper = (id: string, est: number) => ({
    id,
    fullness: 'medium' as const,
    confidence: 0.8,
    est_items: 10,
    est_sec: est,
    remaining_sec: est,
    source: 'scenario' as const,
    person_box: null,
    crop_box: null,
    detail: {},
    position: 1,
  });
  const lane = (
    id: number,
    open: boolean,
    ests: number[],
    started: number | null,
  ) => ({
    id,
    name: `Lane 0${id}`,
    open,
    wait_sec: ests.reduce((a, b) => a + b, 0),
    signal: 'green' as const,
    shoppers: ests.map((e, i) => shopper(`${id}-${i}`, e)),
    n_shoppers: ests.length,
    total_items: 10 * ests.length,
    avg_fullness: 2,
    root_cause: `cause ${id}`,
    last_analyzed_at: null,
    front_started_at: started,
    frame_url: null,
    n_detected_total: null,
    inference_ms: null,
    completed: 0,
    video_source: null,
  });
  const snap = {
    ts: 1000,
    tier: 'mock' as const,
    lanes: [
      lane(1, true, [100, 100], 1000),
      lane(2, true, [130], 1000),
      lane(3, false, [], null),
    ],
    recommendation: {
      lane_id: null,
      lane_name: null,
      wait_sec: null,
      reason: '',
    },
    totals: { shoppers: 3, items: 30, completed: 0 },
  };
  const t0 = deriveSnapshot(snap, 1000);
  assert.equal(t0.lanes[0].wait_sec, 200);
  assert.equal(t0.lanes[0].signal, 'amber');
  assert.equal(t0.lanes[1].signal, 'amber');
  assert.equal(t0.lanes[2].signal, 'closed');
  assert.equal(t0.recommendation.lane_id, 2);
  assert.equal(t0.recommendation.reason, 'cause 2');
  const t90 = deriveSnapshot(snap, 1090);
  assert.equal(t90.lanes[0].shoppers[0].remaining_sec, 10);
  assert.equal(t90.lanes[0].shoppers[1].remaining_sec, 100);
  assert.equal(t90.lanes[0].wait_sec, 110);
  assert.equal(t90.lanes[0].signal, 'green');
  assert.equal(t90.lanes[1].wait_sec, 40);
  assert.equal(t90.recommendation.lane_id, 2);
  const late = deriveSnapshot(snap, 5000);
  assert.equal(late.lanes[0].shoppers[0].remaining_sec, 0);
  assert.equal(late.lanes[0].wait_sec, 100);
  assert.equal(
    deriveSnapshot({ ...snap, lanes: [lane(3, false, [], null)] }, 1000)
      .recommendation.lane_id,
    null,
  );
  console.log('PASS: client-side countdown derivation.');
}

// Default API base follows the host that served the page, so a LAN demo needs
// no configuration; the loopback fallback is only for non-browser contexts.
{
  const { defaultApiBase, API_PORT } = await import('../lib/api.ts');
  assert.equal(API_PORT, 8000);
  assert.equal(
    defaultApiBase({ protocol: 'http:', hostname: '192.168.1.3' }),
    'http://192.168.1.3:8000',
  );
  assert.equal(
    defaultApiBase({ protocol: 'http:', hostname: 'localhost' }),
    'http://localhost:8000',
  );
  assert.equal(
    defaultApiBase({ protocol: 'https:', hostname: 'queueiq.example' }),
    'https://queueiq.example:8000',
  );
  assert.equal(
    defaultApiBase({ protocol: 'file:', hostname: '' }),
    'http://127.0.0.1:8000',
  );
  console.log('PASS: same-host API base resolution.');
}
