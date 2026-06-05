import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ConsoleSelect } from "@/components/ConsoleSelect";
import ContentContainer from "@/components/ContentContainer";
import { GameGrid } from "@/components/GameGrid";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledButton } from "@/components/StyledButton";
import { StyledText } from "@/components/StyledText";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLists } from "@/contexts/ListsContext";
import { triggerSuccess } from "@/utils/haptics";
import { n } from "@/utils/scaling";

export default function ListDetailScreen() {
  const { t } = useLanguage();
  const { invertColors } = useInvertColors();
  const { getList, deleteList, setListConsoles } = useLists();
  const { addMany } = useLibrary();
  const params = useLocalSearchParams<{
    id: string;
    confirmed?: string;
    action?: string;
  }>();
  const [fullscreen, setFullscreen] = useState(false);

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

  const addAllToLibrary = () => {
    if (games.length === 0) {
      return;
    }
    addMany(games, "backlog", consoles);
    triggerSuccess();
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
    <View style={styles.root}>
      <ContentContainer
        contentWidth="wide"
        headerTitle={fullscreen ? undefined : list.name}
        rightActions={
          fullscreen
            ? undefined
            : [
                { icon: "fullscreen", onPress: () => setFullscreen(true) },
                { icon: "delete-outline", onPress: confirmDelete },
              ]
        }
      >
        <View style={[styles.body, fullscreen && styles.bodyFull]}>
          {fullscreen ? null : (
            <>
              <View style={styles.section}>
                <StyledText style={styles.label}>
                  {t("list_consoles")}
                </StyledText>
                <ConsoleSelect onToggle={toggleConsole} selected={consoles} />
              </View>
              {games.length > 0 ? (
                <StyledButton
                  onPress={addAllToLibrary}
                  text={t("list_add_all")}
                />
              ) : null}
            </>
          )}

          {games.length > 0 ? (
            <GameGrid
              games={games}
              getSubtitle={(game) => game.year?.toString()}
            />
          ) : (
            <StyledText style={styles.muted}>{t("list_empty")}</StyledText>
          )}
        </View>
      </ContentContainer>

      {fullscreen ? (
        <HapticPressable
          onPress={() => setFullscreen(false)}
          style={[
            styles.exit,
            {
              backgroundColor: invertColors
                ? "rgba(255,255,255,0.5)"
                : "rgba(0,0,0,0.5)",
            },
          ]}
        >
          <MaterialIcons
            color={invertColors ? "black" : "white"}
            name="fullscreen-exit"
            size={n(26)}
          />
        </HapticPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    width: "100%",
    gap: n(24),
  },
  bodyFull: {
    paddingTop: n(50),
    paddingBottom: n(24),
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
  muted: {
    opacity: 0.6,
  },
  exit: {
    position: "absolute",
    top: n(16),
    right: n(16),
    width: n(40),
    height: n(40),
    borderRadius: n(20),
    alignItems: "center",
    justifyContent: "center",
  },
});
