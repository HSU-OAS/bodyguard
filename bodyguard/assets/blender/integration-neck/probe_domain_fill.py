"""FR-A-02/08: installed native annulus fill capability; no avatar mutation."""

import json
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

output = Path(sys.argv[sys.argv.index("--") + 1])
assert not output.exists() and bpy.app.version_string == "5.1.1"
mesh = bmesh.new()
try:
    loops = []
    for scale in (1, 0.5):
        vertices = [
            mesh.verts.new((scale * x, 0, scale * z))
            for x, z in ((-1, -1), (-1, 1), (1, 1), (1, -1))
        ]
        loops.append(
            [mesh.edges.new((v, vertices[(i + 1) % 4])) for i, v in enumerate(vertices)]
        )
    points = {v: tuple(v.co) for v in mesh.verts}
    result = bmesh.ops.triangle_fill(
        mesh,
        edges=[*loops[0], *loops[1]],
        normal=Vector((0, 1, 0)),
        use_beauty=True,
        use_dissolve=False,
    )
    mesh.normal_update()
    faces = [item for item in result["geom"] if isinstance(item, bmesh.types.BMFace)]
    assert faces and set(faces) == set(mesh.faces)
    assert all(e.is_boundary for e in loops[1]), "Native fill closed the inner hole"
    assert all(tuple(v.co) == points[v] for v in mesh.verts)
    area = sum(f.calc_area() for f in faces)
    assert abs(area - 3) < 1e-8
    assert all(f.normal.y > 0 for f in faces)
    output.write_text(
        json.dumps(
            {
                "passed": True,
                "blender": bpy.app.version_string,
                "triangle_fill_doc": bmesh.ops.triangle_fill.__doc__,
                "native_ring_faces": len(faces),
                "area": area,
                "inner_hole_preserved": True,
                "input_points_exact": True,
                "human_mesh_or_clinical_work": False,
                "scene_saved": False,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
finally:
    mesh.free()
