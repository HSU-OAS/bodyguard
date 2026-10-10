"""FR-A-02/03/08: continuous transition to original professional positions.

Existing mask/falloff, original topology and raw rig/skin only. No generated
anatomy, smoothing/parameter sweep, selection expansion or original overwrite.
"""

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from lateral_contract import compare, quality, state
from lateral_domain import domain, weight

INPUT_SHA = "be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068"
ORIGIN_SHA = "2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff"
GENDERS = ("Male", "Female")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def objects(gender):
    return (
        bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"],
        bpy.data.objects[f"BODYGUARD {gender} rig WIP"],
    )


def identifiers(body):
    ledger = body.data.attributes["a239_source_point_id"]
    assert ledger.data_type == "INT" and ledger.domain == "POINT"
    assert len(ledger.data) == len(body.data.vertices)
    return [item.value for item in ledger.data]


def transition(body, rig):
    bounds = domain(body, rig)
    result = {}
    for index in bounds["selected"]:
        amount = weight(body.data.vertices[index], bounds["selected"], bounds)
        assert math.isfinite(amount) and 0 <= amount <= 1
        if amount > 0:
            result[index] = amount
    assert result and not set(result).intersection(bounds["front"])
    return result


def read_reference(request):
    references = {}
    for gender in GENDERS:
        body, rig = objects(gender)
        before = state(body, rig)
        ids = identifiers(body)
        wanted = request[gender]["wanted"]
        mapping = {}
        for index, identifier in enumerate(ids):
            if identifier not in wanted:
                continue
            assert identifier not in mapping, "Ambiguous original point ID"
            vertex = body.data.vertices[index]
            mapping[identifier] = (
                tuple(vertex.co),
                [(group.group, group.weight) for group in vertex.groups],
            )
        assert set(mapping) == wanted, "Missing original professional point"
        references[gender] = {
            "mapping": mapping,
            **{key: before[key] for key in ("world", "rest", "pose", "groups")},
        }
        assert state(body, rig) == before, "Read-only original changed"
    return references


origin, target, output = (Path(value) for value in sys.argv[sys.argv.index("--") + 1 :])
source = Path(bpy.data.filepath)
assert bpy.app.version_string == "5.1.1"
assert sha(source) == INPUT_SHA and sha(origin) == ORIGIN_SHA
assert not target.exists() and not output.exists()
assert (
    len({source.resolve(), origin.resolve(), target.resolve(), output.resolve()}) == 4
)
frozen = HERE.parents[2] / "docs/review/avatar-neck-integration/lateral-restore"
manifest = json.loads((frozen / "manifest.json").read_text())
for name in (
    "lateral_contract.py",
    "lateral_domain.py",
    "artist_snapshot_values.py",
    "surface_visibility.py",
):
    entry = next(
        row for row in manifest["entries"] if row["file"] == f"executed-{name}.gz"
    )
    assert sha(HERE / name) == entry["raw_sha256"], "Frozen imported helper changed"
report = {
    "blender": bpy.app.version_string,
    "input_sha256": INPUT_SHA,
    "professional_origin_sha256": ORIGIN_SHA,
    "method": "original_professional_position_with_existing_continuous_falloff",
    "new_falloff_parameters": False,
    "raw_skin_rig_topology_changed": False,
    "appearance_approved": False,
    "clinical_or_camera_work": False,
    "passed": False,
    "saved_candidate": False,
    "rows": [],
}
try:
    request = {}
    for gender in GENDERS:
        body, rig = objects(gender)
        amounts = transition(body, rig)
        ids = identifiers(body)
        wanted = {ids[index] for index in amounts if ids[index] >= 0}
        assert wanted and len(wanted) == sum(ids[index] >= 0 for index in amounts)
        request[gender] = {"amounts": amounts, "wanted": wanted}
    bpy.ops.wm.open_mainfile(filepath=str(origin), load_ui=False, use_scripts=False)
    reference = read_reference(request)
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    for gender in GENDERS:
        body, rig = objects(gender)
        assert body.data.shape_keys is None
        assert len(rig.data.bones) == 163 and len(body.vertex_groups) == 139
        assert len(body.modifiers) == 1 and body.modifiers[0].type == "ARMATURE"
        assert all(bone.matrix_basis.is_identity for bone in rig.pose.bones)
        before = state(body, rig)
        for key in ("world", "rest", "pose", "groups"):
            assert before[key] == reference[gender][key], f"Reference {key} differs"
        amounts = transition(body, rig)
        assert amounts == request[gender]["amounts"], (
            "Original transition field changed"
        )
        selected = set(amounts)
        ids = identifiers(body)
        original = quality(body, selected)
        row = {
            "gender": gender,
            "before": original,
            "new_points_preserved": 0,
            "existing_falloff_range": [min(amounts.values()), max(amounts.values())],
            "fractional_transition_points": sum(
                value < 1 for value in amounts.values()
            ),
        }
        report["rows"].append(row)
        if gender == "Male":
            row["confirmed_boundary_amounts"] = {
                str(identifier): amounts.get(ids.index(identifier), 0.0)
                for identifier in (126108, 128261, 126107, 128260)
            }
            assert row["confirmed_boundary_amounts"]["126108"] == 0
        for index, amount in amounts.items():
            identifier = ids[index]
            if identifier < 0:
                row["new_points_preserved"] += 1
                continue
            position, skin = reference[gender]["mapping"][identifier]
            vertex = body.data.vertices[index]
            assert [(g.group, g.weight) for g in vertex.groups] == skin
            vertex.co = (
                position if amount == 1 else vertex.co.lerp(Vector(position), amount)
            )
        body.data.update()
        row["after"] = quality(body, selected)
        row.update(compare(before, state(body, rig), selected))
        for key in ("vertices", "edges", "faces", "nonmanifold", "winding"):
            assert row["after"][key] == original[key], f"Native {key} changed"
        assert row["after"]["tiny_faces"] <= original["tiny_faces"], (
            "Tiny faces increased"
        )
        assert row["after"]["selected_dihedral_above_90"] == 0, (
            "Transition lateral folds remain"
        )
    assert sha(source) == INPUT_SHA and sha(origin) == ORIGIN_SHA
    assert not target.exists(), "Target appeared; refusing overwrite"
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
