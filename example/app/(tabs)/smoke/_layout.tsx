import { Stack } from "expo-router";

export default function SmokeLayout() {
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
      <Stack.Screen name="index" options={{ title: "Smoke Tests" }} />
    </Stack>
  );
}
