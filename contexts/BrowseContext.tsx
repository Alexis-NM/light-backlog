import { createContext, type ReactNode, useContext, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import type { Console } from "@/types/game";

interface BrowseContextType {
  selectedConsole: Console | null;
  setSelectedConsole: (value: Console | null) => Promise<void>;
}

const BrowseContext = createContext<BrowseContextType>({
  selectedConsole: null,
  setSelectedConsole: () => {
    throw new Error("useBrowse must be used within BrowseProvider");
  },
});

export const useBrowse = () => useContext(BrowseContext);

export const BrowseProvider = ({ children }: { children: ReactNode }) => {
  const [selectedConsole, setSelectedConsole] =
    usePersistedState<Console | null>("browse_console", null);

  const value = useMemo(
    () => ({ selectedConsole, setSelectedConsole }),
    [selectedConsole, setSelectedConsole]
  );

  return (
    <BrowseContext.Provider value={value}>{children}</BrowseContext.Provider>
  );
};
