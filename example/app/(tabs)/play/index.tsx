import { Chessboard } from "@og-nav/expo-chessboard";
import type { ChessboardRef } from "@og-nav/expo-chessboard";
import { Chess } from "chess.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { BodyScrollView } from "@/components/body-scroll-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { pickRandomMove } from "@/lib/random-bot";

/**
 * Play tab — full game against a random-move bot. Wraps a PlaySession
 * inner component and bumps a key to start a new game; the inner owns
 * the Chess instance via useState. Same wrapper/key pattern as
 * SmokeCard for the same reason: avoids fighting the exhaustive-deps
 * lint rule with a useMemo whose only "dep" is a reset counter.
 */
export default function PlayScreen() {
  const [gameId, setGameId] = useState(0);
  return (
    <PlaySession
      key={gameId}
      onNewGame={() => setGameId((n) => n + 1)}
    />
  );
}

function PlaySession({ onNewGame }: { onNewGame: () => void }) {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 32, 480);

  const textColor = useThemeColor({}, "text");
  const subText = useThemeColor({}, "icon");

  // Owned by the session — fresh on every key bump from the wrapper.
  const [chess] = useState(() => new Chess());

  // Counter that increments on every move so the side-to-move /
  // status text re-renders. The Chess instance itself is mutable so
  // React doesn't see it change otherwise.
  const [, forceUpdate] = useState(0);
  const bump = useCallback(() => forceUpdate((n) => n + 1), []);

  const ref = useRef<ChessboardRef>(null);
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any pending bot move when this session is unmounted (i.e.
  // the user tapped New Game while the bot was thinking).
  useEffect(() => {
    return () => {
      if (botTimer.current) clearTimeout(botTimer.current);
    };
  }, []);

  const handleMove = useCallback(() => {
    bump();
    // After the user moves it's black's turn. Wait a beat so the
    // animation feels deliberate, then play a random legal move.
    if (chess.turn() === "b" && !chess.gameOver()) {
      botTimer.current = setTimeout(() => {
        const move = pickRandomMove(chess);
        if (move) {
          ref.current?.animateMove(move.from, move.to, move.promotion);
        }
      }, 500);
    }
  }, [chess, bump]);

  const status = describeGameState(chess);

  return (
    <BodyScrollView contentContainerStyle={styles.container}>
      <View style={styles.statusRow}>
        <Text style={[styles.status, { color: textColor }]}>{status.title}</Text>
        <Text style={[styles.subtitle, { color: subText }]}>
          {status.subtitle}
        </Text>
      </View>

      <View style={styles.boardWrap}>
        <Chessboard
          ref={ref}
          chess={chess}
          boardSize={boardSize}
          playerSide="white"
          onMove={handleMove}
        />
      </View>

      <Pressable
        onPress={onNewGame}
        style={({ pressed }) => [
          styles.button,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.buttonText}>New game</Text>
      </Pressable>
    </BodyScrollView>
  );
}

function describeGameState(chess: Chess): {
  title: string;
  subtitle: string;
} {
  if (chess.inCheckmate()) {
    const winner = chess.turn() === "w" ? "Black" : "White";
    return { title: "Checkmate", subtitle: `${winner} wins` };
  }
  if (chess.inStalemate()) {
    return { title: "Stalemate", subtitle: "Draw" };
  }
  if (chess.inDraw()) {
    return { title: "Draw", subtitle: "50-move / threefold / insufficient" };
  }
  if (chess.inCheck()) {
    const side = chess.turn() === "w" ? "White" : "Black";
    return { title: `${side} in check`, subtitle: "Defend or move away" };
  }
  const side = chess.turn() === "w" ? "Your move" : "Bot thinking…";
  return { title: side, subtitle: "Random-move opponent" };
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 96,
    gap: 16,
    alignItems: "center",
  },
  statusRow: {
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  status: {
    fontSize: 22,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
  },
  boardWrap: {
    alignItems: "center",
  },
  button: {
    backgroundColor: "#0a7ea4",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
