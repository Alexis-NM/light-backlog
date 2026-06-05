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
  removeGameFromList: (listId: string, gameId: number) => void;
  setListConsoles: (id: string, consoles: string[]) => void;
}

const ListsContext = createContext<ListsContextType>({
  lists: [],
  getList: () => undefined,
  createList: () => "",
  createListWithGames: () => "",
  deleteList: () => undefined,
  addGameToList: () => undefined,
  removeGameFromList: () => undefined,
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

  const clearAll = useCallback(() => setLists([]), [setLists]);

  const value = useMemo(
    () => ({
      lists,
      getList,
      createList,
      createListWithGames,
      deleteList,
      addGameToList,
      removeGameFromList,
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
      removeGameFromList,
      clearAll,
    ]
  );

  return (
    <ListsContext.Provider value={value}>{children}</ListsContext.Provider>
  );
};
