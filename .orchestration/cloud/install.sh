#!/usr/bin/env bash
# Cloud sessions don't get your Mac's ~/.claude, so copy the orchestration files in. Does nothing locally.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
set -eu
src="$(cd "$(dirname "$0")" && pwd)"
cd "$src/../.."
mkdir -p "$HOME/.claude/agents" .claude/agents
cp "$src/ORCHESTRATION.md" "$HOME/.claude/"
cp "$src"/agents/*.md "$HOME/.claude/agents/"
# Also into the repo's agents folder: it exists at launch, so Claude picks new files up without a restart.
exclude="$(git rev-parse --git-path info/exclude)"
mkdir -p "$(dirname "$exclude")"
for f in "$src"/agents/*.md; do
  dest=".claude/agents/$(basename "$f")"
  [ -e "$dest" ] && continue
  cp "$f" "$dest"
  echo "/$dest" >> "$exclude"
done
