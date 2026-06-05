import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { TextInput } from "@/components/TextInput";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLists } from "@/contexts/ListsContext";
import { n } from "@/utils/scaling";

export default function ListOptionsScreen() {
  const { t } = useLanguage();
  const { invertColors } = useInvertColors();
  const { getList, renameList, moveList, lists } = useLists();
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = getList(id);
  const [name, setName] = useState(list?.name ?? "");

  const iconColor = invertColors ? "black" : "white";
  const index = lists.findIndex((item) => item.id === id);
  const total = lists.length;
  const canMoveUp = index > 0;
  const canMoveDown = index >= 0 && index < total - 1;

  const save = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    renameList(id, trimmed);
    router.back();
  };

  if (!list) {
    return <ContentContainer headerTitle=" " />;
  }

  return (
    <ContentContainer
      headerTitle={t("list_options")}
      rightAction={{ icon: "check", onPress: save, show: name.length > 0 }}
    >
      <View style={styles.body}>
        <TextInput
          onChangeText={setName}
          onSubmit={save}
          placeholder={t("list_name_placeholder")}
          value={name}
        />

        <View style={styles.moveRow}>
          <HapticPressable
            disabled={!canMoveUp}
            onPress={() => moveList(id, "up")}
            style={[styles.moveButton, !canMoveUp && styles.disabled]}
          >
            <MaterialIcons color={iconColor} name="arrow-upward" size={n(22)} />
            <StyledText style={styles.moveLabel}>
              {t("list_move_up")}
            </StyledText>
          </HapticPressable>
          <HapticPressable
            disabled={!canMoveDown}
            onPress={() => moveList(id, "down")}
            style={[styles.moveButton, !canMoveDown && styles.disabled]}
          >
            <MaterialIcons
              color={iconColor}
              name="arrow-downward"
              size={n(22)}
            />
            <StyledText style={styles.moveLabel}>
              {t("list_move_down")}
            </StyledText>
          </HapticPressable>
        </View>

        <StyledText
          style={styles.position}
        >{`${index + 1} / ${total}`}</StyledText>
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    width: "100%",
    gap: n(28),
  },
  moveRow: {
    flexDirection: "row",
    gap: n(28),
  },
  moveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: n(8),
  },
  moveLabel: {
    fontSize: n(18),
  },
  disabled: {
    opacity: 0.3,
  },
  position: {
    fontSize: n(13),
    opacity: 0.5,
  },
});
