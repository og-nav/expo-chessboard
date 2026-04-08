import React from "react";
import { View, TouchableOpacity, StyleSheet, Image } from "react-native";
import { DEFAULT_PIECES } from "../constants";
import type { Player, PieceType, BoardColors } from "../types";

interface Props {
  color: Player;
  boardSize: number;
  colors: BoardColors;
  onSelect: (piece: "q" | "r" | "b" | "n") => void;
}

const PROMOTION_PIECES: ("q" | "r" | "b" | "n")[] = ["q", "r", "b", "n"];

export default function PromotionDialog({
  color,
  boardSize,
  colors,
  onSelect,
}: Props) {
  const pieceSize = boardSize / 8;
  const dialogWidth = pieceSize * 4;

  return (
    <View style={[StyleSheet.absoluteFillObject, s.overlay]}>
      <View
        style={[
          s.dialog,
          {
            width: dialogWidth,
            borderRadius: pieceSize * 0.2,
          },
        ]}
      >
        {PROMOTION_PIECES.map((p) => {
          const key = `${color}${p}` as PieceType;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => onSelect(p)}
              style={[
                s.button,
                {
                  width: pieceSize,
                  height: pieceSize,
                  backgroundColor: colors.promotionPieceButton,
                },
              ]}
            >
              <Image
                source={DEFAULT_PIECES[key]}
                style={{ width: pieceSize * 0.85, height: pieceSize * 0.85 }}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 200,
  },
  dialog: {
    flexDirection: "row",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  button: {
    justifyContent: "center",
    alignItems: "center",
  },
});
