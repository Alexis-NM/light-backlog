import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
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
  setListConsoles: () => undefined,
  clearAll: () => undefined,
});

export const useLists = () => useContext(ListsContext);

function makeId() {
  return `list_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const ListsProvider = ({ children }: { children: ReactNode }) => {
  const [lists, setLists] = usePersistedState<GameList[]>("lists", []);

  const getList = useCallback(
    (id: string) => lists.find((list) => list.id === id),
    [lists]
  );

  const createList = useCallback(
    (name: string) => {
      const id = makeId();
      const list: GameList = {
        id,
        name: name.trim(),
        gameIds: [],
        games: {},
        createdAt: Date.now(),
      };
      setLists([list, ...lists]);
      return id;
    },
    [lists, setLists]
  );

  const createListWithGames = useCallback(
    (name: string, games: Game[], consoles?: string[]) => {
      const id = makeId();
      const gamesMap: Record<number, Game> = {};
      const gameIds: number[] = [];
      for (const game of games) {
        if (!gamesMap[game.id]) {
          gamesMap[game.id] = game;
          gameIds.push(game.id);
        }
      }
      const list: GameList = {
        id,
        name: name.trim(),
        gameIds,
        games: gamesMap,
        consoles: consoles && consoles.length > 0 ? consoles : undefined,
        createdAt: Date.now(),
      };
      setLists([list, ...lists]);
      return id;
    },
    [lists, setLists]
  );

  const renameList = useCallback(
    (id: string, name: string) => {
      setLists(
        lists.map((list) =>
          list.id === id ? { ...list, name: name.trim() } : list
        )
      );
    },
    [lists, setLists]
  );

  const setListConsoles = useCallback(
    (id: string, consoles: string[]) => {
      setLists(
        lists.map((list) =>
          list.id === id
            ? { ...list, consoles: consoles.length > 0 ? consoles : undefined }
            : list
        )
      );
    },
    [lists, setLists]
  );

  const deleteList = useCallback(
    (id: string) => setLists(lists.filter((list) => list.id !== id)),
    [lists, setLists]
  );

  const addGameToList = useCallback(
    (listId: string, game: Game) => {
      setLists(
        lists.map((list) => {
          if (list.id !== listId || list.gameIds.includes(game.id)) {
            return list;
          }
          return {
            ...list,
            gameIds: [game.id, ...list.gameIds],
            games: { ...list.games, [game.id]: game },
          };
        })
      );
    },
    [lists, setLists]
  );

  const addGamesToList = useCallback(
    (listId: string, games: Game[]) => {
      setLists(
        lists.map((list) => {
          if (list.id !== listId) {
            return list;
          }
          const gamesMap = { ...list.games };
          const newIds: number[] = [];
          for (const game of games) {
            if (!gamesMap[game.id]) {
              gamesMap[game.id] = game;
              newIds.push(game.id);
            }
          }
          return {
            ...list,
            gameIds: [...newIds, ...list.gameIds],
            games: gamesMap,
          };
        })
      );
    },
    [lists, setLists]
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
    },
    [lists, setLists]
  );

  const removeGameFromList = useCallback(
    (listId: string, gameId: number) => {
      setLists(
        lists.map((list) => {
          if (list.id !== listId) {
            return list;
          }
          const games = { ...list.games };
          delete games[gameId];
          return {
            ...list,
            gameIds: list.gameIds.filter((id) => id !== gameId),
            games,
          };
        })
      );
    },
    [lists, setLists]
  );

  const removeGamesFromList = useCallback(
    (listId: string, gameIds: number[]) => {
      const idSet = new Set(gameIds);
      setLists(
        lists.map((list) => {
          if (list.id !== listId) {
            return list;
          }
          const games = { ...list.games };
          for (const id of gameIds) {
            delete games[id];
          }
          return {
            ...list,
            gameIds: list.gameIds.filter((id) => !idSet.has(id)),
            games,
          };
        })
      );
    },
    [lists, setLists]
  );

  const clearAll = useCallback(() => setLists([]), [setLists]);

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
      clearAll,
    ]
  );

  return (
    <ListsContext.Provider value={value}>{children}</ListsContext.Provider>
  );
};
