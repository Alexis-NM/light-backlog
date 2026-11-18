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
  let text: string;
  try {
    text = await new File(asset.uri).text();
  } catch {
    throw new BackupError("read", "Could not read the file.");
  }
  return parseBackup(text);
}
