"""FR-A-02/03/08: neutral inspect of a rejected explicit grid; never save."""

import hashlib
import json
import runpy
import sys
from pathlib import Path

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
assert bpy.app.version_string == "5.1.1"
assert hashlib.sha256(
    (scripts / "author_explicit_patch.py").read_bytes()
).hexdigest() == ("7cbdb2e914ae100d210776b5248718e0d1cba47af82cb143e1b3ffbaa5f631a0"), (
    "This preview is bound to the rejected explicit simple grid"
)
assert hashlib.sha256((scripts / "render_comparison.py").read_bytes()).hexdigest() == (
    "80abd09c69f3edf9c17c39555a246ad1b6915da2799929fb66ee178e35f2d518"
)
sys.argv = [
    "author_explicit_patch.py",
    "--",
    str(target),
    str(author_report),
    "occipital",
    source_sha,
    "diagnostic",
]
try:
    runpy.run_path(str(scripts / "author_explicit_patch.py"), run_name="__main__")
except AssertionError as rejected:
    assert str(rejected).startswith("Native grid leaves source surface:"), str(rejected)
    report = json.loads(author_report.read_text())
    assert (
        not report["passed"] and report["rows"] == [] and report["diagnostic_no_save"]
    )
    assert report["last_grid"]["gender"] == "Male"
    assert report["last_grid"]["actual_native_corner_tags"] == [1, 2, 3, 4]
    assert report["last_grid"]["geometry_diagnostic"][
        "diagnostic_flushed_to_memory_only"
    ]
    assert not target.exists()
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
                "male": "rejected explicit simple grid; before native skin/remap",
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
        "Expected failure was not reproduced; never adopt this diagnostic"
    )
