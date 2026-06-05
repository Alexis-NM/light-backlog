import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import type { Game, GameStatus, LibraryEntry } from "@/types/game";

type Entries = Record<number, LibraryEntry>;

interface LibraryContextType {
  clearAll: () => void;
  entries: Entries;
  getEntry: (id: number) => LibraryEntry | undefined;
  removeEntry: (id: number) => void;
  setPlatform: (game: Game, platform: string) => void;
  setRating: (game: Game, rating: number, platform?: string) => void;
  setStatus: (game: Game, status: GameStatus, platform?: string) => void;
}

const LibraryContext = createContext<LibraryContextType>({
  entries: {},
  getEntry: () => undefined,
  setStatus: () => undefined,
  setRating: () => undefined,
  setPlatform: () => undefined,
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
        platform: existing?.platform,
        addedAt: existing?.addedAt ?? now,
        updatedAt: now,
        ...patch,
      };
      setEntries({ ...entries, [game.id]: next });
    },
    [entries, setEntries]
  );

  const setStatus = useCallback(
    (game: Game, status: GameStatus, platform?: string) =>
      upsert(game, platform ? { status, platform } : { status }),
    [upsert]
  );

  const setRating = useCallback(
    (game: Game, rating: number, platform?: string) =>
      upsert(game, platform ? { rating, platform } : { rating }),
    [upsert]
  );

  const setPlatform = useCallback(
    (game: Game, platform: string) => upsert(game, { platform }),
    [upsert]
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
      setPlatform,
      removeEntry,
      clearAll,
    }),
    [
      entries,
      getEntry,
      setStatus,
      setRating,
      setPlatform,
      removeEntry,
      clearAll,
    ]
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
};
