import { type Href, router } from "expo-router";
import ContentContainer from "@/components/ContentContainer";
import { SelectorButton } from "@/components/SelectorButton";
import { StyledButton } from "@/components/StyledButton";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLists } from "@/contexts/ListsContext";
import { useSync } from "@/contexts/SyncContext";

export default function SettingsScreen() {
  const { t } = useLanguage();
  const confirm = useConfirm();
  const { hasCredentials } = useCredentials();
  const { clearAll: clearLibrary } = useLibrary();
  const { clearAll: clearLists } = useLists();
  const { serverAddress, status } = useSync();

  const confirmClear = () =>
    confirm({
      title: t("settings_clear_library"),
      message: serverAddress
        ? t("settings_clear_library_confirm_synced")
        : t("settings_clear_library_confirm"),
      confirmText: t("delete"),
      onConfirm: () => {
        clearLibrary();
        clearLists();
      },
    });

  const syncValue = () => {
    if (status.phase === "off") {
      return t("settings_sync_off");
    }
    if (status.phase !== "error") {
      return t("settings_sync_on");
    }
    return status.problem === "network"
      ? t("settings_sync_offline")
      : t("settings_sync_error");
  };

  return (
    <ContentContainer headerTitle={t("settings_title")} hideBackButton>
      <SelectorButton
        href="/settings/credentials"
        label={t("settings_credentials")}
        value={
          hasCredentials ? t("settings_creds_set") : t("settings_creds_not_set")
        }
      />
      <SelectorButton
        href={"/settings/sync" as Href}
        label={t("settings_sync")}
        value={syncValue()}
      />
      <StyledButton
        onPress={() => router.push("/settings/customise")}
        text={t("settings_customise")}
      />
      <StyledButton
        onPress={() => router.push("/settings/backup" as Href)}
        text={t("settings_backup")}
      />
      <StyledButton onPress={confirmClear} text={t("settings_clear_library")} />
    </ContentContainer>
  );
}
