# QueueIQ — AI-Powered Smart Checkout Queue System

Frontend for basket-aware checkout guidance. The app has two pages:

- `/` — landing page explaining the idea (basket workload, not headcount) and linking to the control room.
- `/live` — **live control room**, connected to the Python vision server in `QueueIQ-AI` (YOLOv8 person detection → basket-fullness classification → online-learning wait prediction → lane signal). Shows annotated frames, per-shopper detections, the learning curve, the ESP32 light feed, and a one-click judge demo. `/dashboard` redirects here.

## Run

Node.js 22.13 or newer is required.

```sh
npm install
npm run dev
npm run build
node --experimental-strip-types tests/api.test.ts
```

Start the vision server in a second terminal (see `QueueIQ-AI/README.md`):

```sh
cd ../QueueIQ-AI
pip install -r requirements.txt -r requirements-server.txt
python server.py            # http://127.0.0.1:8000
```

The frontend defaults to `http://127.0.0.1:8000`. Override with `NEXT_PUBLIC_QUEUEIQ_API` (see `.env.example`) or from the offline panel on `/live`, which stores the URL in this browser. When you demo from a phone or a second laptop, run `python server.py --host 0.0.0.0` and point the page at the machine's LAN address; the server only accepts private-network clients.

## What the control room does

1. The page opens `GET /api/events` (Server-Sent Events). The first `snapshot` event carries health, lanes, model parameters, and the activity log; later `lanes`, `model`, and `log` events keep the page in sync. Reconnection is automatic and the header pill shows the inference tier reported by the server: `LIVE AI · YOLO + CLASSIFIER`, `LIVE AI · YOLO + CV HEURISTIC` (no trained classifier file on the server), or `MOCK INFERENCE` (server without PyTorch).
2. **Bring your own queue photo.** The vision panel is a drop zone: drag in, paste (Ctrl/Cmd+V), or choose a photo of a checkout line with shopping carts or baskets, pick the target lane with the lane pills, and it is sent to `POST /api/lanes/{id}/analyze`. The webcam (single capture or auto-capture every 4 s) and the sample gallery (`GET /api/examples`, every image in `QueueIQ-AI/examples/`) use the same path. The lane's queue is replaced by the detections; the annotated JPEG is shown in the vision panel.
3. **Sample footage** lists the videos in `QueueIQ-AI/videos/`; *Play as virtual camera* makes the server push one analyzed frame every 2 s into the selected lane through the same path as a webcam, so the whole live loop can be demonstrated without a camera or a supermarket.
4. **Done** on a lane card calls `POST /api/lanes/{id}/complete`; the server measures how long the front shopper was being served and performs one SGD step on the wait-time regressor. Measured times under 15 s are treated as demo clicks, not real checkouts, and leave the model unchanged (the notice says so). **Teach the model** does the same with an explicit number of seconds. The chart updates live and marks where synthetic warm-up ends and live feedback begins.
5. **Judge demo** buttons call `POST /api/demo/scenario`: *Seed lanes* (2 full baskets vs 3 light), *Full-basket surge* (adds a full basket to the recommended lane so the signal flips and the recommendation moves), *Sample CCTV frame* (real YOLO inference on the bundled image), and *Clear*.
6. The **Lane lights** panel mirrors `GET /api/led`, the same endpoint an ESP32 polls.

`lib/api.ts` is the typed client and contract (including the client-side countdown derivation); `hooks/use-queueiq.ts` owns the SSE subscription.

## Integration boundary

Everything on `/live` is real inference from the vision server. The trained basket-fullness classifier and the fine-tuned basket detector ship with the `QueueIQ-AI` repository; without them the server falls back to a CV heuristic and says so in the header. Predictive accuracy on real stores has not been measured; the learning chart replays synthetic checkouts as a warm start and is labelled as such. No shopper identity is used — detections are boxes and fullness classes only.

## Validation

`tests/api.test.ts` covers the API client helpers (base-URL normalisation, frame URL resolution, formatting, chart downsampling, client-side countdown derivation). Build and TypeScript checks are used. The live page was exercised against the running server end to end (seed → surge → CCTV frame → virtual camera → checkout feedback).
