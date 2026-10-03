"""Native regression for the actual export finalizer; no human capture or asset adoption.

Blender --background --factory-startup --disable-autoexec --python-exit-code 1
  --python test_web_surface_topology.py -- web_surface_topology.py immutable-web.blend new-report.json
Imports the side-effect-free topology helper, not the exporter save/export workflow.
"""

import json
import sys
from hashlib import sha256
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import bpy

helper, source, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
assert not output.exists()
inputs = {str(p): sha256(p.read_bytes()).hexdigest() for p in (helper, source)}
spec = spec_from_file_location("web_surface_topology", helper)
assert spec is not None and spec.loader is not None
helpers = module_from_spec(spec)
spec.loader.exec_module(helpers)
finalize, area = helpers.final_web_triangles, helpers.triangle_area
assert bpy.ops.wm.open_mainfile(filepath=str(source)) == {"FINISHED"}
rows = []
for i, gender in enumerate(("Male", "Female")):
    original = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"].data
    detached = original.copy()
    try:
        result = finalize(detached)
        assert result["repaired_bad_parents"] == (31, 10)[i]
        assert result["explicit_good_parents"] == (40, 33)[i]
        assert result["zero_triangles_before"] == (11, 4)[i]
        assert result["zero_triangles_after"] == 0
        assert result["preserved_existing_tiny_triangles"] == (1, 0)[i]
        assert result["coordinates_skin_unrelated_triangles_exact"]
        assert not result["appearance_approved"]
        rows.append({"gender": gender, "positive": result})
    finally:
        bpy.data.meshes.remove(detached)
    corrupt = original.copy()
    try:
        face = next(
            f
            for f in corrupt.polygons
            if len(f.vertices) == 3
            and area([corrupt.vertices[v].co for v in f.vertices]) > 1e-8
        )
        corrupt.vertices[face.vertices[1]].co = corrupt.vertices[face.vertices[0]].co
        try:
            finalize(corrupt)
        except AssertionError as error:
            assert str(error) == "Existing zero-area triangle requires source repair"
            rows[-1]["synthetic_zero_triangle_rejected"] = str(error)
        else:
            raise AssertionError(
                "The finalizer accepted an existing zero-area triangle"
            )
    finally:
        bpy.data.meshes.remove(corrupt)
    print("FINAL TRIANGLE REGRESSION", json.dumps(rows[-1]), flush=True)
for path, digest in inputs.items():
    assert sha256(Path(path).read_bytes()).hexdigest() == digest
output.write_text(
    json.dumps(
        {
            "passed": True,
            "input_sha256": inputs,
            "rows": rows,
            "saved_assets": 0,
            "camera_calls": 0,
            "appearance_approved": False,
            "clinical_approved": False,
        },
        indent=2,
    )
    + "\n"
)
print("Native finalizer regression completed; original files unchanged", flush=True)
