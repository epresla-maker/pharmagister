#!/bin/bash

# Pharmagister reklám - Szövegek hozzáadása FFmpeg-gel
# Ez MŰKÖDIK garantáltan! 🎬

echo "🎬 Pharmagister - Szöveg overlay FFmpeg-gel"
echo "============================================"

# Bemeneti videó (DaVinci-ből exportált, vagy a stock videó)
INPUT_VIDEO="input_video.mp4"
OUTPUT_VIDEO="pharmagister_reklam_FINAL.mp4"

# Ellenőrzés
if [ ! -f "$INPUT_VIDEO" ]; then
    echo "❌ HIBA: $INPUT_VIDEO nem található!"
    echo "Exportáld a videót DaVinci-ből vagy nevezd át!"
    exit 1
fi

# FFmpeg telepítve van?
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ HIBA: FFmpeg nincs telepítve!"
    echo "Telepítés: brew install ffmpeg"
    exit 1
fi

echo "✅ FFmpeg OK"
echo "✅ Input: $INPUT_VIDEO"
echo ""
echo "📝 Szövegek hozzáadása..."

# Szöveg overlay komplex filterrel
ffmpeg -i "$INPUT_VIDEO" \
  -vf "
    drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:\
text='Hiányzik egy gyógyszerész?':\
fontcolor=white:\
fontsize=60:\
box=1:\
boxcolor=black@0.5:\
boxborderw=10:\
x=(w-text_w)/2:\
y=(h-text_h)/2:\
enable='between(t,1,4)',
    
    drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial Bold.ttf:\
text='Pharmagister.hu':\
fontcolor=#2ecc71:\
fontsize=80:\
box=1:\
boxcolor=black@0.7:\
boxborderw=10:\
x=(w-text_w)/2:\
y=(h-text_h)/2:\
enable='between(t,5,7)',
    
    drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:\
text='Helyettes gyógyszerészek':\
fontcolor=white:\
fontsize=50:\
x=(w-text_w)/2:\
y=h-150:\
enable='between(t,8,11)',
    
    drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial Bold.ttf:\
text='1 kattintással':\
fontcolor=#2ecc71:\
fontsize=55:\
x=(w-text_w)/2:\
y=h-80:\
enable='between(t,8,11)'
  " \
  -codec:a copy \
  -c:v libx264 \
  -preset fast \
  -crf 22 \
  "$OUTPUT_VIDEO"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ KÉSZ!"
    echo "============================================"
    echo "📹 Kimenet: $OUTPUT_VIDEO"
    echo ""
    echo "Nézd meg a videót:"
    echo "  open $OUTPUT_VIDEO"
else
    echo ""
    echo "❌ Hiba történt az FFmpeg futtatása közben!"
fi
