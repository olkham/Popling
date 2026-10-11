#!/usr/bin/env bash
# Serve Popling locally at http://localhost:${PORT:-8000}
#   ./run.sh          default port 8000
#   ./run.sh 9000     custom port
set -euo pipefail
cd "$(dirname "$0")"

PORT=${1:-${PORT:-8000}}

if [[ ! -f .python-bin ]]; then
  echo "Not installed yet — running ./install.sh first."
  ./install.sh
fi
PY=$(cat .python-bin)

echo "Popling running at http://localhost:$PORT  (Ctrl+C to stop)"
exec "$PY" -m http.server "$PORT" --bind 127.0.0.1
