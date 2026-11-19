import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ChipSelect } from "@/components/ChipSelect";
import { ConsoleSelect } from "@/components/ConsoleSelect";
import ContentContainer from "@/components/ContentContainer";
import { yearOf } from "@/components/GameGrid";
import { GameGridContainer } from "@/components/GameGridContainer";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useFullscreen } from "@/contexts/FullscreenContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLists } from "@/contexts/ListsContext";
import { useSort } from "@/contexts/SortContext";
import { compareIgdbRating, compareNames } from "@/core/compareNames";
import { type GameList, LIST_SORTS, type SortMode } from "@/core/game";
import { listGames } from "@/core/lists";
import type { TranslationKey } from "@/core/translations";
import { useSelection } from "@/hooks/useSelection";
import { useSyncOnFocus } from "@/hooks/useSyncOnFocus";
import { triggerSuccess } from "@/utils/haptics";
import { n } from "@/utils/scaling";

function orderedGames(list: GameList, sort: SortMode) {
  const games = listGames(list);
  if (sort === "recent") {
    return games;
  }
  if (sort === "igdb") {
    return games.sort(compareIgdbRating);
  }
  return games.sort((a, b) =>
    sort === "alpha_desc"
      ? compareNames(b.name, a.name)
      : compareNames(a.name, b.name)
  );
}

export default function ListDetailScreen() {
  useSyncOnFocus();
  const { t } = useLanguage();
  const confirm = useConfirm();
  const {
    getList,
    deleteList,
    setListConsoles,
    setListSort,
    removeGamesFromList,
  } = useLists();
  const { addMany } = useLibrary();
  const { listFullscreen, setListFullscreen } = useFullscreen();
  const { listSort } = useSort();
  const params = useLocalSearchParams<{ id: string }>();
  const {
    selectAll,
    selectedIds,
    selecting: selectionMode,
    start: enterSelection,
    stop: exitSelection,
    toggle: toggleSelect,
  } = useSelection();

  const list = getList(params.id);
  const sort = list?.sort ?? listSort;

  const games = useMemo(
    () => (list ? orderedGames(list, sort) : []),
    [list, sort]
  );

  const sortOptions = useMemo(
    () =>
      LIST_SORTS.map((mode) => ({
        label: t(`sort_${mode}` as TranslationKey),
        value: mode,
      })),
    [t]
  );

  if (!list) {
    return <ContentContainer headerTitle=" " />;
  }

  const consoles = list.consoles ?? [];

  const toggleConsole = (name: string) =>
    setListConsoles(
      params.id,
      consoles.includes(name)
        ? consoles.filter((c) => c !== name)
        : [...consoles, name]
    );

  const addSelectedToLibrary = () => {
    const selected = games.filter((game) => selectedIds.has(game.id));
    if (selected.length > 0) {
      addMany(selected, "backlog", consoles);
      triggerSuccess();
    }
    exitSelection();
  };

  const addSelectedToOtherList = () => {
    const selected = games.filter((game) => selectedIds.has(game.id));
    if (selected.length === 0) {
      return;
    }
    router.push({
      pathname: "/list/add",
      params: { games: JSON.stringify(selected), exclude: params.id },
    });
  };

  const confirmRemoveFromList = () => {
    const ids = [...selectedIds];
    confirm({
      title: t("list_remove_from"),
      message: t("list_remove_confirm"),
      confirmText: t("remove"),
      onConfirm: () => {
        removeGamesFromList(params.id, ids);
        exitSelection();
      },
    });
  };

  const confirmDelete = () =>
    confirm({
      title: t("delete"),
      message: t("list_delete_confirm"),
      confirmText: t("delete"),
      onConfirm: () => {
        deleteList(params.id);
        router.back();
      },
    });

  return (
    <GameGridContainer
      empty={<StyledText style={styles.muted}>{t("list_empty")}</StyledText>}
      games={games}
      getSubtitle={yearOf}
      header={
        selectionMode || listFullscreen ? undefined : (
          <View>
            <View style={styles.section}>
              <StyledText style={styles.label}>{t("list_consoles")}</StyledText>
              <ConsoleSelect onToggle={toggleConsole} selected={consoles} />
            </View>
            <View style={styles.section}>
              <StyledText style={styles.label}>{t("list_sort")}</StyledText>
              <ChipSelect
                onSelect={(mode) => setListSort(params.id, mode)}
                options={sortOptions}
                selected={sort}
              />
            </View>
          </View>
        )
      }
      headerTitle={
        selectionMode
          ? t("library_selected", { count: selectedIds.size })
          : list.name
      }
      onLongPressGame={enterSelection}
      onPressGame={selectionMode ? toggleSelect : undefined}
      rightActions={
        selectionMode
          ? [
              { icon: "select-all", onPress: () => selectAll(games) },
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
      selectedIds={selectedIds}
      selectionMode={selectionMode}
      stickyTop={
        selectionMode ? (
          <View style={styles.actionRow}>
            <HapticPressable onPress={addSelectedToLibrary}>
              <StyledText style={styles.action}>
                {t("list_add_to_library")}
              </StyledText>
            </HapticPressable>
            <HapticPressable onPress={addSelectedToOtherList}>
              <StyledText style={styles.action}>{t("list_add_to")}</StyledText>
            </HapticPressable>
            <HapticPressable onPress={confirmRemoveFromList}>
              <StyledText style={styles.action}>
                {t("list_remove_from")}
              </StyledText>
            </HapticPressable>
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  section: {
    gap: n(12),
    marginBottom: n(24),
  },
  label: {
    fontSize: n(13),
    opacity: 0.45,
    textTransform: "uppercase",
    letterSpacing: n(1),
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: n(20),
  },
  action: {
    fontSize: n(16),
  },
  muted: {
    opacity: 0.6,
  },
});
