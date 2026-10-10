"""FR-A-02/03/08: independent reopen/protection check of a partial central neck candidate.

Never saves, renders, approves appearance or runs clinical/camera verification.
"""

import hashlib
import json
import math
import sys
from collections import Counter
from pathlib import Path

import bmesh
import bpy
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from artist_snapshot_values import snapshot
from surface_visibility import read as read_visibility

INPUT_SHA = "2932e63d0d9f7565ae2b9835377d941af2ffe894f8036037479fb2c3fcc1e394"
ORIGIN = "integration sectioned original neck-center"
HISTORY_ARRAYS = (
    "bodyguard_authoring_a123_original_ids",
    "bodyguard_a146_parent_ids",
    "bodyguard_a195_parent_ids",
)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(values):
    values = tuple(values)
    first = values.index(min(values))
    return values[first:] + values[:first]


def fixed(state):
    result = dict(state)
    for key in ("points", "skin", "faces", "point_ledger", "hands"):
        result.pop(key)
    result["properties"] = dict(result["properties"])
    for key in (*HISTORY_ARRAYS, "bodyguard_distal_hand_vertices"):
        result["properties"].pop(key)
    return result


def geometry(body):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        return {
            "nonmanifold": sum(not e.is_manifold for e in mesh.edges),
            "winding": sum(not e.is_contiguous for e in mesh.edges if e.is_manifold),
            "tiny_faces": sum(f.calc_area() < 1e-10 for f in mesh.faces),
        }
    finally:
        mesh.free()


def integer_attributes(body):
    return {
        a.name: [item.value for item in a.data]
        for a in body.data.attributes
        if a.domain == "POINT" and a.data_type == "INT"
    }


def source_patch(body, rig):
    anterior = read_visibility(body)["anterior"]
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.index_update()
        mesh.faces.index_update()
        height = max(v.co.z for v in mesh.verts)
        transform = body.matrix_world.inverted() @ rig.matrix_world
        lower = (transform @ rig.data.bones["neck01"].head_local).z / height
        upper = (transform @ rig.data.bones["neck02"].tail_local).z / height
        chosen = {
            face
            for face in mesh.faces
            if all(
                v.co.y > 0
                and abs(v.co.x) / height < 0.025
                and lower < v.co.z / height < upper
                for v in face.verts
            )
            and face.index not in anterior
        }
        assert not any(face.index in anterior for face in chosen)
        for _ in range(8):
            borders = {
                e
                for face in chosen
                for e in face.edges
                if sum(other in chosen for other in e.link_faces) == 1
            }
            degrees = Counter(v for edge in borders for v in edge.verts)
            bad = {v for v, degree in degrees.items() if degree != 2}
            if not bad:
                break
            remove = {face for face in chosen if any(v in bad for v in face.verts)}
            assert remove
            chosen -= remove
        else:
            raise AssertionError("Original boundary is not regular")
        assert len(chosen) > 500
        protected = {
            v.index for v in mesh.verts if any(f not in chosen for f in v.link_faces)
        }
        protected |= {v.index for edge in borders for v in edge.verts}
        polygons = Counter(
            (canonical(v.index for v in face.verts), face.material_index, face.smooth)
            for face in mesh.faces
            if face not in chosen
        )
        return protected, polygons, {face.index for face in chosen}, anterior
    finally:
        mesh.free()


args = sys.argv[sys.argv.index("--") + 1 :]
assert len(args) == 3
source, output = map(Path, args[:2])
expected_candidate = args[2]
candidate = Path(bpy.data.filepath)
assert not output.exists() and output.resolve() not in (
    source.resolve(),
    candidate.resolve(),
)
report = {
    "passed": False,
    "blender": bpy.app.version_string,
    "independent_reopen": True,
    "appearance_approved": False,
    "clinical_or_camera_work": False,
    "source_saved_or_modified": False,
    "full_deformation_glb_browser_executed": False,
    "rows": [],
}
try:
    assert bpy.app.version_string == "5.1.1"
    assert sha(source) == INPUT_SHA
    assert expected_candidate != INPUT_SHA, "Unchanged input cannot be a new candidate"
    assert sha(candidate) == expected_candidate
    assert candidate.resolve() != source.resolve()
    report.update({"input_sha256": INPUT_SHA, "candidate_sha256": expected_candidate})
    current = {}
    for gender in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
        attribute = body.data.attributes.get(ORIGIN)
        assert (
            attribute is not None
            and attribute.domain == "POINT"
            and attribute.data_type == "INT"
        )
        current[gender] = {
            "state": snapshot(body, rig),
            "geometry": geometry(body),
            "origin": [item.value for item in attribute.data],
            "history": {key: list(body[key]) for key in HISTORY_ARRAYS},
            "integer_attributes": integer_attributes(body),
        }
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    for gender in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
        old = snapshot(body, rig)
        saved = current[gender]
        new, ids = saved["state"], saved["origin"]
        assert len(rig.data.bones) == 163 and len(body.vertex_groups) == 139
        assert all(b.matrix_basis.is_identity for b in rig.pose.bones)
        assert fixed(old) == fixed(new), (
            "Rest rig, world, PBR or group configuration changed"
        )
        protected, outside, selected, anterior = source_patch(body, rig)
        previous_integers = integer_attributes(body)
        assert set(previous_integers) < set(saved["integer_attributes"])
        assert len(ids) == len(new["points"])
        remap = {old_id: new_id for new_id, old_id in enumerate(ids) if old_id >= 0}
        assert len(remap) == sum(old_id >= 0 for old_id in ids)
        assert set(remap) == protected, "Protected original point missing or extra"
        assert all(old_id == -1 or old_id in protected for old_id in ids)
        for old_id, new_id in remap.items():
            assert new["points"][new_id] == old["points"][old_id]
            assert new["skin"][new_id] == old["skin"][old_id]
            assert new["point_ledger"][new_id] == old["point_ledger"][old_id]
        kept = Counter()
        for values, material, smooth in new["faces"]:
            original_ids = tuple(ids[i] for i in values)
            if all(i >= 0 for i in original_ids):
                key = (canonical(original_ids), material, smooth)
                if key in outside:
                    kept[key] += 1
        assert kept == outside, "Original outside polygons changed"
        assert all(
            i in protected for i, point in enumerate(old["points"]) if point[1] <= 0
        )
        assert new["hands"] == [remap[i] for i in old["hands"]]
        for key, values in previous_integers.items():
            assert saved["integer_attributes"][key] == [
                values[i] if i >= 0 else -1 for i in ids
            ], "Previous point provenance changed"
        assert not anterior.intersection(selected)
        for key in HISTORY_ARRAYS:
            assert saved["history"][key] == [
                body[key][i] if i >= 0 else -1 for i in ids
            ]
        body.data.calc_loop_triangles()
        triangles = [
            tuple(t.vertices)
            for t in body.data.loop_triangles
            if t.polygon_index in selected
        ]
        tree = BVHTree.FromPolygons(old["points"], triangles, all_triangles=True)
        maximum, count = 0, 0
        for index, point in enumerate(new["points"]):
            assert all(math.isfinite(value) for value in point)
            assert abs(sum(value for _, value in new["skin"][index]) - 1) < 0.01
            if ids[index] >= 0:
                continue
            count += 1
            assert new["point_ledger"][index] == -1
            position, _, _, distance = tree.find_nearest(point)
            assert position is not None and distance < 0.006, (
                "Local surface budget exceeded"
            )
            maximum = max(maximum, distance)
        assert count > 0
        original_geometry = geometry(body)
        assert saved["geometry"]["nonmanifold"] == saved["geometry"]["winding"] == 0
        assert saved["geometry"]["tiny_faces"] <= original_geometry["tiny_faces"]
        report["rows"].append(
            {
                "gender": gender,
                "new_points": count,
                "maximum_surface_distance_m": maximum,
                "outside_coordinates_raw_skin_polygons_exact": True,
                "rest_rig_world_material_history_front_hands_exact": True,
                "actual_anterior_visible_faces_protected": len(anterior),
                "previous_point_integer_attributes_exact": True,
                "geometry": saved["geometry"],
            }
        )
    assert sha(source) == INPUT_SHA and sha(candidate) == expected_candidate
    report["passed"] = True
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
