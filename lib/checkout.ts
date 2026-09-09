export type Basket = {
  id: string;
  packaged: number;
  produce: number;
  bulky: number;
  remaining: number;
};
export type Lane = {
  id: number;
  name: string;
  open: boolean;
  speed: number;
  baskets: Basket[];
};
export type CheckoutEvent = { id: string; text: string; time: number };
export type CheckoutState = {
  lanes: Lane[];
  events: CheckoutEvent[];
  elapsed: number;
  completed: number;
  nextId: number;
};
export const STORAGE_KEY = 'queueiq-checkout-v2';
export const seconds = (
  b: Pick<Basket, 'packaged' | 'produce' | 'bulky'>,
  speed = 1,
) => Math.round((b.packaged * 4 + b.produce * 8 + b.bulky * 10 + 20) / speed);
export function basket(
  id: string,
  p: number,
  f: number,
  b: number,
  speed = 1,
): Basket {
  return {
    id,
    packaged: p,
    produce: f,
    bulky: b,
    remaining: seconds({ packaged: p, produce: f, bulky: b }, speed),
  };
}
export const count = (b: Basket) => b.packaged + b.produce + b.bulky;
export const wait = (lane: Lane) =>
  lane.baskets.reduce((n, b) => n + b.remaining, 0);
export function bestLane(s: CheckoutState) {
  return s.lanes
    .filter((l) => l.open)
    .sort((a, b) => wait(a) - wait(b) || a.id - b.id)[0];
}
export function signal(lane: Lane) {
  return !lane.open
    ? 'closed'
    : wait(lane) <= 120
      ? 'green'
      : wait(lane) <= 240
        ? 'amber'
        : 'red';
}
export function seed(): CheckoutState {
  return {
    elapsed: 0,
    completed: 0,
    nextId: 109,
    lanes: [
      {
        id: 1,
        name: 'Lane 01',
        open: true,
        speed: 1,
        baskets: [basket('B-101', 16, 8, 2), basket('B-102', 12, 5, 1)],
      },
      {
        id: 2,
        name: 'Lane 02',
        open: true,
        speed: 1.1,
        baskets: [
          basket('B-103', 3, 1, 0, 1.1),
          basket('B-104', 4, 0, 0, 1.1),
          basket('B-105', 2, 1, 0, 1.1),
        ],
      },
      {
        id: 3,
        name: 'Lane 03',
        open: true,
        speed: 0.9,
        baskets: [
          basket('B-106', 12, 4, 2, 0.9),
          basket('B-107', 8, 2, 0, 0.9),
        ],
      },
      { id: 4, name: 'Lane 04', open: false, speed: 1, baskets: [] },
    ],
    events: [
      {
        id: 'seed',
        text: 'Demo initialized with simulated overhead detections.',
        time: 0,
      },
    ],
  };
}
function log(s: CheckoutState, text: string) {
  return [
    { id: crypto.randomUUID(), text, time: s.elapsed },
    ...s.events,
  ].slice(0, 30);
}
export function addShopper(
  s: CheckoutState,
  laneId: number,
  items: { packaged: number; produce: number; bulky: number },
): CheckoutState {
  for (const n of Object.values(items))
    if (!Number.isInteger(n) || n < 0 || n > 60)
      throw Error('Each item count must be a whole number from 0 to 60.');
  if (Object.values(items).reduce((a, b) => a + b, 0) < 1)
    throw Error('Add at least one item.');
  const lane = s.lanes.find((l) => l.id === laneId);
  if (!lane?.open) throw Error('Choose an open lane.');
  if (lane.baskets.length >= 20)
    throw Error('This demo lane has reached its 20-shopper limit.');
  const b = basket(
    `B-${s.nextId}`,
    items.packaged,
    items.produce,
    items.bulky,
    lane.speed,
  );
  return {
    ...s,
    nextId: s.nextId + 1,
    lanes: s.lanes.map((l) =>
      l.id === laneId ? { ...l, baskets: [...l.baskets, b] } : l,
    ),
    events: log(s, `${b.id} joined ${lane.name} with ${count(b)} items.`),
  };
}
export function setOpen(s: CheckoutState, id: number, open: boolean) {
  const lane = s.lanes.find((l) => l.id === id);
  if (!lane) throw Error('Lane not found.');
  if (!open && lane.baskets.length)
    throw Error('A lane can only close after its queue is empty.');
  return {
    ...s,
    lanes: s.lanes.map((l) => (l.id === id ? { ...l, open } : l)),
    events: log(s, `${lane.name} ${open ? 'opened' : 'closed'}.`),
  };
}
export function tick(s: CheckoutState, step = 15): CheckoutState {
  if (!Number.isInteger(step) || step < 1 || step > 3600)
    throw Error('Invalid simulation interval.');
  let completed = s.completed;
  let events = s.events;
  const elapsed = s.elapsed + step;
  const lanes = s.lanes.map((l) => {
    if (!l.open) return l;
    let budget = step;
    const baskets = l.baskets.map((b) => ({ ...b }));
    while (baskets.length && budget > 0) {
      const b = baskets[0];
      if (b.remaining <= budget) {
        budget -= b.remaining;
        baskets.shift();
        completed++;
        events = [
          {
            id: crypto.randomUUID(),
            text: `${b.id} completed checkout at ${l.name}.`,
            time: elapsed,
          },
          ...events,
        ].slice(0, 30);
      } else {
        b.remaining -= budget;
        budget = 0;
      }
    }
    return { ...l, baskets };
  });
  return { ...s, lanes, events, elapsed, completed };
}
export function readState(raw: string): CheckoutState {
  const s = JSON.parse(raw);
  if (
    !s ||
    !Array.isArray(s.lanes) ||
    s.lanes.length !== 4 ||
    !Array.isArray(s.events) ||
    !Number.isInteger(s.elapsed) ||
    s.elapsed < 0 ||
    !Number.isInteger(s.completed) ||
    s.completed < 0 ||
    !Number.isInteger(s.nextId) ||
    s.nextId < 109
  )
    throw Error('Invalid saved simulation.');
  const ids = new Set();
  s.lanes.forEach((l: Lane, i: number) => {
    if (
      l.id !== i + 1 ||
      typeof l.name !== 'string' ||
      typeof l.open !== 'boolean' ||
      !Number.isFinite(l.speed) ||
      l.speed <= 0 ||
      !Array.isArray(l.baskets) ||
      l.baskets.length > 20
    )
      throw Error('Invalid lane.');
    l.baskets.forEach((b) => {
      if (
        typeof b.id !== 'string' ||
        ids.has(b.id) ||
        ![b.packaged, b.produce, b.bulky].every(
          (n) => Number.isInteger(n) && n >= 0 && n <= 60,
        ) ||
        count(b) < 1 ||
        !Number.isFinite(b.remaining) ||
        b.remaining <= 0
      )
        throw Error('Invalid basket.');
      ids.add(b.id);
    });
  });
  s.events.forEach((e: CheckoutEvent) => {
    if (
      typeof e.id !== 'string' ||
      typeof e.text !== 'string' ||
      !Number.isFinite(e.time)
    )
      throw Error('Invalid event.');
  });
  return s;
}
