"""FR-A-02/03/08: native local retopology of an artist-authored folded join.

Dissolve only actual folded interior vertices, then explicitly triangulate the
affected neighbourhood. No generated anatomy, coordinate movement or rig edit.
"""

import hashlib
import json
import math
import sys
from collections import Counter
from pathlib import Path

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from artist_snapshot_values import snapshot
from lateral_contract import quality
from lateral_domain import domain

source = Path(bpy.data.filepath)
target, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def face_key(vertices):
    ring = tuple(vertices)
    # A cyclic start-corner change is the same oriented face, never a reversal.
    return min(ring[i:] + ring[:i] for i in range(len(ring)))


input_sha = sha(source)
assert input_sha == "be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068"
assert not target.exists() and not output.exists()
assert len({path.resolve() for path in (source, target, output)}) == 3
report = {
    "blender": bpy.app.version_string,
    "method": "native_fold_core_dissolve_local_beauty_triangulation",
    "input_sha256": input_sha,
    "passed": False,
    "appearance_approved": False,
    "rows": [],
}
try:
    for gender in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
        before = snapshot(body, rig)
        bounds = domain(body, rig)
        baseline = quality(body, bounds["selected"])
        mesh = bmesh.new()
        try:
            mesh.from_mesh(body.data)
            mesh.verts.index_update()
            mesh.faces.index_update()
            mesh.normal_update()
            core_edges = {
                e
                for f in mesh.faces
                if all(v.index in bounds["selected"] for v in f.verts)
                for e in f.edges
                if e.is_manifold and math.degrees(e.calc_face_angle()) > 90
            }
            core = {v for e in core_edges for f in e.link_faces for v in f.verts}
            assert core and not {v.index for v in core}.intersection(bounds["front"])
            region = {v for old in core for f in old.link_faces for v in f.verts}
            indices = {v.index for v in region}
            halo = {v.index for old in region for e in old.link_edges for v in e.verts}
            core_indices = {v.index for v in core}
            affected = {f for v in core for f in v.link_faces}
            original_geometry = {face_key(f.vertices) for f in body.data.polygons}
            original_front = Counter(
                (face_key(f.vertices), f.material_index, f.use_smooth)
                for f in body.data.polygons
                if f.index in bounds["anterior"]
            )
            original_faces = {
                tuple(f.vertices): (f.material_index, f.use_smooth)
                for f in body.data.polygons
                if not halo.intersection(f.vertices)
            }
            ledger = mesh.verts.layers.int.new("final_review_original_index")
            for v in mesh.verts:
                v[ledger] = v.index
            # Adding native custom data can invalidate earlier BMesh wrappers.
            current_core = [v for v in mesh.verts if v[ledger] in core_indices]
            assert len(current_core) == len(core_indices) and all(v.is_valid for v in current_core)
            row = {
                "gender": gender,
                "before": baseline,
                "removed_core_points": len(core),
                "affected_region_points": len(region),
                "native_local_halo_points": len(halo),
                "original_core_faces": len(affected),
            }
            report["rows"].append(row)
            bmesh.ops.dissolve_verts(
                mesh, verts=current_core, use_face_split=False, use_boundary_tear=False
            )
            # Dissolve can create a face on the outer rim without an old interior vertex.
            # Identify actual new oriented faces, not arbitrary vertex membership.
            native_created = [
                f
                for f in mesh.faces
                if face_key(v[ledger] for v in f.verts) not in original_geometry
            ]
            assert all(v[ledger] in halo for f in native_created for v in f.verts), (
                "Native edit escaped local halo"
            )
            changed = [f for f in native_created if len(f.verts) > 3]
            row["native_new_faces_before_explicit_split"] = len(native_created)
            bmesh.ops.triangulate(mesh, faces=changed, quad_method="BEAUTY", ngon_method="BEAUTY")
            mesh.verts.index_update()
            mapping = {v[ledger]: v.index for v in mesh.verts}
            assert len(mapping) == len(mesh.verts)
            removed = set(range(len(before["points"]))) - mapping.keys()
            assert removed.issubset(halo), "Native dissolve removed non-local anatomy"
            row["actual_removed_points"] = len(removed)
            mesh.normal_update()
            assert all(e.is_manifold and e.is_contiguous for e in mesh.edges), (
                "Retopology left a hole/winding error"
            )
            mesh.to_mesh(body.data)
            body.data.update()
        finally:
            mesh.free()
        body.data.attributes.remove(body.data.attributes["final_review_original_index"])
        # Native vertex removal changes indices; remap provenance and hand selection.
        for key in (
            "bodyguard_authoring_a123_original_ids",
            "bodyguard_a146_parent_ids",
            "bodyguard_a195_parent_ids",
        ):
            if key in body and len(body[key]) == len(before["points"]):
                values = list(body[key])
                body[key] = [values[i] for i in sorted(mapping, key=mapping.get)]
        body["bodyguard_distal_hand_vertices"] = [mapping[i] for i in before["hands"]]
        after = snapshot(body, rig)
        assert all(
            after[k] == before[k]
            for k in ("rest", "pose", "world", "groups", "materials", "finish", "modifiers")
        )
        assert len(rig.data.bones) == 163 and len(body.vertex_groups) == 139
        for old, new in mapping.items():
            assert before["points"][old] == after["points"][new], "Surviving anatomy moved"
            assert before["skin"][old] == after["skin"][new], "Surviving skin changed"
        assert bounds["front"].issubset(mapping), "Protected front anatomy was removed"
        inverse = {new: old for old, new in mapping.items()}
        touched = {mapping[old] for old in halo if old in mapping}
        actual_front = Counter(
            (face_key(inverse[i] for i in f.vertices), f.material_index, f.use_smooth)
            for f in body.data.polygons
        )
        assert not (original_front - actual_front), "Original front faces changed"
        preserved = {
            tuple(inverse[i] for i in f.vertices): (f.material_index, f.use_smooth)
            for f in body.data.polygons
            if not touched.intersection(f.vertices)
        }
        original_oriented = Counter(
            (face_key(vertices), finish) for vertices, finish in original_faces.items()
        )
        preserved_oriented = Counter(
            (face_key(vertices), finish) for vertices, finish in preserved.items()
        )
        row["unrelated_face_check"] = {
            "exact_start_corner_removed": len(original_faces.keys() - preserved.keys()),
            "exact_start_corner_added": len(preserved.keys() - original_faces.keys()),
            "oriented_geometry_removed": sum((original_oriented - preserved_oriented).values()),
            "oriented_geometry_added": sum((preserved_oriented - original_oriented).values()),
        }
        assert preserved_oriented == original_oriented, "Unrelated oriented faces changed"
        row.update(
            after=quality(body, touched),
            surviving_positions_skin_exact=True,
            protected_front_hands_rig_exact=True,
        )
        assert row["after"]["selected_dihedral_above_90"] == 0, "Retopologized surface is folded"
        assert row["after"]["tiny_faces"] <= baseline["tiny_faces"], "New degenerate face"
        assert (
            abs(
                row["after"]["whole_professional_mesh_volume_m3"]
                - baseline["whole_professional_mesh_volume_m3"]
            )
            < 0.0001
        )
    assert sha(source) == input_sha
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True, check_existing=True)
    report.update(passed=True, candidate_sha256=sha(target))
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    report["source_unchanged"] = sha(source) == input_sha
    report["candidate_present"] = target.exists()
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
