import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { EmptyState } from "@/components/EmptyState";
import { GameGrid } from "@/components/GameGrid";
import { StyledText } from "@/components/StyledText";
import { TextInput } from "@/components/TextInput";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { IgdbError, searchGames } from "@/services/igdb";
import type { Game } from "@/types/game";
import { n } from "@/utils/scaling";

type Phase = "idle" | "loading" | "done" | "error";

export default function SearchScreen() {
  const { t } = useLanguage();
  const { auth } = useCredentials();
  const { invertColors } = useInvertColors();
  const { getEntry } = useLibrary();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Game[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorText, setErrorText] = useState("");

  if (!auth) {
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

  const runSearch = async () => {
    if (query.trim().length === 0) {
      return;
    }
    setPhase("loading");
    setErrorText("");
    try {
      const found = await searchGames(query, auth);
      setResults(found);
      setPhase("done");
    } catch (error) {
      if (error instanceof IgdbError && error.kind === "auth") {
        setErrorText(t("creds_invalid"));
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

  return (
    <ContentContainer
      contentWidth="wide"
      headerTitle={t("search_title")}
      rightAction={{
        icon: "search",
        onPress: runSearch,
        show: query.length > 0,
      }}
    >
      <View style={styles.body}>
        <TextInput
          autoFocus
          onChangeText={setQuery}
          onSubmit={runSearch}
          placeholder={t("search_placeholder")}
          value={query}
        />

        {phase === "loading" ? (
          <View style={styles.centered}>
            <ActivityIndicator color={invertColors ? "black" : "white"} />
            <StyledText style={styles.muted}>
              {t("search_searching")}
            </StyledText>
          </View>
        ) : null}

        {phase === "error" ? (
          <StyledText style={styles.error}>{errorText}</StyledText>
        ) : null}

        {phase === "done" && results.length === 0 ? (
          <StyledText style={styles.muted}>{t("search_no_results")}</StyledText>
        ) : null}

        {phase === "idle" ? (
          <StyledText style={styles.muted}>{t("search_empty")}</StyledText>
        ) : null}

        {results.length > 0 ? (
          <GameGrid
            games={results}
            getInLibrary={(game) => Boolean(getEntry(game.id))}
            getSubtitle={(game) => game.year?.toString()}
          />
        ) : null}
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    width: "100%",
    gap: n(24),
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
