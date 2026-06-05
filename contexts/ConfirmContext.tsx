import { router } from "expo-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";

export interface ConfirmRequest {
  confirmText: string;
  message: string;
  onConfirm: () => void;
  title: string;
}

interface ConfirmContextType {
  ask: (request: ConfirmRequest) => void;
  consume: () => ConfirmRequest | null;
}

const ConfirmContext = createContext<ConfirmContextType>({
  ask: () => {
    throw new Error("useConfirm must be used within ConfirmProvider");
  },
  consume: () => null,
});

export const useConfirm = () => useContext(ConfirmContext).ask;
export const useConfirmRequest = () => useContext(ConfirmContext).consume;

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const requestRef = useRef<ConfirmRequest | null>(null);

  const ask = useCallback((request: ConfirmRequest) => {
    requestRef.current = request;
    router.push("/confirm");
  }, []);

  const consume = useCallback(() => {
    const request = requestRef.current;
    requestRef.current = null;
    return request;
  }, []);

  const value = useMemo(() => ({ ask, consume }), [ask, consume]);

  return (
    <ConfirmContext.Provider value={value}>{children}</ConfirmContext.Provider>
  );
};
