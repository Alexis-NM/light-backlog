import { ScrollView, StyleSheet, View } from "react-native";
import { CONSOLES, EXTRA_CONSOLES } from "@/constants/consoles";
import { n } from "@/utils/scaling";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

const ALL_CONSOLES = [...CONSOLES.map((c) => c.name), ...EXTRA_CONSOLES];

interface ConsoleSelectProps {
  onToggle: (name: string) => void;
  selected: string[];
}

export function ConsoleSelect({ selected, onToggle }: ConsoleSelectProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        {ALL_CONSOLES.map((name) => (
          <HapticPressable key={name} onPress={() => onToggle(name)}>
            <StyledText
              style={[styles.chip, selected.includes(name) && styles.active]}
            >
              {name}
            </StyledText>
          </HapticPressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: n(14),
  },
  chip: {
    fontSize: n(14),
    opacity: 0.45,
  },
  active: {
    opacity: 1,
    textDecorationLine: "underline",
  },
});
