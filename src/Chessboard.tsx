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
import { Chess, type Move, type PieceSymbol } from "chess.ts";
import {
  DEFAULT_COLORS,
  type BoardColors,
  type ChessboardProps,
  type ChessboardRef,
  type PieceType,
  type Player,
  type Square,
} from "./types";
import { STARTING_FEN } from "./constants";
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
import ArrowsLayer from "./components/arrows-layer";
import ExternalHighlights from "./components/external-highlights";

/**
 * Build a hypothetical "opponent already moved, my turn" FEN by flipping
 * the active-color field. We also clear the en-passant target square
 * because that right belongs to the side that just moved — after the
 * flip it would refer to the wrong color and chess.ts would reject the
 * resulting FEN. Premove legality is approximate by design (the real
 * opponent move could change everything), so dropping ep is fine.
 */
function swapTurnInFen(fen: string): string {
  const parts = fen.split(" ");
  if (parts.length < 6) return fen;
  parts[1] = parts[1] === "w" ? "b" : "w";
  parts[3] = "-";
  return parts.join(" ");
}

const Chessboard = React.forwardRef<ChessboardRef, ChessboardProps>(
  function Chessboard(
    {
      chess: chessProp,
      fen,
      boardSize,
      boardOrientation,
      playerSide,
      // Deprecated alias — if set, it overrides both boardOrientation
      // and playerSide so the v2 prop surface keeps working.
      playerColor,
      colors: colorOverrides,
      pieces,
      renderPiece,
      showCoordinates = true,
      coordinateStyle,
      highlightedSquares,
      arrows,
      gestureEnabled = true,
      animationDuration = 150,
      soundEnabled = true,
      hapticsEnabled = true,
      premovesEnabled = false,
      onMove,
      onSquarePress,
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

    // ── Controlled vs uncontrolled mode ────────────────────────────────
    // If a `chess` prop is provided, the consumer owns the instance.
    // Otherwise we lazily allocate one and treat the `fen` prop as the
    // declarative source of truth — calling `load(fen)` on it whenever
    // the consumer hands us a different FEN.
    const internalChessRef = useRef<Chess | null>(null);
    if (!chessProp && !internalChessRef.current) {
      internalChessRef.current = new Chess(fen ?? STARTING_FEN);
    }
    const chess = chessProp ?? internalChessRef.current!;

    // ── Shared values (readable on UI thread) ───────────────────────────
    const pieceMap = useSharedValue<Record<string, PieceType>>({});
    const legalMovesMap = useSharedValue<Record<string, string[]>>({});
    const promotionsMap = useSharedValue<Record<string, boolean>>({});
    // Premove maps mirror legal/promotions but are computed against a
    // hypothetical "swap turn" position so the user can drag their own
    // pieces during the opponent's think. Empty when premoves are off
    // or when it actually IS the user's turn.
    const premoveLegalMovesMap = useSharedValue<Record<string, string[]>>({});
    const premovePromotionsMap = useSharedValue<Record<string, boolean>>({});
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

    // Queued premove. Cleared when applied, when illegal, or via
    // cancelPremove()/the deselect-tap branch.
    const [premove, setPremove] = useState<{
      from: string;
      to: string;
      promotion?: PieceSymbol;
    } | null>(null);

    // ── Sounds ──────────────────────────────────────────────────────────
    const sounds = useBoardSounds(soundEnabled, hapticsEnabled);

    // ── Premove mode detection ──────────────────────────────────────────
    // Premove mode is active when premoves are enabled, the user is
    // bound to a single side (not analysis mode), AND it is currently
    // the OPPONENT's turn. In that window the gesture layer reads the
    // swap-turn legal map and stores moves into `premove` instead of
    // executing them.
    const userColorCode: Player | null =
      resolvedPlayerSide === "both"
        ? null
        : resolvedPlayerSide === "black"
          ? "b"
          : "w";
    const isPremoveMode =
      premovesEnabled && userColorCode !== null && chess.turn() !== userColorCode;

    // ── Sync board state from Chess instance ────────────────────────────
    const syncFromChess = useCallback(() => {
      pieceMap.value = buildPieceMap(chess);
      const legal = computeLegalMap(chess);
      legalMovesMap.value = legal.moves;
      promotionsMap.value = legal.promotions;
      kingInCheck.value = chess.inCheck()
        ? findKingSquare(chess, chess.turn())
        : null;

      // Premove legal map: only meaningful while it's the opponent's
      // turn AND premoves are enabled. Built from a temporary Chess
      // instance with the side-to-move flipped, so the user can drag
      // their own pieces and see realistic candidate targets. En
      // passant rights are dropped from the swapped FEN because they
      // belong to the wrong side after the flip.
      const inPremoveWindow =
        premovesEnabled &&
        userColorCode !== null &&
        chess.turn() !== userColorCode;
      if (inPremoveWindow) {
        try {
          const swappedFen = swapTurnInFen(chess.fen());
          const tempChess = new Chess(swappedFen);
          const tempLegal = computeLegalMap(tempChess);
          premoveLegalMovesMap.value = tempLegal.moves;
          premovePromotionsMap.value = tempLegal.promotions;
        } catch (err) {
          if (__DEV__) {
            console.warn("[expo-chessboard] premove map build failed:", err);
          }
          premoveLegalMovesMap.value = {};
          premovePromotionsMap.value = {};
        }
      } else {
        premoveLegalMovesMap.value = {};
        premovePromotionsMap.value = {};
      }

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
    }, [chess, premovesEnabled, userColorCode]);

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

    // ── Uncontrolled mode: react to `fen` prop changes by loading the
    // new position into the internal Chess instance. Skipped in
    // controlled mode (consumer is responsible for their own resets).
    useEffect(() => {
      if (chessProp) return;
      if (!fen) return;
      if (chess.fen() === fen) return;
      chess.load(fen);
      fenRef.current = chess.fen();
      syncFromChess();
    }, [chessProp, fen, chess, syncFromChess]);

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

    // ── Premove handlers ─────────────────────────────────────────────────
    // Storing a new premove always replaces the previous one. The
    // gesture layer routes here only when isPremoveMode is true.
    const handlePremoveRequest = useCallback((from: string, to: string) => {
      setPremove({ from, to });
    }, []);

    // Premove promotions default to queen — popping a promotion dialog
    // mid-opponent-turn is awkward and chess.com / lichess do the same.
    const handlePremovePromotionRequest = useCallback(
      (from: string, to: string) => {
        setPremove({ from, to, promotion: "q" as PieceSymbol });
      },
      []
    );

    const cancelPremove = useCallback(() => {
      setPremove(null);
    }, []);

    // Auto-apply: after every sync, if it has become the player's turn
    // and a premove is queued, fire it through executeMove. executeMove
    // handles the legality check via its existing try/catch — an illegal
    // premove (e.g. the destination is now defended differently) just
    // falls through silently and the premove is cleared either way.
    useEffect(() => {
      if (!premove) return;
      if (userColorCode === null) return;
      if (chess.turn() !== userColorCode) return;
      const queued = premove;
      setPremove(null);
      executeMove(queued.from, queued.to, queued.promotion);
      // syncVersion is in the dep array because we want to re-check
      // every time the board state advances, not just when premove
      // changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [syncVersion, premove, userColorCode, chess, executeMove]);

    // Wrap the public onSquarePress so a tap that ends in the
    // deselect branch ALSO clears any queued premove. This is the
    // "tap empty square to cancel" affordance from the plan; selecting
    // a different own piece intentionally does NOT cancel because the
    // user is mid-action.
    const handleSquarePress = useCallback(
      (sq: Square) => {
        if (premove) setPremove(null);
        onSquarePress?.(sq);
      },
      [premove, onSquarePress]
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
        reset: (nextFen?: string) => {
          // In controlled mode the caller is expected to mutate their
          // own Chess instance; we just re-sync so the board reflects
          // whatever they did. In uncontrolled mode we own the instance,
          // so we can call load() ourselves.
          if (!chessProp) {
            chess.load(nextFen ?? STARTING_FEN);
          }
          // Reset cancels any queued premove — the board the user
          // queued against doesn't exist anymore.
          setPremove(null);
          fenRef.current = chess.fen();
          syncFromChess();
        },
        getFen: () => chess.fen(),
        cancelPremove,
      }),
      [
        chess,
        chessProp,
        syncFromChess,
        sounds,
        onMove,
        animationDuration,
        cancelPremove,
      ]
    );

    // ── Bug #10 fix continued: derive the side that the gesture layer
    // should let the user grab. "both" → whichever side it currently is
    // to move, so analysis mode can grab either color naturally. In
    // premove mode the user is grabbing their OWN pieces during the
    // opponent's turn, so we hand the gesture layer userColorCode
    // instead of chess.turn().
    const gesturePlayerColor: Player = isPremoveMode
      ? (userColorCode as Player)
      : resolvedPlayerSide === "both"
        ? chess.turn()
        : resolvedPlayerSide === "black"
          ? "b"
          : "w";

    // ── Premove routing ────────────────────────────────────────────────
    // The gesture and dot layers are agnostic to whether the user is
    // making a real move or queuing a premove — we just hand them the
    // right legal-map and the right callbacks based on isPremoveMode.
    const activeLegalMap = isPremoveMode ? premoveLegalMovesMap : legalMovesMap;
    const activePromotionsMap = isPremoveMode
      ? premovePromotionsMap
      : promotionsMap;
    const activeMoveHandler = isPremoveMode
      ? handlePremoveRequest
      : handleMoveRequest;
    const activePromotionHandler = isPremoveMode
      ? handlePremovePromotionRequest
      : handlePromotionRequest;

    // ── Render ──────────────────────────────────────────────────────────
    return (
      <View style={{ width: boardSize, height: boardSize }}>
        <BoardBackground
          boardSize={boardSize}
          colors={colors}
          flipped={flipped}
          showCoordinates={showCoordinates}
          coordinateStyle={coordinateStyle}
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
        {highlightedSquares && highlightedSquares.length > 0 && (
          <ExternalHighlights
            boardSize={boardSize}
            flipped={flipped}
            highlights={highlightedSquares}
            colors={colors}
          />
        )}
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
          pieces={pieces}
          renderPiece={renderPiece}
        />
        {arrows && arrows.length > 0 && (
          <ArrowsLayer
            boardSize={boardSize}
            flipped={flipped}
            arrows={arrows}
            colors={colors}
          />
        )}
        {premove && (
          <>
            <ExternalHighlights
              boardSize={boardSize}
              flipped={flipped}
              highlights={[
                {
                  square: premove.from as Square,
                  type: "ring",
                  color: colors.premove,
                },
                {
                  square: premove.to as Square,
                  type: "ring",
                  color: colors.premove,
                },
              ]}
              colors={colors}
            />
            <ArrowsLayer
              boardSize={boardSize}
              flipped={flipped}
              arrows={[
                {
                  from: premove.from as Square,
                  to: premove.to as Square,
                  color: colors.premove,
                },
              ]}
              colors={colors}
            />
          </>
        )}
        <LegalMoveDots
          boardSize={boardSize}
          flipped={flipped}
          dotColor={colors.legalMoveDot}
          selectedSquare={selectedSquare}
          legalMovesMap={activeLegalMap}
          pieceMap={pieceMap}
        />
        <GestureLayer
          boardSize={boardSize}
          flipped={flipped}
          gestureEnabled={gestureEnabled && !promotionPending}
          playerColor={gesturePlayerColor}
          legalMovesMap={activeLegalMap}
          promotionsMap={activePromotionsMap}
          pieceMap={pieceMap}
          selectedSquare={selectedSquare}
          scaledSquare={scaledSquare}
          draggingSquare={draggingSquare}
          dragX={dragX}
          dragY={dragY}
          onMoveRequest={activeMoveHandler}
          onPromotionRequest={activePromotionHandler}
          onSquarePress={handleSquarePress}
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
