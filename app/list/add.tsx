import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { TextInput } from "@/components/TextInput";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLists } from "@/contexts/ListsContext";
import type { Game } from "@/types/game";
import { n } from "@/utils/scaling";

function parseGames(raw?: string): Game[] {
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as Game[];
  } catch {
    return [];
  }
}

export default function AddToListScreen() {
  const { t } = useLanguage();
  const { invertColors } = useInvertColors();
  const {
    lists,
    createList,
    createListWithGames,
    addGameToList,
    addGamesToList,
    removeGameFromList,
  } = useLists();
  const params = useLocalSearchParams<{
    game?: string;
    games?: string;
    exclude?: string;
  }>();
  const [name, setName] = useState("");

  const iconColor = invertColors ? "black" : "white";

  const game = useMemo<Game | null>(() => {
    if (!params.game) {
      return null;
    }
    try {
      return JSON.parse(params.game) as Game;
    } catch {
      return null;
    }
  }, [params.game]);

  const games = useMemo(() => parseGames(params.games), [params.games]);
  const multi = games.length > 0;

  if (!(game || multi)) {
    return <ContentContainer headerTitle=" " />;
  }

  const visibleLists = params.exclude
    ? lists.filter((list) => list.id !== params.exclude)
    : lists;

  const createAndAdd = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    if (multi) {
      createListWithGames(trimmed, games);
      router.back();
      return;
    }
    if (game) {
      const id = createList(trimmed);
      addGameToList(id, game);
      setName("");
    }
  };

  const addToList = (listId: string) => {
    addGamesToList(listId, games);
    router.back();
  };

  const toggle = (listId: string, isMember: boolean) => {
    if (!game) {
      return;
    }
    if (isMember) {
      removeGameFromList(listId, game.id);
    } else {
      addGameToList(listId, game);
    }
  };

  return (
    <ContentContainer
      headerTitle={t("game_add_to_list")}
      rightAction={{
        icon: "check",
        onPress: createAndAdd,
        show: name.length > 0,
      }}
    >
      <View style={styles.body}>
        <TextInput
          onChangeText={setName}
          onSubmit={createAndAdd}
          placeholder={t("list_name_placeholder")}
          value={name}
        />

        {visibleLists.length === 0 ? (
          <StyledText style={styles.hint}>{t("list_none")}</StyledText>
        ) : (
          <View style={styles.lists}>
            {visibleLists.map((list) => {
              const isMember =
                !multi && game !== null && list.gameIds.includes(game.id);
              return (
                <HapticPressable
                  key={list.id}
                  onPress={() =>
                    multi ? addToList(list.id) : toggle(list.id, isMember)
                  }
                  style={styles.row}
                >
                  <StyledText numberOfLines={1} style={styles.name}>
                    {list.name}
                  </StyledText>
                  <MaterialIcons
                    color={iconColor}
                    name={isMember ? "check" : "add"}
                    size={n(26)}
                  />
                </HapticPressable>
              );
            })}
          </View>
        )}
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    width: "100%",
    gap: n(28),
  },
  hint: {
    fontSize: n(15),
    opacity: 0.6,
  },
  lists: {
    gap: n(18),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: n(12),
  },
  name: {
    flex: 1,
    fontSize: n(22),
  },
});
