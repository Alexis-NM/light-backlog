import { createContext, type ReactNode, useContext } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

interface HideArtworkContextType {
  hideArtwork: boolean;
  setHideArtwork: (value: boolean) => Promise<void>;
}

const HideArtworkContext = createContext<HideArtworkContextType>({
  hideArtwork: false,
  setHideArtwork: () => {
    throw new Error("useHideArtwork must be used within HideArtworkProvider");
  },
});

export const useHideArtwork = () => useContext(HideArtworkContext);

export const HideArtworkProvider = ({ children }: { children: ReactNode }) => {
  const [hideArtwork, setHideArtwork] = usePersistedState(
    "hideArtwork",
    false
  );

  return (
    <HideArtworkContext.Provider value={{ hideArtwork, setHideArtwork }}>
      {children}
    </HideArtworkContext.Provider>
  );
};
