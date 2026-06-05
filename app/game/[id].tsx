import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { GameCover } from "@/components/GameCover";
import { HapticPressable } from "@/components/HapticPressable";
import { StarRating } from "@/components/StarRating";
import { StyledButton } from "@/components/StyledButton";
import { StyledText } from "@/components/StyledText";
import { EXTRA_CONSOLES } from "@/constants/consoles";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import type { TranslationKey } from "@/i18n/translations";
import { type GameDetails, getGameDetails } from "@/services/igdb";
import { translateText } from "@/services/translate";
import { entryPlatforms, GAME_STATUSES, type Game } from "@/types/game";
import { openImageViewer } from "@/utils/navigation";
import { n } from "@/utils/scaling";

const MAX_SCREENSHOTS = 8;

export default function GameDetailScreen() {
  const { t, language } = useLanguage();
  const { invertColors } = useInvertColors();
  const { auth } = useCredentials();
  const { getEntry, setStatus, setRating, togglePlatform, removeEntry } =
    useLibrary();
  const params = useLocalSearchParams<{ id: string; game?: string }>();

  const parsedGame = useMemo<Game | null>(() => {
    if (!params.game) {
      return null;
    }
    try {
      return JSON.parse(params.game) as Game;
    } catch {
      return null;
    }
  }, [params.game]);

  const [details, setDetails] = useState<GameDetails | null>(null);
  const [translatedSummary, setTranslatedSummary] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!(parsedGame && auth)) {
      return;
    }
    let active = true;
    setDetails(null);
    getGameDetails(parsedGame.id, auth)
      .then((loaded) => {
        if (active) {
          setDetails(loaded);
        }
      })
      .catch(() => {
        // Description and screenshots are optional; ignore failures.
      });
    return () => {
      active = false;
    };
  }, [parsedGame, auth]);

  useEffect(() => {
    const summary = details?.summary;
    if (language !== "fr" || !summary) {
      setTranslatedSummary(null);
      return;
    }
    let active = true;
    translateText(summary, "fr").then((translated) => {
      if (active && translated) {
        setTranslatedSummary(translated);
      }
    });
    return () => {
      active = false;
    };
  }, [language, details?.summary]);

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

  let summaryText = details?.summary;
  if (summaryText && language === "fr" && translatedSummary) {
    summaryText = translatedSummary;
  }

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
              onPress={() => removeEntry(game.id)}
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
    gap: n(16),
  },
  status: {
    fontSize: n(20),
    opacity: 0.45,
  },
  platform: {
    fontSize: n(16),
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
