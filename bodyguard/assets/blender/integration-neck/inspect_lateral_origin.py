"""FR-A-02/03/08: trace local points/faces to the professional native original.

Read-only asset inspection, not human measurements or new authoring. Never save
or write mesh data. The frozen failure replay is not executed here.
"""

import gzip
import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from lateral_contract import state

INPUT_SHA = "be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068"
ORIGIN_SHA = "2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff"
FROZEN = HERE.parents[2] / "docs/review/avatar-neck-integration/lateral-faces"
FACES = (103829, 167048, 167049, 171043, 171044, 175905)
IDS = (120132, 124414, 124415, 124416, 128614, 129289, 131214, 131215, 131216)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cycle(values):
    return min(tuple(values[i:] + values[:i]) for i in range(len(values)))


def observe(body, requested):
    """Capture native base mesh, preserving winding separately from rotation."""
    ledger = body.data.attributes["a239_source_point_id"]
    assert ledger.data_type == "INT" and ledger.domain == "POINT"
    assert len(ledger.data) == len(body.data.vertices)
    ids = [item.value for item in ledger.data]
    mapping = {}
    for identifier in IDS:
        matches = [i for i, value in enumerate(ids) if value == identifier]
        assert len(matches) == 1, f"Ambiguous/missing original ID: {identifier}"
        mapping[identifier] = matches[0]
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.ensure_lookup_table()
        mesh.faces.ensure_lookup_table()
        mesh.edges.index_update()
        mesh.normal_update()
        rows = []
        for expected in requested:
            wanted = cycle(expected["source_point_ids"])
            reverse = cycle(list(reversed(expected["source_point_ids"])))
            matches = []
            for polygon in body.data.polygons:
                local = [ids[index] for index in polygon.vertices]
                if len(local) == len(wanted) and cycle(local) in (wanted, reverse):
                    matches.append(polygon.index)
            assert len(matches) == 1, f"Missing/ambiguous native face: {wanted}"
            face = mesh.faces[matches[0]]
            points = [vertex.co.copy() for vertex in face.verts]
            local = [ids[vertex.index] for vertex in face.verts]
            rows.append(
                {
                    "corresponds_to_input_face": expected["face"],
                    "native_face": face.index,
                    "source_point_ids": local,
                    "same_winding": cycle(local) == wanted,
                    "native_normal": tuple(face.normal),
                    "area_m2": face.calc_area(),
                    "maximum_plane_distance_m": max(
                        abs((point - points[0]).dot(face.normal)) for point in points
                    ),
                    "edges": [
                        {
                            "source_endpoints": sorted(
                                ids[v.index] for v in edge.verts
                            ),
                            "dihedral_degrees": math.degrees(edge.calc_face_angle())
                            if edge.is_manifold
                            else None,
                            "incident_face_source_ids": [
                                [ids[v.index] for v in other.verts]
                                for other in edge.link_faces
                            ],
                        }
                        for edge in face.edges
                    ],
                }
            )
        vertices = []
        for identifier, index in mapping.items():
            vertex = body.data.vertices[index]
            native = mesh.verts[index]
            vertices.append(
                {
                    "source_point_id": identifier,
                    "native_point": index,
                    "position_asset_m": tuple(vertex.co),
                    "position_world_m": tuple(body.matrix_world @ vertex.co),
                    "raw_skin": [(g.group, g.weight) for g in vertex.groups],
                    "one_ring_source_ids": sorted(
                        ids[edge.other_vert(native).index] for edge in native.link_edges
                    ),
                }
            )
        return {
            "vertices": vertices,
            "faces": rows,
            "point_count": len(body.data.vertices),
            "face_count": len(body.data.polygons),
            "world": [tuple(row) for row in body.matrix_world],
            "group_names": [group.name for group in body.vertex_groups],
        }
    finally:
        mesh.free()


def inspect(requested):
    body = bpy.data.objects["BODYGUARD Male sculpt WIP"]
    rig = bpy.data.objects["BODYGUARD Male rig WIP"]
    female = bpy.data.objects["BODYGUARD Female sculpt WIP"]
    female_rig = bpy.data.objects["BODYGUARD Female rig WIP"]
    first, second = state(body, rig), state(female, female_rig)
    result = observe(body, requested)
    assert state(body, rig) == first and state(female, female_rig) == second
    result["read_only_male_female_body_rig_exact"] = True
    return result


proof, origin = (Path(value) for value in sys.argv[sys.argv.index("--") + 1 :])
source = Path(bpy.data.filepath)
assert bpy.app.version_string == "5.1.1"
assert proof.is_dir() and not (proof / "origin.json").exists()
assert sha(source) == INPUT_SHA and sha(origin) == ORIGIN_SHA
manifest = json.loads((FROZEN / "manifest.json").read_text())
entry = next(
    item for item in manifest["entries"] if item["file"] == "native/faces.json.gz"
)
assert sha(FROZEN / entry["file"]) == entry["sha256"]
frozen = json.loads(gzip.decompress((FROZEN / entry["file"]).read_bytes()))
requested = frozen["original"]["faces"]
assert tuple(row["face"] for row in requested) == FACES
assert sorted(
    {value for row in requested for value in row["source_point_ids"]}
) == list(IDS)
report = {
    "blender": bpy.app.version_string,
    "input_sha256": INPUT_SHA,
    "professional_origin_sha256": ORIGIN_SHA,
    "diagnostic_only": True,
    "clinical_or_camera_data": False,
    "new_candidate_or_render_or_glb": False,
    "appearance_approved": False,
}
try:
    report["input"] = inspect(requested)
    bpy.ops.wm.open_mainfile(filepath=str(origin), load_ui=False, use_scripts=False)
    report["origin"] = inspect(requested)
    assert report["input"]["group_names"] == report["origin"]["group_names"]
    assert report["input"]["world"] == report["origin"]["world"]
    comparisons = []
    for before, after in zip(
        report["origin"]["vertices"], report["input"]["vertices"], strict=True
    ):
        assert before["source_point_id"] == after["source_point_id"]
        comparisons.append(
            {
                "source_point_id": before["source_point_id"],
                "position_asset_exact": before["position_asset_m"]
                == after["position_asset_m"],
                "position_world_exact": before["position_world_m"]
                == after["position_world_m"],
                "displacement_m": math.dist(
                    before["position_asset_m"], after["position_asset_m"]
                ),
                "raw_skin_exact": before["raw_skin"] == after["raw_skin"],
                "one_ring_source_ids_exact": before["one_ring_source_ids"]
                == after["one_ring_source_ids"],
            }
        )
    report["point_comparison"] = comparisons
    report["two_input_files_unchanged"] = (
        sha(source) == INPUT_SHA and sha(origin) == ORIGIN_SHA
    )
    assert report["two_input_files_unchanged"]
    report["diagnostic_completed"] = True
except Exception as error:
    report["diagnostic_completed"] = False
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    (proof / "origin.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
