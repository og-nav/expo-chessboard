import React from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { squareToXY } from "../helpers/square-utils";
import type { BoardColors } from "../types";

interface Props {
  boardSize: number;
  flipped: boolean;
  colors: BoardColors;
  selectedSquare: SharedValue<string | null>;
  lastMoveFrom: SharedValue<string | null>;
  lastMoveTo: SharedValue<string | null>;
  kingInCheck: SharedValue<string | null>;
}

function HighlightSquare({
  squareSV,
  color,
  pieceSize,
  flipped,
}: {
  squareSV: SharedValue<string | null>;
  color: string;
  pieceSize: number;
  flipped: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const sq = squareSV.value;
    if (!sq) return { opacity: 0 };
    const { x, y } = squareToXY(sq, pieceSize, flipped);
    return {
      opacity: 1,
      left: x,
      top: y,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: pieceSize,
          height: pieceSize,
          backgroundColor: color,
        },
        style,
      ]}
      pointerEvents="none"
    />
  );
}

const HighlightLayer = React.memo(function HighlightLayer({
  boardSize,
  flipped,
  colors,
  selectedSquare,
  lastMoveFrom,
  lastMoveTo,
  kingInCheck,
}: Props) {
  const pieceSize = boardSize / 8;

  return (
    <>
      <HighlightSquare
        squareSV={lastMoveFrom}
        color={colors.lastMoveHighlight}
        pieceSize={pieceSize}
        flipped={flipped}
      />
      <HighlightSquare
        squareSV={lastMoveTo}
        color={colors.lastMoveHighlight}
        pieceSize={pieceSize}
        flipped={flipped}
      />
      <HighlightSquare
        squareSV={selectedSquare}
        color={colors.selectedSquare}
        pieceSize={pieceSize}
        flipped={flipped}
      />
      <HighlightSquare
        squareSV={kingInCheck}
        color={colors.checkHighlight}
        pieceSize={pieceSize}
        flipped={flipped}
      />
    </>
  );
});

export default HighlightLayer;
