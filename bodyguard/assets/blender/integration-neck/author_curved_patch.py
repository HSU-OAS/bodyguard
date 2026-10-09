"""FR-A-02/03/08: explicit native curvature patch on a professional body.

No generated primitive human, source overwrite, clinical target or public asset.
Blender --factory-startup --disable-autoexec -b candidate-unapproved.blend
  --python-exit-code 1 --python author_curved_patch.py
  -- new.blend report.json segment input-sha256
"""

import hashlib
import json
import math
import sys
from bisect import bisect_right
from collections import Counter
from itertools import pairwise
from pathlib import Path
from statistics import median

import bmesh
import bpy
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from artist_snapshot_values import snapshot

HISTORY_ARRAYS = (
    "bodyguard_authoring_a123_original_ids",
    "bodyguard_a146_parent_ids",
    "bodyguard_a195_parent_ids",
)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def region(point, height, limits, side):
    return (
        point.y > 0
        and abs(point.x) / height < 0.1
        and limits[0] < point.z / height < limits[1]
        and (side == 0 or point.x * side > 0)
    )


def boundary(faces):
    return {
        e
        for f in faces
        for e in f.edges
        if sum(other in faces for other in e.link_faces) == 1
    }


def canonical(values):
    values = tuple(values)
    first = values.index(min(values))
    return values[first:] + values[:first]


def geometry(body):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.normal_update()
        return {
            "vertices": len(mesh.verts),
            "faces": len(mesh.faces),
            "nonmanifold": sum(not e.is_manifold for e in mesh.edges),
            "winding": sum(not e.is_contiguous for e in mesh.edges if e.is_manifold),
            "tiny_faces": sum(f.calc_area() < 1e-10 for f in mesh.faces),
        }
    finally:
        mesh.free()


def fixed_state(body, rig):
    state = snapshot(body, rig)
    for key in ("points", "skin", "faces", "point_ledger", "hands"):
        state.pop(key)
    for key in (*HISTORY_ARRAYS, "bodyguard_distal_hand_vertices"):
        state["properties"].pop(key)
    return state


args = sys.argv[sys.argv.index("--") + 1 :]
assert len(args) in (4, 5)
target, output = map(Path, args[:2])
segment, INPUT_SHA = args[2:4]
diagnostic = len(args) == 5
assert not diagnostic or args[4] == "diagnostic"
assert segment in {"occipital", "neck", "shoulder-left", "shoulder-right"}
assert len(INPUT_SHA) == 64 and all(c in "0123456789abcdef" for c in INPUT_SHA)
ORIGIN = f"integration curved original {segment}"
CORNER = f"integration curved corner {segment}"
loaded = Path(bpy.data.filepath)
assert digest(loaded) == INPUT_SHA
assert bpy.app.version_string == "5.1.1"
assert not target.exists() and not output.exists()
assert target.resolve() != loaded.resolve()
report = {
    "input_sha256": INPUT_SHA,
    "blender": bpy.app.version_string,
    "passed": False,
    "appearance_approved": False,
    "clinical_or_camera_work": False,
    "segment": segment,
    "diagnostic_no_save": diagnostic,
    "rows": [],
}
try:
    for gender in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
        before = snapshot(body, rig)
        fixed = fixed_state(body, rig)
        old_geometry = geometry(body)
        points = [v.co.copy() for v in body.data.vertices]
        history = {key: list(body[key]) for key in HISTORY_ARRAYS}
        assert all(len(values) == len(points) for values in history.values())
        assert body.data.shape_keys is None
        assert len(body.modifiers) == 1 and body.modifiers[0].type == "ARMATURE"
        assert all(pb.matrix_basis.is_identity for pb in rig.pose.bones)
        # Preserve the professional mesh as a private native weight-transfer source.
        # It is not saved or published and is removed before the final snapshot.
        skin_source = body.copy()
        skin_source.data = body.data.copy()
        skin_source.name = f"Private native skin source - {gender}"
        bpy.context.scene.collection.objects.link(skin_source)
        skin_source.hide_render = True
        mesh = bmesh.new()
        try:
            mesh.from_mesh(body.data)
            mesh.verts.ensure_lookup_table()
            mesh.faces.ensure_lookup_table()
            mesh.normal_update()
            assert body.data.attributes.get(ORIGIN) is None
            # Create CustomData before retaining element wrappers/boundary refs.
            mesh.verts.layers.int.new(ORIGIN)
            mesh.verts.layers.int.new(CORNER)
            origin = mesh.verts.layers.int[ORIGIN]
            corner_marker = mesh.verts.layers.int[CORNER]
            mesh.verts.index_update()
            for vertex in mesh.verts:
                assert tuple(vertex.co) == before["points"][vertex.index]
                vertex[origin] = vertex.index
            height = max(v.co.z for v in mesh.verts)
            rig_to_body = body.matrix_world.inverted() @ rig.matrix_world
            lower = (rig_to_body @ rig.data.bones["neck01"].head_local).z / height
            upper = (rig_to_body @ rig.data.bones["neck02"].tail_local).z / height
            assert 0.82 < lower < upper < 0.94
            limits, side = {
                "occipital": ((upper, 0.94), 0),
                "neck": ((lower, upper), 0),
                "shoulder-left": ((0.82, lower), -1),
                "shoulder-right": ((0.82, lower), 1),
            }[segment]
            chosen = {
                f
                for f in mesh.faces
                if all(region(v.co, height, limits, side) for v in f.verts)
            }
            # Only shrink the selection at touching boundaries; never enter front.
            pruned = []
            for _ in range(8):
                borders = boundary(chosen)
                incidence = Counter(v for e in borders for v in e.verts)
                bad = {v for v, degree in incidence.items() if degree != 2}
                if not bad:
                    break
                remove = {f for f in chosen if any(v in bad for v in f.verts)}
                assert remove
                pruned.append(len(remove))
                chosen -= remove
            else:
                raise AssertionError("Patch boundary did not become regular")
            assert len(chosen) > 500
            borders = boundary(chosen)
            successor = {}
            for edge in borders:
                face = next(f for f in edge.link_faces if f in chosen)
                loop = next(loop for loop in face.loops if loop.edge == edge)
                assert loop.vert not in successor
                successor[loop.vert] = loop.link_loop_next.vert
            start = min(successor, key=lambda v: v.index)
            ordered = [start]
            next_point = successor[start]
            while next_point != start:
                assert next_point not in ordered, "Multiple/self-touching boundary"
                ordered.append(next_point)
                next_point = successor[next_point]
            assert len(ordered) == len(borders), "Patch has more than one opening"
            protected = {
                v.index
                for v in mesh.verts
                if any(f not in chosen for f in v.link_faces)
            }
            protected |= {v.index for v in ordered}
            assert all(i in protected for i in before["hands"])
            assert all(i in protected for i, p in enumerate(points) if p.y <= 0)
            outside_faces = Counter(
                (canonical(v.index for v in f.verts), f.material_index, f.smooth)
                for f in mesh.faces
                if f not in chosen
            )
            selected_ids = {f.index for f in chosen}
            body.data.calc_loop_triangles()
            triangles = [
                tuple(t.vertices)
                for t in body.data.loop_triangles
                if t.polygon_index in selected_ids
            ]
            tree = BVHTree.FromPolygons(points, triangles, all_triangles=True)
            # Faces-only removal followed by internal-only orphan removal.
            assert all(v.is_valid for v in ordered), (
                "Boundary refs invalid before removal"
            )
            bmesh.ops.delete(mesh, geom=list(chosen), context="FACES_ONLY")
            assert all(v.is_valid for v in ordered), (
                "Boundary lost in face-only removal"
            )
            unused = [
                v for v in mesh.verts if not v.link_faces and v[origin] not in protected
            ]
            bmesh.ops.delete(mesh, geom=unused, context="VERTS")
            assert all(v.is_valid for v in ordered), (
                "Boundary lost in internal vertex removal"
            )
            # Removing only faces can leave chords between retained boundary points.
            bmesh.ops.delete(
                mesh, geom=[e for e in mesh.edges if e.is_wire], context="EDGES_FACES"
            )
            assert all(v.is_valid for v in ordered)
            transition = None
            if len(ordered) % 2:
                # Odd boundaries mathematically require one triangular transition.
                candidates = []
                for i, v in enumerate(ordered):
                    first, last = ordered[i - 1], ordered[(i + 1) % len(ordered)]
                    turn = (v.co - first.co).cross(last.co - v.co)
                    if turn.y > 1e-9 and mesh.edges.get((first, last)) is None:
                        candidates.append((turn.y, i))
                assert candidates, "No convex native triangle transition"
                _, offset = max(candidates)
                triangle = (
                    ordered[offset - 1],
                    ordered[offset],
                    ordered[(offset + 1) % len(ordered)],
                )
                transition = mesh.faces.new(triangle)
                transition.smooth = True
                ordered.pop(offset)
            # Define the corner and column count geometrically, not by vertex ID.
            xmin, xmax = min(v.co.x for v in ordered), max(v.co.x for v in ordered)
            zmin, zmax = min(v.co.z for v in ordered), max(v.co.z for v in ordered)
            assert xmax > xmin and zmax > zmin
            corners = [
                min(
                    ordered,
                    key=lambda v, x=x, z=z: (
                        ((v.co.x - x) / (xmax - xmin)) ** 2
                        + ((v.co.z - z) / (zmax - zmin)) ** 2
                    ),
                )
                for x, z in ((xmin, zmin), (xmin, zmax), (xmax, zmax), (xmax, zmin))
            ]
            assert len(set(corners)) == 4, "Patch does not have four distinct corners"
            corner_offset = ordered.index(corners[0])
            steps = [
                (ordered.index(v) - corner_offset) % len(ordered) for v in corners[1:]
            ]
            corner_ids = [v[origin] for v in corners]
            # A transition ribbon preserves the uneven professional outer boundary.
            # Only its new inner loop is sampled with equal opposite side counts.
            ordered = ordered[corner_offset:] + ordered[:corner_offset]
            cuts = [0, *sorted(steps), len(ordered)]
            intervals = [cuts[i + 1] - cuts[i] for i in range(4)]
            counts = [min(intervals[0], intervals[2]), min(intervals[1], intervals[3])]
            assert min(counts) >= 2
            margin = min(
                0.002,
                2
                * median(
                    (ordered[(i + 1) % len(ordered)].co - v.co).length
                    for i, v in enumerate(ordered)
                ),
            )
            assert 2 * margin < min(xmax - xmin, zmax - zmin)
            inner = []
            for section in range(4):
                path = ordered[cuts[section] : cuts[section + 1]]
                path = [*path, ordered[cuts[section + 1] % len(ordered)]]
                lengths = [0.0]
                for first, last in pairwise(path):
                    lengths.append(lengths[-1] + (last.co - first.co).length)
                count = counts[section % 2]
                for index in range(count):
                    distance = lengths[-1] * index / count
                    edge_index = min(len(path) - 2, bisect_right(lengths, distance) - 1)
                    fraction = (distance - lengths[edge_index]) / (
                        lengths[edge_index + 1] - lengths[edge_index]
                    )
                    point = path[edge_index].co.lerp(path[edge_index + 1].co, fraction)
                    point.x = (xmin + xmax) / 2 + (point.x - (xmin + xmax) / 2) * (
                        1 - 2 * margin / (xmax - xmin)
                    )
                    point.z = (zmin + zmax) / 2 + (point.z - (zmin + zmax) / 2) * (
                        1 - 2 * margin / (zmax - zmin)
                    )
                    surface, _, _, distance = tree.find_nearest(point)
                    assert surface is not None and distance < 0.006
                    vertex = mesh.verts.new(surface)
                    vertex[origin] = -1
                    vertex[corner_marker] = section + 1 if index == 0 else 0
                    inner.append(vertex)
            outer_edges = [
                mesh.edges.get((v, ordered[(i + 1) % len(ordered)]))
                for i, v in enumerate(ordered)
            ]
            assert all(edge is not None for edge in outer_edges)
            inner_edges = [
                mesh.edges.new((v, inner[(i + 1) % len(inner)]))
                for i, v in enumerate(inner)
            ]
            bridge = bmesh.ops.bridge_loops(
                mesh,
                edges=[*outer_edges, *inner_edges],
                use_pairs=True,
                use_cyclic=False,
                use_merge=False,
                twist_offset=0,
            )
            assert bridge["faces"], "Native transition ribbon was not constructed"
            for face in bridge["faces"]:
                face.smooth = True
                face.material_index = 0
            inner_count = len(inner)
            # Native accepts two opposite OPEN loops. The other two sides are
            # already the only remaining boundary paths, avoiding editor span /
            # direction inference without changing any acceptance criterion.
            first_end = counts[0]
            opposite_start = sum(counts)
            opposite_end = opposite_start + counts[0]
            selected_edges = [
                *inner_edges[:first_end],
                *inner_edges[opposite_start:opposite_end],
            ]
            assert len(selected_edges) == 2 * counts[0]
            assert all(edge.is_boundary for edge in selected_edges)
            assert {edge for edge in mesh.edges if edge.is_boundary} == set(inner_edges)
            retained = set(mesh.verts)
            retained_faces = set(mesh.faces)
            report["last_grid"] = {
                "gender": gender,
                "boundary": len(ordered),
                "geometric_corner_ids": corner_ids,
                "original_side_intervals": intervals,
                "inner_side_intervals": [*counts, *counts],
                "inner_boundary_vertices": inner_count,
                "explicit_open_boundary_edges": [counts[0], counts[0]],
            }
            result = bmesh.ops.grid_fill(
                mesh,
                edges=selected_edges,
                mat_nr=0,
                use_smooth=True,
                use_interp_simple=False,
            )
            new_faces = list(result["faces"])
            assert new_faces and set(mesh.faces) - retained_faces == set(new_faces)
            core_points = [vertex for vertex in mesh.verts if vertex not in retained]
            for vertex in core_points:
                vertex[origin] = -1
                vertex[corner_marker] = 0
            corner_faces = Counter(
                v for face in new_faces for v in face.verts if v in retained
            )
            actual_corners = sorted(
                v[corner_marker]
                for v, incidence in corner_faces.items()
                if incidence == 1
            )
            report["last_grid"]["actual_native_corner_tags"] = actual_corners
            assert actual_corners == [1, 2, 3, 4], (
                "Native grid did not follow the four explicit inner corners"
            )
            new_points = [v for v in mesh.verts if v[origin] == -1]
            assert new_points
            distances = []
            for vertex in new_points:
                surface, _, _, distance = tree.find_nearest(vertex.co)
                assert surface is not None
                distances.append(distance)
            bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
            mesh.normal_update()
            report["last_grid"]["geometry_diagnostic"] = {
                "new_points": len(new_points),
                "maximum_source_distance_m": max(distances),
                "points_exceeding_6mm": sum(value >= 0.006 for value in distances),
                "core_faces": len(new_faces),
                "core_rear_facing_faces": sum(
                    face.normal.y > 0.1 for face in new_faces
                ),
                "core_wrong_facing_faces": sum(
                    face.normal.y < -0.1 for face in new_faces
                ),
                "core_tiny_faces": sum(face.calc_area() < 1e-10 for face in new_faces),
                "diagnostic_flushed_to_memory_only": diagnostic,
            }
            if diagnostic:
                # Neutral geometry inspection only. Save remains forbidden even
                # if all later guards unexpectedly pass. No GLB / skin approval.
                mesh.to_mesh(body.data)
            transfer_distance = 0
            for vertex in new_points:
                surface, _, _, distance = tree.find_nearest(vertex.co)
                assert surface is not None
                transfer_distance = max(transfer_distance, distance)
                assert distance < 0.006, (
                    f"Native grid leaves source surface: {distance}m"
                )
                for name in ("a239_source_point_id", "A123 authored parent point"):
                    layer = mesh.verts.layers.int.get(name)
                    if layer is not None:
                        vertex[layer] = -1
            bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
            mesh.verts.index_update()
            new_point_ids = [vertex.index for vertex in new_points]
            mesh.to_mesh(body.data)
        finally:
            mesh.free()
        bpy.ops.object.select_all(action="DESELECT")
        body.select_set(True)
        bpy.context.view_layer.objects.active = body
        mask = body.vertex_groups.new(name="Quad patch native skin mask")
        mask_name = mask.name
        mask.add(new_point_ids, 1, "REPLACE")
        transfer = body.modifiers.new(
            "Professional surface skin transfer", "DATA_TRANSFER"
        )
        transfer.object = skin_source
        transfer.use_vert_data = True
        transfer.data_types_verts = {"VGROUP_WEIGHTS"}
        transfer.vert_mapping = "POLYINTERP_NEAREST"
        transfer.layers_vgroup_select_src = "ALL"
        transfer.layers_vgroup_select_dst = "NAME"
        transfer.mix_mode = "REPLACE"
        transfer.mix_factor = 1
        transfer.vertex_group = mask_name
        transfer.use_max_distance = True
        transfer.max_distance = 0.006
        transfer_name = transfer.name
        body.modifiers.move(len(body.modifiers) - 1, 0)
        assert bpy.ops.object.modifier_apply(modifier=transfer_name) == {"FINISHED"}
        body.vertex_groups.remove(body.vertex_groups[mask_name])
        # Native Data Transfer can add zero-valued memberships even under a
        # zero mask. Do not restore changed influences: verify every positive
        # value exactly first, then remove only newly added literal-zero entries.
        zero_entries_removed = 0
        cleanup = bmesh.new()
        try:
            cleanup.from_mesh(body.data)
            ids_layer = cleanup.verts.layers.int[ORIGIN]
            weights_layer = cleanup.verts.layers.deform.active
            assert weights_layer is not None
            for vertex in cleanup.verts:
                old_id = vertex[ids_layer]
                if old_id < 0:
                    continue
                original = dict(before["skin"][old_id])
                weights = vertex[weights_layer]
                assert {i: w for i, w in weights.items() if w != 0} == {
                    i: w for i, w in original.items() if w != 0
                }, f"Protected influence changed at original point {old_id}"
                for group_id, value in list(weights.items()):
                    if group_id not in original:
                        assert value == 0
                        del weights[group_id]
                        zero_entries_removed += 1
            cleanup.to_mesh(body.data)
        finally:
            cleanup.free()
        private_mesh = skin_source.data
        bpy.data.objects.remove(skin_source, do_unlink=True)
        assert private_mesh.users == 0
        bpy.data.meshes.remove(private_mesh)
        ids = [item.value for item in body.data.attributes[ORIGIN].data]
        remap = {old: new for new, old in enumerate(ids) if old >= 0}
        assert len(remap) == len([i for i in ids if i >= 0])
        assert set(remap) == protected
        current_outside = Counter()
        for face in body.data.polygons:
            values = tuple(ids[i] for i in face.vertices)
            if all(i >= 0 for i in values):
                key = (canonical(values), face.material_index, face.use_smooth)
                if key in outside_faces:
                    current_outside[key] += 1
        assert current_outside == outside_faces, "Original outside polygons changed"
        for vertex in body.data.vertices:
            old_id = ids[vertex.index]
            if old_id >= 0:
                assert tuple(vertex.co) == before["points"][old_id]
                raw = [(g.group, g.weight) for g in vertex.groups]
                if raw != before["skin"][old_id]:
                    report["protected_raw_skin_difference"] = {
                        "gender": gender,
                        "source_point": old_id,
                        "candidate_point": vertex.index,
                        "source": before["skin"][old_id],
                        "candidate": raw,
                        "positive_weights_exact": {
                            i: value for i, value in raw if value != 0
                        }
                        == {
                            i: value
                            for i, value in before["skin"][old_id]
                            if value != 0
                        },
                    }
                    raise AssertionError("Protected raw skin changed")
            assert all(math.isfinite(value) for value in vertex.co)
            assert abs(sum(g.weight for g in vertex.groups) - 1) < 0.01
        body["bodyguard_distal_hand_vertices"] = [remap[i] for i in before["hands"]]
        for key, values in history.items():
            body[key] = [values[i] if i >= 0 else -1 for i in ids]
        assert fixed_state(body, rig) == fixed, "Rest rig/material/scene changed"
        new_geometry = geometry(body)
        report["rows"].append(
            {
                "gender": gender,
                "boundary_vertices": len(ordered),
                "native_explicit_open_boundary_edges": [counts[0], counts[0]],
                "boundary_pruned_faces": pruned,
                "original_patch_faces": len(selected_ids),
                "new_points": len(new_points),
                "odd_boundary_triangle_transition": transition is not None,
                "maximum_surface_binding_distance_m": transfer_distance,
                "surface_design": "explicit opposite open boundaries / native boundary-curvature interpolation / no smoothing or core shrinkwrap",
                "geometric_corner_ids": corner_ids,
                "body_space_z_limits": limits,
                "skin_transfer": "native Data Transfer / POLYINTERP_NEAREST / new-point mask only",
                "new_literal_zero_memberships_removed": zero_entries_removed,
                "outside_coordinates_raw_skin_polygons_exact": True,
                "front_hands_preserved": True,
                "rest_rig_world_material_exact": True,
                "before": old_geometry,
                "after": new_geometry,
            }
        )
        assert new_geometry["nonmanifold"] == new_geometry["winding"] == 0
        assert new_geometry["tiny_faces"] <= old_geometry["tiny_faces"]
    assert not diagnostic, (
        "Diagnostics never save; native authoring criteria unexpectedly passed"
    )
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(target), check_existing=True)
    assert digest(loaded) == INPUT_SHA
    report["output_sha256"] = digest(target)
    report["passed"] = True
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
