import { useFocusEffect } from "expo-router";
import { notifyScreenView } from "@/services/syncStore";

/**
 * Syncs when the screen comes into view, as the site reads its page again on
 * each navigation: in the background, at most every 30 seconds, and only with
 * a sync server (see SyncContext).
 */
export function useSyncOnFocus() {
  useFocusEffect(notifyScreenView);
}
