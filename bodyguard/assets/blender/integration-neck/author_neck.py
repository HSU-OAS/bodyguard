"""FR-A-02/03/08: local Blender authoring on a protected professional source.

Blender --factory-startup --disable-autoexec -b input.blend --python-exit-code 1
  --python author_neck.py -- author new.blend report.json
  --python author_neck.py -- compare input.blend report.json
Never renders, changes rig/skin, generates a human or sets a clinical threshold.
"""

import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from artist_snapshot_values import snapshot

INPUT_SHA = "2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff"


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def taper(value, low, high):
    t = max(0, min(1, (value - low) / (high - low)))
    return t * t * (3 - 2 * t)


def mask(point, height):
    x, y, z = (v / height for v in point)
    return (
        (1 - taper(abs(x), 0.04, 0.075))
        * taper(y, 0, 0.025)
        * taper(z, 0.805, 0.85)
        * (1 - taper(z, 0.955, 0.98))
    )


def attribute_values(body):
    result = {}
    for attribute in body.data.attributes:
        if attribute.name == "position":
            continue  # the whole original point array is compared independently
        values = []
        for item in attribute.data:
            row = {}
            for prop in item.bl_rna.properties:
                if prop.identifier == "rna_type":
                    continue
                value = getattr(item, prop.identifier)
                if prop.is_array:
                    value = tuple(value)
                elif not isinstance(value, (int, float, bool, str)):
                    raise TypeError(f"Unhandled mesh attribute {attribute.name}")
                row[prop.identifier] = value
            values.append(row)
        result[attribute.name] = (attribute.data_type, attribute.domain, values)
    return result


def state():
    result = {}
    for label in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
        assert body.data.shape_keys is None, "Shape keys need explicit authoring"
        assert len(rig.data.bones) == 163
        assert len(body.vertex_groups) == 139
        assert len(body.modifiers) == 1
        assert body.modifiers[0].type == "ARMATURE"
        assert all(bone.matrix_basis.is_identity for bone in rig.pose.bones)
        data = snapshot(body, rig)
        data["attributes"] = attribute_values(body)
        data["edges"] = [tuple(e.vertices) for e in body.data.edges]
        result[label] = data
    return result


def geometry(body):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.normal_update()
        return {
            "vertices": len(mesh.verts),
            "edges": len(mesh.edges),
            "faces": len(mesh.faces),
            "nonmanifold": sum(not e.is_manifold for e in mesh.edges),
            "winding_errors": sum(
                not e.is_contiguous for e in mesh.edges if e.is_manifold
            ),
            "tiny_faces": sum(f.calc_area() < 1e-10 for f in mesh.faces),
        }
    finally:
        mesh.free()


def compare(before, after):
    rows = []
    for label in ("Male", "Female"):
        old, new = dict(before[label]), dict(after[label])
        a, b = old.pop("points"), new.pop("points")
        assert old == new, f"Non-coordinate anatomy/skin/rig changed: {label}"
        height = max(v[2] for v in a)
        moved = 0
        selected = 0
        maximum = 0
        for first, second in zip(a, b, strict=True):
            assert all(math.isfinite(v) for v in second)
            weight = mask(first, height)
            if weight == 0:
                assert first == second, f"Protected point changed: {label}"
            else:
                selected += 1
            distance = math.dist(first, second)
            moved += first != second
            maximum = max(maximum, distance)
        assert 0 < moved <= selected
        assert maximum < 0.006, "Existing local artist edit budget exceeded"
        rows.append(
            {
                "body": label,
                "vertices": len(a),
                "selected": selected,
                "moved": moved,
                "maximum_local_displacement_m": maximum,
                "outside_exact": True,
                "raw_skin_rest_pose_world_PBR_properties_attributes_edges_faces_exact": True,
            }
        )
    return rows


args = sys.argv[sys.argv.index("--") + 1 :]
report_path = Path(args[-1])
assert not report_path.exists(), "Use a new evidence path"
loaded = Path(bpy.data.filepath)
loaded_sha = digest(loaded)
report = {
    "blender": bpy.app.version_string,
    "loaded_sha256": loaded_sha,
    "clinical_or_camera_work": False,
    "appearance_approved": False,
    "passed": False,
}
try:
    if args[0] == "author":
        assert len(args) == 3
        target = Path(args[1])
        assert loaded_sha == INPUT_SHA
        assert not target.exists() and target.resolve() != loaded.resolve()
        before = state()
        before_geometry = {}
        for label in ("Male", "Female"):
            body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
            before_geometry[label] = geometry(body)
            bpy.ops.object.select_all(action="DESELECT")
            body.select_set(True)
            bpy.context.view_layer.objects.active = body
            height = max(v.co.z for v in body.data.vertices)
            group = body.vertex_groups.new(name="INTEGRATION posterior finish")
            group_name = group.name
            for vertex in body.data.vertices:
                weight = mask(vertex.co, height)
                if weight:
                    group.add([vertex.index], weight, "REPLACE")
            modifier = body.modifiers.new("Local posterior finish", "CORRECTIVE_SMOOTH")
            modifier.vertex_group = group_name
            modifier.factor = 0.3
            modifier.iterations = 16
            modifier.smooth_type = "LENGTH_WEIGHTED"
            modifier.use_only_smooth = True
            bpy.ops.object.modifier_move_up(modifier=modifier.name)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            body.vertex_groups.remove(body.vertex_groups[group_name])
        report["rows"] = compare(before, state())
        for label in ("Male", "Female"):
            current = geometry(bpy.data.objects[f"BODYGUARD {label} sculpt WIP"])
            assert current == before_geometry[label], "Topology boundary degraded"
        report["topology"] = before_geometry
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(target), check_existing=True)
        report["output_sha256"] = digest(target)
        report["saved_candidate"] = True
    elif args[0] == "compare":
        assert len(args) == 3
        after = state()
        after_geometry = {
            label: geometry(bpy.data.objects[f"BODYGUARD {label} sculpt WIP"])
            for label in ("Male", "Female")
        }
        source = Path(args[1])
        assert digest(source) == INPUT_SHA
        bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
        report["rows"] = compare(state(), after)
        for label in ("Male", "Female"):
            original = geometry(bpy.data.objects[f"BODYGUARD {label} sculpt WIP"])
            assert original == after_geometry[label]
        report["independent_reopen"] = True
        assert digest(source) == INPUT_SHA
    else:
        raise ValueError("Unknown authoring mode")
    assert digest(loaded) == loaded_sha, "Loaded source bytes changed"
    report["passed"] = True
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
