import { describe, expect, test } from "bun:test";
import {
  type Clock,
  createSyncRunner,
  type SyncOutcome,
  type SyncTask,
} from "./syncRunner";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const CHANGE = 3 * SECOND;
const FRESH = 30 * SECOND;
const RETRIES = [30 * SECOND, MINUTE, 2 * MINUTE, 5 * MINUTE];

/** A clock whose time moves only when the test says so. */
function fakeClock() {
  let time = 0;
  let timers: { at: number; callback: () => void }[] = [];
  const clock: Clock = {
    now: () => time,
    schedule: (callback, ms) => {
      const timer = { at: time + ms, callback };
      timers.push(timer);
      return () => {
        timers = timers.filter((one) => one !== timer);
      };
    },
  };
  const advance = (ms: number) => {
    time += ms;
    const due = timers.filter((one) => one.at <= time);
    timers = timers.filter((one) => one.at > time);
    for (const timer of due) {
      timer.callback();
    }
  };
  return { advance, clock, planned: () => timers.length };
}

/** Lets the promises settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Syncs that last until the test ends them, the way it chooses. */
function fakeSyncs() {
  const ends: ((outcome: SyncOutcome) => void)[] = [];
  let started = 0;
  let mostAtOnce = 0;
  const task: SyncTask = () => {
    started += 1;
    mostAtOnce = Math.max(mostAtOnce, ends.length + 1);
    return new Promise((resolve) => {
      ends.push(resolve);
    });
  };
  /** Ends the sync under way, and lets the runner go on. */
  const end = async (outcome: SyncOutcome = "done") => {
    ends.shift()?.(outcome);
    await settle();
  };
  return {
    end,
    mostAtOnce: () => mostAtOnce,
    started: () => started,
    task,
  };
}

/** A runner on a fake clock, with changes waiting to be sent. */
function setup() {
  const time = fakeClock();
  const syncs = fakeSyncs();
  const local = { pending: true };
  const runner = createSyncRunner({
    changeDelayMs: CHANGE,
    clock: time.clock,
    freshMs: FRESH,
    hasPending: () => local.pending,
    retryDelaysMs: RETRIES,
  });
  return { local, runner, syncs, time };
}

describe("after changes", () => {
  test("one sync for a burst of changes, a moment after the last one", () => {
    const { runner, syncs, time } = setup();
    for (let tap = 0; tap < 3; tap += 1) {
      runner.soon(syncs.task);
      time.advance(CHANGE - 1);
    }
    expect(syncs.started()).toBe(0);
    time.advance(1);
    expect(syncs.started()).toBe(1);
    expect(time.planned()).toBe(0);
  });

  test("a change made during a sync goes in the next one, not alongside it", async () => {
    const { runner, syncs, time } = setup();
    runner.now(syncs.task);
    runner.soon(syncs.task);
    time.advance(CHANGE);
    expect(syncs.started()).toBe(1);
    await syncs.end();
    expect(syncs.started()).toBe(2);
    expect(syncs.mostAtOnce()).toBe(1);
  });

  test("a sync that starts takes the changes along: the planned one is dropped", async () => {
    const { runner, syncs, time } = setup();
    runner.soon(syncs.task);
    runner.now(syncs.task);
    expect(time.planned()).toBe(0);
    await syncs.end();
    time.advance(CHANGE);
    expect(syncs.started()).toBe(1);
  });

  test("leaving the app sends the planned sync at once, and nothing else", () => {
    const { runner, syncs, time } = setup();
    runner.soon(syncs.task);
    runner.background();
    expect(syncs.started()).toBe(1);
    time.advance(CHANGE);
    runner.foreground();
    runner.background();
    expect(syncs.started()).toBe(1);
  });

  test("turning sync off forgets the planned sync", () => {
    const { runner, syncs, time } = setup();
    runner.soon(syncs.task);
    runner.cancel();
    time.advance(CHANGE);
    expect(syncs.started()).toBe(0);
  });
});

describe("one sync at a time", () => {
  test("the syncs asked for meanwhile make one more, right after", async () => {
    const { runner, syncs } = setup();
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
    const { runner, syncs } = setup();
    const after = fakeSyncs();
    runner.now(syncs.task);
    runner.now(syncs.task);
    runner.now(after.task);
    await syncs.end();
    expect(syncs.started()).toBe(1);
    expect(after.started()).toBe(1);
  });

  test("a new sync starts once the previous one is over", async () => {
    const { runner, syncs } = setup();
    runner.now(syncs.task);
    await syncs.end();
    runner.now(syncs.task);
    expect(syncs.started()).toBe(2);
  });

  test("turning sync off drops the sync waiting its turn", async () => {
    const { runner, syncs } = setup();
    runner.now(syncs.task);
    runner.now(syncs.task);
    runner.cancel();
    await syncs.end();
    expect(syncs.started()).toBe(1);
  });
});

describe("when a screen comes into view", () => {
  test("syncs, unless a sync started less than 30 s ago", async () => {
    const { runner, syncs, time } = setup();
    runner.ifStale(syncs.task);
    expect(syncs.started()).toBe(1);
    await syncs.end();
    time.advance(FRESH - 1);
    runner.ifStale(syncs.task);
    expect(syncs.started()).toBe(1);
    time.advance(1);
    runner.ifStale(syncs.task);
    expect(syncs.started()).toBe(2);
  });

  test("any sync counts, such as one after a change", async () => {
    const { runner, syncs, time } = setup();
    runner.soon(syncs.task);
    time.advance(CHANGE);
    await syncs.end();
    time.advance(FRESH - 1);
    runner.ifStale(syncs.task);
    expect(syncs.started()).toBe(1);
  });

  test("leaves a sync under way alone, even a long one", async () => {
    const { runner, syncs, time } = setup();
    runner.now(syncs.task);
    time.advance(FRESH);
    runner.ifStale(syncs.task);
    await syncs.end();
    expect(syncs.started()).toBe(1);
  });
});

describe("after a failure that may pass", () => {
  test("tries again after 30 s, 1 min, 2 min, then every 5 min", async () => {
    const { runner, syncs, time } = setup();
    const waits = [30 * SECOND, MINUTE, 2 * MINUTE, 5 * MINUTE, 5 * MINUTE];
    runner.now(syncs.task);
    let started = 1;
    for (const wait of waits) {
      await syncs.end("retry");
      time.advance(wait - 1);
      expect(syncs.started()).toBe(started);
      time.advance(1);
      started += 1;
      expect(syncs.started()).toBe(started);
    }
  });

  test("stops as soon as a sync goes through", async () => {
    const { runner, syncs, time } = setup();
    runner.now(syncs.task);
    await syncs.end("retry");
    time.advance(30 * SECOND);
    await syncs.end("done");
    expect(time.planned()).toBe(0);
    time.advance(HOUR);
    expect(syncs.started()).toBe(2);
  });

  test("after a sync that went through, a new failure waits 30 s again", async () => {
    const { runner, syncs, time } = setup();
    runner.now(syncs.task);
    await syncs.end("retry");
    time.advance(30 * SECOND);
    await syncs.end("retry");
    time.advance(MINUTE);
    await syncs.end("done");
    runner.now(syncs.task);
    await syncs.end("retry");
    time.advance(30 * SECOND);
    expect(syncs.started()).toBe(5);
  });

  test("does not try again when nothing waits to be sent", async () => {
    const { local, runner, syncs, time } = setup();
    local.pending = false;
    runner.now(syncs.task);
    await syncs.end("retry");
    expect(time.planned()).toBe(0);
  });

  test("stops once nothing waits any more", async () => {
    const { local, runner, syncs, time } = setup();
    runner.now(syncs.task);
    await syncs.end("retry");
    local.pending = false;
    time.advance(30 * SECOND);
    expect(syncs.started()).toBe(1);
    expect(time.planned()).toBe(0);
  });

  test("tries again only in the foreground, from the first wait after a return", async () => {
    const { runner, syncs, time } = setup();
    runner.now(syncs.task);
    await syncs.end("retry");
    time.advance(30 * SECOND);
    await syncs.end("retry");
    runner.background();
    expect(time.planned()).toBe(0);
    time.advance(HOUR);
    expect(syncs.started()).toBe(2);

    runner.foreground();
    runner.now(syncs.task);
    await syncs.end("retry");
    time.advance(30 * SECOND);
    expect(syncs.started()).toBe(4);
  });

  test("a sync that fails in the background is not tried again", async () => {
    const { runner, syncs, time } = setup();
    runner.soon(syncs.task);
    runner.background();
    await syncs.end("retry");
    expect(time.planned()).toBe(0);
  });

  test("any sync that starts stands for the next try, and its failure waits longer", async () => {
    const { runner, syncs, time } = setup();
    runner.now(syncs.task);
    await syncs.end("retry");
    time.advance(10 * SECOND);
    runner.soon(syncs.task);
    time.advance(CHANGE);
    expect(syncs.started()).toBe(2);
    expect(time.planned()).toBe(0);
    await syncs.end("retry");
    time.advance(MINUTE - 1);
    expect(syncs.started()).toBe(2);
    time.advance(1);
    expect(syncs.started()).toBe(3);
  });

  test("turning sync off stops trying", async () => {
    const { runner, syncs, time } = setup();
    runner.now(syncs.task);
    await syncs.end("retry");
    runner.cancel();
    time.advance(HOUR);
    expect(syncs.started()).toBe(1);
  });
});
