import {
  Chessboard,
  type ChessboardProps,
  type ChessboardRef,
} from "@og-nav/expo-chessboard";
import { Chess } from "chess.ts";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
   * the controls can drive the board imperatively.
   */
  renderExtraControls?: (args: {
    chess: Chess;
    ref: React.RefObject<ChessboardRef | null>;
  }) => ReactNode;
};

/**
 * One smoke-test card. The outer SmokeCard owns a `resetKey` and uses
 * it as the React `key` on an inner component, so a Reset button just
 * remounts the inner. The inner instantiates Chess once via useState
 * and never refreshes it — the reset path is purely "bump key →
 * remount → fresh useState" instead of fighting React with a useMemo
 * dependency the lint rule (correctly) doesn't understand.
 */
export function SmokeCard(props: SmokeCardProps) {
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
}

type SmokeCardBoardProps = SmokeCardProps & { onReset: () => void };

function SmokeCardBoard({
  number,
  title,
  expected,
  fen,
  boardSize = 280,
  boardProps,
  renderExtraControls,
  onReset,
}: SmokeCardBoardProps) {
  const cardBg = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const subText = useThemeColor({}, "icon");
  const borderColor = useThemeColor(
    { light: "#e0e0e0", dark: "#2a2a2a" },
    "icon"
  );

  // useState initializer captures fen exactly once at mount. Reset is
  // handled by the outer wrapper remounting this whole component.
  const [chess] = useState(() => new Chess(fen));
  const ref = useRef<ChessboardRef>(null);

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

      <View style={styles.boardWrap}>
        <Chessboard
          ref={ref}
          chess={chess}
          boardSize={boardSize}
          {...boardProps}
        />
      </View>

      <View style={styles.controls}>
        {renderExtraControls?.({ chess, ref })}
        <Pressable
          onPress={onReset}
          style={({ pressed }) => [
            styles.button,
            styles.resetButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.buttonText}>Reset</Text>
        </Pressable>
      </View>
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
