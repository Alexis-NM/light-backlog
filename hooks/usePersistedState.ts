import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * State saved under `key`. The third item tells when the saved value has been
 * read, and gives the latest value, set but maybe not rendered yet: a change
 * built on it cannot undo another one made in the same tick.
 */
export function usePersistedState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef(value);

  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((stored) => {
        if (stored !== null) {
          try {
            const parsed: T = JSON.parse(stored);
            latest.current = parsed;
            setValue(parsed);
          } catch {
            AsyncStorage.removeItem(key);
          }
        }
      })
      .finally(() => setLoaded(true));
  }, [key]);

  const setPersistedValue = useCallback(
    async (newValue: T) => {
      latest.current = newValue;
      setValue(newValue);
      await AsyncStorage.setItem(key, JSON.stringify(newValue));
    },
    [key]
  );

  const getLatest = useCallback(() => latest.current, []);

  return [value, setPersistedValue, { getLatest, loaded }] as const;
}
