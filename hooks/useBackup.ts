import { useCallback } from "react";
import { useBrowse } from "@/contexts/BrowseContext";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useFullscreen } from "@/contexts/FullscreenContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLists } from "@/contexts/ListsContext";
import { useSort } from "@/contexts/SortContext";
import {
  BACKUP_APP,
  BACKUP_VERSION,
  type Backup,
  redated,
} from "@/core/backup";

/** Applies a restored setting only when the backup actually carries it. */
const apply = <T>(value: T | undefined, set: (value: T) => Promise<void>) =>
  value === undefined ? undefined : set(value);

/** Gathers every persisted store into a backup, and applies one back. */
export function useBackup() {
  const { auth, setCredentials } = useCredentials();
  const { getEntries, replaceAll: replaceLibrary } = useLibrary();
  const { getLists, replaceAll: replaceLists } = useLists();
  const { invertColors, setInvertColors } = useInvertColors();
  const { language, setLanguage } = useLanguage();
  const { librarySort, listSort, setLibrarySort, setListSort } = useSort();
  const {
    gamesFullscreen,
    libraryFullscreen,
    listFullscreen,
    setGamesFullscreen,
    setLibraryFullscreen,
    setListFullscreen,
  } = useFullscreen();
  const { selectedConsole, setSelectedConsole } = useBrowse();

  // The library and the lists as they are when the backup is asked for: this
  // function does not change with them.
  const buildBackup = useCallback(
    (includeCredentials: boolean): Backup => ({
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      lists: getLists(),
      library: getEntries(),
      settings: {
        gamesFullscreen,
        invertColors,
        language,
        libraryFullscreen,
        librarySort,
        listFullscreen,
        listSort,
        selectedConsole,
      },
      credentials: includeCredentials && auth ? auth : undefined,
    }),
    [
      auth,
      gamesFullscreen,
      getEntries,
      getLists,
      invertColors,
      language,
      libraryFullscreen,
      librarySort,
      listFullscreen,
      listSort,
      selectedConsole,
    ]
  );

  const restoreBackup = useCallback(
    async ({ credentials, settings, ...data }: Backup) => {
      const { library, lists } = redated(data, Date.now());
      await Promise.all([
        replaceLists(lists),
        replaceLibrary(library),
        apply(settings.invertColors, setInvertColors),
        apply(settings.language, setLanguage),
        apply(settings.librarySort, setLibrarySort),
        apply(settings.listSort, setListSort),
        apply(settings.gamesFullscreen, setGamesFullscreen),
        apply(settings.libraryFullscreen, setLibraryFullscreen),
        apply(settings.listFullscreen, setListFullscreen),
        apply(settings.selectedConsole, setSelectedConsole),
        credentials
          ? setCredentials(credentials.clientId, credentials.clientSecret)
          : undefined,
      ]);
    },
    [
      replaceLibrary,
      replaceLists,
      setCredentials,
      setGamesFullscreen,
      setInvertColors,
      setLanguage,
      setLibraryFullscreen,
      setLibrarySort,
      setListFullscreen,
      setListSort,
      setSelectedConsole,
    ]
  );

  return { buildBackup, restoreBackup };
}
