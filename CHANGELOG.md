# Changelog

All notable changes to `@og-nav/expo-chessboard` are documented here.
This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0 — Initial release

First public release. Extracted and rebuilt from a working in-app
implementation, with twelve audited bugs fixed during the port and a
broader public API.

### Features

- **Animated piece movement.** Drag-and-drop and tap-to-move both
  driven by a single full-board `Pan` gesture; pieces slide between
  squares using Reanimated shared values on the UI thread.
- **Smart piece reconciliation.** Castling animates both the king and
  the rook. En passant removes the captured pawn cleanly. Captures
  reuse the capturing piece's React key so it slides onto the target
  square instead of popping.
- **Promotion animation.** Promoting pawns slide *and* morph into the
  selected piece in a single animation, instead of popping at the
  destination.
- **Controlled and uncontrolled modes.** Pass a `chess.ts` instance for
  full control, or just a `fen` string and let the board own its own
  internal `Chess`.
- **Premoves.** Set `premovesEnabled` and the player can queue a move
  during the opponent's turn; it auto-executes when it becomes legal,
  or clears silently if the opponent's move makes it illegal.
- **Move-history scrubbing.** Imperative `undo()` / `redo()` /
  `goToMoveIndex(n)` ref methods animate pieces backward and forward
  through `chess.ts` history. Foundation for variation trees in v0.2.
- **Full customization surface:**
  - `pieces` — partial map to override individual PNG assets
  - `renderPiece(piece, size)` — render any React node per piece
    (unicode glyphs, SVGs, custom assets)
  - `colors` — full board palette + theme presets
    (`THEME_DEFAULT`, `THEME_WOOD`, `THEME_BLUE`, `THEME_GREEN`)
  - `boardOrientation` (visual flip) and `playerSide` (interaction
    restriction) split apart so you can render an "I'm watching black"
    view or an analysis-mode `playerSide="both"` board
  - `showCoordinates`, `coordinateStyle`
  - `highlightedSquares` — external ring/fill overlays for puzzle
    annotations
  - `arrows` — SVG arrow overlay layer
  - `onSquarePress` — fires on every square tap, even empty ones
  - `soundEnabled`, `hapticsEnabled`
- **Imperative ref API:** `animateMove`, `syncFromChess`, `getFen`,
  `reset`, `undo`, `redo`, `goToMoveIndex`, `getMoveIndex`,
  `getHistory`, `canUndo`, `canRedo`, `cancelPremove`.

### Engineering

- **Migrated to `expo-audio`.** The earlier in-app implementation used
  the deprecated `expo-av`; this version uses `useAudioPlayer` and
  `setAudioModeAsync({ playsInSilentMode: true, interruptionMode:
  "mixWithOthers" })` so mounting the chessboard does not pause the
  user's music.
- **Reconciliation extracted into a pure helper.** The piece-key reuse
  algorithm lives in `helpers/reconcile-pieces.ts` so it can be
  unit-tested without React, Reanimated, or jsdom.
- **Plain `tsc` build to `dist/`.** No bundler. Asset `require()` paths
  are relative and survive the emit.
- **Peer-dep model.** `react`, `react-native`, `react-native-reanimated
  >=3`, `react-native-gesture-handler >=2`, `react-native-svg >=15`,
  `chess.ts >=0.16`, `expo-audio`, `expo-haptics`. Nothing bundled.

### Known limitations

- The promotion picker is a centered modal, not yet positioned over
  the destination file.
- Setup mode (drop any piece anywhere) is deferred to v0.2.
- The redo stack is single-line; multi-line variation trees are
  deferred to v0.2 (the redo stack is the foundation).
- Web support is whatever `react-native-web` gives for free; not
  explicitly tested.
