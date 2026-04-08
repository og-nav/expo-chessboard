import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

import BlurTabBarBackground from "@/components/blur-tab-bar-background.ios";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * Bottom tabs with iOS "liquid glass" blur background. The trick is
 * `tabBarStyle: { position: "absolute" }` so the blur view shows the
 * content behind it; without `absolute` the navigator gives the bar
 * an opaque background and the blur is invisible.
 *
 * `headerShown: false` hides the tab navigator's own header — each
 * tab has its own Stack with the iOS large-title chrome.
 */
export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: BlurTabBarBackground,
        tabBarStyle: Platform.select({
          ios: { position: "absolute" },
          default: {},
        }),
      }}
    >
      <Tabs.Screen
        name="play"
        options={{
          title: "Play",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="gamecontroller.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="smoke"
        options={{
          title: "Smoke",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="checklist" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
