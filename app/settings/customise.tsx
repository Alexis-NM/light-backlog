import { type Href, router } from "expo-router";
import ContentContainer from "@/components/ContentContainer";
import { SelectorButton } from "@/components/SelectorButton";
import { StyledButton } from "@/components/StyledButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSort } from "@/contexts/SortContext";
import type { TranslationKey } from "@/i18n/translations";

export default function CustomiseScreen() {
  const { t, language } = useLanguage();
  const { librarySort, listSort } = useSort();

  return (
    <ContentContainer headerTitle={t("settings_customise")}>
      <StyledButton
        onPress={() => router.push("/settings/customise-interface" as Href)}
        text={t("settings_interface")}
      />
      <SelectorButton
        href="/settings/language"
        label={t("settings_language")}
        value={t(language === "fr" ? "language_fr" : "language_en")}
      />
      <SelectorButton
        href="/settings/sort-library"
        label={t("settings_sort_library")}
        value={t(`sort_${librarySort}` as TranslationKey)}
      />
      <SelectorButton
        href="/settings/sort-lists"
        label={t("settings_sort_lists")}
        value={t(`sort_${listSort}` as TranslationKey)}
      />
    </ContentContainer>
  );
}
