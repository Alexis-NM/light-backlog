import { type ReactElement, useCallback, useState } from "react";
import {
  Animated,
  type FlatListProps,
  type LayoutChangeEvent,
  type ListRenderItem,
  StyleSheet,
  View,
} from "react-native";
import type { Game } from "@/types/game";
import { n } from "@/utils/scaling";
import { cardHeight, GameCard } from "./GameCard";
import { type ContentWidth, horizontalPadding } from "./ScreenFrame";

const COLUMNS = 3;
const GAP = n(12);

// Roughly five rows fit on screen: keep two screens mounted on each side and
// grow the list a few rows at a time so images arrive as the user scrolls.
const INITIAL_ROWS = 8;
const ROWS_PER_BATCH = 4;
const WINDOW_SIZE = 5;

const keyExtractor = (game: Game) => String(game.id);

export const yearOf = (game: Game) => game.year?.toString();

type ScrollWiring = Pick<
  FlatListProps<Game>,
  "onContentSizeChange" | "onEndReached" | "onLayout" | "onScroll"
>;

export interface GameGridProps extends ScrollWiring {
  contentWidth: ContentWidth;
  empty?: ReactElement;
  footer?: ReactElement;
  games: Game[];
  getInLibrary?: (game: Game) => boolean;
  getSubtitle?: (game: Game) => string | undefined;
  header?: ReactElement;
  onDoublePressGame?: (game: Game) => void;
  onLongPressGame?: (game: Game) => void;
  onPressGame?: (game: Game) => void;
  selectedIds?: Set<number>;
  selectionMode?: boolean;
}

/** Virtualised three-column grid; only the rows near the viewport are mounted. */
export function GameGrid({
  contentWidth,
  empty,
  footer,
  games,
  getInLibrary,
  getSubtitle,
  header,
  onContentSizeChange,
  onDoublePressGame,
  onEndReached,
  onLayout,
  onLongPressGame,
  onPressGame,
  onScroll,
  selectedIds,
  selectionMode,
}: GameGridProps) {
  const padding = horizontalPadding(contentWidth);
  const [width, setWidth] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const innerWidth = width - padding.paddingLeft - padding.paddingRight;
  const itemWidth =
    innerWidth > 0 ? (innerWidth - GAP * (COLUMNS - 1)) / COLUMNS : 0;
  const rowHeight = cardHeight(itemWidth) + GAP;

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setWidth(event.nativeEvent.layout.width);
      onLayout?.(event);
    },
    [onLayout]
  );

  // Row offsets are measured from the top of the content, so they must
  // include whatever the header occupies above the first row.
  const headerOffset = header ? headerHeight : 0;
  const getItemLayout = useCallback(
    (_data: ArrayLike<Game> | null | undefined, index: number) => ({
      length: rowHeight,
      offset: headerOffset + rowHeight * index,
      index,
    }),
    [headerOffset, rowHeight]
  );

  const renderItem = useCallback<ListRenderItem<Game>>(
    ({ item }) => {
      const selected = selectedIds?.has(item.id) ?? false;
      return (
        <GameCard
          dimmed={Boolean(selectionMode) && !selected}
          game={item}
          inLibrary={getInLibrary?.(item)}
          onDoublePress={onDoublePressGame}
          onLongPress={onLongPressGame}
          onPress={onPressGame}
          selected={selected}
          subtitle={getSubtitle?.(item)}
          width={itemWidth}
        />
      );
    },
    [
      getInLibrary,
      getSubtitle,
      itemWidth,
      onDoublePressGame,
      onLongPressGame,
      onPressGame,
      selectedIds,
      selectionMode,
    ]
  );

  return (
    <View onLayout={handleLayout} style={styles.fill}>
      {itemWidth > 0 ? (
        <Animated.FlatList
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.content, padding]}
          data={games}
          getItemLayout={getItemLayout}
          initialNumToRender={INITIAL_ROWS}
          keyExtractor={keyExtractor}
          ListEmptyComponent={empty}
          ListFooterComponent={footer}
          ListHeaderComponent={
            header ? (
              <View
                onLayout={(event) =>
                  setHeaderHeight(event.nativeEvent.layout.height)
                }
              >
                {header}
              </View>
            ) : undefined
          }
          maxToRenderPerBatch={ROWS_PER_BATCH}
          numColumns={COLUMNS}
          onContentSizeChange={onContentSizeChange}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          onScroll={onScroll}
          overScrollMode="never"
          renderItem={renderItem}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          windowSize={WINDOW_SIZE}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingBottom: n(12),
  },
  row: {
    gap: GAP,
    paddingBottom: GAP,
  },
});
