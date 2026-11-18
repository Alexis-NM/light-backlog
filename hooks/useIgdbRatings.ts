import { useEffect, useEffectEvent, useRef } from "react";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLists } from "@/contexts/ListsContext";
import { type Game, hasRatings, type StoredRatings } from "@/core/game";
import { fetchRatings } from "@/core/igdb";

/**
 * Fills in the IGDB rating of games saved before ratings were stored (or
 * restored from an older backup), so the "IGDB rating" sort covers them.
 * Each id is requested once per launch; a failed batch is retried on the
 * next library or list change.
 */
export function useIgdbRatingsBackfill() {
  const { auth } = useCredentials();
  const library = useLibrary();
  const lists = useLists();

  const requested = useRef(new Set<number>());
  // Results arrive later; an Effect Event applies them through the setters of
  // the latest render, so a game added meanwhile is not overwritten.
  const applyRatings = useEffectEvent(
    (ratings: Record<number, StoredRatings>) => {
      library.setIgdbRatings(ratings);
      lists.setIgdbRatings(ratings);
    }
  );

  const { entries } = library;
  const { lists: allLists } = lists;

  useEffect(() => {
    if (!auth) {
      return;
    }
    const missing: number[] = [];
    const consider = (game: Game) => {
      if (!(hasRatings(game) || requested.current.has(game.id))) {
        requested.current.add(game.id);
        missing.push(game.id);
      }
    };
    for (const entry of Object.values(entries)) {
      consider(entry.game);
    }
    for (const list of allLists) {
      for (const item of Object.values(list.items)) {
        consider(item.game);
      }
    }
    if (missing.length === 0) {
      return;
    }
    fetchRatings(missing, auth)
      .then((ratings) => applyRatings(ratings))
      .catch(() => {
        for (const id of missing) {
          requested.current.delete(id);
        }
      });
  }, [auth, entries, allLists]);
}
