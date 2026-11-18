// When the app syncs. One sync at a time: a sync asked for while another
// runs comes right after it. After a change, the sync waits until the changes
// stop for a moment, so that a burst of taps makes a single sync. A screen
// that comes into view syncs, unless a sync started a moment ago. A sync that
// fails for a reason that may pass is tried again, later and later, while
// changes wait and the app stays in the foreground. Nothing else runs on a
// timer, so that the server's database can sleep. The clock is a parameter,
// so that tests move the time themselves.

/** Calls `callback` after `ms`; the function it returns cancels the call. */
export type Schedule = (callback: () => void, ms: number) => () => void;

export interface Clock {
  now: () => number;
  schedule: Schedule;
}

const systemClock: Clock = {
  now: Date.now,
  schedule: (callback, ms) => {
    const timer = setTimeout(callback, ms);
    return () => clearTimeout(timer);
  },
};

/**
 * How a sync ended: "retry" when it failed for a reason that may pass, such
 * as no network or a server waking up; "done" otherwise.
 */
export type SyncOutcome = "done" | "retry";

/** One sync, from start to end. It reports its own failures: it never rejects. */
export type SyncTask = () => Promise<SyncOutcome>;

export interface SyncRunnerOptions {
  /** How long the changes must stop before the sync that sends them. */
  changeDelayMs: number;
  clock?: Clock;
  /** A screen that comes into view syncs only when no sync started for this long. */
  freshMs: number;
  /** Whether changes wait to be sent. */
  hasPending: () => boolean;
  /** The wait before each new try after a failure; the last one repeats. */
  retryDelaysMs: readonly number[];
}

export interface SyncRunner {
  /** The app leaves the foreground: the planned sync goes at once, and failed syncs are no longer tried again. */
  background: () => void;
  /** Sync turned off: forgets every sync planned or waiting its turn. */
  cancel: () => void;
  /** The app is back in the foreground: failed syncs are tried again, from the first wait. */
  foreground: () => void;
  /** A screen came into view: syncs, unless a sync started a moment ago. */
  ifStale: (task: SyncTask) => void;
  /** Syncs now, or right after the sync under way. Resolves once it is over. */
  now: (task: SyncTask) => Promise<void>;
  /** After a change: syncs once the changes have stopped for the delay. */
  soon: (task: SyncTask) => void;
}

export function createSyncRunner({
  changeDelayMs,
  clock = systemClock,
  freshMs,
  hasPending,
  retryDelaysMs,
}: SyncRunnerOptions): SyncRunner {
  let running: Promise<void> | undefined;
  let waiting: SyncTask | undefined;
  let planned: { cancel: () => void; task: SyncTask } | undefined;
  let cancelRetry: (() => void) | undefined;
  /** Failed syncs in a row, while they are tried again. */
  let failures = 0;
  let lastStart = Number.NEGATIVE_INFINITY;
  let inForeground = true;

  const unplan = () => {
    planned?.cancel();
    planned = undefined;
  };

  const unretry = () => {
    cancelRetry?.();
    cancelRetry = undefined;
  };

  function now(task: SyncTask) {
    waiting = task;
    if (!running) {
      running = drain();
    }
    return running;
  }

  async function drain() {
    try {
      while (waiting) {
        const task = waiting;
        waiting = undefined;
        // It takes every change made so far: no other sync needs to come.
        unplan();
        unretry();
        lastStart = clock.now();
        if ((await task()) === "retry") {
          retryLater(task);
        } else {
          failures = 0;
        }
      }
    } finally {
      running = undefined;
    }
  }

  function retryLater(task: SyncTask) {
    if (!(inForeground && hasPending())) {
      failures = 0;
      return;
    }
    failures += 1;
    const delay = retryDelaysMs[Math.min(failures, retryDelaysMs.length) - 1];
    cancelRetry = clock.schedule(() => {
      cancelRetry = undefined;
      if (hasPending()) {
        now(task);
      } else {
        failures = 0;
      }
    }, delay);
  }

  const soon = (task: SyncTask) => {
    unplan();
    const cancel = clock.schedule(() => {
      planned = undefined;
      now(task);
    }, changeDelayMs);
    planned = { cancel, task };
  };

  const ifStale = (task: SyncTask) => {
    if (!running && clock.now() - lastStart >= freshMs) {
      now(task);
    }
  };

  const background = () => {
    inForeground = false;
    unretry();
    failures = 0;
    if (planned) {
      now(planned.task);
    }
  };

  const foreground = () => {
    inForeground = true;
  };

  const cancel = () => {
    unplan();
    unretry();
    waiting = undefined;
    failures = 0;
  };

  return { background, cancel, foreground, ifStale, now, soon };
}
