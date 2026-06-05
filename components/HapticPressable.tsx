import { Pressable, type PressableProps } from "react-native";
import { triggerHaptic } from "@/utils/haptics";

export const HapticPressable = (props: PressableProps) => (
  <Pressable
    {...props}
    android_disableSound={true}
    onPress={(event) => {
      triggerHaptic();
      props.onPress?.(event);
    }}
  />
);
