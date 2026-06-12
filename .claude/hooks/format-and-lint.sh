#!/usr/bin/env bash
# PostToolUse hook: after Claude edits a file, auto-format it with Prettier and
# auto-fix it with ESLint. If ESLint reports problems it cannot fix, surface them
# back to Claude (exit 2) so they get addressed in the same turn.
set -uo pipefail

ROOT="/home/miku/projects/tuan-tanah"
input=$(cat)

# Pull the edited file path out of the hook's JSON payload (tool_input.file_path).
file=$(printf '%s' "$input" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch(e){process.stdout.write("")}})')

[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

# Only touch files inside this project (ESLint/Prettier configs live here).
case "$file" in
  "$ROOT"/*) ;;
  *) exit 0 ;;
esac
cd "$ROOT" || exit 0

PRETTIER="$ROOT/node_modules/.bin/prettier"
ESLINT="$ROOT/node_modules/.bin/eslint"

# Format anything Prettier understands; bail quietly for other file types.
case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.cjs | *.mjs | *.json | *.css | *.md | *.yml | *.yaml)
    [ -x "$PRETTIER" ] && "$PRETTIER" --write "$file" >/dev/null 2>&1 || true
    ;;
  *)
    exit 0
    ;;
esac

# Lint-fix only code files. Errors that survive --fix get reported back.
case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.cjs | *.mjs)
    [ -x "$ESLINT" ] || exit 0
    out=$("$ESLINT" --fix "$file" 2>&1)
    code=$?
    if [ "$code" -ne 0 ]; then
      echo "ESLint found problems in $file that need manual fixing:" >&2
      echo "$out" >&2
      exit 2
    fi
    ;;
esac

exit 0
