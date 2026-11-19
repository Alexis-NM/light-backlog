import { getDocumentAsync } from "expo-document-picker";
import { Directory, File } from "expo-file-system";
import {
  type Backup,
  BackupError,
  backupFileName,
  isRecord,
  parseBackup,
  serializeBackup,
} from "@/core/backup";

const MIME_TYPE = "application/json";

const isPickerCancelled = (error: unknown) =>
  isRecord(error) && error.code === "ERR_PICKER_CANCELLED";

/** Lets the user pick a folder, then writes the backup there. Resolves to the file name. */
export async function writeBackupFile(backup: Backup): Promise<string> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (isPickerCancelled(error)) {
      throw new BackupError("cancelled", "Folder picker cancelled.");
    }
    throw new BackupError("write", "Could not open the folder.");
  }
  const name = backupFileName();
  try {
    const file = directory.createFile(name, MIME_TYPE);
    file.write(serializeBackup(backup));
  } catch {
    throw new BackupError("write", "Could not write the backup file.");
  }
  return name;
}

/** Lets the user pick a backup file and returns its parsed content. */
export async function readBackupFile(): Promise<Backup> {
  // Not every file provider labels .json files as application/json, and the
  // parser rejects anything else anyway, so the picker is left unfiltered.
  const result = await getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) {
    throw new BackupError("cancelled", "File picker cancelled.");
  }
  // The picker gave a copy, in the app's cache. It may hold IGDB keys: it
  // goes once read, whatever the outcome.
  const copy = new File(asset.uri);
  let text: string;
  try {
    text = await copy.text();
  } catch {
    throw new BackupError("read", "Could not read the file.");
  } finally {
    try {
      copy.delete();
    } catch {
      // Left to the system, which clears the cache when it needs room.
    }
  }
  return parseBackup(text);
}
