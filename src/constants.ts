import type { ImageSourcePropType } from "react-native";
import type { PieceType } from "./types";

export const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Default piece images. Consumers can override individually via the
 * `pieces` prop or replace rendering entirely via `renderPiece`.
 */
export const DEFAULT_PIECES: Record<PieceType, ImageSourcePropType> = {
  br: require("../assets/pieces/br.png"),
  bp: require("../assets/pieces/bp.png"),
  bn: require("../assets/pieces/bn.png"),
  bb: require("../assets/pieces/bb.png"),
  bq: require("../assets/pieces/bq.png"),
  bk: require("../assets/pieces/bk.png"),
  wr: require("../assets/pieces/wr.png"),
  wn: require("../assets/pieces/wn.png"),
  wb: require("../assets/pieces/wb.png"),
  wq: require("../assets/pieces/wq.png"),
  wk: require("../assets/pieces/wk.png"),
  wp: require("../assets/pieces/wp.png"),
};

/**
 * Three sound categories. Note: there is no dedicated `check` sound;
 * `inCheck()` falls through to `move`. (We could ship one in the future
 * but it requires a real audio asset, not a dupe of move.mp3.)
 */
export const SOUND_ASSETS = {
  move: require("../assets/sounds/move.mp3"),
  capture: require("../assets/sounds/capture.mp3"),
  gameOver: require("../assets/sounds/gameover.mp3"),
} as const;

export type SoundKey = keyof typeof SOUND_ASSETS;
