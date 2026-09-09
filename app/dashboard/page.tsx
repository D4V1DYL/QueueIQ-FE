'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  Layers,
  Clock3,
  CheckCheck,
  ShoppingCart,
  Activity,
  Download,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Camera,
  ScanLine,
  Users,
  Package,
  Leaf,
  Box,
  Info,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from '@/components/ui/table';
import {
  STORAGE_KEY,
  seed,
  readState,
  addShopper,
  setOpen,
  tick,
  bestLane,
  signal,
  wait,
  count,
  seconds,
  type CheckoutState,
} from '@/lib/checkout';
const duration = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.ceil(n % 60)).padStart(2, '0')}`;
export default function Dashboard() {
  const [state, setState] = useState<CheckoutState>(seed);
  const ref = useRef(state);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState(2);
  const [modal, setModal] = useState(false);
  const [reset, setReset] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [laneId, setLaneId] = useState(2);
  const [items, setItems] = useState({ packaged: 6, produce: 2, bulky: 0 });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const initial = raw ? readState(raw) : seed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      ref.current = initial;
      setState(initial);
      setReady(true);
    } catch {
      setError(
        'Saved simulation could not be loaded. Reset the demo to start a new local session.',
      );
    }
  }, []);
  function commit(s: CheckoutState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    ref.current = s;
    setState(s);
  }
  function perform(action: () => CheckoutState, message?: string) {
    try {
      commit(action());
      setError('');
      if (message) setNotice(message);
      return true;
    } catch (e) {
      setRunning(false);
      setError((e as Error).message);
      return false;
    }
  }
  useEffect(() => {
    if (!running || !ready) return;
    const id = setInterval(() => perform(() => tick(ref.current)), 3000);
    return () => clearInterval(id);
  }, [running, ready]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tool = {
      name: 'get_checkout_recommendation',
      description:
        'Read simulated checkout lanes and the fastest open lane. Does not change the simulation.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: (input: unknown) => {
        if (!input || typeof input !== 'object' || Object.keys(input).length)
          throw Error('Expected an empty object.');
        const s = ref.current;
        return {
          simulated: true,
          fastestLane: bestLane(s)?.id ?? null,
          lanes: s.lanes.map((l) => ({
            id: l.id,
            open: l.open,
            waitSeconds: wait(l),
            shoppers: l.baskets.length,
            signal: signal(l),
          })),
        };
      },
    };
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  const fastest = bestLane(state);
  const active = state.lanes.filter((l) => l.open);
  const customers = state.lanes.reduce((a, l) => a + l.baskets.length, 0);
  const totalItems = state.lanes.reduce(
    (a, l) => a + l.baskets.reduce((n, b) => n + count(b), 0),
    0,
  );
  const lane = state.lanes.find((l) => l.id === selected)!;
  const front = lane.baskets[0];
  const maxWait = Math.max(1, ...state.lanes.map(wait));
  function openShopper() {
    setItems({ packaged: 6, produce: 2, bulky: 0 });
    setLaneId(fastest?.id ?? 1);
    setModal(true);
  }
  function exportData() {
    const data = {
      ...ref.current,
      simulation: true,
      exportedAt: new Date().toISOString(),
      predictions: ref.current.lanes.map((l) => ({
        lane: l.id,
        waitSeconds: wait(l),
        signal: signal(l),
      })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'queueiq-checkout-snapshot.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Simulation snapshot exported.');
  }
  return (
    <div className="shell checkout">
      <header className="topbar">
        <Link className="brand" href="/">
          <img src="/queueiq-logo.jpg" alt="QueueIQ logo" />
          <strong>
            Queue<span>IQ</span>
          </strong>
        </Link>
        <div className="workspace">
          Store operations <span>/</span> Checkout intelligence
        </div>
        <span className="demo">
          <i />
          Simulation mode
        </span>
        <Link className="back-link" href="/">
          About QueueIQ <ArrowUpRight size={14} />
        </Link>
      </header>
      <main>
        <div className="heading">
          <div>
            <div className="eyebrow">CONTROL ROOM / CHECKOUT OVERVIEW</div>
            <h1>
              A clearer view of every queue<span>.</span>
            </h1>
            <p>Basket-aware wait estimates. Smarter lane decisions.</p>
          </div>
          <button
            className="primary"
            disabled={!ready || !active.length}
            onClick={openShopper}
          >
            <Plus size={18} /> Add shopper
          </button>
        </div>
        <div className="sim-toolbar">
          <div>
            <span className={'live-dot ' + (running ? 'pulsing' : '')} />
            <strong>
              {running ? 'Simulation running' : 'Simulation paused'}
            </strong>
            <span>T+{duration(state.elapsed)} elapsed</span>
          </div>
          <div>
            <button disabled={!ready} onClick={() => setRunning(!running)}>
              {running ? <Pause size={15} /> : <Play size={15} />}{' '}
              {running ? 'Pause' : 'Run simulation'}
            </button>
            <button
              disabled={!ready}
              onClick={() => perform(() => tick(ref.current))}
              title="Advance all checkouts by 15 simulated seconds"
            >
              <SkipForward size={15} /> +15 sec
            </button>
            <button
              onClick={() => setReset(true)}
              aria-label="Reset simulation"
            >
              <RotateCcw size={15} />
            </button>
            <button
              disabled={!ready}
              onClick={exportData}
              aria-label="Export simulation snapshot"
            >
              <Download size={15} />
            </button>
          </div>
        </div>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <div className="stats">
          {[
            {
              Icon: Users,
              label: 'Shoppers in queue',
              n: String(customers).padStart(2, '0'),
              desc: 'Across all checkout lanes',
            },
            {
              Icon: Package,
              label: 'Detected items',
              n: String(totalItems),
              desc: 'Simulated basket contents',
            },
            {
              Icon: Clock3,
              label: 'Fastest estimated wait',
              n: fastest ? duration(wait(fastest)) : '—',
              desc: fastest
                ? `${fastest.name} · minutes : seconds`
                : 'No open lanes',
            },
            {
              Icon: CheckCheck,
              label: 'Checkouts completed',
              n: String(state.completed).padStart(2, '0'),
              desc: 'During this simulation',
            },
          ].map(({ Icon, label, n, desc }) => (
            <section className="stat" key={label}>
              <div>
                <span>{label}</span>
                <Icon size={18} />
              </div>
              <strong>{ready ? n : '—'}</strong>
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
              {state.lanes.map((l) => (
                <article
                  key={l.id}
                  className={`lane-card ${signal(l)} ${l.id === selected ? 'selected' : ''}`}
                >
                  <div className="lane-title">
                    <button
                      className="lane-select"
                      onClick={() => setSelected(l.id)}
                      aria-pressed={selected === l.id}
                    >
                      {l.name} <ArrowUpRight size={14} />
                    </button>
                    <div
                      className={'lane-light ' + signal(l)}
                      aria-label={`${signal(l)} signal`}
                    />
                  </div>
                  <div className="lane-time">
                    {l.open ? duration(wait(l)) : '—'}
                    <span>{l.open ? 'estimated wait' : 'lane closed'}</span>
                  </div>
                  <div className="lane-people">
                    <Users size={14} />
                    {l.baskets.length} shoppers <span>·</span>
                    {l.baskets.reduce((n, b) => n + count(b), 0)} items
                  </div>
                  <div
                    className="queue-track"
                    aria-label={`${l.baskets.length} baskets in ${l.name}`}
                  >
                    {l.baskets.slice(0, 6).map((b, i) => (
                      <button
                        key={b.id}
                        title={`${b.id}: ${count(b)} items`}
                        onClick={() => setSelected(l.id)}
                        className={i === 0 ? 'front-basket' : ''}
                      >
                        <ShoppingCart size={17} />
                        <span>{count(b)}</span>
                      </button>
                    ))}
                    {!l.baskets.length && (
                      <span className="vacant">
                        {l.open
                          ? 'Ready for the next shopper'
                          : 'No active checkout'}
                      </span>
                    )}
                    {l.baskets.length > 6 && (
                      <span>+{l.baskets.length - 6}</span>
                    )}
                  </div>
                  <div className="lane-foot">
                    <span className={'signal-label ' + signal(l)}>
                      {!l.open
                        ? 'Offline'
                        : fastest?.id === l.id
                          ? 'Recommended'
                          : signal(l) === 'green'
                            ? 'Short wait'
                            : signal(l) === 'amber'
                              ? 'Moderate wait'
                              : 'Long wait'}
                    </span>
                    <Switch
                      aria-label={`Open ${l.name}`}
                      checked={l.open}
                      disabled={!ready || (l.open && l.baskets.length > 0)}
                      onCheckedChange={(v) =>
                        perform(() => setOpen(ref.current, l.id, v))
                      }
                    />
                  </div>
                </article>
              ))}
            </div>
            <div className="panel vision-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    <Camera size={17} /> Overhead basket analysis
                  </h2>
                  <p>
                    {lane.name} · Front shopper {front?.id ?? '—'}
                  </p>
                </div>
                <span className="simulation-tag">SIMULATED FEED</span>
              </div>
              <div className="vision-grid">
                <div
                  className={'camera-viewport ' + (running ? 'scanning' : '')}
                >
                  <div className="camera-corner top-left" />
                  <div className="camera-corner bottom-right" />
                  <div className="camera-label">
                    <ScanLine size={13} /> BASKET CONTENT MAP
                  </div>
                  {front ? (
                    <div className="detection-grid">
                      {[
                        { type: 'PACKAGED', n: front.packaged, Icon: Package },
                        { type: 'PRODUCE', n: front.produce, Icon: Leaf },
                        { type: 'BULKY', n: front.bulky, Icon: Box },
                      ]
                        .filter((o) => o.n > 0)
                        .map(({ type, n, Icon }) => (
                          <div
                            className={'detection ' + type.toLowerCase()}
                            key={type}
                          >
                            <span>
                              {type} × {n}
                            </span>
                            <Icon size={38} strokeWidth={1} />
                            <small>SIMULATED DETECTION</small>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="camera-empty">
                      <ScanLine size={38} />
                      <p>No basket in view</p>
                    </div>
                  )}
                  <div className="camera-bottom">
                    SCHEMATIC VIEW · NO CAMERA CONNECTED
                  </div>
                  <div className="scan-beam" />
                </div>
                <div className="basket-breakdown">
                  <div className="eyebrow">ITEM MIX → SERVICE TIME</div>
                  <h3>
                    {front ? count(front) : 0}
                    <span>items detected</span>
                  </h3>
                  {[
                    {
                      name: 'Packaged goods',
                      n: front?.packaged ?? 0,
                      sec: 4,
                      color: 'packaged',
                    },
                    {
                      name: 'Loose produce',
                      n: front?.produce ?? 0,
                      sec: 8,
                      color: 'produce',
                    },
                    {
                      name: 'Bulky items',
                      n: front?.bulky ?? 0,
                      sec: 10,
                      color: 'bulky',
                    },
                  ].map((o) => (
                    <div className="mix-row" key={o.name}>
                      <span>
                        <i className={o.color} />
                        {o.name}
                      </span>
                      <b>{o.n}</b>
                      <small>{o.sec}s / item</small>
                    </div>
                  ))}
                  <div className="service-total">
                    <span>Current checkout remaining</span>
                    <strong>{duration(front?.remaining ?? 0)}</strong>
                  </div>
                  <p>
                    Includes 20s payment overhead, adjusted by cashier speed.
                    Estimates are deterministic demo calculations.
                  </p>
                </div>
              </div>
            </div>
            <div className="panel queue-details">
              <div className="panel-heading">
                <h2>{lane.name} · Basket queue</h2>
                <span className="count">{lane.baskets.length} shoppers</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BASKET</TableHead>
                    <TableHead>ITEM MIX</TableHead>
                    <TableHead>ITEMS</TableHead>
                    <TableHead>REMAINING</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lane.baskets.map((b, i) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        {b.id}
                        <small className="queue-position">
                          {i === 0 ? 'At checkout' : `Position ${i + 1}`}
                        </small>
                      </TableCell>
                      <TableCell>
                        {b.packaged} packaged / {b.produce} produce / {b.bulky}{' '}
                        bulky
                      </TableCell>
                      <TableCell>{count(b)}</TableCell>
                      <TableCell>{duration(b.remaining)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!lane.baskets.length && (
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
                {fastest ? String(fastest.id).padStart(2, '0') : '—'}
                <ArrowUpRight size={38} />
              </div>
              <h2>
                {fastest ? `Head to ${fastest.name}` : 'All lanes are closed'}
              </h2>
              <p>
                {fastest
                  ? `${duration(wait(fastest))} estimated wait · ${fastest.baskets.length} shoppers`
                  : 'Open an empty lane to accept shoppers.'}
              </p>
              <div className="recommendation-note">
                <Info size={16} />
                <span>
                  {fastest
                    ? 'Recommendation uses basket workload and cashier speed—not just the number of people.'
                    : 'No lane recommendation is available.'}
                </span>
              </div>
              <button
                className="primary"
                disabled={!ready || !fastest}
                onClick={openShopper}
              >
                Try this recommendation <ArrowRight size={16} />
              </button>
            </section>
            <section className="panel comparison">
              <h2>Wait time by lane</h2>
              <p>Predicted time until your turn</p>
              {state.lanes.map((l) => (
                <div className="wait-row" key={l.id}>
                  <div>
                    <span>{l.name}</span>
                    <strong>{l.open ? duration(wait(l)) : 'Closed'}</strong>
                  </div>
                  <div className="wait-bar">
                    <span
                      className={signal(l)}
                      style={{
                        width: l.open
                          ? `${Math.max(2, (wait(l) / maxWait) * 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>
              ))}
            </section>
            <section className="panel activity">
              <h2>
                <Activity size={17} /> Simulation activity
              </h2>
              {state.events.slice(0, 4).map((e) => (
                <div className="activity-item" key={e.id}>
                  <i />
                  <div>
                    <strong>{e.text}</strong>
                    <small>T+{duration(e.time)}</small>
                  </div>
                </div>
              ))}
            </section>
          </aside>
        </div>
        <div className="signal-explainer">
          <Info size={16} />
          <p>
            <strong>Signal thresholds:</strong> green ≤ 2 min · amber ≤ 4 min ·
            red &gt; 4 min. Empty lanes can be opened or closed. Simulation
            advances 15 seconds every 3 seconds while running.
          </p>
        </div>
        <footer>
          <span>
            <ShoppingCart size={15} /> QUEUEIQ <b>/</b> EVERY BASKET TELLS A
            STORY.
          </span>
          <span>
            <i /> Simulated detections · Saved to this browser
          </span>
        </footer>
      </main>
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="request-dialog">
          <DialogTitle>Add a simulated shopper</DialogTitle>
          <DialogDescription>
            Change basket contents to see how estimated wait times and lane
            signals respond.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                perform(
                  () => addShopper(ref.current, laneId, items),
                  'Shopper added. Lane estimates updated.',
                )
              ) {
                setSelected(laneId);
                setModal(false);
              }
            }}
          >
            <div className="form-grid">
              {(['packaged', 'produce', 'bulky'] as const).map((k) => (
                <label key={k}>
                  {k === 'packaged'
                    ? 'Packaged goods'
                    : k === 'produce'
                      ? 'Loose produce'
                      : 'Bulky items'}
                  <input
                    type="number"
                    required
                    min={0}
                    max={60}
                    value={items[k]}
                    onChange={(e) =>
                      setItems({ ...items, [k]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              Checkout lane
              <Select
                value={String(laneId)}
                onValueChange={(v) => v && setLaneId(Number(v))}
              >
                <SelectTrigger aria-label="Checkout lane">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {active.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name}
                      {l.id === fastest?.id ? ' · Recommended' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <p className="basket-estimate">
              Basket service estimate:{' '}
              <strong>
                {duration(
                  seconds(
                    items,
                    state.lanes.find((l) => l.id === laneId)?.speed ?? 1,
                  ),
                )}
              </strong>{' '}
              · before waiting in line
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="actions">
              <button type="button" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="primary" type="submit">
                Add to queue <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={reset} onOpenChange={setReset}>
        <AlertDialogContent>
          <AlertDialogTitle>Reset the simulation?</AlertDialogTitle>
          <AlertDialogDescription>
            This replaces this browser’s simulated shoppers and activity with
            the original demo. No real store data is affected.
          </AlertDialogDescription>
          <div className="actions">
            <AlertDialogCancel>Keep simulation</AlertDialogCancel>
            <button
              className="primary"
              onClick={() => {
                if (perform(() => seed(), 'Demo reset.')) {
                  setReady(true);
                  setRunning(false);
                  setSelected(2);
                  setReset(false);
                }
              }}
            >
              Reset demo
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      {notice && (
        <div role="status" className="notice">
          <CheckCheck size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}
