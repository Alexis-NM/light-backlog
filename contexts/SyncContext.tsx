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
  newSyncState,
  SyncFailure,
  type SyncFailureKind,
  syncEndpoint,
  syncOnce,
} from "@/core/syncClient";
import { useBackup } from "@/hooks/useBackup";
import {
  getSyncState,
  setSyncState,
  syncStateLoaded,
} from "@/services/syncStore";

const ENDPOINT_KEY = "sync_endpoint";
const TOKEN_KEY = "sync_token";
const API_PATH = /\/api\/sync$/;

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
  const [serverLoaded, setServerLoaded] = useState(false);
  const [status, setStatus] = useState<SyncStatus>(OFF);
  const [hasCopy, setHasCopy] = useState(() => copyFile().exists);
  const running = useRef(false);
  const again = useRef(false);

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
          setServer({ endpoint, token });
          setStatus(settledStatus({ phase: "idle", skipped: 0 }));
        } else if (getSyncState()) {
          setSyncState(null);
        }
      })
      .catch(() => {
        // Keychain unavailable: sync stays off.
      })
      .finally(() => setServerLoaded(true));
  }, []);

  const run = useCallback(
    async (target: Server) => {
      // A sync asked for meanwhile runs right after this one.
      if (running.current) {
        again.current = true;
        return;
      }
      running.current = true;
      setStatus((current) => ({
        ...current,
        phase: "syncing",
        problem: undefined,
      }));
      let skipped = 0;
      try {
        do {
          again.current = false;
          const result = await syncOnce({
            getLocal: () => ({ library: getEntries(), lists: getLists() }),
            getState: getSyncState,
            commit: (local, state) => {
              commitLibrary(local.library);
              commitLists(local.lists);
              setSyncState(state);
            },
            post: createTransport(target.endpoint, target.token),
          });
          skipped = result.skipped;
        } while (again.current);
        setStatus(settledStatus({ phase: "idle", skipped }));
      } catch (error) {
        setStatus(
          settledStatus({ phase: "error", problem: problemOf(error), skipped })
        );
      } finally {
        running.current = false;
      }
    },
    [commitLibrary, commitLists, getEntries, getLists]
  );

  const syncNow = useCallback(async () => {
    if (server) {
      await run(server);
    }
  }, [run, server]);

  // When the app opens, once its data is read, and each time it comes back
  // to the foreground. Without a server, nothing goes out.
  const ready = serverLoaded && libraryLoaded && listsLoaded;
  const onActive = useEffectEvent(() => {
    syncNow();
  });
  useEffect(() => {
    if (!ready) {
      return;
    }
    onActive();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        onActive();
      }
    });
    return () => subscription.remove();
  }, [ready]);

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
      setServer(target);
      await run(target);
    },
    [buildBackup, getEntries, getLists, run]
  );

  const disconnect = useCallback(async () => {
    await setSyncState(null);
    await Promise.all([
      deleteItemAsync(ENDPOINT_KEY),
      deleteItemAsync(TOKEN_KEY),
    ]);
    setServer(null);
    setStatus(OFF);
  }, []);

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
