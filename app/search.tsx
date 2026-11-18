import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ConsoleSelect } from "@/components/ConsoleSelect";
import ContentContainer from "@/components/ContentContainer";
import { EmptyState } from "@/components/EmptyState";
import { yearOf } from "@/components/GameGrid";
import { GameGridContainer } from "@/components/GameGridContainer";
import { StyledText } from "@/components/StyledText";
import { TextInput } from "@/components/TextInput";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { platformIdsFor } from "@/core/consoles";
import type { Game } from "@/core/game";
import { IgdbError, searchGames } from "@/core/igdb";
import { refusedMessage, useIgdbAccess } from "@/hooks/useIgdbAccess";
import { usePersistedState } from "@/hooks/usePersistedState";
import { n } from "@/utils/scaling";

type Phase = "idle" | "loading" | "done" | "error";

export default function SearchScreen() {
  const { t } = useLanguage();
  const access = useIgdbAccess();
  const { invertColors } = useInvertColors();
  const { getEntry } = useLibrary();
  const [query, setQuery] = useState("");
  const [consoles, setConsoles] = usePersistedState<string[]>(
    "search_consoles",
    []
  );
  const [results, setResults] = useState<Game[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorText, setErrorText] = useState("");

  const isInLibrary = useCallback(
    (game: Game) => Boolean(getEntry(game.id)),
    [getEntry]
  );

  if (!access) {
    return (
      <ContentContainer headerTitle={t("search_title")}>
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

  const search = async (selectedConsoles: string[]) => {
    if (query.trim().length === 0) {
      return;
    }
    setPhase("loading");
    setErrorText("");
    try {
      const found = await searchGames(
        query,
        access,
        platformIdsFor(selectedConsoles)
      );
      setResults(found);
      setPhase("done");
    } catch (error) {
      if (error instanceof IgdbError && error.kind === "auth") {
        setErrorText(t(refusedMessage(access)));
      } else if (error instanceof IgdbError && error.kind === "network") {
        setErrorText(t("network_error"));
      } else if (error instanceof IgdbError) {
        setErrorText(error.message);
      } else {
        setErrorText(t("error"));
      }
      setPhase("error");
    }
  };

  const runSearch = () => search(consoles);

  // Changing the console filter re-runs the current search.
  const toggleConsole = (name: string) => {
    const next = consoles.includes(name)
      ? consoles.filter((c) => c !== name)
      : [...consoles, name];
    setConsoles(next);
    search(next);
  };

  const status = (() => {
    switch (phase) {
      case "loading":
        return (
          <View style={styles.centered}>
            <ActivityIndicator color={invertColors ? "black" : "white"} />
            <StyledText style={styles.muted}>
              {t("search_searching")}
            </StyledText>
          </View>
        );
      case "error":
        return <StyledText style={styles.error}>{errorText}</StyledText>;
      case "idle":
        return (
          <StyledText style={styles.muted}>{t("search_empty")}</StyledText>
        );
      default:
        return null;
    }
  })();

  return (
    <GameGridContainer
      empty={
        phase === "done" ? (
          <StyledText style={styles.muted}>{t("search_no_results")}</StyledText>
        ) : undefined
      }
      games={results}
      getInLibrary={isInLibrary}
      getSubtitle={yearOf}
      header={
        <View style={styles.body}>
          <TextInput
            autoFocus
            onChangeText={setQuery}
            onSubmit={runSearch}
            placeholder={t("search_placeholder")}
            value={query}
          />
          <View style={styles.filter}>
            <StyledText style={styles.label}>{t("list_consoles")}</StyledText>
            <ConsoleSelect onToggle={toggleConsole} selected={consoles} />
          </View>
          {status}
        </View>
      }
      headerTitle={t("search_title")}
      rightAction={{
        icon: "search",
        onPress: runSearch,
        show: query.length > 0,
      }}
    />
  );
}

const styles = StyleSheet.create({
  body: {
    width: "100%",
    gap: n(24),
    marginBottom: n(24),
  },
  filter: {
    gap: n(12),
  },
  label: {
    fontSize: n(13),
    opacity: 0.45,
    textTransform: "uppercase",
    letterSpacing: n(1),
  },
  centered: {
    alignItems: "center",
    gap: n(10),
    paddingTop: n(20),
  },
  muted: {
    fontSize: n(15),
    opacity: 0.6,
  },
  error: {
    fontSize: n(15),
    opacity: 0.8,
  },
});
