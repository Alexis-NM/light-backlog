import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { EmptyState } from "@/components/EmptyState";
import { GameGrid } from "@/components/GameGrid";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { CONSOLE_FAMILIES, CONSOLES } from "@/constants/consoles";
import { useBrowse } from "@/contexts/BrowseContext";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { usePreferredConsole } from "@/contexts/PreferredConsoleContext";
import { usePlatformGames } from "@/hooks/usePlatformGames";
import type { TranslationKey } from "@/i18n/translations";
import type { Game } from "@/types/game";
import { triggerHaptic, triggerSuccess } from "@/utils/haptics";
import { openGame } from "@/utils/navigation";
import { n } from "@/utils/scaling";

export default function GamesScreen() {
  const { t } = useLanguage();
  const { auth } = useCredentials();
  const { invertColors } = useInvertColors();
  const { selectedConsole, setSelectedConsole } = useBrowse();
  const { getEntry, setStatus, removeEntry } = useLibrary();
  const { setPreferredConsole } = usePreferredConsole();
  const { games, phase, loadingMore, errorText, loadMore } = usePlatformGames(
    selectedConsole?.id ?? null
  );

  const spinnerColor = invertColors ? "black" : "white";

  if (!auth) {
    return (
      <ContentContainer headerTitle={t("games_title")} hideBackButton>
        <EmptyState
          actionText={t("games_set_up")}
          hint={t("games_no_creds_hint")}
          icon="vpn-key"
          onAction={() => router.push("/settings/credentials")}
          title={t("games_no_creds")}
        />
      </ContentContainer>
    );
  }

  if (!selectedConsole) {
    return (
      <ContentContainer headerTitle={t("games_title")} hideBackButton>
        <View style={styles.body}>
          <StyledText style={styles.intro}>
            {t("games_choose_console")}
          </StyledText>
          {CONSOLE_FAMILIES.map((family) => (
            <View key={family} style={styles.section}>
              <StyledText style={styles.sectionLabel}>
                {t(`family_${family}` as TranslationKey)}
              </StyledText>
              {CONSOLES.filter((console) => console.family === family).map(
                (console) => (
                  <HapticPressable
                    key={console.id}
                    onPress={() => setSelectedConsole(console)}
                    style={styles.row}
                  >
                    <StyledText style={styles.console}>
                      {console.name}
                    </StyledText>
                  </HapticPressable>
                )
              )}
            </View>
          ))}
        </View>
      </ContentContainer>
    );
  }

  const platformNameFor = (game: Game) =>
    game.platforms?.find((p) => p.id === selectedConsole.id)?.name ??
    selectedConsole.name;

  const quickToggle = (game: Game) => {
    if (getEntry(game.id)) {
      removeEntry(game.id);
      triggerHaptic();
      return;
    }
    const name = platformNameFor(game);
    setStatus(game, "backlog", name);
    setPreferredConsole(name);
    triggerSuccess();
  };

  return (
    <ContentContainer
      contentWidth="wide"
      headerTitle={selectedConsole.name}
      hideBackButton
      onEndReached={loadMore}
      rightAction={{ icon: "apps", onPress: () => setSelectedConsole(null) }}
    >
      {phase === "loading" ? (
        <View style={styles.centered}>
          <ActivityIndicator color={spinnerColor} />
        </View>
      ) : null}

      {phase === "error" ? (
        <StyledText style={styles.muted}>{errorText}</StyledText>
      ) : null}

      {phase === "done" && games.length === 0 ? (
        <StyledText style={styles.muted}>{t("search_no_results")}</StyledText>
      ) : null}

      {games.length > 0 ? (
        <View style={styles.list}>
          <GameGrid
            games={games}
            getInLibrary={(game) => Boolean(getEntry(game.id))}
            getSubtitle={(game) => game.year?.toString()}
            onDoublePressGame={quickToggle}
            onPressGame={(game) => openGame(game, platformNameFor(game))}
          />
          {loadingMore ? (
            <ActivityIndicator color={spinnerColor} style={styles.more} />
          ) : null}
        </View>
      ) : null}
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    width: "100%",
    gap: n(28),
  },
  intro: {
    fontSize: n(15),
    opacity: 0.6,
  },
  section: {
    gap: n(10),
  },
  sectionLabel: {
    fontSize: n(13),
    opacity: 0.45,
    textTransform: "uppercase",
    letterSpacing: n(1),
  },
  row: {
    paddingVertical: n(2),
  },
  console: {
    fontSize: n(22),
  },
  centered: {
    alignItems: "center",
    paddingTop: n(40),
  },
  muted: {
    fontSize: n(15),
    opacity: 0.6,
  },
  list: {
    width: "100%",
    gap: n(20),
    paddingBottom: n(24),
  },
  more: {
    paddingVertical: n(10),
  },
});
