import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import {
  loadLists,
  removeAllLists,
  removeList,
  saveAllLists,
  saveList,
  saveListOrder,
} from "@/services/listStorage";

interface ListsContextType {
  addGamesToList: (listId: string, games: Game[]) => void;
  addGameToList: (listId: string, game: Game) => void;
  clearAll: () => void;
  createList: (name: string) => string;
  createListWithGames: (
    name: string,
    games: Game[],
    consoles?: string[]
  ) => string;
  deleteList: (id: string) => void;
  getList: (id: string) => GameList | undefined;
  lists: GameList[];
  moveList: (id: string, direction: "down" | "up") => void;
  removeGameFromList: (listId: string, gameId: number) => void;
  removeGamesFromList: (listId: string, gameIds: number[]) => void;
  renameList: (id: string, name: string) => void;
  replaceAll: (lists: GameList[]) => Promise<void>;
  /** Stores IGDB ratings by game id in every list that holds the game. */
  setIgdbRatings: (ratings: Record<number, StoredRatings>) => void;
  setListConsoles: (id: string, consoles: string[]) => void;
  setListSort: (id: string, sort: SortMode) => void;
}

const ListsContext = createContext<ListsContextType>({
  lists: [],
  getList: () => undefined,
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
  setIgdbRatings: () => undefined,
  setListConsoles: () => undefined,
  setListSort: () => undefined,
  clearAll: () => undefined,
});

export const useLists = () => useContext(ListsContext);

function makeId() {
  return `list_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const ListsProvider = ({ children }: { children: ReactNode }) => {
  // Always in display order.
  const [lists, setLists] = useState<GameList[]>([]);

  useEffect(() => {
    loadLists().then(setLists);
  }, []);

  const getList = useCallback(
    (id: string) => lists.find((list) => list.id === id),
    [lists]
  );

  const insertList = useCallback(
    (name: string, games: Game[], consoles?: string[]) => {
      const now = Date.now();
      const list = withGames(
        {
          id: makeId(),
          name: name.trim(),
          items: {},
          consoles: consoles && consoles.length > 0 ? consoles : undefined,
          createdAt: now,
          updatedAt: now,
          position: topPosition(lists),
        },
        games,
        now
      );
      const next = [list, ...lists];
      setLists(next);
      saveList(list);
      saveListOrder(next);
      return list.id;
    },
    [lists]
  );

  const updateList = useCallback(
    (id: string, update: (list: GameList) => GameList) => {
      const current = lists.find((list) => list.id === id);
      if (!current) {
        return;
      }
      const updated = update(current);
      if (updated === current) {
        return;
      }
      setLists(lists.map((list) => (list.id === id ? updated : list)));
      saveList(updated);
    },
    [lists]
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
      const next = lists.filter((list) => list.id !== id);
      setLists(next);
      removeList(id);
      saveListOrder(next);
    },
    [lists]
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
      const next = reorderLists(lists, id, direction, Date.now());
      if (next === lists) {
        return;
      }
      const unchanged = new Set(lists);
      setLists(next);
      for (const list of next) {
        if (!unchanged.has(list)) {
          saveList(list);
        }
      }
      saveListOrder(next);
    },
    [lists]
  );

  const removeGameFromList = useCallback(
    (listId: string, gameId: number) =>
      updateList(listId, (list) => withoutGames(list, [gameId])),
    [updateList]
  );

  const removeGamesFromList = useCallback(
    (listId: string, gameIds: number[]) =>
      updateList(listId, (list) => withoutGames(list, gameIds)),
    [updateList]
  );

  const setIgdbRatings = useCallback(
    (ratings: Record<number, StoredRatings>) => {
      const next = lists.map((list) => withRatings(list, ratings));
      const changed = next.filter((list, index) => list !== lists[index]);
      if (changed.length === 0) {
        return;
      }
      setLists(next);
      for (const list of changed) {
        saveList(list);
      }
    },
    [lists]
  );

  const clearAll = useCallback(() => {
    setLists([]);
    removeAllLists(lists);
  }, [lists]);

  const replaceAll = useCallback(
    async (restored: GameList[]) => {
      const next = sortLists(restored);
      setLists(next);
      await removeAllLists(lists);
      await saveAllLists(next);
    },
    [lists]
  );

  const value = useMemo(
    () => ({
      lists,
      getList,
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
      setIgdbRatings,
      setListConsoles,
      setListSort,
      clearAll,
    }),
    [
      lists,
      getList,
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
      clearAll,
    ]
  );

  return (
    <ListsContext.Provider value={value}>{children}</ListsContext.Provider>
  );
};
