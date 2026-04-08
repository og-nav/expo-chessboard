import type { Chess } from "chess.ts";
import type { PieceType, Player } from "../types";

const FILES = "abcdefgh";

/** Convert square string to col/row indices (0-based, a1 = col 0 row 7). */
export function squareToColRow(sq: string): { col: number; row: number } {
  "worklet";
  const col = sq.charCodeAt(0) - 97; // 'a' = 0
  const row = 8 - Number(sq[1]); // '8' = 0, '1' = 7
  return { col, row };
}

/** Convert square to pixel position, accounting for board flip. */
export function squareToXY(
  sq: string,
  pieceSize: number,
  flipped: boolean
): { x: number; y: number } {
  "worklet";
  const { col, row } = squareToColRow(sq);
  const x = flipped ? (7 - col) * pieceSize : col * pieceSize;
  const y = flipped ? (7 - row) * pieceSize : row * pieceSize;
  return { x, y };
}

/** Convert pixel position to square string, accounting for board flip. */
export function xyToSquare(
  x: number,
  y: number,
  pieceSize: number,
  flipped: boolean
): string {
  "worklet";
  let col = Math.floor(x / pieceSize);
  let row = Math.floor(y / pieceSize);
  col = Math.max(0, Math.min(7, col));
  row = Math.max(0, Math.min(7, row));
  if (flipped) {
    col = 7 - col;
    row = 7 - row;
  }
  return String.fromCharCode(97 + col) + String(8 - row);
}

/**
 * Build a map of square -> PieceType from a Chess instance.
 * e.g. { "e1": "wk", "e8": "bk", "a2": "wp", ... }
 */
export function buildPieceMap(chess: Chess): Record<string, PieceType> {
  const map: Record<string, PieceType> = {};
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const sq = FILES[c] + String(8 - r);
        map[sq] = `${piece.color}${piece.type}` as PieceType;
      }
    }
  }
  return map;
}

/** Find the king's square for a given color. */
export function findKingSquare(chess: Chess, color: Player): string | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece?.type === "k" && piece.color === color) {
        return FILES[c] + String(8 - r);
      }
    }
  }
  return null;
}

/**
 * Pre-compute all legal moves as a map: fromSquare -> [toSquare, ...].
 * Also tracks which moves are promotions.
 */
export function computeLegalMap(chess: Chess): {
  moves: Record<string, string[]>;
  promotions: Record<string, boolean>; // "e7e8" -> true
} {
  const moves: Record<string, string[]> = {};
  const promotions: Record<string, boolean> = {};
  const allMoves = chess.moves({ verbose: true });
  for (const m of allMoves) {
    if (!moves[m.from]) moves[m.from] = [];
    if (!moves[m.from].includes(m.to)) moves[m.from].push(m.to);
    if (m.promotion) {
      promotions[`${m.from}${m.to}`] = true;
    }
  }
  return { moves, promotions };
}

/**
 * The first character of a PieceType is its side ("w" or "b"). Centralized
 * so callers don't reach into the string by index — makes it safer to swap
 * the PieceType encoding later.
 */
export function pieceSide(piece: PieceType): Player {
  "worklet";
  return piece[0] as Player;
}

/**
 * All 64 algebraic squares, precomputed once at module load.
 * Used by legal-move-dots, arrows-layer, and external-highlights.
 */
export const ALL_SQUARES: string[] = (() => {
  const out: string[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      out.push(String.fromCharCode(97 + c) + String(8 - r));
    }
  }
  return out;
})();
