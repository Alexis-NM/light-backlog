import { createContext, type ReactNode, useContext, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

interface FullscreenContextType {
  gamesFullscreen: boolean;
  libraryFullscreen: boolean;
  setGamesFullscreen: (value: boolean) => Promise<void>;
  setLibraryFullscreen: (value: boolean) => Promise<void>;
}

const FullscreenContext = createContext<FullscreenContextType>({
  libraryFullscreen: false,
  setLibraryFullscreen: () => {
    throw new Error("useFullscreen must be used within FullscreenProvider");
  },
  gamesFullscreen: false,
  setGamesFullscreen: () => {
    throw new Error("useFullscreen must be used within FullscreenProvider");
  },
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

  const value = useMemo(
    () => ({
      libraryFullscreen,
      setLibraryFullscreen,
      gamesFullscreen,
      setGamesFullscreen,
    }),
    [
      libraryFullscreen,
      setLibraryFullscreen,
      gamesFullscreen,
      setGamesFullscreen,
    ]
  );

  return (
    <FullscreenContext.Provider value={value}>
      {children}
    </FullscreenContext.Provider>
  );
};
