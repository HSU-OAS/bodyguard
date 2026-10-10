"""FR-A-02/08: installed native open-path capability, not a human/clinical test."""

import json
import sys
from pathlib import Path

import bmesh
import bpy

output = Path(sys.argv[sys.argv.index("--") + 1])
assert not output.exists()
assert bpy.app.version_string == "5.1.1"
rows = []
for first_count, second_count in ((5, 5), (8, 5)):
    mesh = bmesh.new()
    try:
        first = [
            mesh.verts.new((i / first_count, 0, 0)) for i in range(first_count + 1)
        ]
        second = [
            mesh.verts.new((i / second_count, 0, 0.2)) for i in range(second_count + 1)
        ]
        edges = [
            mesh.edges.new((vertices[i], vertices[i + 1]))
            for vertices in (first, second)
            for i in range(len(vertices) - 1)
        ]
        result = bmesh.ops.bridge_loops(
            mesh,
            edges=edges,
            use_pairs=True,
            use_merge=False,
            use_cyclic=False,
            twist_offset=0,
        )
        assert result["faces"]
        assert mesh.edges.get((first[0], second[0])) is not None
        assert mesh.edges.get((first[-1], second[-1])) is not None
        assert set(mesh.verts) == set(first + second)
        assert all(face.calc_area() > 1e-10 for face in mesh.faces)
        rows.append(
            {
                "open_path_edges": [first_count, second_count],
                "faces": len(mesh.faces),
                "endpoints_paired": True,
                "input_points_unchanged": True,
            }
        )
    finally:
        mesh.free()
output.write_text(
    json.dumps(
        {
            "blender": bpy.app.version_string,
            "bridge_doc": bmesh.ops.bridge_loops.__doc__,
            "rows": rows,
            "passed": True,
            "clinical_or_human_mesh": False,
            "scene_saved": False,
        },
        indent=2,
    ),
    encoding="utf-8",
)
