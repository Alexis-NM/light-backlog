import { getLocales } from "expo-localization";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import {
  type Language,
  type TranslationKey,
  translations,
} from "@/i18n/translations";

type TranslateParams = Record<string, string | number>;
type Translate = (key: TranslationKey, params?: TranslateParams) => string;

interface LanguageContextType {
  language: Language;
  setLanguage: (value: Language) => Promise<void>;
  t: Translate;
}

function getDeviceLanguage(): Language {
  return getLocales()[0]?.languageCode === "fr" ? "fr" : "en";
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {
    throw new Error("useLanguage must be used within LanguageProvider");
  },
  t: (key) => key,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = usePersistedState<Language>(
    "language",
    getDeviceLanguage()
  );

  const t = useCallback<Translate>(
    (key, params) => {
      let value = translations[language][key] ?? translations.en[key] ?? key;
      if (params) {
        for (const paramKey of Object.keys(params)) {
          value = value.split(`{${paramKey}}`).join(String(params[paramKey]));
        }
      }
      return value;
    },
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
