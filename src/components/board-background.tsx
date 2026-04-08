import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { BoardColors } from "../types";

interface Props {
  boardSize: number;
  colors: BoardColors;
  flipped: boolean;
}

const FILES = "abcdefgh";
const RANKS = "12345678";

const BoardBackground = React.memo(function BoardBackground({
  boardSize,
  colors,
  flipped,
}: Props) {
  const pieceSize = boardSize / 8;
  // Bug #11 fix: scale coordinate font with the board so they remain
  // legible on tablets and don't overflow on phones. The hard-coded
  // fontSize: 9 in v2 looked broken at every non-default boardSize.
  const coordFontSize = Math.max(8, Math.round(pieceSize * 0.18));
  const squares: React.ReactNode[] = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const isLight = (row + col) % 2 === 0;
      const displayCol = flipped ? 7 - col : col;
      const displayRow = flipped ? 7 - row : row;
      const file = FILES[displayCol];
      const rank = RANKS[7 - displayRow];
      const showFile = row === 7;
      const showRank = col === 0;

      squares.push(
        <View
          key={`${row}-${col}`}
          style={{
            position: "absolute",
            left: col * pieceSize,
            top: row * pieceSize,
            width: pieceSize,
            height: pieceSize,
            backgroundColor: isLight ? colors.light : colors.dark,
          }}
        >
          {showRank && (
            <Text
              style={[
                s.coord,
                s.rank,
                {
                  fontSize: coordFontSize,
                  color: isLight ? colors.dark : colors.light,
                },
              ]}
            >
              {rank}
            </Text>
          )}
          {showFile && (
            <Text
              style={[
                s.coord,
                s.file,
                {
                  fontSize: coordFontSize,
                  color: isLight ? colors.dark : colors.light,
                },
              ]}
            >
              {file}
            </Text>
          )}
        </View>
      );
    }
  }

  return (
    <View style={{ width: boardSize, height: boardSize }}>{squares}</View>
  );
});

const s = StyleSheet.create({
  coord: {
    position: "absolute",
    fontWeight: "700",
  },
  rank: {
    top: 1,
    left: 2,
  },
  file: {
    bottom: 1,
    right: 2,
  },
});

export default BoardBackground;
