import React, { useCallback } from "react";
import { StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useSharedValue } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import {
  pieceSide,
  squareToXY,
  xyToSquare,
} from "../helpers/square-utils";
import type { PieceType, Player, Square } from "../types";

interface Props {
  boardSize: number;
  flipped: boolean;
  gestureEnabled: boolean;
  playerColor: Player;
  legalMovesMap: SharedValue<Record<string, string[]>>;
  promotionsMap: SharedValue<Record<string, boolean>>;
  pieceMap: SharedValue<Record<string, PieceType>>;
  selectedSquare: SharedValue<string | null>;
  scaledSquare: SharedValue<string | null>;
  draggingSquare: SharedValue<string | null>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  onMoveRequest: (from: string, to: string) => void;
  onPromotionRequest: (from: string, to: string) => void;
  onSquarePress?: (square: Square) => void;
}

export default function GestureLayer({
  boardSize,
  flipped,
  gestureEnabled,
  playerColor,
  legalMovesMap,
  promotionsMap,
  pieceMap,
  selectedSquare,
  scaledSquare,
  draggingSquare,
  dragX,
  dragY,
  onMoveRequest,
  onPromotionRequest,
  onSquarePress,
}: Props) {
  const pieceSize = boardSize / 8;

  // Track the square where the gesture began (for snap-back)
  const originSquare = useSharedValue<string | null>(null);

  const tryMove = useCallback(
    (from: string, to: string) => {
      const key = `${from}${to}`;
      if (promotionsMap.value[key]) {
        onPromotionRequest(from, to);
      } else {
        onMoveRequest(from, to);
      }
    },
    [onMoveRequest, onPromotionRequest, promotionsMap]
  );

  const fireSquarePress = useCallback(
    (sq: string) => {
      onSquarePress?.(sq as Square);
    },
    [onSquarePress]
  );

  const gesture = Gesture.Pan()
    .enabled(gestureEnabled)
    .onBegin((e) => {
      "worklet";
      const sq = xyToSquare(e.x, e.y, pieceSize, flipped);
      const piece = pieceMap.value[sq];
      const prevSelected = selectedSquare.value;

      // Tap on a legal target of the selected piece → move
      if (prevSelected) {
        const targets = legalMovesMap.value[prevSelected];
        if (targets && targets.includes(sq)) {
          selectedSquare.value = null;
          scaledSquare.value = null;
          runOnJS(tryMove)(prevSelected, sq);
          return;
        }
      }

      // Tap on own piece → select it and start drag
      // Bug #12 fix: route the side check through the centralized
      // pieceSide() helper instead of indexing the string directly,
      // so future PieceType encoding changes don't silently break here.
      if (piece && pieceSide(piece) === playerColor) {
        selectedSquare.value = sq;
        scaledSquare.value = sq;
        originSquare.value = sq;
        draggingSquare.value = sq;
        const pos = squareToXY(sq, pieceSize, flipped);
        dragX.value = pos.x;
        dragY.value = pos.y;
        return;
      }

      // Tap on empty / opponent piece → deselect.
      // Also report the square via onSquarePress, which fires only for
      // taps that don't trigger a move or selection (puzzle editors,
      // click-to-arrow, annotation overlays). Selecting a piece is
      // intentionally NOT a square press.
      selectedSquare.value = null;
      scaledSquare.value = null;
      if (onSquarePress) {
        runOnJS(fireSquarePress)(sq);
      }
    })
    .onUpdate((e) => {
      "worklet";
      if (!draggingSquare.value) return;
      dragX.value = e.x - pieceSize / 2;
      dragY.value = e.y - pieceSize / 2;
    })
    .onEnd((e) => {
      "worklet";
      const from = originSquare.value;
      if (!from || !draggingSquare.value) return;

      const toSq = xyToSquare(e.x, e.y, pieceSize, flipped);
      const targets = legalMovesMap.value[from];
      const isLegal = targets && targets.includes(toSq);

      if (isLegal && from !== toSq) {
        // Legal move via drag
        draggingSquare.value = null;
        selectedSquare.value = null;
        scaledSquare.value = null;
        runOnJS(tryMove)(from, toSq);
      } else {
        // Snap back to origin
        const origin = squareToXY(from, pieceSize, flipped);
        dragX.value = origin.x;
        dragY.value = origin.y;
        draggingSquare.value = null;
        scaledSquare.value = null;
        // Keep piece selected for tap-to-move
      }
      originSquare.value = null;
    })
    .onFinalize(() => {
      "worklet";
      // Always shrink on release
      scaledSquare.value = null;
      // Ensure drag state is cleaned up
      if (draggingSquare.value) {
        const from = originSquare.value;
        if (from) {
          const origin = squareToXY(from, pieceSize, flipped);
          dragX.value = origin.x;
          dragY.value = origin.y;
        }
        draggingSquare.value = null;
      }
      originSquare.value = null;
    });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "transparent" },
        ]}
      />
    </GestureDetector>
  );
}
