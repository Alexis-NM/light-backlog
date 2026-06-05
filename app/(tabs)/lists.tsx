import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { EmptyState } from "@/components/EmptyState";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLists } from "@/contexts/ListsContext";
import { openList } from "@/utils/navigation";
import { n } from "@/utils/scaling";

export default function ListsScreen() {
  const { t } = useLanguage();
  const { lists } = useLists();

  if (lists.length === 0) {
    return (
      <ContentContainer
        headerTitle={t("lists_title")}
        hideBackButton
        rightActions={[
          {
            icon: "file-download",
            onPress: () => router.push("/list/import"),
          },
          { icon: "add", onPress: () => router.push("/list/new") },
        ]}
      >
        <EmptyState
          actionText={t("list_new")}
          hint={t("lists_empty_hint")}
          icon="format-list-bulleted"
          onAction={() => router.push("/list/new")}
          title={t("lists_empty")}
        />
      </ContentContainer>
    );
  }

  return (
    <ContentContainer
      headerTitle={t("lists_title")}
      hideBackButton
      rightActions={[
        {
          icon: "file-download",
          onPress: () => router.push("/list/import"),
        },
        { icon: "add", onPress: () => router.push("/list/new") },
      ]}
    >
      <View style={styles.body}>
        {lists.map((list) => (
          <HapticPressable
            key={list.id}
            onLongPress={() =>
              router.push({
                pathname: "/list/rename",
                params: { id: list.id },
              })
            }
            onPress={() => openList(list.id)}
            style={styles.row}
          >
            <StyledText numberOfLines={1} style={styles.name}>
              {list.name}
            </StyledText>
            <StyledText style={styles.count}>
              {t("list_count", { count: list.gameIds.length })}
              {list.consoles?.length ? ` · ${list.consoles.join(", ")}` : ""}
            </StyledText>
          </HapticPressable>
        ))}
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    width: "100%",
    gap: n(22),
  },
  row: {
    gap: n(2),
  },
  name: {
    fontSize: n(26),
  },
  count: {
    fontSize: n(13),
    opacity: 0.5,
  },
});
