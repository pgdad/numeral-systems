#!/usr/bin/env bash
# Turn the narration into audio files with whatever text-to-speech this computer has (Phase 10, optional).
# The app never needs this: without audio files it uses the browser's voice. See docs/recording-your-voice.md.
#
#   tools/generate-audio.sh                 make the lines that have no file yet, or whose text changed
#   tools/generate-audio.sh --only binary.  only ids starting with "binary." (try one lesson first)
#   tools/generate-audio.sh --force         make every line again (overwrites recordings of your own voice too!)
#   tools/generate-audio.sh --convert       just convert .webm/.ogg/.m4a/.wav files in assets/audio/ to .mp3
#   tools/generate-audio.sh --engines       show what was found, then stop
#
# Engines, checked in this order (or set ENGINE=say|piper|espeak):
#   macOS:  say (VOICE="Samantha" to pick a voice; `say -v '?'` lists them)
#   piper:  a good offline voice. Needs PIPER_MODEL=/path/to/en_US-lessac-medium.onnx (PIPER=/path/to/piper if not on PATH)
#   espeak-ng or espeak: robotic but everywhere on Linux
# Encoders: ffmpeg (FFMPEG=/path/to/ffmpeg) or lame -> .mp3; on a Mac without them, afconvert -> .m4a.
# Output: assets/audio/<id>.mp3, mono, BITRATE (default 48k). Budget: the whole narration is ~13 minutes,
# about 3 MB at 48 kbps (~22 KB a line); keep assets/audio/ under 10 MB. Then js/engine/audio-manifest.js is rebuilt.
set -euo pipefail
cd "$(dirname "$0")/.."

BITRATE="${BITRATE:-48k}"
ONLY=""
FORCE=""
MODE="generate"
while [ $# -gt 0 ]; do
  case "$1" in
    --only) ONLY="$2"; shift 2 ;;
    --force) FORCE="--force"; shift ;;
    --convert) MODE="convert"; shift ;;
    --engines) MODE="engines"; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "generate-audio: unknown option $1 (try --help)" >&2; exit 2 ;;
  esac
done

have() { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------- engine
PIPER="${PIPER:-piper}"
engine=""
if [ -n "${ENGINE:-}" ]; then
  engine="$ENGINE"
elif have say && have afconvert; then
  engine="say"
elif have "$PIPER" && [ -n "${PIPER_MODEL:-}" ] && [ -f "${PIPER_MODEL:-}" ]; then
  engine="piper"
elif have espeak-ng || have espeak; then
  engine="espeak"
fi
ESPEAK="espeak-ng"; have espeak-ng || ESPEAK="espeak"

# ---------------------------------------------------------------- encoder
FFMPEG="${FFMPEG:-ffmpeg}"
encoder=""
if have "$FFMPEG"; then encoder="ffmpeg"
elif have lame; then encoder="lame"
elif have afconvert; then encoder="afconvert"
fi

if [ "$MODE" = "engines" ]; then
  echo "engine:  ${engine:-none}"
  echo "encoder: ${encoder:-none}"
  if have "$PIPER" && [ -z "${PIPER_MODEL:-}" ]; then echo "(piper is installed but PIPER_MODEL is not set)"; fi
  exit 0
fi

need_help() {
  cat >&2 <<'EOF'
generate-audio: no way to make audio files was found on this computer.

You need ONE text-to-speech engine:
  - macOS: nothing to install (`say` is built in).
  - piper (good offline voice, any OS): `pipx install piper-tts` (or `pip install piper-tts`), then
      python3 -m piper.download_voices en_US-lessac-medium
      export PIPER_MODEL=$PWD/en_US-lessac-medium.onnx
  - espeak-ng (robotic, Linux): `sudo apt install espeak-ng`
and ONE encoder for small .mp3 files:
  - ffmpeg: `sudo apt install ffmpeg`, `brew install ffmpeg`, or `winget install ffmpeg`
  - or lame: `sudo apt install lame` / `brew install lame`
  (on a Mac without them, afconvert makes .m4a files instead)

Prefer a cloud voice? Make one file per line yourself (the list: tools/narration.json, or
`node tools/build-audio-manifest.js --todo`), name each <id>.mp3, put them in assets/audio/ and run
`node tools/build-audio-manifest.js`. No keys or accounts are kept in this repo.
Or record your own voice: open the app at #/record (see docs/recording-your-voice.md).
EOF
  exit 3
}

encode() { # $1 = input audio, $2 = output without extension; prints the file written
  local in="$1" out="$2"
  case "$encoder" in
    ffmpeg) "$FFMPEG" -nostdin -hide_banner -loglevel error -y -i "$in" -ac 1 -ar 24000 -b:a "$BITRATE" "$out.mp3" && echo "$out.mp3" ;;
    lame) lame --quiet -m m --resample 24 -b "${BITRATE%k}" "$in" "$out.mp3" && echo "$out.mp3" ;;
    afconvert) afconvert -f m4af -d aac -b "$(( ${BITRATE%k} * 1000 ))" -c 1 "$in" "$out.m4a" && echo "$out.m4a" ;;
    *) return 1 ;;
  esac
}

mkdir -p assets/audio
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ---------------------------------------------------------------- --convert
if [ "$MODE" = "convert" ]; then
  if [ "$encoder" != "ffmpeg" ]; then echo "generate-audio: --convert needs ffmpeg (FFMPEG=/path/to/ffmpeg)." >&2; exit 3; fi
  n=0
  for f in assets/audio/*.webm assets/audio/*.ogg assets/audio/*.m4a assets/audio/*.wav; do
    [ -e "$f" ] || continue
    base="${f%.*}"
    encode "$f" "$base" >/dev/null && rm -f "$f" && n=$((n + 1))
  done
  echo "generate-audio: converted $n file(s) to mp3"
  node tools/build-audio-manifest.js
  exit 0
fi

# ---------------------------------------------------------------- generate
[ -n "$engine" ] && [ -n "$encoder" ] || need_help

synth() { # $1 = text file, $2 = output without extension; prints the raw audio file written
  local txt="$1" out="$2"
  case "$engine" in
    say) say ${VOICE:+-v "$VOICE"} -o "$out.aiff" -f "$txt" && echo "$out.aiff" ;;
    piper) "$PIPER" --model "$PIPER_MODEL" --output_file "$out.wav" < "$txt" >/dev/null 2>&1 && echo "$out.wav" ;;
    espeak) "$ESPEAK" -v "${VOICE:-en-us}" -s 150 -w "$out.wav" -f "$txt" && echo "$out.wav" ;;
    *) echo "generate-audio: unknown ENGINE=$engine (say, piper or espeak)" >&2; return 1 ;;
  esac
}

node tools/narration-export.js >/dev/null
node tools/build-audio-manifest.js --todo $FORCE ${ONLY:+--only "$ONLY"} > "$TMP/todo.tsv"
total=$(grep -c . "$TMP/todo.tsv" || true)
if [ "$total" = "0" ]; then
  echo "generate-audio: every line already has an up-to-date file (use --force to make them again)."
  node tools/build-audio-manifest.js
  exit 0
fi
echo "generate-audio: $total line(s) with $engine, encoded by $encoder at $BITRATE"

: > "$TMP/done.tsv"
i=0
while IFS=$'\t' read -r id hash text; do
  [ -n "$id" ] || continue
  i=$((i + 1))
  printf '%s\n' "$text" > "$TMP/line.txt"
  if raw="$(synth "$TMP/line.txt" "$TMP/$id")" && file="$(encode "$raw" "assets/audio/$id")"; then
    # One file per id: drop older recordings of this line in other formats.
    for ext in mp3 m4a webm ogg wav; do
      [ "assets/audio/$id.$ext" = "$file" ] || rm -f "assets/audio/$id.$ext"
    done
    printf '%s\t%s\n' "$id" "$hash" >> "$TMP/done.tsv"
    printf '  [%d/%d] %s\n' "$i" "$total" "$id"
  else
    printf '  [%d/%d] %s FAILED\n' "$i" "$total" "$id" >&2
  fi
  rm -f "$TMP/$id".*
done < "$TMP/todo.tsv"

node tools/build-audio-manifest.js --generated "$TMP/done.tsv"
du -sh assets/audio | awk '{print "generate-audio: assets/audio is now " $1}'
