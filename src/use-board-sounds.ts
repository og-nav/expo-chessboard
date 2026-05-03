import { useCallback, useEffect, useMemo } from "react";
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { SOUND_ASSETS, type SoundKey } from "./constants";
import type { Chess, Move } from "./types";

/**
 * Module-level singleton audio players. Created lazily on first call
 * to `useBoardSounds` and reused across every Chessboard instance for
 * the lifetime of the app.
 *
 * Why singletons instead of per-component `useAudioPlayer`:
 *   `useAudioPlayer` ties native player lifetime to the React component.
 *   In a FlatList/virtualised list, boards mount and unmount constantly
 *   as the user scrolls. Each mount creates 3 native AVAudioPlayers;
 *   each unmount tears them down. iOS has a soft limit on concurrent
 *   audio sessions — once the churn exceeds what the system can recycle
 *   in time, new players silently fail to play and sound goes dead for
 *   the rest of the session.
 *
 *   `createAudioPlayer` is the imperative counterpart: the player lives
 *   until you call `.remove()`. Three singletons for the entire app
 *   eliminates the churn entirely.
 */
let singletonPlayers: Record<SoundKey, AudioPlayer> | null = null;
let audioModeConfigured = false;

function getPlayers(): Record<SoundKey, AudioPlayer> {
  if (!singletonPlayers) {
    singletonPlayers = {
      move: createAudioPlayer(SOUND_ASSETS.move),
      capture: createAudioPlayer(SOUND_ASSETS.capture),
      gameOver: createAudioPlayer(SOUND_ASSETS.gameOver),
    };
  }
  return singletonPlayers;
}

/**
 * Returns stable `playForMove` and `playForScrub` callbacks backed by
 * shared singleton audio players. Safe to call from any number of
 * concurrent Chessboard instances.
 */
export function useBoardSounds(
  soundEnabled: boolean,
  hapticsEnabled: boolean
) {
  // Ensure audio mode is configured exactly once per app session.
  useEffect(() => {
    if (audioModeConfigured) return;
    audioModeConfigured = true;
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
      const players = getPlayers();
      const player = players[type];
      if (!player) return;
      try {
        // Pause before seek+play so rapid-fire calls (fast undo/redo
        // scrubbing) always restart the sound. Without pause(), the
        // player is already in "playing" state and a second play() is
        // a no-op — the sound silently swallows the trigger.
        player.pause();
        player.seekTo(0);
        player.play();
      } catch (err) {
        if (__DEV__) {
          console.warn("[expo-chessboard] failed to play sound:", err);
        }
      }
    },
    [soundEnabled]
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

  // Sound for undo/redo scrubbing. Uses the move's own metadata
  // (.captured) instead of the post-move chess state, because:
  //   - undo() runs AFTER chess.undo(), so chess is in the PRE-move
  //     state and inCheckmate() etc would be wrong
  //   - we never want gameOver when scrubbing — even redoing the
  //     mating move is a navigation action, not a fresh checkmate
  // Capture-vs-move is preserved so reverting/replaying a capture
  // still sounds like a capture.
  const playForScrub = useCallback(
    (move: Move) => {
      if (move.captured) {
        playSound("capture");
      } else {
        playSound("move");
      }
      playHaptic();
    },
    [playSound, playHaptic]
  );

  // Sound for variation-preview stepping. Stepping isn't a real move, so
  // game-over sounds are suppressed (same rationale as scrubbing). Capture
  // is detected from the SAN string ('x'), since the caller doesn't have
  // a Move object to consult — preview steps replay SAN against a
  // throwaway Chess copy and the resulting Move is discarded.
  const playForPreviewStep = useCallback(
    (san: string) => {
      if (san.includes("x")) {
        playSound("capture");
      } else {
        playSound("move");
      }
      playHaptic();
    },
    [playSound, playHaptic]
  );

  return useMemo(
    () => ({ playForMove, playForScrub, playForPreviewStep }),
    [playForMove, playForScrub, playForPreviewStep]
  );
}
