import type { Chess, Move, PieceSymbol } from "chess.ts";
import type { ImageSourcePropType, TextStyle } from "react-native";

export type Square =
  | "a8" | "b8" | "c8" | "d8" | "e8" | "f8" | "g8" | "h8"
  | "a7" | "b7" | "c7" | "d7" | "e7" | "f7" | "g7" | "h7"
  | "a6" | "b6" | "c6" | "d6" | "e6" | "f6" | "g6" | "h6"
  | "a5" | "b5" | "c5" | "d5" | "e5" | "f5" | "g5" | "h5"
  | "a4" | "b4" | "c4" | "d4" | "e4" | "f4" | "g4" | "h4"
  | "a3" | "b3" | "c3" | "d3" | "e3" | "f3" | "g3" | "h3"
  | "a2" | "b2" | "c2" | "d2" | "e2" | "f2" | "g2" | "h2"
  | "a1" | "b1" | "c1" | "d1" | "e1" | "f1" | "g1" | "h1";

export type Player = "w" | "b";
export type PieceType = `${Player}${"q" | "r" | "n" | "b" | "k" | "p"}`;

/** Visual orientation of the board. Independent of which side can move. */
export type BoardOrientation = "white" | "black";

/**
 * Which color the local user is allowed to move. "both" enables analysis
 * mode where either side can be moved freely.
 */
export type PlayerSide = "white" | "black" | "both";

export interface BoardColors {
  light: string;
  dark: string;
  lastMoveHighlight: string;
  checkHighlight: string;
  selectedSquare: string;
  legalMoveDot: string;
  promotionPieceButton: string;
  /** Default arrow color when an Arrow doesn't override it. */
  arrow: string;
  /** Default external-highlight color when a SquareHighlight doesn't override it. */
  externalHighlight: string;
  /** Coordinate label color on light squares (uses dark color by default). */
  coordinateLight: string;
  /** Coordinate label color on dark squares (uses light color by default). */
  coordinateDark: string;
  /** Tint used for the queued-premove ring + arrow. */
  premove: string;
}

export const DEFAULT_COLORS: BoardColors = {
  light: "#edeed1",
  dark: "#779952",
  lastMoveHighlight: "rgba(255, 255, 0, 0.4)",
  checkHighlight: "rgba(231, 76, 60, 0.55)",
  selectedSquare: "rgba(255, 255, 0, 0.5)",
  legalMoveDot: "rgba(0, 0, 0, 0.15)",
  promotionPieceButton: "#779952",
  arrow: "rgba(255, 170, 0, 0.85)",
  externalHighlight: "rgba(255, 170, 0, 0.6)",
  coordinateLight: "#779952",
  coordinateDark: "#edeed1",
  premove: "rgba(231, 76, 60, 0.7)",
};

/**
 * A consumer-supplied arrow drawn on top of the board. Pointer events
 * are disabled on the arrow layer so arrows never block gestures.
 */
export interface Arrow {
  from: Square;
  to: Square;
  /** Defaults to `colors.arrow`. */
  color?: string;
  /**
   * Stroke width as a fraction of one square (0..1). Defaults to ~0.18.
   */
  width?: number;
}

/**
 * A consumer-supplied square highlight. `ring` draws a hollow border;
 * `fill` paints the square. Both ignore pointer events.
 */
export interface SquareHighlight {
  square: Square;
  type?: "ring" | "fill";
  /** Defaults to `colors.externalHighlight`. */
  color?: string;
}

export interface ChessboardProps {
  /**
   * Controlled mode. If supplied, the board reads/writes this Chess
   * instance directly. Mutually exclusive with `fen`; if both are
   * given, `chess` wins.
   */
  chess?: Chess;
  /**
   * Uncontrolled mode. If `chess` is omitted, the board owns an
   * internal Chess instance initialized from this FEN string. Setting
   * `fen` later calls `chess.load(fen)` so the board can be reset
   * declaratively.
   */
  fen?: string;
  boardSize: number;
  /** Visual orientation. Default: "white". */
  boardOrientation?: BoardOrientation;
  /** Which side can move. Default: "both" (analysis mode). */
  playerSide?: PlayerSide;
  colors?: Partial<BoardColors>;
  /**
   * Per-piece overrides for the default piece images. Any pieces not
   * listed fall back to `DEFAULT_PIECES`.
   */
  pieces?: Partial<Record<PieceType, ImageSourcePropType>>;
  /**
   * Full custom renderer. If provided, called for every piece in place
   * of the default `<Image>`. Returning `null` hides the piece.
   */
  renderPiece?: (piece: PieceType, size: number) => React.ReactElement | null;
  /** Show file/rank labels in the corners. Default: true. */
  showCoordinates?: boolean;
  /** Style overrides for the coordinate labels. */
  coordinateStyle?: TextStyle;
  /** Read-only highlights drawn between the highlight layer and pieces. */
  highlightedSquares?: SquareHighlight[];
  /** Read-only arrows drawn between the highlight layer and pieces. */
  arrows?: Arrow[];
  gestureEnabled?: boolean;
  animationDuration?: number;
  soundEnabled?: boolean;
  hapticsEnabled?: boolean;
  /**
   * Allow the user to queue a move during the opponent's turn. The
   * queued move auto-applies as soon as it becomes legal; if the
   * opponent's actual move makes it illegal, the premove is cleared
   * silently. Premoves require `playerSide` to be "white" or "black"
   * — they're a no-op in analysis mode (`playerSide: "both"`).
   */
  premovesEnabled?: boolean;
  onMove?: (move: Move) => void;
  /**
   * Fires on any tap that does not result in a move or piece selection.
   * Receives the tapped square (or `null` if outside the board, which
   * shouldn't happen via the gesture layer but is reserved for future
   * use). Useful for puzzle editors and click-to-arrow workflows.
   */
  onSquarePress?: (square: Square) => void;
}

export interface ChessboardRef {
  animateMove: (from: string, to: string, promotion?: string) => void;
  syncFromChess: () => void;
  /**
   * Reset the board. In uncontrolled mode, calls `chess.load(fen ??
   * STARTING_FEN)` on the internal instance. In controlled mode, the
   * caller is responsible for resetting their own Chess instance — this
   * just re-syncs the visual layer afterwards.
   */
  reset: (fen?: string) => void;
  /** Returns the current FEN of whichever Chess instance the board uses. */
  getFen: () => string;
  /** Clear any queued premove. No-op when `premovesEnabled` is false. */
  cancelPremove: () => void;
}

export type { Move, PieceSymbol, Chess };
