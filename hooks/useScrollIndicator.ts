import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, type LayoutChangeEvent } from "react-native";
import { n } from "@/utils/scaling";

const MIN_THUMB_HEIGHT = n(20);

export interface ScrollIndicator {
  height: number;
  position: Animated.Value | Animated.AnimatedInterpolation<number>;
}

/**
 * Drives the custom scroll indicator from a scroll view's native scroll events.
 * Wire `onScroll`, `onLayout` and `onContentSizeChange` to an `Animated.ScrollView`
 * or `Animated.FlatList`; the thumb position never touches the JS thread.
 */
export function useScrollIndicator() {
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY]
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) =>
      setViewportHeight(event.nativeEvent.layout.height),
    []
  );

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => setContentHeight(height),
    []
  );

  const indicator = useMemo<ScrollIndicator>(() => {
    const overflow = contentHeight - viewportHeight;
    if (viewportHeight <= 0 || overflow <= 0) {
      return { height: 0, position: scrollY };
    }
    const height = Math.max(
      (viewportHeight * viewportHeight) / contentHeight,
      MIN_THUMB_HEIGHT
    );
    return {
      height,
      position: scrollY.interpolate({
        inputRange: [0, overflow],
        outputRange: [0, viewportHeight - height],
        extrapolate: "clamp",
      }),
    };
  }, [contentHeight, viewportHeight, scrollY]);

  return { indicator, onContentSizeChange, onLayout, onScroll };
}
