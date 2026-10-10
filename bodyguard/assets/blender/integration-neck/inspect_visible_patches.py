"""FR-A-02/03/08: distinguish visible posterior from coordinate-only selection."""

import hashlib
import json
import math
import sys
from collections import Counter, deque
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from artist_snapshot_values import snapshot

EXPECTED = "2932e63d0d9f7565ae2b9835377d941af2ffe894f8036037479fb2c3fcc1e394"


def inspect(body, low, high):
    height = max(v.co.z for v in body.data.vertices)
    body.data.calc_loop_triangles()
    triangles = list(body.data.loop_triangles)
    tree = BVHTree.FromPolygons(
        [v.co for v in body.data.vertices],
        [list(t.vertices) for t in triangles],
        all_triangles=True,
    )
    grouped = {}
    for triangle in triangles:
        grouped.setdefault(triangle.polygon_index, []).append(triangle)
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.faces.index_update()
        mesh.normal_update()
        original = {
            f
            for f in mesh.faces
            if all(
                v.co.y > 0
                and abs(v.co.x) / height < 0.1
                and low < v.co.z / height < high
                for v in f.verts
            )
        }
        visible = set()
        partially_visible = 0
        for face in original:
            samples = []
            for triangle in grouped[face.index]:
                center = (
                    sum((body.data.vertices[i].co for i in triangle.vertices), Vector())
                    / 3
                )
                point, _, index, _ = tree.ray_cast(
                    Vector((center.x, 1, center.z)), Vector((0, -1, 0)), 2
                )
                samples.append(
                    point is not None
                    and triangles[index].polygon_index == face.index
                    and abs(point.y - center.y) < 1e-6
                )
            if all(samples):
                visible.add(face)
            elif any(samples):
                partially_visible += 1
        borders = {
            e
            for f in visible
            for e in f.edges
            if sum(g in visible for g in e.link_faces) == 1
        }
        degree = Counter(v for e in borders for v in e.verts)
        pending, components = set(visible), []
        while pending:
            seed = pending.pop()
            reached, queue = {seed}, deque([seed])
            while queue:
                for edge in queue.popleft().edges:
                    for other in edge.link_faces:
                        if other in pending:
                            pending.remove(other)
                            reached.add(other)
                            queue.append(other)
            components.append(len(reached))
        angles = [
            math.degrees(e.calc_face_angle())
            for f in visible
            for e in f.edges
            if e.is_manifold
        ]
        return {
            "coordinate_only_faces": len(original),
            "fully_visible_faces": len(visible),
            "partially_visible_faces": partially_visible,
            "visible_negative_y_faces": sum(f.normal.y < 0 for f in visible),
            "excluded_negative_y_faces": sum(
                f.normal.y < 0 for f in original - visible
            ),
            "visible_face_components": sorted(components, reverse=True),
            "visible_boundary_degrees": dict(Counter(degree.values())),
            "visible_boundary_edges": len(borders),
            "maximum_visible_edge_dihedral_degrees": max(angles, default=0),
            "visible_face_source_ids": sorted(f.index for f in visible),
            "numerical_ray_coincidence_m": 1e-6,
        }
    finally:
        mesh.free()


source = Path(bpy.data.filepath)
output = Path(sys.argv[sys.argv.index("--") + 1])
assert not output.exists() and bpy.app.version_string == "5.1.1"
assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
report = {
    "input_sha256": EXPECTED,
    "blender": bpy.app.version_string,
    "read_only_scene": True,
    "model_authored_or_saved": False,
    "appearance_approved": False,
    "clinical_or_camera_data": False,
    "rows": [],
}
try:
    for gender in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
        before = snapshot(body, rig)
        height = max(v.co.z for v in body.data.vertices)
        transform = body.matrix_world.inverted() @ rig.matrix_world
        low = (transform @ rig.data.bones["neck01"].head_local).z / height
        high = (transform @ rig.data.bones["neck02"].tail_local).z / height
        result = [
            {"label": name, **inspect(body, first, last)}
            for name, first, last in (("shoulder", 0.82, low), ("neck", low, high))
        ]
        assert snapshot(body, rig) == before
        report["rows"].append(
            {"gender": gender, "source_body_rig_exact": True, "regions": result}
        )
    assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
    report["inspection_completed"] = True
except Exception as error:
    report["inspection_completed"] = False
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
