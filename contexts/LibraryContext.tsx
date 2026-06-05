import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import {
  entryPlatforms,
  type Game,
  type GameStatus,
  type LibraryEntry,
} from "@/types/game";

type Entries = Record<number, LibraryEntry>;

interface LibraryContextType {
  addPlatform: (game: Game, platform: string) => void;
  clearAll: () => void;
  entries: Entries;
  getEntry: (id: number) => LibraryEntry | undefined;
  removeEntry: (id: number) => void;
  setRating: (game: Game, rating: number) => void;
  setStatus: (game: Game, status: GameStatus) => void;
  togglePlatform: (game: Game, platform: string) => void;
}

const LibraryContext = createContext<LibraryContextType>({
  entries: {},
  getEntry: () => undefined,
  setStatus: () => undefined,
  setRating: () => undefined,
  addPlatform: () => undefined,
  togglePlatform: () => undefined,
  removeEntry: () => undefined,
  clearAll: () => undefined,
});

export const useLibrary = () => useContext(LibraryContext);

export const LibraryProvider = ({ children }: { children: ReactNode }) => {
  const [entries, setEntries] = usePersistedState<Entries>("library", {});

  const upsert = useCallback(
    (game: Game, patch: Partial<LibraryEntry>) => {
      const now = Date.now();
      const existing = entries[game.id];
      const next: LibraryEntry = {
        game,
        status: existing?.status ?? "backlog",
        rating: existing?.rating ?? 0,
        platforms: existing ? entryPlatforms(existing) : [],
        addedAt: existing?.addedAt ?? now,
        updatedAt: now,
        ...patch,
      };
      setEntries({ ...entries, [game.id]: next });
    },
    [entries, setEntries]
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
      const existing = entries[game.id];
      const current = existing ? entryPlatforms(existing) : [];
      if (current.includes(platform)) {
        upsert(game, { platforms: current });
        return;
      }
      upsert(game, { platforms: [...current, platform] });
    },
    [entries, upsert]
  );

  const togglePlatform = useCallback(
    (game: Game, platform: string) => {
      const existing = entries[game.id];
      const current = existing ? entryPlatforms(existing) : [];
      const next = current.includes(platform)
        ? current.filter((p) => p !== platform)
        : [...current, platform];
      upsert(game, { platforms: next });
    },
    [entries, upsert]
  );

  const removeEntry = useCallback(
    (id: number) => {
      const next = { ...entries };
      delete next[id];
      setEntries(next);
    },
    [entries, setEntries]
  );

  const clearAll = useCallback(() => setEntries({}), [setEntries]);

  const getEntry = useCallback((id: number) => entries[id], [entries]);

  const value = useMemo(
    () => ({
      entries,
      getEntry,
      setStatus,
      setRating,
      addPlatform,
      togglePlatform,
      removeEntry,
      clearAll,
    }),
    [
      entries,
      getEntry,
      setStatus,
      setRating,
      addPlatform,
      togglePlatform,
      removeEntry,
      clearAll,
    ]
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
};
