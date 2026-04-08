import type { Chess, Move, PieceSymbol } from "chess.ts";

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
}

export const DEFAULT_COLORS: BoardColors = {
  light: "#edeed1",
  dark: "#779952",
  lastMoveHighlight: "rgba(255, 255, 0, 0.4)",
  checkHighlight: "rgba(231, 76, 60, 0.55)",
  selectedSquare: "rgba(255, 255, 0, 0.5)",
  legalMoveDot: "rgba(0, 0, 0, 0.15)",
  promotionPieceButton: "#779952",
};

export interface ChessboardProps {
  chess: Chess;
  boardSize: number;
  /** Visual orientation. Default: "white". */
  boardOrientation?: BoardOrientation;
  /** Which side can move. Default: "both" (analysis mode). */
  playerSide?: PlayerSide;
  /**
   * @deprecated Use `boardOrientation` and `playerSide` instead.
   * Setting `playerColor` is equivalent to setting both
   * `boardOrientation` and `playerSide` to the matching color.
   */
  playerColor?: Player;
  colors?: Partial<BoardColors>;
  gestureEnabled?: boolean;
  animationDuration?: number;
  soundEnabled?: boolean;
  hapticsEnabled?: boolean;
  onMove?: (move: Move) => void;
}

export interface ChessboardRef {
  animateMove: (from: string, to: string, promotion?: string) => void;
  syncFromChess: () => void;
}

export type { Move, PieceSymbol, Chess };
