import { useEffect, useRef } from "react";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLists } from "@/contexts/ListsContext";
import { fetchRatings } from "@/services/igdb";
import { type Game, hasRatings } from "@/types/game";

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
  // Results arrive later; apply them through the setters of the latest render
  // so a game added meanwhile is not overwritten by a stale snapshot.
  const latest = useRef({ library, lists });
  useEffect(() => {
    latest.current = { library, lists };
  });

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
      for (const game of Object.values(list.games)) {
        consider(game);
      }
    }
    if (missing.length === 0) {
      return;
    }
    fetchRatings(missing, auth)
      .then((ratings) => {
        latest.current.library.setIgdbRatings(ratings);
        latest.current.lists.setIgdbRatings(ratings);
      })
      .catch(() => {
        for (const id of missing) {
          requested.current.delete(id);
        }
      });
  }, [auth, entries, allLists]);
}
