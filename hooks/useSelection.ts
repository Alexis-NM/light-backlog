import { useCallback, useState } from "react";
import type { Game } from "@/core/game";

/**
 * The games picked in a grid: a long press starts the selection, and a tap
 * then adds a game to it or takes it out.
 */
export function useSelection() {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggle = useCallback(
    (game: Game) =>
      setSelectedIds((previous) => {
        const next = new Set(previous);
        if (!next.delete(game.id)) {
          next.add(game.id);
        }
        return next;
      }),
    []
  );

  const start = useCallback(
    (game: Game) => {
      setSelecting(true);
      toggle(game);
    },
    [toggle]
  );

  const stop = useCallback(() => {
    setSelecting(false);
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(
    (games: Game[]) => setSelectedIds(new Set(games.map((game) => game.id))),
    []
  );

  return { selectAll, selectedIds, selecting, start, stop, toggle };
}
