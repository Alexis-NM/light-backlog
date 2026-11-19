import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Game, GameList, SortMode, StoredRatings } from "@/core/game";
import {
  reorderLists,
  sortLists,
  topPosition,
  withFields,
  withGames,
  withoutGames,
  withRatings,
} from "@/core/lists";
import { deletedItems, deletedLists } from "@/core/syncClient";
import {
  loadLists,
  removeAllLists,
  removeList,
  saveAllLists,
  saveList,
  saveListOrder,
} from "@/services/listStorage";
import { saveInBackground } from "@/services/saveFailures";
import { notifyLocalChange, recordDeletions } from "@/services/syncStore";

interface ListsContextType {
  addGamesToList: (listId: string, games: Game[]) => void;
  addGameToList: (listId: string, game: Game) => void;
  clearAll: () => void;
  /** Stores what the sync merged. */
  commitFromSync: (lists: GameList[]) => void;
  createList: (name: string) => string;
  createListWithGames: (
    name: string,
    games: Game[],
    consoles?: string[]
  ) => string;
  deleteList: (id: string) => void;
  getList: (id: string) => GameList | undefined;
  /** The latest lists, maybe not rendered yet. */
  getLists: () => GameList[];
  lists: GameList[];
  /** The saved lists have been read. */
  loaded: boolean;
  moveList: (id: string, direction: "down" | "up") => void;
  removeGameFromList: (listId: string, gameId: number) => void;
  removeGamesFromList: (listId: string, gameIds: number[]) => void;
  renameList: (id: string, name: string) => void;
  replaceAll: (lists: GameList[]) => Promise<void>;
  /** Stores IGDB ratings by game id in every list that holds the game. */
  setIgdbRatings: (ratings: Record<number, StoredRatings>) => void;
  setListConsoles: (id: string, consoles: string[]) => void;
  setListSort: (id: string, sort: SortMode) => void;
  /** The saved lists are there but could not be read: nothing changes them. */
  unreadable: boolean;
}

const ListsContext = createContext<ListsContextType>({
  lists: [],
  loaded: false,
  unreadable: false,
  getList: () => undefined,
  getLists: () => [],
  createList: () => "",
  createListWithGames: () => "",
  deleteList: () => undefined,
  addGameToList: () => undefined,
  addGamesToList: () => undefined,
  moveList: () => undefined,
  removeGameFromList: () => undefined,
  removeGamesFromList: () => undefined,
  renameList: () => undefined,
  replaceAll: () => Promise.resolve(),
  commitFromSync: () => undefined,
  setIgdbRatings: () => undefined,
  setListConsoles: () => undefined,
  setListSort: () => undefined,
  clearAll: () => undefined,
});

export const useLists = () => useContext(ListsContext);

function makeId() {
  return `list_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Writes the lists that changed, removes the ones gone, and keeps the order. */
function saveChanges(before: GameList[], after: GameList[]) {
  const previous = new Map(before.map((list) => [list.id, list]));
  const kept = new Set(after.map((list) => list.id));
  for (const list of after) {
    if (previous.get(list.id) !== list) {
      saveInBackground(saveList(list));
    }
  }
  for (const list of before) {
    if (!kept.has(list.id)) {
      saveInBackground(removeList(list.id));
    }
  }
  saveInBackground(saveListOrder(after));
}

export const ListsProvider = ({ children }: { children: ReactNode }) => {
  // Always in display order.
  const [lists, setLists] = useState<GameList[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  // Changes start from the latest lists, not the rendered ones, so that a
  // sync and a tap in the same tick cannot undo each other.
  const latest = useRef(lists);

  const commit = useCallback((next: GameList[]) => {
    latest.current = next;
    setLists(next);
  }, []);

  /** A change the user makes: the sync sends it a moment later. */
  const change = useCallback(
    (next: GameList[]) => {
      commit(next);
      notifyLocalChange();
    },
    [commit]
  );

  useEffect(() => {
    loadLists()
      .then((stored) => {
        commit(stored);
        setLoaded(true);
      })
      // They stay as they are in storage, and nothing is written over them.
      .catch(() => setUnreadable(true));
  }, [commit]);

  const getList = useCallback(
    (id: string) => lists.find((list) => list.id === id),
    [lists]
  );

  const getLists = useCallback(() => latest.current, []);

  const insertList = useCallback(
    (name: string, games: Game[], consoles?: string[]) => {
      // Before the saved lists are read, a new one would take their place.
      if (!loaded) {
        return "";
      }
      const current = latest.current;
      const now = Date.now();
      const list = withGames(
        {
          id: makeId(),
          name: name.trim(),
          items: {},
          consoles: consoles && consoles.length > 0 ? consoles : undefined,
          createdAt: now,
          updatedAt: now,
          position: topPosition(current),
        },
        games,
        now
      );
      const next = [list, ...current];
      change(next);
      saveInBackground(saveList(list));
      saveInBackground(saveListOrder(next));
      return list.id;
    },
    [change, loaded]
  );

  const updateList = useCallback(
    (id: string, update: (list: GameList) => GameList) => {
      const current = latest.current;
      const list = current.find((one) => one.id === id);
      if (!list) {
        return;
      }
      const updated = update(list);
      if (updated === list) {
        return;
      }
      change(current.map((one) => (one.id === id ? updated : one)));
      saveInBackground(saveList(updated));
    },
    [change]
  );

  const createList = useCallback(
    (name: string) => insertList(name, []),
    [insertList]
  );

  const createListWithGames = useCallback(
    (name: string, games: Game[], consoles?: string[]) =>
      insertList(name, games, consoles),
    [insertList]
  );

  const renameList = useCallback(
    (id: string, name: string) =>
      updateList(id, (list) =>
        withFields(list, { name: name.trim() }, Date.now())
      ),
    [updateList]
  );

  const setListConsoles = useCallback(
    (id: string, consoles: string[]) =>
      updateList(id, (list) =>
        withFields(
          list,
          { consoles: consoles.length > 0 ? consoles : undefined },
          Date.now()
        )
      ),
    [updateList]
  );

  const setListSort = useCallback(
    (id: string, sort: SortMode) =>
      updateList(id, (list) => withFields(list, { sort }, Date.now())),
    [updateList]
  );

  const deleteList = useCallback(
    (id: string) => {
      const current = latest.current;
      const list = current.find((one) => one.id === id);
      if (!list) {
        return;
      }
      recordDeletions(deletedLists([list], Date.now()));
      const next = current.filter((one) => one.id !== id);
      change(next);
      saveInBackground(removeList(id));
      saveInBackground(saveListOrder(next));
    },
    [change]
  );

  const addGameToList = useCallback(
    (listId: string, game: Game) =>
      updateList(listId, (list) => withGames(list, [game], Date.now())),
    [updateList]
  );

  const addGamesToList = useCallback(
    (listId: string, games: Game[]) =>
      updateList(listId, (list) => withGames(list, games, Date.now())),
    [updateList]
  );

  const moveList = useCallback(
    (id: string, direction: "down" | "up") => {
      const current = latest.current;
      const next = reorderLists(current, id, direction, Date.now());
      if (next === current) {
        return;
      }
      const unchanged = new Set(current);
      change(next);
      for (const list of next) {
        if (!unchanged.has(list)) {
          saveInBackground(saveList(list));
        }
      }
      saveInBackground(saveListOrder(next));
    },
    [change]
  );

  const removeGamesFromList = useCallback(
    (listId: string, gameIds: number[]) => {
      const list = latest.current.find((one) => one.id === listId);
      if (list) {
        recordDeletions(deletedItems(list, gameIds, Date.now()));
      }
      updateList(listId, (current) => withoutGames(current, gameIds));
    },
    [updateList]
  );

  const removeGameFromList = useCallback(
    (listId: string, gameId: number) => removeGamesFromList(listId, [gameId]),
    [removeGamesFromList]
  );

  const setIgdbRatings = useCallback(
    (ratings: Record<number, StoredRatings>) => {
      const current = latest.current;
      const next = current.map((list) => withRatings(list, ratings));
      const changed = next.filter((list, index) => list !== current[index]);
      if (changed.length === 0) {
        return;
      }
      commit(next);
      for (const list of changed) {
        saveInBackground(saveList(list));
      }
    },
    [commit]
  );

  const clearAll = useCallback(() => {
    if (!loaded) {
      return;
    }
    const current = latest.current;
    recordDeletions(deletedLists(current, Date.now()));
    change([]);
    saveInBackground(removeAllLists(current));
  }, [change, loaded]);

  // A restore turns sync off first: it records no deletion. It goes through
  // even over lists that could not be read, and its failure is the caller's
  // to tell.
  const replaceAll = useCallback(
    async (restored: GameList[]) => {
      const current = latest.current;
      const next = sortLists(restored);
      commit(next);
      await removeAllLists(current);
      await saveAllLists(next);
      setUnreadable(false);
      setLoaded(true);
    },
    [commit]
  );

  const commitFromSync = useCallback(
    (next: GameList[]) => {
      const current = latest.current;
      if (next === current) {
        return;
      }
      commit(next);
      saveChanges(current, next);
    },
    [commit]
  );

  const value = useMemo(
    () => ({
      lists,
      loaded,
      unreadable,
      getList,
      getLists,
      createList,
      createListWithGames,
      deleteList,
      addGameToList,
      addGamesToList,
      moveList,
      removeGameFromList,
      removeGamesFromList,
      renameList,
      replaceAll,
      commitFromSync,
      setIgdbRatings,
      setListConsoles,
      setListSort,
      clearAll,
    }),
    [
      lists,
      loaded,
      unreadable,
      getList,
      getLists,
      createList,
      createListWithGames,
      setIgdbRatings,
      setListConsoles,
      setListSort,
      deleteList,
      addGameToList,
      addGamesToList,
      moveList,
      removeGameFromList,
      removeGamesFromList,
      renameList,
      replaceAll,
      commitFromSync,
      clearAll,
    ]
  );

  return (
    <ListsContext.Provider value={value}>{children}</ListsContext.Provider>
  );
};
