"""FR-A-02/03/08: read actual lower neck/shoulder geometry; never author/save."""

import hashlib
import json
import math
import sys
from collections import Counter, deque
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from artist_snapshot_values import snapshot

EXPECTED = "2932e63d0d9f7565ae2b9835377d941af2ffe894f8036037479fb2c3fcc1e394"


def boundary(faces):
    return {
        e
        for f in faces
        for e in f.edges
        if sum(other in faces for other in e.link_faces) == 1
    }


def patch(mesh, first, last, width, height):
    chosen = {
        f
        for f in mesh.faces
        if all(
            v.co.y > 0
            and abs(v.co.x) / height < width
            and first < v.co.z / height < last
            for v in f.verts
        )
    }
    before = len(chosen)
    pruned = []
    for _ in range(8):
        borders = boundary(chosen)
        counts = Counter(v for e in borders for v in e.verts)
        bad = {v for v, n in counts.items() if n != 2}
        if not bad:
            break
        removed = {f for f in chosen if any(v in bad for v in f.verts)}
        pruned.append(len(removed))
        chosen -= removed
    degree = Counter(v for e in boundary(chosen) for v in e.verts)
    edges = {e for f in chosen for e in f.edges if e.is_manifold}
    angles = [math.degrees(e.calc_face_angle()) for e in edges]
    return {
        "normalized_z_bounds": [first, last],
        "normalized_half_width": width,
        "original_faces": before,
        "pruned_faces": pruned,
        "faces_after_pruning": len(chosen),
        "negative_y_faces": sum(f.normal.y < 0 for f in chosen),
        "faces_below_minus_0_1_y": sum(f.normal.y < -0.1 for f in chosen),
        "tiny_faces": sum(f.calc_area() < 1e-10 for f in chosen),
        "boundary_degrees": dict(Counter(degree.values())),
        "maximum_native_dihedral_degrees": max(angles, default=0),
        "edges_above_90_degrees": sum(a > 90 for a in angles),
        "edges_above_120_degrees": sum(a > 120 for a in angles),
        "bad_face_centers_xyz_m": [
            list(f.calc_center_median()) for f in chosen if f.normal.y < -0.1
        ][:12],
    }


def section(body, z):
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
        edges = {e for e in result["geom_cut"] if isinstance(e, bmesh.types.BMEdge)}
        pending = {v for e in edges for v in e.verts}
        components = []
        while pending:
            seed = pending.pop()
            reached, queue = {seed}, deque([seed])
            while queue:
                vertex = queue.popleft()
                for e in vertex.link_edges:
                    if e not in edges:
                        continue
                    other = e.other_vert(vertex)
                    if other in pending:
                        pending.remove(other)
                        reached.add(other)
                        queue.append(other)
            current = {e for e in edges if all(v in reached for v in e.verts)}
            rear = {e for e in current if all(v.co.y > 0 for v in e.verts)}
            ordered = sorted({v for e in rear for v in e.verts}, key=lambda v: v.co.x)
            ids = {v: i for i, v in enumerate(ordered)}
            degree = Counter(v for e in current for v in e.verts)
            components.append(
                {
                    "vertices": len(reached),
                    "edges": len(current),
                    "closed_simple_loop": all(n == 2 for n in degree.values()),
                    "spans_center": min(v.co.x for v in reached)
                    < 0
                    < max(v.co.x for v in reached),
                    "x_bounds_m": [
                        min(v.co.x for v in reached),
                        max(v.co.x for v in reached),
                    ],
                    "rear_vertices": len(ordered),
                    "rear_monotone_x": bool(rear)
                    and all(abs(ids[e.verts[0]] - ids[e.verts[1]]) == 1 for e in rear),
                    "rear_maximum_dihedral_degrees": max(
                        (
                            math.degrees(e.calc_face_angle())
                            for e in rear
                            if e.is_manifold
                        ),
                        default=0,
                    ),
                }
            )
        return {"z_m": z, "components": components}
    finally:
        mesh.free()


source = Path(bpy.data.filepath)
output = Path(sys.argv[sys.argv.index("--") + 1])
assert not output.exists() and bpy.app.version_string == "5.1.1"
assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
report = {
    "blender": bpy.app.version_string,
    "input_sha256": EXPECTED,
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
        assert all(p.matrix_basis.is_identity for p in rig.pose.bones)
        mesh = bmesh.new()
        try:
            mesh.from_mesh(body.data)
            mesh.normal_update()
            height = max(v.co.z for v in mesh.verts)
            transform = body.matrix_world.inverted() @ rig.matrix_world
            low = (transform @ rig.data.bones["neck01"].head_local).z / height
            high = (transform @ rig.data.bones["neck02"].tail_local).z / height
            regions = [
                {"label": label, **patch(mesh, first, last, width, height)}
                for label, first, last, width in (
                    ("shoulder-original-mask", 0.82, low, 0.1),
                    ("neck-original-mask", low, high, 0.1),
                    ("shoulder-width-observation-only", 0.82, low, 0.16),
                )
            ]
        finally:
            mesh.free()
        evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        native = evaluated.to_mesh()
        try:
            assert len(native.vertices) == len(body.data.vertices)
            rest_difference = max(
                (native.vertices[v.index].co - v.co).length
                for v in body.data.vertices
                if v.co.y > 0 and 0.82 < v.co.z / height < high
            )
        finally:
            evaluated.to_mesh_clear()
        cuts = [
            section(body, height * (first + (last - first) * t))
            for first, last in ((0.82, low), (low, high))
            for t in (0.1, 0.5, 0.9)
        ]
        assert snapshot(body, rig) == before
        report["rows"].append(
            {
                "gender": gender,
                "body_height_m": height,
                "rest_pose_identity": True,
                "custom_normals": body.data.has_custom_normals,
                "maximum_rest_evaluation_difference_m": rest_difference,
                "regions": regions,
                "actual_cross_sections": cuts,
                "source_body_rig_exact": True,
            }
        )
    assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
    report["inspection_completed"] = True
except Exception as error:
    report["inspection_completed"] = False
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
