import { router } from "expo-router";
import { useState } from "react";
import ContentContainer from "@/components/ContentContainer";
import { TextInput } from "@/components/TextInput";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLists } from "@/contexts/ListsContext";

export default function NewListScreen() {
  const { t } = useLanguage();
  const { createList } = useLists();
  const [name, setName] = useState("");

  const create = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    createList(trimmed);
    router.back();
  };

  return (
    <ContentContainer
      headerTitle={t("list_new")}
      rightAction={{ icon: "check", onPress: create, show: name.length > 0 }}
    >
      <TextInput
        autoFocus
        onChangeText={setName}
        onSubmit={create}
        placeholder={t("list_name_placeholder")}
        value={name}
      />
    </ContentContainer>
  );
}
