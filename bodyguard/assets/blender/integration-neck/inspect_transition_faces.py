"""FR-A-02/03/08: trace frozen failed transition; no new authoring or save."""

import gzip
import hashlib
import json
import math
import runpy
import sys
from pathlib import Path

import bmesh
import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from lateral_contract import state
from lateral_domain import domain, weight


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def objects(gender):
    return (
        bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"],
        bpy.data.objects[f"BODYGUARD {gender} rig WIP"],
    )


def folded(mesh, chosen, ids, amounts, protected):
    faces = {face for face in mesh.faces if all(v.index in chosen for v in face.verts)}
    edges = {e for face in faces for e in face.edges if e.is_manifold}
    bad = sorted(
        (e for e in edges if math.degrees(e.calc_face_angle()) > 90),
        key=lambda e: e.index,
    )
    return [
        {
            "native_edge": edge.index,
            "degrees": math.degrees(edge.calc_face_angle()),
            "faces": [
                {
                    "native_face": face.index,
                    "normal": tuple(face.normal),
                    "source_point_ids": [ids[v.index] for v in face.verts],
                    "points": [
                        {
                            "native_point": v.index,
                            "source_point_id": ids[v.index],
                            "position_asset_m": tuple(v.co),
                            "original_selected": v.index in chosen,
                            "original_front_protected": v.index in protected,
                            "existing_transition_amount": amounts.get(v.index, 0),
                        }
                        for v in face.verts
                    ],
                }
                for face in sorted(edge.link_faces, key=lambda f: f.index)
            ],
        }
        for edge in bad
    ]


proof, origin = map(Path, sys.argv[sys.argv.index("--") + 1 :])
source = Path(bpy.data.filepath)
frozen = HERE.parents[2] / "docs/review/avatar-neck-integration/lateral-transition"
expected = json.loads(gzip.decompress((frozen / "author.json.gz").read_bytes()))
manifest = json.loads((frozen / "manifest.json").read_text())
for name in (
    "author_lateral_transition.py",
    "lateral_contract.py",
    "lateral_domain.py",
    "artist_snapshot_values.py",
    "surface_visibility.py",
):
    entry = next(
        row for row in manifest["entries"] if row["file"] == f"executed-{name}.gz"
    )
    assert sha(HERE / name) == entry["raw_sha256"], "Frozen helper changed"
assert bpy.app.version_string == "5.1.1"
assert (
    sha(source) == expected["input_sha256"]
    and sha(origin) == expected["professional_origin_sha256"]
)
assert not (proof / "diagnostic.json").exists()
body, rig = objects("Male")
female, female_rig = objects("Female")
female_before = state(female, female_rig)
points = [tuple(v.co) for v in body.data.vertices]
bounds = domain(body, rig)
amounts = {
    i: weight(body.data.vertices[i], bounds["selected"], bounds)
    for i in bounds["selected"]
}
chosen = {i for i, amount in amounts.items() if amount > 0}
ids = [item.value for item in body.data.attributes["a239_source_point_id"].data]
report = {
    "blender": bpy.app.version_string,
    "diagnostic_only": True,
    "new_authoring_parameters": False,
    "appearance_approved": False,
    "clinical_or_camera_work": False,
    "completed": False,
}
candidate = proof / "unexpected-candidate.blend"
assert not candidate.exists() and not (proof / "replayed-author.json").exists()
try:
    sys.argv = [
        str(HERE / "author_lateral_transition.py"),
        "--",
        str(origin),
        str(candidate),
        str(proof / "replayed-author.json"),
    ]
    try:
        runpy.run_path(str(HERE / "author_lateral_transition.py"), run_name="__main__")
    except AssertionError as error:
        assert str(error) == "Transition lateral folds remain"
    else:
        raise AssertionError("Expected frozen transition failure not reproduced")
    assert (
        json.loads((proof / "replayed-author.json").read_text())["rows"]
        == expected["rows"]
    )
    assert not candidate.exists()
    body, rig = objects("Male")
    female, female_rig = objects("Female")
    assert state(female, female_rig) == female_before
    before = state(body, rig)
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.ensure_lookup_table()
        mesh.faces.index_update()
        mesh.edges.index_update()
        mesh.normal_update()
        report["transition_folds"] = folded(mesh, chosen, ids, amounts, bounds["front"])
        assert len(report["transition_folds"]) == 3
        for v, point in zip(mesh.verts, points, strict=True):
            v.co = point
        mesh.normal_update()
        report["input_folds"] = folded(mesh, chosen, ids, amounts, bounds["front"])
        assert len(report["input_folds"]) == 14
    finally:
        mesh.free()
    assert state(body, rig) == before, "Private probe changed rejected body"
    core = {
        p["native_point"]: p
        for e in report["input_folds"]
        for f in e["faces"]
        for p in f["points"]
    }
    report["input_fold_core_summary"] = {
        "unique_points": len(core),
        "outside_selection_points": [
            p["source_point_id"] for p in core.values() if not p["original_selected"]
        ],
        "front_protected_points": [
            p["source_point_id"] for p in core.values() if p["original_front_protected"]
        ],
        "new_source_native_points": [
            p["native_point"] for p in core.values() if p["source_point_id"] < 0
        ],
    }
    wanted = {p["source_point_id"] for p in core.values()} | {
        p["source_point_id"]
        for e in report["transition_folds"]
        for f in e["faces"]
        for p in f["points"]
    }
    bpy.ops.wm.open_mainfile(filepath=str(origin), load_ui=False, use_scripts=False)
    body, rig = objects("Male")
    before = state(body, rig)
    mapping = {}
    for i, item in enumerate(body.data.attributes["a239_source_point_id"].data):
        if item.value in wanted and item.value >= 0:
            assert item.value not in mapping, "Ambiguous original ID"
            mapping[item.value] = tuple(body.data.vertices[i].co)
    assert set(mapping) == {i for i in wanted if i >= 0}, "Missing original point"
    report["original_professional_positions_asset_m"] = mapping
    assert state(body, rig) == before
    assert (
        sha(source) == expected["input_sha256"]
        and sha(origin) == expected["professional_origin_sha256"]
    )
    report.update(
        {
            "frozen_rows_exact": True,
            "female_body_rig_exact": True,
            "private_probe_body_rig_exact": True,
            "two_input_files_unchanged": True,
            "completed": True,
        }
    )
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    report["candidate_present"] = candidate.exists()
    with (proof / "diagnostic.json").open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
