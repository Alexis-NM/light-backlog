import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  lockAsync,
  OrientationLock,
  unlockAsync,
} from "expo-screen-orientation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { n } from "@/utils/scaling";

function clamp(value: number, max: number) {
  if (value < 0) {
    return 0;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export default function ImageViewerScreen() {
  const params = useLocalSearchParams<{ images?: string; index?: string }>();
  const { width, height } = useWindowDimensions();

  const images = useMemo<string[]>(() => {
    if (!params.images) {
      return [];
    }
    try {
      return JSON.parse(params.images) as string[];
    } catch {
      return [];
    }
  }, [params.images]);

  const initialIndex = clamp(Number(params.index) || 0, images.length - 1);
  const [index, setIndex] = useState(initialIndex);
  const [controls, setControls] = useState(true);
  const listRef = useRef<FlatList<string>>(null);
  const indexRef = useRef(initialIndex);
  indexRef.current = index;

  useEffect(() => {
    unlockAsync().catch(() => {
      // Orientation control is best-effort.
    });
    return () => {
      lockAsync(OrientationLock.PORTRAIT_UP).catch(() => {
        // Ignore on teardown.
      });
    };
  }, []);

  // Keep the current image aligned after a rotation changes the page width.
  useEffect(() => {
    listRef.current?.scrollToOffset({
      offset: indexRef.current * width,
      animated: false,
    });
  }, [width]);

  if (images.length === 0) {
    return <View style={styles.container} />;
  }

  const goTo = (target: number) => {
    const next = clamp(target, images.length - 1);
    listRef.current?.scrollToOffset({ offset: next * width, animated: true });
    setIndex(next);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={images}
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
        horizontal
        initialScrollIndex={initialIndex}
        keyExtractor={(item) => item}
        onMomentumScrollEnd={(event) =>
          setIndex(
            clamp(
              Math.round(event.nativeEvent.contentOffset.x / width),
              images.length - 1
            )
          )
        }
        pagingEnabled
        ref={listRef}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setControls((value) => !value)}
            style={{ width, height }}
          >
            <Image
              resizeMode="contain"
              source={{ uri: item }}
              style={{ width, height }}
            />
          </Pressable>
        )}
        showsHorizontalScrollIndicator={false}
      />

      {controls ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.iconButton, styles.close]}
          >
            <MaterialIcons color="white" name="close" size={n(28)} />
          </Pressable>

          <View pointerEvents="box-none" style={styles.chevrons}>
            {index > 0 ? (
              <Pressable
                onPress={() => goTo(index - 1)}
                style={styles.iconButton}
              >
                <MaterialIcons color="white" name="chevron-left" size={n(34)} />
              </Pressable>
            ) : (
              <View style={styles.iconButton} />
            )}
            {index < images.length - 1 ? (
              <Pressable
                onPress={() => goTo(index + 1)}
                style={styles.iconButton}
              >
                <MaterialIcons
                  color="white"
                  name="chevron-right"
                  size={n(34)}
                />
              </Pressable>
            ) : (
              <View style={styles.iconButton} />
            )}
          </View>

          <View pointerEvents="none" style={styles.dots}>
            {images.map((image, i) => (
              <View
                key={image}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  iconButton: {
    width: n(44),
    height: n(44),
    borderRadius: n(22),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  close: {
    position: "absolute",
    top: n(36),
    right: n(16),
  },
  chevrons: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: n(10),
    right: n(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: {
    position: "absolute",
    bottom: n(34),
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: n(8),
  },
  dot: {
    width: n(7),
    height: n(7),
    borderRadius: n(3.5),
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: {
    backgroundColor: "white",
  },
});
