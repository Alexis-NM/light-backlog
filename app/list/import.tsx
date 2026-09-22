import { getDocumentAsync } from "expo-document-picker";
import { readAsStringAsync } from "expo-file-system/legacy";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
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
import { placeholderColor, TextInput } from "@/components/TextInput";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLists } from "@/contexts/ListsContext";
import { IgdbError, searchGamesBatch, toGame } from "@/services/igdb";
import { type ImportMatch, matchImportTitles } from "@/services/importMatcher";
import { parseGameTitles } from "@/services/listParser";
import { n } from "@/utils/scaling";

type Phase = "idle" | "matching" | "done" | "error";

const REPORT_MAX_LINES = 25;
const KEEP_AWAKE_TAG = "list-import";

const describeMatch = (match: ImportMatch, offConsole: string) => {
  const game = match.game;
  if (!game) {
    return match.title;
  }
  const year = game.year ? ` (${game.year})` : "";
  const note = match.onPlatform ? "" : ` · ${offConsole}`;
  return `${match.title} → ${game.name}${year}${note}`;
};

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
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState("");
  const [listId, setListId] = useState<string | null>(null);
  const [matches, setMatches] = useState<ImportMatch[]>([]);

  const color = invertColors ? "black" : "white";

  const toggleConsole = (consoleName: string) =>
    setConsoles((current) =>
      current.includes(consoleName)
        ? current.filter((c) => c !== consoleName)
        : [...current, consoleName]
    );

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

  const running = phase === "matching";

  const pickFile = async () => {
    try {
      const result = await getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) {
        return;
      }
      const content = await readAsStringAsync(result.assets[0].uri);
      setSource(content);
      setPhase("idle");
      setMessage("");
    } catch {
      setMessage(t("import_error"));
      setPhase("error");
    }
  };

  const describeError = (error: unknown) => {
    if (error instanceof IgdbError && error.kind === "auth") {
      return t("creds_invalid");
    }
    if (error instanceof IgdbError && error.kind === "network") {
      return t("network_error");
    }
    return error instanceof IgdbError ? error.message : t("error");
  };

  const runImport = async () => {
    if (source.trim().length === 0 || running) {
      return;
    }
    const titles = parseGameTitles(source);
    if (titles.length === 0) {
      setMessage(t("import_empty"));
      setPhase("error");
      return;
    }

    setPhase("matching");
    setMessage("");
    setMatches([]);
    setProgress({ done: 0, total: titles.length });

    // A long import must not be paused by the screen turning off.
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    let results: ImportMatch[];
    try {
      results = await matchImportTitles(
        titles,
        (queries) => searchGamesBatch(queries, auth),
        { consoles, onProgress: (done, total) => setProgress({ done, total }) }
      );
    } catch (error) {
      setMessage(describeError(error));
      setPhase("error");
      return;
    } finally {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    }

    const matched = results
      .map((match) => match.game)
      .filter((game) => game !== undefined)
      .map(toGame);

    setMatches(results);
    setMessage(
      t("import_done", {
        imported: matched.length,
        notFound: titles.length - matched.length,
      })
    );
    if (matched.length === 0) {
      setPhase("done");
      return;
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
    setPhase("done");
  };

  const notFound = matches.filter((match) => !match.game);
  const toCheck = matches.filter(
    (match) =>
      match.game && (match.confidence === "uncertain" || !match.onPlatform)
  );

  const renderReport = (title: string, items: ImportMatch[]) => {
    if (items.length === 0) {
      return null;
    }
    const shown = items.slice(0, REPORT_MAX_LINES);
    const rest = items.length - shown.length;
    return (
      <View style={styles.field}>
        <StyledText style={styles.label}>{title}</StyledText>
        {shown.map((match) => (
          <StyledText key={match.title} style={styles.reportLine}>
            {describeMatch(match, t("import_off_console"))}
          </StyledText>
        ))}
        {rest > 0 ? (
          <StyledText style={styles.muted}>
            {t("import_more", { count: rest })}
          </StyledText>
        ) : null}
      </View>
    );
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
            placeholderTextColor={placeholderColor(invertColors)}
            style={[styles.source, { color, borderBottomColor: color }]}
            value={source}
          />
        </View>

        <StyledButton onPress={pickFile} text={t("import_pick_file")} />

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
              {t("import_matching", {
                done: progress.done,
                total: progress.total,
              })}
            </StyledText>
          </View>
        ) : null}

        {message.length > 0 && !running ? (
          <StyledText style={styles.muted}>{message}</StyledText>
        ) : null}

        {phase === "done"
          ? renderReport(
              t("import_not_found", { count: notFound.length }),
              notFound
            )
          : null}
        {phase === "done"
          ? renderReport(t("import_check", { count: toCheck.length }), toCheck)
          : null}

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
  reportLine: {
    fontSize: n(15),
    opacity: 0.85,
  },
});
