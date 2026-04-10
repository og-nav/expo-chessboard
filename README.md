# @og-nav/expo-chessboard

Animated, customizable chessboard for React Native + Expo. Single-gesture
drag-and-drop, smooth piece reconciliation across moves (including
castling, en passant, and promotion), premoves, move-history scrubbing,
and a deep customization surface — all built on Reanimated, Gesture
Handler, and `chess.ts`.

```tsx
import { Chessboard } from "@og-nav/expo-chessboard";

<Chessboard fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" boardSize={360} />
```

## Install

```sh
npm install @og-nav/expo-chessboard
# or
pnpm add @og-nav/expo-chessboard
# or
yarn add @og-nav/expo-chessboard
```

Then install the peer dependencies in your Expo app:

```sh
npx expo install \
  react-native-reanimated \
  react-native-gesture-handler \
  react-native-svg \
  expo-audio \
  expo-haptics \
  chess.ts
```

The library does not bundle any of those — they are peer deps so your
app and the library share a single instance of each. Reanimated v3+,
Gesture Handler v2+, and `react-native-svg` v15+ are required.

If your app does not already use Reanimated, follow the
[Reanimated setup guide](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started)
— you need the babel plugin (`react-native-worklets/plugin` for
Reanimated v4, `react-native-reanimated/plugin` for v3) and `<GestureHandlerRootView>`
at the root of your app.

## Quickstart

### Uncontrolled mode (board owns the game)

The simplest way to drop a board into a screen. The board owns its
own internal `Chess` instance and the consumer just listens for moves.

```tsx
import { Chessboard, type Move } from "@og-nav/expo-chessboard";

export function PlayScreen() {
  return (
    <Chessboard
      boardSize={360}
      onMove={(move: Move) => {
        console.log("played", move.san);
      }}
    />
  );
}
```

Pass `fen` to start from a non-standard position. Changing the `fen`
prop later resets the internal board to the new position.

### Controlled mode (you own the Chess instance)

For analysis tools, engine integration, or anything that needs to
share a `Chess` instance across the board and other UI.

```tsx
import { Chessboard, type ChessboardRef } from "@og-nav/expo-chessboard";
import { Chess } from "chess.ts";
import { useMemo, useRef } from "react";

export function AnalysisScreen() {
  const chess = useMemo(() => new Chess(), []);
  const boardRef = useRef<ChessboardRef>(null);

  return (
    <Chessboard
      ref={boardRef}
      chess={chess}
      boardSize={360}
      onMove={(move) => {
        // chess has already been updated by the board
        console.log(chess.fen());
      }}
    />
  );
}
```

In controlled mode, mutating `chess` from outside the board (e.g. an
engine response, undoing through your own UI) requires a manual
`boardRef.current?.syncFromChess()` so the board picks up the new
position.

### Programmatic moves

```tsx
boardRef.current?.animateMove("e2", "e4");
boardRef.current?.animateMove("e7", "e8", "q"); // promotion
```

`animateMove` plays through the same animation + reconciliation path
that user gestures take, so it handles castling, en passant, and
promotion correctly.

## Themes

Four named palettes ship with the package. They are plain `BoardColors`
constants you pass to the existing `colors` prop.

```tsx
import { Chessboard, THEME_WOOD, THEME_BLUE, THEME_GREEN } from "@og-nav/expo-chessboard";

<Chessboard boardSize={360} colors={THEME_WOOD} />
```

`THEME_DEFAULT`, `THEME_WOOD`, `THEME_BLUE`, `THEME_GREEN` are exported.
Pass a `Partial<BoardColors>` to override individual colors of any
theme.

## Custom pieces

Two ways to override the bundled PNG piece set:

```tsx
// 1. Per-piece image overrides — anything you don't list falls through
// to the default PNG.
<Chessboard
  boardSize={360}
  pieces={{
    wk: require("./assets/my-white-king.png"),
    bk: require("./assets/my-black-king.png"),
  }}
/>

// 2. Full custom renderer — return any React element. Useful for
// SVGs, unicode glyphs, or animated piece art.
import { Text } from "react-native";
import type { PieceType } from "@og-nav/expo-chessboard";

const UNICODE: Record<PieceType, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

<Chessboard
  boardSize={360}
  renderPiece={(piece, size) => (
    <Text style={{ fontSize: size * 0.78, textAlign: "center", width: size }}>
      {UNICODE[piece]}
    </Text>
  )}
/>
```

## External highlights and arrows

Both layers are read-only overlays — they ignore pointer events so they
never block the gesture layer.

```tsx
<Chessboard
  boardSize={360}
  highlightedSquares={[
    { square: "e4", type: "ring" },
    { square: "d5", type: "fill", color: "rgba(0, 200, 0, 0.4)" },
  ]}
  arrows={[
    { from: "e2", to: "e4" },
    { from: "g1", to: "f3", color: "rgba(255, 100, 0, 0.85)" },
  ]}
/>
```

Both arrays are recomputed declaratively from props on every render —
just pass the arrows and highlights you want and the board mirrors
them. Arrows respect board flips automatically.

## Premoves

```tsx
<Chessboard
  boardSize={360}
  fen={currentFen}
  playerSide="white"
  premovesEnabled
/>
```

When it is not the player's turn, dragging a piece queues a premove
instead of rejecting the gesture. The queued move shows as a red
ring on the from-square and a red arrow to the destination. As soon
as the opponent's move arrives (via the controlled `chess` prop, the
`fen` prop in uncontrolled mode, or `animateMove`), the board checks
whether the premove is now legal. If so, it auto-applies it through
the normal animation path; if not, it clears silently.

Tap anywhere to cancel a queued premove, or call
`boardRef.current?.cancelPremove()` programmatically.

Premoves require `playerSide` to be `"white"` or `"black"` — they are
a no-op in analysis mode (`playerSide="both"`).

## Move-history scrubbing

`undo()` / `redo()` step through `chess.ts` history with the same
animation that forward moves use. The board maintains its own redo
stack on top of `chess.ts` so `redo()` can replay an undone move.

```tsx
const ref = useRef<ChessboardRef>(null);

<Pressable onPress={() => ref.current?.undo()}><Text>Undo</Text></Pressable>
<Pressable onPress={() => ref.current?.redo()}><Text>Redo</Text></Pressable>

// Jump straight to a specific ply (snaps without animating intermediate
// moves):
ref.current?.goToMoveIndex(0); // back to starting position
ref.current?.goToMoveIndex(ref.current.getMoveIndex()); // back to head
```

Making any new move while at an index below the head clears the redo
stack — that's the "you've created a new branch" event. v0.2 will
turn that into a tree node instead of an erase.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `boardSize` | `number` | required | Pixel size of one side of the board. |
| `chess` | `Chess` | — | Controlled mode. Board reads/writes this instance. |
| `fen` | `string` | starting position | Uncontrolled mode. Board owns an internal `Chess` from this FEN. Mutually exclusive with `chess`. |
| `boardOrientation` | `"white" \| "black"` | `"white"` | Visual orientation only. |
| `playerSide` | `"white" \| "black" \| "both"` | `"both"` | Which side the local user can move. |
| `colors` | `Partial<BoardColors>` | `DEFAULT_COLORS` | Palette overrides. Pass a theme constant or a partial object. |
| `pieces` | `Partial<Record<PieceType, ImageSourcePropType>>` | bundled PNGs | Per-piece image overrides. |
| `renderPiece` | `(piece, size) => ReactElement \| null` | — | Full custom piece renderer. Overrides `pieces`. |
| `showCoordinates` | `boolean` | `true` | Show file/rank labels in the corners. |
| `coordinateStyle` | `TextStyle` | — | Style overrides for the coordinate labels. |
| `highlightedSquares` | `SquareHighlight[]` | — | Read-only ring/fill overlays. |
| `arrows` | `Arrow[]` | — | Read-only SVG arrow overlays. |
| `gestureEnabled` | `boolean` | `true` | Disable all interaction. |
| `animationDuration` | `number` | 200 | Piece-slide duration in ms. |
| `soundEnabled` | `boolean` | `true` | Play move/capture/game-over sounds. |
| `hapticsEnabled` | `boolean` | `true` | Trigger haptics on moves. |
| `premovesEnabled` | `boolean` | `false` | Queue moves on opponent's turn. |
| `onMove` | `(move: Move) => void` | — | Fires after every successful move (gesture, programmatic, or premove auto-apply). |
| `onSquarePress` | `(square: Square) => void` | — | Fires on any tap that does not result in a move or selection. |

## Imperative ref API

```ts
interface ChessboardRef {
  animateMove(from: string, to: string, promotion?: string): void;
  syncFromChess(): void;
  reset(fen?: string): void;
  getFen(): string;
  cancelPremove(): void;

  // History scrubbing
  undo(): void;
  redo(): void;
  goToMoveIndex(n: number): void;
  getMoveIndex(): number;
  getHistory(): Move[];
  canUndo(): boolean;
  canRedo(): boolean;
}
```

## Example app & smoke list

The repo ships an Expo example app at [`example/`](./example) that
doubles as a live demo and the manual test pass for the library. Its
**Smoke** tab is a scrollable list of ~40 self-contained cards — one
per public feature and one per regression. Each card has its own board
+ chess instance + reset button, and most have inline controls that
exercise the imperative ref API. It's the fastest way to see every
prop in action and the best place to verify that something works on
real hardware.

What the smoke list covers:

- Every gesture (drag, tap-to-move, drag-and-drop)
- Every special chess move (castling both sides, en passant,
  promotion, capture-promotion)
- Every theme, custom piece set, custom `renderPiece`, external
  highlights, arrows
- Sounds (move / capture / checkmate / stalemate / muted), haptics
- Premoves (basic queue, cancel, sequential rounds)
- Move-history scrubbing (undo / redo / `goToMoveIndex`)
- Imperative ref reads (`getFen`, `getHistory`, `canUndo`, `canRedo`)
- Controlled vs. uncontrolled mode, mid-game `fen` swap,
  `ref.reset(fen)`
- Mid-game orientation flip, mid-game `boardSize` change,
  background → foreground mid-drag

### Run it on your phone

The example app uses [Expo Go](https://expo.dev/go) so you don't need
Xcode or Android Studio.

1. Install Expo Go on your iPhone or Android device from the App
   Store / Play Store.
2. Clone the repo and install dependencies:

   ```sh
   git clone https://github.com/og-nav/expo-chessboard.git
   cd expo-chessboard
   pnpm install
   pnpm build           # builds the library into dist/
   cd example
   pnpm install
   ```

3. Start the dev server:

   ```sh
   pnpm start
   ```

4. Scan the QR code printed in the terminal with your phone's camera
   (iOS) or from inside Expo Go (Android). The app loads, the Smoke
   tab is the second tab in the bottom bar.

The example imports the library via `file:..` so any change you make
to `src/` followed by `pnpm build` (in the repo root) will be picked
up the next time you reload Expo Go — useful if you want to fork the
library and try changes against the smoke list.

If you don't want to run the app yourself, the cards in
[`example/app/(tabs)/smoke/index.tsx`](./example/app/(tabs)/smoke/index.tsx)
are also the most complete set of usage examples in the repo — every
prop combination and every ref method is demonstrated there in
ready-to-copy form.

## License

MIT © og-nav. See [LICENSE](./LICENSE).
