import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  TextInput as RNTextInput,
  StyleSheet,
  View,
} from "react-native";
import { ConsoleSelect } from "@/components/ConsoleSelect";
import ContentContainer from "@/components/ContentContainer";
import { EmptyState } from "@/components/EmptyState";
import { StyledButton } from "@/components/StyledButton";
import { StyledText } from "@/components/StyledText";
import { TextInput } from "@/components/TextInput";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLists } from "@/contexts/ListsContext";
import { resolveTitles } from "@/services/backloggd";
import { searchGames } from "@/services/igdb";
import type { Game } from "@/types/game";
import { n } from "@/utils/scaling";

type Phase = "idle" | "fetching" | "matching" | "done" | "error";

const SEARCH_DELAY_MS = 120;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ImportListScreen() {
  const { t } = useLanguage();
  const { auth } = useCredentials();
  const { invertColors } = useInvertColors();
  const { createListWithGames } = useLists();
  const { addMany } = useLibrary();

  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [consoles, setConsoles] = useState<string[]>([]);
  const [toLibrary, setToLibrary] = useState(false);

  const toggleConsole = (consoleName: string) =>
    setConsoles((current) =>
      current.includes(consoleName)
        ? current.filter((c) => c !== consoleName)
        : [...current, consoleName]
    );
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState("");
  const [listId, setListId] = useState<string | null>(null);

  const color = invertColors ? "black" : "white";

  if (!auth) {
    return (
      <ContentContainer headerTitle={t("import_title")}>
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

  const running = phase === "fetching" || phase === "matching";

  const runImport = async () => {
    if (source.trim().length === 0 || running) {
      return;
    }
    setPhase("fetching");
    setMessage("");

    let titles: string[];
    try {
      titles = await resolveTitles(source);
    } catch {
      setMessage(t("import_error"));
      setPhase("error");
      return;
    }
    if (titles.length === 0) {
      setMessage(t("import_empty"));
      setPhase("error");
      return;
    }

    setPhase("matching");
    setProgress({ done: 0, total: titles.length });
    const matched: Game[] = [];
    for (let i = 0; i < titles.length; i++) {
      try {
        const results = await searchGames(titles[i], auth);
        if (results[0]) {
          matched.push(results[0]);
        }
      } catch {
        // Unmatched / failed lookups are simply skipped.
      }
      setProgress({ done: i + 1, total: titles.length });
      await delay(SEARCH_DELAY_MS);
    }

    const created = createListWithGames(
      name.trim() || t("import_name_ph"),
      matched,
      consoles
    );
    if (toLibrary && matched.length > 0) {
      addMany(matched, "backlog", consoles);
    }
    setListId(created);
    setMessage(
      t("import_done", {
        imported: matched.length,
        notFound: titles.length - matched.length,
      })
    );
    setPhase("done");
  };

  return (
    <ContentContainer
      headerTitle={t("import_title")}
      rightAction={{
        icon: "check",
        onPress: runImport,
        show: source.length > 0 && phase !== "done" && !running,
      }}
    >
      <View style={styles.body}>
        <View style={styles.field}>
          <StyledText style={styles.label}>{t("import_name_label")}</StyledText>
          <TextInput
            onChangeText={setName}
            placeholder={t("import_name_ph")}
            value={name}
          />
        </View>

        <View style={styles.field}>
          <StyledText style={styles.label}>
            {t("import_source_label")}
          </StyledText>
          <RNTextInput
            allowFontScaling={false}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            onChangeText={setSource}
            placeholder={t("import_source_ph")}
            placeholderTextColor={color}
            style={[styles.source, { color, borderBottomColor: color }]}
            value={source}
          />
        </View>

        <View style={styles.field}>
          <StyledText style={styles.label}>{t("list_consoles")}</StyledText>
          <ConsoleSelect onToggle={toggleConsole} selected={consoles} />
        </View>

        <ToggleSwitch
          label={t("import_to_library")}
          onValueChange={setToLibrary}
          value={toLibrary}
        />

        {running ? (
          <View style={styles.centered}>
            <ActivityIndicator color={color} />
            <StyledText style={styles.muted}>
              {phase === "fetching"
                ? t("import_fetching")
                : t("import_matching", {
                    done: progress.done,
                    total: progress.total,
                  })}
            </StyledText>
          </View>
        ) : null}

        {message.length > 0 && !running ? (
          <StyledText style={styles.muted}>{message}</StyledText>
        ) : null}

        {phase === "done" && listId ? (
          <StyledButton
            onPress={() =>
              router.replace({ pathname: "/list/[id]", params: { id: listId } })
            }
            text={t("done")}
          />
        ) : (
          <StyledButton onPress={runImport} text={t("import_run")} />
        )}
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    width: "100%",
    gap: n(26),
  },
  field: {
    gap: n(8),
  },
  label: {
    fontSize: n(13),
    opacity: 0.45,
    textTransform: "uppercase",
    letterSpacing: n(1),
  },
  source: {
    fontFamily: "PublicSans-Regular",
    fontSize: n(16),
    borderBottomWidth: n(1),
    paddingVertical: n(6),
    minHeight: n(44),
    maxHeight: n(160),
    textAlignVertical: "top",
  },
  centered: {
    alignItems: "center",
    gap: n(10),
    paddingTop: n(10),
  },
  muted: {
    fontSize: n(15),
    opacity: 0.7,
  },
});
