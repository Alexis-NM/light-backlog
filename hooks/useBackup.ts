import { useCallback } from "react";
import { useBrowse } from "@/contexts/BrowseContext";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useFullscreen } from "@/contexts/FullscreenContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLists } from "@/contexts/ListsContext";
import { useSort } from "@/contexts/SortContext";
import { BACKUP_APP, BACKUP_VERSION, type Backup } from "@/services/backup";

/** Applies a restored setting only when the backup actually carries it. */
const apply = <T>(value: T | undefined, set: (value: T) => Promise<void>) =>
  value === undefined ? undefined : set(value);

/** Gathers every persisted store into a backup, and applies one back. */
export function useBackup() {
  const { auth, setCredentials } = useCredentials();
  const { entries, replaceAll: replaceLibrary } = useLibrary();
  const { lists, replaceAll: replaceLists } = useLists();
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

  const buildBackup = useCallback(
    (includeCredentials: boolean): Backup => ({
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      lists,
      library: entries,
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
      entries,
      gamesFullscreen,
      invertColors,
      language,
      libraryFullscreen,
      librarySort,
      listFullscreen,
      listSort,
      lists,
      selectedConsole,
    ]
  );

  const restoreBackup = useCallback(
    async ({ credentials, library, lists, settings }: Backup) => {
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
