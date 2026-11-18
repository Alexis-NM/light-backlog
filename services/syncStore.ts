import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRecord } from "@/core/backup";
import type { SyncChanges } from "@/core/sync";
import { addTombstones, type SyncState } from "@/core/syncClient";

// The sync state lives here, outside React: the library and the lists record
// their deletions in it, and the sync reads and writes it. While sync is off
// there is none, and a deletion leaves no trace. The library and the lists
// also say here when the user changes them, for the sync to follow.

const KEY = "sync:state";

let state: SyncState | null = null;
let loaded = false;
const onLoad: (() => void)[] = [];
let writing: Promise<void> = Promise.resolve();
const changeListeners = new Set<() => void>();

const isState = (value: unknown): value is SyncState =>
  isRecord(value) &&
  typeof value.cursor === "number" &&
  isRecord(value.synced) &&
  isRecord(value.tombstones);

function save(): Promise<void> {
  const snapshot = state;
  // Writes go in order; a failed one is made good by the next.
  writing = writing
    .then(() =>
      snapshot
        ? AsyncStorage.setItem(KEY, JSON.stringify(snapshot))
        : AsyncStorage.removeItem(KEY)
    )
    .catch(() => undefined);
  return writing;
}

/** Resolves once the saved state has been read. */
export const syncStateLoaded: Promise<void> = AsyncStorage.getItem(KEY)
  .then((raw) => {
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    state = isState(parsed) ? parsed : null;
  })
  .catch(() => undefined)
  .finally(() => {
    loaded = true;
    for (const run of onLoad.splice(0)) {
      run();
    }
  });

/** null while sync is off. */
export const getSyncState = () => state;

export function setSyncState(next: SyncState | null): Promise<void> {
  state = next;
  return save();
}

/** Keeps what the user deleted, for the next sync. Does nothing while sync is off. */
export function recordDeletions(deleted: Partial<SyncChanges>) {
  const record = () => {
    if (state) {
      state = {
        ...state,
        tombstones: addTombstones(state.tombstones, deleted),
      };
      save();
    }
  };
  if (loaded) {
    record();
  } else {
    onLoad.push(record);
  }
}

/** For the sync, to hear about the user's changes. Returns what stops it. */
export function watchLocalChanges(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

/** Called after each change the user makes to the library or the lists, for the sync to send it. Does nothing while sync is off. */
export function notifyLocalChange() {
  if (state) {
    for (const listener of changeListeners) {
      listener();
    }
  }
}
