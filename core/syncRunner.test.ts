import { describe, expect, test } from "bun:test";
import { createSyncRunner, type Schedule } from "./syncRunner";

const DELAY = 3000;

/** Timers that go off only when the test moves the time. */
function fakeClock() {
  let time = 0;
  let timers: { at: number; callback: () => void }[] = [];
  const schedule: Schedule = (callback, ms) => {
    const timer = { at: time + ms, callback };
    timers.push(timer);
    return () => {
      timers = timers.filter((one) => one !== timer);
    };
  };
  const advance = (ms: number) => {
    time += ms;
    const due = timers.filter((one) => one.at <= time);
    timers = timers.filter((one) => one.at > time);
    for (const timer of due) {
      timer.callback();
    }
  };
  return { advance, planned: () => timers.length, schedule };
}

/** Lets the promises settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Syncs that last until the test ends them. */
function fakeSyncs() {
  const ends: (() => void)[] = [];
  let started = 0;
  let mostAtOnce = 0;
  const task = () => {
    started += 1;
    mostAtOnce = Math.max(mostAtOnce, ends.length + 1);
    return new Promise<void>((resolve) => {
      ends.push(resolve);
    });
  };
  /** Ends the sync under way, and lets the runner go on. */
  const end = async () => {
    ends.shift()?.();
    await settle();
  };
  return {
    end,
    mostAtOnce: () => mostAtOnce,
    started: () => started,
    task,
  };
}

describe("after changes", () => {
  test("one sync for a burst of changes, a moment after the last one", () => {
    const clock = fakeClock();
    const syncs = fakeSyncs();
    const runner = createSyncRunner(DELAY, clock.schedule);
    for (let tap = 0; tap < 3; tap += 1) {
      runner.soon(syncs.task);
      clock.advance(DELAY - 1);
    }
    expect(syncs.started()).toBe(0);
    clock.advance(1);
    expect(syncs.started()).toBe(1);
    expect(clock.planned()).toBe(0);
  });

  test("a change made during a sync goes in the next one, not alongside it", async () => {
    const clock = fakeClock();
    const syncs = fakeSyncs();
    const runner = createSyncRunner(DELAY, clock.schedule);
    runner.now(syncs.task);
    runner.soon(syncs.task);
    clock.advance(DELAY);
    expect(syncs.started()).toBe(1);
    await syncs.end();
    expect(syncs.started()).toBe(2);
    expect(syncs.mostAtOnce()).toBe(1);
  });

  test("a sync that starts takes the changes along: the planned one is dropped", async () => {
    const clock = fakeClock();
    const syncs = fakeSyncs();
    const runner = createSyncRunner(DELAY, clock.schedule);
    runner.soon(syncs.task);
    runner.now(syncs.task);
    expect(clock.planned()).toBe(0);
    await syncs.end();
    clock.advance(DELAY);
    expect(syncs.started()).toBe(1);
  });

  test("leaving the app sends the planned sync at once, and only that one", () => {
    const clock = fakeClock();
    const syncs = fakeSyncs();
    const runner = createSyncRunner(DELAY, clock.schedule);
    runner.flush();
    expect(syncs.started()).toBe(0);
    runner.soon(syncs.task);
    runner.flush();
    expect(syncs.started()).toBe(1);
    clock.advance(DELAY);
    expect(syncs.started()).toBe(1);
  });

  test("turning sync off forgets the planned sync", () => {
    const clock = fakeClock();
    const syncs = fakeSyncs();
    const runner = createSyncRunner(DELAY, clock.schedule);
    runner.soon(syncs.task);
    runner.cancel();
    clock.advance(DELAY);
    expect(syncs.started()).toBe(0);
  });
});

describe("one sync at a time", () => {
  test("the syncs asked for meanwhile make one more, right after", async () => {
    const syncs = fakeSyncs();
    const runner = createSyncRunner(DELAY, fakeClock().schedule);
    let over = false;
    runner.now(syncs.task).then(() => {
      over = true;
    });
    runner.now(syncs.task);
    runner.now(syncs.task);
    expect(syncs.started()).toBe(1);
    await syncs.end();
    expect(syncs.started()).toBe(2);
    expect(over).toBe(false);
    await syncs.end();
    expect(over).toBe(true);
    expect(syncs.started()).toBe(2);
    expect(syncs.mostAtOnce()).toBe(1);
  });

  test("the one that runs next is the latest asked for", async () => {
    const before = fakeSyncs();
    const after = fakeSyncs();
    const runner = createSyncRunner(DELAY, fakeClock().schedule);
    runner.now(before.task);
    runner.now(before.task);
    runner.now(after.task);
    await before.end();
    expect(before.started()).toBe(1);
    expect(after.started()).toBe(1);
  });

  test("a new sync starts once the previous one is over", async () => {
    const syncs = fakeSyncs();
    const runner = createSyncRunner(DELAY, fakeClock().schedule);
    runner.now(syncs.task);
    await syncs.end();
    runner.now(syncs.task);
    expect(syncs.started()).toBe(2);
  });

  test("turning sync off drops the sync waiting its turn", async () => {
    const syncs = fakeSyncs();
    const runner = createSyncRunner(DELAY, fakeClock().schedule);
    runner.now(syncs.task);
    runner.now(syncs.task);
    runner.cancel();
    await syncs.end();
    expect(syncs.started()).toBe(1);
  });
});
