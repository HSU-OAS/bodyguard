"""Private non-human concave annulus probe for the installed native CDT API."""

import json
import sys
from pathlib import Path

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from projected_ribbon import fill

output = Path(sys.argv[sys.argv.index("--") + 1])
assert not output.exists() and bpy.app.version_string == "5.1.1"
mesh = bmesh.new()
try:
    # CCW X/-Z outer with a concave notch and inner square, not an avatar.
    outer = [
        mesh.verts.new((x, 0.1, -y))
        for x, y in ((0, 0), (3, 0), (3, 3), (2, 3), (2, 2), (1, 2), (1, 3), (0, 3))
    ]
    inner = [
        mesh.verts.new((x, 0.2, -y))
        for x, y in ((0.5, 0.5), (2.5, 0.5), (2.5, 1.5), (0.5, 1.5))
    ]
    retained = set(mesh.verts)
    faces, observed = fill(mesh, outer, inner)
    mesh.normal_update()
    assert set(mesh.verts) == retained
    assert all(face.normal.y > 0 for face in faces)
    assert all(
        edge.is_boundary for edge in mesh.edges if all(v in inner for v in edge.verts)
    )
    output.write_text(
        json.dumps(
            {
                "blender": bpy.app.version_string,
                "probe_passed": True,
                "private_non_human_mesh": True,
                "model_authored_or_saved": False,
                "appearance_approved": False,
                "clinical_or_camera_data": False,
                "observation": observed,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
finally:
    mesh.free()
