import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { EmptyState } from "@/components/EmptyState";
import { GameGrid } from "@/components/GameGrid";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { useFullscreen } from "@/contexts/FullscreenContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { usePersistedState } from "@/hooks/usePersistedState";
import type { TranslationKey } from "@/i18n/translations";
import {
  entryPlatforms,
  GAME_STATUSES,
  type Game,
  type GameStatus,
} from "@/types/game";
import { n } from "@/utils/scaling";

type Filter = "all" | GameStatus;
const FILTERS: Filter[] = ["all", ...GAME_STATUSES];

interface LibraryFilters {
  platform: string | null;
  status: Filter;
}

const DEFAULT_FILTERS: LibraryFilters = { status: "all", platform: null };

function FilterChip({
  label,
  active,
  small,
  onPress,
}: {
  label: string;
  active: boolean;
  small?: boolean;
  onPress: () => void;
}) {
  return (
    <HapticPressable onPress={onPress}>
      <StyledText
        style={[
          small ? styles.chipSmall : styles.chip,
          active && styles.chipActive,
        ]}
      >
        {label}
      </StyledText>
    </HapticPressable>
  );
}

export default function LibraryScreen() {
  const { t } = useLanguage();
  const { entries, setStatusMany, removeMany } = useLibrary();
  const { libraryFullscreen, setLibraryFullscreen } = useFullscreen();
  const [filters, setFilters] = usePersistedState<LibraryFilters>(
    "library_filters",
    DEFAULT_FILTERS
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const sorted = useMemo(
    () => Object.values(entries).sort((a, b) => b.updatedAt - a.updatedAt),
    [entries]
  );

  const platforms = useMemo(() => {
    const set = new Set<string>();
    for (const entry of sorted) {
      for (const platform of entryPlatforms(entry)) {
        set.add(platform);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sorted]);

  const activePlatform =
    filters.platform && platforms.includes(filters.platform)
      ? filters.platform
      : null;

  const games = useMemo(
    () =>
      sorted
        .filter(
          (entry) => filters.status === "all" || entry.status === filters.status
        )
        .filter(
          (entry) =>
            !activePlatform || entryPlatforms(entry).includes(activePlatform)
        )
        .map((entry) => entry.game),
    [sorted, filters.status, activePlatform]
  );

  const getSubtitle = (game: Game) => {
    const entry = entries[game.id];
    if (!entry) {
      return;
    }
    if (filters.status === "all") {
      const statusLabel = t(`status_${entry.status}` as TranslationKey);
      return entry.rating > 0
        ? `★${entry.rating} · ${statusLabel}`
        : statusLabel;
    }
    return entry.rating > 0 ? `★${entry.rating}` : game.year?.toString();
  };

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

  const applyStatus = (status: GameStatus) => {
    setStatusMany([...selectedIds], status);
    exitSelection();
  };

  const removeSelected = () => {
    removeMany([...selectedIds]);
    exitSelection();
  };

  if (sorted.length === 0) {
    return (
      <ContentContainer
        headerTitle={t("library_title")}
        hideBackButton
        rightAction={{ icon: "search", onPress: () => router.push("/search") }}
      >
        <EmptyState
          actionText={t("search_title")}
          hint={t("library_empty_hint")}
          icon="videogame-asset"
          onAction={() => router.push("/search")}
          title={t("library_empty")}
        />
      </ContentContainer>
    );
  }

  return (
    <ContentContainer
      contentWidth="wide"
      headerTitle={
        selectionMode
          ? t("library_selected", { count: selectedIds.size })
          : t("library_title")
      }
      hideBackButton
      rightActions={
        selectionMode
          ? [{ icon: "close", onPress: exitSelection }]
          : [
              { icon: "search", onPress: () => router.push("/search") },
              {
                icon: libraryFullscreen ? "fullscreen-exit" : "fullscreen",
                onPress: () => setLibraryFullscreen(!libraryFullscreen),
              },
            ]
      }
    >
      <View style={[styles.wrapper, libraryFullscreen && styles.fullscreenPad]}>
        {selectionMode ? (
          <View style={styles.statusRow}>
            {GAME_STATUSES.map((status) => (
              <HapticPressable key={status} onPress={() => applyStatus(status)}>
                <StyledText style={styles.action}>
                  {t(`status_${status}` as TranslationKey)}
                </StyledText>
              </HapticPressable>
            ))}
            <HapticPressable onPress={removeSelected}>
              <StyledText style={styles.action}>{t("remove")}</StyledText>
            </HapticPressable>
          </View>
        ) : null}

        {selectionMode || libraryFullscreen ? null : (
          <View style={styles.statusRow}>
            {FILTERS.map((value) => (
              <FilterChip
                active={value === filters.status}
                key={value}
                label={
                  value === "all"
                    ? t("filter_all")
                    : t(`status_${value}` as TranslationKey)
                }
                onPress={() => setFilters({ ...filters, status: value })}
              />
            ))}
          </View>
        )}

        {!(selectionMode || libraryFullscreen) && platforms.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.consoleRow}
          >
            <View style={styles.consoleInner}>
              <FilterChip
                active={activePlatform === null}
                label={t("filter_all")}
                onPress={() => setFilters({ ...filters, platform: null })}
                small
              />
              {platforms.map((platform) => (
                <FilterChip
                  active={activePlatform === platform}
                  key={platform}
                  label={platform}
                  onPress={() => setFilters({ ...filters, platform })}
                  small
                />
              ))}
            </View>
          </ScrollView>
        ) : null}

        {games.length > 0 ? (
          <GameGrid
            games={games}
            getSubtitle={getSubtitle}
            onLongPressGame={enterSelection}
            onPressGame={selectionMode ? toggleSelect : undefined}
            selectedIds={selectedIds}
            selectionMode={selectionMode}
          />
        ) : (
          <StyledText style={styles.emptyFilter}>
            {t("library_empty")}
          </StyledText>
        )}
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  fullscreenPad: {
    paddingBottom: n(24),
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: n(14),
    marginBottom: n(14),
  },
  consoleRow: {
    marginBottom: n(20),
  },
  consoleInner: {
    flexDirection: "row",
    gap: n(14),
  },
  action: {
    fontSize: n(16),
  },
  chip: {
    fontSize: n(16),
    opacity: 0.45,
  },
  chipSmall: {
    fontSize: n(13),
    opacity: 0.45,
  },
  chipActive: {
    opacity: 1,
    textDecorationLine: "underline",
  },
  emptyFilter: {
    fontSize: n(15),
    opacity: 0.6,
    marginTop: n(20),
  },
});
