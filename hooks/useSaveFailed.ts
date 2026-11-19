import { useSyncExternalStore } from "react";
import { hasSaveFailed, watchSaveFailures } from "@/services/saveFailures";

/** Whether a change could not be saved since the app was opened. */
export const useSaveFailed = () =>
  useSyncExternalStore(watchSaveFailures, hasSaveFailed);
