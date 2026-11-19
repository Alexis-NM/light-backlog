import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";
import {
  changeTime,
  entryPlatforms,
  type Game,
  type GameStatus,
  type LibraryEntry,
  type StoredRatings,
  sameRatings,
} from "@/core/game";
import { deletedEntries } from "@/core/syncClient";
import { usePersistedState } from "@/hooks/usePersistedState";
import { saveInBackground } from "@/services/saveFailures";
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
  /** The saved library is there but could not be read: nothing changes it. */
  unreadable: boolean;
}

const LibraryContext = createContext<LibraryContextType>({
  entries: {},
  loaded: false,
  unreadable: false,
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
  const [entries, setEntries, { getLatest, loaded, unreadable }] =
    usePersistedState<Entries>("library", {});

  // Changes start from the latest entries, not the rendered ones, so that a
  // sync and a tap in the same tick cannot undo each other.

  /** Shown at once, saved in the background. */
  const save = useCallback(
    (next: Entries) => saveInBackground(setEntries(next)),
    [setEntries]
  );

  /**
   * A change the user makes, with the entries it removes: the sync sends it
   * a moment later. Refused until the saved library has been read: it would
   * be written over it.
   */
  const change = useCallback(
    (next: Entries, removed: LibraryEntry[] = []) => {
      if (!loaded) {
        return;
      }
      if (removed.length > 0) {
        recordDeletions(deletedEntries(removed, Date.now()));
      }
      save(next);
      notifyLocalChange();
    },
    [loaded, save]
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
        updatedAt: changeTime(now, existing),
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
          updatedAt: changeTime(now, existing),
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
      const next = { ...current };
      for (const entry of removed) {
        delete next[entry.game.id];
      }
      change(next, removed);
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
          next[id] = {
            ...existing,
            status,
            updatedAt: changeTime(now, existing),
          };
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
        save(next);
      }
    },
    [getLatest, save]
  );

  const clearAll = useCallback(
    () => change({}, Object.values(getLatest())),
    [change, getLatest]
  );

  // A restore turns sync off first: it records no deletion. It goes through
  // even over a library that could not be read, and its failure is the
  // caller's to tell.
  const replaceAll = useCallback(
    (next: Entries) => setEntries(next),
    [setEntries]
  );

  const commitFromSync = useCallback(
    (next: Entries) => {
      if (next !== getLatest()) {
        save(next);
      }
    },
    [getLatest, save]
  );

  const getEntry = useCallback((id: number) => entries[id], [entries]);

  const value = useMemo(
    () => ({
      entries,
      loaded,
      unreadable,
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
      unreadable,
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
