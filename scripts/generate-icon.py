#!/usr/bin/env python3
"""
Generate the example app's home-screen icon.

Renders a mini chessboard (starting position) into a 1024x1024 PNG
using the library's own theme colors and bundled piece assets, so the
icon is literally a snapshot of what the library renders. Most
recognizable possible icon for a chessboard library.

Run from the repo root with the project venv:

    .venv/bin/python scripts/generate-icon.py

Outputs:
    example/assets/images/icon.png         (1024x1024 — home screen)
    example/assets/images/splash-icon.png  (1024x1024 — splash)
"""

from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
PIECES_DIR = REPO_ROOT / "assets" / "pieces"
OUT_DIR = REPO_ROOT / "example" / "assets" / "images"

# Default board theme — same constants as DEFAULT_COLORS in src/types.ts.
LIGHT = (237, 238, 209, 255)  # #edeed1
DARK = (119, 153, 82, 255)    # #779952

ICON_SIZE = 1024
# Inset so the corner squares aren't clipped by iOS's rounded mask.
# iOS app icons are masked at ~22% radius; 64px inset keeps the corner
# squares fully visible inside the mask.
BOARD_INSET = 64
BOARD_SIZE = ICON_SIZE - 2 * BOARD_INSET  # 896
SQUARE_SIZE = BOARD_SIZE // 8              # 112

# Standard starting position. Files a..h, ranks 8..1 top to bottom.
STARTING_POSITION = [
    ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
    ["bp"] * 8,
    [None] * 8,
    [None] * 8,
    [None] * 8,
    [None] * 8,
    ["wp"] * 8,
    ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"],
]


def generate_icon() -> Image.Image:
    canvas = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), DARK)

    # Draw the 8x8 board, light squares only (the dark fill is the
    # canvas background, so dark squares come for free).
    for rank_idx in range(8):
        for file_idx in range(8):
            is_light = (rank_idx + file_idx) % 2 == 0
            if not is_light:
                continue
            x = BOARD_INSET + file_idx * SQUARE_SIZE
            y = BOARD_INSET + rank_idx * SQUARE_SIZE
            square = Image.new("RGBA", (SQUARE_SIZE, SQUARE_SIZE), LIGHT)
            canvas.paste(square, (x, y))

    # Pieces. The bundled PNGs are 150x150 — downscale to fill ~92% of
    # a square (matches the example app's visual ratio).
    piece_size = int(SQUARE_SIZE * 0.92)
    piece_offset = (SQUARE_SIZE - piece_size) // 2

    for rank_idx, row in enumerate(STARTING_POSITION):
        for file_idx, piece in enumerate(row):
            if piece is None:
                continue
            piece_path = PIECES_DIR / f"{piece}.png"
            piece_img = Image.open(piece_path).convert("RGBA")
            piece_img = piece_img.resize(
                (piece_size, piece_size), Image.LANCZOS
            )
            x = BOARD_INSET + file_idx * SQUARE_SIZE + piece_offset
            y = BOARD_INSET + rank_idx * SQUARE_SIZE + piece_offset
            canvas.paste(piece_img, (x, y), piece_img)

    return canvas


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    icon = generate_icon()

    icon_path = OUT_DIR / "icon.png"
    icon.save(icon_path, "PNG")
    print(f"wrote {icon_path}")

    # Splash icon — same image, the splash plugin centers it on a
    # solid background and clamps the width via imageWidth in app.json.
    splash_path = OUT_DIR / "splash-icon.png"
    icon.save(splash_path, "PNG")
    print(f"wrote {splash_path}")


if __name__ == "__main__":
    main()
