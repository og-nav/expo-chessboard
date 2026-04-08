import {
  THEME_BLUE,
  THEME_GREEN,
  THEME_WOOD,
  type PieceType,
} from "@og-nav/expo-chessboard";
import { Pressable, StyleSheet, Text } from "react-native";

import { BodyScrollView } from "@/components/body-scroll-view";
import { SmokeCard } from "@/components/smoke-card";
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
 */
export default function SmokeScreen() {
  return (
    <BodyScrollView contentContainerStyle={styles.container}>
      <SmokeCard
        number={1}
        title="Pawn move (drag)"
        expected="Drag e2 → e4. The pawn slides smoothly into place. Move sound plays at the end of the slide."
      />

      <SmokeCard
        number={2}
        title="Pawn move (tap-tap)"
        expected="Tap e2 (legal-move dots appear), then tap e4. Same animation as drag."
      />

      <SmokeCard
        number={3}
        title="Capture sound"
        expected="Drag d4 → e5. Capture sound plays (different from move sound), captured pawn vanishes cleanly."
        fen="rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1"
      />

      <SmokeCard
        number={4}
        title="Kingside castling"
        expected="Drag king e1 → g1. BOTH the king and the h1 rook animate to their castled squares — neither pops."
        fen="rnbq1rk1/ppppbppp/5n2/4p3/4P3/5N2/PPPPBPPP/RNBQK2R w KQ - 0 1"
      />

      <SmokeCard
        number={5}
        title="Queenside castling"
        expected="Drag king e1 → c1. King AND a1 rook both animate. The d1 square is reached by the rook, not skipped."
        fen="r3kbnr/pppqpppp/2np4/8/8/2NPB3/PPPQPPPP/R3KBNR w KQkq - 0 1"
      />

      <SmokeCard
        number={6}
        title="En passant"
        expected="Drag e5 × f6. Captured pawn on f5 disappears, capturing pawn lands on f6. Capture sound plays."
        fen="rnbqkbnr/ppp1p1pp/3p4/4Pp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3"
      />

      <SmokeCard
        number={7}
        title="Promotion — bug #9 fix"
        expected="Drag e7 → e8. Pawn slides to the back rank AND morphs into a queen mid-slide. No pop, no flicker."
        fen="k7/4P3/8/8/8/8/8/7K w - - 0 1"
      />

      <SmokeCard
        number={8}
        title="Capture-promotion"
        expected="Drag d7 × c8. The pawn slides diagonally onto the bishop's square and morphs to a queen. Capture sound."
        fen="2b4k/3P4/8/8/8/8/8/7K w - - 0 1"
      />

      <SmokeCard
        number={9}
        title="Legal-move dots"
        expected="Tap any white piece. Dots appear on every legal target square. Tap again to deselect."
      />

      <SmokeCard
        number={10}
        title="Check highlight"
        expected="Drag rook d2 → d8. Black king square pulses red — the in-check highlight."
        fen="4k3/8/8/8/8/8/3R4/4K3 w - - 0 1"
      />

      <SmokeCard
        number={11}
        title="Last-move highlight"
        expected="Drag e2 → e4. Both e2 and e4 stay tinted yellow after the move completes."
      />

      <SmokeCard
        number={12}
        title="boardOrientation='black' (visual flip)"
        expected="Board is flipped — h1 is top-right, a8 is bottom-left. Coordinates and gestures still match."
        boardProps={{ boardOrientation: "black" }}
      />

      <SmokeCard
        number={13}
        title="playerSide='both' (analysis mode)"
        expected="You can drag both white AND black pieces. Useful for puzzle editors and review screens."
        boardProps={{ playerSide: "both" }}
      />

      <SmokeCard
        number={14}
        title="showCoordinates={false}"
        expected="No file letters or rank numbers in the corners. Useful for puzzle preview cards or screenshots."
        boardProps={{ showCoordinates: false }}
      />

      <SmokeCard
        number={15}
        title="Theme: WOOD"
        expected="Warm-brown squares. Same board, different palette via the colors prop."
        boardProps={{ colors: THEME_WOOD }}
      />

      <SmokeCard
        number={16}
        title="Theme: BLUE (chess.com style)"
        expected="Blue / off-white squares."
        boardProps={{ colors: THEME_BLUE }}
      />

      <SmokeCard
        number={17}
        title="Theme: GREEN (lichess style)"
        expected="Green / cream squares."
        boardProps={{ colors: THEME_GREEN }}
      />

      <SmokeCard
        number={18}
        title="External highlight — ring"
        expected="e4 has a colored ring overlay. Try dragging through it — the ring is non-interactive (pointerEvents='none')."
        boardProps={{
          highlightedSquares: [{ square: "e4", type: "ring" }],
        }}
      />

      <SmokeCard
        number={19}
        title="External highlight — fill"
        expected="d5 is filled with a translucent color. Same non-interactive overlay layer."
        boardProps={{
          highlightedSquares: [{ square: "d5", type: "fill" }],
        }}
      />

      <SmokeCard
        number={20}
        title="Arrows"
        expected="Two arrows drawn in SVG: e2→e4 and g1→f3. Survives board flips."
        boardProps={{
          arrows: [
            { from: "e2", to: "e4" },
            { from: "g1", to: "f3" },
          ],
        }}
      />

      <SmokeCard
        number={21}
        title="renderPiece (unicode)"
        expected="Pieces rendered as unicode chess glyphs instead of the bundled PNGs. Move them — animations still work."
        boardProps={{ renderPiece: renderUnicodePiece }}
      />

      <SmokeCard
        number={22}
        title="soundEnabled={false}"
        expected="Drag e2 → e4. Visual move plays normally but the move sound is silent. Useful for muted UIs."
        boardProps={{ soundEnabled: false }}
      />

      <SmokeCard
        number={23}
        title="Undo / Redo (move scrubbing)"
        expected="Make a few moves, then tap Undo / Redo. Pieces animate backward and forward through history."
        renderExtraControls={({ ref }) => (
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
      />

      <SmokeCard
        number={24}
        title="Premoves"
        expected="It's BLACK's turn. Drag a white piece anyway — a red premove highlight appears. Tap 'Bot plays' to make black move; the queued premove auto-applies."
        fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
        boardProps={{ premovesEnabled: true, playerSide: "white" }}
        renderExtraControls={({ chess, ref }) => (
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
        )}
      />
    </BodyScrollView>
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

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 96,
    gap: 16,
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
});
