import { ScrollView, StyleSheet, View } from "react-native";
import { n } from "@/utils/scaling";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

interface ChipOption<T extends string> {
  label: string;
  value: T;
}

interface ChipSelectProps<T extends string> {
  onSelect: (value: T) => void;
  options: readonly ChipOption<T>[];
  selected: T;
}

/** Single-choice row of text chips, in the style of the console picker. */
export function ChipSelect<T extends string>({
  options,
  selected,
  onSelect,
}: ChipSelectProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        {options.map((option) => (
          <HapticPressable
            key={option.value}
            onPress={() => onSelect(option.value)}
          >
            <StyledText
              style={[styles.chip, option.value === selected && styles.active]}
            >
              {option.label}
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
