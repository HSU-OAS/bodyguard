"""FR-A-02/03/08: native transport of the existing professional surface.

Bind a private patch at actual A318 positions, constrain the actual folded core
and current protected border, then independently enforce source/core/protection.
No generated anatomy, topology/rig edit, falloff sweep or input overwrite.
"""

import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from lateral_contract import compare, quality, state
from lateral_domain import domain, weight

INPUT_SHA = "be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068"
ORIGIN_SHA = "2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff"
GENDERS = ("Male", "Female")
UNIT_SCALE = 1000.0  # Private solver units only; original coordinates remain metres.


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def objects(gender):
    return (
        bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"],
        bpy.data.objects[f"BODYGUARD {gender} rig WIP"],
    )


def patch(body, rig):
    bounds = domain(body, rig)
    selected = {
        i
        for i in bounds["selected"]
        if weight(body.data.vertices[i], bounds["selected"], bounds) > 0
    }
    faces = [
        tuple(p.vertices)
        for p in body.data.polygons
        if selected.intersection(p.vertices)
    ]
    points = {i for face in faces for i in face}
    ids = [item.value for item in body.data.attributes["a239_source_point_id"].data]
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.index_update()
        mesh.normal_update()
        selected_faces = {
            f for f in mesh.faces if all(v.index in selected for v in f.verts)
        }
        edges = {e for face in selected_faces for e in face.edges if e.is_manifold}
        folds = {e for e in edges if math.degrees(e.calc_face_angle()) > 90}
        core = {v.index for e in folds for f in e.link_faces for v in f.verts}
    finally:
        mesh.free()
    assert selected and core.issubset(selected), "Fold core crosses protected selection"
    assert not core.intersection(bounds["front"])
    assert all(ids[i] >= 0 for i in core), "Core has no original professional source"
    wanted = {ids[i] for i in points if ids[i] >= 0}
    assert len(wanted) == sum(ids[i] >= 0 for i in points), (
        "Ambiguous current source ID"
    )
    return {
        "selected": selected,
        "points": points,
        "faces": faces,
        "core": core,
        "ids": ids,
        "wanted": wanted,
    }


def original_positions(request):
    result = {}
    for gender in GENDERS:
        body, rig = objects(gender)
        before = state(body, rig)
        mapping = {}
        for i, item in enumerate(body.data.attributes["a239_source_point_id"].data):
            if item.value not in request[gender]["wanted"]:
                continue
            assert item.value not in mapping, "Ambiguous A318 source ID"
            vertex = body.data.vertices[i]
            mapping[item.value] = (
                tuple(vertex.co),
                [(g.group, g.weight) for g in vertex.groups],
            )
        assert set(mapping) == request[gender]["wanted"], (
            "Missing professional source point"
        )
        result[gender] = {
            "mapping": mapping,
            **{k: before[k] for k in ("world", "rest", "pose", "groups")},
        }
        assert state(body, rig) == before
    return result


def incident_geometry(body, selected):
    """Include the protected seam, not only faces wholly inside selection."""
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.index_update()
        mesh.normal_update()
        faces = {f for f in mesh.faces if any(v.index in selected for v in f.verts)}
        edges = {e for f in faces for e in f.edges if e.is_manifold}
        angles = [math.degrees(e.calc_face_angle()) for e in edges]
        return {
            "incident_faces": len(faces),
            "incident_dihedral_above_90": sum(angle > 90 for angle in angles),
            "incident_maximum_dihedral_degrees": max(angles, default=0),
        }
    finally:
        mesh.free()


def deform(body, spec, reference, row):
    indices = sorted(spec["points"])
    local = {native: i for i, native in enumerate(indices)}
    current = {i: tuple(body.data.vertices[i].co) for i in indices}
    original = {}
    for native in indices:
        identifier = spec["ids"][native]
        if identifier < 0:
            original[native] = current[native]
            continue
        position, skin = reference["mapping"][identifier]
        assert [(g.group, g.weight) for g in body.data.vertices[native].groups] == skin
        original[native] = position
    border = spec["points"] - spec["selected"]
    new_points = {i for i in indices if spec["ids"][i] < 0}
    anchors = border | spec["core"] | new_points
    assert anchors and not border.intersection(spec["core"])
    faces = [tuple(local[i] for i in face) for face in spec["faces"]]
    # Require a real fixed border per connected patch before calling native bind.
    neighbours = {i: set() for i in indices}
    for face in spec["faces"]:
        for a, b in zip(face, (*face[1:], face[0]), strict=True):
            neighbours[a].add(b)
            neighbours[b].add(a)
    remaining = set(indices)
    components = []
    while remaining:
        stack = [remaining.pop()]
        component = set(stack)
        while stack:
            for neighbour in neighbours[stack.pop()].intersection(remaining):
                remaining.remove(neighbour)
                component.add(neighbour)
                stack.append(neighbour)
        assert len(component.intersection(border)) >= 3, (
            "Unconstrained private component"
        )
        components.append(
            {"points": len(component), "anchors": len(component.intersection(anchors))}
        )
    row["private_patch"] = {
        "vertices": len(indices),
        "faces": len(faces),
        "core_points": len(spec["core"]),
        "border_points": len(border),
        "new_points_fixed": len(new_points),
        "components": components,
        "solver_unit_scale": UNIT_SCALE,
    }
    mesh = bpy.data.meshes.new("BODYGUARD private professional transport")
    obj = bpy.data.objects.new("BODYGUARD private native tool", mesh)
    bpy.context.scene.collection.objects.link(obj)
    try:
        mesh.from_pydata(
            [tuple(v * UNIT_SCALE for v in original[i]) for i in indices], [], faces
        )
        mesh.update()
        group = obj.vertex_groups.new(name="original core and protected border")
        group.add([local[i] for i in sorted(anchors)], 1.0, "REPLACE")
        modifier = obj.modifiers.new(
            name="professional transport", type="LAPLACIANDEFORM"
        )
        modifier.vertex_group = group.name
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.context.view_layer.update()
        row["native_default_iterations"] = modifier.iterations
        assert modifier.iterations == 1 and not modifier.is_bind
        assert bpy.ops.object.laplaciandeform_bind(modifier=modifier.name) == {
            "FINISHED"
        }
        assert modifier.is_bind
        for native in anchors:
            target = original[native] if native in spec["core"] else current[native]
            mesh.vertices[local[native]].co = tuple(v * UNIT_SCALE for v in target)
        mesh.update()
        bpy.context.view_layer.update()
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        result = evaluated.to_mesh()
        try:
            assert len(result.vertices) == len(indices)
            assert [tuple(p.vertices) for p in result.polygons] == faces
            solved = {
                i: tuple(v / UNIT_SCALE for v in result.vertices[local[i]].co)
                for i in indices
            }
            assert all(math.isfinite(v) for p in solved.values() for v in p)
            row["native_core_error_m_before_exact_clamp"] = max(
                (math.dist(solved[i], original[i]) for i in spec["core"]), default=0.0
            )
            row["native_border_error_m_discarded"] = max(
                math.dist(solved[i], current[i]) for i in border
            )
            for native in spec["selected"]:
                if native in new_points:
                    continue
                # Native anchors are soft. Exact core/protected source constraints
                # are independently enforced, followed by the full geometry gate.
                body.data.vertices[native].co = (
                    original[native]
                    if native in spec["core"]
                    else Vector(solved[native])
                )
            body.data.update()
            assert all(
                tuple(body.data.vertices[i].co) == original[i] for i in spec["core"]
            )
            assert all(
                tuple(body.data.vertices[i].co) == current[i]
                for i in border | new_points
            )
            row["core_original_positions_exact"] = True
            row["protected_border_and_new_points_exact"] = True
        finally:
            evaluated.to_mesh_clear()
    finally:
        bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.meshes.remove(mesh)


origin, target, output = (Path(value) for value in sys.argv[sys.argv.index("--") + 1 :])
source = Path(bpy.data.filepath)
assert (
    bpy.app.version_string == "5.1.1" and bpy.app.build_hash.decode() == "b70da489d7f4"
)
assert sha(source) == INPUT_SHA and sha(origin) == ORIGIN_SHA
assert not target.exists() and not output.exists()
assert len({p.resolve() for p in (source, origin, target, output)}) == 4
probe = json.loads(
    (
        HERE.parents[2]
        / "docs/review/avatar-neck-integration/native-deform-probe-confirmed/probe.json"
    ).read_text()
)
assert probe["completed"] and probe["positive_weight_solutions_exact"]
report = {
    "blender": bpy.app.version_string,
    "input_sha256": INPUT_SHA,
    "professional_origin_sha256": ORIGIN_SHA,
    "method": "native_transport_original_professional_patch_with_exact_core_and_protected_border",
    "appearance_approved": False,
    "clinical_or_camera_work": False,
    "passed": False,
    "saved_candidate": False,
    "rows": [],
}
try:
    request = {gender: patch(*objects(gender)) for gender in GENDERS}
    assert len(request["Male"]["core"]) == 27
    bpy.ops.wm.open_mainfile(filepath=str(origin), load_ui=False, use_scripts=False)
    reference = original_positions(request)
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    for gender in GENDERS:
        body, rig = objects(gender)
        assert (
            body.data.shape_keys is None
            and len(rig.data.bones) == 163
            and len(body.vertex_groups) == 139
        )
        assert len(body.modifiers) == 1 and body.modifiers[0].type == "ARMATURE"
        assert all(bone.matrix_basis.is_identity for bone in rig.pose.bones)
        before = state(body, rig)
        assert all(
            before[k] == reference[gender][k]
            for k in ("world", "rest", "pose", "groups")
        )
        spec = patch(body, rig)
        assert spec == request[gender]
        baseline = quality(body, spec["selected"])
        row = {
            "gender": gender,
            "before": baseline,
            "incident_before": incident_geometry(body, spec["selected"]),
        }
        report["rows"].append(row)
        deform(body, spec, reference[gender], row)
        row["after"] = quality(body, spec["selected"])
        row["incident_after"] = incident_geometry(body, spec["selected"])
        row.update(compare(before, state(body, rig), spec["selected"]))
        for key in ("vertices", "edges", "faces", "nonmanifold", "winding"):
            assert row["after"][key] == baseline[key], f"Native {key} changed"
        assert row["after"]["tiny_faces"] <= baseline["tiny_faces"], (
            "Tiny faces increased"
        )
        assert row["after"]["selected_dihedral_above_90"] == 0, (
            "Native transport folds remain"
        )
        assert row["incident_after"]["incident_dihedral_above_90"] == 0, (
            "Native transport protected seam folds remain"
        )
    assert sha(source) == INPUT_SHA and sha(origin) == ORIGIN_SHA
    assert not target.exists()
    bpy.ops.wm.save_as_mainfile(filepath=str(target), check_existing=True)
    report["candidate_sha256"] = sha(target)
    report["saved_candidate"] = report["passed"] = True
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    report["two_input_files_unchanged"] = (
        sha(source) == INPUT_SHA and sha(origin) == ORIGIN_SHA
    )
    report["candidate_present"] = target.exists()
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
