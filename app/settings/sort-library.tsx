import { router } from "expo-router";
import { OptionsSelector } from "@/components/OptionsSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { LIBRARY_SORTS, type SortMode, useSort } from "@/contexts/SortContext";
import type { TranslationKey } from "@/i18n/translations";

export default function SortLibraryScreen() {
  const { t } = useLanguage();
  const { librarySort, setLibrarySort } = useSort();

  return (
    <OptionsSelector
      onSelect={(value) => {
        setLibrarySort(value as SortMode);
        router.back();
      }}
      options={LIBRARY_SORTS.map((mode) => ({
        label: t(`sort_${mode}` as TranslationKey),
        value: mode,
      }))}
      selectedValue={librarySort}
      title={t("settings_sort_library")}
    />
  );
}
