"""FR-A-02/03/08: fair a duplicate professional surface; project only the join.

The native uniform target is never exported. Preserve the actual source front,
body, topology, raw skin and rig; a technical pass is not appearance approval.
"""

import hashlib
import json
import sys
from pathlib import Path

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lateral_contract import compare, quality, state
from surface_visibility import read

source = Path(bpy.data.filepath)
target, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
assert source_sha == "661a5ef5298512b5e32b4d98ae68ad5c8c5ff715c4a992f3895cc43b4a71bfe5"
assert not target.exists() and not output.exists(), "Never overwrite earlier evidence"
assert len({p.resolve() for p in (source, target, output)}) == 3
report = {
    "blender": bpy.app.version_string,
    "source_sha256": source_sha,
    "method": "native_uniform_duplicate_fairing_local_shrinkwrap",
    "passed": False,
    "appearance_approved": False,
    "rows": [],
}


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def taper(value, start, end):
    t = max(0.0, min(1.0, (value - start) / (end - start)))
    return t * t * (3 - 2 * t)


try:
    for gender in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
        before = state(body, rig)
        transform = body.matrix_world.inverted() @ rig.matrix_world
        # MPFB spine05 is near the pelvis, not the upper shoulder.
        shoulder = min(
            (transform @ rig.data.bones[f"upperarm01.{s}"].head_local).z for s in ("L", "R")
        )
        low = shoulder - 0.06
        high = (transform @ rig.data.bones["head"].head_local).z + 0.01
        shoulder_width = max(
            abs((transform @ rig.data.bones[f"upperarm01.{s}"].head_local).x) for s in ("L", "R")
        )
        width = shoulder_width + 0.02
        upper_taper = (transform @ rig.data.bones["neck03"].head_local).z
        assert low < shoulder < upper_taper < high and 0 < shoulder_width < width
        anterior = read(body)["anterior"]
        front = {i for face in body.data.polygons if face.index in anterior for i in face.vertices}
        group = body.vertex_groups.new(name="temporary uniform join projection")
        group_name = group.name
        selected = set()
        for vertex in body.data.vertices:
            x, y, z = vertex.co
            if vertex.index in front or y <= 0 or not low < z < high or abs(x) >= width:
                continue
            weight = (
                taper(z, low, shoulder)
                * (1 - taper(z, upper_taper, high))
                * (1 - taper(abs(x), shoulder_width, width))
            )
            group.add([vertex.index], weight, "REPLACE")
            selected.add(vertex.index)
        assert selected and not selected.intersection(front)
        row = {
            "gender": gender,
            "domain_m": {"low": low, "shoulder": shoulder, "high": high, "width": width},
            "before": quality(body, selected),
        }
        report["rows"].append(row)
        fair = body.copy()
        fair.data = body.data.copy()
        fair.name = "temporary uniform target"
        bpy.context.scene.collection.objects.link(fair)
        fair.modifiers.clear()
        fair.vertex_groups.clear()
        activate(fair)
        remesh = fair.modifiers.new("uniform professional surface target", "REMESH")
        remesh.mode = "VOXEL"
        remesh.voxel_size = 0.0025
        remesh.use_remove_disconnected = False
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        row["uniform_target_points"] = len(fair.data.vertices)
        # Keep a 4cm halo on the temporary target. Its coarse voxel facets must
        # not be stamped onto the artist mesh by nearest-point projection.
        mesh = bmesh.new()
        try:
            mesh.from_mesh(fair.data)
            outside = [
                v
                for v in mesh.verts
                if not low - 0.04 < v.co.z < high + 0.04 or abs(v.co.x) > width + 0.04
            ]
            bmesh.ops.delete(mesh, geom=outside, context="VERTS")
            mesh.to_mesh(fair.data)
            fair.data.update()
        finally:
            mesh.free()
        row["temporary_target_crop_points"] = len(fair.data.vertices)
        smoothing = fair.modifiers.new("uniform target fairing", "SMOOTH")
        smoothing.factor = 0.5
        smoothing.iterations = 20
        bpy.ops.object.modifier_apply(modifier=smoothing.name)
        subdivision = fair.modifiers.new("continuous target curvature", "SUBSURF")
        subdivision.levels = 1
        bpy.ops.object.modifier_apply(modifier=subdivision.name)
        activate(body)
        projection = body.modifiers.new("local uniform surface projection", "SHRINKWRAP")
        projection.target = fair
        projection.wrap_method = "PROJECT"
        projection.wrap_mode = "ON_SURFACE"
        projection.use_project_y = True
        projection.use_project_x = projection.use_project_z = False
        projection.use_positive_direction = projection.use_negative_direction = True
        projection.project_limit = 0.006
        projection.vertex_group = group_name
        projection.offset = 0
        # Fair the rest surface, not the result of skin deformation.
        while body.modifiers.find(projection.name) > 0:
            bpy.ops.object.modifier_move_up(modifier=projection.name)
        bpy.ops.object.modifier_apply(modifier=projection.name)
        body.vertex_groups.remove(body.vertex_groups[group_name])
        # Native world/local interpolation can move X/Z by float roundoff even
        # for a Y projection. Restore the original axes, do not loosen the check.
        row["native_projection_x_z_roundoff_m"] = max(
            max(abs(v.co[axis] - before["points"][v.index][axis]) for axis in (0, 2))
            for v in body.data.vertices
        )
        for index in selected:
            body.data.vertices[index].co.x = before["points"][index][0]
            body.data.vertices[index].co.z = before["points"][index][2]
        body.data.update()
        fair_mesh = fair.data
        bpy.data.objects.remove(fair, do_unlink=True)
        bpy.data.meshes.remove(fair_mesh)
        after = state(body, rig)
        row.update(compare(before, after, selected))
        assert all(before["points"][i] == after["points"][i] for i in front)
        assert all(
            a[0] == b[0] and a[2] == b[2]
            for a, b in zip(before["points"], after["points"], strict=True)
        )
        row["after"] = quality(body, selected)
        assert row["after"]["selected_dihedral_above_90"] == 0, "Projection introduced a fold"
        assert row["after"]["nonmanifold"] == 0 and row["after"]["winding"] == 0
        assert row["after"]["tiny_faces"] <= row["before"]["tiny_faces"]
        row["front_exact_and_no_exported_target"] = True
        row["all_original_x_z_coordinates_exact"] = True
        print("UNIFORM JOIN", gender, json.dumps(row), flush=True)
    assert hashlib.sha256(source.read_bytes()).hexdigest() == source_sha
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True, check_existing=True)
    report.update(passed=True, candidate_sha256=hashlib.sha256(target.read_bytes()).hexdigest())
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    report["source_unchanged"] = hashlib.sha256(source.read_bytes()).hexdigest() == source_sha
    report["candidate_present"] = target.exists()
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
