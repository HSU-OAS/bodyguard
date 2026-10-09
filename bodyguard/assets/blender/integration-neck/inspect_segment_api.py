"""FR-A-02/03: inspect installed native patch APIs; no mesh edit or save."""

import hashlib
import json
import sys
from pathlib import Path

import bmesh
import bpy

expected = "ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b"
source = Path(bpy.data.filepath)
target = Path(sys.argv[sys.argv.index("--") + 1])
assert not target.exists() and target.resolve() != source.resolve()
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
assert bpy.app.version_string == "5.1.1"
grid = bmesh.ops.grid_fill.__doc__
bridge = bmesh.ops.bridge_loops.__doc__
assert isinstance(grid, str) and isinstance(bridge, str)
assert all(
    name in grid for name in ("edges", "mat_nr", "use_smooth", "use_interp_simple")
)
assert all(
    name in bridge for name in ("edges", "use_pairs", "use_merge", "twist_offset")
)
properties = [p.identifier for p in bpy.ops.mesh.fill_grid.get_rna_type().properties]
assert all(name in properties for name in ("span", "offset", "use_interp_simple"))
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
target.write_text(
    json.dumps(
        {
            "input_sha256": expected,
            "blender": bpy.app.version_string,
            "read_only": True,
            "geometry_modified": False,
            "candidate_saved": False,
            "camera_data": False,
            "native_grid_fill_doc": grid,
            "native_bridge_doc": bridge,
            "editor_grid_fill_properties": properties,
            "two_explicit_open_boundaries_authoring_executed": False,
            "clinical_or_appearance_approval": False,
        },
        indent=2,
    ),
    encoding="utf-8",
)
