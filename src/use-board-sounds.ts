import { useCallback, useEffect, useMemo } from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  type AudioPlayer,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { SOUND_ASSETS, type SoundKey } from "./constants";
import type { Chess, Move } from "./types";

/**
 * Loads the three board sounds via expo-audio and returns a stable
 * `playForMove` callback. Replaces the old expo-av implementation.
 *
 * Notes vs. the v2 version:
 *  - Uses `useAudioPlayer` (one player per sound), so playback is
 *    instantaneous and re-entrant — no async load on each press.
 *  - `playsInSilentMode` (expo-audio) replaces `playsInSilentModeIOS`
 *    (expo-av) — fixes bug #7.
 *  - Game-end states (checkmate / draw / threefold) all play a single
 *    `gameOver` sound — fixes bug #8 where draws used the checkmate sound
 *    keyed under the wrong name.
 *  - Return value is `useMemo`-stable so consumers don't re-render on
 *    every tick — fixes bug #6.
 *  - There is intentionally no `check` sound; `inCheck()` falls through
 *    to the regular move sound.
 */
export function useBoardSounds(
  soundEnabled: boolean,
  hapticsEnabled: boolean
) {
  const movePlayer = useAudioPlayer(SOUND_ASSETS.move);
  const capturePlayer = useAudioPlayer(SOUND_ASSETS.capture);
  const gameOverPlayer = useAudioPlayer(SOUND_ASSETS.gameOver);

  const players = useMemo<Record<SoundKey, AudioPlayer>>(
    () => ({
      move: movePlayer,
      capture: capturePlayer,
      gameOver: gameOverPlayer,
    }),
    [movePlayer, capturePlayer, gameOverPlayer]
  );

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
    }).catch((err) => {
      if (__DEV__) {
        console.warn("[expo-chessboard] setAudioModeAsync failed:", err);
      }
    });
  }, []);

  const playSound = useCallback(
    (type: SoundKey) => {
      if (!soundEnabled) return;
      const player = players[type];
      if (!player) return;
      try {
        player.seekTo(0);
        player.play();
      } catch (err) {
        if (__DEV__) {
          console.warn("[expo-chessboard] failed to play sound:", err);
        }
      }
    },
    [soundEnabled, players]
  );

  const playHaptic = useCallback(() => {
    if (!hapticsEnabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
      // Haptics can fail silently on unsupported devices.
    });
  }, [hapticsEnabled]);

  const playForMove = useCallback(
    (move: Move, chess: Chess) => {
      if (
        chess.inCheckmate() ||
        chess.inDraw() ||
        chess.inThreefoldRepetition() ||
        chess.inStalemate()
      ) {
        playSound("gameOver");
      } else if (move.captured) {
        playSound("capture");
      } else {
        // Note: inCheck() intentionally falls through to "move" — there
        // is no dedicated check sound asset.
        playSound("move");
      }
      playHaptic();
    },
    [playSound, playHaptic]
  );

  return useMemo(() => ({ playForMove }), [playForMove]);
}
