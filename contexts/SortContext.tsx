import { createContext, type ReactNode, useContext, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

export type SortMode = "alpha" | "alpha_desc" | "rating" | "recent";

export const LIBRARY_SORTS: SortMode[] = [
  "alpha",
  "alpha_desc",
  "recent",
  "rating",
];

export const LIST_SORTS: SortMode[] = ["alpha", "alpha_desc", "recent"];

interface SortContextType {
  librarySort: SortMode;
  listSort: SortMode;
  setLibrarySort: (value: SortMode) => Promise<void>;
  setListSort: (value: SortMode) => Promise<void>;
}

const throwOutsideProvider = () => {
  throw new Error("useSort must be used within SortProvider");
};

const SortContext = createContext<SortContextType>({
  librarySort: "alpha",
  listSort: "alpha",
  setLibrarySort: throwOutsideProvider,
  setListSort: throwOutsideProvider,
});

export const useSort = () => useContext(SortContext);

export const SortProvider = ({ children }: { children: ReactNode }) => {
  const [librarySort, setLibrarySort] = usePersistedState<SortMode>(
    "library_sort",
    "alpha"
  );
  const [listSort, setListSort] = usePersistedState<SortMode>(
    "list_sort",
    "alpha"
  );

  const value = useMemo(
    () => ({ librarySort, listSort, setLibrarySort, setListSort }),
    [librarySort, listSort, setLibrarySort, setListSort]
  );

  return <SortContext.Provider value={value}>{children}</SortContext.Provider>;
};
