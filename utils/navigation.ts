import { router } from "expo-router";
import type { Game } from "@/types/game";

export function openGame(game: Game, platform?: string) {
  router.push({
    pathname: "/game/[id]",
    params: {
      id: String(game.id),
      game: JSON.stringify(game),
      ...(platform ? { platform } : {}),
    },
  });
}

export function openList(id: string) {
  router.push({ pathname: "/list/[id]", params: { id } });
}

export function openImageViewer(images: string[], index: number) {
  router.push({
    pathname: "/image-viewer",
    params: { images: JSON.stringify(images), index: String(index) },
  });
}
