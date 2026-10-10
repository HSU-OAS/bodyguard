"""FR-A-02/03/08: native contour read-only probe, not an authored or approved body."""

import hashlib
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from artist_snapshot_values import snapshot
from posterior_contour import read

EXPECTED = "2932e63d0d9f7565ae2b9835377d941af2ffe894f8036037479fb2c3fcc1e394"
source = Path(bpy.data.filepath)
output = Path(sys.argv[sys.argv.index("--") + 1])
assert not output.exists() and bpy.app.version_string == "5.1.1"
assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
report = {
    "input_sha256": EXPECTED,
    "blender": bpy.app.version_string,
    "read_only_scene": True,
    "model_authored_or_saved": False,
    "appearance_approved": False,
    "clinical_or_camera_data": False,
    "rows": [],
}
try:
    for gender in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
        before = snapshot(body, rig)
        height = max(v.co.z for v in body.data.vertices)
        transform = body.matrix_world.inverted() @ rig.matrix_world
        low = (transform @ rig.data.bones["neck01"].head_local).z / height
        high = (transform @ rig.data.bones["neck02"].tail_local).z / height
        contours = [
            read(body, height * (first + (last - first) * t))
            for first, last in ((0.82, low), (low, high))
            for t in (0.1, 0.5, 0.9)
        ]
        assert snapshot(body, rig) == before
        report["rows"].append(
            {
                "gender": gender,
                "native_contours": contours,
                "source_body_rig_exact": True,
            }
        )
    assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
    report["inspection_completed"] = True
except Exception as error:
    report["inspection_completed"] = False
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
