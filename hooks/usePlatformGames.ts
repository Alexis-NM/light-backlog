import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Game } from "@/core/game";
import {
  gamesByPlatform,
  type IgdbAccess,
  PLATFORM_PAGE_SIZE,
} from "@/core/igdb";
import { igdbErrorText, useIgdbAccess } from "@/hooks/useIgdbAccess";

type Phase = "idle" | "loading" | "done" | "error";

/** The games of one console, loaded through one access to IGDB. */
interface Loaded {
  access: IgdbAccess;
  /** Set when the first page could not be loaded. */
  failure?: { error: unknown };
  games: Game[];
  hasMore: boolean;
  platformId: number;
}

const NO_GAMES: Game[] = [];

const isFullPage = (games: Game[]) => games.length === PLATFORM_PAGE_SIZE;

function phaseOf(active: boolean, current: Loaded | null): Phase {
  if (!active) {
    return "idle";
  }
  if (!current) {
    return "loading";
  }
  return current.failure ? "error" : "done";
}

export function usePlatformGames(platformId: number | null) {
  const access = useIgdbAccess();
  const { t } = useLanguage();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (!access || platformId === null) {
      return;
    }
    // Once the console or the access to IGDB changes, this answer is dropped.
    let ignore = false;
    gamesByPlatform(platformId, access)
      .then((games) => {
        if (!ignore) {
          setLoaded({ access, platformId, games, hasMore: isFullPage(games) });
        }
      })
      .catch((error: unknown) => {
        if (!ignore) {
          setLoaded({
            access,
            platformId,
            games: [],
            hasMore: false,
            failure: { error },
          });
        }
      });
    return () => {
      ignore = true;
    };
  }, [access, platformId]);

  // Games loaded for another console, or through another access, never show.
  const current =
    loaded && loaded.platformId === platformId && loaded.access === access
      ? loaded
      : null;

  const loadMore = () => {
    if (!current?.hasMore || loadingMoreRef.current) {
      return;
    }
    const offset = current.games.length;
    // Only extends the very games it was asked for.
    const matches = (prev: Loaded | null): prev is Loaded =>
      prev?.platformId === current.platformId &&
      prev.access === current.access &&
      prev.games.length === offset;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    gamesByPlatform(current.platformId, current.access, offset)
      .then((page) =>
        setLoaded((prev) =>
          matches(prev)
            ? {
                ...prev,
                games: [...prev.games, ...page],
                hasMore: isFullPage(page),
              }
            : prev
        )
      )
      .catch(() =>
        setLoaded((prev) =>
          matches(prev) ? { ...prev, hasMore: false } : prev
        )
      )
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  };

  return {
    games: current?.games ?? NO_GAMES,
    phase: phaseOf(access !== null && platformId !== null, current),
    loadingMore,
    errorText: current?.failure
      ? igdbErrorText(current.failure.error, access, t)
      : "",
    loadMore,
  };
}
