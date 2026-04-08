import React from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { ALL_SQUARES, squareToXY } from "../helpers/square-utils";
import type { PieceType } from "../types";

interface Props {
  boardSize: number;
  flipped: boolean;
  dotColor: string;
  selectedSquare: SharedValue<string | null>;
  legalMovesMap: SharedValue<Record<string, string[]>>;
  pieceMap: SharedValue<Record<string, PieceType>>;
}

/**
 * One dot per square on the board. Only visible when the square is a
 * legal target of the currently selected piece. This uses 64 animated
 * views but each one is trivially cheap (no gesture handler, no refs).
 */
function Dot({
  square,
  pieceSize,
  flipped,
  dotColor,
  selectedSquare,
  legalMovesMap,
  pieceMap,
}: {
  square: string;
  pieceSize: number;
  flipped: boolean;
  dotColor: string;
  selectedSquare: SharedValue<string | null>;
  legalMovesMap: SharedValue<Record<string, string[]>>;
  pieceMap: SharedValue<Record<string, PieceType>>;
}) {
  const { x, y } = squareToXY(square, pieceSize, flipped);

  // Fully reactive: both visibility AND capture styling computed on UI thread
  const dotStyle = useAnimatedStyle(() => {
    const sel = selectedSquare.value;
    if (!sel) return { opacity: 0, width: 0, height: 0 };
    const targets = legalMovesMap.value[sel];
    if (!targets || !targets.includes(square))
      return { opacity: 0, width: 0, height: 0 };

    const isCapture = !!pieceMap.value[square];
    if (isCapture) {
      return {
        opacity: 1,
        width: pieceSize * 0.85,
        height: pieceSize * 0.85,
        borderRadius: pieceSize * 0.425,
        borderWidth: pieceSize * 0.08,
        borderColor: dotColor,
        backgroundColor: "transparent",
      };
    }
    return {
      opacity: 1,
      width: pieceSize * 0.3,
      height: pieceSize * 0.3,
      borderRadius: pieceSize * 0.15,
      borderWidth: 0,
      borderColor: "transparent",
      backgroundColor: dotColor,
    };
  });

  return (
    <View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: pieceSize,
        height: pieceSize,
        justifyContent: "center",
        alignItems: "center",
      }}
      pointerEvents="none"
    >
      <Animated.View style={dotStyle} />
    </View>
  );
}

const LegalMoveDots = React.memo(function LegalMoveDots({
  boardSize,
  flipped,
  dotColor,
  selectedSquare,
  legalMovesMap,
  pieceMap,
}: Props) {
  const pieceSize = boardSize / 8;

  return (
    <>
      {ALL_SQUARES.map((sq) => (
        <Dot
          key={sq}
          square={sq}
          pieceSize={pieceSize}
          flipped={flipped}
          dotColor={dotColor}
          selectedSquare={selectedSquare}
          legalMovesMap={legalMovesMap}
          pieceMap={pieceMap}
        />
      ))}
    </>
  );
});

export default LegalMoveDots;
