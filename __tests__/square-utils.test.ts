import { Chess } from "chess.ts";
import {
  ALL_SQUARES,
  buildPieceMap,
  computeLegalMap,
  findKingSquare,
  pieceSide,
  squareToColRow,
  squareToXY,
  xyToSquare,
} from "../src/helpers/square-utils";

// These are pure functions — no React, no Reanimated, no jsdom. The
// "worklet" directive at the top of each function is just a string
// literal in plain JS, so they execute identically here.

const PIECE_SIZE = 40;

describe("squareToColRow", () => {
  test("a1 is bottom-left from white's perspective (col 0 row 7)", () => {
    expect(squareToColRow("a1")).toEqual({ col: 0, row: 7 });
  });

  test("h8 is top-right from white's perspective (col 7 row 0)", () => {
    expect(squareToColRow("h8")).toEqual({ col: 7, row: 0 });
  });

  test("e4 maps correctly", () => {
    expect(squareToColRow("e4")).toEqual({ col: 4, row: 4 });
  });
});

describe("squareToXY / xyToSquare round-trip", () => {
  // Round-tripping every square in both orientations is the cheapest
  // possible insurance against off-by-one bugs in the flip math, which
  // is the kind of thing that's easy to miss in manual testing.
  test.each([false, true])(
    "every square round-trips when flipped=%s",
    (flipped) => {
      for (const sq of ALL_SQUARES) {
        const { x, y } = squareToXY(sq, PIECE_SIZE, flipped);
        // Tap the center of the square to avoid boundary edge cases
        const centerX = x + PIECE_SIZE / 2;
        const centerY = y + PIECE_SIZE / 2;
        expect(xyToSquare(centerX, centerY, PIECE_SIZE, flipped)).toBe(sq);
      }
    }
  );

  test("flipping inverts a1 and h8", () => {
    const a1 = squareToXY("a1", PIECE_SIZE, false);
    const a1Flipped = squareToXY("a1", PIECE_SIZE, true);
    const h8 = squareToXY("h8", PIECE_SIZE, false);
    expect(a1Flipped).toEqual(h8);
    expect(squareToXY("h8", PIECE_SIZE, true)).toEqual(a1);
  });

  test("xyToSquare clamps out-of-bounds taps to the edge", () => {
    expect(xyToSquare(-100, -100, PIECE_SIZE, false)).toBe("a8");
    expect(xyToSquare(100000, 100000, PIECE_SIZE, false)).toBe("h1");
  });
});

describe("buildPieceMap", () => {
  test("starting position has 32 pieces", () => {
    const chess = new Chess();
    const map = buildPieceMap(chess);
    expect(Object.keys(map)).toHaveLength(32);
  });

  test("starting position has the right pieces in the right squares", () => {
    const chess = new Chess();
    const map = buildPieceMap(chess);
    expect(map.e1).toBe("wk");
    expect(map.e8).toBe("bk");
    expect(map.a1).toBe("wr");
    expect(map.h8).toBe("br");
    expect(map.d1).toBe("wq");
    expect(map.d8).toBe("bq");
    expect(map.e2).toBe("wp");
    expect(map.e7).toBe("bp");
  });

  test("after e2-e4 the pawn map reflects the move", () => {
    const chess = new Chess();
    chess.move({ from: "e2", to: "e4" });
    const map = buildPieceMap(chess);
    expect(map.e2).toBeUndefined();
    expect(map.e4).toBe("wp");
  });
});

describe("findKingSquare", () => {
  test("starting position", () => {
    const chess = new Chess();
    expect(findKingSquare(chess, "w")).toBe("e1");
    expect(findKingSquare(chess, "b")).toBe("e8");
  });

  test("after castling kingside, white king is on g1", () => {
    const chess = new Chess(
      "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPBPPP/RNBQK2R w KQkq - 0 1"
    );
    chess.move({ from: "e1", to: "g1" });
    expect(findKingSquare(chess, "w")).toBe("g1");
  });
});

describe("computeLegalMap", () => {
  test("starting position has 20 legal moves total", () => {
    const chess = new Chess();
    const { moves } = computeLegalMap(chess);
    const total = Object.values(moves).reduce(
      (acc, targets) => acc + targets.length,
      0
    );
    expect(total).toBe(20); // 16 pawn moves + 4 knight moves
  });

  test("e2 pawn has two legal targets", () => {
    const chess = new Chess();
    const { moves } = computeLegalMap(chess);
    expect(moves.e2?.sort()).toEqual(["e3", "e4"]);
  });

  test("flags promotion moves", () => {
    const chess = new Chess("8/P7/8/8/8/8/8/k6K w - - 0 1");
    const { promotions } = computeLegalMap(chess);
    expect(promotions["a7a8"]).toBe(true);
  });

  test("does not flag a non-promoting pawn move", () => {
    const chess = new Chess();
    const { promotions } = computeLegalMap(chess);
    expect(promotions["e2e4"]).toBeUndefined();
  });
});

describe("pieceSide", () => {
  test("returns the first character as the side", () => {
    expect(pieceSide("wp")).toBe("w");
    expect(pieceSide("bk")).toBe("b");
    expect(pieceSide("wq")).toBe("w");
  });
});

describe("ALL_SQUARES", () => {
  test("contains exactly 64 unique squares", () => {
    expect(ALL_SQUARES).toHaveLength(64);
    expect(new Set(ALL_SQUARES).size).toBe(64);
  });

  test("includes the corners", () => {
    expect(ALL_SQUARES).toContain("a1");
    expect(ALL_SQUARES).toContain("a8");
    expect(ALL_SQUARES).toContain("h1");
    expect(ALL_SQUARES).toContain("h8");
  });
});
