import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import type { Game } from "@/types/game";
import { openGame } from "@/utils/navigation";
import { n } from "@/utils/scaling";
import { GameCover } from "./GameCover";
import { HapticPressable } from "./HapticPressable";
import { StyledText } from "./StyledText";

const DOUBLE_TAP_MS = 280;

interface GameCardProps {
  game: Game;
  inLibrary?: boolean;
  onDoublePress?: (game: Game) => void;
  onPress?: (game: Game) => void;
  subtitle?: string;
  width: number;
}

export function GameCard({
  game,
  width,
  subtitle,
  inLibrary,
  onPress,
  onDoublePress,
}: GameCardProps) {
  const { invertColors } = useInvertColors();
  const lastTapRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    []
  );

  const open = () => (onPress ? onPress(game) : openGame(game));

  const handlePress = () => {
    if (!onDoublePress) {
      open();
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      lastTapRef.current = 0;
      onDoublePress(game);
      return;
    }
    lastTapRef.current = now;
    timerRef.current = setTimeout(() => {
      lastTapRef.current = 0;
      timerRef.current = null;
      open();
    }, DOUBLE_TAP_MS);
  };

  return (
    <HapticPressable onPress={handlePress} style={{ width }}>
      <View>
        <GameCover game={game} width={width} />
        {inLibrary ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: invertColors ? "black" : "white" },
            ]}
          >
            <MaterialIcons
              color={invertColors ? "white" : "black"}
              name="check"
              size={n(14)}
            />
          </View>
        ) : null}
      </View>
      <StyledText numberOfLines={2} style={styles.title}>
        {game.name}
      </StyledText>
      {subtitle ? (
        <StyledText numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </StyledText>
      ) : null}
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: n(13),
    lineHeight: n(15),
    marginTop: n(6),
  },
  subtitle: {
    fontSize: n(11),
    opacity: 0.6,
    marginTop: n(1),
  },
  badge: {
    position: "absolute",
    top: n(5),
    right: n(5),
    width: n(20),
    height: n(20),
    borderRadius: n(10),
    alignItems: "center",
    justifyContent: "center",
  },
});
