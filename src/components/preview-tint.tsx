import React from "react";
import { View } from "react-native";

interface Props {
  boardSize: number;
  color: string;
}

/**
 * Full-board translucent overlay shown while a variation preview is
 * active. Mounted above the piece + arrow layers and below the
 * legal-move dots and gesture layer; `pointerEvents` is none so it
 * never blocks input (gestures are also disabled at the layer above
 * via `gestureEnabled`).
 *
 * Conditionally rendered by Chessboard.tsx — when no preview is active
 * the component is unmounted entirely, so there's no idle render cost.
 */
const PreviewTint = React.memo(function PreviewTint({
  boardSize,
  color,
}: Props) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: boardSize,
        height: boardSize,
        backgroundColor: color,
      }}
    />
  );
});

export default PreviewTint;
