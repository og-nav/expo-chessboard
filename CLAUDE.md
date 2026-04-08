# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repo is **greenfield** — no `src/`, no `package.json`, no `dist/` yet. The only contents are under `reference/`:

- `reference/EXPO_CHESSBOARD_PLAN.md` — the authoritative build plan. Read this before making structural decisions; it locks in package name, peer deps, file layout, public API, bug list, and test strategy.
- `reference/ExpoStockfish/` — a sibling RN app containing the source-of-truth implementation that this package is being extracted from. Do not modify it; treat it as read-only reference.

The goal is to publish `@og-nav/expo-chessboard` — an extraction and clean-up of `reference/ExpoStockfish/components/chessboard-v2/`. Scope of v0.1.0 is locked: chess.ts only (peer dep), `tsc` build to `dist/`, `expo-audio` (not `expo-av`), customization props for piece sets / `renderPiece` / external highlights / arrows / coordinate toggle / uncontrolled FEN mode.

The published name is **scoped** — the unscoped `expo-chessboard` is taken on npm by an abandoned fork.

## Source-of-truth code (reference/ExpoStockfish/components/chessboard-v2/)

There are two implementations side by side in the reference repo. **Always work from `chessboard-v2/`** — `chessboard/` is a fork of the outdated `react-native-chessboard` v1 with a 6-context-provider tangle. v2 is the architecture worth preserving.

```
chessboard-v2/
├── index.tsx                    # ChessboardV2 root, ~250 lines
├── types.ts                     # Props, Ref, BoardColors, DEFAULT_COLORS
├── constants.ts                 # DEFAULT_PIECES (PNG requires), STARTING_FEN
├── use-board-sounds.ts          # currently expo-av — must be rewritten for expo-audio
├── helpers/square-utils.ts      # squareToXY/xyToSquare (worklet-annotated), buildPieceMap, computeLegalMap, findKingSquare
└── components/
    ├── board-background.tsx     # 64 squares + file/rank labels
    ├── highlight-layer.tsx      # last-move + check + selected square (UI-thread reactive)
    ├── piece-layer.tsx          # AnimatedPiece + reconciliation (key reuse across moves)
    ├── legal-move-dots.tsx      # 64 dots, each with its own useAnimatedStyle
    ├── gesture-layer.tsx        # ONE full-board Pan that handles tap+drag+drop
    └── promotion-dialog.tsx
```

## v2 architecture — the big picture

The reason v2 exists is to collapse v1's 6-context-provider, per-piece-`GestureDetector` design into something sane. Three load-bearing ideas:

1. **Single Pan gesture for the whole board.** `gesture-layer.tsx` mounts one `Pan` that covers the entire board. It uses `xyToSquare` to figure out which piece you grabbed, drives drag with shared values, and handles tap-to-select + tap-to-move + drag-and-drop in one state machine. Don't refactor this back into per-piece gestures.

2. **Hot state lives in `useSharedValue`s on the UI thread.** `pieceMap`, `legalMovesMap`, `promotionsMap`, `selectedSquare`, `lastMoveFrom/To`, `kingInCheck` are all SharedValues. Highlight squares, legal-move dots, and dragged pieces all read these directly via `useAnimatedStyle` — zero JS-thread re-renders during interaction. React state is only used for things that genuinely need a render pass (e.g., the promotion dialog visibility).

3. **Piece reconciliation reuses keys across moves so animations slide instead of pop.** `piece-layer.tsx` keeps a `keySquareMap` (Map<key, square>). On each move it diffs `oldMap` vs `newMap` and tries to reuse the piece key for the same conceptual piece — so when a pawn moves e2→e4, the e4 entry gets the *same* React key the e2 entry had, the AnimatedPiece component instance survives, and its position animates from e2 to e4. Castling works because step 2 of the algorithm excludes new-square entries that match unmoved pieces. **Promotion does not work** in v2 today — see bug #9 in the plan; the fix is a new branch in reconciliation that maps the promoted piece's key back to the same-color, same-(or-adjacent)-file pawn whose old square is now empty.

The component is `forwardRef`'d. The imperative ref API today is `animateMove(from, to, promotion?)` and `syncFromChess()`. The plan extends it with `reset(fen?)`, `undo()`, `getFen()`.

It supports both **controlled mode** (consumer passes a `Chess` instance) and, after the rewrite, **uncontrolled mode** (consumer passes a `fen` string, package owns the internal `Chess`).

## Bugs the rewrite must fix (from the plan's audit)

These are not "future improvements" — the audit found them by reading every file in v2, and they need to be fixed during the extraction. Read `EXPO_CHESSBOARD_PLAN.md` "Code audit" section before touching the corresponding files.

- **`index.tsx:108-115`** — FEN-sync useEffect has no dep array. Runs every render.
- **`index.tsx:132,182`** — empty `try/catch` swallows real chess.ts errors. Use `__DEV__ && console.warn`.
- **`index.tsx:48`** — `colors` rebuilt every render, defeats memo on children. Wrap in `useMemo`.
- **`index.tsx:79`** — `playerColor` conflates board orientation and move restriction. Split into `boardOrientation` (visual) + `playerSide` (interaction); keep `playerColor` as deprecated alias.
- **`use-board-sounds.ts`** — uses deprecated `expo-av`. Migrate the whole file to `expo-audio` (`useAudioPlayer`, `setAudioModeAsync({ playsInSilentMode, interruptionMode: "mixWithOthers" })`). Without `mixWithOthers`, mounting the chessboard will pause the user's music.
- **`use-board-sounds.ts`** — return object identity churns every render (cascades into `executeMove` deps); the "checkmate" sound also fires for draw/threefold.
- **`use-board-sounds.ts` + `constants.ts:22`** — the "check" sound is `move.mp3` mislabelled; either ship a real one or remove the entry.
- **`piece-layer.tsx`** — promotion pops instead of animating (described above).
- **`board-background.tsx:80`** — coordinate fontSize hardcoded to 9, overlaps pieces on small boards. Scale by `pieceSize`.

The plan also lists items that are **verified correct** — `square-utils.ts`, `gesture-layer.tsx` tap-then-tap flow, en passant, capture, castling reconciliation. Don't "improve" those.

## Target package layout

Per the plan (not yet built):

```
src/
├── index.ts                    # public exports
├── Chessboard.tsx              # renamed from chessboard-v2/index.tsx
├── types.ts
├── constants.ts
├── use-board-sounds.ts         # expo-audio rewrite
├── helpers/
│   ├── square-utils.ts
│   └── reconcile-pieces.ts     # NEW — extract reconciliation out of PieceLayer for unit testing
└── components/
    ├── board-background.tsx
    ├── gesture-layer.tsx
    ├── highlight-layer.tsx
    ├── legal-move-dots.tsx
    ├── piece-layer.tsx
    ├── promotion-dialog.tsx
    ├── arrows-layer.tsx        # NEW — react-native-svg, pointerEvents none
    └── external-highlights.tsx # NEW
assets/{pieces,sounds}/
example/                        # bare Expo app, doubles as manual test harness
__tests__/                      # square-utils, reconciliation, chessboard
```

Build is plain `tsc -p tsconfig.build.json` → `dist/`. Asset `require()` paths in `src/constants.ts` are relative (`../assets/...`) and survive the tsc emit because tsc preserves the relative path; verify with `npm pack --dry-run` before publish.

## Peer deps (do not bundle)

`react`, `react-native`, `react-native-reanimated >=3`, `react-native-gesture-handler >=2`, `react-native-svg >=15`, `chess.ts >=0.16`, `expo-audio`, `expo-haptics`. There is intentionally **no chess-engine adapter** in v0.1 — `chess.ts` only.

## Testing strategy (when tests are added)

The plan defines five layers; the highest-leverage one is **`__tests__/reconciliation.test.ts`**, which is why the reconciliation logic must be extracted into `helpers/reconcile-pieces.ts` first. That file lets you assert "e2-e4 reuses the pawn's key", "kingside castling reuses the king AND the h1 rook keys", "promotion reuses the pawn's key with the new piece type" without React, jsdom, or worklet mocks.

Component tests use `jest-expo` (which ships a Reanimated mock making shared values plain objects and `withTiming` synchronous). Gesture flows are not testable this way — they go in the `example/` manual smoke list (18 checks documented in the plan).

The final dogfood step is replacing `import ChessboardV2 from "../chessboard-v2"` in `reference/ExpoStockfish/components/stockfish/PlayStockfishScreenV2.tsx:19` with `import { Chessboard } from "@og-nav/expo-chessboard"` (via `npm install /Users/navinchikkodi/Desktop/expo-chessboard`) and confirming the Stockfish play screen still works identically.

## Out of scope for v0.1.0

Engine-agnostic adapter, premoves, square-press callback, setup mode, theme presets, promotion-dialog file positioning, web support, e2e gesture tests. The plan lists these explicitly so they don't sneak into the first release.
