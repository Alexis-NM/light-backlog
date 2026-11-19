import { useState } from "react";
import { StyleSheet, View } from "react-native";
import ContentContainer from "@/components/ContentContainer";
import { StyledButton } from "@/components/StyledButton";
import { StyledText } from "@/components/StyledText";
import { TextInput } from "@/components/TextInput";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  type SyncProblem,
  type SyncStatus,
  useSync,
} from "@/contexts/SyncContext";
import type { TranslationKey } from "@/core/translations";
import { n } from "@/utils/scaling";

const pad = (value: number) => String(value).padStart(2, "0");

/** 18/11 14:32 */
function formatTime(time: number) {
  const date = new Date(time);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const problemKey = (problem: SyncProblem) =>
  `sync_err_${problem}` as TranslationKey;

export default function SyncScreen() {
  const { t } = useLanguage();
  const confirm = useConfirm();
  const {
    check,
    connect,
    disconnect,
    hasCopy,
    restoreCopy,
    serverAddress,
    status,
    syncNow,
  } = useSync();
  const [address, setAddress] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const filled = address.trim().length > 0 && token.trim().length > 0;

  /** Resolves to true when the server answered as expected. */
  const tryServer = async (
    action: typeof check,
    pending: TranslationKey,
    done: string
  ) => {
    if (!filled) {
      setMessage(t("sync_missing"));
      return false;
    }
    setBusy(true);
    setMessage(t(pending));
    try {
      const problem = await action(address, token);
      setMessage(problem ? t(problemKey(problem)) : done);
      return problem === undefined;
    } catch {
      setMessage(t("error"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const runCheck = () => tryServer(check, "sync_checking", t("sync_check_ok"));

  const runConnect = async () => {
    if (await tryServer(connect, "sync_connecting", "")) {
      setAddress("");
      setToken("");
    }
  };

  const confirmDisconnect = () =>
    confirm({
      title: t("sync_disconnect"),
      message: t("sync_disconnect_confirm"),
      confirmText: t("sync_disconnect"),
      onConfirm: () => {
        setMessage("");
        disconnect().catch(() => setMessage(t("error")));
      },
    });

  const confirmRestoreCopy = () =>
    confirm({
      title: t("sync_copy_restore"),
      message: t("sync_copy_restore_confirm"),
      confirmText: t("backup_restore"),
      onConfirm: () => {
        restoreCopy()
          .then(() => setMessage(t("sync_copy_restored")))
          .catch(() => setMessage(t("backup_restore_error")));
      },
    });

  const describe = ({ lastSyncedAt, phase, problem }: SyncStatus) => {
    if (phase === "syncing") {
      return t("sync_syncing");
    }
    if (phase === "error" && problem) {
      return t(problemKey(problem));
    }
    return lastSyncedAt
      ? t("sync_last", { date: formatTime(lastSyncedAt) })
      : t("sync_never");
  };

  return (
    <ContentContainer headerTitle={t("sync_title")}>
      <View style={styles.body}>
        {serverAddress ? (
          <View style={styles.body}>
            <StyledText style={styles.intro}>
              {t("sync_connected_to", { address: serverAddress })}
            </StyledText>
            <StyledText style={styles.status}>{describe(status)}</StyledText>
            {status.skipped > 0 ? (
              <StyledText style={styles.message}>
                {t("sync_skipped", { count: status.skipped })}
              </StyledText>
            ) : null}
            <View style={styles.actions}>
              <StyledButton
                onPress={status.phase === "syncing" ? undefined : syncNow}
                text={t("sync_now")}
              />
              <StyledButton
                onPress={confirmDisconnect}
                text={t("sync_disconnect")}
              />
            </View>
          </View>
        ) : (
          <View style={styles.body}>
            <StyledText style={styles.intro}>{t("sync_intro")}</StyledText>

            <View style={styles.field}>
              <StyledText style={styles.label}>{t("sync_address")}</StyledText>
              <TextInput
                onChangeText={setAddress}
                placeholder={t("sync_address_ph")}
                value={address}
              />
            </View>

            <View style={styles.field}>
              <StyledText style={styles.label}>{t("sync_token")}</StyledText>
              <TextInput
                onChangeText={setToken}
                placeholder={t("sync_token_ph")}
                value={token}
              />
            </View>

            <View style={styles.actions}>
              <StyledButton
                onPress={busy ? undefined : runCheck}
                text={t("sync_check")}
              />
              <StyledButton
                onPress={busy ? undefined : runConnect}
                text={t("sync_connect")}
              />
            </View>
          </View>
        )}

        {message.length > 0 ? (
          <StyledText style={styles.message}>{message}</StyledText>
        ) : null}

        {hasCopy ? (
          <StyledButton
            onPress={confirmRestoreCopy}
            text={t("sync_copy_restore")}
          />
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
    lineHeight: n(21),
    opacity: 0.7,
  },
  status: {
    fontSize: n(20),
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
