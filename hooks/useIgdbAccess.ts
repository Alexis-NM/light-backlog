import { useCredentials } from "@/contexts/CredentialsContext";
import { useSync } from "@/contexts/SyncContext";
import { type IgdbAccess, isIgdbRelay } from "@/core/igdb";
import type { TranslationKey } from "@/core/translations";

/**
 * How the app reaches IGDB: with the keys entered in Settings first, else
 * through the sync server and its keys, else not at all.
 */
export function useIgdbAccess(): IgdbAccess | null {
  const { auth } = useCredentials();
  const { igdbRelay } = useSync();
  return auth ?? igdbRelay;
}

/** What to say when IGDB refuses: the keys, or the sync server's token. */
export const refusedMessage = (access: IgdbAccess | null): TranslationKey =>
  access && isIgdbRelay(access) ? "igdb_relay_refused" : "creds_invalid";
