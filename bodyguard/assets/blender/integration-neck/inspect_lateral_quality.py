"""FR-A-02/03/08: read native lateral quality and API, never change/save scene."""

import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from artist_snapshot_values import snapshot
from lateral_domain import domain, weight

EXPECTED = "be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068"


def quality(body, selected):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.index_update()
        mesh.normal_update()
        faces = {f for f in mesh.faces if all(v.index in selected for v in f.verts)}
        edges = {e for f in faces for e in f.edges if e.is_manifold}
        angles = [math.degrees(e.calc_face_angle()) for e in edges]
        return {
            "selected_points": len(selected),
            "interior_faces": len(faces),
            "negative_y_faces": sum(f.normal.y < 0 for f in faces),
            "tiny_faces": sum(f.calc_area() < 1e-10 for f in faces),
            "dihedral_above_90_degrees": sum(a > 90 for a in angles),
            "dihedral_above_120_degrees": sum(a > 120 for a in angles),
            "maximum_native_dihedral_degrees": max(angles, default=0),
            "mean_native_dihedral_degrees": sum(angles) / max(1, len(angles)),
            "whole_mesh_nonmanifold": sum(not e.is_manifold for e in mesh.edges),
            "whole_mesh_winding": sum(
                not e.is_contiguous for e in mesh.edges if e.is_manifold
            ),
            "whole_mesh_tiny_faces": sum(f.calc_area() < 1e-10 for f in mesh.faces),
        }
    finally:
        mesh.free()


source = Path(bpy.data.filepath)
output = Path(sys.argv[sys.argv.index("--") + 1])
assert not output.exists()
assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
assert bpy.app.version_string == "5.1.1"
report = {
    "input_sha256": EXPECTED,
    "blender": bpy.app.version_string,
    "read_only_scene": True,
    "model_authored_or_saved": False,
    "appearance_approved": False,
    "clinical_or_camera_data": False,
    "rows": [],
}
try:
    for gender in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
        before = snapshot(body, rig)
        bounds = domain(body, rig)
        selected = {
            i
            for i in bounds["selected"]
            if weight(body.data.vertices[i], bounds["selected"], bounds) > 0
        }
        row = {
            "gender": gender,
            "source_body_rig_exact": True,
            "anterior_visible_faces": len(bounds["anterior"]),
            "protected_anterior_points": len(bounds["front"]),
            "neck_normalized_z": [bounds["neck_lower"], bounds["neck_upper"]],
            **quality(body, selected),
        }
        report["rows"].append(row)
        assert snapshot(body, rig) == before
    # Read installed native schema without attaching a modifier to any source object.
    schema = bpy.types.LaplacianSmoothModifier.bl_rna.properties
    report["native_laplacian_api"] = {
        name: {"type": schema[name].type, "default": schema[name].default}
        for name in (
            "iterations",
            "lambda_factor",
            "lambda_border",
            "use_volume_preserve",
            "use_normalized",
            "vertex_group",
        )
    }
    assert hashlib.sha256(source.read_bytes()).hexdigest() == EXPECTED
    report["inspection_completed"] = True
except Exception as error:
    report["inspection_completed"] = False
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
