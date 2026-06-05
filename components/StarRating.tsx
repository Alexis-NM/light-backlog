import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { triggerHaptic } from "@/utils/haptics";
import { n } from "@/utils/scaling";
import { HapticPressable } from "./HapticPressable";

const STARS = [0, 1, 2, 3, 4];

interface StarRatingProps {
  onChange?: (value: number) => void;
  size?: number;
  value: number;
}

function iconFor(index: number, value: number) {
  if (value >= index + 1) {
    return "star" as const;
  }
  if (value >= index + 0.5) {
    return "star-half" as const;
  }
  return "star-border" as const;
}

export function StarRating({ value, onChange, size = n(34) }: StarRatingProps) {
  const { invertColors } = useInvertColors();
  const color = invertColors ? "black" : "white";

  const select = (next: number) => {
    triggerHaptic();
    onChange?.(next === value ? 0 : next);
  };

  return (
    <View style={styles.row}>
      {STARS.map((index) => {
        const star = (
          <MaterialIcons
            color={color}
            name={iconFor(index, value)}
            size={size}
          />
        );

        if (!onChange) {
          return (
            <View key={index} style={styles.star}>
              {star}
            </View>
          );
        }

        return (
          <View key={index} style={styles.star}>
            {star}
            <HapticPressable
              onPress={() => select(index + 0.5)}
              style={styles.halfLeft}
            />
            <HapticPressable
              onPress={() => select(index + 1)}
              style={styles.halfRight}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: n(4),
  },
  star: {
    position: "relative",
  },
  halfLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "50%",
  },
  halfRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "50%",
  },
});
