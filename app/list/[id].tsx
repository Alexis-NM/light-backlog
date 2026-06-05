import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { ConsoleSelect } from "@/components/ConsoleSelect";
import ContentContainer from "@/components/ContentContainer";
import { GameGrid } from "@/components/GameGrid";
import { StyledButton } from "@/components/StyledButton";
import { StyledText } from "@/components/StyledText";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLists } from "@/contexts/ListsContext";
import { triggerSuccess } from "@/utils/haptics";
import { n } from "@/utils/scaling";

export default function ListDetailScreen() {
  const { t } = useLanguage();
  const { getList, deleteList, setListConsoles } = useLists();
  const { addMany } = useLibrary();
  const params = useLocalSearchParams<{
    id: string;
    confirmed?: string;
    action?: string;
  }>();

  const list = getList(params.id);

  useEffect(() => {
    if (params.confirmed === "true" && params.action === "deleteList") {
      deleteList(params.id);
      router.replace("/(tabs)/lists");
    }
  }, [params.confirmed, params.action, params.id, deleteList]);

  if (!list) {
    return <ContentContainer headerTitle=" " />;
  }

  const games = list.gameIds
    .map((gameId) => list.games[gameId])
    .filter((game) => game !== undefined);
  const consoles = list.consoles ?? [];

  const toggleConsole = (name: string) =>
    setListConsoles(
      params.id,
      consoles.includes(name)
        ? consoles.filter((c) => c !== name)
        : [...consoles, name]
    );

  const addAllToLibrary = () => {
    if (games.length === 0) {
      return;
    }
    addMany(games, "backlog", consoles);
    triggerSuccess();
  };

  const confirmDelete = () =>
    router.push({
      pathname: "/confirm",
      params: {
        title: t("delete"),
        message: t("list_delete_confirm"),
        confirmText: t("delete"),
        action: "deleteList",
        returnPath: `/list/${params.id}`,
      },
    });

  return (
    <ContentContainer
      contentWidth="wide"
      headerTitle={list.name}
      rightAction={{ icon: "delete-outline", onPress: confirmDelete }}
    >
      <View style={styles.body}>
        <View style={styles.section}>
          <StyledText style={styles.label}>{t("list_consoles")}</StyledText>
          <ConsoleSelect onToggle={toggleConsole} selected={consoles} />
        </View>

        {games.length > 0 ? (
          <>
            <StyledButton onPress={addAllToLibrary} text={t("list_add_all")} />
            <GameGrid
              games={games}
              getSubtitle={(game) => game.year?.toString()}
            />
          </>
        ) : (
          <StyledText style={styles.muted}>{t("list_empty")}</StyledText>
        )}
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    width: "100%",
    gap: n(24),
  },
  section: {
    gap: n(12),
  },
  label: {
    fontSize: n(13),
    opacity: 0.45,
    textTransform: "uppercase",
    letterSpacing: n(1),
  },
  muted: {
    opacity: 0.6,
  },
});
