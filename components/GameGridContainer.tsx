import { GameGrid, type GameGridProps } from "@/components/GameGrid";
import { ScreenFrame, type ScreenFrameProps } from "@/components/ScreenFrame";
import { useScrollIndicator } from "@/hooks/useScrollIndicator";

type FrameProps = Omit<ScreenFrameProps, "children" | "indicator">;
type GridProps = Omit<
  GameGridProps,
  "contentWidth" | "onContentSizeChange" | "onLayout" | "onScroll"
>;

/** A screen whose scrolling content is a game grid; use instead of ContentContainer. */
export function GameGridContainer({
  contentWidth = "wide",
  headerTitle,
  hideBackButton,
  rightAction,
  rightActions,
  stickyTop,
  ...grid
}: FrameProps & GridProps) {
  const { indicator, onContentSizeChange, onLayout, onScroll } =
    useScrollIndicator();

  return (
    <ScreenFrame
      contentWidth={contentWidth}
      headerTitle={headerTitle}
      hideBackButton={hideBackButton}
      indicator={indicator}
      rightAction={rightAction}
      rightActions={rightActions}
      stickyTop={stickyTop}
    >
      <GameGrid
        {...grid}
        contentWidth={contentWidth}
        onContentSizeChange={onContentSizeChange}
        onLayout={onLayout}
        onScroll={onScroll}
      />
    </ScreenFrame>
  );
}
