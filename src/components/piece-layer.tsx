import React, { useEffect, useRef } from "react";
import { Image } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { DEFAULT_PIECES } from "../constants";
import { squareToXY } from "../helpers/square-utils";
import type { PieceType } from "../types";

interface PieceEntry {
  key: string;
  piece: PieceType;
  square: string;
}

interface Props {
  boardSize: number;
  flipped: boolean;
  animationDuration: number;
  pieceMap: SharedValue<Record<string, PieceType>>;
  syncVersion: number;
  scaledSquare: SharedValue<string | null>;
  draggingSquare: SharedValue<string | null>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
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
  }, [square, pieceSize, flipped]);

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

  return (
    <Animated.View style={style} pointerEvents="none">
      <Image
        source={DEFAULT_PIECES[piece]}
        style={{ width: pieceSize, height: pieceSize }}
      />
    </Animated.View>
  );
});

/**
 * Renders all pieces. Reconciles old vs new piece positions to
 * determine which piece moved and assigns stable keys.
 *
 * NOTE: M2 keeps the reconciliation loop inlined. M3 extracts it into
 * `helpers/reconcile-pieces.ts` so it can be unit-tested without React,
 * and adds the promotion-key-reuse branch (bug #9 fix).
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
}: Props) {
  const pieceSize = boardSize / 8;
  const prevMapRef = useRef<Record<string, PieceType>>({});
  const nextKeyId = useRef(0);
  // Map from key to its current square — survives re-renders
  const keySquareMap = useRef<Map<string, string>>(new Map());

  // Compute entries directly during render (no useEffect/setState delay)
  const newMap = pieceMap.value;
  const oldMap = prevMapRef.current;

  const entries: PieceEntry[] = [];
  const usedKeys = new Set<string>();

  for (const [sq, piece] of Object.entries(newMap)) {
    // 1. Same piece on same square? Reuse key.
    let foundKey: string | null = null;
    for (const [key, oldSq] of keySquareMap.current) {
      if (oldSq === sq && oldMap[sq] === piece && !usedKeys.has(key)) {
        foundKey = key;
        break;
      }
    }
    // 2. Piece moved from another square? Find unmatched old piece of same type.
    if (!foundKey) {
      for (const [key, oldSq] of keySquareMap.current) {
        if (
          oldMap[oldSq] === piece &&
          !newMap[oldSq] &&
          !usedKeys.has(key)
        ) {
          foundKey = key;
          break;
        }
      }
    }
    // 3. New piece (promotion, initial render)? Create new key.
    if (!foundKey) {
      foundKey = `p${nextKeyId.current++}`;
    }

    usedKeys.add(foundKey);
    keySquareMap.current.set(foundKey, sq);
    entries.push({ key: foundKey, piece, square: sq });
  }

  // Remove keys for captured/removed pieces
  for (const key of [...keySquareMap.current.keys()]) {
    if (!usedKeys.has(key)) {
      keySquareMap.current.delete(key);
    }
  }

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
        />
      ))}
    </>
  );
}
