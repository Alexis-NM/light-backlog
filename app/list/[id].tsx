import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ConsoleSelect } from "@/components/ConsoleSelect";
import ContentContainer from "@/components/ContentContainer";
import { GameGrid } from "@/components/GameGrid";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { useFullscreen } from "@/contexts/FullscreenContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLists } from "@/contexts/ListsContext";
import type { Game } from "@/types/game";
import { triggerSuccess } from "@/utils/haptics";
import { n } from "@/utils/scaling";

export default function ListDetailScreen() {
  const { t } = useLanguage();
  const { getList, deleteList, setListConsoles, removeGamesFromList } =
    useLists();
  const { addMany } = useLibrary();
  const { listFullscreen, setListFullscreen } = useFullscreen();
  const params = useLocalSearchParams<{
    id: string;
    confirmed?: string;
    action?: string;
  }>();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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

  const toggleSelect = (game: Game) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(game.id)) {
        next.delete(game.id);
      } else {
        next.add(game.id);
      }
      return next;
    });

  const enterSelection = (game: Game) => {
    setSelectionMode(true);
    toggleSelect(game);
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const selectAll = () => setSelectedIds(new Set(games.map((game) => game.id)));

  const addSelectedToLibrary = () => {
    const selected = games.filter((game) => selectedIds.has(game.id));
    if (selected.length > 0) {
      addMany(selected, "backlog", consoles);
      triggerSuccess();
    }
    exitSelection();
  };

  const removeSelectedFromList = () => {
    removeGamesFromList(params.id, [...selectedIds]);
    exitSelection();
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
      footer={
        selectionMode ? (
          <View style={styles.actionRow}>
            <HapticPressable onPress={addSelectedToLibrary}>
              <StyledText style={styles.action}>
                {t("list_add_to_library")}
              </StyledText>
            </HapticPressable>
            <HapticPressable onPress={removeSelectedFromList}>
              <StyledText style={styles.action}>
                {t("list_remove_from")}
              </StyledText>
            </HapticPressable>
          </View>
        ) : undefined
      }
      headerTitle={
        selectionMode
          ? t("library_selected", { count: selectedIds.size })
          : list.name
      }
      rightActions={
        selectionMode
          ? [
              { icon: "select-all", onPress: selectAll },
              { icon: "close", onPress: exitSelection },
            ]
          : [
              {
                icon: listFullscreen ? "fullscreen-exit" : "fullscreen",
                onPress: () => setListFullscreen(!listFullscreen),
              },
              { icon: "delete-outline", onPress: confirmDelete },
            ]
      }
    >
      <View style={styles.body}>
        {selectionMode || listFullscreen ? null : (
          <View style={styles.section}>
            <StyledText style={styles.label}>{t("list_consoles")}</StyledText>
            <ConsoleSelect onToggle={toggleConsole} selected={consoles} />
          </View>
        )}

        {games.length > 0 ? (
          <GameGrid
            games={games}
            getSubtitle={(game) => game.year?.toString()}
            onLongPressGame={enterSelection}
            onPressGame={selectionMode ? toggleSelect : undefined}
            selectedIds={selectedIds}
            selectionMode={selectionMode}
          />
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
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: n(20),
  },
  action: {
    fontSize: n(16),
  },
  muted: {
    opacity: 0.6,
  },
});
