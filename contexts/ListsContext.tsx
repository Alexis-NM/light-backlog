import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  loadLists,
  removeAllLists,
  removeList,
  saveAllLists,
  saveList,
  saveListOrder,
} from "@/services/listStorage";
import type { Game, GameList } from "@/types/game";

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
  setListConsoles: (id: string, consoles: string[]) => void;
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
  setListConsoles: () => undefined,
  clearAll: () => undefined,
});

export const useLists = () => useContext(ListsContext);

function makeId() {
  return `list_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function withGames(list: GameList, games: Game[]): GameList {
  const gamesMap = { ...list.games };
  const newIds: number[] = [];
  for (const game of games) {
    if (!gamesMap[game.id]) {
      gamesMap[game.id] = game;
      newIds.push(game.id);
    }
  }
  return { ...list, gameIds: [...newIds, ...list.gameIds], games: gamesMap };
}

function withoutGames(list: GameList, gameIds: number[]): GameList {
  const idSet = new Set(gameIds);
  const games = { ...list.games };
  for (const id of gameIds) {
    delete games[id];
  }
  return {
    ...list,
    gameIds: list.gameIds.filter((id) => !idSet.has(id)),
    games,
  };
}

export const ListsProvider = ({ children }: { children: ReactNode }) => {
  const [lists, setLists] = useState<GameList[]>([]);

  useEffect(() => {
    loadLists().then(setLists);
  }, []);

  const getList = useCallback(
    (id: string) => lists.find((list) => list.id === id),
    [lists]
  );

  const insertList = useCallback(
    (list: GameList) => {
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
      setLists(lists.map((list) => (list.id === id ? updated : list)));
      saveList(updated);
    },
    [lists]
  );

  const createList = useCallback(
    (name: string) =>
      insertList({
        id: makeId(),
        name: name.trim(),
        gameIds: [],
        games: {},
        createdAt: Date.now(),
      }),
    [insertList]
  );

  const createListWithGames = useCallback(
    (name: string, games: Game[], consoles?: string[]) =>
      insertList(
        withGames(
          {
            id: makeId(),
            name: name.trim(),
            gameIds: [],
            games: {},
            consoles: consoles && consoles.length > 0 ? consoles : undefined,
            createdAt: Date.now(),
          },
          games
        )
      ),
    [insertList]
  );

  const renameList = useCallback(
    (id: string, name: string) =>
      updateList(id, (list) => ({ ...list, name: name.trim() })),
    [updateList]
  );

  const setListConsoles = useCallback(
    (id: string, consoles: string[]) =>
      updateList(id, (list) => ({
        ...list,
        consoles: consoles.length > 0 ? consoles : undefined,
      })),
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
      updateList(listId, (list) => withGames(list, [game])),
    [updateList]
  );

  const addGamesToList = useCallback(
    (listId: string, games: Game[]) =>
      updateList(listId, (list) => withGames(list, games)),
    [updateList]
  );

  const moveList = useCallback(
    (id: string, direction: "down" | "up") => {
      const index = lists.findIndex((list) => list.id === id);
      if (index < 0) {
        return;
      }
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= lists.length) {
        return;
      }
      const next = [...lists];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      setLists(next);
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

  const clearAll = useCallback(() => {
    setLists([]);
    removeAllLists(lists);
  }, [lists]);

  const replaceAll = useCallback(
    async (next: GameList[]) => {
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
      setListConsoles,
      clearAll,
    }),
    [
      lists,
      getList,
      createList,
      createListWithGames,
      setListConsoles,
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
