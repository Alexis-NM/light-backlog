import { router, useSegments } from "expo-router";
import type { ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Header, type RightAction } from "@/components/Header";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import type { ScrollIndicator } from "@/hooks/useScrollIndicator";
import { n } from "@/utils/scaling";

export type ContentWidth = "normal" | "wide";

export function horizontalPadding(contentWidth: ContentWidth) {
  return contentWidth === "wide"
    ? { paddingLeft: n(20), paddingRight: n(32) }
    : { paddingLeft: n(37), paddingRight: n(46) };
}

export interface ScreenFrameProps {
  children: ReactNode;
  contentWidth?: ContentWidth;
  headerTitle?: string;
  hideBackButton?: boolean;
  indicator: ScrollIndicator;
  rightAction?: RightAction;
  rightActions?: RightAction[];
  stickyTop?: ReactNode;
}

const goBack = () => {
  if (router.canGoBack()) {
    router.back();
  }
};

/** Screen chrome shared by every scrolling screen: header, sticky row, custom scroll indicator. */
export function ScreenFrame({
  children,
  contentWidth = "normal",
  headerTitle,
  hideBackButton = false,
  indicator,
  rightAction,
  rightActions,
  stickyTop,
}: ScreenFrameProps) {
  const segments = useSegments();
  const hasNavbar = segments?.[0] === "(tabs)";
  const { invertColors } = useInvertColors();
  const foreground = invertColors ? "black" : "white";
  const canSwipeBack = Boolean(headerTitle) && !hideBackButton;

  return (
    <SwipeBackContainer enabled={canSwipeBack} onSwipeBack={goBack}>
      <View
        style={[
          styles.container,
          { backgroundColor: invertColors ? "white" : "black" },
        ]}
      >
        {headerTitle && (
          <Header
            headerTitle={headerTitle}
            hideBackButton={hideBackButton}
            rightAction={rightAction}
            rightActions={rightActions}
          />
        )}
        {stickyTop ? (
          <View style={[styles.stickyTop, horizontalPadding(contentWidth)]}>
            {stickyTop}
          </View>
        ) : null}
        <View
          style={[
            styles.scrollWrapper,
            { paddingBottom: hasNavbar ? undefined : n(20) },
          ]}
        >
          {children}
          {indicator.height > 0 && (
            <View
              style={[
                styles.scrollIndicatorTrack,
                { backgroundColor: foreground },
              ]}
            >
              <Animated.View
                style={[
                  styles.scrollIndicatorThumb,
                  {
                    backgroundColor: foreground,
                    height: indicator.height,
                    transform: [{ translateY: indicator.position }],
                  },
                ]}
              />
            </View>
          )}
        </View>
      </View>
    </SwipeBackContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    gap: n(14),
  },
  scrollWrapper: {
    flex: 1,
    flexDirection: "row",
    width: "100%",
    position: "relative",
  },
  scrollIndicatorTrack: {
    width: n(1),
    height: "100%",
    position: "absolute",
    right: n(18),
  },
  scrollIndicatorThumb: {
    width: n(5),
    position: "absolute",
    right: n(-2),
  },
  stickyTop: {
    width: "100%",
  },
});
