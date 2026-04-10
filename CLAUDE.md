# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@og-nav/expo-chessboard` — an animated, customizable chessboard component for React Native + Expo. Extracted and cleaned up from `reference/ExpoStockfish/components/chessboard-v2/`. The scoped name is required because unscoped `expo-chessboard` is taken on npm.

## Commands

```bash
# Build (tsc → dist/)
pnpm build

# Type-check without emitting
pnpm typecheck

# Lint (ESLint flat config, src/ only)
pnpm lint
pnpm lint:fix

# Tests (two jest projects: "node" for pure logic, "expo" for component tests)
pnpm test                                    # all tests
npx jest --selectProjects node               # square-utils + reconciliation only
npx jest --selectProjects expo               # component smoke tests only
npx jest __tests__/reconciliation.test.ts    # single test file

# Example app (Expo Router app with Play + Smoke tabs)
cd example && npm start                      # Metro bundler
cd example && npx expo run:ios               # native build
```

The example app links the parent package via `"@og-nav/expo-chessboard": "file:.."`. After changing library source, run `pnpm build` in the root so the example picks up updated `dist/` files. The custom `example/metro.config.js` handles singleton resolution for peer deps — if you add a new peer dep, add it to the `SINGLETON_DEPS` set there.

## Architecture

Three load-bearing ideas — do not refactor away from these:

1. **Single Pan gesture for the whole board.** `src/components/gesture-layer.tsx` mounts one `Pan` covering the entire board. It uses `xyToSquare` to resolve which piece was grabbed, and handles tap-to-select + tap-to-move + drag-and-drop in one state machine. Do not split into per-piece gestures.

2. **Hot state lives in `useSharedValue`s on the UI thread.** `pieceMap`, `legalMovesMap`, `promotionsMap`, `selectedSquare`, `lastMoveFrom/To`, `kingInCheck` are all SharedValues. Highlights, legal-move dots, and dragged pieces read these via `useAnimatedStyle` — zero JS-thread re-renders during interaction. React state is only for things needing a render pass (promotion dialog, sync version counter). Note: `pieceMap` is dual-mirrored — SharedValue for worklets AND React state for render — because Reanimated v4 made `.value` reads during JS render unsafe.

3. **Piece reconciliation reuses keys across moves so animations slide instead of pop.** `src/helpers/reconcile-pieces.ts` (extracted for testability) diffs old vs new piece maps and reuses React keys for the same conceptual piece. This makes e2→e4 animate the pawn rather than unmount/remount it. Castling, en passant, captures, and promotions all have dedicated reconciliation branches.

### Controlled vs uncontrolled mode

- **Controlled:** consumer passes a `Chess` instance via `chess` prop, owns its lifecycle.
- **Uncontrolled:** consumer passes `fen` string (or nothing), board owns an internal `Chess` instance.

### Key files

- `src/Chessboard.tsx` — root component (~650 lines), forwardRef'd. Contains imperative ref API (`animateMove`, `syncFromChess`, `undo`, `redo`, `goToMoveIndex`, `reset`, `getFen`, premove logic).
- `src/types.ts` — all public types, `DEFAULT_COLORS`, `ChessboardProps`, `ChessboardRef`.
- `src/helpers/square-utils.ts` — `squareToXY`/`xyToSquare` (worklet-annotated), `buildPieceMap`, `computeLegalMap`, `findKingSquare`.
- `src/helpers/reconcile-pieces.ts` — piece key reconciliation algorithm, pure function, no React dependency.
- `src/use-board-sounds.ts` — expo-audio implementation with `useAudioPlayer`, `interruptionMode: "mixWithOthers"`.
- `src/themes.ts` — four named `BoardColors` presets (DEFAULT, WOOD, BLUE, GREEN).
- `src/constants.ts` — `DEFAULT_PIECES` (PNG requires), `STARTING_FEN`, `SOUND_ASSETS`. Has `@typescript-eslint/no-require-imports` disabled because Metro resolves static assets via `require()`.

### Reference code

`reference/` is gitignored and contains the original source (`reference/ExpoStockfish/components/chessboard-v2/`) and the build plan (`reference/EXPO_CHESSBOARD_PLAN.md`). Treat as read-only. Always work from `chessboard-v2/`, not `chessboard/` (v1 is an outdated fork).

## Testing

Jest is configured with two projects in `jest.config.js`:

- **"node"** — pure JS tests (`square-utils.test.ts`, `reconciliation.test.ts`). Uses `ts-jest` directly, no RN runtime needed.
- **"expo"** — component smoke tests (`chessboard.test.tsx`). Uses `jest-expo` preset with Reanimated/GestureHandler/expo-audio/expo-haptics mocks defined in `jest.setup.ts`.

The `transformIgnorePatterns` override in the expo project handles pnpm's nested `.pnpm/` node_modules layout.

## Peer dependencies (do not bundle)

`react`, `react-native`, `react-native-reanimated >=3`, `react-native-gesture-handler >=2`, `react-native-svg >=15`, `chess.ts >=0.16`, `expo-audio`, `expo-haptics`.

## Build

`tsc -p tsconfig.build.json` emits to `dist/` with declarations, declaration maps, and source maps. Asset `require()` paths in `constants.ts` are relative (`../assets/...`) and survive the tsc emit because tsc preserves the path string. Verify with `npm pack --dry-run` before publish.

## Out of scope for v0.1.0

Engine-agnostic adapter (chess.ts only), setup mode, promotion-dialog file positioning, web support, e2e gesture tests.
