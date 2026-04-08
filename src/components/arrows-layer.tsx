import React from "react";
import Svg, { Line, Polygon } from "react-native-svg";
import { squareToXY } from "../helpers/square-utils";
import type { Arrow, BoardColors } from "../types";

interface Props {
  boardSize: number;
  flipped: boolean;
  arrows: Arrow[];
  colors: BoardColors;
}

/**
 * Pure-React layer that draws consumer-supplied arrows on top of the
 * board. The whole SVG is `pointerEvents="none"` so arrows never block
 * gestures, even when they pass directly through a piece.
 */
const ArrowsLayer = React.memo(function ArrowsLayer({
  boardSize,
  flipped,
  arrows,
  colors,
}: Props) {
  if (!arrows || arrows.length === 0) return null;
  const pieceSize = boardSize / 8;

  return (
    <Svg
      width={boardSize}
      height={boardSize}
      style={{ position: "absolute", left: 0, top: 0 }}
      pointerEvents="none"
    >
      {arrows.map((arrow, i) => (
        <ArrowShape
          key={`${arrow.from}-${arrow.to}-${i}`}
          arrow={arrow}
          pieceSize={pieceSize}
          flipped={flipped}
          defaultColor={colors.arrow}
        />
      ))}
    </Svg>
  );
});

function ArrowShape({
  arrow,
  pieceSize,
  flipped,
  defaultColor,
}: {
  arrow: Arrow;
  pieceSize: number;
  flipped: boolean;
  defaultColor: string;
}) {
  const from = squareToXY(arrow.from, pieceSize, flipped);
  const to = squareToXY(arrow.to, pieceSize, flipped);
  // Center of square = top-left + half a square.
  const startX = from.x + pieceSize / 2;
  const startY = from.y + pieceSize / 2;
  const endX = to.x + pieceSize / 2;
  const endY = to.y + pieceSize / 2;

  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular unit vector.
  const px = -uy;
  const py = ux;

  const strokeWidth = pieceSize * (arrow.width ?? 0.18);
  const headLen = strokeWidth * 2.2;
  const headHalfWidth = strokeWidth * 1.4;
  // Pull the tip back so the arrow lands inside the destination square,
  // not on its outer edge.
  const tipBackoff = pieceSize * 0.25;
  const tipX = endX - ux * tipBackoff;
  const tipY = endY - uy * tipBackoff;
  // Push the tail forward a bit so the arrow doesn't start dead-center
  // of the source square.
  const tailForward = pieceSize * 0.18;
  const tailX = startX + ux * tailForward;
  const tailY = startY + uy * tailForward;

  // Where the line stops and the arrowhead begins.
  const baseX = tipX - ux * headLen;
  const baseY = tipY - uy * headLen;
  const leftX = baseX + px * headHalfWidth;
  const leftY = baseY + py * headHalfWidth;
  const rightX = baseX - px * headHalfWidth;
  const rightY = baseY - py * headHalfWidth;

  const color = arrow.color ?? defaultColor;

  return (
    <>
      <Line
        x1={tailX}
        y1={tailY}
        x2={baseX}
        y2={baseY}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Polygon
        points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
        fill={color}
      />
    </>
  );
}

export default ArrowsLayer;
