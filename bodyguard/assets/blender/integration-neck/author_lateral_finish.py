"""FR-A-02/03/08: one native local finish on existing professional anatomy.

Only saves after exact protection and fold/tiny/budget checks. No rendering,
clinical thresholds, user data, full-body generation or original overwrites.
"""

import hashlib
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lateral_contract import compare, quality, state
from lateral_domain import domain, weight

EXPECTED = "be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def selected_points(body, bounds):
    return {
        i
        for i in bounds["selected"]
        if weight(body.data.vertices[i], bounds["selected"], bounds) > 0
    }


args = sys.argv[sys.argv.index("--") + 1 :]
assert len(args) == 3 and args[0] in ("author", "compare")
mode, target, output = args[0], Path(args[1]), Path(args[2])
source = Path(bpy.data.filepath)
assert not output.exists() and output.resolve() not in (
    target.resolve(),
    source.resolve(),
)
assert bpy.app.version_string == "5.1.1"
loaded_sha = digest(source)
report = {
    "blender": bpy.app.version_string,
    "loaded_sha256": loaded_sha,
    "input_sha256": EXPECTED,
    "mode": mode,
    "passed": False,
    "appearance_approved": False,
    "clinical_or_camera_work": False,
    "saved_candidate": False,
    "rows": [],
    "parameters": {
        "native_type": "LAPLACIANSMOOTH",
        "lambda": 0.2,
        "iterations": 12,
        "border": 0.0,
        "normalized": True,
        "builtin_global_volume_preserve": False,
    },
}
try:
    if mode == "author":
        assert loaded_sha == EXPECTED
        assert not target.exists() and target.resolve() != source.resolve()
        for gender in ("Male", "Female"):
            body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
            rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
            assert body.data.shape_keys is None
            assert len(rig.data.bones) == 163 and len(body.vertex_groups) == 139
            assert len(body.modifiers) == 1 and body.modifiers[0].type == "ARMATURE"
            assert all(b.matrix_basis.is_identity for b in rig.pose.bones)
            before = state(body, rig)
            bounds = domain(body, rig)
            selected = selected_points(body, bounds)
            original = quality(body, selected)
            row = {"gender": gender, "before": original}
            report["rows"].append(row)
            bpy.ops.object.select_all(action="DESELECT")
            body.select_set(True)
            bpy.context.view_layer.objects.active = body
            name = "INTEGRATION lateral finish"
            assert body.vertex_groups.get(name) is None
            group = body.vertex_groups.new(name=name)
            for index in selected:
                group.add(
                    [index],
                    weight(body.data.vertices[index], selected, bounds),
                    "REPLACE",
                )
            modifier = body.modifiers.new("Native lateral finish", "LAPLACIANSMOOTH")
            modifier.vertex_group = name
            modifier.lambda_factor = 0.2
            modifier.lambda_border = 0.0
            modifier.iterations = 12
            modifier.use_normalized = True
            modifier.use_volume_preserve = False
            modifier.use_x = modifier.use_y = modifier.use_z = True
            bpy.ops.object.modifier_move_up(modifier=modifier.name)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            body.vertex_groups.remove(body.vertex_groups[name])
            row["after"] = quality(body, selected)
            row.update(compare(before, state(body, rig), selected))
            for key in ("vertices", "edges", "faces", "nonmanifold", "winding"):
                assert row["after"][key] == original[key], f"Geometry changed: {key}"
            assert row["after"]["tiny_faces"] <= original["tiny_faces"], (
                "Tiny faces increased"
            )
            assert row["after"]["selected_dihedral_above_90"] == 0, (
                "Lateral folded faces remain"
            )
        assert digest(source) == EXPECTED
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(target), check_existing=True)
        report["output_sha256"] = digest(target)
        report["saved_candidate"] = True
    else:
        assert target.resolve() != source.resolve() and loaded_sha == EXPECTED
        candidate_sha = digest(target)
        assert candidate_sha != EXPECTED
        original = {}
        for gender in ("Male", "Female"):
            body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
            rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
            selected = selected_points(body, domain(body, rig))
            original[gender] = {
                "state": state(body, rig),
                "selected": selected,
                "geometry": quality(body, selected),
            }
        bpy.ops.wm.open_mainfile(filepath=str(target), load_ui=False, use_scripts=False)
        for gender in ("Male", "Female"):
            body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
            rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
            old = original[gender]
            current = quality(body, old["selected"])
            row = {
                "gender": gender,
                "before": old["geometry"],
                "after": current,
                **compare(old["state"], state(body, rig), old["selected"]),
            }
            report["rows"].append(row)
            for key in ("vertices", "edges", "faces", "nonmanifold", "winding"):
                assert current[key] == old["geometry"][key]
            assert current["tiny_faces"] <= old["geometry"]["tiny_faces"]
            assert current["selected_dihedral_above_90"] == 0
        assert digest(target) == candidate_sha
        report["candidate_sha256"] = candidate_sha
        report["independent_reopen"] = True
    assert digest(source) == loaded_sha
    report["passed"] = True
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
