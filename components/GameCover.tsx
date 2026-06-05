import { Image, StyleSheet, View } from "react-native";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import type { Game } from "@/types/game";
import { n } from "@/utils/scaling";
import { StyledText } from "./StyledText";

const COVER_RATIO = 4 / 3;

interface GameCoverProps {
  game: Game;
  width: number;
}

export function GameCover({ game, width }: GameCoverProps) {
  const { invertColors } = useInvertColors();
  const borderColor = invertColors ? "black" : "white";
  const height = width * COVER_RATIO;

  return (
    <View style={[styles.frame, { width, height, borderColor }]}>
      {game.coverUrl ? (
        <Image
          resizeMode="cover"
          source={{ uri: game.coverUrl }}
          style={styles.image}
        />
      ) : (
        <View style={styles.fallback}>
          <StyledText numberOfLines={1} style={{ fontSize: width * 0.45 }}>
            {game.name.charAt(0).toUpperCase()}
          </StyledText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: n(1),
    borderRadius: n(3),
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
