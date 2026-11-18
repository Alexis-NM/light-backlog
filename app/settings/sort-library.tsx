import { router } from "expo-router";
import { OptionsSelector } from "@/components/OptionsSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSort } from "@/contexts/SortContext";
import { LIBRARY_SORTS, type SortMode } from "@/core/game";
import type { TranslationKey } from "@/core/translations";

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
