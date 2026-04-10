import { Redirect } from "expo-router";

// Bare URL (`example:///`) has no path to match. Send it to the
// first tab. Without this, expo-router shows "Unmatched Route" on
// cold launch because neither `app/index.tsx` nor
// `app/(tabs)/index.tsx` exists — the (tabs) group only contains
// play/ and smoke/ subdirectories.
export default function Index() {
  return <Redirect href="/play" />;
}
