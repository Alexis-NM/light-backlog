import { router } from "expo-router";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { StyledButton } from "@/components/StyledButton";
import { StyledText } from "@/components/StyledText";
import { TextInput } from "@/components/TextInput";
import { useCredentials } from "@/contexts/CredentialsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { n } from "@/utils/scaling";

const TWITCH_CONSOLE_URL = "https://dev.twitch.tv/console/apps/create";

export default function CredentialsScreen() {
  const { t } = useLanguage();
  const { auth, hasCredentials, setCredentials, clearCredentials } =
    useCredentials();
  const [clientId, setClientId] = useState(auth?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState(auth?.clientSecret ?? "");
  const [message, setMessage] = useState("");

  const save = async () => {
    if (clientId.trim().length === 0 || clientSecret.trim().length === 0) {
      setMessage(t("creds_missing"));
      return;
    }
    await setCredentials(clientId.trim(), clientSecret.trim());
    router.back();
  };

  const clear = async () => {
    await clearCredentials();
    setClientId("");
    setClientSecret("");
    setMessage("");
  };

  return (
    <ContentContainer headerTitle={t("creds_title")}>
      <View style={styles.body}>
        <StyledText style={styles.intro}>{t("creds_intro")}</StyledText>

        <View style={styles.field}>
          <StyledText style={styles.label}>{t("creds_client_id")}</StyledText>
          <TextInput
            onChangeText={setClientId}
            placeholder={t("creds_client_id_ph")}
            value={clientId}
          />
        </View>

        <View style={styles.field}>
          <StyledText style={styles.label}>
            {t("creds_client_secret")}
          </StyledText>
          <TextInput
            onChangeText={setClientSecret}
            placeholder={t("creds_client_secret_ph")}
            value={clientSecret}
          />
        </View>

        {message.length > 0 ? (
          <StyledText style={styles.message}>{message}</StyledText>
        ) : null}

        <View style={styles.actions}>
          <StyledButton onPress={save} text={t("creds_save")} />
          <StyledButton
            onPress={() => Linking.openURL(TWITCH_CONSOLE_URL)}
            text={t("creds_help")}
          />
          {hasCredentials ? (
            <StyledButton onPress={clear} text={t("creds_clear")} />
          ) : null}
        </View>
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
    lineHeight: n(21),
    opacity: 0.7,
  },
  field: {
    gap: n(8),
  },
  label: {
    fontSize: n(13),
    opacity: 0.45,
    textTransform: "uppercase",
    letterSpacing: n(1),
  },
  message: {
    fontSize: n(14),
    opacity: 0.8,
  },
  actions: {
    gap: n(24),
    marginTop: n(10),
  },
});
