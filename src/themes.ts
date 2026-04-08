import { DEFAULT_COLORS, type BoardColors } from "./types";

/**
 * Named theme presets. Pass any of these to the `colors` prop:
 *
 *   <Chessboard colors={THEME_WOOD} ... />
 *
 * Each theme is a complete `BoardColors` object — there's no inheritance
 * gymnastics. Consumers can still spread + override individual fields:
 *
 *   <Chessboard colors={{ ...THEME_BLUE, legalMoveDot: "red" }} ... />
 */

export const THEME_DEFAULT: BoardColors = DEFAULT_COLORS;

/** Warm wooden board reminiscent of a tournament set. */
export const THEME_WOOD: BoardColors = {
  light: "#f0d9b5",
  dark: "#b58863",
  lastMoveHighlight: "rgba(255, 255, 51, 0.45)",
  checkHighlight: "rgba(231, 76, 60, 0.55)",
  selectedSquare: "rgba(255, 255, 51, 0.5)",
  legalMoveDot: "rgba(0, 0, 0, 0.18)",
  promotionPieceButton: "#b58863",
  arrow: "rgba(255, 170, 0, 0.85)",
  externalHighlight: "rgba(255, 170, 0, 0.6)",
  coordinateLight: "#b58863",
  coordinateDark: "#f0d9b5",
};

/** chess.com-style blue. */
export const THEME_BLUE: BoardColors = {
  light: "#dee3e6",
  dark: "#8ca2ad",
  lastMoveHighlight: "rgba(255, 255, 51, 0.4)",
  checkHighlight: "rgba(231, 76, 60, 0.55)",
  selectedSquare: "rgba(255, 255, 51, 0.5)",
  legalMoveDot: "rgba(0, 0, 0, 0.18)",
  promotionPieceButton: "#8ca2ad",
  arrow: "rgba(255, 170, 0, 0.85)",
  externalHighlight: "rgba(255, 170, 0, 0.6)",
  coordinateLight: "#8ca2ad",
  coordinateDark: "#dee3e6",
};

/** lichess-style green — same family as THEME_DEFAULT but tuned warmer. */
export const THEME_GREEN: BoardColors = {
  light: "#eeeed2",
  dark: "#769656",
  lastMoveHighlight: "rgba(255, 255, 51, 0.4)",
  checkHighlight: "rgba(231, 76, 60, 0.55)",
  selectedSquare: "rgba(255, 255, 51, 0.5)",
  legalMoveDot: "rgba(0, 0, 0, 0.18)",
  promotionPieceButton: "#769656",
  arrow: "rgba(255, 170, 0, 0.85)",
  externalHighlight: "rgba(255, 170, 0, 0.6)",
  coordinateLight: "#769656",
  coordinateDark: "#eeeed2",
};
