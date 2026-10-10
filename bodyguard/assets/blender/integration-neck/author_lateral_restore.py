"""FR-A-02/03/08: restore existing professional points in a protected region.

No generated anatomy, smoothing sweep, remesh, raw skin/rig changes or original
file overwrite. Save a new candidate only after both native geometry guards.
"""

import hashlib
import json
import sys
from pathlib import Path

import bpy

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


def selection(body, rig):
    bounds = domain(body, rig)
    return {
        index
        for index in bounds["selected"]
        if weight(body.data.vertices[index], bounds["selected"], bounds) > 0
    }


def identifiers(body):
    ledger = body.data.attributes["a239_source_point_id"]
    assert ledger.data_type == "INT" and ledger.domain == "POINT"
    assert len(ledger.data) == len(body.data.vertices)
    return [value.value for value in ledger.data]


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
            "world": before["world"],
            "rest": before["rest"],
            "pose": before["pose"],
            "groups": before["groups"],
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
report = {
    "blender": bpy.app.version_string,
    "input_sha256": INPUT_SHA,
    "professional_origin_sha256": ORIGIN_SHA,
    "method": "restore_existing_professional_positions_by_unique_source_point_id",
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
        selected = selection(body, rig)
        ids = identifiers(body)
        wanted = {ids[index] for index in selected if ids[index] >= 0}
        assert wanted and len(wanted) == sum(ids[index] >= 0 for index in selected)
        request[gender] = {"selected": selected, "wanted": wanted}
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
        selected = selection(body, rig)
        assert selected == request[gender]["selected"]
        ids = identifiers(body)
        original = quality(body, selected)
        row = {"gender": gender, "before": original, "new_points_preserved": 0}
        report["rows"].append(row)
        for index in selected:
            identifier = ids[index]
            if identifier < 0:
                row["new_points_preserved"] += 1
                continue
            position, skin = reference[gender]["mapping"][identifier]
            vertex = body.data.vertices[index]
            assert [(g.group, g.weight) for g in vertex.groups] == skin
            vertex.co = position
        body.data.update()
        row["after"] = quality(body, selected)
        row.update(compare(before, state(body, rig), selected))
        for key in ("vertices", "edges", "faces", "nonmanifold", "winding"):
            assert row["after"][key] == original[key], f"Native {key} changed"
        assert row["after"]["tiny_faces"] <= original["tiny_faces"], (
            "Tiny faces increased"
        )
        assert row["after"]["selected_dihedral_above_90"] == 0, (
            "Restored lateral folds remain"
        )
    assert sha(source) == INPUT_SHA and sha(origin) == ORIGIN_SHA
    assert not target.exists(), "Target appeared; refusing overwrite"
    bpy.ops.wm.save_as_mainfile(filepath=str(target), check_existing=True)
    report["candidate_sha256"] = sha(target)
    report["two_input_files_unchanged"] = (
        sha(source) == INPUT_SHA and sha(origin) == ORIGIN_SHA
    )
    assert report["two_input_files_unchanged"]
    report["saved_candidate"] = report["passed"] = True
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    report["candidate_present"] = target.exists()
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
