import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { GameCover } from "@/components/GameCover";
import { HapticPressable } from "@/components/HapticPressable";
import { StarRating } from "@/components/StarRating";
import { StyledButton } from "@/components/StyledButton";
import { StyledText } from "@/components/StyledText";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { EXTRA_CONSOLES } from "@/core/consoles";
import { entryPlatforms, GAME_STATUSES } from "@/core/game";
import { type GameDetails, getGameDetails } from "@/core/igdb";
import { translateText } from "@/core/translate";
import type { TranslationKey } from "@/core/translations";
import { useIgdbAccess } from "@/hooks/useIgdbAccess";
import { openImageViewer } from "@/utils/navigation";
import { readGame } from "@/utils/routeParams";
import { n } from "@/utils/scaling";

const MAX_SCREENSHOTS = 8;

export default function GameDetailScreen() {
  const { t, language } = useLanguage();
  const confirm = useConfirm();
  const { invertColors } = useInvertColors();
  const access = useIgdbAccess();
  const { getEntry, setStatus, setRating, togglePlatform, removeEntry } =
    useLibrary();
  const params = useLocalSearchParams<{ id: string; game?: string }>();

  const parsedGame = useMemo(() => readGame(params.game), [params.game]);

  // Each answer is kept with what it answers, so a stale one never shows.
  const [loaded, setLoaded] = useState<{
    details: GameDetails;
    gameId: number;
  } | null>(null);
  const [translation, setTranslation] = useState<{
    source: string;
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!(parsedGame && access)) {
      return;
    }
    let active = true;
    getGameDetails(parsedGame.id, access)
      .then((details) => {
        if (active) {
          setLoaded({ details, gameId: parsedGame.id });
        }
      })
      .catch(() => {
        // Description and screenshots are optional; ignore failures.
      });
    return () => {
      active = false;
    };
  }, [parsedGame, access]);

  const details =
    loaded && loaded.gameId === parsedGame?.id ? loaded.details : null;
  const summary = details?.summary;

  useEffect(() => {
    if (language !== "fr" || !summary) {
      return;
    }
    let active = true;
    translateText(summary, "fr").then((text) => {
      if (active && text) {
        setTranslation({ source: summary, text });
      }
    });
    return () => {
      active = false;
    };
  }, [language, summary]);

  if (!parsedGame) {
    return <ContentContainer headerTitle=" " />;
  }

  const game = parsedGame;
  const entry = getEntry(game.id);
  const rating = entry?.rating ?? 0;
  const borderColor = invertColors ? "black" : "white";
  const selected = entry ? entryPlatforms(entry) : [];

  const consoleOptions = Array.from(
    new Set([
      ...(game.platforms?.map((p) => p.name) ?? []),
      ...EXTRA_CONSOLES,
      ...selected,
    ])
  );

  const summaryText =
    language === "fr" && summary && translation?.source === summary
      ? translation.text
      : summary;

  // Ratings stored on the game show at once; the detail request refreshes
  // them. A game IGDB has not rated (null) shows no block at all.
  const ratings = details?.ratings;
  const totalRating = ratings?.total ?? game.igdbRating;
  const ratingStats = totalRating
    ? [
        { label: "IGDB", value: totalRating },
        {
          label: t("game_rating_users"),
          value: ratings?.users ?? game.igdbUserRating,
        },
        {
          label: t("game_rating_critics"),
          value: ratings?.critics ?? game.igdbCriticRating,
        },
      ]
    : [];

  return (
    <ContentContainer headerTitle={game.name}>
      <View style={styles.body}>
        <View style={styles.head}>
          <GameCover game={game} width={n(120)} />
          <View style={styles.headInfo}>
            <StyledText style={styles.title}>{game.name}</StyledText>
            {game.year ? (
              <StyledText style={styles.meta}>{game.year}</StyledText>
            ) : null}
            {ratingStats.length > 0 ? (
              <View style={styles.statRow}>
                {ratingStats.map((stat) => (
                  <View key={stat.label}>
                    <StyledText style={styles.statValue}>
                      {stat.value ?? "–"}
                    </StyledText>
                    <StyledText style={styles.statLabel}>
                      {stat.label}
                    </StyledText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <StyledText style={styles.sectionLabel}>
            {t("game_platforms")}
          </StyledText>
          <View style={styles.chipRow}>
            {consoleOptions.map((name) => (
              <HapticPressable
                key={name}
                onPress={() => togglePlatform(game, name)}
              >
                <StyledText
                  style={[
                    styles.platform,
                    selected.includes(name) && styles.chipActive,
                  ]}
                >
                  {name}
                </StyledText>
              </HapticPressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <StyledText style={styles.sectionLabel}>
            {t("game_set_status")}
          </StyledText>
          <View style={styles.chipRow}>
            {GAME_STATUSES.map((status) => (
              <HapticPressable
                key={status}
                onPress={() => setStatus(game, status)}
              >
                <StyledText
                  style={[
                    styles.status,
                    entry?.status === status && styles.chipActive,
                  ]}
                >
                  {t(`status_${status}` as TranslationKey)}
                </StyledText>
              </HapticPressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <StyledText style={styles.sectionLabel}>
            {t("game_rating")}
          </StyledText>
          <StarRating
            onChange={(value) => setRating(game, value)}
            size={n(26)}
            value={rating}
          />
          <StyledText style={styles.meta}>
            {rating > 0 ? `${rating} / 5` : t("game_unrated")}
          </StyledText>
        </View>

        {summaryText ? (
          <View style={styles.section}>
            <StyledText style={styles.sectionLabel}>
              {t("game_description")}
            </StyledText>
            <StyledText style={styles.summary}>{summaryText}</StyledText>
          </View>
        ) : null}

        {details && details.screenshots.length > 0 ? (
          <View style={styles.section}>
            <StyledText style={styles.sectionLabel}>
              {t("game_images")}
            </StyledText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.shots}>
                {details.screenshots
                  .slice(0, MAX_SCREENSHOTS)
                  .map((url, i, shots) => (
                    <HapticPressable
                      key={url}
                      onPress={() => openImageViewer(shots, i)}
                      style={[styles.shotFrame, { borderColor }]}
                    >
                      <Image
                        resizeMode="cover"
                        source={{ uri: url }}
                        style={styles.shot}
                      />
                    </HapticPressable>
                  ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.actions}>
          <StyledButton
            onPress={() =>
              router.push({
                pathname: "/list/add",
                params: { game: JSON.stringify(game) },
              })
            }
            text={t("game_add_to_list")}
          />
          {entry ? (
            <StyledButton
              onPress={() =>
                confirm({
                  title: t("game_remove"),
                  message: t("game_remove_confirm"),
                  confirmText: t("remove"),
                  onConfirm: () => {
                    removeEntry(game.id);
                    router.back();
                  },
                })
              }
              text={t("game_remove")}
            />
          ) : null}
        </View>
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    width: "100%",
    gap: n(32),
  },
  head: {
    flexDirection: "row",
    gap: n(18),
  },
  headInfo: {
    flex: 1,
    gap: n(6),
  },
  title: {
    fontSize: n(26),
    lineHeight: n(30),
  },
  meta: {
    fontSize: n(14),
    opacity: 0.6,
  },
  statRow: {
    flexDirection: "row",
    gap: n(18),
    marginTop: n(8),
  },
  statValue: {
    fontSize: n(18),
    lineHeight: n(22),
  },
  statLabel: {
    fontSize: n(10),
    opacity: 0.45,
    textTransform: "uppercase",
    letterSpacing: n(0.8),
  },
  section: {
    gap: n(12),
  },
  sectionLabel: {
    fontSize: n(13),
    opacity: 0.45,
    textTransform: "uppercase",
    letterSpacing: n(1),
  },
  summary: {
    fontSize: n(15),
    lineHeight: n(22),
    opacity: 0.85,
  },
  shots: {
    flexDirection: "row",
    gap: n(12),
  },
  shotFrame: {
    width: n(248),
    height: n(140),
    borderWidth: n(1),
    borderRadius: n(3),
    overflow: "hidden",
  },
  shot: {
    width: "100%",
    height: "100%",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: n(12),
  },
  status: {
    fontSize: n(16),
    opacity: 0.45,
  },
  platform: {
    fontSize: n(14),
    opacity: 0.45,
  },
  chipActive: {
    opacity: 1,
    textDecorationLine: "underline",
  },
  actions: {
    gap: n(24),
  },
});
