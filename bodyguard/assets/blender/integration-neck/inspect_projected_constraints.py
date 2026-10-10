"""Read native professional patch projection/CDT; never edit or save a body."""

import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector, geometry

sys.path.insert(0, str(Path(__file__).resolve().parent))
from artist_snapshot_values import snapshot

INPUT_SHA = "ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b"
EPSILON = 1e-12  # Native numerical near-point tolerance, not clinical accuracy.


def cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def intersections(polygon):
    result = []
    for i, a in enumerate(polygon):
        b = polygon[(i + 1) % len(polygon)]
        for j in range(i + 1, len(polygon)):
            if j == i + 1 or (i == 0 and j == len(polygon) - 1):
                continue
            c, d = polygon[j], polygon[(j + 1) % len(polygon)]
            values = (cross(a, b, c), cross(a, b, d), cross(c, d, a), cross(c, d, b))
            proper = values[0] * values[1] < 0 and values[2] * values[3] < 0
            contacts = []
            for point, first, last, value in (
                (c, a, b, values[0]),
                (d, a, b, values[1]),
                (a, c, d, values[2]),
                (b, c, d, values[3]),
            ):
                if abs(value) <= EPSILON and all(
                    min(first[k], last[k]) - EPSILON
                    <= point[k]
                    <= max(first[k], last[k]) + EPSILON
                    for k in (0, 1)
                ):
                    contacts.append(list(point))
            if proper or contacts:
                result.append({"edges": [i, j], "proper": proper, "contacts": contacts})
    return result


def cdt_observation(polygon):
    coords = [Vector(p) for p in polygon]
    edges = [(i, (i + 1) % len(coords)) for i in range(len(coords))]
    verts, result_edges, faces, orig, _, _ = geometry.delaunay_2d_cdt(
        coords, edges, [list(range(len(coords)))], 1, EPSILON, True
    )
    origins = Counter(i for ids in orig for i in ids)
    return {
        "input_vertices": len(coords),
        "output_vertices": len(verts),
        "output_faces": len(faces),
        "output_all_triangles": all(len(f) == 3 for f in faces),
        "one_to_one_original_vertices": len(orig) == len(coords)
        and all(len(ids) == 1 for ids in orig)
        and origins == Counter(range(len(coords))),
        "inserted_vertex_origins": [list(v) for v in orig if len(v) != 1],
        "maximum_returned_vertex_shift_m": max(
            (
                (verts[i] - coords[ids[0]]).length
                for i, ids in enumerate(orig)
                if len(ids) == 1
            ),
            default=0,
        ),
        "constraint_edges_present_without_splits": all(
            any(
                {orig[a][0], orig[b][0]} == set(edge)
                for a, b in result_edges
                if len(orig[a]) == len(orig[b]) == 1
            )
            for edge in edges
        ),
    }


source = Path(bpy.data.filepath)
output = Path(sys.argv[sys.argv.index("--") + 1])
assert bpy.app.version_string == "5.1.1"
assert not output.exists()
assert hashlib.sha256(source.read_bytes()).hexdigest() == INPUT_SHA
report = {
    "input_sha256": INPUT_SHA,
    "blender": bpy.app.version_string,
    "read_only_scene": True,
    "model_authored_or_saved": False,
    "appearance_approved": False,
    "clinical_or_camera_data": False,
    "native_cdt_doc": geometry.delaunay_2d_cdt.__doc__,
    "rows": [],
}
try:
    for gender in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
        before = snapshot(body, rig)
        mesh = bmesh.new()
        try:
            mesh.from_mesh(body.data)
            mesh.verts.index_update()
            mesh.normal_update()
            height = max(v.co.z for v in mesh.verts)
            transform = body.matrix_world.inverted() @ rig.matrix_world
            low = (transform @ rig.data.bones["neck02"].tail_local).z / height
            chosen = {
                f
                for f in mesh.faces
                if all(
                    v.co.y > 0
                    and abs(v.co.x) / height < 0.1
                    and low < v.co.z / height < 0.94
                    for v in f.verts
                )
            }
            for _ in range(8):
                borders = {
                    e
                    for f in chosen
                    for e in f.edges
                    if sum(other in chosen for other in e.link_faces) == 1
                }
                degrees = Counter(v for e in borders for v in e.verts)
                bad = {v for v, count in degrees.items() if count != 2}
                if not bad:
                    break
                chosen -= {f for f in chosen if any(v in bad for v in f.verts)}
            else:
                raise AssertionError("Original boundary remains irregular")
            successor = {}
            for edge in borders:
                face = next(f for f in edge.link_faces if f in chosen)
                loop = next(loop for loop in face.loops if loop.edge == edge)
                assert loop.vert not in successor
                successor[loop.vert] = loop.link_loop_next.vert
            start = min(successor, key=lambda v: v.index)
            ordered = [start]
            while successor[ordered[-1]] != start:
                assert successor[ordered[-1]] not in ordered
                ordered.append(successor[ordered[-1]])
            assert len(ordered) == len(borders)
            # X/-Z gives CCW in the native 2D API for a positive-Y rear face.
            polygon = [(v.co.x, -v.co.z) for v in ordered]
            crossing = intersections(polygon)
            row = {
                "gender": gender,
                "outer_boundary_points": len(ordered),
                "selected_faces": len(chosen),
                "source_selected_negative_y_faces": sum(f.normal.y < 0 for f in chosen),
                "source_selected_zero_y_faces": sum(f.normal.y == 0 for f in chosen),
                "signed_projected_area_m2": sum(
                    a[0] * polygon[(i + 1) % len(polygon)][1]
                    - polygon[(i + 1) % len(polygon)][0] * a[1]
                    for i, a in enumerate(polygon)
                )
                / 2,
                "nonadjacent_intersections": crossing,
                "boundary_source_ids": [v.index for v in ordered],
                "cdt": cdt_observation(polygon),
            }
            report["rows"].append(row)
        finally:
            mesh.free()
        assert snapshot(body, rig) == before, "Read-only body/rig snapshot changed"
        row["source_body_rig_exact"] = True
    assert hashlib.sha256(source.read_bytes()).hexdigest() == INPUT_SHA
    report["inspection_completed"] = True
except Exception as error:
    report["inspection_completed"] = False
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
