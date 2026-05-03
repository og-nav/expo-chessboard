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
import PreviewTint from "./components/preview-tint";

const DEFAULT_PREVIEW_TINT = "rgba(255, 255, 255, 0.18)";

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
      boardOrientation = "white",
      playerSide = "both",
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
      previewTintColor = DEFAULT_PREVIEW_TINT,
      showPreviewTint = true,
      onPreviewChange,
    },
    ref
  ) {
    // Visual orientation and interaction restriction are independent.
    // boardOrientation controls which side is at the bottom of the
    // screen; playerSide controls which color the user is allowed to
    // move ("both" = analysis mode, either color movable).
    const flipped = boardOrientation === "black";

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
    // ALL of these are seeded from the current chess instance so the
    // gesture layer is fully wired on first paint — without seeding,
    // the post-mount syncFromChess() effect was the only thing that
    // populated legalMovesMap, which left a window where a tap could
    // pick up a piece (pieceMap was populated) but every drop failed
    // the legality check (legalMovesMap was still {}) and snapped back.
    // The Reset button "fixed" it only because remount re-ran the
    // post-mount effect. Seeding kills the window.
    //
    // pieceMap is mirrored: a SharedValue (read by gesture-layer worklets
    // on the UI thread) AND a React state (read by piece-layer during
    // render). Reanimated v4 made `.value` reads during JS render unsafe
    // — they can return stale snapshots — so the renderable mirror is
    // necessary. Both are kept in sync inside syncFromChess.
    const initialPieceMap = useMemo(() => buildPieceMap(chess), [chess]);
    const initialLegal = useMemo(() => computeLegalMap(chess), [chess]);
    const pieceMap = useSharedValue<Record<string, PieceType>>(initialPieceMap);
    const [pieceMapState, setPieceMapState] = useState<
      Record<string, PieceType>
    >(initialPieceMap);
    const legalMovesMap = useSharedValue<Record<string, string[]>>(
      initialLegal.moves
    );
    const promotionsMap = useSharedValue<Record<string, boolean>>(
      initialLegal.promotions
    );
    // Premove maps mirror legal/promotions but are computed against a
    // hypothetical "swap turn" position so the user can drag their own
    // pieces during the opponent's think. Empty when premoves are off
    // or when it actually IS the user's turn.
    const premoveLegalMovesMap = useSharedValue<Record<string, string[]>>({});
    const premovePromotionsMap = useSharedValue<Record<string, boolean>>({});
    const selectedSquare = useSharedValue<string | null>(null);
    const lastMoveFrom = useSharedValue<string | null>(null);
    const lastMoveTo = useSharedValue<string | null>(null);
    const kingInCheck = useSharedValue<string | null>(
      chess.inCheck() ? findKingSquare(chess, chess.turn()) : null
    );

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

    // ── Redo stack for move history scrubbing ──────────────────────────
    // chess.ts has undo() but no redo(), so the board maintains its own
    // stack of popped moves. Held in a ref because pushing/popping it
    // doesn't need to trigger a render — the visual update comes from
    // syncFromChess() bumping syncVersion.
    //
    // Cleared whenever a fresh move enters history (gesture or
    // animateMove). At that branching point any moves to the right of
    // the cursor are no longer reachable, so dropping them is correct.
    // v0.2 will turn this branching event into a tree node instead.
    const redoStackRef = useRef<Move[]>([]);

    // ── Variation preview state ─────────────────────────────────────────
    // While previewing, the board renders a hypothetical position
    // computed from `previewBaseFen` + `previewLine.slice(0, previewIndex)`
    // — the live Chess instance is NOT mutated. Any code path that
    // commits to live (animateMove, undo, redo, reset, fen-prop change)
    // must call exitPreviewIfActive() before syncFromChess() so the
    // tint and gesture-disable come down cleanly.
    const previewLineRef = useRef<string[] | null>(null);
    const previewIndexRef = useRef(0);
    const previewBaseFenRef = useRef("");
    const [previewActive, setPreviewActive] = useState(false);

    // ── Sounds ──────────────────────────────────────────────────────────
    const sounds = useBoardSounds(soundEnabled, hapticsEnabled);

    // ── Premove mode detection ──────────────────────────────────────────
    // Premove mode is active when premoves are enabled, the user is
    // bound to a single side (not analysis mode), AND it is currently
    // the OPPONENT's turn. In that window the gesture layer reads the
    // swap-turn legal map and stores moves into `premove` instead of
    // executing them.
    const userColorCode: Player | null =
      playerSide === "both"
        ? null
        : playerSide === "black"
          ? "b"
          : "w";
    const isPremoveMode =
      premovesEnabled && userColorCode !== null && chess.turn() !== userColorCode;

    // ── Sync board state from Chess instance ────────────────────────────
    const syncFromChess = useCallback(() => {
      const newPieceMap = buildPieceMap(chess);
      pieceMap.value = newPieceMap;
      setPieceMapState(newPieceMap);
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
    }, [
      chess,
      premovesEnabled,
      userColorCode,
      // SharedValues — stable refs from useSharedValue, included to
      // satisfy exhaustive-deps. They never change identity so this is
      // a no-op for re-creation purposes.
      pieceMap,
      legalMovesMap,
      promotionsMap,
      premoveLegalMovesMap,
      premovePromotionsMap,
      kingInCheck,
      lastMoveFrom,
      lastMoveTo,
    ]);

    // ── Preview helpers ─────────────────────────────────────────────────
    // Build a transient Chess instance at the current preview step.
    // Returns null if the line is invalid SAN at any step before the
    // requested index — caller is expected to exit preview in that case.
    const buildPreviewChess = useCallback(
      (line: string[], baseFen: string, index: number): Chess | null => {
        try {
          const c = new Chess(baseFen);
          for (let i = 0; i < index; i++) {
            const result = c.move(line[i]);
            if (!result) return null;
          }
          return c;
        } catch (err) {
          if (__DEV__) {
            console.warn("[expo-chessboard] preview replay failed:", err);
          }
          return null;
        }
      },
      []
    );

    const fireOnPreviewChange = useCallback(
      (state: Parameters<NonNullable<typeof onPreviewChange>>[0]) => {
        if (onPreviewChange) onPreviewChange(state);
      },
      [onPreviewChange]
    );

    // Render the current preview position. Mirrors syncFromChess but
    // reads from a transient Chess copy instead of the live one. Premove
    // maps are zeroed because preview is read-only by design (v0.1).
    const syncFromPreview = useCallback(() => {
      const line = previewLineRef.current;
      if (!line) return;
      const previewChess = buildPreviewChess(
        line,
        previewBaseFenRef.current,
        previewIndexRef.current
      );
      if (!previewChess) {
        // Bad SAN somewhere in the line — fall back to live so we don't
        // render a half-applied position.
        previewLineRef.current = null;
        previewIndexRef.current = 0;
        setPreviewActive(false);
        fireOnPreviewChange(null);
        syncFromChess();
        return;
      }

      const newPieceMap = buildPieceMap(previewChess);
      pieceMap.value = newPieceMap;
      setPieceMapState(newPieceMap);
      const legal = computeLegalMap(previewChess);
      legalMovesMap.value = legal.moves;
      promotionsMap.value = legal.promotions;
      kingInCheck.value = previewChess.inCheck()
        ? findKingSquare(previewChess, previewChess.turn())
        : null;
      // Preview is read-only — premove rings are nonsensical here.
      premoveLegalMovesMap.value = {};
      premovePromotionsMap.value = {};

      // Last-move highlight: most recent move within the preview line.
      // At index 0 we're at the live base position but rendering as a
      // preview; show no highlight to avoid confusion with the real
      // last-move marker that returns when preview is exited.
      if (previewIndexRef.current > 0) {
        const history = previewChess.history({ verbose: true }) as Move[];
        if (history.length > 0) {
          const last = history[history.length - 1];
          lastMoveFrom.value = last.from;
          lastMoveTo.value = last.to;
        }
      } else {
        lastMoveFrom.value = null;
        lastMoveTo.value = null;
      }

      setSyncVersion((v) => v + 1);

      fireOnPreviewChange({
        active: true,
        index: previewIndexRef.current,
        length: line.length,
        fen: previewChess.fen(),
      });
    }, [
      buildPreviewChess,
      syncFromChess,
      fireOnPreviewChange,
      pieceMap,
      legalMovesMap,
      promotionsMap,
      premoveLegalMovesMap,
      premovePromotionsMap,
      kingInCheck,
      lastMoveFrom,
      lastMoveTo,
    ]);

    // Drop preview state without re-syncing. Caller is expected to
    // follow up with syncFromChess() so the live position is rendered.
    const exitPreviewIfActive = useCallback(() => {
      if (!previewLineRef.current) return false;
      previewLineRef.current = null;
      previewIndexRef.current = 0;
      previewBaseFenRef.current = "";
      setPreviewActive(false);
      fireOnPreviewChange(null);
      return true;
    }, [fireOnPreviewChange]);

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
        // Live position changed (consumer mutated their controlled
        // Chess instance and we noticed via the fen-equality probe).
        // The preview's base FEN is now stale, so drop preview and
        // render the new live state.
        exitPreviewIfActive();
        syncFromChess();
      }
    }, [chess, syncFromChess, exitPreviewIfActive]);

    // ── Uncontrolled mode: react to `fen` prop changes by loading the
    // new position into the internal Chess instance. Skipped in
    // controlled mode (consumer is responsible for their own resets).
    // This is also the "Lichess pushed a new live move" path — any
    // active preview is dropped because its base position no longer
    // matches the live game.
    useEffect(() => {
      if (chessProp) return;
      if (!fen) return;
      if (chess.fen() === fen) return;
      chess.load(fen);
      fenRef.current = chess.fen();
      exitPreviewIfActive();
      syncFromChess();
    }, [chessProp, fen, chess, syncFromChess, exitPreviewIfActive]);

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
            // Branching point — see redoStackRef declaration. Any
            // fresh move makes the queued redo entries unreachable.
            redoStackRef.current = [];
            fenRef.current = chess.fen();
            // Live state changed — preview's base FEN is now stale.
            exitPreviewIfActive();
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
      [chess, syncFromChess, exitPreviewIfActive, sounds, onMove]
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
              // Same branching point as executeMove — programmatic
              // moves also invalidate any pending redo entries.
              redoStackRef.current = [];
              fenRef.current = chess.fen();
              // A live move arriving while previewing (e.g. Lichess
              // push) means "snap back to the real game" — drop the
              // preview before rendering the new live position.
              exitPreviewIfActive();
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
          // Explicit sync request always renders live, never preview.
          exitPreviewIfActive();
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
          // queued against doesn't exist anymore. The redo stack also
          // belongs to a position that no longer exists. Same for any
          // active preview.
          setPremove(null);
          redoStackRef.current = [];
          fenRef.current = chess.fen();
          exitPreviewIfActive();
          syncFromChess();
        },
        getFen: () => chess.fen(),
        cancelPremove,
        // ── Move history scrubbing (M5) ────────────────────────────
        // undo() pops chess.ts's history into our redo stack; redo()
        // does the reverse. Both call syncFromChess() so the
        // reconciliation diff sees the new position and animates the
        // pieces backward (the M5 backward-promotion branch in
        // reconcile-pieces.ts is what makes promotion-undo not pop).
        // Both also play a "scrub" sound (move/capture, never
        // gameOver) so the navigation feels physical. onMove
        // intentionally does NOT fire — scrubbing is not a new move.
        undo: () => {
          if (chess.history().length === 0) return;
          const popped = chess.undo();
          if (popped) {
            redoStackRef.current.push(popped as Move);
            setPremove(null);
            fenRef.current = chess.fen();
            exitPreviewIfActive();
            syncFromChess();
            sounds.playForScrub(popped as Move);
          }
        },
        redo: () => {
          const popped = redoStackRef.current.pop();
          if (!popped) return;
          try {
            // SAN is the most reliable form to replay because it
            // re-resolves the from/to disambiguation against the
            // current position. san is non-optional on Move.
            const replayed = chess.move(popped.san);
            setPremove(null);
            fenRef.current = chess.fen();
            exitPreviewIfActive();
            syncFromChess();
            if (replayed) {
              sounds.playForScrub(replayed as Move);
            }
          } catch (err) {
            // If the redo somehow fails (shouldn't happen, but
            // defensive), drop the entry rather than corrupting the
            // stack. The visible state stays consistent.
            if (__DEV__) {
              console.warn("[expo-chessboard] redo failed:", err);
            }
          }
        },
        goToMoveIndex: (n: number) => {
          const current = chess.history().length;
          const total = current + redoStackRef.current.length;
          const target = Math.max(0, Math.min(n, total));
          if (target === current) return;
          if (target < current) {
            const steps = current - target;
            for (let i = 0; i < steps; i++) {
              const popped = chess.undo();
              if (popped) redoStackRef.current.push(popped as Move);
            }
          } else {
            const steps = target - current;
            for (let i = 0; i < steps; i++) {
              const popped = redoStackRef.current.pop();
              if (!popped) break;
              try {
                chess.move(popped.san);
              } catch (err) {
                if (__DEV__) {
                  console.warn(
                    "[expo-chessboard] goToMoveIndex redo step failed:",
                    err
                  );
                }
                break;
              }
            }
          }
          setPremove(null);
          fenRef.current = chess.fen();
          exitPreviewIfActive();
          syncFromChess();
        },
        getMoveIndex: () => chess.history().length,
        // Total reachable moves: current cursor position plus everything
        // sitting in the redo stack. After undo()-ing to ply 0,
        // getMoveIndex() returns 0 but getMoveCount() still returns the
        // full game length, so callers can goToMoveIndex(getMoveCount())
        // to jump back to the end.
        getMoveCount: () =>
          chess.history().length + redoStackRef.current.length,
        getHistory: () => chess.history({ verbose: true }) as Move[],
        canUndo: () => chess.history().length > 0,
        canRedo: () => redoStackRef.current.length > 0,
        // ── Variation preview ──────────────────────────────────────
        // previewLine snapshots the live FEN as the base, stores the
        // SAN sequence, and renders the position at `index` (default
        // = end of line). The live Chess instance is left untouched;
        // the displayed pieces, legal map, check highlight, and
        // last-move marker all come from a transient Chess copy
        // recomputed on every step. Calling previewLine while a
        // preview is already active replaces it.
        previewLine: (moves: string[], index?: number) => {
          if (!moves || moves.length === 0) {
            // Empty line is a degenerate preview — equivalent to
            // showing the live position with the tint on. Allow it
            // (useful for "preview mode without an engine line yet")
            // but cap the index at 0.
            previewLineRef.current = [];
            previewIndexRef.current = 0;
            previewBaseFenRef.current = chess.fen();
            setPremove(null);
            setPreviewActive(true);
            syncFromPreview();
            return;
          }
          const target = Math.max(
            0,
            Math.min(index ?? moves.length, moves.length)
          );
          // Validate the line is replayable on the way in. If not,
          // bail rather than entering a broken preview.
          const probe = buildPreviewChess(moves, chess.fen(), target);
          if (!probe) {
            if (__DEV__) {
              console.warn(
                "[expo-chessboard] previewLine: SAN replay failed"
              );
            }
            return;
          }
          previewLineRef.current = moves.slice();
          previewBaseFenRef.current = chess.fen();
          previewIndexRef.current = target;
          // Active preview cancels any queued premove — they belong
          // to the live position which is no longer rendered.
          setPremove(null);
          setPreviewActive(true);
          syncFromPreview();
        },
        stepPreviewForward: () => {
          const line = previewLineRef.current;
          if (!line) return false;
          if (previewIndexRef.current >= line.length) return false;
          const san = line[previewIndexRef.current];
          previewIndexRef.current += 1;
          syncFromPreview();
          // syncFromPreview may have aborted preview if the line was
          // invalid; check before playing the step sound.
          if (previewLineRef.current) {
            sounds.playForPreviewStep(san);
          }
          return true;
        },
        stepPreviewBack: () => {
          const line = previewLineRef.current;
          if (!line) return false;
          if (previewIndexRef.current <= 0) return false;
          previewIndexRef.current -= 1;
          // The "undone" SAN is the one we just stepped over.
          const san = line[previewIndexRef.current];
          syncFromPreview();
          if (previewLineRef.current) {
            sounds.playForPreviewStep(san);
          }
          return true;
        },
        exitPreview: () => {
          if (!exitPreviewIfActive()) return;
          syncFromChess();
        },
        isPreviewing: () => previewLineRef.current !== null,
        getPreviewIndex: () =>
          previewLineRef.current ? previewIndexRef.current : 0,
        getPreviewLength: () =>
          previewLineRef.current ? previewLineRef.current.length : 0,
        getDisplayedFen: () => {
          if (!previewLineRef.current) return chess.fen();
          const previewChess = buildPreviewChess(
            previewLineRef.current,
            previewBaseFenRef.current,
            previewIndexRef.current
          );
          return previewChess ? previewChess.fen() : chess.fen();
        },
      }),
      [
        chess,
        chessProp,
        syncFromChess,
        syncFromPreview,
        exitPreviewIfActive,
        buildPreviewChess,
        sounds,
        onMove,
        animationDuration,
        cancelPremove,
      ]
    );

    // Derive the side that the gesture layer should let the user grab.
    // "both" → whichever side it currently is to move, so analysis mode
    // can grab either color naturally. In premove mode the user is
    // grabbing their OWN pieces during the opponent's turn, so we hand
    // the gesture layer userColorCode instead of chess.turn().
    const gesturePlayerColor: Player = isPremoveMode
      ? (userColorCode as Player)
      : playerSide === "both"
        ? chess.turn()
        : playerSide === "black"
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
          pieceMap={pieceMapState}
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
        {previewActive && showPreviewTint && (
          <PreviewTint boardSize={boardSize} color={previewTintColor} />
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
          gestureEnabled={gestureEnabled && !promotionPending && !previewActive}
          playerColor={gesturePlayerColor}
          isPremoveMode={isPremoveMode}
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
