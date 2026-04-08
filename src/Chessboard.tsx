import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import type { Move, PieceSymbol } from "chess.ts";
import {
  DEFAULT_COLORS,
  type BoardColors,
  type ChessboardProps,
  type ChessboardRef,
  type PieceType,
  type Player,
} from "./types";
import {
  buildPieceMap,
  computeLegalMap,
  findKingSquare,
} from "./helpers/square-utils";
import { useBoardSounds } from "./use-board-sounds";

import BoardBackground from "./components/board-background";
import HighlightLayer from "./components/highlight-layer";
import PieceLayer from "./components/piece-layer";
import LegalMoveDots from "./components/legal-move-dots";
import GestureLayer from "./components/gesture-layer";
import PromotionDialog from "./components/promotion-dialog";

const Chessboard = React.forwardRef<ChessboardRef, ChessboardProps>(
  function Chessboard(
    {
      chess,
      boardSize,
      boardOrientation,
      playerSide,
      // Deprecated alias — if set, it overrides both boardOrientation
      // and playerSide so the v2 prop surface keeps working.
      playerColor,
      colors: colorOverrides,
      gestureEnabled = true,
      animationDuration = 150,
      soundEnabled = true,
      hapticsEnabled = true,
      onMove,
    },
    ref
  ) {
    // ── Bug #10 fix: split playerColor into orientation + playerSide ────
    // Resolution order:
    //   1. If `playerColor` (deprecated) is set, mirror it to both.
    //   2. Otherwise honor `boardOrientation` / `playerSide` directly.
    //   3. Default: white-up, both sides movable (analysis mode).
    const resolvedOrientation = playerColor
      ? playerColor === "b"
        ? "black"
        : "white"
      : boardOrientation ?? "white";
    const resolvedPlayerSide = playerColor
      ? playerColor === "b"
        ? "black"
        : "white"
      : playerSide ?? "both";

    const flipped = resolvedOrientation === "black";

    // ── Bug #5 fix: memoize the merged colors object so consumers
    // passing inline `colors={{...}}` don't trigger downstream re-renders
    // every render.
    const colors: BoardColors = useMemo(
      () => ({ ...DEFAULT_COLORS, ...colorOverrides }),
      [colorOverrides]
    );

    // ── Shared values (readable on UI thread) ───────────────────────────
    const pieceMap = useSharedValue<Record<string, PieceType>>({});
    const legalMovesMap = useSharedValue<Record<string, string[]>>({});
    const promotionsMap = useSharedValue<Record<string, boolean>>({});
    const selectedSquare = useSharedValue<string | null>(null);
    const lastMoveFrom = useSharedValue<string | null>(null);
    const lastMoveTo = useSharedValue<string | null>(null);
    const kingInCheck = useSharedValue<string | null>(null);

    // Drag state
    const draggingSquare = useSharedValue<string | null>(null);
    const dragX = useSharedValue(0);
    const dragY = useSharedValue(0);

    // Scale state — which piece is visually enlarged (gesture layer controls this)
    const scaledSquare = useSharedValue<string | null>(null);

    // Sync counter — triggers PieceLayer re-render when board state changes
    const [syncVersion, setSyncVersion] = useState(0);

    // Promotion state (React state for dialog rendering)
    const [promotionPending, setPromotionPending] = useState<{
      from: string;
      to: string;
      color: Player;
    } | null>(null);

    // ── Sounds ──────────────────────────────────────────────────────────
    const sounds = useBoardSounds(soundEnabled, hapticsEnabled);

    // ── Sync board state from Chess instance ────────────────────────────
    const syncFromChess = useCallback(() => {
      pieceMap.value = buildPieceMap(chess);
      const legal = computeLegalMap(chess);
      legalMovesMap.value = legal.moves;
      promotionsMap.value = legal.promotions;
      kingInCheck.value = chess.inCheck()
        ? findKingSquare(chess, chess.turn())
        : null;

      // Update last move highlights from history
      const history = chess.history({ verbose: true }) as Move[];
      if (history.length > 0) {
        const last = history[history.length - 1];
        lastMoveFrom.value = last.from;
        lastMoveTo.value = last.to;
      } else {
        lastMoveFrom.value = null;
        lastMoveTo.value = null;
      }

      // Bump version to force PieceLayer re-render
      setSyncVersion((v) => v + 1);
    }, [chess]);

    // ── Bug #1 fix: useEffect must declare its dependencies. The v2
    // version had no dep array, so it ran every render and only avoided
    // an infinite loop because of the FEN-equality guard. Adding [chess]
    // makes the intent explicit and lets React skip the effect when the
    // chess instance is stable. The fenRef guard still catches the case
    // where the same instance was mutated externally.
    const fenRef = useRef("");
    useEffect(() => {
      const currentFen = chess.fen();
      if (currentFen !== fenRef.current) {
        fenRef.current = currentFen;
        syncFromChess();
      }
    }, [chess, syncFromChess]);

    // ── Move handling ───────────────────────────────────────────────────
    const executeMove = useCallback(
      (from: string, to: string, promotion?: string) => {
        try {
          const move = chess.move({
            from,
            to,
            promotion: promotion as PieceSymbol,
          });
          if (move) {
            fenRef.current = chess.fen();
            syncFromChess();
            sounds.playForMove(move, chess);
            onMove?.(move);
          }
        } catch (err) {
          // Bug #2 fix: surface the failure in dev builds instead of
          // silently swallowing it. chess.ts throws on illegal moves,
          // but a throw here always indicates a bug in the gesture
          // layer's pre-validation, not a user error.
          if (__DEV__) {
            console.warn("[expo-chessboard] executeMove failed:", err);
          }
        }
      },
      [chess, syncFromChess, sounds, onMove]
    );

    const handleMoveRequest = useCallback(
      (from: string, to: string) => {
        executeMove(from, to);
      },
      [executeMove]
    );

    const handlePromotionRequest = useCallback(
      (from: string, to: string) => {
        setPromotionPending({ from, to, color: chess.turn() });
      },
      [chess]
    );

    const handlePromotionSelect = useCallback(
      (piece: "q" | "r" | "b" | "n") => {
        if (!promotionPending) return;
        setPromotionPending(null);
        executeMove(promotionPending.from, promotionPending.to, piece);
      },
      [promotionPending, executeMove]
    );

    // ── Imperative ref for parent (AI moves, undo, etc.) ────────────────
    useImperativeHandle(
      ref,
      () => ({
        animateMove: (from: string, to: string, promotion?: string) => {
          // Apply move and start animation, but delay sound/haptics
          // until the piece animation completes (matches original board)
          try {
            const move = chess.move({
              from,
              to,
              promotion: promotion as PieceSymbol,
            });
            if (move) {
              fenRef.current = chess.fen();
              syncFromChess();
              onMove?.(move);
              // Play sound + haptics after animation finishes
              setTimeout(() => {
                sounds.playForMove(move, chess);
              }, animationDuration);
            }
          } catch (err) {
            // Bug #2 fix (see executeMove above for the rationale).
            if (__DEV__) {
              console.warn("[expo-chessboard] animateMove failed:", err);
            }
          }
        },
        syncFromChess: () => {
          fenRef.current = chess.fen();
          syncFromChess();
        },
      }),
      [chess, syncFromChess, sounds, onMove, animationDuration]
    );

    // ── Bug #10 fix continued: derive the side that the gesture layer
    // should let the user grab. "both" → whichever side it currently is
    // to move, so analysis mode can grab either color naturally.
    const gesturePlayerColor: Player =
      resolvedPlayerSide === "both"
        ? chess.turn()
        : resolvedPlayerSide === "black"
          ? "b"
          : "w";

    // ── Render ──────────────────────────────────────────────────────────
    return (
      <View style={{ width: boardSize, height: boardSize }}>
        <BoardBackground
          boardSize={boardSize}
          colors={colors}
          flipped={flipped}
        />
        <HighlightLayer
          boardSize={boardSize}
          flipped={flipped}
          colors={colors}
          selectedSquare={selectedSquare}
          lastMoveFrom={lastMoveFrom}
          lastMoveTo={lastMoveTo}
          kingInCheck={kingInCheck}
        />
        <PieceLayer
          boardSize={boardSize}
          flipped={flipped}
          animationDuration={animationDuration}
          pieceMap={pieceMap}
          syncVersion={syncVersion}
          scaledSquare={scaledSquare}
          draggingSquare={draggingSquare}
          dragX={dragX}
          dragY={dragY}
        />
        <LegalMoveDots
          boardSize={boardSize}
          flipped={flipped}
          dotColor={colors.legalMoveDot}
          selectedSquare={selectedSquare}
          legalMovesMap={legalMovesMap}
          pieceMap={pieceMap}
        />
        <GestureLayer
          boardSize={boardSize}
          flipped={flipped}
          gestureEnabled={gestureEnabled && !promotionPending}
          playerColor={gesturePlayerColor}
          legalMovesMap={legalMovesMap}
          promotionsMap={promotionsMap}
          pieceMap={pieceMap}
          selectedSquare={selectedSquare}
          scaledSquare={scaledSquare}
          draggingSquare={draggingSquare}
          dragX={dragX}
          dragY={dragY}
          onMoveRequest={handleMoveRequest}
          onPromotionRequest={handlePromotionRequest}
        />
        {promotionPending && (
          <PromotionDialog
            color={promotionPending.color}
            boardSize={boardSize}
            colors={colors}
            onSelect={handlePromotionSelect}
          />
        )}
      </View>
    );
  }
);

export default Chessboard;
