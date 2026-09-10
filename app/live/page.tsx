'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  Activity,
  Camera,
  CheckCheck,
  Clock3,
  Cpu,
  Info,
  Package,
  Play,
  Pause,
  RotateCcw,
  ScanLine,
  ShoppingCart,
  Sparkles,
  Upload,
  Users,
  Wifi,
  WifiOff,
  Zap,
  Brain,
  Lightbulb,
  Eraser,
  Image as ImageIcon,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from '@/components/ui/table';
import { useQueueIQ } from '@/hooks/use-queueiq';
import {
  absolute,
  chartSeries,
  deriveSnapshot,
  duration,
  fullnessLabel,
  setApiBase,
  signalLabel,
  tierDescription,
  tierLabel,
  type Lane,
} from '@/lib/api';

const AUTO_CAPTURE_MS = 4000;

export default function Live() {
  const { state, setBase, run, clearError } = useQueueIQ();
  const {
    status,
    health,
    snapshot: raw,
    receivedAt,
    model,
    log,
    lastError,
    base,
  } = state;
  // 1 Hz local clock: countdowns tick here, the server only pushes on change.
  // The clock only advances while some lane is actually serving a shopper,
  // so an idle page does not re-render every second.
  const [now, setNow] = useState(() => Date.now() / 1000);
  const countingRef = useRef(false);
  useEffect(() => {
    countingRef.current = !!raw?.lanes.some((l) => l.front_started_at);
  }, [raw]);
  useEffect(() => {
    const id = setInterval(() => {
      if (countingRef.current) setNow(Date.now() / 1000);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const snapshot = useMemo(
    () =>
      raw
        ? deriveSnapshot(raw, raw.ts + (now - receivedAt), health?.thresholds)
        : null,
    [raw, receivedAt, now, health?.thresholds],
  );
  const [selected, setSelected] = useState(1);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [baseInput, setBaseInput] = useState(base);
  const [camOn, setCamOn] = useState(false);
  const [auto, setAuto] = useState(false);
  const [actualSec, setActualSec] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [examples, setExamples] = useState<string[]>([]);

  const lanes = snapshot?.lanes ?? [];
  const lane = lanes.find((l) => l.id === selected) ?? lanes[0];
  const rec = snapshot?.recommendation;
  const fastest = rec?.lane_id ?? null;
  const online = status === 'online';
  const maxWait = Math.max(1, ...lanes.map((l) => l.wait_sec));
  const series = useMemo(
    () => (model ? chartSeries(model.history) : []),
    [model],
  );
  const firstLive = model?.history.find((h) => h.source === 'live')?.n;

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(id);
  }, [notice]);

  // Sample frames shipped with the server (drop your own photos into
  // QueueIQ-AI/examples/ and they show up here).
  useEffect(() => {
    if (!online) return;
    void run((c) => c.examples()).then((list) => setExamples(list ?? []));
  }, [online, run]);

  // ---------- bring your own photo: drag & drop / paste ----------
  const imageFile = (dt: DataTransfer | null) => {
    const f = dt?.files?.[0];
    return f && f.type.startsWith('image/') ? f : null;
  };
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = imageFile(e.dataTransfer);
    if (f) void analyze(f);
    else setNotice('Drop an image file (JPG, PNG, WEBP) of a checkout queue.');
  }
  // ---------- webcam ----------
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
    } catch (e) {
      setNotice(`Camera unavailable: ${(e as Error).message}`);
    }
  }
  function stopCamera() {
    setAuto(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }
  useEffect(
    () => () => streamRef.current?.getTracks().forEach((t) => t.stop()),
    [],
  );

  async function captureBlob(): Promise<Blob | null> {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  }

  async function analyze(source: File | Blob | { example: string }) {
    if (!lane) return;
    setBusy('analyze');
    const out = await run((c) => c.analyzeLane(lane.id, source));
    setBusy('');
    if (out)
      setNotice(
        `${out.lane.name}: ${out.result.n_person} shopper(s) → ${duration(out.result.total_sec)} wait → ${out.result.status.toUpperCase()} (${Math.round(out.result.inference_ms)} ms)`,
      );
  }

  const analyzeRef = useRef(analyze);
  useEffect(() => {
    analyzeRef.current = analyze;
  });
  // Ctrl/Cmd+V anywhere on the page analyzes a pasted screenshot/photo.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = imageFile(e.clipboardData);
      if (f) void analyzeRef.current(f);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  useEffect(() => {
    if (!auto || !camOn || !online) return;
    let cancelled = false;
    const loop = async () => {
      if (cancelled) return;
      const b = await captureBlob();
      if (b && !cancelled) await analyzeRef.current(b);
    };
    void loop();
    const id = setInterval(() => void loop(), AUTO_CAPTURE_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [auto, camOn, online]);

  async function complete(l: Lane, secs?: number) {
    setBusy(`complete-${l.id}`);
    const out = await run((c) => c.complete(l.id, secs));
    setBusy('');
    if (out) {
      setActualSec('');
      setNotice(
        out.learned
          ? `Model learned: predicted ${Math.round(out.learned.predicted_sec)}s, actual ${Math.round(out.actual_sec ?? 0)}s → now ${out.learned.intercept.toFixed(1)} + ${out.learned.slope.toFixed(2)} × items`
          : `${l.name}: shopper checked out.`,
      );
    }
  }

  async function scenario(name: 'seed' | 'surge' | 'cctv' | 'clear') {
    setBusy(name);
    const out = await run((c) => c.scenario(name));
    setBusy('');
    if (out && name === 'cctv') setSelected(1);
    if (out && name === 'surge' && rec?.lane_id) setSelected(rec.lane_id);
  }

  function applyBase() {
    setApiBase(baseInput);
    setBase(baseInput.trim().replace(/\/+$/, ''));
  }

  const frameSrc = lane ? absolute(base, lane.frame_url) : null;

  return (
    <div className="shell checkout live">
      <header className="topbar">
        <Link className="brand" href="/">
          <img src="/queueiq-logo.jpg" alt="QueueIQ logo" />
          <strong>
            Queue<span>IQ</span>
          </strong>
        </Link>
        <div className="workspace">
          Store operations <span>/</span> Live vision
        </div>
        <nav className="mode-switch" aria-label="Dashboard mode">
          <Link href="/dashboard">Simulation</Link>
          <Link href="/live" aria-current="page">
            Live AI
          </Link>
        </nav>
        <span className={'demo conn ' + status}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {status === 'online'
            ? tierLabel(health?.tier)
            : status === 'connecting'
              ? 'Connecting…'
              : 'Vision server offline'}
        </span>
        <Link className="back-link" href="/">
          About QueueIQ <ArrowUpRight size={14} />
        </Link>
      </header>
      <main>
        <div className="heading">
          <div>
            <div className="eyebrow">
              CONTROL ROOM / LIVE CHECKOUT INTELLIGENCE
            </div>
            <h1>
              Every frame becomes a decision<span>.</span>
            </h1>
            <p>
              Overhead frames → person &amp; basket detection → basket-aware
              wait prediction → lane signal. The model keeps learning from real
              checkouts.
            </p>
          </div>
          <button
            className="primary"
            disabled={!online || !lane?.open || busy === 'analyze'}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={18} />{' '}
            {busy === 'analyze'
              ? 'Analyzing…'
              : `Analyze frame → ${lane?.name ?? ''}`}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void analyze(f);
              e.target.value = '';
            }}
          />
        </div>

        <div className="sim-toolbar">
          <div>
            <span className={'live-dot ' + (online ? 'online' : 'off')} />
            <strong>
              {online
                ? `${health?.service ?? 'Vision API'} ${health?.version ?? ''}`
                : 'No vision server'}
            </strong>
            {online && (
              <span>
                <Cpu size={12} /> {health?.device?.toUpperCase()} ·{' '}
                {health?.avg_inference_ms
                  ? `${Math.round(health.avg_inference_ms)} ms / frame`
                  : 'warming up'}{' '}
                · {health?.models.person_detector ?? '—'} ·{' '}
                {health?.models.fullness ?? '—'}
              </span>
            )}
          </div>
          <div className="judge-demo">
            <span>Judge demo</span>
            <button
              disabled={!online || !!busy}
              onClick={() => scenario('seed')}
            >
              <Sparkles size={14} /> Seed lanes
            </button>
            <button
              disabled={!online || !!busy}
              onClick={() => scenario('surge')}
            >
              <Zap size={14} /> Full-basket surge
            </button>
            <button
              disabled={!online || !!busy}
              onClick={() => scenario('cctv')}
            >
              <ImageIcon size={14} /> Sample CCTV frame
            </button>
            <button
              disabled={!online || !!busy}
              onClick={() => scenario('clear')}
              aria-label="Clear all lanes"
            >
              <Eraser size={14} />
            </button>
          </div>
        </div>

        {status === 'offline' && (
          <section className="panel offline-panel">
            <div>
              <h2>
                <WifiOff size={18} /> Vision server not reachable at{' '}
                <code>{base}</code>
              </h2>
              <p>
                Start the Python API from the <code>QueueIQ-AI</code> folder,
                then this page connects automatically. The simulation dashboard
                keeps working without it.
              </p>
              <pre>
                pip install -r requirements-server.txt{'\n'}python server.py
                {'   '}# add --host 0.0.0.0 to reach it from another device
              </pre>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyBase();
              }}
            >
              <label>
                API base URL
                <input
                  value={baseInput}
                  onChange={(e) => setBaseInput(e.target.value)}
                  placeholder="http://192.168.1.10:8000"
                />
              </label>
              <button type="submit">Reconnect</button>
              <Link href="/dashboard" className="back-link">
                Open simulation instead <ArrowRight size={13} />
              </Link>
            </form>
          </section>
        )}

        {lastError && (
          <div role="alert" className="error">
            {lastError}{' '}
            <button type="button" className="tiny" onClick={clearError}>
              Dismiss
            </button>
          </div>
        )}

        <div className="stats">
          {[
            {
              Icon: Users,
              label: 'Shoppers in queue',
              n: String(snapshot?.totals.shoppers ?? 0).padStart(2, '0'),
              desc: 'Detected across all lanes',
            },
            {
              Icon: Package,
              label: 'Estimated items',
              n: String(snapshot?.totals.items ?? 0),
              desc: 'From basket fullness classes',
            },
            {
              Icon: Clock3,
              label: 'Fastest estimated wait',
              n: rec?.wait_sec != null ? duration(rec.wait_sec) : '—',
              desc: rec?.lane_name
                ? `${rec.lane_name} · minutes : seconds`
                : 'No open lanes',
            },
            {
              Icon: CheckCheck,
              label: 'Checkouts completed',
              n: String(snapshot?.totals.completed ?? 0).padStart(2, '0'),
              desc: `${model?.n_live ?? 0} with timing feedback`,
            },
          ].map(({ Icon, label, n, desc }) => (
            <section className="stat" key={label}>
              <div>
                <span>{label}</span>
                <Icon size={18} />
              </div>
              <strong>{online ? n : '—'}</strong>
              <small>{desc}</small>
            </section>
          ))}
        </div>

        <div className="checkout-grid">
          <section>
            <div className="lane-heading">
              <h2>Live lane overview</h2>
              <span>
                <i className="green" /> Fast <i className="amber" /> Moderate{' '}
                <i className="red" /> Busy
              </span>
            </div>
            <div className="lanes">
              {lanes.map((l) => (
                <article
                  key={l.id}
                  className={`lane-card ${l.signal} ${l.id === lane?.id ? 'selected' : ''}`}
                >
                  <div className="lane-title">
                    <button
                      className="lane-select"
                      onClick={() => setSelected(l.id)}
                      aria-pressed={l.id === lane?.id}
                    >
                      {l.name} <ArrowUpRight size={14} />
                    </button>
                    <div
                      className={'lane-light ' + l.signal}
                      aria-label={`${l.signal} signal`}
                    />
                  </div>
                  <div className="lane-time">
                    {l.open ? duration(l.wait_sec) : '—'}
                    <span>{l.open ? 'estimated wait' : 'lane closed'}</span>
                  </div>
                  <div className="lane-people">
                    <Users size={14} />
                    {l.n_shoppers} shoppers <span>·</span> ~{l.total_items}{' '}
                    items
                  </div>
                  <div
                    className="queue-track"
                    aria-label={`${l.n_shoppers} shoppers in ${l.name}`}
                  >
                    {l.shoppers.slice(0, 6).map((s, i) => (
                      <button
                        key={s.id}
                        title={`${s.id}: ${fullnessLabel(s.fullness)} (${Math.round(s.confidence * 100)}%) ~${s.est_items} items`}
                        onClick={() => setSelected(l.id)}
                        className={`fullness-${s.fullness} ${i === 0 ? 'front-basket' : ''}`}
                      >
                        <ShoppingCart size={17} />
                        <span>{fullnessLabel(s.fullness).slice(0, 6)}</span>
                      </button>
                    ))}
                    {!l.n_shoppers && (
                      <span className="vacant">
                        {l.open
                          ? 'Ready for the next shopper'
                          : 'No active checkout'}
                      </span>
                    )}
                    {l.n_shoppers > 6 && <span>+{l.n_shoppers - 6}</span>}
                  </div>
                  <div className="lane-foot">
                    <span className={'signal-label ' + l.signal}>
                      {signalLabel(l.signal, fastest === l.id)}
                    </span>
                    <div className="lane-actions">
                      <button
                        className="tiny"
                        disabled={
                          !online ||
                          !l.n_shoppers ||
                          busy === `complete-${l.id}`
                        }
                        onClick={() => complete(l)}
                        title="Front shopper finished paying — measured time feeds the model"
                      >
                        <CheckCheck size={12} /> Done
                      </button>
                      <Switch
                        aria-label={`Open ${l.name}`}
                        checked={l.open}
                        disabled={!online || (l.open && l.n_shoppers > 0)}
                        onCheckedChange={(v) =>
                          void run((c) => c.setOpen(l.id, v))
                        }
                      />
                    </div>
                  </div>
                </article>
              ))}
              {!lanes.length &&
                [1, 2, 3, 4].map((i) => (
                  <article key={i} className="lane-card closed skeleton">
                    <div className="lane-title">
                      <span className="lane-select">Lane 0{i}</span>
                      <div className="lane-light closed" />
                    </div>
                    <div className="lane-time">
                      —<span>waiting for server</span>
                    </div>
                  </article>
                ))}
            </div>

            <div className="panel vision-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    <Camera size={17} /> Overhead vision · {lane?.name ?? '—'}
                  </h2>
                  <p>
                    {lane?.last_analyzed_at
                      ? `Last frame ${new Date(lane.last_analyzed_at * 1000).toLocaleTimeString()} · ${lane.n_detected_total ?? 0} detected · ${Math.round(lane.inference_ms ?? 0)} ms`
                      : 'No frame analyzed for this lane yet'}
                  </p>
                </div>
                <span
                  className={'simulation-tag tier-' + (health?.tier ?? 'off')}
                >
                  {tierLabel(health?.tier)}
                </span>
              </div>
              <div className="vision-grid">
                <div
                  className={
                    'camera-viewport live-viewport ' +
                    (busy === 'analyze' ? 'scanning ' : '') +
                    (dragging ? 'dragging' : '')
                  }
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (online && lane?.open) setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  <div className="camera-corner top-left" />
                  <div className="camera-corner bottom-right" />
                  <div className="camera-label">
                    <ScanLine size={13} /> {camOn ? 'WEBCAM · ' : ''}
                    {frameSrc ? 'ANNOTATED FRAME' : 'NO FRAME'}
                  </div>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="cam-video"
                    hidden={!camOn}
                  />
                  {!camOn && frameSrc && (
                    <img
                      src={frameSrc}
                      alt={`Annotated frame for ${lane?.name}`}
                      className="frame-img"
                    />
                  )}
                  {!camOn && !frameSrc && (
                    <div className="dropzone">
                      <ShoppingCart size={40} strokeWidth={1.2} />
                      <h3>Bring your own queue photo</h3>
                      <p>
                        Drop or paste a photo of a checkout line with shopping
                        carts or baskets — overhead, CCTV, or phone angle. The
                        vision engine counts the shoppers, rates every basket,
                        and turns it into a wait estimate for {lane?.name}.
                      </p>
                      <div className="dropzone-actions">
                        <button
                          className="primary"
                          disabled={!online || !lane?.open}
                          onClick={() => fileRef.current?.click()}
                        >
                          <Upload size={15} /> Choose a photo
                        </button>
                        <button disabled={!online} onClick={startCamera}>
                          <Camera size={15} /> Use webcam
                        </button>
                      </div>
                      <small>
                        JPG, PNG or WEBP · Ctrl/Cmd+V pastes from the clipboard
                        · nothing leaves your local network
                      </small>
                    </div>
                  )}
                  {dragging && (
                    <div className="drop-overlay">
                      <Upload size={34} />
                      Release to analyze into {lane?.name}
                    </div>
                  )}
                  <div className="camera-bottom">
                    {camOn
                      ? auto
                        ? `AUTO-CAPTURE EVERY ${AUTO_CAPTURE_MS / 1000}s → ${lane?.name}`
                        : 'WEBCAM READY · CAPTURE TO ANALYZE'
                      : health?.tier === 'mock'
                        ? 'MOCK INFERENCE · SERVER WITHOUT PYTORCH'
                        : 'YOLOV8 PERSON DETECTION · BASKET FULLNESS PER SHOPPER'}
                  </div>
                  <div className="scan-beam" />
                </div>
                <div className="basket-breakdown">
                  <div className="eyebrow">ANALYZE INTO</div>
                  <div
                    className="lane-pills"
                    role="radiogroup"
                    aria-label="Target lane"
                  >
                    {lanes.map((l) => (
                      <button
                        key={l.id}
                        role="radio"
                        aria-checked={l.id === lane?.id}
                        className={
                          (l.id === lane?.id ? 'active ' : '') + l.signal
                        }
                        disabled={!l.open}
                        onClick={() => setSelected(l.id)}
                      >
                        <i /> {l.name.replace('Lane ', 'L')}
                      </button>
                    ))}
                  </div>
                  <div className="eyebrow">CAPTURE SOURCE</div>
                  <div className="capture-controls">
                    {!camOn ? (
                      <button disabled={!online} onClick={startCamera}>
                        <Camera size={14} /> Start webcam
                      </button>
                    ) : (
                      <>
                        <button
                          className="primary"
                          disabled={
                            !online || busy === 'analyze' || !lane?.open
                          }
                          onClick={async () => {
                            const b = await captureBlob();
                            if (b) void analyze(b);
                          }}
                        >
                          <ScanLine size={14} /> Capture &amp; analyze
                        </button>
                        <button
                          disabled={!online || !lane?.open}
                          onClick={() => setAuto(!auto)}
                          aria-pressed={auto}
                        >
                          {auto ? <Pause size={14} /> : <Play size={14} />}{' '}
                          {auto ? 'Stop auto' : 'Auto-capture'}
                        </button>
                        <button onClick={stopCamera}>Stop webcam</button>
                      </>
                    )}
                    <button
                      disabled={!online || !lane?.open}
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload size={14} /> Upload photo
                    </button>
                  </div>
                  {examples.length > 0 && (
                    <>
                      <div className="eyebrow">
                        <ImageIcon size={11} /> SAMPLE QUEUES · CLICK TO ANALYZE
                      </div>
                      <div className="example-gallery">
                        {examples.map((name) => (
                          <button
                            key={name}
                            disabled={
                              !online || !lane?.open || busy === 'analyze'
                            }
                            onClick={() => void analyze({ example: name })}
                            title={name}
                          >
                            <img
                              src={`${base}/api/examples/${encodeURIComponent(name)}`}
                              alt={`Sample queue ${name}`}
                              loading="lazy"
                            />
                            <span>{name.replace(/\.[a-z0-9]+$/i, '')}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="eyebrow">DETECTIONS → SERVICE TIME</div>
                  <h3>
                    {lane?.n_shoppers ?? 0}
                    <span>shoppers in {lane?.name ?? '—'}</span>
                  </h3>
                  <div className="det-list">
                    {lane?.shoppers.slice(0, 8).map((s, i) => (
                      <div className="mix-row" key={s.id}>
                        <span>
                          <i className={'fullness-' + s.fullness} />#{i + 1}{' '}
                          {fullnessLabel(s.fullness)}
                          <em>{Math.round(s.confidence * 100)}%</em>
                        </span>
                        <b>~{s.est_items} items</b>
                        <small>{Math.round(s.remaining_sec)}s</small>
                      </div>
                    ))}
                    {!lane?.n_shoppers && (
                      <p className="muted">No shoppers detected.</p>
                    )}
                    {(lane?.n_shoppers ?? 0) > 8 && (
                      <p className="muted">
                        +{lane!.n_shoppers - 8} more in the table below
                      </p>
                    )}
                  </div>
                  <div className="service-total">
                    <span>Lane wait estimate</span>
                    <strong>
                      {lane?.open ? duration(lane.wait_sec) : '—'}
                    </strong>
                  </div>
                  <p>
                    Per-shopper estimate = {model?.formula ?? '…'} seconds,
                    where items come from the basket fullness class.{' '}
                    {tierDescription(health?.tier)}
                  </p>
                </div>
              </div>
            </div>

            <div className="panel learning-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    <Brain size={17} /> Online learning · prediction accuracy
                  </h2>
                  <p>
                    predicted_sec = {model?.formula ?? '…'} · updated by SGD
                    after every real checkout ({model?.n_synthetic ?? 0}{' '}
                    synthetic warm-up + {model?.n_live ?? 0} live samples)
                  </p>
                </div>
                <div className="learn-kpis">
                  <span>
                    first 10 <b>{model?.accuracy_first10 ?? '—'}%</b>
                  </span>
                  <ArrowRight size={12} />
                  <span>
                    last 10{' '}
                    <b className="hi">{model?.accuracy_last10 ?? '—'}%</b>
                  </span>
                </div>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={series}
                    margin={{ top: 10, right: 16, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#22313a" vertical={false} />
                    <XAxis
                      dataKey="n"
                      tick={{ fill: '#7f949f', fontSize: 10 }}
                      stroke="#2b3a41"
                    />
                    <YAxis
                      domain={[40, 100]}
                      tick={{ fill: '#7f949f', fontSize: 10 }}
                      stroke="#2b3a41"
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#111b21',
                        border: '1px solid #2b3a41',
                        fontSize: 12,
                      }}
                      labelFormatter={(n) => `Transaction #${n}`}
                      formatter={(v, name) => [
                        `${String(v ?? '')}${name === 'rolling_accuracy' ? '%' : 's'}`,
                        name === 'rolling_accuracy'
                          ? 'Rolling accuracy'
                          : String(name ?? ''),
                      ]}
                    />
                    <ReferenceLine
                      y={90}
                      stroke="#5d7a68"
                      strokeDasharray="4 4"
                    />
                    {firstLive && (
                      <ReferenceLine
                        x={firstLive}
                        stroke="#d3ec55"
                        strokeDasharray="3 3"
                        label={{
                          value: 'live feedback →',
                          fill: '#d3ec55',
                          fontSize: 10,
                          position: 'insideTopRight',
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="rolling_accuracy"
                      stroke="#d3ec55"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="feedback-row">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (lane && actualSec)
                      void complete(lane, Number(actualSec));
                  }}
                >
                  <label>
                    Feedback for {lane?.name ?? '—'} front shopper · actual
                    checkout seconds
                    <input
                      type="number"
                      min={1}
                      max={3600}
                      value={actualSec}
                      onChange={(e) => setActualSec(e.target.value)}
                      placeholder={
                        lane?.shoppers[0]
                          ? `predicted ${Math.round(lane.shoppers[0].est_sec)}`
                          : 'no shopper'
                      }
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={!online || !lane?.n_shoppers || !actualSec}
                  >
                    <Brain size={14} /> Teach the model
                  </button>
                </form>
                <button
                  disabled={!online}
                  onClick={async () => {
                    if (await run((c) => c.resetModel(true)))
                      setNotice('Model reset to synthetic warm start.');
                  }}
                  title="Reset parameters and replay the synthetic warm-up"
                >
                  <RotateCcw size={14} /> Reset model
                </button>
              </div>
              <p className="muted small">
                Transparent to judges: the warm-up curve replays synthetic
                checkouts so the mechanism is visible from the first minute.
                Every “Done” or “Teach the model” action is a real SGD step on
                the same regressor — no code changes needed when real store data
                arrives.
              </p>
            </div>

            <div className="panel queue-details">
              <div className="panel-heading">
                <h2>{lane?.name ?? '—'} · Detected queue</h2>
                <span className="count">{lane?.n_shoppers ?? 0} shoppers</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SHOPPER</TableHead>
                    <TableHead>FULLNESS</TableHead>
                    <TableHead>CONF.</TableHead>
                    <TableHead>ITEMS</TableHead>
                    <TableHead>SOURCE</TableHead>
                    <TableHead>REMAINING</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lane?.shoppers.map((s, i) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        {s.id}
                        <small className="queue-position">
                          {i === 0 ? 'At checkout' : `Position ${i + 1}`}
                        </small>
                      </TableCell>
                      <TableCell>
                        <span
                          className={'fullness-chip fullness-' + s.fullness}
                        >
                          {fullnessLabel(s.fullness)}
                        </span>
                      </TableCell>
                      <TableCell>{Math.round(s.confidence * 100)}%</TableCell>
                      <TableCell>~{s.est_items}</TableCell>
                      <TableCell>{s.source}</TableCell>
                      <TableCell>{duration(s.remaining_sec)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!lane?.n_shoppers && (
                <div className="empty">
                  <ShoppingCart />
                  <p>No shoppers in this lane.</p>
                </div>
              )}
            </div>
          </section>

          <aside>
            <section className="focus panel recommendation">
              <div className="eyebrow">
                <i /> FASTEST LANE RIGHT NOW
              </div>
              <div className="recommended-number">
                {rec?.lane_id ? String(rec.lane_id).padStart(2, '0') : '—'}
                <ArrowUpRight size={38} />
              </div>
              <h2>
                {rec?.lane_name
                  ? `Head to ${rec.lane_name}`
                  : 'All lanes are closed'}
              </h2>
              <p>
                {rec?.wait_sec != null
                  ? `${duration(rec.wait_sec)} estimated wait · ${lanes.find((l) => l.id === rec.lane_id)?.n_shoppers ?? 0} shoppers`
                  : 'Open an empty lane to accept shoppers.'}
              </p>
              <div className="recommendation-note">
                <Info size={16} />
                <span>{rec?.reason ?? 'Waiting for the vision server.'}</span>
              </div>
              <button
                className="primary"
                disabled={!online || !!busy}
                onClick={() => scenario('surge')}
              >
                Send a full basket here <ArrowRight size={16} />
              </button>
            </section>

            <section className="panel comparison">
              <h2>Wait time by lane</h2>
              <p>Predicted time until your turn · why each lane is slow</p>
              {lanes.map((l) => (
                <div className="wait-row" key={l.id}>
                  <div>
                    <span>{l.name}</span>
                    <strong>{l.open ? duration(l.wait_sec) : 'Closed'}</strong>
                  </div>
                  <div className="wait-bar">
                    <span
                      className={l.signal}
                      style={{
                        width: l.open
                          ? `${Math.max(2, (l.wait_sec / maxWait) * 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                  <small className="root-cause">{l.root_cause}</small>
                </div>
              ))}
            </section>

            <section className="panel led-panel">
              <h2>
                <Lightbulb size={16} /> Lane lights · ESP32 feed
              </h2>
              <div className="led-strip">
                {lanes.map((l) => (
                  <div
                    key={l.id}
                    className={'led ' + l.signal}
                    title={`${l.name}: ${l.signal}`}
                  >
                    <i />
                    <span>{String(l.id).padStart(2, '0')}</span>
                  </div>
                ))}
              </div>
              <p>
                Hardware polls <code>GET /api/led/&lt;lane&gt;</code> and
                receives <code>green</code>, <code>amber</code>,{' '}
                <code>red</code> or <code>closed</code>.
              </p>
            </section>

            <section className="panel activity">
              <h2>
                <Activity size={17} /> Vision &amp; learning activity
              </h2>
              {log.slice(0, 6).map((e) => (
                <div className={'activity-item kind-' + e.kind} key={e.id}>
                  <i />
                  <div>
                    <strong>{e.text}</strong>
                    <small>{new Date(e.ts * 1000).toLocaleTimeString()}</small>
                  </div>
                </div>
              ))}
              {!log.length && <p className="muted">No activity yet.</p>}
            </section>
          </aside>
        </div>

        <div className="signal-explainer">
          <Info size={16} />
          <p>
            <strong>Signal thresholds:</strong> green ≤ 2 min · amber ≤ 4 min ·
            red &gt; 4 min, computed by the vision server from the sum of
            per-shopper estimates. “Done” measures the real service time of the
            front shopper and feeds it back into the regressor. API:{' '}
            <code>{base}</code>
          </p>
        </div>
        <footer>
          <span>
            <ShoppingCart size={15} /> QUEUEIQ <b>/</b> EVERY BASKET TELLS A
            STORY.
          </span>
          <span>
            <i /> {health?.vendor ? `${health.vendor} · ` : ''}Live vision ·
            Local network only
          </span>
        </footer>
      </main>
      {notice && (
        <div role="status" className="notice">
          <CheckCheck size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}
