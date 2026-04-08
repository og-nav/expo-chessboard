import Chessboard from "./Chessboard";

export { Chessboard };
export default Chessboard;

export { DEFAULT_COLORS } from "./types";
export { DEFAULT_PIECES, STARTING_FEN, SOUND_ASSETS } from "./constants";
export {
  THEME_DEFAULT,
  THEME_WOOD,
  THEME_BLUE,
  THEME_GREEN,
} from "./themes";

export type {
  Arrow,
  BoardColors,
  BoardOrientation,
  ChessboardProps,
  ChessboardRef,
  PieceType,
  Player,
  PlayerSide,
  Square,
  SquareHighlight,
  Move,
  PieceSymbol,
  Chess,
} from "./types";
export type { SoundKey } from "./constants";
