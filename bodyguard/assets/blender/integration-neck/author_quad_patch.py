"""FR-A-02/03/08: native local quad surface on the existing professional body.

No generated primitive human, source overwrite, clinical target or public asset.
Blender --factory-startup --disable-autoexec -b candidate-unapproved.blend
  --python-exit-code 1 --python author_quad_patch.py -- new.blend report.json
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
ORIGIN = "integration quad original point"
HISTORY_ARRAYS = (
    "bodyguard_authoring_a123_original_ids",
    "bodyguard_a146_parent_ids",
    "bodyguard_a195_parent_ids",
)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def region(point, height):
    return (
        point.y > 0 and abs(point.x) / height < 0.1 and 0.82 < point.z / height < 0.94
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
assert len(args) == 2
target, output = map(Path, args)
loaded = Path(bpy.data.filepath)
assert digest(loaded) == INPUT_SHA
assert not target.exists() and not output.exists()
assert target.resolve() != loaded.resolve()
report = {
    "input_sha256": INPUT_SHA,
    "blender": bpy.app.version_string,
    "passed": False,
    "appearance_approved": False,
    "clinical_or_camera_work": False,
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
            origin = mesh.verts.layers.int.new(ORIGIN)
            mesh.verts.index_update()
            for vertex in mesh.verts:
                assert tuple(vertex.co) == before["points"][vertex.index]
                vertex[origin] = vertex.index
            height = max(v.co.z for v in mesh.verts)
            chosen = {
                f for f in mesh.faces if all(region(v.co, height) for v in f.verts)
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
            assert len(chosen) > 10_000
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
            # A whole-body nearest target can jump from a rear patch to adjacent
            # front/shoulder surfaces. Fit only to the original selected polygons.
            fit_source = skin_source.copy()
            fit_source.data = skin_source.data.copy()
            fit_source.name = f"Private rear surface source - {gender}"
            bpy.context.scene.collection.objects.link(fit_source)
            fit_mesh = bmesh.new()
            try:
                fit_mesh.from_mesh(fit_source.data)
                fit_mesh.faces.ensure_lookup_table()
                bmesh.ops.delete(
                    fit_mesh,
                    geom=[f for f in fit_mesh.faces if f.index not in selected_ids],
                    context="FACES_ONLY",
                )
                fit_mesh.to_mesh(fit_source.data)
            finally:
                fit_mesh.free()
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
            mesh.to_mesh(body.data)
        finally:
            mesh.free()
        bpy.ops.object.select_all(action="DESELECT")
        body.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.mode_set(mode="EDIT")
        edit = bmesh.from_edit_mesh(body.data)
        for vertex in edit.verts:
            vertex.select = False
        for face in edit.faces:
            face.select = False
        for edge in edit.edges:
            edge.select_set(edge.is_boundary)
        retained = set(edit.verts)
        bmesh.update_edit_mesh(body.data)
        grid_span = max(2, len(ordered) // 4)
        report["last_grid"] = {
            "gender": gender,
            "span": grid_span,
            "boundary": len(ordered),
        }
        result = bpy.ops.mesh.fill_grid(
            span=grid_span, offset=0, use_interp_simple=False
        )
        assert result == {"FINISHED"}, "Native Grid Fill did not construct a surface"
        new_points = [v for v in edit.verts if v not in retained]
        origin = edit.verts.layers.int[ORIGIN]
        assert new_points
        for vertex in new_points:
            vertex[origin] = -1
            surface, _, _, _ = tree.find_nearest(vertex.co)
            assert surface is not None
            vertex.co = surface
        # Fair the new regular edge field once, not the original folded triangles.
        for _ in range(12):
            bmesh.ops.smooth_vert(
                edit,
                verts=new_points,
                factor=0.5,
                use_axis_x=True,
                use_axis_y=True,
                use_axis_z=True,
            )
        prebinding_distance = 0
        for vertex in new_points:
            surface, _, _, distance = tree.find_nearest(vertex.co)
            assert surface is not None
            prebinding_distance = max(prebinding_distance, distance)
            for name in ("a239_source_point_id", "A123 authored parent point"):
                layer = edit.verts.layers.int.get(name)
                if layer is not None:
                    vertex[layer] = -1
        bmesh.ops.recalc_face_normals(edit, faces=list(edit.faces))
        edit.verts.index_update()
        new_point_ids = [vertex.index for vertex in new_points]
        bmesh.update_edit_mesh(body.data)
        bpy.ops.object.mode_set(mode="OBJECT")
        mask = body.vertex_groups.new(name="Quad patch native skin mask")
        mask_name = mask.name
        mask.add(new_point_ids, 1, "REPLACE")
        # Retopology is fitted to the preserved professional surface. Fairing alone
        # is not a candidate: the earlier unbound 6mm failure remains evidence.
        conform = body.modifiers.new("Professional surface fit", "SHRINKWRAP")
        conform.target = fit_source
        conform.wrap_method = "NEAREST_SURFACEPOINT"
        conform.wrap_mode = "ON_SURFACE"
        conform.offset = 0
        conform.vertex_group = mask_name
        conform_name = conform.name
        body.modifiers.move(len(body.modifiers) - 1, 0)
        assert bpy.ops.object.modifier_apply(modifier=conform_name) == {"FINISHED"}
        transfer_distance = 0
        for point_id in new_point_ids:
            assert body.data.attributes[ORIGIN].data[point_id].value == -1
            surface, _, _, distance = tree.find_nearest(body.data.vertices[point_id].co)
            assert surface is not None
            transfer_distance = max(transfer_distance, distance)
            assert distance < 0.006, (
                f"Fitted point {point_id} outside patch: {distance}m"
            )
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
        private_fit_mesh = fit_source.data
        bpy.data.objects.remove(fit_source, do_unlink=True)
        assert private_fit_mesh.users == 0
        bpy.data.meshes.remove(private_fit_mesh)
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
                "native_grid_span": grid_span,
                "boundary_pruned_faces": pruned,
                "original_patch_faces": len(selected_ids),
                "new_points": len(new_points),
                "odd_boundary_triangle_transition": transition is not None,
                "maximum_surface_binding_distance_m": transfer_distance,
                "maximum_unbound_fairing_distance_m": prebinding_distance,
                "surface_fit": "native Shrinkwrap / preserved professional surface / new-point mask only",
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
