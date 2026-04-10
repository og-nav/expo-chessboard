import { Stack } from "expo-router";

export default function SmokeLayout() {
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
      <Stack.Screen name="index" options={{ title: "Smoke Tests" }} />
    </Stack>
  );
}
