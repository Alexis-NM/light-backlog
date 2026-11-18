import { useEffect, useRef, useState } from "react";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Game } from "@/core/game";
import {
  gamesByPlatform,
  type IgdbAuth,
  IgdbError,
  PLATFORM_PAGE_SIZE,
} from "@/core/igdb";

type Phase = "idle" | "loading" | "done" | "error";

/** The games of one console, loaded with one set of credentials. */
interface Loaded {
  auth: IgdbAuth;
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
  const { auth } = useCredentials();
  const { t } = useLanguage();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (!auth || platformId === null) {
      return;
    }
    // Once the console or the credentials change, this answer is dropped.
    let ignore = false;
    gamesByPlatform(platformId, auth)
      .then((games) => {
        if (!ignore) {
          setLoaded({ auth, platformId, games, hasMore: isFullPage(games) });
        }
      })
      .catch((error: unknown) => {
        if (!ignore) {
          setLoaded({
            auth,
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
  }, [auth, platformId]);

  // Games loaded for another console, or with other credentials, never show.
  const current =
    loaded && loaded.platformId === platformId && loaded.auth === auth
      ? loaded
      : null;

  const describeError = (error: unknown) => {
    if (error instanceof IgdbError && error.kind === "network") {
      return t("network_error");
    }
    if (error instanceof IgdbError && error.kind === "auth") {
      return t("creds_invalid");
    }
    if (error instanceof IgdbError) {
      return error.message;
    }
    return t("error");
  };

  const loadMore = () => {
    if (!current?.hasMore || loadingMoreRef.current) {
      return;
    }
    const offset = current.games.length;
    // Only extends the very games it was asked for.
    const matches = (prev: Loaded | null): prev is Loaded =>
      prev?.platformId === current.platformId &&
      prev.auth === current.auth &&
      prev.games.length === offset;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    gamesByPlatform(current.platformId, current.auth, offset)
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
    phase: phaseOf(Boolean(auth) && platformId !== null, current),
    loadingMore,
    errorText: current?.failure ? describeError(current.failure.error) : "",
    loadMore,
  };
}
