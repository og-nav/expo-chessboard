import React, { useEffect, useRef } from "react";
import { Image, type ImageSourcePropType } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { DEFAULT_PIECES } from "../constants";
import { squareToXY } from "../helpers/square-utils";
import {
  createReconcileState,
  reconcilePieces,
  type ReconcileState,
} from "../helpers/reconcile-pieces";
import type { PieceType } from "../types";

interface Props {
  boardSize: number;
  flipped: boolean;
  animationDuration: number;
  // Plain React state, NOT a SharedValue. Reanimated v4 makes
  // `.value` reads during JS render unsafe (stale snapshots), so the
  // Chessboard parent mirrors its pieceMap shared value into a React
  // state and passes the state here. The shared value still exists
  // for the gesture-layer (worklets, UI thread).
  pieceMap: Record<string, PieceType>;
  syncVersion: number;
  scaledSquare: SharedValue<string | null>;
  draggingSquare: SharedValue<string | null>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  pieces?: Partial<Record<PieceType, ImageSourcePropType>>;
  renderPiece?: (
    piece: PieceType,
    size: number
  ) => React.ReactElement | null;
}

/**
 * A single animated piece. Animates to its target square.
 * When it's the piece being dragged, follows drag position instead.
 * Grows smoothly on press/select, shrinks on deselect.
 */
const AnimatedPiece = React.memo(function AnimatedPiece({
  piece,
  square,
  pieceSize,
  flipped,
  animDuration,
  scaledSquare,
  draggingSquare,
  dragX,
  dragY,
  pieces,
  renderPiece,
}: {
  piece: PieceType;
  square: string;
  pieceSize: number;
  flipped: boolean;
  animDuration: number;
  scaledSquare: SharedValue<string | null>;
  draggingSquare: SharedValue<string | null>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  pieces?: Partial<Record<PieceType, ImageSourcePropType>>;
  renderPiece?: (
    piece: PieceType,
    size: number
  ) => React.ReactElement | null;
}) {
  const target = squareToXY(square, pieceSize, flipped);
  const x = useSharedValue(target.x);
  const y = useSharedValue(target.y);
  const scale = useSharedValue(1);
  const prevSquare = useRef(square);

  useEffect(() => {
    const newTarget = squareToXY(square, pieceSize, flipped);
    if (square !== prevSquare.current) {
      // Animate to new square
      x.value = withTiming(newTarget.x, { duration: animDuration });
      y.value = withTiming(newTarget.y, { duration: animDuration });
    } else {
      // Snap (initial render or board flip)
      x.value = newTarget.x;
      y.value = newTarget.y;
    }
    prevSquare.current = square;
  }, [square, pieceSize, flipped, animDuration, x, y]);

  // Grow when this piece is the scaled piece, shrink when it's not
  useAnimatedReaction(
    () => scaledSquare.value,
    (current, previous) => {
      const isScaled = current === square;
      const wasScaled = previous === square;
      if (isScaled && !wasScaled) {
        scale.value = withTiming(1.2);
      } else if (!isScaled && wasScaled) {
        scale.value = withTiming(1);
      }
    }
  );

  // Hand-off from drag → static position. The moment draggingSquare
  // transitions from "this piece" to anything else (drop or cancel),
  // copy the current drag coordinates into x/y so the next paint
  // doesn't snap the piece back to its old square. Without this,
  // dropping a piece looks like: finger lift → snap to origin → slide
  // to destination, because useAnimatedStyle starts reading x/y the
  // instant draggingSquare goes null and x/y are still pointing at
  // the origin square (the JS thread hasn't rendered the new
  // pieceMap yet). With this, x/y are at the drop position when the
  // hand-off happens, and the upcoming square-prop change from
  // reconciliation animates a tiny slide from drop position into the
  // destination square center — which reads as "the piece dropped
  // exactly where I let go."
  useAnimatedReaction(
    () => draggingSquare.value,
    (current, previous) => {
      if (previous === square && current !== square) {
        x.value = dragX.value;
        y.value = dragY.value;
      }
    }
  );

  const style = useAnimatedStyle(() => {
    const isDragging = draggingSquare.value === square;
    const isScaled = scaledSquare.value === square;
    return {
      position: "absolute",
      width: pieceSize,
      height: pieceSize,
      zIndex: isDragging ? 100 : isScaled ? 50 : 10,
      transform: [
        { translateX: isDragging ? dragX.value : x.value },
        { translateY: isDragging ? dragY.value : y.value },
        { scale: scale.value },
      ],
    };
  });

  // renderPiece wins outright; otherwise consult `pieces` overrides,
  // falling back to the bundled DEFAULT_PIECES PNGs.
  const child = renderPiece
    ? renderPiece(piece, pieceSize)
    : (
      <Image
        source={pieces?.[piece] ?? DEFAULT_PIECES[piece]}
        style={{ width: pieceSize, height: pieceSize }}
      />
    );

  return (
    <Animated.View style={style} pointerEvents="none">
      {child}
    </Animated.View>
  );
});

/**
 * Renders all pieces. The reconciliation pass — figuring out which
 * React key each new entry should keep so its `<AnimatedPiece>` instance
 * survives across the move and slides — lives in
 * `helpers/reconcile-pieces.ts` so it can be unit tested. See that file
 * for the algorithm and the bug #9 promotion fix.
 */
export default function PieceLayer({
  boardSize,
  flipped,
  animationDuration,
  pieceMap,
  syncVersion,
  scaledSquare,
  draggingSquare,
  dragX,
  dragY,
  pieces,
  renderPiece,
}: Props) {
  const pieceSize = boardSize / 8;
  const prevMapRef = useRef<Record<string, PieceType>>({});
  const reconcileStateRef = useRef<ReconcileState>(createReconcileState());

  const newMap = pieceMap;
  const oldMap = prevMapRef.current;
  const entries = reconcilePieces(reconcileStateRef.current, oldMap, newMap);

  prevMapRef.current = { ...newMap };

  // syncVersion is used as a dependency to force re-render when board state changes
  void syncVersion;

  return (
    <>
      {entries.map((e) => (
        <AnimatedPiece
          key={e.key}
          piece={e.piece}
          square={e.square}
          pieceSize={pieceSize}
          flipped={flipped}
          animDuration={animationDuration}
          scaledSquare={scaledSquare}
          draggingSquare={draggingSquare}
          dragX={dragX}
          dragY={dragY}
          pieces={pieces}
          renderPiece={renderPiece}
        />
      ))}
    </>
  );
}
