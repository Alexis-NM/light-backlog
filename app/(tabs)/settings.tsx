import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import ContentContainer from "@/components/ContentContainer";
import { SelectorButton } from "@/components/SelectorButton";
import { StyledButton } from "@/components/StyledButton";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLists } from "@/contexts/ListsContext";

export default function SettingsScreen() {
  const { t } = useLanguage();
  const { hasCredentials } = useCredentials();
  const { clearAll: clearLibrary } = useLibrary();
  const { clearAll: clearLists } = useLists();
  const params = useLocalSearchParams<{
    confirmed?: string;
    action?: string;
  }>();

  useEffect(() => {
    if (params.confirmed === "true" && params.action === "clearLibrary") {
      router.setParams({ confirmed: undefined, action: undefined });
      clearLibrary();
      clearLists();
    }
  }, [params.confirmed, params.action, clearLibrary, clearLists]);

  const confirmClear = () =>
    router.push({
      pathname: "/confirm",
      params: {
        title: t("settings_clear_library"),
        message: t("settings_clear_library_confirm"),
        confirmText: t("delete"),
        action: "clearLibrary",
        returnPath: "/(tabs)/settings",
      },
    });

  return (
    <ContentContainer headerTitle={t("settings_title")} hideBackButton>
      <SelectorButton
        href="/settings/credentials"
        label={t("settings_credentials")}
        value={
          hasCredentials ? t("settings_creds_set") : t("settings_creds_not_set")
        }
      />
      <StyledButton
        onPress={() => router.push("/settings/customise")}
        text={t("settings_customise")}
      />
      <StyledButton onPress={confirmClear} text={t("settings_clear_library")} />
    </ContentContainer>
  );
}
