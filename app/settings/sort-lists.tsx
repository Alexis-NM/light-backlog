import { router } from "expo-router";
import { OptionsSelector } from "@/components/OptionsSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { LIST_SORTS, type SortMode, useSort } from "@/contexts/SortContext";
import type { TranslationKey } from "@/i18n/translations";

export default function SortListsScreen() {
  const { t } = useLanguage();
  const { listSort, setListSort } = useSort();

  return (
    <OptionsSelector
      onSelect={(value) => {
        setListSort(value as SortMode);
        router.back();
      }}
      options={LIST_SORTS.map((mode) => ({
        label: t(`sort_${mode}` as TranslationKey),
        value: mode,
      }))}
      selectedValue={listSort}
      title={t("settings_sort_lists")}
    />
  );
}
