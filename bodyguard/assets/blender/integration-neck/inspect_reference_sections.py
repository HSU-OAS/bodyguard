"""FR-A-02/03/08: inspect professional head sections on private BMesh copies."""

import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

expected = "ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b"
source = Path(bpy.data.filepath)
target = Path(sys.argv[sys.argv.index("--") + 1])
assert not target.exists() and target.resolve() != source.resolve()
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
assert bpy.app.version_string == "5.1.1"
api = bmesh.ops.bisect_plane.__doc__
assert all(
    name in api for name in ("plane_co", "plane_no", "clear_inner", "clear_outer")
)
rows = []
for gender in ("Male", "Female"):
    body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
    assert all(bone.matrix_basis.is_identity for bone in rig.pose.bones)
    height = max(vertex.co.z for vertex in body.data.vertices)
    rig_to_body = body.matrix_world.inverted() @ rig.matrix_world
    lower = (rig_to_body @ rig.data.bones["neck02"].tail_local).z / height
    upper = 0.94
    sections = []
    for step in range(1, 6):
        z = height * (lower + (upper - lower) * step / 6)
        mesh = bmesh.new()
        try:
            mesh.from_mesh(body.data)
            result = bmesh.ops.bisect_plane(
                mesh,
                geom=[*mesh.verts, *mesh.edges, *mesh.faces],
                dist=1e-8,
                plane_co=Vector((0, 0, z)),
                plane_no=Vector((0, 0, 1)),
                clear_inner=False,
                clear_outer=False,
                use_snap_center=False,
            )
            mesh.normal_update()
            edges = {
                item
                for item in result["geom_cut"]
                if isinstance(item, bmesh.types.BMEdge)
            }
            assert edges
            pending = set(edges)
            components = []
            while pending:
                first = pending.pop()
                group, stack = {first}, [first]
                while stack:
                    for vertex in stack.pop().verts:
                        for edge in vertex.link_edges:
                            if edge in pending:
                                pending.remove(edge)
                                group.add(edge)
                                stack.append(edge)
                points = {vertex for edge in group for vertex in edge.verts}
                degrees = [
                    sum(edge in group for edge in vertex.link_edges)
                    for vertex in points
                ]
                rear = [
                    edge
                    for edge in group
                    if all(vertex.co.y > 0 for vertex in edge.verts)
                ]
                angles = [edge.calc_face_angle() for edge in rear if edge.is_manifold]
                components.append(
                    {
                        "points": len(points),
                        "edges": len(group),
                        "closed_simple_loop": all(degree == 2 for degree in degrees),
                        "rear_edges": len(rear),
                        "maximum_rear_dihedral_degrees": math.degrees(
                            max(angles, default=0)
                        ),
                        "bounds_m": [
                            [
                                min(vertex.co[axis] for vertex in points),
                                max(vertex.co[axis] for vertex in points),
                            ]
                            for axis in range(3)
                        ],
                    }
                )
            sections.append({"height_ratio": z / height, "components": components})
        finally:
            mesh.free()
    rows.append({"gender": gender, "sections": sections})
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
target.write_text(
    json.dumps(
        {
            "input_sha256": expected,
            "blender": bpy.app.version_string,
            "read_only_scene": True,
            "private_bmesh_copies_only": True,
            "source_saved_or_modified": False,
            "new_surface_authored": False,
            "clinical_or_camera_data": False,
            "bisect_api": api,
            "rows": rows,
        },
        indent=2,
    ),
    encoding="utf-8",
)
