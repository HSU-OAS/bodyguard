"""FR-A-02/08: reproduce frozen rejected state, inspect edges, render failure.

Diagnostic exit0 is not authoring success. No clinical/user data or adoption.
"""

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
from lateral_domain import domain, weight

EXPECTED = "be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068"
proof = Path(sys.argv[sys.argv.index("--") + 1])
source = Path(bpy.data.filepath)
assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
assert not (proof / "diagnostic.json").exists()
body = bpy.data.objects["BODYGUARD Male sculpt WIP"]
rig = bpy.data.objects["BODYGUARD Male rig WIP"]
bounds = domain(body, rig)
weights = {
    i: weight(body.data.vertices[i], bounds["selected"], bounds)
    for i in bounds["selected"]
}
selected = {i for i, value in weights.items() if value > 0}
candidate = proof / "diagnostic-candidate-not-approved.blend"
report = {
    "blender": bpy.app.version_string,
    "input_sha256": EXPECTED,
    "diagnostic_only": True,
    "authoring_passed": False,
    "appearance_approved": False,
    "clinical_or_camera_data": False,
    "remaining_edges": [],
    "rows": [],
}
try:
    sys.argv = [
        str(HERE / "author_lateral_triangles.py"),
        "--",
        "author",
        str(candidate),
        str(proof / "author-diagnostic.json"),
    ]
    try:
        runpy.run_path(str(HERE / "author_lateral_triangles.py"), run_name="__main__")
    except AssertionError as error:
        assert str(error) == "Lateral folded faces remain", "Unexpected failure"
        report["reproduced_rejection"] = str(error)
    else:
        raise AssertionError("Frozen failure no longer reproduced; preserve result")
    assert not candidate.exists(), "Unexpected candidate saved; do not discard it"
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.index_update()
        mesh.edges.index_update()
        mesh.faces.index_update()
        mesh.normal_update()
        faces = {
            face
            for face in mesh.faces
            if all(vertex.index in selected for vertex in face.verts)
        }
        edges = {edge for face in faces for edge in face.edges if edge.is_manifold}
        for edge in edges:
            angle = math.degrees(edge.calc_face_angle())
            if angle <= 90:
                continue
            report["remaining_edges"].append(
                {
                    "edge": edge.index,
                    "angle_degrees": angle,
                    "endpoint_ids": [vertex.index for vertex in edge.verts],
                    "endpoint_original_weights": [
                        weights.get(vertex.index, 0) for vertex in edge.verts
                    ],
                    "faces": [
                        {
                            "face": face.index,
                            "area_m2": face.calc_area(),
                            "all_points_selected": face in faces,
                            "original_anterior_visible": face.index
                            in bounds["anterior"],
                            "protected_original_point_ids": [
                                v.index for v in face.verts if v.index not in selected
                            ],
                        }
                        for face in edge.link_faces
                    ],
                }
            )
        assert len(report["remaining_edges"]) == 4
    finally:
        mesh.free()
    sys.argv = [str(HERE / "render_comparison.py"), "--", str(proof / "failure-render")]
    runpy.run_path(str(HERE / "render_comparison.py"), run_name="__main__")
    report["actual_native_previews"] = 8
    report["male_is_failed_state_female_is_unchanged_input"] = True
    report["diagnostic_completed"] = True
    assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
finally:
    report["candidate_saved_or_present"] = candidate.exists()
    (proof / "diagnostic.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
