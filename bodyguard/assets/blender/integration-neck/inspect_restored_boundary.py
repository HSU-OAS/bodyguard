"""FR-A-02/03/08: trace the one frozen restoration rejection to its boundary.

No new authoring parameters or save. Private native probes and professional
source IDs only; not human/camera data or clinical thresholds.
"""

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

FROZEN = HERE.parents[2] / "docs/review/avatar-neck-integration/lateral-restore"
INPUT_SHA = "be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068"
ORIGIN_SHA = "2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def objects(gender):
    return (
        bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"],
        bpy.data.objects[f"BODYGUARD {gender} rig WIP"],
    )


def cycle(values):
    return min(tuple(values[index:] + values[:index]) for index in range(len(values)))


def inspect_rejection(body, selected, bounds, original_points):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.ensure_lookup_table()
        mesh.faces.index_update()
        mesh.edges.index_update()
        mesh.normal_update()
        ids = [
            value.value for value in body.data.attributes["a239_source_point_id"].data
        ]
        faces = {
            face for face in mesh.faces if all(v.index in selected for v in face.verts)
        }
        edges = {edge for face in faces for edge in face.edges if edge.is_manifold}
        bad = [edge for edge in edges if math.degrees(edge.calc_face_angle()) > 90]
        assert len(bad) == 1, "Frozen remaining edge count differs"
        edge = bad[0]
        neighbours = sorted(edge.link_faces, key=lambda face: face.index)
        rows = []
        for face in neighbours:
            rows.append(
                {
                    "native_face": face.index,
                    "source_point_ids": [ids[v.index] for v in face.verts],
                    "normal": tuple(face.normal),
                    "area_m2": face.calc_area(),
                    "all_points_selected": all(v.index in selected for v in face.verts),
                    "original_anterior_visible": face.index in bounds["anterior"],
                    "points": [
                        {
                            "native_point": vertex.index,
                            "source_point_id": ids[vertex.index],
                            "input_position_asset_m": original_points[vertex.index],
                            "restored_position_asset_m": tuple(vertex.co),
                            "original_selected": vertex.index in selected,
                            "original_front_protected": vertex.index in bounds["front"],
                        }
                        for vertex in face.verts
                    ],
                }
            )
        result = {
            "native_edge": edge.index,
            "source_endpoints": [ids[v.index] for v in edge.verts],
            "restored_dihedral_degrees": math.degrees(edge.calc_face_angle()),
            "faces": rows,
        }
        # Read the same native connection in the original input on this PRIVATE
        # BMesh only. Source body coordinates are never written by this probe.
        for vertex, point in zip(mesh.verts, original_points, strict=True):
            vertex.co = point
        mesh.normal_update()
        result["input_dihedral_degrees"] = math.degrees(edge.calc_face_angle())
        result["input_face_normals"] = [tuple(face.normal) for face in neighbours]
        return result
    finally:
        mesh.free()


def inspect_origin(body, requested):
    ids = [value.value for value in body.data.attributes["a239_source_point_id"].data]
    wanted = {
        identifier for face in requested for identifier in face["source_point_ids"]
    }
    positions = {}
    for identifier in sorted(wanted):
        matches = [i for i, value in enumerate(ids) if value == identifier]
        if identifier < 0:
            positions[identifier] = {"has_original_id": False}
            continue
        assert len(matches) == 1, "Ambiguous/missing original boundary point"
        positions[identifier] = {
            "has_original_id": True,
            "native_point": matches[0],
            "position_asset_m": tuple(body.data.vertices[matches[0]].co),
        }
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.faces.ensure_lookup_table()
        mesh.normal_update()
        rows = []
        for requested_face in requested:
            local = requested_face["source_point_ids"]
            row = {"corresponds_to_input_face": requested_face["native_face"]}
            if any(identifier < 0 for identifier in local):
                row["has_original_face"] = False
                row["reason"] = "New-point face has no original cycle"
                rows.append(row)
                continue
            forward, reverse = cycle(local), cycle(list(reversed(local)))
            matches = [
                polygon.index
                for polygon in body.data.polygons
                if len(polygon.vertices) == len(local)
                and cycle([ids[index] for index in polygon.vertices])
                in (forward, reverse)
            ]
            assert len(matches) <= 1, "Ambiguous original boundary face"
            if not matches:
                row["has_original_face"] = False
                row["reason"] = "No original face with this source cycle"
            else:
                face = mesh.faces[matches[0]]
                row.update(
                    {
                        "has_original_face": True,
                        "native_face": face.index,
                        "source_point_ids": [ids[v.index] for v in face.verts],
                        "same_winding": cycle([ids[v.index] for v in face.verts])
                        == forward,
                        "normal": tuple(face.normal),
                        "area_m2": face.calc_area(),
                    }
                )
            rows.append(row)
        return {"points": positions, "faces": rows}
    finally:
        mesh.free()


proof, origin = (Path(value) for value in sys.argv[sys.argv.index("--") + 1 :])
source = Path(bpy.data.filepath)
assert bpy.app.version_string == "5.1.1"
assert sha(source) == INPUT_SHA and sha(origin) == ORIGIN_SHA
assert proof.is_dir() and not (proof / "boundary.json").exists()
manifest = json.loads((FROZEN / "manifest.json").read_text())
for name in (
    "author_lateral_restore.py",
    "lateral_contract.py",
    "lateral_domain.py",
    "artist_snapshot_values.py",
    "surface_visibility.py",
):
    entry = next(
        row for row in manifest["entries"] if row["file"] == f"executed-{name}.gz"
    )
    assert sha(HERE / name) == entry["raw_sha256"], "Frozen helper changed"
previous = json.loads(gzip.decompress((FROZEN / "author.json.gz").read_bytes()))
body, rig = objects("Male")
female, female_rig = objects("Female")
female_before = state(female, female_rig)
original_points = [tuple(vertex.co) for vertex in body.data.vertices]
bounds = domain(body, rig)
selected = {
    i
    for i in bounds["selected"]
    if weight(body.data.vertices[i], bounds["selected"], bounds) > 0
}
candidate, reproduced = (
    proof / "unexpected-candidate.blend",
    proof / "replayed-author.json",
)
assert not candidate.exists() and not reproduced.exists()
report = {
    "blender": bpy.app.version_string,
    "input_sha256": INPUT_SHA,
    "professional_origin_sha256": ORIGIN_SHA,
    "diagnostic_only": True,
    "new_authoring_parameters": False,
    "appearance_approved": False,
    "clinical_or_camera_data": False,
}
try:
    sys.argv = [
        str(HERE / "author_lateral_restore.py"),
        "--",
        str(origin),
        str(candidate),
        str(reproduced),
    ]
    try:
        runpy.run_path(str(HERE / "author_lateral_restore.py"), run_name="__main__")
    except AssertionError as error:
        assert str(error) == "Restored lateral folds remain", (
            "Unexpected frozen failure"
        )
        report["frozen_failure"] = str(error)
    else:
        raise AssertionError("Expected frozen rejection not reproduced")
    observed = json.loads(reproduced.read_text())
    assert observed["rows"] == previous["rows"]
    assert not candidate.exists()
    report["frozen_rows_exact"] = True
    body, rig = objects("Male")
    female, female_rig = objects("Female")
    assert state(female, female_rig) == female_before
    report["female_body_rig_exact"] = True
    before = state(body, rig)
    report["boundary"] = inspect_rejection(body, selected, bounds, original_points)
    assert state(body, rig) == before, "Private rejection probe changed body"
    del before, female_before
    bpy.ops.wm.open_mainfile(filepath=str(origin), load_ui=False, use_scripts=False)
    body, rig = objects("Male")
    female, female_rig = objects("Female")
    before, female_before = state(body, rig), state(female, female_rig)
    report["origin"] = inspect_origin(body, report["boundary"]["faces"])
    assert state(body, rig) == before and state(female, female_rig) == female_before
    assert sha(source) == INPUT_SHA and sha(origin) == ORIGIN_SHA
    report["two_input_files_unchanged"] = True
    report["read_only_probes_body_rig_exact"] = True
    report["diagnostic_completed"] = True
except Exception as error:
    report["diagnostic_completed"] = False
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    report["candidate_present"] = candidate.exists()
    (proof / "boundary.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
