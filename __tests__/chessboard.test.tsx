import React, { createRef } from "react";
import { render, act } from "@testing-library/react-native";
import { Chess } from "chess.ts";
import Chessboard from "../src/Chessboard";
import type { ChessboardRef } from "../src/types";

/**
 * Component-level smoke tests. The point isn't to re-test reconciliation
 * or square math (those have dedicated pure-JS suites) — it's to verify
 * the public surface boots without crashing under jest-expo and that
 * the imperative ref methods do what they claim.
 *
 * Gesture-driven flows (drag, drop, tap-to-select) live in the
 * example/ smoke test list — Reanimated worklets + GestureHandler can't
 * be exercised meaningfully under jsdom.
 */

describe("Chessboard mounting", () => {
  test("renders in uncontrolled mode without crashing", () => {
    expect(() => render(<Chessboard boardSize={320} />)).not.toThrow();
  });

  test("renders in controlled mode with an external Chess instance", () => {
    const chess = new Chess();
    expect(() =>
      render(<Chessboard boardSize={320} chess={chess} />)
    ).not.toThrow();
  });

  test("renders with all custom props enabled", () => {
    expect(() =>
      render(
        <Chessboard
          boardSize={320}
          boardOrientation="black"
          playerSide="white"
          showCoordinates={false}
          highlightedSquares={[{ square: "e4", type: "ring" }]}
          arrows={[{ from: "e2", to: "e4" }]}
          soundEnabled={false}
          hapticsEnabled={false}
          premovesEnabled
        />
      )
    ).not.toThrow();
  });
});

describe("Chessboard ref API", () => {
  test("getFen returns the starting position", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);
    expect(ref.current?.getFen()).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
  });

  test("animateMove updates the board and fires onMove", () => {
    const ref = createRef<ChessboardRef>();
    const onMove = jest.fn();
    render(<Chessboard ref={ref} boardSize={320} onMove={onMove} />);

    act(() => {
      ref.current?.animateMove("e2", "e4");
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0][0].from).toBe("e2");
    expect(onMove.mock.calls[0][0].to).toBe("e4");
    expect(ref.current?.getFen()).toContain("/4P3/");
  });

  test("reset(fen) loads a new position in uncontrolled mode", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    const newFen = "8/8/8/8/8/8/8/4K2k w - - 0 1";
    act(() => {
      ref.current?.reset(newFen);
    });
    expect(ref.current?.getFen()).toBe(newFen);
  });
});

describe("Chessboard history scrubbing (M5)", () => {
  test("undo / redo round-trip leaves the board where it started", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    const startFen = ref.current!.getFen();

    act(() => {
      ref.current?.animateMove("e2", "e4");
      ref.current?.animateMove("e7", "e5");
      ref.current?.animateMove("g1", "f3");
    });
    expect(ref.current?.getMoveIndex()).toBe(3);

    act(() => {
      ref.current?.undo();
      ref.current?.undo();
      ref.current?.undo();
    });
    expect(ref.current?.getMoveIndex()).toBe(0);
    expect(ref.current?.getFen()).toBe(startFen);
    expect(ref.current?.canUndo()).toBe(false);
    expect(ref.current?.canRedo()).toBe(true);

    act(() => {
      ref.current?.redo();
      ref.current?.redo();
      ref.current?.redo();
    });
    expect(ref.current?.getMoveIndex()).toBe(3);
    expect(ref.current?.canRedo()).toBe(false);
  });

  test("making a new move while not at the head clears the redo stack", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    act(() => {
      ref.current?.animateMove("e2", "e4");
      ref.current?.animateMove("e7", "e5");
    });
    expect(ref.current?.getMoveIndex()).toBe(2);

    // Undo back to the starting position so it's white to move again.
    // (Undoing only once would land at "after e2-e4, black to move",
    // and a subsequent white d2-d4 would be illegal — chess.ts would
    // silently return null and never reach the redo-clear branch.)
    act(() => {
      ref.current?.undo();
      ref.current?.undo();
    });
    expect(ref.current?.canRedo()).toBe(true);

    // Make a different move — branching point, redo stack invalidates
    act(() => {
      ref.current?.animateMove("d2", "d4");
    });
    expect(ref.current?.canRedo()).toBe(false);
    expect(ref.current?.getMoveIndex()).toBe(1);
  });

  test("goToMoveIndex jumps to an absolute ply", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    act(() => {
      ref.current?.animateMove("e2", "e4");
      ref.current?.animateMove("e7", "e5");
      ref.current?.animateMove("g1", "f3");
      ref.current?.animateMove("b8", "c6");
    });
    expect(ref.current?.getMoveIndex()).toBe(4);

    act(() => {
      ref.current?.goToMoveIndex(2);
    });
    expect(ref.current?.getMoveIndex()).toBe(2);
    expect(ref.current?.canRedo()).toBe(true);

    act(() => {
      ref.current?.goToMoveIndex(0);
    });
    expect(ref.current?.getMoveIndex()).toBe(0);

    act(() => {
      ref.current?.goToMoveIndex(4);
    });
    expect(ref.current?.getMoveIndex()).toBe(4);
  });
});

describe("Chessboard ref API — animateMove edge cases", () => {
  test("animateMove with promotion parameter promotes the pawn", () => {
    const ref = createRef<ChessboardRef>();
    const onMove = jest.fn();
    const chess = new Chess("k7/4P3/8/8/8/8/8/7K w - - 0 1");
    render(
      <Chessboard
        ref={ref}
        boardSize={320}
        onMove={onMove}
        chess={chess}
      />
    );

    act(() => {
      ref.current?.animateMove("e7", "e8", "q");
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0][0].promotion).toBe("q");
    // FEN should have a white queen on e8, not a pawn
    expect(ref.current?.getFen()).toContain("Q");
  });

  test("animateMove with an illegal move does not crash or fire onMove", () => {
    const ref = createRef<ChessboardRef>();
    const onMove = jest.fn();
    render(<Chessboard ref={ref} boardSize={320} onMove={onMove} />);

    const fenBefore = ref.current?.getFen();

    // a1 has a rook but a2 is blocked by a pawn — illegal
    expect(() => {
      act(() => {
        ref.current?.animateMove("a1", "a2");
      });
    }).not.toThrow();

    expect(onMove).not.toHaveBeenCalled();
    expect(ref.current?.getFen()).toBe(fenBefore);
  });
});

describe("Chessboard ref API — goToMoveIndex clamping", () => {
  test("negative index clamps to 0", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    act(() => {
      ref.current?.animateMove("e2", "e4");
      ref.current?.animateMove("e7", "e5");
    });

    act(() => {
      ref.current?.goToMoveIndex(-5);
    });

    expect(ref.current?.getMoveIndex()).toBe(0);
  });

  test("index beyond total clamps to the end", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    act(() => {
      ref.current?.animateMove("e2", "e4");
      ref.current?.animateMove("e7", "e5");
    });

    act(() => {
      ref.current?.goToMoveIndex(100);
    });

    expect(ref.current?.getMoveIndex()).toBe(2);
  });
});

describe("Chessboard ref API — getMoveCount vs getMoveIndex", () => {
  test("getMoveCount stays at full length after undo while getMoveIndex decreases", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    act(() => {
      ref.current?.animateMove("e2", "e4");
      ref.current?.animateMove("e7", "e5");
      ref.current?.animateMove("g1", "f3");
    });

    expect(ref.current?.getMoveCount()).toBe(3);
    expect(ref.current?.getMoveIndex()).toBe(3);

    act(() => {
      ref.current?.undo();
      ref.current?.undo();
    });

    // Cursor moved back but total reachable moves unchanged
    expect(ref.current?.getMoveIndex()).toBe(1);
    expect(ref.current?.getMoveCount()).toBe(3);
  });
});

describe("Chessboard ref API — reset clears redo stack", () => {
  test("reset() after undo makes canRedo false", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    act(() => {
      ref.current?.animateMove("e2", "e4");
      ref.current?.animateMove("e7", "e5");
    });

    act(() => {
      ref.current?.undo();
    });
    expect(ref.current?.canRedo()).toBe(true);

    act(() => {
      ref.current?.reset();
    });
    expect(ref.current?.canRedo()).toBe(false);
    expect(ref.current?.getMoveCount()).toBe(0);
  });
});

describe("Chessboard ref API — variation preview", () => {
  test("previewLine renders the end of the line by default", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    const liveBefore = ref.current!.getFen();

    act(() => {
      ref.current?.previewLine(["e4", "e5", "Nf3"]);
    });

    expect(ref.current?.isPreviewing()).toBe(true);
    expect(ref.current?.getPreviewIndex()).toBe(3);
    expect(ref.current?.getPreviewLength()).toBe(3);
    // Live FEN is untouched — only the displayed FEN advanced.
    expect(ref.current?.getFen()).toBe(liveBefore);
    expect(ref.current?.getDisplayedFen()).not.toBe(liveBefore);
    // After 1.e4 e5 2.Nf3 the knight sits on f3.
    expect(ref.current?.getDisplayedFen()).toContain("/5N2/");
  });

  test("previewLine with explicit index lands at that step", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    act(() => {
      ref.current?.previewLine(["e4", "e5", "Nf3"], 0);
    });

    expect(ref.current?.getPreviewIndex()).toBe(0);
    // Index 0 = base position; displayed equals live.
    expect(ref.current?.getDisplayedFen()).toBe(ref.current?.getFen());
  });

  test("step forward / back walks through the line", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    act(() => {
      ref.current?.previewLine(["e4", "e5", "Nf3"], 0);
    });

    act(() => {
      const ok = ref.current?.stepPreviewForward();
      expect(ok).toBe(true);
    });
    expect(ref.current?.getPreviewIndex()).toBe(1);

    act(() => {
      ref.current?.stepPreviewForward();
      ref.current?.stepPreviewForward();
    });
    expect(ref.current?.getPreviewIndex()).toBe(3);

    // At the end — further forward steps return false.
    act(() => {
      const ok = ref.current?.stepPreviewForward();
      expect(ok).toBe(false);
    });
    expect(ref.current?.getPreviewIndex()).toBe(3);

    act(() => {
      ref.current?.stepPreviewBack();
    });
    expect(ref.current?.getPreviewIndex()).toBe(2);
  });

  test("exitPreview returns to live without mutating Chess", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    const live = ref.current!.getFen();

    act(() => {
      ref.current?.previewLine(["e4", "e5"]);
    });
    expect(ref.current?.isPreviewing()).toBe(true);

    act(() => {
      ref.current?.exitPreview();
    });

    expect(ref.current?.isPreviewing()).toBe(false);
    expect(ref.current?.getFen()).toBe(live);
    expect(ref.current?.getDisplayedFen()).toBe(live);
    expect(ref.current?.getPreviewIndex()).toBe(0);
    expect(ref.current?.getPreviewLength()).toBe(0);
  });

  test("animateMove while previewing exits preview and applies the move to live", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    act(() => {
      ref.current?.previewLine(["e4", "e5", "Nf3"]);
    });
    expect(ref.current?.isPreviewing()).toBe(true);

    // Simulate "live move pushed from Lichess".
    act(() => {
      ref.current?.animateMove("e2", "e4");
    });

    expect(ref.current?.isPreviewing()).toBe(false);
    expect(ref.current?.getMoveIndex()).toBe(1);
    expect(ref.current?.getFen()).toBe(ref.current?.getDisplayedFen());
  });

  test("invalid SAN aborts preview entry without changing state", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    const live = ref.current!.getFen();

    act(() => {
      ref.current?.previewLine(["e4", "definitely-not-san"]);
    });

    expect(ref.current?.isPreviewing()).toBe(false);
    expect(ref.current?.getFen()).toBe(live);
    expect(ref.current?.getDisplayedFen()).toBe(live);
  });

  test("onPreviewChange fires on enter, step, and exit", () => {
    const ref = createRef<ChessboardRef>();
    const onPreviewChange = jest.fn();
    render(
      <Chessboard
        ref={ref}
        boardSize={320}
        onPreviewChange={onPreviewChange}
      />
    );

    act(() => {
      ref.current?.previewLine(["e4", "e5"], 0);
    });
    expect(onPreviewChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ active: true, index: 0, length: 2 })
    );

    act(() => {
      ref.current?.stepPreviewForward();
    });
    expect(onPreviewChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ active: true, index: 1, length: 2 })
    );

    act(() => {
      ref.current?.exitPreview();
    });
    expect(onPreviewChange).toHaveBeenLastCalledWith(null);
  });

  test("calling previewLine again replaces the active line", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    act(() => {
      ref.current?.previewLine(["e4", "e5"]);
    });
    const firstFen = ref.current?.getDisplayedFen();

    act(() => {
      ref.current?.previewLine(["d4", "d5", "c4"]);
    });

    expect(ref.current?.getPreviewLength()).toBe(3);
    expect(ref.current?.getPreviewIndex()).toBe(3);
    expect(ref.current?.getDisplayedFen()).not.toBe(firstFen);
  });

  test("step methods return false when not previewing", () => {
    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} />);

    expect(ref.current?.stepPreviewForward()).toBe(false);
    expect(ref.current?.stepPreviewBack()).toBe(false);
    expect(ref.current?.isPreviewing()).toBe(false);
  });
});

describe("Chessboard sound mock", () => {
  // Fake timers are scoped to this describe — animateMove defers the
  // sound trigger via setTimeout(animationDuration), so we need to
  // advance manually. Earlier tests in the file run with real timers
  // to avoid leaving orphaned timers that would fire here and call
  // play() against the shared mock player.
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test("soundEnabled={false} prevents the audio player play() call", () => {
    // The mocked useAudioPlayer returns the same player object so we
    // can introspect call counts on it across renders.
    const audio = jest.requireMock("expo-audio") as {
      __mockPlayer: { play: jest.Mock; seekTo: jest.Mock };
    };
    audio.__mockPlayer.play.mockClear();

    const ref = createRef<ChessboardRef>();
    render(<Chessboard ref={ref} boardSize={320} soundEnabled={false} />);

    act(() => {
      ref.current?.animateMove("e2", "e4");
    });

    // animateMove schedules the sound on a setTimeout based on
    // animationDuration (default 150ms) — flush it.
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(audio.__mockPlayer.play).not.toHaveBeenCalled();
  });
});
