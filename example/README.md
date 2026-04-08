# expo-chessboard example app

Bare Expo app that consumes `@og-nav/expo-chessboard` via `file:..` and
exercises every public feature. Doubles as the manual smoke-test pass
before publishing.

## Setup

```bash
# from the package root
pnpm build           # the example reads from ../dist
cd example
npm install
npm run ios          # or `npm run android`
```

The package is symlinked into `example/node_modules/@og-nav/expo-chessboard`
via `file:..`, so any change to `src/` followed by `pnpm build` is
picked up by Metro after a reload — no `npm install` needed between
edits.

## Tabs

- **Play** — full game against a random-move bot. Exercises drag,
  tap-to-move, capture sounds, the imperative `animateMove`, and
  end-of-game state (checkmate / stalemate / draw).
- **Smoke** — scrollable list of self-contained test cards. Each card
  has its own preset board, a description of what to do, and (where
  useful) extra controls (Undo/Redo, Bot plays). The post-action
  state of each card IS the visual confirmation. This is the manual
  smoke-test list — anything broken here is broken in the library.

## What this app proves

- The package builds and resolves under a real Metro instance with
  the standard Expo SDK 54 peer-dep set
- Every prop on `<Chessboard>` works at runtime, not just in Jest
- Reanimated worklets, gesture handling, expo-audio, and expo-haptics
  all wire up correctly
- iOS large-title chrome and `expo-blur`-backed tab bar play nicely
  with the board (no clipping, no inset surprises)

## iOS-only chrome

The collapsing large-title header and the blur tab bar are
iOS-native (`react-native-screens` + `expo-blur` + a Stack with
`headerLargeTitle: true`). On Android the header falls back to a
plain bar — no Reanimated re-implementation. Same code; the
`process.env.EXPO_OS !== "ios"` guard in each per-tab `_layout.tsx`
short-circuits the iOS chrome opts on Android.
