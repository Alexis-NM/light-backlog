import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { type IgdbAuth, resetIgdbToken } from "@/services/igdb";

const CLIENT_ID_KEY = "igdb_client_id";
const CLIENT_SECRET_KEY = "igdb_client_secret";

interface CredentialsContextType {
  auth: IgdbAuth | null;
  clearCredentials: () => Promise<void>;
  hasCredentials: boolean;
  isLoading: boolean;
  setCredentials: (clientId: string, clientSecret: string) => Promise<void>;
}

const CredentialsContext = createContext<CredentialsContextType>({
  auth: null,
  hasCredentials: false,
  isLoading: true,
  setCredentials: () => {
    throw new Error("useCredentials must be used within CredentialsProvider");
  },
  clearCredentials: () => {
    throw new Error("useCredentials must be used within CredentialsProvider");
  },
});

export const useCredentials = () => useContext(CredentialsContext);

export const CredentialsProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<IgdbAuth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([getItemAsync(CLIENT_ID_KEY), getItemAsync(CLIENT_SECRET_KEY)])
      .then(([clientId, clientSecret]) => {
        if (clientId && clientSecret) {
          setAuth({ clientId, clientSecret });
        }
      })
      .catch(() => {
        // Keychain unavailable; treat as no credentials.
      })
      .finally(() => setIsLoading(false));
  }, []);

  const setCredentials = useCallback(
    async (clientId: string, clientSecret: string) => {
      await setItemAsync(CLIENT_ID_KEY, clientId);
      await setItemAsync(CLIENT_SECRET_KEY, clientSecret);
      resetIgdbToken();
      setAuth({ clientId, clientSecret });
    },
    []
  );

  const clearCredentials = useCallback(async () => {
    await deleteItemAsync(CLIENT_ID_KEY);
    await deleteItemAsync(CLIENT_SECRET_KEY);
    resetIgdbToken();
    setAuth(null);
  }, []);

  const value = useMemo(
    () => ({
      auth,
      hasCredentials: auth !== null,
      isLoading,
      setCredentials,
      clearCredentials,
    }),
    [auth, isLoading, setCredentials, clearCredentials]
  );

  return (
    <CredentialsContext.Provider value={value}>
      {children}
    </CredentialsContext.Provider>
  );
};
