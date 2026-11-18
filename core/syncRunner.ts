// When the app syncs. One sync at a time: a sync asked for while another
// runs comes right after it. After a change, the sync waits until the changes
// stop for a moment, so that a burst of taps makes a single sync. The timers
// are a parameter, so that tests move the time themselves.

/** Calls `callback` after `ms`; the function it returns cancels the call. */
export type Schedule = (callback: () => void, ms: number) => () => void;

const timeout: Schedule = (callback, ms) => {
  const timer = setTimeout(callback, ms);
  return () => clearTimeout(timer);
};

/** One sync, from start to end. It reports its own failures: it never rejects. */
export type SyncTask = () => Promise<void>;

export interface SyncRunner {
  /** Sync turned off: forgets the planned sync and the one waiting its turn. */
  cancel: () => void;
  /** Runs the planned sync now, for instance before the app goes to sleep. */
  flush: () => void;
  /** Syncs now, or right after the sync under way. Resolves once it is over. */
  now: (task: SyncTask) => Promise<void>;
  /** After a change: syncs once the changes have stopped for the delay. */
  soon: (task: SyncTask) => void;
}

export function createSyncRunner(
  delayMs: number,
  schedule: Schedule = timeout
): SyncRunner {
  let running: Promise<void> | undefined;
  let waiting: SyncTask | undefined;
  let planned: { cancel: () => void; task: SyncTask } | undefined;

  const drain = async () => {
    try {
      while (waiting) {
        const task = waiting;
        waiting = undefined;
        await task();
      }
    } finally {
      running = undefined;
    }
  };

  const unplan = () => {
    planned?.cancel();
    planned = undefined;
  };

  const now = (task: SyncTask) => {
    // The sync about to run sends every change made so far.
    unplan();
    waiting = task;
    if (!running) {
      running = drain();
    }
    return running;
  };

  const soon = (task: SyncTask) => {
    unplan();
    const cancel = schedule(() => {
      planned = undefined;
      now(task);
    }, delayMs);
    planned = { cancel, task };
  };

  const flush = () => {
    if (planned) {
      now(planned.task);
    }
  };

  const cancel = () => {
    unplan();
    waiting = undefined;
  };

  return { cancel, flush, now, soon };
}
