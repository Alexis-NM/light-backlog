import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

export interface RightAction {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  show?: boolean;
}

interface HeaderProps {
  headerTitle?: string;
  hideBackButton?: boolean;
  rightAction?: RightAction;
  rightActions?: RightAction[];
}

export function Header({
  headerTitle,
  hideBackButton = false,
  rightAction,
  rightActions,
}: HeaderProps) {
  const { invertColors } = useInvertColors();
  const iconColor = invertColors ? "black" : "white";

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  const actions = (rightActions ?? (rightAction ? [rightAction] : [])).filter(
    (action) => action.show !== false
  );

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: invertColors ? "white" : "black" },
      ]}
    >
      {hideBackButton ? (
        <View style={styles.button} />
      ) : (
        <HapticPressable onPress={handleBack}>
          <View style={styles.button}>
            <MaterialIcons
              color={iconColor}
              name="arrow-back-ios"
              size={n(28)}
            />
          </View>
        </HapticPressable>
      )}
      <StyledText numberOfLines={1} style={styles.title}>
        {headerTitle}
      </StyledText>
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <HapticPressable key={action.icon} onPress={action.onPress}>
              <View style={styles.button}>
                <MaterialIcons
                  color={iconColor}
                  name={action.icon}
                  size={n(28)}
                />
              </View>
            </HapticPressable>
          ))}
        </View>
      ) : (
        <View style={styles.button} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: n(22),
    paddingVertical: n(5),
    zIndex: 1,
  },
  title: {
    fontSize: n(20),
    fontFamily: "PublicSans-Regular",
    paddingTop: n(2),
    maxWidth: "65%",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    width: n(32),
    height: n(32),
    alignItems: "center",
    paddingTop: n(6),
    paddingRight: n(4),
  },
});
