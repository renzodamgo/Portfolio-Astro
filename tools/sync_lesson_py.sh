#!/usr/bin/env bash
# Copies the course's Python (public repo robotek-learn) that the interactive lessons run in the browser (Pyodide):
# the mini simulator, the step tests and the reference modules of my_open (solution tag step-9).
#
#   bash tools/sync_lesson_py.sh [path/to/robotek-learn]
set -euo pipefail
SRC=${1:-$HOME/Projects/robotek-learn}
OUT=public/learn/py
rm -rf "$OUT/robotek_course" "$OUT/tests" "$OUT/ref"
mkdir -p "$OUT/robotek_course" "$OUT/tests" "$OUT/ref"
cp "$SRC/src/robotek_course/robotek_course/minisim.py" "$OUT/robotek_course/"
: > "$OUT/robotek_course/__init__.py"
cp "$SRC/course/tests/conftest.py" "$SRC/course/tests/helpers.py" "$OUT/tests/"
for n in 1 2 3 4 5 6 7 8; do cp "$SRC/course/tests/test_step_$n.py" "$OUT/tests/"; done
for m in model heading perception lane arc turn_gate mission direction; do
  git -C "$SRC" show "step-9:src/my_open/my_open/$m.py" > "$OUT/ref/$m.py"
done
ls -R "$OUT" | head -40
