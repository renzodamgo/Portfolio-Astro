#!/usr/bin/env bash
# Copies the course's Python (public repo robotek-learn) that the interactive lessons run in the browser (Pyodide):
# the mini simulator, the step tests and the reference modules of my_open (solution tag step-9).
#
#   bash tools/sync_lesson_py.sh [path/to/robotek-learn]
set -euo pipefail
SRC=${1:-$HOME/Projects/robotek-learn}
OUT=public/learn/py
rm -rf "$OUT/robotek_course" "$OUT/robotek_common" "$OUT/tests" "$OUT/ref" "$OUT/obstacle"
mkdir -p "$OUT/robotek_course" "$OUT/robotek_common" "$OUT/tests" "$OUT/ref" "$OUT/obstacle/tests" "$OUT/obstacle/ref"
cp "$SRC/src/robotek_course/robotek_course/minisim.py" "$OUT/robotek_course/"
: > "$OUT/robotek_course/__init__.py"
# Obstacle: the strategy base class, the LiDAR clusters (cv2 is only needed for camera images: optional here),
# the car's measures and the LiDAR odometry.
cp "$SRC/src/robotek_course/robotek_course/obstacle_base.py" "$OUT/robotek_course/"
sed 's/^import cv2$/try:\n    import cv2\nexcept ImportError:          # the web lessons have no OpenCV (camera images are not simulated)\n    cv2 = None/' \
  "$SRC/src/robotek_course/robotek_course/obstacle_vision.py" > "$OUT/robotek_course/obstacle_vision.py"
: > "$OUT/robotek_common/__init__.py"
cp "$SRC/src/robotek_common/robotek_common/vehicle.py" "$SRC/src/robotek_common/robotek_common/lidar_odometry.py" "$OUT/robotek_common/"
cp "$SRC/course/tests/obstacle/conftest.py" "$SRC/course/tests/obstacle/fieldsim.py" "$OUT/obstacle/tests/"
for n in 1 2 3 4 5 6 7 8; do cp "$SRC/course/tests/obstacle/test_obstacle_step_$n.py" "$OUT/obstacle/tests/"; done
for m in lane localizer signs plan corner follow mission strategy park; do
  git -C "$SRC" show "obstacle-step-9:src/my_obstacle/my_obstacle/$m.py" > "$OUT/obstacle/ref/$m.py"
done
cp "$SRC/course/tests/conftest.py" "$SRC/course/tests/helpers.py" "$OUT/tests/"
for n in 1 2 3 4 5 6 7 8; do cp "$SRC/course/tests/test_step_$n.py" "$OUT/tests/"; done
for m in model heading perception lane arc turn_gate mission direction; do
  git -C "$SRC" show "step-9:src/my_open/my_open/$m.py" > "$OUT/ref/$m.py"
done
ls -R "$OUT" | head -40
