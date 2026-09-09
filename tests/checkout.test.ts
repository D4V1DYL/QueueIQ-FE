import assert from 'node:assert/strict';
import {
  seed,
  bestLane,
  wait,
  addShopper,
  tick,
  setOpen,
  readState,
  signal,
  seconds,
} from '../lib/checkout.ts';
const s = seed();
assert.equal(bestLane(s)?.id, 2);
assert.equal(s.lanes[1].baskets.length, 3);
assert.equal(s.lanes[0].baskets.length, 2);
assert.ok(wait(s.lanes[1]) < wait(s.lanes[0]));
assert.equal(signal(s.lanes[1]), 'green');
assert.equal(signal(s.lanes[0]), 'red');
assert.equal(signal(s.lanes[3]), 'closed');
assert.ok(
  seconds({ packaged: 0, produce: 10, bulky: 0 }) >
    seconds({ packaged: 10, produce: 0, bulky: 0 }),
);
const added = addShopper(s, 2, { packaged: 30, produce: 10, bulky: 4 });
assert.equal(added.nextId, 110);
assert.equal(added.lanes[1].baskets.length, 4);
assert.equal(bestLane(added)?.id, 3);
assert.equal(s.lanes[1].baskets.length, 3);
assert.throws(() => addShopper(s, 4, { packaged: 1, produce: 0, bulky: 0 }));
assert.throws(() => addShopper(s, 2, { packaged: 0, produce: 0, bulky: 0 }));
assert.throws(() => addShopper(s, 2, { packaged: -1, produce: 0, bulky: 0 }));
assert.throws(() => addShopper(s, 2, { packaged: 1.5, produce: 0, bulky: 0 }));
const advanced = tick(s, 15);
assert.equal(wait(advanced.lanes[1]), wait(s.lanes[1]) - 15);
assert.equal(advanced.elapsed, 15);
const done = tick(s, 3600);
assert.equal(done.completed, 7);
assert.equal(done.lanes.flatMap((l) => l.baskets).length, 0);
assert.throws(() => setOpen(s, 1, false));
assert.equal(setOpen(done, 1, false).lanes[0].open, false);
assert.equal(bestLane(setOpen(s, 4, true))?.id, 4);
assert.deepEqual(readState(JSON.stringify(added)), added);
assert.throws(() => readState('{}'));
assert.equal(
  signal({
    ...s.lanes[0],
    baskets: [{ id: 'T', packaged: 1, produce: 0, bulky: 0, remaining: 120 }],
  }),
  'green',
);
assert.equal(
  signal({
    ...s.lanes[0],
    baskets: [{ id: 'T', packaged: 1, produce: 0, bulky: 0, remaining: 240 }],
  }),
  'amber',
);
console.log(
  'PASS: basket-weighted prediction, recommendations, signal thresholds, shopper validation, lane controls, checkout advancement and persistence.',
);
