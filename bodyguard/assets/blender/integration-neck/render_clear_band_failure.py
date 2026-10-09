"""FR-A-02/08: actual neutral view of a rejected clear-band patch, no save."""

import hashlib
import json
import runpy
import sys
from pathlib import Path

import bpy

folder = Path(sys.argv[sys.argv.index("--") + 1])
scripts = Path(__file__).resolve().parent
source = Path(bpy.data.filepath)
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
source_hash = "ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b"
author = scripts / "author_sectioned_clear_band.py"
assert sha(source) == source_hash and bpy.app.version_string == "5.1.1"
assert sha(author) == "8c9b3c8641d1225469a926b59c3f783045c7769b6b5ec79660f28474abe473ec"
assert (
    sha(scripts / "render_comparison.py")
    == "80abd09c69f3edf9c17c39555a246ad1b6915da2799929fb66ee178e35f2d518"
)
model, report = (
    folder / "clear-diagnostic-unsaved.blend",
    folder / "clear-diagnostic-author.json",
)
render = folder / "render-clear-failure"
result = folder / "clear-diagnostic-result.json"
assert not any(path.exists() for path in (model, report, render, result))
sys.argv = [
    str(author),
    "--",
    str(model),
    str(report),
    "occipital",
    source_hash,
    "diagnostic",
]
try:
    runpy.run_path(str(author), run_name="__main__")
except AssertionError as failure:
    assert str(failure) == "New patch leaves the original projected interior"
    observed = json.loads(report.read_text())
    assert not observed["passed"] and observed["rows"] == []
    assert observed["diagnostic_no_save"] and observed["last_grid"]["gender"] == "Male"
    assert observed["last_grid"]["geometry_diagnostic"][
        "diagnostic_flushed_to_memory_only"
    ]
    assert not model.exists()
    sys.argv = [str(scripts / "render_comparison.py"), "--", str(render)]
    runpy.run_path(str(scripts / "render_comparison.py"), run_name="__main__")
    assert sha(source) == source_hash and not model.exists()
    result.write_text(
        json.dumps(
            {
                "input_sha256": source_hash,
                "blender": bpy.app.version_string,
                "authoring_passed": False,
                "candidate_saved": False,
                "diagnostic_neutral_render_only": True,
                "male": "rejected clear-band geometry; before skin transfer/remap",
                "female": "unchanged source control; not authored",
                "full_deformation_glb_browser_executed": False,
                "appearance_approved": False,
                "final_avatar_adopted": False,
                "failure": str(failure),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    raise
else:
    raise AssertionError("Expected failure missing; diagnostics may never be adopted")
