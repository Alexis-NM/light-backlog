import { createContext, type ReactNode, useContext, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

interface FullscreenContextType {
  libraryFullscreen: boolean;
  setLibraryFullscreen: (value: boolean) => Promise<void>;
}

const FullscreenContext = createContext<FullscreenContextType>({
  libraryFullscreen: false,
  setLibraryFullscreen: () => {
    throw new Error("useFullscreen must be used within FullscreenProvider");
  },
});

export const useFullscreen = () => useContext(FullscreenContext);

export const FullscreenProvider = ({ children }: { children: ReactNode }) => {
  const [libraryFullscreen, setLibraryFullscreen] = usePersistedState(
    "library_fullscreen",
    false
  );

  const value = useMemo(
    () => ({ libraryFullscreen, setLibraryFullscreen }),
    [libraryFullscreen, setLibraryFullscreen]
  );

  return (
    <FullscreenContext.Provider value={value}>
      {children}
    </FullscreenContext.Provider>
  );
};
