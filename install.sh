#!/usr/bin/env bash
# Popling has no build step and no dependencies — "installing" just picks a
# Python interpreter for the local dev server used by run.sh.
#   ./install.sh          idempotent; keeps an existing choice
#   ./install.sh --clean  forget the previous choice (and any .venv) and ask again
set -euo pipefail
cd "$(dirname "$0")"

CHOICE_FILE=.python-bin

if [[ "${1:-}" == "--clean" ]]; then
  rm -rf .venv "$CHOICE_FILE"
  echo "Cleaned previous install."
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--clean]" >&2; exit 1
fi

if [[ -f "$CHOICE_FILE" ]] && command -v "$(cat "$CHOICE_FILE")" >/dev/null 2>&1; then
  echo "Already installed — using $(cat "$CHOICE_FILE") ($("$(cat "$CHOICE_FILE")" --version 2>&1))."
  echo "Run ./run.sh to start Popling."
  exit 0
fi

candidates=()
for py in python3 python; do
  if command -v "$py" >/dev/null 2>&1 && "$py" -c 'import sys; sys.exit(sys.version_info < (3, 7))' 2>/dev/null; then
    candidates+=("$py")
  fi
done

if [[ ${#candidates[@]} -eq 0 ]]; then
  echo "No Python 3.7+ found (tried python3 and python)." >&2
  echo "Install Python, or skip it entirely with: docker compose up" >&2
  exit 1
elif [[ ${#candidates[@]} -eq 1 ]]; then
  chosen=${candidates[0]}
else
  echo "Found more than one Python interpreter:"
  for i in "${!candidates[@]}"; do
    echo "  $((i + 1))) ${candidates[$i]}  ($("${candidates[$i]}" --version 2>&1))"
  done
  read -r -p "Which one should be used? [1]: " pick || pick=1
  pick=${pick:-1}
  if ! [[ "$pick" =~ ^[0-9]+$ ]] || (( pick < 1 || pick > ${#candidates[@]} )); then
    echo "Invalid choice." >&2; exit 1
  fi
  chosen=${candidates[$((pick - 1))]}
fi

echo "$chosen" > "$CHOICE_FILE"
chmod +x run.sh 2>/dev/null || true
echo "Installed — using $chosen ($("$chosen" --version 2>&1))."
echo "Run ./run.sh to start Popling."
