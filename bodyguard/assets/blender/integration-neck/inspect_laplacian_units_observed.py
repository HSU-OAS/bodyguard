"""FR-A-02/08: reproduce installed native small-area skips; read-only."""

import hashlib
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from artist_snapshot_values import snapshot
from lateral_domain import domain, weight

EXPECTED = "be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068"


def eligible(body, selected, scale):
    zero = set()
    threshold = 0.00001  # Installed native source b70da489d7f4, not clinical.
    for edge in body.data.edges:
        first, second = (body.data.vertices[i].co for i in edge.vertices)
        if (first - second).length * scale < threshold:
            zero.update(edge.vertices)
    for polygon in body.data.polygons:
        indices = list(polygon.vertices)
        for index, current in enumerate(indices):
            previous = body.data.vertices[indices[index - 1]].co
            center = body.data.vertices[current].co
            following = body.data.vertices[indices[(index + 1) % len(indices)]].co
            area = (center - previous).cross(following - previous).length / 2
            if area * scale * scale < threshold:
                zero.add(current)
    return {
        "working_scale": scale,
        "selected": len(selected),
        "native_small_area_or_edge_skipped": len(selected & zero),
        "native_eligible": len(selected - zero),
    }


source = Path(bpy.data.filepath)
output = Path(sys.argv[sys.argv.index("--") + 1])
assert not output.exists()
assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
report = {
    "blender": bpy.app.version_string,
    "input_sha256": EXPECTED,
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
        bounds = domain(body, rig)
        selected = {
            i
            for i in bounds["selected"]
            if weight(body.data.vertices[i], bounds["selected"], bounds) > 0
        }
        rows = [eligible(body, selected, scale) for scale in (1, 1000)]
        assert rows[1]["native_eligible"] > rows[0]["native_eligible"]
        # Eligibility and actual movement need not be identical (flat/numeric cases).
        exact_movement_match = (
            rows[0]["native_eligible"] == 76 if gender == "Male" else None
        )
        assert snapshot(body, rig) == before
        report["rows"].append(
            {
                "gender": gender,
                "source_body_rig_exact": True,
                "native_unit_eligibility": rows,
                "prior_male_trial_actual_moved_points": 76,
                "eligibility_equals_actual_movement_hypothesis": exact_movement_match,
                "source_unit_or_model_change_executed": False,
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
