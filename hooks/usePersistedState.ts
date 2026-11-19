import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

/**
 * A setting saved under `key`. Until the saved value is read, or when it
 * cannot be, the setting has its default value; what is stored is left as it
 * is until the next change.
 */
export function usePersistedState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((stored) => {
        if (stored !== null) {
          setValue(JSON.parse(stored));
        }
      })
      .catch(() => {
        // Unreadable: the default stays.
      });
  }, [key]);

  const setPersistedValue = useCallback(
    async (newValue: T) => {
      setValue(newValue);
      await AsyncStorage.setItem(key, JSON.stringify(newValue));
    },
    [key]
  );

  return [value, setPersistedValue] as const;
}
