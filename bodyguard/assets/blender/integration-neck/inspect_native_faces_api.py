"""FR-A-02/08: installed native face API, non-human private probe only."""

import json
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

output = Path(sys.argv[sys.argv.index("--") + 1])
assert not output.exists() and bpy.app.version_string == "5.1.1"
points = [Vector(value) for value in ((0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0))]
triangles = tessellate_polygon([points])
assert len(triangles) == 2
assert all(len(triangle) == 3 for triangle in triangles)
assert all(isinstance(index, int) and 0 <= index < 4 for t in triangles for index in t)
mesh = bmesh.new()
try:
    vertices = [mesh.verts.new(point) for point in points]
    face = mesh.faces.new(vertices)
    result = bmesh.ops.triangulate(
        mesh, faces=[face], quad_method="BEAUTY", ngon_method="BEAUTY"
    )
    assert len(result["faces"]) == 2 and len(mesh.faces) == 2
    assert [tuple(v.co) for v in mesh.verts] == [tuple(p) for p in points]
    report = {
        "blender": bpy.app.version_string,
        "nonhuman_private_probe": True,
        "tessellation_indices": triangles,
        "tessellate_polygon_native_doc": tessellate_polygon.__doc__,
        "triangulate_native_doc": bmesh.ops.triangulate.__doc__,
        "native_triangulate_result_keys": sorted(result),
        "native_triangulate_faces": len(result["faces"]),
        "passed": True,
        "model_or_rig_saved_or_modified": False,
    }
finally:
    mesh.free()
output.write_text(json.dumps(report, indent=2), encoding="utf-8")
