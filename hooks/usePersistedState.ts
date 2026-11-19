import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

type Reading = "pending" | "done" | "failed";

/**
 * State saved under `key`. The third item tells when the saved value has been
 * read, and gives the latest value, set but maybe not rendered yet: a change
 * built on it cannot undo another one made in the same tick. A saved value
 * that cannot be read is left as it is in storage, and `unreadable` says so:
 * `loaded` then stays false.
 */
export function usePersistedState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [reading, setReading] = useState<Reading>("pending");
  const latest = useRef(value);

  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((stored) => {
        if (stored !== null) {
          const parsed: T = JSON.parse(stored);
          latest.current = parsed;
          setValue(parsed);
        }
        setReading("done");
      })
      .catch(() => setReading("failed"));
  }, [key]);

  const setPersistedValue = useCallback(
    async (newValue: T) => {
      latest.current = newValue;
      setValue(newValue);
      await AsyncStorage.setItem(key, JSON.stringify(newValue));
      // What is stored is known again.
      setReading((current) => (current === "failed" ? "done" : current));
    },
    [key]
  );

  const getLatest = useCallback(() => latest.current, []);

  return [
    value,
    setPersistedValue,
    {
      getLatest,
      loaded: reading === "done",
      unreadable: reading === "failed",
    },
  ] as const;
}
