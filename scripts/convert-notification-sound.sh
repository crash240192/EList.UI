#!/usr/bin/env sh
# Конвертация исходного mp3 в public/sounds/notification.mp3
# Пример: ./scripts/convert-notification-sound.sh "/path/to/1407a2d412f6638 (1).mp3"

set -e

SRC="${1:?Укажите путь к исходному mp3}"
OUT_DIR="$(dirname "$0")/../public/sounds"
OUT="$OUT_DIR/notification.mp3"

mkdir -p "$OUT_DIR"

ffmpeg -y -i "$SRC" \
  -ac 1 \
  -ar 44100 \
  -b:a 96k \
  -af "afade=t=out:st=0:d=0.02" \
  "$OUT"

echo "Готово: $OUT"
