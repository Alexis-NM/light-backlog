import { router } from "expo-router";
import { OptionsSelector } from "@/components/OptionsSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/i18n/translations";

export default function LanguageScreen() {
  const { t, language, setLanguage } = useLanguage();

  return (
    <OptionsSelector
      onSelect={(value) => {
        setLanguage(value as Language);
        router.back();
      }}
      options={[
        { label: t("language_en"), value: "en" },
        { label: t("language_fr"), value: "fr" },
      ]}
      selectedValue={language}
      title={t("settings_language")}
    />
  );
}
