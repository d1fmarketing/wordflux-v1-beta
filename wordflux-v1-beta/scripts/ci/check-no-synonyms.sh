#!/usr/bin/env bash
set -Eeuo pipefail

if rg -n --iglob '!**/*.md' \
  -e '\\b(Backlog|Doing|In\\s*Progress|Review|Ready|Done|A Fazer|Em Progresso|Revis[aã]o|Pronto|Conclu[ií]do)\\b' \
  lib app | grep -v 'mcp-agent\\.ts'; then
  echo "Remove column literals from runtime." >&2
  exit 1
fi
