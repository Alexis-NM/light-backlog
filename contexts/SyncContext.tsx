import { File, Paths } from "expo-file-system";
import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLists } from "@/contexts/ListsContext";
import { parseBackup, serializeBackup } from "@/core/backup";
import type { IgdbRelay } from "@/core/igdb";
import {
  checkConnection,
  createTransport,
  hasPendingChanges,
  isTransient,
  newSyncState,
  SyncFailure,
  type SyncFailureKind,
  syncEndpoint,
  syncOnce,
} from "@/core/syncClient";
import { createSyncRunner, type SyncOutcome } from "@/core/syncRunner";
import { useBackup } from "@/hooks/useBackup";
import {
  getSyncState,
  type SyncSignal,
  setSyncState,
  syncStateLoaded,
  watchSyncSignals,
} from "@/services/syncStore";

const ENDPOINT_KEY = "sync_endpoint";
const TOKEN_KEY = "sync_token";
const API_PATH = /\/api\/sync$/;

/** How long the changes must stop before the sync that sends them. */
const CHANGE_DELAY_MS = 3000;
/** A screen that comes into view syncs only when no sync started for this long. */
const FRESH_MS = 30_000;
/** The waits before trying a failed sync again: 30 s, 1 min, 2 min, then every 5 min. */
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000];

// Written at the first connection, in case the first merge is not what was
// expected. It stays in the app's own storage.
const copyFile = () => new File(Paths.document, "backlog-before-sync.json");

/** What can go wrong, for the screens to explain. */
export type SyncProblem = SyncFailureKind | "address" | "copy";

export interface SyncStatus {
  lastSyncedAt?: number;
  phase: "error" | "idle" | "off" | "syncing";
  problem?: SyncFailureKind;
  /** Invalid elements left out of the last sync. */
  skipped: number;
}

interface Server {
  endpoint: string;
  token: string;
}

interface SyncContextType {
  /** Checks an address and a token without syncing anything. */
  check: (address: string, token: string) => Promise<SyncProblem | undefined>;
  /** Copies the data, saves the server, then syncs for the first time. */
  connect: (address: string, token: string) => Promise<SyncProblem | undefined>;
  /** Turns sync off. The data stays on the phone. */
  disconnect: () => Promise<void>;
  /** A copy of the data from before the first sync is kept. */
  hasCopy: boolean;
  /** IGDB through the sync server, with the sync token; null while sync is off. */
  igdbRelay: IgdbRelay | null;
  /** Turns sync off, then puts back the data from before the first sync. */
  restoreCopy: () => Promise<void>;
  /** The server's address, null while sync is off. */
  serverAddress: string | null;
  status: SyncStatus;
  syncNow: () => Promise<void>;
}

const OFF: SyncStatus = { phase: "off", skipped: 0 };

const SyncContext = createContext<SyncContextType>({
  check: () => Promise.resolve(undefined),
  connect: () => Promise.resolve(undefined),
  disconnect: () => Promise.resolve(),
  hasCopy: false,
  igdbRelay: null,
  restoreCopy: () => Promise.resolve(),
  serverAddress: null,
  status: OFF,
  syncNow: () => Promise.resolve(),
});

export const useSync = () => useContext(SyncContext);

const problemOf = (error: unknown): SyncFailureKind =>
  error instanceof SyncFailure ? error.kind : "server";

/** The status once sync stopped, unless it was turned off meanwhile. */
const settledStatus = (status: Omit<SyncStatus, "lastSyncedAt">) => {
  const state = getSyncState();
  return state ? { ...status, lastSyncedAt: state.lastSyncedAt } : OFF;
};

export const SyncProvider = ({ children }: { children: ReactNode }) => {
  const {
    commitFromSync: commitLibrary,
    getEntries,
    loaded: libraryLoaded,
  } = useLibrary();
  const {
    commitFromSync: commitLists,
    getLists,
    loaded: listsLoaded,
  } = useLists();
  const { buildBackup, restoreBackup } = useBackup();
  const [server, setServer] = useState<Server | null>(null);
  // The server syncs are for, known at once. A sync started for another one,
  // or before a disconnection, finds sync off: it stops and commits nothing.
  const current = useRef<Server | null>(null);
  const switchTo = useCallback((next: Server | null) => {
    current.current = next;
    setServer(next);
  }, []);
  const [serverLoaded, setServerLoaded] = useState(false);
  const [status, setStatus] = useState<SyncStatus>(OFF);
  const [hasCopy, setHasCopy] = useState(() => copyFile().exists);
  // getEntries and getLists never change: they give the latest data.
  const [runner] = useState(() =>
    createSyncRunner({
      changeDelayMs: CHANGE_DELAY_MS,
      freshMs: FRESH_MS,
      hasPending: () => {
        const state = getSyncState();
        return (
          state !== null &&
          hasPendingChanges({ library: getEntries(), lists: getLists() }, state)
        );
      },
      retryDelaysMs: RETRY_DELAYS_MS,
    })
  );

  useEffect(() => {
    Promise.all([
      getItemAsync(ENDPOINT_KEY),
      getItemAsync(TOKEN_KEY),
      syncStateLoaded,
    ])
      .then(([endpoint, token]) => {
        if (endpoint && token) {
          // Without its state, sync starts over: the merge keeps everything.
          if (!getSyncState()) {
            setSyncState(newSyncState());
          }
          switchTo({ endpoint, token });
          setStatus(settledStatus({ phase: "idle", skipped: 0 }));
        } else if (getSyncState()) {
          setSyncState(null);
        }
      })
      .catch(() => {
        // Keychain unavailable: sync stays off.
      })
      .finally(() => setServerLoaded(true));
  }, [switchTo]);

  /** One sync, whose outcome goes into the status. The runner starts it. */
  const syncWith = useCallback(
    async (target: Server): Promise<SyncOutcome> => {
      setStatus((current) => ({
        ...current,
        phase: "syncing",
        problem: undefined,
      }));
      const isCurrent = () => current.current === target;
      /** The outcome of a sync for another server says nothing of this one. */
      const settled = (outcome: Omit<SyncStatus, "lastSyncedAt">) => {
        if (isCurrent()) {
          setStatus(settledStatus(outcome));
        }
      };
      try {
        const { skipped } = await syncOnce({
          getLocal: () => ({ library: getEntries(), lists: getLists() }),
          getState: () => (isCurrent() ? getSyncState() : null),
          commit: (local, state) => {
            commitLibrary(local.library);
            commitLists(local.lists);
            setSyncState(state);
          },
          post: createTransport(target.endpoint, target.token),
        });
        settled({ phase: "idle", skipped });
        return "done";
      } catch (error) {
        const problem = problemOf(error);
        settled({ phase: "error", problem, skipped: 0 });
        return isTransient(problem) ? "retry" : "done";
      }
    },
    [commitLibrary, commitLists, getEntries, getLists]
  );

  const syncNow = useCallback(async () => {
    if (server) {
      await runner.now(() => syncWith(server));
    }
  }, [runner, server, syncWith]);

  // When the app opens, once its data is read; each time it comes back to
  // the foreground; when a screen comes into view, unless a sync started in
  // the last 30 s; and a moment after the user changes the library or the
  // lists (a burst of changes makes one sync, sent at once if the app leaves
  // the foreground). A sync that fails while changes wait is tried again
  // while the app stays in the foreground. Nothing else, so that the
  // server's database can sleep. Without a server, nothing goes out.
  const ready = serverLoaded && libraryLoaded && listsLoaded;
  const onActive = useEffectEvent(() => {
    syncNow();
  });
  const onSignal = useEffectEvent((signal: SyncSignal) => {
    if (!server) {
      return;
    }
    const task = () => syncWith(server);
    if (signal === "change") {
      runner.soon(task);
    } else {
      runner.ifStale(task);
    }
  });
  useEffect(() => {
    if (!ready) {
      return;
    }
    onActive();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        runner.foreground();
        onActive();
      } else {
        runner.background();
      }
    });
    const stopWatching = watchSyncSignals((signal) => onSignal(signal));
    return () => {
      subscription.remove();
      stopWatching();
      runner.cancel();
    };
  }, [ready, runner]);

  const check = useCallback(async (address: string, token: string) => {
    const endpoint = syncEndpoint(address);
    if (!endpoint) {
      return "address";
    }
    try {
      await checkConnection(createTransport(endpoint, token.trim()));
    } catch (error) {
      return problemOf(error);
    }
  }, []);

  const connect = useCallback(
    async (address: string, token: string) => {
      const endpoint = syncEndpoint(address);
      if (!endpoint) {
        return "address";
      }
      const target = { endpoint, token: token.trim() };
      try {
        await checkConnection(createTransport(target.endpoint, target.token));
      } catch (error) {
        return problemOf(error);
      }
      if (Object.keys(getEntries()).length > 0 || getLists().length > 0) {
        try {
          const file = copyFile();
          file.create({ overwrite: true });
          file.write(serializeBackup(buildBackup(false)));
          setHasCopy(true);
        } catch {
          return "copy";
        }
      }
      await setItemAsync(ENDPOINT_KEY, target.endpoint);
      await setItemAsync(TOKEN_KEY, target.token);
      await setSyncState(newSyncState());
      switchTo(target);
      await runner.now(() => syncWith(target));
    },
    [buildBackup, getEntries, getLists, runner, switchTo, syncWith]
  );

  const disconnect = useCallback(async () => {
    runner.cancel();
    await setSyncState(null);
    await Promise.all([
      deleteItemAsync(ENDPOINT_KEY),
      deleteItemAsync(TOKEN_KEY),
    ]);
    switchTo(null);
    setStatus(OFF);
  }, [runner, switchTo]);

  const restoreCopy = useCallback(async () => {
    const backup = parseBackup(await copyFile().text());
    await disconnect();
    await restoreBackup(backup);
  }, [disconnect, restoreBackup]);

  // One object while the server stays the same: screens compare it.
  const igdbRelay = useMemo<IgdbRelay | null>(
    () =>
      server
        ? { server: server.endpoint.replace(API_PATH, ""), token: server.token }
        : null,
    [server]
  );

  const value = useMemo(
    () => ({
      check,
      connect,
      disconnect,
      hasCopy,
      igdbRelay,
      restoreCopy,
      serverAddress: igdbRelay?.server ?? null,
      status,
      syncNow,
    }),
    [
      check,
      connect,
      disconnect,
      hasCopy,
      igdbRelay,
      restoreCopy,
      status,
      syncNow,
    ]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};
