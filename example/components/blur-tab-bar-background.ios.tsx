import { BlurView } from "expo-blur";
import { StyleSheet } from "react-native";

/**
 * iOS "liquid glass" tab bar — system chrome material blur over the
 * content beneath the tab bar. Adapts to light/dark automatically.
 *
 * Pair with `tabBarStyle: { position: "absolute" }` so the content
 * actually shows through, and with `<BodyScrollView
 * contentInsetAdjustmentBehavior="automatic">` so the scroll content
 * gets the right inset under the bar.
 */
export default function BlurTabBarBackground() {
  return (
    <BlurView
      tint="systemChromeMaterial"
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}
