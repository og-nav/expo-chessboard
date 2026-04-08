import { Chess } from "chess.ts";
import { buildPieceMap } from "../src/helpers/square-utils";
import {
  createReconcileState,
  reconcilePieces,
  type PieceEntry,
} from "../src/helpers/reconcile-pieces";

/**
 * The highest-leverage test file in the package. `reconcilePieces` is a
 * pure function — these tests run with no React, no Reanimated, no
 * jsdom — so they can pin down all four reconciliation branches
 * (identity, move, forward promotion, backward promotion) without any
 * mocking gymnastics. Bug #9 (promotion popping instead of animating)
 * is regression-tested directly here.
 */

function entryFor(entries: PieceEntry[], square: string): PieceEntry {
  const found = entries.find((e) => e.square === square);
  if (!found) {
    throw new Error(`No piece at ${square}: ${JSON.stringify(entries)}`);
  }
  return found;
}

function keysOf(entries: PieceEntry[]): Set<string> {
  return new Set(entries.map((e) => e.key));
}

describe("reconcilePieces — initial render", () => {
  test("starting position produces 32 unique keys", () => {
    const state = createReconcileState();
    const chess = new Chess();
    const entries = reconcilePieces(state, {}, buildPieceMap(chess));

    expect(entries).toHaveLength(32);
    expect(keysOf(entries).size).toBe(32);
  });
});

describe("reconcilePieces — branch 2 (move match)", () => {
  test("e2-e4 reuses the pawn's key", () => {
    const state = createReconcileState();
    const chess = new Chess();
    const initial = reconcilePieces(state, {}, buildPieceMap(chess));
    const e2Key = entryFor(initial, "e2").key;

    const oldMap = buildPieceMap(chess);
    chess.move({ from: "e2", to: "e4" });
    const after = reconcilePieces(state, oldMap, buildPieceMap(chess));

    expect(entryFor(after, "e4").key).toBe(e2Key);
    // The piece type is still a white pawn — branch 2 (move) handles
    // it via the same-piece-type match, not the promotion branches.
    expect(entryFor(after, "e4").piece).toBe("wp");
  });

  test("kingside castling reuses both king and h1 rook keys", () => {
    const state = createReconcileState();
    const chess = new Chess(
      "rnbq1rk1/ppppbppp/5n2/4p3/4P3/5N2/PPPPBPPP/RNBQK2R w KQ - 0 1"
    );
    const initial = reconcilePieces(state, {}, buildPieceMap(chess));
    const kingKey = entryFor(initial, "e1").key;
    const hRookKey = entryFor(initial, "h1").key;
    const aRookKey = entryFor(initial, "a1").key;

    const oldMap = buildPieceMap(chess);
    chess.move({ from: "e1", to: "g1" });
    const after = reconcilePieces(state, oldMap, buildPieceMap(chess));

    expect(entryFor(after, "g1").key).toBe(kingKey);
    expect(entryFor(after, "f1").key).toBe(hRookKey);
    // a1 rook is untouched by castling — it should keep its key AND
    // its square via branch 1 (identity), not get reassigned.
    expect(entryFor(after, "a1").key).toBe(aRookKey);
  });

  test("queenside castling reuses both king and a1 rook keys", () => {
    const state = createReconcileState();
    const chess = new Chess(
      "r3kbnr/pppqpppp/2np4/8/8/2NPB3/PPPQPPPP/R3KBNR w KQkq - 0 1"
    );
    const initial = reconcilePieces(state, {}, buildPieceMap(chess));
    const kingKey = entryFor(initial, "e1").key;
    const aRookKey = entryFor(initial, "a1").key;
    const hRookKey = entryFor(initial, "h1").key;

    const oldMap = buildPieceMap(chess);
    chess.move({ from: "e1", to: "c1" });
    const after = reconcilePieces(state, oldMap, buildPieceMap(chess));

    expect(entryFor(after, "c1").key).toBe(kingKey);
    expect(entryFor(after, "d1").key).toBe(aRookKey);
    expect(entryFor(after, "h1").key).toBe(hRookKey);
  });

  test("capture: capturing piece keeps its key, captured key is dropped", () => {
    const state = createReconcileState();
    const chess = new Chess();
    chess.move({ from: "e2", to: "e4" });
    chess.move({ from: "d7", to: "d5" });
    reconcilePieces(state, {}, buildPieceMap(chess));

    const beforeCapture = buildPieceMap(chess);
    const e4PawnKey = [...state.keySquareMap.entries()].find(
      ([, sq]) => sq === "e4"
    )![0];
    const d5PawnKey = [...state.keySquareMap.entries()].find(
      ([, sq]) => sq === "d5"
    )![0];

    chess.move({ from: "e4", to: "d5" });
    const after = reconcilePieces(state, beforeCapture, buildPieceMap(chess));

    // Capturing pawn keeps its key, lands on d5 with type wp
    expect(entryFor(after, "d5").key).toBe(e4PawnKey);
    expect(entryFor(after, "d5").piece).toBe("wp");
    // Captured pawn's key is gone from keySquareMap entirely
    expect([...state.keySquareMap.values()]).not.toContain("d5_captured"); // sanity
    expect(state.keySquareMap.has(d5PawnKey)).toBe(false);
  });

  test("en passant: capturing pawn keeps key, captured pawn key is dropped", () => {
    const state = createReconcileState();
    // Set up a position where en passant is legal
    const chess = new Chess(
      "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    );
    chess.move({ from: "f7", to: "f5" }); // gives white the en-passant target on f6
    reconcilePieces(state, {}, buildPieceMap(chess));

    const beforeEp = buildPieceMap(chess);
    const e5PawnKey = [...state.keySquareMap.entries()].find(
      ([, sq]) => sq === "e5"
    )![0];
    const f5PawnKey = [...state.keySquareMap.entries()].find(
      ([, sq]) => sq === "f5"
    )![0];

    // White captures en passant: e5 pawn takes the f5 pawn via f6
    chess.move({ from: "e5", to: "f6" });
    const after = reconcilePieces(state, beforeEp, buildPieceMap(chess));

    expect(entryFor(after, "f6").key).toBe(e5PawnKey);
    expect(state.keySquareMap.has(f5PawnKey)).toBe(false);
  });
});

describe("reconcilePieces — branch 3 (forward promotion, bug #9)", () => {
  test("e7-e8=Q reuses the pawn's key with the new piece type", () => {
    const state = createReconcileState();
    // White pawn on e7, kings far enough away that e8 is an empty
    // legal target. (An earlier draft of this test put the black king
    // on e8 — chess.ts silently rejected the move and the test
    // compared a stale key to itself.)
    const chess = new Chess("k7/4P3/8/8/8/8/8/7K w - - 0 1");
    reconcilePieces(state, {}, buildPieceMap(chess));
    const pawnKey = [...state.keySquareMap.entries()].find(
      ([, sq]) => sq === "e7"
    )![0];

    const beforePromotion = buildPieceMap(chess);
    chess.move({ from: "e7", to: "e8", promotion: "q" });
    const after = reconcilePieces(
      state,
      beforePromotion,
      buildPieceMap(chess)
    );

    // The pawn's React key is reused — same component instance, so
    // <AnimatedPiece>'s position effect fires and the piece slides
    // from e7 to e8 instead of popping.
    expect(entryFor(after, "e8").key).toBe(pawnKey);
    // The piece type is now a queen — the <Image> source updates
    // because `piece` is a prop on the component.
    expect(entryFor(after, "e8").piece).toBe("wq");
  });

  test("capture-promotion (d7xc8=Q) reuses the d7 pawn's key", () => {
    const state = createReconcileState();
    // Black bishop on c8 to capture, kings far away on h-file.
    const chess = new Chess("2b4k/3P4/8/8/8/8/8/7K w - - 0 1");
    reconcilePieces(state, {}, buildPieceMap(chess));
    const d7PawnKey = [...state.keySquareMap.entries()].find(
      ([, sq]) => sq === "d7"
    )![0];

    const beforePromotion = buildPieceMap(chess);
    chess.move({ from: "d7", to: "c8", promotion: "q" });
    const after = reconcilePieces(
      state,
      beforePromotion,
      buildPieceMap(chess)
    );

    // d7 pawn morphs into the c8 queen via the adjacent-file branch
    expect(entryFor(after, "c8").key).toBe(d7PawnKey);
    expect(entryFor(after, "c8").piece).toBe("wq");
  });
});

describe("reconcilePieces — branch 3b (backward promotion, M5)", () => {
  test("undoing e7-e8=Q morphs the queen back into a pawn", () => {
    const state = createReconcileState();
    const chess = new Chess("k7/4P3/8/8/8/8/8/7K w - - 0 1");
    reconcilePieces(state, {}, buildPieceMap(chess));
    const beforePromotion = buildPieceMap(chess);

    // Forward
    chess.move({ from: "e7", to: "e8", promotion: "q" });
    const promoted = buildPieceMap(chess);
    const afterForward = reconcilePieces(state, beforePromotion, promoted);
    const promotedKey = entryFor(afterForward, "e8").key;

    // Backward
    chess.undo();
    const afterBack = reconcilePieces(state, promoted, buildPieceMap(chess));

    // The same key that held the queen now holds a pawn on e7 —
    // without branch 3b this would drop the queen's key and pop a
    // fresh pawn into existence.
    expect(entryFor(afterBack, "e7").key).toBe(promotedKey);
    expect(entryFor(afterBack, "e7").piece).toBe("wp");
  });

  test("undoing capture-promotion (Qxc8 → pawn d7) also reuses the key", () => {
    const state = createReconcileState();
    const chess = new Chess("2b4k/3P4/8/8/8/8/8/7K w - - 0 1");
    reconcilePieces(state, {}, buildPieceMap(chess));
    const beforePromotion = buildPieceMap(chess);

    chess.move({ from: "d7", to: "c8", promotion: "q" });
    const promoted = buildPieceMap(chess);
    const afterForward = reconcilePieces(state, beforePromotion, promoted);
    const promotedKey = entryFor(afterForward, "c8").key;

    chess.undo();
    const afterBack = reconcilePieces(state, promoted, buildPieceMap(chess));

    // Adjacent-file branch reuses the queen's key for the pawn on d7
    expect(entryFor(afterBack, "d7").key).toBe(promotedKey);
    expect(entryFor(afterBack, "d7").piece).toBe("wp");
  });
});

describe("reconcilePieces — state cleanup", () => {
  test("captured keys are removed from keySquareMap", () => {
    const state = createReconcileState();
    const chess = new Chess();
    reconcilePieces(state, {}, buildPieceMap(chess));
    expect(state.keySquareMap.size).toBe(32);

    // Play out a few captures
    chess.move({ from: "e2", to: "e4" });
    let prev = buildPieceMap(chess);
    reconcilePieces(state, buildPieceMap(new Chess()), prev);

    chess.move({ from: "d7", to: "d5" });
    let next = buildPieceMap(chess);
    reconcilePieces(state, prev, next);
    prev = next;

    chess.move({ from: "e4", to: "d5" }); // capture
    next = buildPieceMap(chess);
    reconcilePieces(state, prev, next);

    // 31 pieces left after one capture
    expect(state.keySquareMap.size).toBe(31);
  });
});
