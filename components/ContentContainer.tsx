import type { ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import {
  horizontalPadding,
  ScreenFrame,
  type ScreenFrameProps,
} from "@/components/ScreenFrame";
import { useScrollIndicator } from "@/hooks/useScrollIndicator";
import { n } from "@/utils/scaling";

interface ContentContainerProps
  extends Omit<ScreenFrameProps, "children" | "indicator"> {
  children?: ReactNode;
  contentGap?: number;
}

export default function ContentContainer({
  children,
  contentGap = 47,
  contentWidth = "normal",
  ...frame
}: ContentContainerProps) {
  const { indicator, onContentSizeChange, onLayout, onScroll } =
    useScrollIndicator();

  return (
    <ScreenFrame {...frame} contentWidth={contentWidth} indicator={indicator}>
      <Animated.ScrollView
        onContentSizeChange={onContentSizeChange}
        onLayout={onLayout}
        onScroll={onScroll}
        overScrollMode="never"
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.content,
            horizontalPadding(contentWidth),
            { gap: n(contentGap) },
          ]}
        >
          {children ?? null}
        </View>
      </Animated.ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
});
