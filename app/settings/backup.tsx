import { useState } from "react";
import { StyleSheet, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { StyledButton } from "@/components/StyledButton";
import { StyledText } from "@/components/StyledText";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackup } from "@/hooks/useBackup";
import {
  type Backup,
  BackupError,
  readBackupFile,
  writeBackupFile,
} from "@/services/backup";
import { n } from "@/utils/scaling";

export default function BackupScreen() {
  const { t } = useLanguage();
  const confirm = useConfirm();
  const { hasCredentials } = useCredentials();
  const { buildBackup, restoreBackup } = useBackup();
  const [includeCredentials, setIncludeCredentials] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const describeError = (error: unknown, fallback: string) => {
    if (error instanceof BackupError) {
      if (error.kind === "cancelled") {
        return "";
      }
      if (error.kind === "invalid") {
        return t("backup_invalid");
      }
    }
    return fallback;
  };

  const exportBackup = async () => {
    setBusy(true);
    setMessage("");
    try {
      const name = await writeBackupFile(buildBackup(includeCredentials));
      setMessage(t("backup_export_done", { name }));
    } catch (error) {
      setMessage(describeError(error, t("backup_export_error")));
    } finally {
      setBusy(false);
    }
  };

  const applyBackup = async (backup: Backup) => {
    setBusy(true);
    try {
      await restoreBackup(backup);
      setMessage(t("backup_restore_done"));
    } catch {
      setMessage(t("backup_restore_error"));
    } finally {
      setBusy(false);
    }
  };

  const importBackup = async () => {
    setBusy(true);
    setMessage("");
    try {
      const backup = await readBackupFile();
      const games = Object.keys(backup.library).length;
      confirm({
        title: t("backup_import"),
        message: t("backup_restore_confirm", {
          games,
          lists: backup.lists.length,
        }),
        confirmText: t("backup_restore"),
        onConfirm: () => {
          applyBackup(backup);
        },
      });
    } catch (error) {
      setMessage(describeError(error, t("backup_read_error")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ContentContainer headerTitle={t("backup_title")}>
      <View style={styles.body}>
        <StyledText style={styles.intro}>{t("backup_intro")}</StyledText>

        {hasCredentials ? (
          <ToggleSwitch
            label={t("backup_include_credentials")}
            onValueChange={setIncludeCredentials}
            value={includeCredentials}
          />
        ) : null}

        <StyledButton
          onPress={busy ? undefined : exportBackup}
          text={t("backup_export")}
        />
        <StyledButton
          onPress={busy ? undefined : importBackup}
          text={t("backup_import")}
        />

        {message.length > 0 ? (
          <StyledText style={styles.muted}>{message}</StyledText>
        ) : null}
      </View>
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    width: "100%",
    gap: n(26),
  },
  intro: {
    fontSize: n(15),
    opacity: 0.6,
  },
  muted: {
    fontSize: n(15),
    opacity: 0.7,
  },
});
