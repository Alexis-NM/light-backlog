import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { Game } from "@/types/game";
import { n } from "@/utils/scaling";
import { GameCard } from "./GameCard";

const COLUMNS = 3;
const GAP = n(12);

interface GameGridProps {
  games: Game[];
  getInLibrary?: (game: Game) => boolean;
  getSubtitle?: (game: Game) => string | undefined;
  onDoublePressGame?: (game: Game) => void;
  onPressGame?: (game: Game) => void;
}

export function GameGrid({
  games,
  getSubtitle,
  getInLibrary,
  onPressGame,
  onDoublePressGame,
}: GameGridProps) {
  const [width, setWidth] = useState(0);
  const itemWidth = width > 0 ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.grid}
    >
      {itemWidth > 0 &&
        games.map((game) => (
          <GameCard
            game={game}
            inLibrary={getInLibrary?.(game)}
            key={game.id}
            onDoublePress={onDoublePressGame}
            onPress={onPressGame}
            subtitle={getSubtitle?.(game)}
            width={itemWidth}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    width: "100%",
  },
});
