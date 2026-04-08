import Chessboard from "./Chessboard";

export { Chessboard };
export default Chessboard;

export { DEFAULT_COLORS } from "./types";
export { DEFAULT_PIECES, STARTING_FEN, SOUND_ASSETS } from "./constants";

export type {
  BoardColors,
  BoardOrientation,
  ChessboardProps,
  ChessboardRef,
  PieceType,
  Player,
  PlayerSide,
  Square,
  Move,
  PieceSymbol,
  Chess,
} from "./types";
export type { SoundKey } from "./constants";
