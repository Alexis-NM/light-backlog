import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import ContentContainer from "@/components/ContentContainer";
import { TextInput } from "@/components/TextInput";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLists } from "@/contexts/ListsContext";

export default function RenameListScreen() {
  const { t } = useLanguage();
  const { getList, renameList } = useLists();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState(getList(id)?.name ?? "");

  const save = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    renameList(id, trimmed);
    router.back();
  };

  return (
    <ContentContainer
      headerTitle={t("list_rename")}
      rightAction={{ icon: "check", onPress: save, show: name.length > 0 }}
    >
      <TextInput
        autoFocus
        onChangeText={setName}
        onSubmit={save}
        placeholder={t("list_name_placeholder")}
        value={name}
      />
    </ContentContainer>
  );
}
