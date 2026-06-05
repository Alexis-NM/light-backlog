import { createContext, type ReactNode, useContext, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

interface FullscreenContextType {
  gamesFullscreen: boolean;
  libraryFullscreen: boolean;
  listFullscreen: boolean;
  setGamesFullscreen: (value: boolean) => Promise<void>;
  setLibraryFullscreen: (value: boolean) => Promise<void>;
  setListFullscreen: (value: boolean) => Promise<void>;
}

const throwOutsideProvider = () => {
  throw new Error("useFullscreen must be used within FullscreenProvider");
};

const FullscreenContext = createContext<FullscreenContextType>({
  libraryFullscreen: false,
  setLibraryFullscreen: throwOutsideProvider,
  gamesFullscreen: false,
  setGamesFullscreen: throwOutsideProvider,
  listFullscreen: false,
  setListFullscreen: throwOutsideProvider,
});

export const useFullscreen = () => useContext(FullscreenContext);

export const FullscreenProvider = ({ children }: { children: ReactNode }) => {
  const [libraryFullscreen, setLibraryFullscreen] = usePersistedState(
    "library_fullscreen",
    false
  );
  const [gamesFullscreen, setGamesFullscreen] = usePersistedState(
    "games_fullscreen",
    false
  );
  const [listFullscreen, setListFullscreen] = usePersistedState(
    "list_fullscreen",
    false
  );

  const value = useMemo(
    () => ({
      libraryFullscreen,
      setLibraryFullscreen,
      gamesFullscreen,
      setGamesFullscreen,
      listFullscreen,
      setListFullscreen,
    }),
    [
      libraryFullscreen,
      setLibraryFullscreen,
      gamesFullscreen,
      setGamesFullscreen,
      listFullscreen,
      setListFullscreen,
    ]
  );

  return (
    <FullscreenContext.Provider value={value}>
      {children}
    </FullscreenContext.Provider>
  );
};
