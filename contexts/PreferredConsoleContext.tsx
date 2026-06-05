import { createContext, type ReactNode, useContext, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

interface PreferredConsoleContextType {
  preferredConsole: string | null;
  setPreferredConsole: (value: string | null) => Promise<void>;
}

const PreferredConsoleContext = createContext<PreferredConsoleContextType>({
  preferredConsole: null,
  setPreferredConsole: () => {
    throw new Error(
      "usePreferredConsole must be used within PreferredConsoleProvider"
    );
  },
});

export const usePreferredConsole = () => useContext(PreferredConsoleContext);

export const PreferredConsoleProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [preferredConsole, setPreferredConsole] = usePersistedState<
    string | null
  >("preferred_console", null);

  const value = useMemo(
    () => ({ preferredConsole, setPreferredConsole }),
    [preferredConsole, setPreferredConsole]
  );

  return (
    <PreferredConsoleContext.Provider value={value}>
      {children}
    </PreferredConsoleContext.Provider>
  );
};
