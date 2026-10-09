"""FR-A-02/03/08: bounded native topology repair of the existing artist mesh.

This is an unapproved candidate, not human generation or clinical calibration.
Blender --factory-startup --disable-autoexec -b candidate-unapproved.blend
  --python-exit-code 1 --python repair_topology.py -- new.blend report.json
"""

import hashlib
import json
import math
import sys
from collections import Counter
from pathlib import Path

import bmesh
import bpy
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from artist_snapshot_values import snapshot

INPUT_SHA = "ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b"
LEDGER = "integration original vertex"
FACE_LEDGER = "integration original face"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def selected(point, height):
    x, y, z = point / height
    return y > 0 and abs(x) < 0.10 and 0.82 < z < 0.94


def metrics(body):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.normal_update()
        height = max(v.co.z for v in mesh.verts)
        local = [e for e in mesh.edges if all(selected(v.co, height) for v in e.verts)]
        return {
            "vertices": len(mesh.verts),
            "faces": len(mesh.faces),
            "nonmanifold": sum(not e.is_manifold for e in mesh.edges),
            "winding": sum(not e.is_contiguous for e in mesh.edges if e.is_manifold),
            "posterior_edges_over_120_degrees": sum(
                e.calc_face_angle(0) > math.radians(120) for e in local
            ),
            "tiny_faces": sum(f.calc_area() < 1e-10 for f in mesh.faces),
        }
    finally:
        mesh.free()


def fixed_state(body, rig):
    result = snapshot(body, rig)
    for name in ("points", "skin", "faces", "point_ledger", "hands"):
        result.pop(name)
    result["properties"].pop("bodyguard_distal_hand_vertices")
    return result


def protected_faces(body, protected, ids, original_faces=None):
    """Compare polygon topology/material/shading independent of new numbering."""
    result = Counter()
    for face in body.data.polygons:
        if original_faces is not None and (
            body.data.attributes[FACE_LEDGER].data[face.index].value
            not in original_faces
        ):
            continue
        values = tuple(ids[i] for i in face.vertices)
        if all(i in protected for i in values):
            start = values.index(min(values))
            ring = values[start:] + values[:start]
            result[(ring, face.material_index, face.use_smooth)] += 1
    return result


args = sys.argv[sys.argv.index("--") + 1 :]
assert len(args) == 2
target, report_path = map(Path, args)
loaded = Path(bpy.data.filepath)
assert digest(loaded) == INPUT_SHA
assert not target.exists() and not report_path.exists()
assert target.resolve() != loaded.resolve()
report = {
    "blender": bpy.app.version_string,
    "input_sha256": INPUT_SHA,
    "passed": False,
    "appearance_approved": False,
    "clinical_or_camera_work": False,
    "rows": [],
}
try:
    for gender in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
        assert body.data.shape_keys is None
        assert len(body.modifiers) == 1 and body.modifiers[0].type == "ARMATURE"
        before = snapshot(body, rig)
        fixed = fixed_state(body, rig)
        old_geometry = metrics(body)
        points = [v.co.copy() for v in body.data.vertices]
        height = max(p.z for p in points)
        editable = {i for i, p in enumerate(points) if selected(p, height)}
        protected = set(range(len(points))) - editable
        original_ids = list(range(len(points)))
        old_faces = protected_faces(body, protected, original_ids)
        protected_face_ids = {
            p.index
            for p in body.data.polygons
            if all(i in protected for i in p.vertices)
        }
        protected_edges = {
            tuple(sorted(e.vertices))
            for e in body.data.edges
            if all(i in protected for i in e.vertices)
        }
        old_surface = BVHTree.FromPolygons(
            points, [tuple(p.vertices) for p in body.data.polygons]
        )
        assert body.data.attributes.get(LEDGER) is None
        ledger = body.data.attributes.new(LEDGER, "INT", "POINT")
        ledger.data.foreach_set("value", original_ids)
        assert body.data.attributes.get(FACE_LEDGER) is None
        faces = body.data.attributes.new(FACE_LEDGER, "INT", "FACE")
        faces.data.foreach_set("value", list(range(len(body.data.polygons))))
        local_triangles = sum(
            len(p.vertices) - 2
            for p in body.data.polygons
            if all(i in editable for i in p.vertices)
        )
        total_triangles = sum(len(p.vertices) - 2 for p in body.data.polygons)
        ratio = 1 - 0.30 * local_triangles / total_triangles
        bpy.ops.object.select_all(action="DESELECT")
        body.select_set(True)
        bpy.context.view_layer.objects.active = body
        group = body.vertex_groups.new(name="Integration topology repair mask")
        group_name = group.name
        group.add(sorted(editable), 1, "REPLACE")
        modifier = body.modifiers.new("Posterior native collapse repair", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.vertex_group = group.name
        modifier.vertex_group_factor = 1
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = False
        bpy.ops.object.modifier_move_up(modifier=modifier.name)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        # Native INT custom data is interpolated at a collapse, not a lineage ID.
        # Only the zero-mask points retain an exact original index. Do not invent
        # an origin for a reconstructed point by rounding an interpolated number.
        repair_group = body.vertex_groups[group_name].index
        ids = [v.value for v in body.data.attributes[LEDGER].data]
        interpolated_duplicates = len(ids) - len(set(ids))
        for v in body.data.vertices:
            if any(g.group == repair_group and g.weight > 0 for g in v.groups):
                ids[v.index] = -1
        body.data.attributes[LEDGER].data.foreach_set("value", ids)
        # Native collapse can leave triangulation on untouched concave quads.
        # Restore only its new protected diagonals, never an original edge.
        mesh = bmesh.new()
        try:
            mesh.from_mesh(body.data)
            origin = mesh.verts.layers.int[LEDGER]
            face_origin = mesh.faces.layers.int[FACE_LEDGER]
            diagonals = [
                e
                for e in mesh.edges
                if e.is_manifold
                and all(v[origin] >= 0 for f in e.link_faces for v in f.verts)
                and all(f[face_origin] in protected_face_ids for f in e.link_faces)
                and tuple(sorted(v[origin] for v in e.verts)) not in protected_edges
            ]
            restored_diagonals = len(diagonals)
            bmesh.ops.dissolve_edges(mesh, edges=diagonals, use_verts=False)
            # Restore the original protected polygon set, not a looser tolerance:
            # delete only native-added faces whose every point is protected.
            fins = []
            for face in mesh.faces:
                if face[face_origin] not in protected_face_ids:
                    continue
                values = tuple(v[origin] for v in face.verts)
                if any(i < 0 for i in values):
                    continue
                start = values.index(min(values))
                ring = values[start:] + values[:start]
                key = (ring, face.material_index, face.smooth)
                if key not in old_faces:
                    fins.append(face)
            removed_new_fins = len(fins)
            bmesh.ops.delete(mesh, geom=fins, context="FACES_ONLY")
            new_wire_edges = [
                e
                for e in mesh.edges
                if e.is_wire
                and all(v[origin] >= 0 for v in e.verts)
                and tuple(sorted(v[origin] for v in e.verts)) not in protected_edges
            ]
            bmesh.ops.delete(mesh, geom=new_wire_edges, context="EDGES")
            # Exact existing exporter fin condition, constrained to repair points.
            # Two boundary sides + a three-face side are a native collapse fin,
            # not an anatomical surface. A hole still fails the closed-body guard.
            local_fins = [
                f
                for f in mesh.faces
                if len(f.verts) == 3
                and all(v[origin] == -1 for v in f.verts)
                and sum(e.is_boundary for e in f.edges) == 2
                and any(len(e.link_faces) == 3 for e in f.edges)
                and f.calc_area() < 0.000001
            ]
            removed_local_fins = len(local_fins)
            bmesh.ops.delete(mesh, geom=local_fins, context="FACES")
            unused = [v for v in mesh.verts if v[origin] == -1 and not v.link_faces]
            bmesh.ops.delete(mesh, geom=unused, context="VERTS")
            bmesh.ops.dissolve_degenerate(
                mesh,
                edges=[e for e in mesh.edges if all(v[origin] == -1 for v in e.verts)],
                dist=0.000001,
            )
            mesh.to_mesh(body.data)
        finally:
            mesh.free()
        ids = [v.value for v in body.data.attributes[LEDGER].data]
        exact_ids = [i for i in ids if i >= 0]
        assert len(set(exact_ids)) == len(exact_ids)
        assert set(exact_ids) == protected, "Protected origin ledger changed"
        remap = {old: new for new, old in enumerate(ids) if old >= 0}
        body.data.attributes[LEDGER].data.foreach_set("value", ids)
        body.vertex_groups.remove(body.vertex_groups[group_name])
        assert protected <= remap.keys(), "Protected anatomy was deleted"
        maximum = 0
        skin_error = 0
        for v, old_id in zip(body.data.vertices, ids, strict=True):
            assert all(math.isfinite(c) for c in v.co)
            skin = [(g.group, g.weight) for g in v.groups]
            if old_id >= 0:
                assert tuple(v.co) == before["points"][old_id]
                assert skin == before["skin"][old_id]
            else:
                distance = old_surface.find_nearest(v.co)[3]
                assert distance is not None and math.isfinite(distance)
                maximum = max(maximum, distance)
            skin_error = max(skin_error, abs(sum(w for _, w in skin) - 1))
        assert maximum < 0.006
        assert skin_error < 0.01
        new_faces = protected_faces(body, protected, ids, protected_face_ids)
        if new_faces != old_faces:
            report["protected_polygon_difference"] = {
                "missing": sum((old_faces - new_faces).values()),
                "added": sum((new_faces - old_faces).values()),
                "first_missing": [str(k) for k in list(old_faces - new_faces)[:3]],
                "first_added": [str(k) for k in list(new_faces - old_faces)[:3]],
            }
        assert new_faces == old_faces, "Protected polygon connectivity changed"
        body["bodyguard_distal_hand_vertices"] = [remap[i] for i in before["hands"]]
        assert fixed_state(body, rig) == fixed, "Rest rig/material/properties changed"
        new_geometry = metrics(body)
        row = {
            "gender": gender,
            "selected_vertices": len(editable),
            "decimate_ratio": ratio,
            "before": old_geometry,
            "after": new_geometry,
            "maximum_local_surface_distance_m": maximum,
            "maximum_skin_sum_error": skin_error,
            "protected_coordinates_skin_polygon_topology_exact": True,
            "rest_rig_PBR_other_properties_exact": True,
            "hand_vertices_preserved_and_indices_remapped": len(before["hands"]),
            "native_interpolated_integer_collisions_not_used_as_ids": interpolated_duplicates,
            "reconstructed_vertex_origin_marked_unknown": ids.count(-1),
            "native_added_protected_diagonals_removed": restored_diagonals,
            "native_new_protected_faces_removed": removed_new_fins,
            "native_repair_region_fins_removed": removed_local_fins,
            "protected_polygon_comparison_uses_original_face_provenance": True,
        }
        report["rows"].append(row)
        assert new_geometry["vertices"] < old_geometry["vertices"]
        assert new_geometry["nonmanifold"] == new_geometry["winding"] == 0
        assert new_geometry["tiny_faces"] <= old_geometry["tiny_faces"]
        assert (
            new_geometry["posterior_edges_over_120_degrees"]
            < old_geometry["posterior_edges_over_120_degrees"]
        ), "Fold repair did not reduce the diagnosed defect"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(target), check_existing=True)
    assert digest(loaded) == INPUT_SHA
    report["output_sha256"] = digest(target)
    report["passed"] = True
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
