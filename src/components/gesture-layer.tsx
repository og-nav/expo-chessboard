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
  isPremoveMode: boolean;
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
  isPremoveMode,
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

      // Tap on own piece → select it. Bug #12 fix: route the side
      // check through the centralized pieceSide() helper instead of
      // indexing the string directly, so future PieceType encoding
      // changes don't silently break here.
      //
      // We do NOT set draggingSquare here. draggingSquare is what
      // makes a piece's useAnimatedStyle read dragX/dragY instead of
      // its own x/y, and we only want that to happen when the user
      // is actually dragging — not on a pure tap. Setting
      // draggingSquare on every tap caused two visual bugs:
      //   1. Tap piece A, tap an illegal square → piece A appeared
      //      to teleport to the tapped square (the deselect branch
      //      wrote dragX/dragY = tapped square's pos and piece A
      //      was still reading them via a leftover draggingSquare).
      //   2. Tap piece A, tap own piece B → pieces visually swapped
      //      because the snap-copy reaction in piece-layer fired on
      //      the hand-off and copied the new piece's coordinates
      //      into the old piece's x/y.
      // Deferring draggingSquare to onUpdate (first real drag
      // movement) eliminates both — on a pure tap nothing reads
      // dragX/dragY at all.
      if (piece && pieceSide(piece) === playerColor) {
        originSquare.value = sq;
        selectedSquare.value = sq;
        scaledSquare.value = sq;
        return;
      }

      // Tap on empty / opponent piece → deselect. Don't touch
      // dragX/dragY here; they're only meaningful while a piece is
      // actively being dragged.
      //
      // Also report the square via onSquarePress, which fires only
      // for taps that don't trigger a move or selection (puzzle
      // editors, click-to-arrow, annotation overlays). Selecting a
      // piece is intentionally NOT a square press.
      selectedSquare.value = null;
      scaledSquare.value = null;
      if (onSquarePress) {
        runOnJS(fireSquarePress)(sq);
      }
    })
    .onUpdate((e) => {
      "worklet";
      const orig = originSquare.value;
      if (!orig) return;
      // Promote tap → drag on first movement. Write dragX/dragY
      // BEFORE flipping draggingSquare so the piece's
      // useAnimatedStyle reads the new finger position immediately
      // instead of stale coordinates from a previous drag.
      dragX.value = e.x - pieceSize / 2;
      dragY.value = e.y - pieceSize / 2;
      if (!draggingSquare.value) {
        draggingSquare.value = orig;
      }
    })
    .onEnd((e) => {
      "worklet";
      const from = originSquare.value;
      if (!from || !draggingSquare.value) return;

      const toSq = xyToSquare(e.x, e.y, pieceSize, flipped);
      const targets = legalMovesMap.value[from];
      const isLegal = targets && targets.includes(toSq);

      if (isLegal && from !== toSq) {
        // Legal move via drag. For premoves, snap dragX/dragY to
        // origin BEFORE clearing draggingSquare so the handoff
        // reaction in piece-layer copies origin coordinates into x/y
        // — the piece returns to its square instead of staying
        // stranded at the drop position (no actual chess move
        // happens, so pieceMap won't change to fix it).
        if (isPremoveMode) {
          const origin = squareToXY(from, pieceSize, flipped);
          dragX.value = origin.x;
          dragY.value = origin.y;
        }
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
