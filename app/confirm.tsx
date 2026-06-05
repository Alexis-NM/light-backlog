import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { HapticPressable } from "@/components/HapticPressable";
import { Header } from "@/components/Header";
import { StyledText } from "@/components/StyledText";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { useConfirmRequest } from "@/contexts/ConfirmContext";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { n } from "@/utils/scaling";

export default function ConfirmScreen() {
  const { invertColors } = useInvertColors();
  const consume = useConfirmRequest();
  const [request] = useState(consume);

  const handleConfirm = () => {
    router.back();
    request?.onConfirm();
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  const textColor = invertColors ? "black" : "white";

  return (
    <SwipeBackContainer enabled onSwipeBack={handleBack}>
      <View
        style={[
          styles.container,
          { backgroundColor: invertColors ? "white" : "black" },
        ]}
      >
        <Header headerTitle={request?.title || "Confirm"} />
        <View style={styles.content}>
          <StyledText style={styles.messageText}>{request?.message}</StyledText>
          <View style={styles.spacer} />
          <HapticPressable onPress={handleConfirm} style={styles.button}>
            <StyledText style={[styles.buttonText, { color: textColor }]}>
              {request?.confirmText || "Confirm"}
            </StyledText>
          </HapticPressable>
        </View>
      </View>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: n(37),
    paddingTop: n(20),
    paddingBottom: n(20),
  },
  messageText: {
    fontSize: n(18),
  },
  spacer: {
    flex: 1,
  },
  button: {
    alignItems: "center",
    minWidth: n(200),
  },
  buttonText: {
    fontSize: n(40),
    textTransform: "uppercase",
  },
});
