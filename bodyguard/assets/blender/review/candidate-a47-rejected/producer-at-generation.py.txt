"""FR-A-01~04: replace a failed neck seam with the existing CC0 artist mesh.

Blender -b explicit-mannequin.blend --python-exit-code 1 --python this.py --
 new-source.blend new-report.json official-bundle.blend [low-ratio high-ratio [transition-m]]
This is a native surface edit, not a body generator or medical motion.
All source/GLB/deformation/browser/visual checks remain required.
"""

import json
import sys
from hashlib import file_digest
from math import isfinite
from pathlib import Path

import bmesh
import bpy
from mathutils import geometry
from mathutils.bvhtree import BVHTree


def closed_loops(edges):
    """FR-A-03: a native bridge requires two simple, disjoint boundary rings."""
    adjacent = {}
    for edge in edges:
        assert edge.is_boundary
        for vertex in edge.verts:
            adjacent.setdefault(vertex, []).append(edge.other_vert(vertex))
    assert adjacent and all(len(neighbors) == 2 for neighbors in adjacent.values()), (
        "Cut boundary is not a set of simple closed rings"
    )
    remaining, loops = set(adjacent), []
    while remaining:
        first = next(iter(remaining))
        previous, vertex, loop = None, first, []
        while not loop or vertex != first:
            assert vertex in remaining, "Boundary rings intersect"
            remaining.remove(vertex)
            loop.append(vertex)
            neighbors = adjacent[vertex]
            following = next(v for v in neighbors if v != previous)
            previous, vertex = vertex, following
        loops.append(loop)
    return loops


def cap_inner_cut(mesh, edges):
    """Close only a proven interior cavity, never the authored outer silhouette."""
    loops = closed_loops(edges)
    if len(loops) == 1:
        return 0
    assert len(loops) == 2, "Unsupported professional cut contours"
    areas = [
        abs(
            sum(
                a.co.x * b.co.y - b.co.x * a.co.y
                for a, b in zip(loop, loop[1:] + loop[:1], strict=True)
            )
        )
        for loop in loops
    ]
    assert all(isfinite(area) and area > 1e-12 for area in areas)
    outer, inner = (loops[0], loops[1]) if areas[0] > areas[1] else (loops[1], loops[0])
    points = [v.co for v in outer]
    triangles = geometry.tessellate_polygon([points])
    assert triangles and all(
        any(geometry.intersect_point_tri_2d(v.co, *(points[i] for i in tri)) for tri in triangles)
        for v in inner
    ), "Do not cap an exterior anatomy contour"
    assert not any(
        geometry.intersect_line_line_2d(a.co, b.co, c.co, d.co) is not None
        for a, b in zip(inner, inner[1:] + inner[:1], strict=True)
        for c, d in zip(outer, outer[1:] + outer[:1], strict=True)
    ), "Interior cut crosses the outer anatomy contour"
    coordinates = {v: tuple(v.co) for v in mesh.verts}
    inner_vertices = set(inner)
    interior_edges = [e for e in edges if all(v in inner_vertices for v in e.verts)]
    assert len(interior_edges) == len(inner)
    assert bmesh.ops.holes_fill(mesh, edges=interior_edges, sides=0)["faces"]
    assert coordinates == {v: tuple(v.co) for v in mesh.verts}, "Cavity closure moved anatomy"
    assert len(closed_loops([e for e in edges if e.is_boundary])) == 1
    return len(interior_edges)


def main():
    args = sys.argv[sys.argv.index("--") + 1 :]
    if len(args) not in (3, 5, 6):
        raise ValueError("Expected new source/report, professional source and optional artist band")
    output, report_path, professional = map(Path, args[:3])
    if (
        output.suffix != ".blend"
        or report_path.suffix != ".json"
        or output.resolve() == report_path.resolve()
    ):
        raise ValueError("Distinct explicit .blend source and .json report paths required")
    low_ratio, high_ratio = map(float, args[3:5]) if len(args) >= 5 else (0.81, 0.87)
    margin = float(args[5]) if len(args) == 6 else 0.008
    if not (isfinite(low_ratio) and isfinite(high_ratio)) or not (
        0.795 <= low_ratio <= 0.82 and 0.86 <= high_ratio <= 0.90
    ):
        raise ValueError("Artist band must isolate the neck, not unrelated anatomy")
    # FR-A-02/03: explicit native artist transition, not a relaxed QA threshold.
    if not isfinite(margin) or not 0.008 <= margin <= 0.032:
        raise ValueError("Artist transition must be finite and between 8 and 32mm")
    if output.exists() or report_path.exists():
        raise FileExistsError("Preserve prior artist files and evidence")
    if not professional.is_file():
        raise FileNotFoundError(professional)
    with professional.open("rb") as source_file:
        source_sha = file_digest(source_file, "sha256").hexdigest()
    reports = []

    for label in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
        assert len(body.modifiers) == 1 and body.modifiers[0].object == rig
        assert len(rig.data.bones) == 163 and all(
            b.matrix_basis.is_identity for b in rig.pose.bones
        )
        bones = [(b.name, tuple(b.matrix_local)) for b in rig.data.bones]
        initial_coordinates = [tuple(v.co) for v in body.data.vertices]
        initial_skin = [tuple((g.group, g.weight) for g in v.groups) for v in body.data.vertices]
        height = max(v.co.z for v in body.data.vertices)
        low, high = low_ratio * height, high_ratio * height
        assert 2 * margin < high - low, "Artist transition overlaps the professional patch"
        protected = {i + 1 for i in body["bodyguard_distal_hand_vertices"]}
        name = f"GEO-body_{label.lower()}_realistic"
        with bpy.data.libraries.load(str(professional)) as (available, loaded):
            if name not in available.objects:
                raise ValueError("Missing licensed professional neck surface")
            loaded.objects = [name]
        patch = loaded.objects[0]
        bpy.context.scene.collection.objects.link(patch)
        assert len(patch.modifiers) == 1 and patch.modifiers[0].type == "MULTIRES"
        patch.modifiers[0].levels = 1
        patch.modifiers[0].render_levels = 1
        bpy.context.view_layer.update()
        patch.data = bpy.data.meshes.new_from_object(
            patch.evaluated_get(bpy.context.evaluated_depsgraph_get())
        )
        patch.modifiers.clear()
        patch.parent = None
        patch.matrix_world = body.matrix_world.copy()
        source_height = max(v.co.z for v in patch.data.vertices)
        assert isfinite(source_height) and source_height > 0
        for v in patch.data.vertices:
            v.co *= height / source_height
        # Preserve the professionally authored neck topology, not its face details.
        pm = bmesh.new()
        pm.from_mesh(patch.data)
        for z, inner in ((low + margin, True), (high - margin, False)):
            bmesh.ops.bisect_plane(
                pm,
                geom=list(pm.verts) + list(pm.edges) + list(pm.faces),
                plane_co=(0, 0, z),
                plane_no=(0, 0, 1),
                dist=1e-8,
                clear_inner=inner,
                clear_outer=not inner,
            )
        assert len(pm.faces) > 100
        inner_cut_edges = cap_inner_cut(
            pm,
            [
                e
                for e in pm.edges
                if e.is_boundary and all(abs(v.co.z - (high - margin)) < 1e-6 for v in e.verts)
            ],
        )
        pm.to_mesh(patch.data)
        pm.free()
        # Reuse the existing native name-matched skin transfer at final coordinates.
        patch.vertex_groups.clear()
        for group in body.vertex_groups:
            patch.vertex_groups.new(name=group.name)
        bpy.ops.object.select_all(action="DESELECT")
        body.select_set(True)
        patch.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.data_transfer(
            data_type="VGROUP_WEIGHTS",
            use_create=True,
            use_object_transform=True,
            vert_mapping="POLYINTERP_NEAREST",
            layers_select_src="ALL",
            layers_select_dst="NAME",
        )
        assert [g.name for g in patch.vertex_groups] == [g.name for g in body.vertex_groups]
        bpy.ops.object.select_all(action="DESELECT")
        patch.select_set(True)
        bpy.context.view_layer.objects.active = patch
        bpy.ops.object.vertex_group_normalize_all(lock_active=False)
        assert initial_coordinates == [tuple(v.co) for v in body.data.vertices]
        assert initial_skin == [
            tuple((g.group, g.weight) for g in v.groups) for v in body.data.vertices
        ], "Patch preparation changed the input body"
        authored_points = {tuple(v.co) for v in patch.data.vertices}
        bm = bmesh.new()
        bm.from_mesh(body.data)
        bm.verts.ensure_lookup_table()
        original = bm.verts.layers.int.new("Original artist neck vertex")
        deform = bm.verts.layers.deform.active
        assert deform is not None
        retained = {v.index + 1: (v.co.copy(), dict(v[deform])) for v in bm.verts}
        old_tree = BVHTree.FromBMesh(bm)
        for v in bm.verts:
            v[original] = v.index + 1
        for z in (low, high):
            before = set(bm.verts)
            bmesh.ops.bisect_plane(
                bm,
                geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                plane_co=(0, 0, z),
                plane_no=(0, 0, 1),
                dist=1e-8,
            )
            for v in set(bm.verts) - before:
                v[original] = 0
        bmesh.ops.delete(
            bm,
            geom=[f for f in bm.faces if low + 1e-7 < f.calc_center_median().z < high - 1e-7],
            context="FACES",
        )
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        assert all(
            min(abs(v.co.z - low), abs(v.co.z - high)) < 1e-6
            for e in bm.edges
            if e.is_boundary
            for v in e.verts
        ), "Cut affected an unrelated surface"
        bm.from_mesh(patch.data)
        for z in (low, high):
            edges = [
                e
                for e in bm.edges
                if e.is_boundary and all(abs(v.co.z - z) < margin + 1e-6 for v in e.verts)
            ]
            assert len(closed_loops(edges)) == 2 and all(
                sum(e.is_boundary for e in v.link_edges) == 2 for e in edges for v in e.verts
            ), "Bridge must join exactly two simple boundary rings"
            before = {}
            for v in bm.verts:
                before.setdefault(tuple(v.co), []).append(v[original])
            for element in list(bm.verts) + list(bm.edges) + list(bm.faces):
                element.select = False
            for edge in edges:
                edge.select_set(True)
            bm.to_mesh(body.data)
            bm.free()
            bpy.ops.object.select_all(action="DESELECT")
            body.select_set(True)
            bpy.context.view_layer.objects.active = body
            bpy.context.scene.tool_settings.mesh_select_mode = (False, True, False)
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.bridge_edge_loops(
                type="SINGLE", number_cuts=6, interpolation="SURFACE", smoothness=1.0
            )
            bpy.ops.object.mode_set(mode="OBJECT")
            bm = bmesh.new()
            bm.from_mesh(body.data)
            original = bm.verts.layers.int.get("Original artist neck vertex")
            deform = bm.verts.layers.deform.active
            assert original is not None and deform is not None
            for v in bm.verts:
                ids = before.get(tuple(v.co))
                v[original] = ids.pop() if ids else 0
        assert all(e.is_manifold for e in bm.edges), "Professional neck joins must be closed"
        bm.verts.index_update()
        remap = {v[original]: v.index for v in bm.verts if v[original]}
        assert protected <= remap.keys()
        missing = retained.keys() - remap.keys()
        assert all(low - 1e-6 < retained[i][0].z < high + 1e-6 for i in missing)
        assert all(
            (v.co - retained[v[original]][0]).length < 1e-6
            and dict(v[deform]) == retained[v[original]][1]
            for v in bm.verts
            if v[original]
        ), "Do not alter retained authored coordinates/skin"
        assert authored_points <= {tuple(v.co) for v in bm.verts}, "Artist neck surface was changed"
        assert all(
            all(isfinite(c) for c in v.co)
            and isfinite(total := sum(v[deform].values()))
            and abs(total - 1) < 0.01
            for v in bm.verts
        )
        assert bones == [(b.name, tuple(b.matrix_local)) for b in rig.data.bones]
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        new_tree = BVHTree.FromBMesh(bm)
        # The old failed seam is not the anatomy target. Measure its difference,
        # while requiring exact preservation of the supplied professional patch.
        old_to_new = max(new_tree.find_nearest(retained[i][0])[3] for i in missing)
        new_to_old = max(old_tree.find_nearest(v.co)[3] for v in bm.verts if not v[original])
        reports.append(
            {
                "body": label,
                "professional_source": professional.name,
                "professional_sha256": source_sha,
                "neck_band_m": [low, high],
                "artist_transition_m": margin,
                "professional_patch_points": len(authored_points),
                "proven_interior_cut_edges_capped_without_moving_points": inner_cut_edges,
                "native_seam": {
                    "interpolation": "SURFACE",
                    "cuts": 6,
                    "smoothness": 1.0,
                },
                "source_vertices": len(retained),
                "candidate_vertices": len(bm.verts),
                "old_failed_seam_to_candidate_m": old_to_new,
                "candidate_to_old_failed_seam_m": new_to_old,
                "professional_patch_exact_retained_skin_bones_hands_preserved": True,
                "full_source_glb_deformation_browser_visual_qa_pending": True,
            }
        )
        body["bodyguard_distal_hand_vertices"] = [remap[i] for i in sorted(protected)]
        bm.verts.layers.int.remove(original)
        bm.to_mesh(body.data)
        bm.free()
        bpy.data.objects.remove(patch, do_unlink=True)
        for f in body.data.polygons:
            f.use_smooth = True
        body.data.update()
        print("PROFESSIONAL NECK PATCH", reports[-1])

    report_path.write_text(json.dumps(reports, indent=2) + "\n")
    bpy.context.scene["bodyguard_stage"] = (
        "S2.4 authored neck replacement; ALL QA pending; NOT release"
    )
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)


if __name__ == "__main__":
    main()
