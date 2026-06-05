import { useCallback, useEffect, useRef, useState } from "react";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  gamesByPlatform,
  IgdbError,
  PLATFORM_PAGE_SIZE,
} from "@/services/igdb";
import type { Game } from "@/types/game";

type Phase = "idle" | "loading" | "done" | "error";

export function usePlatformGames(platformId: number | null) {
  const { auth } = useCredentials();
  const { t } = useLanguage();

  const [games, setGames] = useState<Game[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState("");

  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const offsetRef = useRef(0);

  const describeError = useCallback(
    (error: unknown) => {
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
    },
    [t]
  );

  const loadPage = useCallback(
    async (reset: boolean) => {
      if (!auth || platformId === null || loadingRef.current) {
        return;
      }
      if (!(reset || hasMoreRef.current)) {
        return;
      }
      loadingRef.current = true;
      if (reset) {
        offsetRef.current = 0;
        hasMoreRef.current = true;
        setGames([]);
        setPhase("loading");
      } else {
        setLoadingMore(true);
      }

      try {
        const found = await gamesByPlatform(
          platformId,
          auth,
          offsetRef.current
        );
        hasMoreRef.current = found.length === PLATFORM_PAGE_SIZE;
        offsetRef.current += found.length;
        setGames((prev) => (reset ? found : [...prev, ...found]));
        setPhase("done");
      } catch (error) {
        if (reset) {
          setErrorText(describeError(error));
          setPhase("error");
        }
        hasMoreRef.current = false;
      } finally {
        loadingRef.current = false;
        setLoadingMore(false);
      }
    },
    [auth, platformId, describeError]
  );

  useEffect(() => {
    if (platformId !== null) {
      loadPage(true);
    }
  }, [platformId, loadPage]);

  return {
    games,
    phase,
    loadingMore,
    errorText,
    loadMore: () => loadPage(false),
  };
}
