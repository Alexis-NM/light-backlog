// A change shows at once and is saved in the background. When a save fails
// (storage full, or failing), what is on screen is ahead of what is stored.
// The failure is kept here, outside React, for the screens to tell the user
// instead of losing the change in silence at the next launch.

let failed = false;
const listeners = new Set<() => void>();

/** Whether a save failed since the app was opened. */
export const hasSaveFailed = () => failed;

/** For the screens, to hear about the first failure. Returns what stops it. */
export function watchSaveFailures(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportSaveFailure() {
  if (failed) {
    return;
  }
  failed = true;
  for (const listener of listeners) {
    listener();
  }
}

/** For a save nobody waits for: its failure is reported instead of lost. */
export function saveInBackground(save: Promise<unknown>) {
  save.catch(reportSaveFailure);
}
