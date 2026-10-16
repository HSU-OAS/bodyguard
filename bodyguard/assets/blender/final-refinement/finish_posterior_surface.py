"""FR-A-02/03/08: post-retopology native length-weighted finish, not generated anatomy.

Keep the approved front, rig and raw skin exact with the existing 6mm bound. Finish only
the existing posterior neck/upper-shoulder surface after the folded core repair.
"""

import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lateral_contract import compare, quality, state
from surface_visibility import read

source = Path(bpy.data.filepath)
target, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


source_sha = sha(source)
assert source_sha == "e9c47f05aa5b0ec582dbefdabed0e3868d3d54dec710b7525c30f8aee35f806b"
assert not target.exists() and not output.exists()
assert len({p.resolve() for p in (source, target, output)}) == 3
report = {
    "blender": bpy.app.version_string,
    "source_sha256": source_sha,
    "passed": False,
    "appearance_approved": False,
    "rows": [],
}
try:
    for gender in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
        before = state(body, rig)
        transform = body.matrix_world.inverted() @ rig.matrix_world
        low = (transform @ rig.data.bones["spine05"].head_local).z
        high = (transform @ rig.data.bones["head"].head_local).z + 0.01
        half_width = max(
            abs((transform @ rig.data.bones[f"clavicle.{s}"].tail_local).x) for s in ("L", "R")
        )
        anterior = read(body)["anterior"]
        front = {i for face in body.data.polygons if face.index in anterior for i in face.vertices}
        group = body.vertex_groups.new(name="temporary posterior depth finish")
        group_name = group.name
        selected = set()
        for vertex in body.data.vertices:
            x, y, z = vertex.co
            if vertex.index in front or y <= 0 or not low < z < high or abs(x) >= half_width:
                continue
            t = (z - low) / (high - low)
            strength = (4 * t * (1 - t)) ** 2 * (1 - (abs(x) / half_width) ** 2) ** 2
            if strength > 0:
                group.add([vertex.index], strength, "REPLACE")
                selected.add(vertex.index)
        assert selected and not selected.intersection(front)
        baseline = quality(body, selected)
        bpy.ops.object.select_all(action="DESELECT")
        body.select_set(True)
        bpy.context.view_layer.objects.active = body
        modifier = body.modifiers.new(
            name="post-retopology length-weighted finish", type="CORRECTIVE_SMOOTH"
        )
        modifier.vertex_group = group.name
        modifier.smooth_type = "LENGTH_WEIGHTED"
        modifier.use_only_smooth = True
        modifier.factor = 0.5
        modifier.iterations = 8
        bpy.ops.object.modifier_move_up(modifier=modifier.name)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        body.vertex_groups.remove(body.vertex_groups[group_name])
        restored = set()
        # Restore only cells whose actual proposed finish folds; never accept a fold
        # or rerun smoothing with a looser threshold. Unstable cells retain artist shape.
        for _ in range(8):
            mesh = bmesh.new()
            try:
                mesh.from_mesh(body.data)
                mesh.verts.index_update()
                mesh.normal_update()
                faces = {f for f in mesh.faces if all(v.index in selected for v in f.verts)}
                folds = {
                    e
                    for f in faces
                    for e in f.edges
                    if e.is_manifold and math.degrees(e.calc_face_angle()) > 90
                }
                unsafe = {v.index for e in folds for f in e.link_faces for v in f.verts}
            finally:
                mesh.free()
            if not unsafe:
                break
            assert unsafe - restored, "Restorative safety guard made no progress"
            restored |= unsafe
            for index in unsafe:
                body.data.vertices[index].co = before["points"][index]
            body.data.update()
        else:
            raise AssertionError("Restorative safety guard did not resolve proposed folds")
        after = state(body, rig)
        row = {
            "gender": gender,
            "before": baseline,
            "after": quality(body, selected),
            "original_shape_retained_at_unsafe_points": len(restored),
        }
        report["rows"].append(row)
        row.update(compare(before, after, selected))
        assert all(before["points"][i] == after["points"][i] for i in front)
        assert row["after"]["selected_dihedral_above_90"] == 0, "Posterior finish introduced a fold"
        assert row["after"]["nonmanifold"] == 0 and row["after"]["winding"] == 0
        assert row["after"]["tiny_faces"] <= baseline["tiny_faces"]
        row["front_exact_and_local_6mm_shape_bound"] = True
    assert sha(source) == source_sha
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True, check_existing=True)
    report.update(passed=True, candidate_sha256=sha(target))
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    report["source_unchanged"] = sha(source) == source_sha
    report["candidate_present"] = target.exists()
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
