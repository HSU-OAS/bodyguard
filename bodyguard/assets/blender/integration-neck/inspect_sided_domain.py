"""FR-A-02/03/08: read front-protected local neck domains; never save a model."""

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
from surface_visibility import read

EXPECTED = "2932e63d0d9f7565ae2b9835377d941af2ffe894f8036037479fb2c3fcc1e394"


def inspect(body, first, last, anterior):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.index_update()
        mesh.faces.index_update()
        mesh.normal_update()
        height = max(v.co.z for v in mesh.verts)
        original = {
            f
            for f in mesh.faces
            if all(
                v.co.y > 0
                and abs(v.co.x) / height < 0.1
                and first < v.co.z / height < last
                for v in f.verts
            )
        }
        chosen = {f for f in original if f.index not in anterior}
        pruned = []
        for _ in range(8):
            borders = {
                e
                for f in chosen
                for e in f.edges
                if sum(g in chosen for g in e.link_faces) == 1
            }
            degrees = Counter(v for e in borders for v in e.verts)
            bad = {v for v, n in degrees.items() if n != 2}
            if not bad:
                break
            removed = {f for f in chosen if any(v in bad for v in f.verts)}
            pruned.append(len(removed))
            chosen -= removed
        row = {
            "coordinate_only_faces": len(original),
            "excluded_anterior_visible_faces": len(
                original - {f for f in original if f.index not in anterior}
            ),
            "pruned_faces": pruned,
            "remaining_faces": len(chosen),
            "remaining_negative_y_faces": sum(f.normal.y < 0 for f in chosen),
            "boundary_degrees": dict(Counter(degrees.values())),
            "loops": [],
            "source_anterior_faces_untouched": not any(
                f.index in anterior for f in chosen
            ),
        }
        if any(n != 2 for n in degrees.values()):
            row["regular_boundary"] = False
            return row
        row["regular_boundary"] = True
        successors = {}
        for edge in borders:
            face = next(f for f in edge.link_faces if f in chosen)
            loop = next(loop for loop in face.loops if loop.edge == edge)
            assert loop.vert not in successors
            successors[loop.vert] = loop.link_loop_next.vert
        pending = set(successors)
        while pending:
            start = min(pending, key=lambda v: v.index)
            pending.remove(start)
            ordered = [start]
            while successors[ordered[-1]] != start:
                vertex = successors[ordered[-1]]
                assert vertex in pending
                pending.remove(vertex)
                ordered.append(vertex)
            coords = [Vector((v.co.x, -v.co.z)) for v in ordered]
            edges = [(i, (i + 1) % len(coords)) for i in range(len(coords))]
            verts, _, faces, origins, _, _ = geometry.delaunay_2d_cdt(
                coords, edges, [list(range(len(coords)))], 1, 1e-12, True
            )
            row["loops"].append(
                {
                    "original_points": len(coords),
                    "cdt_points": len(verts),
                    "cdt_faces": len(faces),
                    "cdt_origins_one_to_one": len(origins) == len(coords)
                    and all(len(ids) == 1 for ids in origins)
                    and Counter(ids[0] for ids in origins)
                    == Counter(range(len(coords))),
                    "signed_projected_area_m2": sum(
                        a[0] * coords[(i + 1) % len(coords)][1]
                        - coords[(i + 1) % len(coords)][0] * a[1]
                        for i, a in enumerate(coords)
                    )
                    / 2,
                    "source_boundary_ids": [v.index for v in ordered],
                }
            )
        return row
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
        visibility = read(body)
        height = max(v.co.z for v in body.data.vertices)
        transform = body.matrix_world.inverted() @ rig.matrix_world
        low = (transform @ rig.data.bones["neck01"].head_local).z / height
        high = (transform @ rig.data.bones["neck02"].tail_local).z / height
        regions = [
            {"label": name, **inspect(body, first, last, visibility["anterior"])}
            for name, first, last in (("shoulder", 0.82, low), ("neck", low, high))
        ]
        assert snapshot(body, rig) == before
        report["rows"].append(
            {
                "gender": gender,
                "source_body_rig_exact": True,
                "regions": regions,
                "anterior_face_count": len(visibility["anterior"]),
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
