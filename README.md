# QueueIQ — AI-Powered Smart Checkout Queue System

English-language frontend demonstration of overhead basket analysis, basket-aware checkout estimates, and green/amber/red lane guidance.

## Run

Node.js 22.13 or newer is required.

```sh
npm install
npm run dev
npm run build
node --experimental-strip-types tests/checkout.test.ts
```

- `/`: animated landing page with a paused/playable process diagram, lane comparison, and demo entry.
- `/dashboard`: live local simulation, basket composition map, per-lane queues, fastest-lane recommendations, add-shopper form, run/pause, advance time, lane open/close, reset and JSON export.

## What works today

The simulation persists to `localStorage` under `queueiq-checkout-v2`. Each basket has packaged, produce, and bulky item counts. A demo service-time formula assigns 4, 8, and 10 seconds respectively plus 20 seconds for payment, divided by cashier speed. A lane's wait is the sum of remaining service times ahead. Green is at most 120 seconds, amber at most 240 seconds, red above 240 seconds. Closed lanes are excluded. The simulation advances 15 seconds every 3 real seconds when running.

Estimates represent time until a new shopper reaches checkout, not their own checkout completion. Empty lanes may be opened and closed. Occupied lanes cannot close. Changes persist only in this browser; use one active simulation tab at a time.

## Integration boundary

No real camera, trained CV model, network API, or physical traffic lights are connected. The basket map is a schematic of simulated detections, not video or actual inference. Predictive accuracy has not been measured. The seed showcases why three shoppers with small baskets can be faster than two with large baskets.

`lib/checkout.ts` owns the pure simulation model. Replace dashboard initialization and `commit()` storage with an HTTP/WebSocket adapter when the backend exists. Suggested contracts (not implemented): `GET /api/lanes`, `GET /api/detections`, `GET /api/recommendation`, a `lane_updated` event stream, and an authenticated operator API for lane availability. Backend integrations should publish item categories/counts and confidence, compute calibrated service estimates, and drive hardware signal states. The camera pipeline should not rely on identifying shoppers.

## Validation

Domain tests cover workload estimates, recommendation changes, exact traffic-light thresholds, invalid baskets, closed lanes, checkout completion, and persistence round trips. Build and TypeScript checks are used. Browser visual/interaction QA has not been run. Optional WebMCP read-only recommendation support is feature-detected and has not been verified in a supported browser context.
