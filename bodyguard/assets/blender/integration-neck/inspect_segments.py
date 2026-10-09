"""FR-A-02/03: read-only professional rear-surface layout, not camera data."""

import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import bmesh
import bpy

EXPECTED = "ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b"
source = Path(bpy.data.filepath)
assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
target = Path(sys.argv[sys.argv.index("--") + 1])
assert not target.exists()
rows = []
for gender in ("Male", "Female"):
    body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.ensure_lookup_table()
        mesh.faces.ensure_lookup_table()
        mesh.normal_update()
        height = max(vertex.co.z for vertex in mesh.verts)
        rig_to_body = body.matrix_world.inverted() @ rig.matrix_world
        joints = {
            name: {
                "head_z": (rig_to_body @ bone.head_local).z / height,
                "tail_z": (rig_to_body @ bone.tail_local).z / height,
            }
            for name in ("neck01", "neck02", "neck03", "head")
            for bone in (rig.data.bones[name],)
        }
        lower = joints["neck01"]["head_z"]
        upper = joints["neck02"]["tail_z"]
        assert 0.82 < lower < upper < 0.94
        patches = []
        for label, first, last in (
            ("shoulder_transition", 0.82, lower),
            ("neck", lower, upper),
            ("occipital_transition", upper, 0.94),
        ):
            selected = {
                face
                for face in mesh.faces
                if all(
                    v.co.y > 0
                    and abs(v.co.x) / height < 0.1
                    and first < v.co.z / height < last
                    for v in face.verts
                )
            }
            edges = {
                edge
                for face in selected
                for edge in face.edges
                if sum(other in selected for other in edge.link_faces) == 1
            }
            incidence = Counter(vertex for edge in edges for vertex in edge.verts)
            pending = set(edges)
            loops = []
            while pending:
                current = pending.pop()
                group, stack = {current}, [current]
                while stack:
                    for vertex in stack.pop().verts:
                        for edge in vertex.link_edges:
                            if edge in pending:
                                pending.remove(edge)
                                group.add(edge)
                                stack.append(edge)
                points = {vertex for edge in group for vertex in edge.verts}
                degree = dict(Counter(incidence[v] for v in points))
                loops.append(
                    {
                        "edges": len(group),
                        "vertices": len(points),
                        "degree": degree,
                        "normalized_bounds": [
                            [
                                min(v.co[axis] for v in points) / height,
                                max(v.co[axis] for v in points) / height,
                            ]
                            for axis in range(3)
                        ],
                    }
                )
            patches.append(
                {
                    "label": label,
                    "z_bounds": [first, last],
                    "faces": len(selected),
                    "rear_facing_faces": sum(face.normal.y > 0.1 for face in selected),
                    "wrong_facing_faces": sum(
                        face.normal.y < -0.1 for face in selected
                    ),
                    "tiny_faces": sum(face.calc_area() < 1e-10 for face in selected),
                    "boundary_loops": sorted(
                        loops, key=lambda row: row["edges"], reverse=True
                    ),
                }
            )
        rows.append(
            {
                "gender": gender,
                "rest_rig_z_anchors": joints,
                "patches": patches,
                "body_world": [list(row) for row in body.matrix_world],
                "rig_world": [list(row) for row in rig.matrix_world],
            }
        )
    finally:
        mesh.free()
assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
target.write_text(
    json.dumps(
        {
            "input_sha256": EXPECTED,
            "blender": bpy.app.version_string,
            "read_only": True,
            "camera_data": False,
            "rows": rows,
        },
        indent=2,
    ),
    encoding="utf-8",
)
