import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";
import {
  entryPlatforms,
  type Game,
  type GameStatus,
  type LibraryEntry,
  type StoredRatings,
  sameRatings,
} from "@/core/game";
import { deletedEntries } from "@/core/syncClient";
import { usePersistedState } from "@/hooks/usePersistedState";
import { notifyLocalChange, recordDeletions } from "@/services/syncStore";

type Entries = Record<number, LibraryEntry>;

interface LibraryContextType {
  addMany: (games: Game[], status: GameStatus, platforms?: string[]) => void;
  addPlatform: (game: Game, platform: string) => void;
  clearAll: () => void;
  /** Stores what the sync merged. */
  commitFromSync: (entries: Entries) => void;
  entries: Entries;
  /** The latest entries, maybe not rendered yet. */
  getEntries: () => Entries;
  getEntry: (id: number) => LibraryEntry | undefined;
  /** The saved library has been read. */
  loaded: boolean;
  removeEntry: (id: number) => void;
  removeMany: (ids: number[]) => void;
  replaceAll: (entries: Entries) => Promise<void>;
  /** Stores IGDB ratings by game id without touching the entries' dates. */
  setIgdbRatings: (ratings: Record<number, StoredRatings>) => void;
  setRating: (game: Game, rating: number) => void;
  setStatus: (game: Game, status: GameStatus) => void;
  setStatusMany: (ids: number[], status: GameStatus) => void;
  togglePlatform: (game: Game, platform: string) => void;
}

const LibraryContext = createContext<LibraryContextType>({
  entries: {},
  loaded: false,
  getEntry: () => undefined,
  getEntries: () => ({}),
  setStatus: () => undefined,
  setRating: () => undefined,
  addMany: () => undefined,
  addPlatform: () => undefined,
  togglePlatform: () => undefined,
  removeEntry: () => undefined,
  removeMany: () => undefined,
  replaceAll: () => Promise.resolve(),
  commitFromSync: () => undefined,
  setIgdbRatings: () => undefined,
  setStatusMany: () => undefined,
  clearAll: () => undefined,
});

export const useLibrary = () => useContext(LibraryContext);

export const LibraryProvider = ({ children }: { children: ReactNode }) => {
  const [entries, setEntries, { getLatest, loaded }] =
    usePersistedState<Entries>("library", {});

  // Changes start from the latest entries, not the rendered ones, so that a
  // sync and a tap in the same tick cannot undo each other.

  /** A change the user makes: the sync sends it a moment later. */
  const change = useCallback(
    (next: Entries) => {
      setEntries(next);
      notifyLocalChange();
    },
    [setEntries]
  );

  const upsert = useCallback(
    (game: Game, patch: Partial<LibraryEntry>) => {
      const current = getLatest();
      const now = Date.now();
      const existing = current[game.id];
      const next: LibraryEntry = {
        game,
        status: existing?.status ?? "backlog",
        rating: existing?.rating ?? 0,
        platforms: existing ? entryPlatforms(existing) : [],
        addedAt: existing?.addedAt ?? now,
        updatedAt: now,
        ...patch,
      };
      change({ ...current, [game.id]: next });
    },
    [change, getLatest]
  );

  const setStatus = useCallback(
    (game: Game, status: GameStatus) => upsert(game, { status }),
    [upsert]
  );

  const setRating = useCallback(
    (game: Game, rating: number) => upsert(game, { rating }),
    [upsert]
  );

  const addPlatform = useCallback(
    (game: Game, platform: string) => {
      const existing = getLatest()[game.id];
      const current = existing ? entryPlatforms(existing) : [];
      if (current.includes(platform)) {
        upsert(game, { platforms: current });
        return;
      }
      upsert(game, { platforms: [...current, platform] });
    },
    [getLatest, upsert]
  );

  const togglePlatform = useCallback(
    (game: Game, platform: string) => {
      const existing = getLatest()[game.id];
      const current = existing ? entryPlatforms(existing) : [];
      const next = current.includes(platform)
        ? current.filter((p) => p !== platform)
        : [...current, platform];
      upsert(game, { platforms: next });
    },
    [getLatest, upsert]
  );

  const addMany = useCallback(
    (games: Game[], status: GameStatus, platforms?: string[]) => {
      const now = Date.now();
      const next = { ...getLatest() };
      for (const game of games) {
        const existing = next[game.id];
        const current = existing ? entryPlatforms(existing) : [];
        const merged = platforms
          ? Array.from(new Set([...current, ...platforms]))
          : current;
        next[game.id] = {
          game,
          status: existing?.status ?? status,
          rating: existing?.rating ?? 0,
          platforms: merged,
          addedAt: existing?.addedAt ?? now,
          updatedAt: now,
        };
      }
      change(next);
    },
    [change, getLatest]
  );

  const removeMany = useCallback(
    (ids: number[]) => {
      const current = getLatest();
      const removed = ids
        .map((id) => current[id])
        .filter((entry): entry is LibraryEntry => entry !== undefined);
      if (removed.length === 0) {
        return;
      }
      recordDeletions(deletedEntries(removed, Date.now()));
      const next = { ...current };
      for (const entry of removed) {
        delete next[entry.game.id];
      }
      change(next);
    },
    [change, getLatest]
  );

  const removeEntry = useCallback(
    (id: number) => removeMany([id]),
    [removeMany]
  );

  const setStatusMany = useCallback(
    (ids: number[], status: GameStatus) => {
      const now = Date.now();
      const next = { ...getLatest() };
      for (const id of ids) {
        const existing = next[id];
        if (existing) {
          next[id] = { ...existing, status, updatedAt: now };
        }
      }
      change(next);
    },
    [change, getLatest]
  );

  const setIgdbRatings = useCallback(
    (ratings: Record<number, StoredRatings>) => {
      const next = { ...getLatest() };
      let changed = false;
      for (const [key, stored] of Object.entries(ratings)) {
        const existing = next[Number(key)];
        if (existing && !sameRatings(existing.game, stored)) {
          next[Number(key)] = {
            ...existing,
            game: { ...existing.game, ...stored },
          };
          changed = true;
        }
      }
      if (changed) {
        setEntries(next);
      }
    },
    [getLatest, setEntries]
  );

  const clearAll = useCallback(() => {
    recordDeletions(deletedEntries(Object.values(getLatest()), Date.now()));
    change({});
  }, [change, getLatest]);

  // A restore turns sync off first: it records no deletion.
  const replaceAll = useCallback(
    (next: Entries) => setEntries(next),
    [setEntries]
  );

  const commitFromSync = useCallback(
    (next: Entries) => {
      if (next !== getLatest()) {
        setEntries(next);
      }
    },
    [getLatest, setEntries]
  );

  const getEntry = useCallback((id: number) => entries[id], [entries]);

  const value = useMemo(
    () => ({
      entries,
      loaded,
      getEntry,
      getEntries: getLatest,
      setStatus,
      setRating,
      addMany,
      addPlatform,
      togglePlatform,
      removeEntry,
      removeMany,
      replaceAll,
      commitFromSync,
      setIgdbRatings,
      setStatusMany,
      clearAll,
    }),
    [
      entries,
      loaded,
      getEntry,
      getLatest,
      setStatus,
      setRating,
      removeMany,
      setIgdbRatings,
      setStatusMany,
      addMany,
      addPlatform,
      togglePlatform,
      removeEntry,
      replaceAll,
      commitFromSync,
      clearAll,
    ]
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
};
