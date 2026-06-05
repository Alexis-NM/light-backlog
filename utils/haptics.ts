import {
  ImpactFeedbackStyle,
  impactAsync,
  NotificationFeedbackType,
  notificationAsync,
} from "expo-haptics";

export const triggerHaptic = () => impactAsync(ImpactFeedbackStyle.Light);

export const triggerSuccess = () =>
  notificationAsync(NotificationFeedbackType.Success);
