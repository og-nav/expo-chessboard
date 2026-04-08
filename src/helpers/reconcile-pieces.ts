import type { PieceType, Player } from "../types";

/**
 * Mutable state carried across reconciliation calls. The reconciler
 * mutates `keySquareMap` (the map from each React key to its current
 * square) and `nextKeyId` (a monotonically increasing id used when a
 * fresh piece needs a brand-new key).
 *
 * In the host component this is held in a `useRef` so it survives
 * re-renders. The pure-function shape makes it trivial to unit-test
 * without React, Reanimated, or jsdom — exactly the testability win
 * the chessboard-v2 design originally lacked.
 */
export interface ReconcileState {
  keySquareMap: Map<string, string>;
  nextKeyId: number;
}

export interface PieceEntry {
  key: string;
  piece: PieceType;
  square: string;
}

export function createReconcileState(): ReconcileState {
  return { keySquareMap: new Map(), nextKeyId: 0 };
}

const PROMOTION_KINDS = new Set(["q", "r", "b", "n"]);

/**
 * Diff `oldMap` against `newMap` and decide which React key each piece
 * in `newMap` should keep. Reusing the same key across two consecutive
 * renders means the same `<AnimatedPiece>` instance survives, so its
 * `useEffect` fires and `withTiming` slides it from the old square to
 * the new one.
 *
 * The four resolution branches are tried in order:
 *
 *  1. Identity match — the same piece type sat on this square last
 *     render. Trivially the same instance.
 *
 *  2. Move match — there's an unused key whose old square is now empty
 *     and which carried the same piece type. This is the common case
 *     for normal moves, captures, en passant, and castling (king e1→g1
 *     while h1 rook also moves to f1 — both find their old keys via
 *     this branch).
 *
 *  3. Promotion match — the new entry is a non-pawn on the back rank,
 *     and there's a same-color pawn on the rank-7/2 source square that
 *     just emptied. Reuse the pawn's key. The `<Image>` source swaps
 *     automatically because `piece` is a prop on the component, so the
 *     pawn morphs into a queen mid-slide. Same-file (push-promotion) is
 *     preferred over adjacent-file (capture-promotion). This is the
 *     fix for the bug #9 promotion-pop the chessboard-v2 audit flagged.
 *
 *  4. Fresh — nothing matched. Allocate a new key. This is what the
 *     initial render does for all 32 pieces.
 *
 * After resolving every entry in `newMap`, any keys still in
 * `keySquareMap` that weren't claimed get dropped — those are
 * captured/removed pieces.
 *
 * The function MUTATES `state` in place. Callers must keep the same
 * `ReconcileState` object across calls; recreating it would lose all
 * key continuity and every piece would re-mount.
 */
export function reconcilePieces(
  state: ReconcileState,
  oldMap: Record<string, PieceType>,
  newMap: Record<string, PieceType>
): PieceEntry[] {
  const entries: PieceEntry[] = [];
  const usedKeys = new Set<string>();

  for (const [sq, piece] of Object.entries(newMap)) {
    let foundKey: string | null = null;

    // 1. Identity — same piece type was already on this square.
    for (const [key, oldSq] of state.keySquareMap) {
      if (oldSq === sq && oldMap[sq] === piece && !usedKeys.has(key)) {
        foundKey = key;
        break;
      }
    }

    // 2. Move — an unused key carried this piece type and its old
    //    square is now empty (so the piece visibly moved).
    if (!foundKey) {
      for (const [key, oldSq] of state.keySquareMap) {
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

    // 3. Promotion — bug #9 fix. A new non-pawn on the back rank
    //    matches a same-color pawn that just disappeared from the
    //    seventh (white) or second (black) rank.
    if (!foundKey) {
      foundKey = findPromotionKey(state, oldMap, newMap, sq, piece, usedKeys);
    }

    // 4. Fresh key — initial render or genuine new piece.
    if (!foundKey) {
      foundKey = `p${state.nextKeyId++}`;
    }

    usedKeys.add(foundKey);
    state.keySquareMap.set(foundKey, sq);
    entries.push({ key: foundKey, piece, square: sq });
  }

  // Drop keys whose pieces were captured or otherwise removed.
  for (const key of [...state.keySquareMap.keys()]) {
    if (!usedKeys.has(key)) {
      state.keySquareMap.delete(key);
    }
  }

  return entries;
}

/**
 * Promotion key-reuse helper. Returns a key id from `state.keySquareMap`
 * if and only if `piece` is a non-pawn on the back rank and there is an
 * unused same-color pawn on the rank just behind the back rank whose
 * square is now empty.
 *
 * Same-file (push-promotion) wins over adjacent-file (capture-promotion)
 * if both are present, since under-promotions to mass-attack a piece are
 * vanishingly rare and the same-file pawn is the visually-correct one in
 * 99% of games.
 *
 * The reverse direction (queen → pawn on undo) also works through this
 * branch when `oldMap` contains the queen on rank 8 and `newMap` contains
 * a pawn on rank 7 — the symmetry falls out of the same comparison run
 * with the maps swapped, which the M5 undo path takes advantage of.
 */
function findPromotionKey(
  state: ReconcileState,
  oldMap: Record<string, PieceType>,
  newMap: Record<string, PieceType>,
  sq: string,
  piece: PieceType,
  usedKeys: Set<string>
): string | null {
  const color = piece[0] as Player;
  const kind = piece[1];
  if (!PROMOTION_KINDS.has(kind)) return null;

  const sqRank = sq[1];
  const isBackRank =
    (color === "w" && sqRank === "8") || (color === "b" && sqRank === "1");
  if (!isBackRank) return null;

  const sourceRank = color === "w" ? "7" : "2";
  const sourcePawn = `${color}p` as PieceType;
  const sqFileCode = sq.charCodeAt(0);

  let bestKey: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [key, oldSq] of state.keySquareMap) {
    if (usedKeys.has(key)) continue;
    if (oldMap[oldSq] !== sourcePawn) continue;
    if (oldSq[1] !== sourceRank) continue;
    if (newMap[oldSq]) continue; // pawn must have left its square

    const fileDist = Math.abs(oldSq.charCodeAt(0) - sqFileCode);
    if (fileDist > 1) continue;

    if (fileDist < bestDistance) {
      bestDistance = fileDist;
      bestKey = key;
      if (fileDist === 0) break; // can't beat the same-file match
    }
  }
  return bestKey;
}
