import React from "react";
import { View } from "react-native";
import { squareToXY } from "../helpers/square-utils";
import type { BoardColors, SquareHighlight } from "../types";

interface Props {
  boardSize: number;
  flipped: boolean;
  highlights: SquareHighlight[];
  colors: BoardColors;
}

/**
 * Pure-React layer that paints consumer-supplied square highlights.
 * `type: "ring"` draws a transparent square with a colored border;
 * `type: "fill"` paints the whole square. Both ignore pointer events
 * so they never block gestures.
 *
 * This is intentionally separate from the internal `<HighlightLayer />`
 * (which uses Reanimated SharedValues to react to selection / last-move
 * / check) — those need UI-thread reactivity, these are static React
 * props from the consumer.
 */
const ExternalHighlights = React.memo(function ExternalHighlights({
  boardSize,
  flipped,
  highlights,
  colors,
}: Props) {
  if (!highlights || highlights.length === 0) return null;
  const pieceSize = boardSize / 8;

  return (
    <>
      {highlights.map((h, i) => {
        const { x, y } = squareToXY(h.square, pieceSize, flipped);
        const color = h.color ?? colors.externalHighlight;
        const isRing = h.type === "ring";
        return (
          <View
            key={`${h.square}-${i}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: pieceSize,
              height: pieceSize,
              backgroundColor: isRing ? "transparent" : color,
              borderWidth: isRing ? Math.max(2, pieceSize * 0.06) : 0,
              borderColor: isRing ? color : "transparent",
            }}
          />
        );
      })}
    </>
  );
});

export default ExternalHighlights;
