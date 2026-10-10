"""FR-A-02/03/08: compare six native faces, reproduce frozen rejection once.

Only private BMesh probes. No candidate/save, new authoring parameters,
human/camera data, public UI/SDK or original-file changes.
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
from mathutils.geometry import tessellate_polygon

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from lateral_contract import state
from lateral_domain import domain, weight

EXPECTED = "be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068"
OLD = HERE.parents[2] / "docs/review/avatar-neck-integration/lateral-attempt"
FACES = {167049, 167048, 103829, 175905, 171044, 171043}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def observe(body, selected, bounds):
    """Existing asset geometry, not personal body observations."""
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.ensure_lookup_table()
        mesh.faces.ensure_lookup_table()
        mesh.edges.index_update()
        mesh.normal_update()
        ledger = body.data.attributes["a239_source_point_id"]
        rows = []
        for index in sorted(FACES):
            face = mesh.faces[index]
            points = [vertex.co.copy() for vertex in face.verts]
            corners = [
                (current - points[i - 1])
                .cross(points[(i + 1) % len(points)] - points[i - 1])
                .length
                / 2
                for i, current in enumerate(points)
            ]
            triangles = tessellate_polygon([points])
            tessellation = []
            for indices in triangles:
                assert len(indices) == 3 and all(
                    isinstance(index, int) and 0 <= index < len(points)
                    for index in indices
                ), "Unexpected native tessellation indices"
                triangle = [points[index] for index in indices]
                cross = (triangle[1] - triangle[0]).cross(triangle[2] - triangle[0])
                tessellation.append(
                    {
                        "native_point_indices": list(indices),
                        "area_m2": cross.length / 2,
                        "dot_native_polygon_normal": cross.normalized().dot(face.normal)
                        if cross.length > 0
                        else None,
                    }
                )
            rows.append(
                {
                    "face": index,
                    "points": [vertex.index for vertex in face.verts],
                    "source_point_ids": [
                        ledger.data[vertex.index].value for vertex in face.verts
                    ],
                    "point_positions_asset_m": [tuple(point) for point in points],
                    "weights_from_current_positions_in_original_domain": [
                        weight(vertex, bounds["selected"], bounds)
                        for vertex in face.verts
                    ],
                    "all_points_selected": all(
                        vertex.index in selected for vertex in face.verts
                    ),
                    "original_anterior_visible": index in bounds["anterior"],
                    "area_m2": face.calc_area(),
                    "native_normal": tuple(face.normal),
                    "minimum_corner_area_m2": min(corners),
                    "maximum_plane_distance_m": max(
                        abs((point - points[0]).dot(face.normal)) for point in points
                    ),
                    "tessellation": tessellation,
                    "edges": [
                        {
                            "edge": edge.index,
                            "endpoints": [vertex.index for vertex in edge.verts],
                            "length_m": edge.calc_length(),
                            "dihedral_degrees": math.degrees(edge.calc_face_angle())
                            if edge.is_manifold
                            else None,
                            "incident_faces": [
                                other.index for other in edge.link_faces
                            ],
                        }
                        for edge in face.edges
                    ],
                }
            )
        # Probe only native connections of these faces on a private BMesh.
        # Never call to_mesh(body.data) or write source objects/rigs.
        before_points = [tuple(vertex.co) for vertex in mesh.verts]
        before_faces = len(mesh.faces)
        original_faces = [mesh.faces[index] for index in sorted(FACES)]
        operator = bmesh.ops.triangulate(
            mesh, faces=original_faces, quad_method="BEAUTY", ngon_method="BEAUTY"
        )
        mesh.normal_update()
        assert [tuple(vertex.co) for vertex in mesh.verts] == before_points
        touched = operator["faces"]
        edges = {edge for face in touched for edge in face.edges if edge.is_manifold}
        probe = {
            "only_private_bmesh": True,
            "source_body_not_written": True,
            "point_positions_exact": True,
            "source_selected_polygon_sizes": [len(row["points"]) for row in rows],
            "before_face_count": before_faces,
            "after_private_face_count": len(mesh.faces),
            "returned_faces": len(touched),
            "private_returned_edges_above_90": sum(
                math.degrees(edge.calc_face_angle()) > 90 for edge in edges
            ),
        }
        return {"faces": rows, "private_triangulation_probe": probe}
    finally:
        mesh.free()


proof = Path(sys.argv[sys.argv.index("--") + 1])
source = Path(bpy.data.filepath)
assert bpy.app.version_string == "5.1.1" and sha(source) == EXPECTED
assert proof.is_dir() and not (proof / "faces.json").exists()
manifest = json.loads((OLD / "manifest.json").read_text())
for name in (
    "author_lateral_triangles.py",
    "lateral_contract.py",
    "lateral_domain.py",
    "artist_snapshot_values.py",
    "surface_visibility.py",
):
    entry = next(
        item for item in manifest["entries"] if item["file"] == f"executed-{name}.gz"
    )
    assert sha(HERE / name) == entry["raw_sha256"], "Frozen helper changed"
old = json.loads(gzip.decompress((OLD / "diagnostic.json.gz").read_bytes()))
assert {f["face"] for e in old["remaining_edges"] for f in e["faces"]} == FACES
body = bpy.data.objects["BODYGUARD Male sculpt WIP"]
rig = bpy.data.objects["BODYGUARD Male rig WIP"]
female = bpy.data.objects["BODYGUARD Female sculpt WIP"]
female_rig = bpy.data.objects["BODYGUARD Female rig WIP"]
female_before = state(female, female_rig)
bounds = domain(body, rig)
selected = {
    index
    for index in bounds["selected"]
    if weight(body.data.vertices[index], bounds["selected"], bounds) > 0
}
candidate = proof / "unexpected-candidate.blend"
assert not candidate.exists() and not (proof / "reproduced-author.json").exists()
report = {
    "blender": bpy.app.version_string,
    "input_sha256": EXPECTED,
    "diagnostic_only": True,
    "new_authoring_parameters": False,
    "appearance_approved": False,
    "clinical_or_camera_data": False,
    "rows": [],
}
try:
    before = state(body, rig)
    report["original"] = observe(body, selected, bounds)
    assert state(body, rig) == before, "Read-only original probe changed source"
    del before
    sys.argv = [
        str(HERE / "author_lateral_triangles.py"),
        "--",
        "author",
        str(candidate),
        str(proof / "reproduced-author.json"),
    ]
    try:
        runpy.run_path(str(HERE / "author_lateral_triangles.py"), run_name="__main__")
    except AssertionError as error:
        assert str(error) == "Lateral folded faces remain", "Unexpected failure"
        report["frozen_rejection_reproduced"] = str(error)
    else:
        raise AssertionError("Expected frozen rejection not reproduced")
    assert not candidate.exists(), "Unexpected save; preserve and inspect"
    before = state(body, rig)
    report["rejected_state"] = observe(body, selected, bounds)
    assert state(body, rig) == before, "Private probe changed rejected state"
    assert state(female, female_rig) == female_before
    reproduced = json.loads((proof / "reproduced-author.json").read_text())
    previous = json.loads(
        gzip.decompress((OLD / "author-triangles.json.gz").read_bytes())
    )
    assert reproduced["rows"] == previous["rows"], "Frozen failure geometry changed"
    assert report["original"]["faces"] and report["rejected_state"]["faces"]
    assert sha(source) == EXPECTED
    report["source_file_unchanged"] = True
    report["female_body_rig_exact"] = True
    report["private_probes_source_exact"] = True
    report["diagnostic_completed"] = True
except Exception as error:
    report["diagnostic_completed"] = False
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    report["candidate_saved_or_present"] = candidate.exists()
    (proof / "faces.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
