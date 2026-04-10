import {
  Chessboard,
  STARTING_FEN,
  type ChessboardProps,
  type ChessboardRef,
} from "@og-nav/expo-chessboard";
import { Chess } from "chess.ts";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";

export type SmokeCardProps = {
  number: number;
  title: string;
  /**
   * Plain-English description of what to do and what to expect.
   */
  expected: string;
  /**
   * FEN to load into the card's Chess instance. Defaults to the
   * standard starting position. Each card owns its own Chess —
   * cards do not share state.
   */
  fen?: string;
  boardSize?: number;
  /**
   * Pass-through to the underlying <Chessboard />. Use this for the
   * customization-related cards (themes, renderPiece, highlights,
   * arrows, soundEnabled, premovesEnabled, etc).
   */
  boardProps?: Omit<ChessboardProps, "boardSize" | "chess" | "ref">;
  /**
   * Optional extra controls (e.g. undo/redo buttons) rendered below
   * the board. Receives the same chess + ref the board is using so
   * the controls can drive the board imperatively. Ignored when
   * `BoardSlot` is set (the slot is responsible for its own controls).
   */
  renderExtraControls?: (args: {
    chess: Chess;
    ref: React.RefObject<ChessboardRef | null>;
  }) => ReactNode;
  /**
   * Render the Chessboard in uncontrolled mode (the board owns its
   * internal Chess instance). The card's `fen` prop is forwarded as
   * the initial FEN, and the smoke-card-level chess instance is
   * created but unused. Mutually exclusive with `BoardSlot`.
   */
  uncontrolled?: boolean;
  /**
   * Render a "Flip" button next to Reset that toggles
   * `boardOrientation` between white and black. Useful for verifying
   * that overlays (arrows, external highlights) and gestures still
   * line up after a mid-card flip. Honors `boardProps.boardOrientation`
   * as the initial orientation if set.
   */
  withFlipButton?: boolean;
  /**
   * Pre-populate the card's chess instance with a fixed sequence of
   * SAN moves on mount, then optionally rewind to `goToIndex`. Used by
   * the undo/redo card to land mid-game so the user doesn't have to
   * play 20 moves manually before testing the redo stack. Controlled
   * mode only — the setup is replayed on Reset.
   */
  setup?: {
    moves: string[];
    /**
     * After applying setup.moves, call ref.goToMoveIndex(n) so the
     * remaining moves end up on the redo stack and both Undo + Redo
     * are immediately testable.
     */
    goToIndex?: number;
  };
  /**
   * Fully custom interactive area. When set, replaces the default
   * Chessboard + controls render entirely. Use this when the card
   * needs local state that lives between renders (mid-game
   * orientation flip, board-size cycling, fen-prop cycling, etc) —
   * none of which renderExtraControls can express because it's just
   * a function called during the parent render.
   */
  BoardSlot?: ComponentType<{ size: number; onReset: () => void }>;
};

/**
 * One smoke-test card. The outer SmokeCard owns a `resetKey` and uses
 * it as the React `key` on an inner component, so a Reset button just
 * remounts the inner. The inner instantiates Chess once via useState
 * and never refreshes it — the reset path is purely "bump key →
 * remount → fresh useState" instead of fighting React with a useMemo
 * dependency the lint rule (correctly) doesn't understand.
 *
 * Wrapped in memo so FlatList can skip re-rendering visible cards on
 * scroll updates. The card config objects in smoke/index.tsx live at
 * module scope, so their identity is stable and shallow prop equality
 * works — without memo, every scroll tick was re-rendering all five
 * windowed cards (each ~32 AnimatedPiece children) and the JS thread
 * couldn't keep up.
 */
export const SmokeCard = memo(function SmokeCard(props: SmokeCardProps) {
  const [resetKey, setResetKey] = useState(0);
  return (
    <SmokeCardBoard
      // Embed `fen` in the key so a fen prop change ALSO remounts the
      // inner — avoids the "useState ignores prop changes after mount"
      // footgun for cards that ever swap their starting position.
      key={`${props.fen ?? "start"}::${resetKey}`}
      {...props}
      onReset={() => setResetKey((n) => n + 1)}
    />
  );
});

type SmokeCardBoardProps = SmokeCardProps & { onReset: () => void };

function SmokeCardBoard({
  number,
  title,
  expected,
  fen,
  boardSize,
  boardProps,
  renderExtraControls,
  uncontrolled,
  withFlipButton,
  setup,
  BoardSlot,
  onReset,
}: SmokeCardBoardProps) {
  // When the caller doesn't pin a size, fill the card's inner width:
  // screen width minus the BodyScrollView container padding (16+16)
  // and the card's own padding (16+16). Capped on tablets so the
  // board doesn't get gigantic.
  const { width: windowWidth } = useWindowDimensions();
  const fillWidth = Math.min(windowWidth - 64, 480);
  const effectiveBoardSize = boardSize ?? fillWidth;

  const cardBg = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const subText = useThemeColor({}, "icon");
  const borderColor = useThemeColor(
    { light: "#e0e0e0", dark: "#2a2a2a" },
    "icon"
  );

  // useState initializer captures fen exactly once at mount. Reset
  // takes the imperative path (chess.load + ref.reset) so the
  // reconciliation diff animates pieces back to their starting squares
  // — remounting works but snaps, which feels broken next to the
  // smooth fen-swap animation in the FenCycler card.
  //
  // If `setup.moves` is provided, replay them on the chess instance
  // here so the board mounts with history already populated. The
  // matching `setup.goToIndex` rewind happens in a useEffect below
  // (it has to go through the ref so the Chessboard's internal
  // redoStackRef gets populated, not just chess.history()).
  const [chess] = useState(() => {
    const c = new Chess(fen);
    if (setup?.moves) {
      for (const san of setup.moves) {
        try {
          c.move(san);
        } catch {
          // Ignore — bad SAN in a smoke-card setup is loud enough to
          // catch in dev because pieces will be in the wrong place.
        }
      }
    }
    return c;
  });
  const ref = useRef<ChessboardRef>(null);

  // After mount, jump to the requested move index. goToMoveIndex pushes
  // the popped moves onto the Chessboard's internal redoStackRef so
  // both Undo and Redo are immediately testable from a midpoint. Runs
  // once per mount because card config objects in smoke/index.tsx live
  // at module scope (stable identity); Reset bumps the outer key and
  // remounts, which re-runs this effect with the freshly-replayed
  // setup.
  const setupGoToIndex = setup?.goToIndex;
  useEffect(() => {
    if (setupGoToIndex != null) {
      ref.current?.goToMoveIndex(setupGoToIndex);
    }
  }, [setupGoToIndex]);

  // Local orientation state for cards that opt into a Flip button.
  // Initialized from the static boardProps.boardOrientation if the
  // card pre-set one (e.g. card 12), otherwise white. Only matters
  // when `withFlipButton` is true; ignored otherwise.
  const [orientation, setOrientation] = useState<"white" | "black">(
    boardProps?.boardOrientation ?? "white"
  );

  const handleReset = useCallback(() => {
    if (uncontrolled) {
      // Uncontrolled mode: ref.reset() does the chess.load() itself.
      ref.current?.reset(fen);
    } else {
      // Controlled mode: we own `chess`, so reload it ourselves and
      // then call ref.reset() to clear premove + redo stack and
      // re-sync. The reconciliation pass animates pieces back.
      chess.load(fen ?? STARTING_FEN);
      // Replay any setup moves so Reset returns to the same starting
      // state the card mounted in (e.g. card 23's pre-played 20 moves).
      if (setup?.moves) {
        for (const san of setup.moves) {
          try {
            chess.move(san);
          } catch {
            // See note in the chess useState initializer.
          }
        }
      }
      ref.current?.reset();
      // ref.reset() clears the redo stack, so re-run the goToIndex
      // hop to repopulate it from the freshly-replayed history.
      if (setup?.goToIndex != null) {
        ref.current?.goToMoveIndex(setup.goToIndex);
      }
    }
    if (withFlipButton) {
      setOrientation(boardProps?.boardOrientation ?? "white");
    }
  }, [
    uncontrolled,
    fen,
    chess,
    setup,
    withFlipButton,
    boardProps?.boardOrientation,
  ]);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: cardBg, borderColor },
      ]}
    >
      <Text style={[styles.title, { color: textColor }]}>
        {number}. {title}
      </Text>
      <Text style={[styles.expected, { color: subText }]}>{expected}</Text>

      {BoardSlot ? (
        <BoardSlot size={effectiveBoardSize} onReset={onReset} />
      ) : (
        <>
          <View style={styles.boardWrap}>
            <Chessboard
              ref={ref}
              boardSize={effectiveBoardSize}
              {...(uncontrolled ? { fen } : { chess })}
              {...boardProps}
              {...(withFlipButton ? { boardOrientation: orientation } : {})}
            />
          </View>

          <View style={styles.controls}>
            {withFlipButton && (
              <Pressable
                onPress={() =>
                  setOrientation((o) => (o === "white" ? "black" : "white"))
                }
                style={({ pressed }) => [
                  styles.button,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.buttonText}>Flip</Text>
              </Pressable>
            )}
            {renderExtraControls?.({ chess, ref })}
            <Pressable
              onPress={handleReset}
              style={({ pressed }) => [
                styles.button,
                styles.resetButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.buttonText}>Reset</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  expected: {
    fontSize: 14,
    lineHeight: 20,
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
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#0a7ea4",
  },
  resetButton: {
    backgroundColor: "#7a7a7a",
  },
  buttonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});
