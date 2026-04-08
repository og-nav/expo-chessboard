import { Stack } from "expo-router";

/**
 * Per-tab Stack. The iOS chrome (`headerLargeTitle`,
 * `headerTransparent`, `headerBlurEffect`) is what gives us the
 * native large-title-collapses-into-nav-bar behavior backed by
 * react-native-screens. None of it has Android equivalents — on
 * Android we just get a plain header bar.
 */
export default function PlayLayout() {
  return (
    <Stack
      screenOptions={{
        ...(process.env.EXPO_OS !== "ios"
          ? {}
          : {
              headerLargeTitle: true,
              headerTransparent: true,
              headerBlurEffect: "systemChromeMaterial",
              headerLargeTitleShadowVisible: false,
              headerShadowVisible: true,
              headerLargeStyle: { backgroundColor: "transparent" },
            }),
      }}
    >
      <Stack.Screen name="index" options={{ title: "Play" }} />
    </Stack>
  );
}
