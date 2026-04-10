import { Stack } from "expo-router";

/**
 * Per-tab Stack. `headerLargeTitle` gives us the native large-title-
 * collapses-into-nav-bar behavior. Header is intentionally opaque —
 * a transparent blur header adapts its appearance based on content
 * behind it, and chess boards' dark/light squares make it flicker.
 */
export default function PlayLayout() {
  return (
    <Stack
      screenOptions={{
        ...(process.env.EXPO_OS !== "ios"
          ? {}
          : {
              headerLargeTitle: true,
              headerLargeTitleShadowVisible: false,
              headerShadowVisible: true,
            }),
      }}
    >
      <Stack.Screen name="index" options={{ title: "Play" }} />
    </Stack>
  );
}
