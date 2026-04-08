import type { Chess, Move } from "chess.ts";

/**
 * Picks a random legal move from the given position. Returns null if
 * there are no legal moves (checkmate or stalemate).
 *
 * Deliberately *not* an engine — the goal of the example app is to
 * exercise the chessboard's full move/animation/sound flow without
 * pulling Stockfish or any heavy dependency.
 */
export function pickRandomMove(chess: Chess): Move | null {
  const moves = chess.moves({ verbose: true }) as Move[];
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}
