"""FR-A-02/03: inspect a rejected native shape, never save/adopt its mesh."""

import hashlib
import json
import runpy
import sys
from pathlib import Path

import bmesh
import bpy

folder = Path(sys.argv[sys.argv.index("--") + 1])
assert folder.is_dir()
target = folder / "diagnostic-unsaved.blend"
author_report = folder / "diagnostic-author.json"
render_folder = folder / "diagnostic-render"
result_path = folder / "diagnostic-result.json"
assert not any(
    path.exists() for path in (target, author_report, render_folder, result_path)
)
source = Path(bpy.data.filepath)
source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
assert source_sha == "ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b"
scripts = Path(__file__).resolve().parent
assert bpy.app.version_string == "5.1.1", "Use the recorded native runtime"
assert hashlib.sha256(
    (scripts / "author_segmented_patch.py").read_bytes()
).hexdigest() == ("757011dcf7376ecfeb174ef2bb0ffa7dc8fc7a7762666148b98241261bff3d2d"), (
    "This diagnostic is bound to the rejected curvature author, not a newer candidate"
)
sys.argv = [
    "author_segmented_patch.py",
    "--",
    str(target),
    str(author_report),
    "occipital",
    source_sha,
]
try:
    runpy.run_path(str(scripts / "author_segmented_patch.py"), run_name="__main__")
except AssertionError as rejected:
    assert str(rejected).startswith("Native grid leaves source surface:"), str(rejected)
    report = json.loads(author_report.read_text())
    assert not report["passed"] and report["rows"] == []
    assert report["last_grid"]["gender"] == "Male"
    assert not target.exists()
    # Flush the temporary rejected edit for a neutral geometry-only preview.
    body = bpy.context.object
    assert body.name == "BODYGUARD Male sculpt WIP" and body.mode == "EDIT"
    bmesh.update_edit_mesh(body.data)
    bpy.ops.object.mode_set(mode="OBJECT")
    sys.argv = ["render_comparison.py", "--", str(render_folder)]
    runpy.run_path(str(scripts / "render_comparison.py"), run_name="__main__")
    assert hashlib.sha256(source.read_bytes()).hexdigest() == source_sha
    assert not target.exists()
    result_path.write_text(
        json.dumps(
            {
                "source_sha256": source_sha,
                "blender": bpy.app.version_string,
                "authoring_passed": False,
                "candidate_saved": False,
                "diagnostic_neutral_render_only": True,
                "male": "rejected partial grid; native skin transfer/remap not executed",
                "female": "unchanged source control; female authoring not executed",
                "full_deformation_glb_browser_executed": False,
                "appearance_approved": False,
                "final_avatar_adopted": False,
                "author_failure": str(rejected),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    raise
else:
    raise AssertionError(
        "Expected rejection was not reproduced; diagnostic must be reevaluated"
    )
