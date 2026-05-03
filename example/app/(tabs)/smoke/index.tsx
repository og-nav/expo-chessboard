import {
  Chessboard,
  STARTING_FEN,
  THEME_BLUE,
  THEME_GREEN,
  THEME_WOOD,
  type ChessboardRef,
  type PieceType,
  type Square,
} from "@og-nav/expo-chessboard";
import { Chess } from "chess.ts";
import { useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";

import { SmokeCard, type SmokeCardProps } from "@/components/smoke-card";
import { pickRandomMove } from "@/lib/random-bot";

/**
 * Smoke tab — every public feature of the chessboard rendered as a
 * scrollable list of self-contained test cards. Each card owns its
 * own Chess instance and ref, has a Reset button, and (where useful)
 * extra controls that drive the imperative API.
 *
 * Scroll through, do the listed action, see the result. The post-
 * action board state IS the visual confirmation. This is the manual
 * test pass before publishing — anything broken here is broken in
 * the library, regardless of what Jest says.
 *
 * Rendered as a FlatList (not a ScrollView with 24 inline cards) so
 * that virtualization keeps only ~5 boards mounted at a time. With 24
 * boards × ~32 AnimatedPiece children each = ~768 reanimated nodes,
 * the inline-ScrollView version dropped scroll frames hard. FlatList's
 * windowing keeps the live native-view count an order of magnitude
 * lower and scrolling stays at 60fps.
 */
// Module-scope so the FlatList prop identity is stable across re-renders.
// FlatList passes prop equality through to its items: a new renderItem
// reference here would invalidate every visible row on every parent
// render, defeating the windowing entirely.
const renderSmokeCard: ListRenderItem<SmokeCardProps> = ({ item }) => (
  <SmokeCard {...item} />
);

const keyExtractor = (item: SmokeCardProps) => String(item.number);

export default function SmokeScreen() {
  return (
    <FlatList
      data={SMOKE_CARDS}
      keyExtractor={keyExtractor}
      renderItem={renderSmokeCard}
      ListHeaderComponent={SmokeHeader}
      contentContainerStyle={styles.container}
      ItemSeparatorComponent={Separator}
      // Virtualization tuning. Boards have variable heights so no
      // getItemLayout — these knobs are doing all the work.
      //
      // NOTE: removeClippedSubviews is intentionally OFF. It detaches
      // native views when offscreen and re-attaches on scroll-back,
      // but react-native-gesture-handler doesn't reliably re-register
      // its Pan recognizer after a view is re-attached — boards that
      // have scrolled offscreen and back become gesture-dead. The
      // FlatList's JS-side virtualization (windowSize) already handles
      // unmounting offscreen components, so clipping is redundant.
      initialNumToRender={3}
      maxToRenderPerBatch={2}
      windowSize={5}
      updateCellsBatchingPeriod={50}
      // Match the native large-title Stack so the FlatList sits flush
      // under the header and respects the NativeTabs bottom bar.
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustsScrollIndicatorInsets
      contentInset={{ bottom: 0 }}
      scrollIndicatorInsets={{ bottom: 0 }}
    />
  );
}

function Separator() {
  return <Text style={styles.separator} />;
}

/**
 * Info card at the top of the smoke list. Explains what the smoke
 * list is, why it exists, and what's actually being tested. Rendered
 * once via FlatList's ListHeaderComponent so it scrolls with the
 * cards instead of being pinned.
 */
function SmokeHeader() {
  return (
    <View style={styles.headerCard}>
      <Text style={styles.headerTitle}>Smoke list</Text>
      <Text style={styles.headerBody}>
        This screen is the manual test pass for{" "}
        <Text style={styles.headerCode}>@og-nav/expo-chessboard</Text>. Each
        card is a self-contained example of one feature or one fixed bug.
        Scroll through, do the listed action, and the post-action board
        state IS the visual confirmation it works.
      </Text>
      <Text style={styles.headerBody}>
        Why it exists: Jest can verify pure logic (reconciliation, square
        math, ref methods) but it can&apos;t verify gestures, animation timing,
        sound playback, or Reanimated UI-thread state machines. Those need
        a real device. The smoke list is the gate before publishing — if
        anything here is broken, the library is broken regardless of what
        the test suite says.
      </Text>
      <Text style={styles.headerBody}>
        What&apos;s covered: every public prop, every imperative ref method,
        both controlled and uncontrolled modes, every theme, premoves,
        history scrubbing, all special chess moves (castle / en passant /
        promotion), sounds, highlights, arrows, custom piece rendering,
        and a regression block (cards 25-27) for gesture bugs that were
        hard to catch and easy to reintroduce.
      </Text>
    </View>
  );
}

/**
 * Card 32 — uncontrolled mode reacting to a changing `fen` prop. Local
 * state cycles through positions; the Chessboard re-renders into each
 * one. Lives as a BoardSlot because the cycling state needs to survive
 * across renders, which renderExtraControls (a function called during
 * the parent render) cannot express.
 */
const FEN_CYCLE = [
  STARTING_FEN,
  "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2",
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5",
];
function FenCyclerSlot({ size }: { size: number; onReset: () => void }) {
  const [idx, setIdx] = useState(0);
  return (
    <>
      <View style={styles.boardWrap}>
        <Chessboard fen={FEN_CYCLE[idx]} boardSize={size} />
      </View>
      <View style={styles.controls}>
        <Pressable
          onPress={() => setIdx((n) => (n + 1) % FEN_CYCLE.length)}
          style={({ pressed }) => [
            styles.controlButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Next position</Text>
        </Pressable>
        <Pressable
          // setIdx(0) alone is enough — the new fen prop drives a
          // syncFromChess() in the Chessboard, which animates pieces
          // back via reconciliation. Calling the parent onReset would
          // remount the wrapper and snap instead of animating, which
          // is what the bug was.
          onPress={() => setIdx(0)}
          style={({ pressed }) => [
            styles.controlButton,
            styles.resetButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Reset</Text>
        </Pressable>
      </View>
    </>
  );
}

/**
 * Card 39 — mid-game orientation flip. BoardSlot pattern is required
 * because boardOrientation needs to come from local state that changes
 * AFTER initial mount. Owns its own Chess instance so the user can
 * make moves, then flip, and the moves are preserved across the flip.
 */
function OrientationToggleSlot({ size, onReset }: { size: number; onReset: () => void }) {
  const [chess] = useState(() => new Chess());
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  return (
    <>
      <View style={styles.boardWrap}>
        <Chessboard
          chess={chess}
          boardSize={size}
          boardOrientation={orientation}
          playerSide="both"
        />
      </View>
      <View style={styles.controls}>
        <Pressable
          onPress={() =>
            setOrientation((o) => (o === "white" ? "black" : "white"))
          }
          style={({ pressed }) => [
            styles.controlButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Flip board</Text>
        </Pressable>
        <Pressable
          onPress={onReset}
          style={({ pressed }) => [
            styles.controlButton,
            styles.resetButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Reset</Text>
        </Pressable>
      </View>
    </>
  );
}

/**
 * Card 40 — mid-game boardSize change. Cycles through three pixel
 * sizes. Verifies the piece-position recomputation runs cleanly when
 * boardSize prop changes (the squareToXY result depends on pieceSize,
 * which is boardSize/8).
 */
const SIZE_CYCLE = [240, 320, 400];
function SizeCycleSlot({ onReset }: { size: number; onReset: () => void }) {
  const [chess] = useState(() => new Chess());
  const [sizeIdx, setSizeIdx] = useState(1);
  return (
    <>
      <View style={styles.boardWrap}>
        <Chessboard chess={chess} boardSize={SIZE_CYCLE[sizeIdx]} />
      </View>
      <View style={styles.controls}>
        <Pressable
          onPress={() => setSizeIdx((n) => (n + 1) % SIZE_CYCLE.length)}
          style={({ pressed }) => [
            styles.controlButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>
            Cycle size ({SIZE_CYCLE[sizeIdx]}px)
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setSizeIdx(1);
            onReset();
          }}
          style={({ pressed }) => [
            styles.controlButton,
            styles.resetButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Reset</Text>
        </Pressable>
      </View>
    </>
  );
}

/**
 * Card 43 — onSquarePress callback. Shows an Alert with the tapped
 * square when the user taps an empty or opponent square (tapping an own
 * piece selects it instead). BoardSlot pattern needed because the
 * callback needs to be stable and the Alert is driven by it.
 */
function OnSquarePressSlot({ size, onReset }: { size: number; onReset: () => void }) {
  const [chess] = useState(() => new Chess());
  const [lastTapped, setLastTapped] = useState<string | null>(null);
  return (
    <>
      <View style={styles.boardWrap}>
        <Chessboard
          chess={chess}
          boardSize={size}
          onSquarePress={(sq: Square) => setLastTapped(sq)}
        />
      </View>
      <Text style={styles.squarePressLabel}>
        Last onSquarePress: {lastTapped ?? "(none)"}
      </Text>
      <View style={styles.controls}>
        <Pressable
          onPress={() => {
            setLastTapped(null);
            onReset();
          }}
          style={({ pressed }) => [
            styles.controlButton,
            styles.resetButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Reset</Text>
        </Pressable>
      </View>
    </>
  );
}

/**
 * Card 47 — variation preview. Mounts at the starting position and
 * lets the user preview a 6-ply Ruy Lopez line on top of the live
 * position without committing to it. Tint overlay + Step buttons
 * exercise the full preview API surface; "Live move" demonstrates
 * auto-exit when a real live move arrives.
 */
// Six plies of the Ruy Lopez. Starting from the initial position so the
// SAN is unambiguous and trivially replayable; nothing about the preview
// API depends on the base position being mid-game.
const PREVIEW_LINE: string[] = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"];
const PREVIEW_BASE_FEN = STARTING_FEN;

function VariationPreviewSlot({
  size,
  onReset,
}: {
  size: number;
  onReset: () => void;
}) {
  const [chess] = useState(() => new Chess(PREVIEW_BASE_FEN));
  const ref = useRef<ChessboardRef>(null);
  const [previewState, setPreviewState] = useState<{
    index: number;
    length: number;
  } | null>(null);

  // Mirror the engine's first move as a PV arrow while previewing —
  // shows the consumer-facing pattern (just hand the existing `arrows`
  // prop a one-element array of {from, to} computed from your line).
  const pvArrow =
    previewState && previewState.index < previewState.length
      ? {
          // Walk the SAN through a temp Chess to get from/to. Cheap
          // because we only do it on render and the line is short.
          ...(() => {
            const c = new Chess(chess.fen());
            try {
              const m = c.move(PREVIEW_LINE[previewState.index]);
              return m
                ? { from: m.from as Square, to: m.to as Square }
                : { from: "e2" as Square, to: "e2" as Square };
            } catch {
              return { from: "e2" as Square, to: "e2" as Square };
            }
          })(),
          color: "rgba(80, 130, 230, 0.85)",
        }
      : null;

  return (
    <>
      <View style={styles.boardWrap}>
        <Chessboard
          ref={ref}
          chess={chess}
          boardSize={size}
          arrows={pvArrow ? [pvArrow] : undefined}
          onPreviewChange={(s) =>
            setPreviewState(s ? { index: s.index, length: s.length } : null)
          }
        />
      </View>
      <Text style={styles.squarePressLabel}>
        {previewState
          ? `Preview ${previewState.index}/${previewState.length}`
          : "Live"}
      </Text>
      <View style={styles.controls}>
        {!previewState && (
          <Pressable
            onPress={() => ref.current?.previewLine(PREVIEW_LINE, 0)}
            style={({ pressed }) => [
              styles.controlButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.controlButtonText}>Show PV</Text>
          </Pressable>
        )}
        {previewState && (
          <>
            <Pressable
              onPress={() => ref.current?.stepPreviewBack()}
              style={({ pressed }) => [
                styles.controlButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.controlButtonText}>◀ Back</Text>
            </Pressable>
            <Pressable
              onPress={() => ref.current?.stepPreviewForward()}
              style={({ pressed }) => [
                styles.controlButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.controlButtonText}>Forward ▶</Text>
            </Pressable>
            <Pressable
              onPress={() => ref.current?.exitPreview()}
              style={({ pressed }) => [
                styles.controlButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.controlButtonText}>Exit preview</Text>
            </Pressable>
          </>
        )}
        <Pressable
          // Simulate a "live move arrived" — auto-exits preview and
          // applies the move to the live game.
          onPress={() => {
            const move = pickRandomMove(chess);
            if (move) {
              ref.current?.animateMove(move.from, move.to, move.promotion);
            }
          }}
          style={({ pressed }) => [
            styles.controlButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Live move</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            chess.load(PREVIEW_BASE_FEN);
            ref.current?.reset();
            onReset();
          }}
          style={({ pressed }) => [
            styles.controlButton,
            styles.resetButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Reset</Text>
        </Pressable>
      </View>
    </>
  );
}

/**
 * Card 46 — undo through a promotion move (visual). Promotes a pawn
 * via animateMove, then lets the user undo/redo to see the queen morph
 * back into a pawn and forward again.
 */
function UndoPromotionSlot({ size, onReset }: { size: number; onReset: () => void }) {
  const [chess] = useState(() => new Chess("k7/4P3/8/8/8/8/8/7K w - - 0 1"));
  const ref = useRef<ChessboardRef>(null);
  const [promoted, setPromoted] = useState(false);
  return (
    <>
      <View style={styles.boardWrap}>
        <Chessboard ref={ref} chess={chess} boardSize={size} />
      </View>
      <View style={styles.controls}>
        {!promoted && (
          <Pressable
            onPress={() => {
              ref.current?.animateMove("e7", "e8", "q");
              setPromoted(true);
            }}
            style={({ pressed }) => [
              styles.controlButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.controlButtonText}>Promote</Text>
          </Pressable>
        )}
        {promoted && (
          <>
            <Pressable
              onPress={() => ref.current?.undo()}
              style={({ pressed }) => [
                styles.controlButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.controlButtonText}>Undo</Text>
            </Pressable>
            <Pressable
              onPress={() => ref.current?.redo()}
              style={({ pressed }) => [
                styles.controlButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.controlButtonText}>Redo</Text>
            </Pressable>
          </>
        )}
        <Pressable
          onPress={() => {
            setPromoted(false);
            onReset();
          }}
          style={({ pressed }) => [
            styles.controlButton,
            styles.resetButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Reset</Text>
        </Pressable>
      </View>
    </>
  );
}

// Unicode chess glyphs. iOS renders them with Apple Color Emoji, which
// looks reasonable; Android renders them with whatever's installed,
// which is fine for a demo.
const UNICODE_PIECES: Record<PieceType, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

function renderUnicodePiece(piece: PieceType, size: number) {
  return (
    <Text
      style={{
        fontSize: size * 0.78,
        lineHeight: size,
        textAlign: "center",
        width: size,
      }}
    >
      {UNICODE_PIECES[piece]}
    </Text>
  );
}

// All 24 cards as data. Function-valued props (renderPiece,
// renderExtraControls) are fine here — FlatList just hands each item
// to renderItem, which spreads it into <SmokeCard />. Extracting these
// to module scope also means the array identity is stable across
// re-renders, so FlatList doesn't churn.
const SMOKE_CARDS: SmokeCardProps[] = [
  {
    number: 1,
    title: "Pawn move (drag)",
    expected:
      "Drag e2 → e4. The pawn slides smoothly into place. Move sound plays at the end of the slide.",
  },
  {
    number: 2,
    title: "Pawn move (tap-tap)",
    expected:
      "Tap e2 (legal-move dots appear), then tap e4. Same animation as drag.",
  },
  {
    number: 3,
    title: "Capture sound",
    expected:
      "Drag d4 → e5. Capture sound plays (different from move sound), captured pawn vanishes cleanly.",
    fen: "rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1",
  },
  {
    number: 4,
    title: "Kingside castling",
    expected:
      "Drag king e1 → g1. BOTH the king and the h1 rook animate to their castled squares — neither pops.",
    fen: "rnbq1rk1/ppppbppp/5n2/4p3/4P3/5N2/PPPPBPPP/RNBQK2R w KQ - 0 1",
  },
  {
    number: 5,
    title: "Queenside castling",
    expected:
      "Drag king e1 → c1. King AND a1 rook both animate. The d1 square is reached by the rook, not skipped.",
    fen: "r3kbnr/pppqpppp/2np4/8/8/2NPB3/PPPQPPPP/R3KBNR w KQkq - 0 1",
  },
  {
    number: 6,
    title: "En passant",
    expected:
      "Drag e5 × f6. Captured pawn on f5 disappears, capturing pawn lands on f6. Capture sound plays.",
    fen: "rnbqkbnr/ppp1p1pp/3p4/4Pp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
  },
  {
    number: 7,
    title: "Promotion — bug #9 fix",
    expected:
      "Drag e7 → e8. Pawn slides to the back rank AND morphs into a queen mid-slide. No pop, no flicker.",
    fen: "k7/4P3/8/8/8/8/8/7K w - - 0 1",
  },
  {
    number: 8,
    title: "Capture-promotion",
    expected:
      "Drag d7 × c8. The pawn slides diagonally onto the bishop's square and morphs to a queen. Capture sound.",
    fen: "2b4k/3P4/8/8/8/8/8/7K w - - 0 1",
  },
  {
    number: 9,
    title: "Legal-move dots",
    expected:
      "Tap any white piece. Dots appear on every legal target square. Tap again to deselect.",
  },
  {
    number: 10,
    title: "Check highlight",
    expected:
      "Drag rook d2 → d8. Black king square pulses red — the in-check highlight.",
    fen: "4k3/8/8/8/8/8/3R4/4K3 w - - 0 1",
  },
  {
    number: 11,
    title: "Last-move highlight",
    expected:
      "Drag e2 → e4. Both e2 and e4 stay tinted yellow after the move completes.",
  },
  {
    number: 12,
    title: "boardOrientation='black' (visual flip)",
    expected:
      "Board is flipped — h1 is top-right, a8 is bottom-left. Coordinates and gestures still match.",
    boardProps: { boardOrientation: "black" },
  },
  {
    number: 13,
    title: "playerSide='both' (analysis mode)",
    expected:
      "You can drag both white AND black pieces. Useful for puzzle editors and review screens.",
    boardProps: { playerSide: "both" },
  },
  {
    number: 14,
    title: "showCoordinates={false}",
    expected:
      "No file letters or rank numbers in the corners. Useful for puzzle preview cards or screenshots.",
    boardProps: { showCoordinates: false },
  },
  {
    number: 15,
    title: "Theme: WOOD",
    expected:
      "Warm-brown squares. Same board, different palette via the colors prop.",
    boardProps: { colors: THEME_WOOD },
  },
  {
    number: 16,
    title: "Theme: BLUE",
    expected: "Blue / off-white squares.",
    boardProps: { colors: THEME_BLUE },
  },
  {
    number: 17,
    title: "Theme: GREEN",
    expected: "Green / cream squares.",
    boardProps: { colors: THEME_GREEN },
  },
  {
    number: 18,
    title: "External highlight — ring",
    expected:
      "e4 has a colored ring overlay. Try dragging through it — the ring is non-interactive (pointerEvents='none'). Tap Flip to verify the ring sticks to the e4 square in both orientations.",
    boardProps: {
      highlightedSquares: [{ square: "e4", type: "ring" }],
    },
    withFlipButton: true,
  },
  {
    number: 19,
    title: "External highlight — fill",
    expected:
      "d5 is filled with a translucent color. Same non-interactive overlay layer. Tap Flip to verify the fill stays on d5 (not d4) when orientation changes.",
    boardProps: {
      highlightedSquares: [{ square: "d5", type: "fill" }],
    },
    withFlipButton: true,
  },
  {
    number: 20,
    title: "Arrows",
    expected:
      "Two arrows drawn in SVG: e2→e4 and g1→f3. Tap Flip — the arrows should rotate with the board so they still connect the same squares (this is the regression case for arrows-not-flipping).",
    boardProps: {
      arrows: [
        { from: "e2", to: "e4" },
        { from: "g1", to: "f3" },
      ],
    },
    withFlipButton: true,
  },
  {
    number: 21,
    title: "renderPiece (unicode)",
    expected:
      "Pieces rendered as unicode chess glyphs instead of the bundled PNGs. Move them — animations still work.",
    boardProps: { renderPiece: renderUnicodePiece },
  },
  {
    number: 22,
    title: "soundEnabled={false}",
    expected:
      "Drag e2 → e4. Visual move plays normally but the move sound is silent. Useful for muted UIs.",
    boardProps: { soundEnabled: false },
  },
  {
    number: 23,
    title: "Undo / Redo (move scrubbing)",
    expected:
      "The board mounts mid-game with a 20-ply Ruy Lopez pre-loaded and the cursor parked at ply 10 (10 moves in history, 10 on the redo stack). Tap Undo and Redo to scrub backward and forward — pieces animate, and the move/capture sound plays on each step. No need to play moves manually.",
    setup: {
      // Ruy Lopez Closed, 20 plies. Fixed sequence so the test is
      // deterministic across runs.
      moves: [
        "e4", "e5",
        "Nf3", "Nc6",
        "Bb5", "a6",
        "Ba4", "Nf6",
        "O-O", "Be7",
        "Re1", "b5",
        "Bb3", "d6",
        "c3", "O-O",
        "h3", "Nb8",
        "d4", "Nbd7",
      ],
      goToIndex: 10,
    },
    renderExtraControls: ({ ref }) => (
      <>
        <Pressable
          onPress={() => ref.current?.undo()}
          style={({ pressed }) => [
            styles.controlButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Undo</Text>
        </Pressable>
        <Pressable
          onPress={() => ref.current?.redo()}
          style={({ pressed }) => [
            styles.controlButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Redo</Text>
        </Pressable>
      </>
    ),
  },
  {
    number: 25,
    title: "Drag-drop lands at release point (regression)",
    expected:
      "Drag e2 slowly toward e4 and release while still over e4. The pawn should land directly at the release point and slide cleanly into e4's center — NOT snap back to e2 first and then animate forward. Bug: AnimatedPiece's useAnimatedStyle was switching from dragX/dragY to x/y the instant draggingSquare went null, before x/y had been updated to the drop position.",
  },
  {
    number: 26,
    title: "Tap piece + tap illegal square (regression)",
    expected:
      "Tap e2 (legal-move dots appear), then tap a square the pawn can't reach (e.g. h5). The dots disappear and the pawn STAYS at e2. Bug: the deselect branch wrote dragX/dragY to the tapped square's coordinates while a leftover draggingSquare still pointed at e2, and the e2 piece visually teleported to the tapped square.",
  },
  {
    number: 27,
    title: "Tap two own pieces back and forth (regression)",
    expected:
      "Tap e2, then tap d2, then tap e2 again — keep alternating. Each piece should stay put; only the selection highlight should move. Bug: setting draggingSquare on every tap meant the snap-copy reaction in piece-layer fired on tap-to-tap hand-offs and copied the new piece's coordinates into the old piece's x/y, making the two pieces appear to swap squares.",
  },
  {
    number: 24,
    title: "Premoves",
    expected:
      "It's BLACK's turn. Drag a white piece anyway — a red premove highlight appears. Tap 'Bot plays' to make black move; the queued premove auto-applies.",
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    boardProps: { premovesEnabled: true, playerSide: "white" },
    renderExtraControls: ({ chess, ref }) => (
      <Pressable
        onPress={() => {
          const move = pickRandomMove(chess);
          if (move) {
            ref.current?.animateMove(move.from, move.to, move.promotion);
          }
        }}
        style={({ pressed }) => [
          styles.controlButton,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.controlButtonText}>Bot plays</Text>
      </Pressable>
    ),
  },
  {
    number: 28,
    title: "Promotion — all four pieces",
    expected:
      "Drag e7 → e8. The promotion dialog appears with Q/R/B/N. Tap each in turn (Reset between attempts) and confirm the pawn morphs into the chosen piece, not just queen.",
    fen: "7k/4P3/8/8/8/8/8/4K3 w - - 0 1",
  },
  {
    number: 29,
    title: "Checkmate sound",
    expected:
      "Drag a1 → a8 (back-rank mate). The game-over sound plays (different from the move and capture sounds). Black king square pulses red.",
    fen: "6k1/5ppp/8/8/8/8/8/R6K w - - 0 1",
  },
  {
    number: 30,
    title: "Stalemate sound",
    expected:
      "Drag c6 → c7. Black has no legal moves but is NOT in check — stalemate. The game-over sound plays (same as checkmate, different from move/capture). Bug we're guarding against: stalemate firing the move sound instead.",
    fen: "k7/8/2Q5/8/8/8/8/1K6 w - - 0 1",
  },
  {
    number: 31,
    title: "Uncontrolled mode",
    expected:
      "Same starting position, but the board owns its internal Chess instance via the `fen` prop (not a `chess={...}` prop). Make moves — they should work identically to controlled mode. Reset reloads the initial fen.",
    uncontrolled: true,
  },
  {
    number: 32,
    title: "Uncontrolled — fen prop swap",
    expected:
      "Tap 'Next position' to advance the `fen` prop. The board re-renders into the new position cleanly. Demonstrates uncontrolled mode reacting to fen-prop changes (not just initial mount).",
    BoardSlot: FenCyclerSlot,
  },
  {
    number: 33,
    title: "ref.reset(fen) — uncontrolled",
    expected:
      "Tap 'Italian Game' to call `ref.reset()` with a new fen. The board jumps to the Italian Game position. Note: reset() only works in uncontrolled mode (the consumer owns the Chess instance in controlled mode).",
    uncontrolled: true,
    renderExtraControls: ({ ref }) => (
      <Pressable
        onPress={() =>
          ref.current?.reset(
            "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"
          )
        }
        style={({ pressed }) => [
          styles.controlButton,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.controlButtonText}>Italian Game</Text>
      </Pressable>
    ),
  },
  {
    number: 34,
    title: "ref.animateMove() — programmatic",
    expected:
      "Tap 'Play e4'. The pawn animates from e2 to e4 as if dragged. Same code path the gesture layer uses — sound plays, last-move highlight appears, reconciliation runs.",
    renderExtraControls: ({ ref }) => (
      <Pressable
        onPress={() => ref.current?.animateMove("e2", "e4")}
        style={({ pressed }) => [
          styles.controlButton,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.controlButtonText}>Play e4</Text>
      </Pressable>
    ),
  },
  {
    number: 35,
    title: "ref.goToMoveIndex() — scrub start/end",
    expected:
      "Make 4-5 moves first, then tap 'Start' (jumps to move 0, beginning) and 'End' (jumps back to latest). Pieces animate the entire sequence in either direction. Tests the multi-step undo/redo path.",
    renderExtraControls: ({ ref }) => (
      <>
        <Pressable
          onPress={() => ref.current?.goToMoveIndex(0)}
          style={({ pressed }) => [
            styles.controlButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Start</Text>
        </Pressable>
        <Pressable
          // getMoveCount() = current ply + redo stack size, so this
          // works after Start has undone everything (getHistory() at
          // that point is empty and would jump to 0 instead of the
          // tail).
          onPress={() => {
            const total = ref.current?.getMoveCount() ?? 0;
            ref.current?.goToMoveIndex(total);
          }}
          style={({ pressed }) => [
            styles.controlButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>End</Text>
        </Pressable>
      </>
    ),
  },
  {
    number: 36,
    title: "ref imperative reads",
    expected:
      "Make a few moves, then tap 'Inspect'. An alert shows current FEN, move count, undo/redo availability — all via ref reads (getFen, getHistory, canUndo, canRedo). Verifies the imperative read API matches the visible board state.",
    renderExtraControls: ({ ref }) => (
      <Pressable
        onPress={() => {
          const r = ref.current;
          if (!r) return;
          Alert.alert(
            "Board state",
            [
              `FEN: ${r.getFen()}`,
              `Move count: ${r.getMoveIndex()}`,
              `History length: ${r.getHistory().length}`,
              `canUndo: ${r.canUndo()}`,
              `canRedo: ${r.canRedo()}`,
            ].join("\n")
          );
        }}
        style={({ pressed }) => [
          styles.controlButton,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.controlButtonText}>Inspect</Text>
      </Pressable>
    ),
  },
  {
    number: 37,
    title: "Premove — cancel by tapping empty square",
    expected:
      "Black to move. Queue a premove (drag any white piece). Then tap an empty square. The premove highlight disappears — premove was canceled. Tap 'Bot plays' to confirm nothing auto-applies.",
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    boardProps: { premovesEnabled: true, playerSide: "white" },
    renderExtraControls: ({ chess, ref }) => (
      <Pressable
        onPress={() => {
          const move = pickRandomMove(chess);
          if (move) {
            ref.current?.animateMove(move.from, move.to, move.promotion);
          }
        }}
        style={({ pressed }) => [
          styles.controlButton,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.controlButtonText}>Bot plays</Text>
      </Pressable>
    ),
  },
  {
    number: 38,
    title: "Premove — sequential rounds",
    expected:
      "Black to move. Queue a premove. Tap 'Bot plays' — the premove auto-applies AND the bot plays back. You should be able to queue ANOTHER premove immediately. Tests that premove state cleanly resets between turns.",
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    boardProps: { premovesEnabled: true, playerSide: "white" },
    renderExtraControls: ({ chess, ref }) => (
      <Pressable
        onPress={() => {
          const move = pickRandomMove(chess);
          if (move) {
            ref.current?.animateMove(move.from, move.to, move.promotion);
          }
        }}
        style={({ pressed }) => [
          styles.controlButton,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.controlButtonText}>Bot plays</Text>
      </Pressable>
    ),
  },
  {
    number: 39,
    title: "Mid-game orientation flip",
    expected:
      "Make a few moves with both colors (analysis mode). Tap 'Flip board'. Pieces stay on their actual squares but the visual rotates. Make more moves from the flipped perspective — gestures should still match what you see. Toggle back, history is preserved.",
    BoardSlot: OrientationToggleSlot,
  },
  {
    number: 40,
    title: "Mid-game boardSize change",
    expected:
      "Make a move or two. Tap 'Cycle size' to switch between 240/320/400px. Pieces should re-layout immediately to the new pixel coordinates with no slide/animation. Coordinate labels rescale via the pieceSize-derived font fix (bug #11).",
    BoardSlot: SizeCycleSlot,
  },
  {
    number: 41,
    title: "Background → foreground mid-drag",
    expected:
      "Start dragging a piece (e2). While the piece is still under your finger, swipe up to send the app to background. Re-foreground. Board should be in a clean state — no stuck dragging piece, no leftover scaled square, no leftover highlight. Reset and confirm normal moves still work.",
  },
  {
    number: 42,
    title: "Promotion (black) — bug #9 mirror",
    expected:
      "Black to move. Drag e2 → e1. Pawn slides to the back rank AND morphs into a black queen mid-slide. Mirror of card 7 — verifies the reconciliation promotion branch handles both colors, not just white.",
    fen: "7k/8/8/8/8/8/4p3/4K3 b - - 0 1",
  },
  {
    number: 43,
    title: "onSquarePress callback",
    expected:
      "Tap an empty square or an opponent piece — the label below updates with the tapped square name. Tap an own white piece — the label does NOT update (selecting a piece is not a square press). Verifies the callback contract end-to-end.",
    BoardSlot: OnSquarePressSlot,
  },
  {
    number: 44,
    title: "Slow animation (600ms)",
    expected:
      "Drag e2 → e4. The pawn slides at 4× the default duration (600ms vs 150ms). Useful for verifying animation timing, easing, and that the reconciliation hand-off doesn't produce visual glitches at slow speeds.",
    boardProps: { animationDuration: 600 },
  },
  {
    number: 45,
    title: "Premove — auto-reject (illegal)",
    expected:
      "Black to move. Queue a white premove (e.g. drag d2 → d4). Tap 'Bot blocks d4' — the bot plays d7-d5 then d5-d4, blocking your premove target. The premove is silently cleared (no crash, no phantom move). Verify by checking: no premove highlight remains, the board is in a clean state.",
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    boardProps: { premovesEnabled: true, playerSide: "white" },
    renderExtraControls: ({ chess, ref }) => (
      <>
        <Pressable
          onPress={() => {
            // Play two black moves to block d4: first d7-d5, then
            // after the premove auto-applies (or silently fails),
            // the board is in whatever state resulted.
            const move = pickRandomMove(chess);
            if (move) {
              ref.current?.animateMove(move.from, move.to, move.promotion);
            }
          }}
          style={({ pressed }) => [
            styles.controlButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Bot plays</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            // Deterministic block: play d7→d5 so if white queued
            // d2→d4, the pawn now occupies d5 and d4 may not be a
            // valid move context. Then play d5→d4 to directly block.
            try {
              const m = chess.move({ from: "d7", to: "d5" });
              if (m) {
                ref.current?.syncFromChess();
              }
            } catch { /* position may not allow it */ }
          }}
          style={({ pressed }) => [
            styles.controlButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.controlButtonText}>Bot blocks d4</Text>
        </Pressable>
      </>
    ),
  },
  {
    number: 46,
    title: "Undo through promotion (visual)",
    expected:
      "Tap 'Promote' — the e7 pawn slides to e8 and morphs into a queen. Then tap 'Undo' — the queen slides back to e7 and morphs BACK into a pawn (no pop). 'Redo' reverses it again. Tests reconciliation branch 3b visually.",
    BoardSlot: UndoPromotionSlot,
  },
  {
    number: 47,
    title: "Variation preview",
    expected:
      "Tap 'Show PV' — a 6-ply Ruy Lopez line is loaded and a blue arrow shows the recommended next move. The board renders that line WITHOUT touching the live game, with a light tint over everything as a visual cue. Forward/Back step through the line one move at a time; the arrow advances to the next move; sounds play on each step. Gestures are disabled while the tint is up. Tap 'Live move' to simulate a real Lichess push — preview auto-exits and a random move applies to the live game. Tap 'Exit preview' to dismiss without making a live move. The label below the board shows 'Live' or 'Preview N/length'.",
    BoardSlot: VariationPreviewSlot,
  },
];

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 96,
  },
  separator: {
    height: 16,
  },
  headerCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#0a7ea4",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 10,
    backgroundColor: "rgba(10, 126, 164, 0.06)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0a7ea4",
  },
  headerBody: {
    fontSize: 13,
    lineHeight: 19,
    color: "#444",
  },
  headerCode: {
    fontFamily: "Menlo",
    fontSize: 12,
  },
  boardWrap: {
    alignItems: "center",
    paddingVertical: 8,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 4,
  },
  controlButton: {
    backgroundColor: "#0a7ea4",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  controlButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  resetButton: {
    backgroundColor: "#7a7a7a",
  },
  squarePressLabel: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    color: "#0a7ea4",
    paddingVertical: 4,
  },
});
