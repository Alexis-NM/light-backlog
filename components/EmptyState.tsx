import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";
import { StyledButton } from "./StyledButton";
import { StyledText } from "./StyledText";

interface EmptyStateProps {
  actionText?: string;
  hint?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  onAction?: () => void;
  title: string;
}

export function EmptyState({
  icon,
  title,
  hint,
  actionText,
  onAction,
}: EmptyStateProps) {
  const { invertColors } = useInvertColors();
  const color = invertColors ? "black" : "white";

  return (
    <View style={styles.container}>
      {icon ? (
        <MaterialIcons
          color={color}
          name={icon}
          size={n(56)}
          style={styles.icon}
        />
      ) : null}
      <StyledText style={styles.title}>{title}</StyledText>
      {hint ? <StyledText style={styles.hint}>{hint}</StyledText> : null}
      {actionText && onAction ? (
        <View style={styles.action}>
          <StyledButton onPress={onAction} text={actionText} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    paddingTop: n(80),
    gap: n(12),
  },
  icon: {
    opacity: 0.5,
  },
  title: {
    fontSize: n(22),
    textAlign: "center",
  },
  hint: {
    fontSize: n(15),
    textAlign: "center",
    opacity: 0.6,
    lineHeight: n(21),
    maxWidth: "85%",
  },
  action: {
    marginTop: n(16),
    alignItems: "center",
  },
});
