"""FR-A-01~04: native local neck retopology of an authored neutral mannequin.

Blender --factory-startup --disable-autoexec -b explicit-source.blend
 --python-exit-code 1 --python this.py -- new-source.blend new-report.json [upper-ratio]
Uses the existing professional contours; no generated body or medical motion.
Run full source/GLB/browser/visual QA; producing a file does not approve it.
"""

import json
import sys
from bisect import bisect_left
from math import isfinite, pi
from pathlib import Path

import bmesh
import bpy
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index("--") + 1 :]
if len(args) not in (2, 3):
    raise ValueError("Expected new source/report paths and optional artist upper ratio")
output, report_path = map(Path, args[:2])
upper_ratio = float(args[2]) if len(args) == 3 else 0.86
if not isfinite(upper_ratio) or not 0.845 <= upper_ratio <= 0.89:
    raise ValueError("Artist neck band must stay within the verified contour region")
if output.exists() or output.resolve() == Path(bpy.data.filepath).resolve():
    raise FileExistsError("Preserve the prior artist source")
if report_path.exists():
    raise FileExistsError("Preserve prior retopology evidence")
assert not any(
    o.name.startswith("BODYGUARD ") and "draft" in o.name for o in bpy.context.scene.objects
)
reports = []


def cut_contours(mesh, low, high):
    boundary = {e for e in mesh.edges if e.is_boundary}
    assert boundary and all(
        sum(e.is_boundary for e in v.link_edges) == 2 for e in boundary for v in e.verts
    ), "Cut did not produce simple closed neck contours"
    assert all(min(abs(v.co.z - low), abs(v.co.z - high)) < 1e-6 for e in boundary for v in e.verts)
    loops = []
    remaining = set(boundary)
    while remaining:
        loop = {remaining.pop()}
        stack = list(loop)
        while stack:
            for v in stack.pop().verts:
                for edge in v.link_edges:
                    if edge in remaining:
                        remaining.remove(edge)
                        loop.add(edge)
                        stack.append(edge)
        loops.append(loop)
    assert len(loops) == 2, "Neck repair must not cut an arm or unrelated surface"
    return boundary, loops


def band_folds(mesh, low, high):
    # Artist geometry diagnosis only, not a clinical or whole-avatar approval.
    mesh.normal_update()
    return sum(
        e.is_manifold
        and e.calc_length() > 0.001
        and all(low - 1e-6 < v.co.z < high + 1e-6 for v in e.verts)
        and e.calc_face_angle() > pi / 2
        for e in mesh.edges
    )


for label in ("Male", "Female"):
    body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    assert len(body.modifiers) == 1 and body.modifiers[0].object == rig
    assert len(rig.data.bones) == 163 and all(b.matrix_basis.is_identity for b in rig.pose.bones)
    bones = [(b.name, tuple(b.matrix_local)) for b in rig.data.bones]
    height = max(v.co.z for v in body.data.vertices)
    low, high = height * 0.83, height * upper_ratio
    protected = {i + 1 for i in body["bodyguard_distal_hand_vertices"]}
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    original = bm.verts.layers.int.new("Original neck repair vertex")
    deform = bm.verts.layers.deform.active
    assert deform is not None
    retained = {v.index + 1: (v.co.copy(), dict(v[deform])) for v in bm.verts}
    original_tree = BVHTree.FromBMesh(bm)
    reference_mesh = body.data.copy()
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
    faces = [f for f in bm.faces if low + 1e-7 < f.calc_center_median().z < high - 1e-7]
    assert faces, "No authored neck band selected"
    bmesh.ops.delete(bm, geom=faces, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    boundary, loops = cut_contours(bm, low, high)
    source_contour_counts = sorted(len(loop) for loop in loops)
    # Unequal dense cut rings produced collapsed strips after conformance.
    # Dissolve only newly cut points by arc length, preserving authored vertices.
    target_count = min(source_contour_counts)
    for loop in loops:
        if len(loop) <= target_count:
            continue
        vertices = {v for e in loop for v in e.verts}
        start = min(vertices, key=lambda v: tuple(v.co))
        order = [start]
        previous = None
        current = start
        while True:
            neighbour = next(
                e.other_vert(current)
                for e in current.link_edges
                if e in loop and e.other_vert(current) != previous
            )
            if neighbour == start:
                break
            order.append(neighbour)
            previous, current = current, neighbour
        assert len(order) == len(vertices)
        cumulative = [0.0]
        for i in range(1, len(order)):
            cumulative.append(cumulative[-1] + (order[i].co - order[i - 1].co).length)
        perimeter = cumulative[-1] + (order[-1].co - start.co).length
        keep = {
            min(bisect_left(cumulative, i * perimeter / target_count), len(order) - 1)
            for i in range(target_count)
        }
        # Native dissolve also simplifies low-valence incident vertices.
        # Keep their neighbouring cut points rather than losing authored detail.
        dissolve = [
            v
            for i, v in enumerate(order)
            if i not in keep
            and not v[original]
            and not any(
                e.other_vert(v)[original] and len(e.other_vert(v).link_edges) <= 4
                for e in v.link_edges
            )
        ]
        bmesh.ops.dissolve_verts(bm, verts=dissolve, use_face_split=True)
    boundary, loops = cut_contours(bm, low, high)
    contour_counts = sorted(len(loop) for loop in loops)
    before = {}
    for v in bm.verts:
        before.setdefault(tuple(v.co), []).append(v[original])
    for element in list(bm.verts) + list(bm.edges) + list(bm.faces):
        element.select = False
    for edge in boundary:
        edge.select_set(True)
    bm.to_mesh(body.data)
    bm.free()
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.context.scene.tool_settings.mesh_select_mode = (False, True, False)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.bridge_edge_loops(
        type="SINGLE", number_cuts=12, interpolation="SURFACE", smoothness=1.0
    )
    bpy.ops.object.mode_set(mode="OBJECT")
    bm = bmesh.new()
    bm.from_mesh(body.data)
    original = bm.verts.layers.int.get("Original neck repair vertex")
    deform = bm.verts.layers.deform.active
    assert original is not None and deform is not None
    for v in bm.verts:
        ids = before.get(tuple(v.co))
        v[original] = ids.pop() if ids else 0
    bm.verts.index_update()
    folds_before_conformance = band_folds(bm, low, high)
    print("NATIVE BRIDGE FOLDS BEFORE CONFORMANCE", label, folds_before_conformance)
    # Only new points follow the professional surface. This is a candidate,
    # not an approved solution for the diagnosed native bridge folds.
    generated = [v.index for v in bm.verts if not v[original]]
    bm.to_mesh(body.data)
    bm.free()
    reference = bpy.data.objects.new("Temporary authored neck reference", reference_mesh)
    bpy.context.scene.collection.objects.link(reference)
    reference.matrix_world = body.matrix_world.copy()
    reference.hide_render = True
    mask = body.vertex_groups.new(name="New neck surface conformance")
    mask_name = mask.name
    mask.add(generated, 1.0, "REPLACE")
    wrap = body.modifiers.new("Conform new neck to authored surface", "SHRINKWRAP")
    wrap.target = reference
    wrap.vertex_group = mask_name
    wrap.wrap_method = "NEAREST_SURFACEPOINT"
    bpy.ops.object.modifier_move_up(modifier=wrap.name)
    bpy.ops.object.modifier_apply(modifier=wrap.name)
    body.vertex_groups.remove(body.vertex_groups[mask_name])
    bpy.data.objects.remove(reference, do_unlink=True)
    bpy.data.meshes.remove(reference_mesh)
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.index_update()
    original = bm.verts.layers.int.get("Original neck repair vertex")
    deform = bm.verts.layers.deform.active
    assert original is not None and deform is not None
    folds_after_conformance = band_folds(bm, low, high)
    print("NATIVE BRIDGE FOLDS AFTER CONFORMANCE", label, folds_after_conformance)
    remap = {v[original]: v.index for v in bm.verts if v[original]}
    assert protected <= remap.keys(), "Neck repair removed authored hand vertices"
    missing = retained.keys() - remap.keys()
    outside_missing = [i for i in missing if not low - 1e-6 < retained[i][0].z < high + 1e-6]
    print(
        "NATIVE RETAINED CHECK",
        label,
        len(outside_missing),
        [list(retained[i][0]) for i in outside_missing[:4]],
    )
    assert all(low - 1e-6 < retained[i][0].z < high + 1e-6 for i in missing), (
        "Neck repair removed unrelated authored anatomy"
    )
    assert all(
        (v.co - retained[v[original]][0]).length < 1e-6
        and dict(v[deform]) == retained[v[original]][1]
        for v in bm.verts
        if v[original]
    ), "Native bridge changed retained authored coordinates/weights"
    assert all(
        isfinite(total := sum(v[deform].values())) and abs(total - 1) < 0.01 for v in bm.verts
    ), "Native bridge lost normalized skin weights"
    assert bones == [(b.name, tuple(b.matrix_local)) for b in rig.data.bones]
    assert all(e.is_manifold for e in bm.edges), "Native bridge opened the original body"
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    candidate_tree = BVHTree.FromBMesh(bm)
    old_to_new = max(candidate_tree.find_nearest(retained[i][0])[3] for i in missing)
    new_to_old = max(original_tree.find_nearest(v.co)[3] for v in bm.verts if not v[original])
    print("NATIVE NECK ENVELOPE", label, old_to_new, new_to_old, contour_counts)
    worst = max(
        (v for v in bm.verts if not v[original]),
        key=lambda v: original_tree.find_nearest(v.co)[3],
    )
    print("NATIVE NECK MAX POINT", label, tuple(worst.co))
    # Artist surface envelope, not a patient-estimation/clinical accuracy claim.
    assert isfinite(old_to_new) and isfinite(new_to_old)
    assert max(old_to_new, new_to_old) < 0.006, "Local retopology lost the authored neck envelope"
    body["bodyguard_distal_hand_vertices"] = [remap[i] for i in sorted(protected)]
    reports.append(
        {
            "body": label,
            "source_vertices": len(retained),
            "candidate_vertices": len(bm.verts),
            "neck_band_m": [low, high],
            "contour_edges": contour_counts,
            "source_contour_edges": source_contour_counts,
            "native_surface_bridge_cuts": 12,
            "native_surface_bridge_smoothness": 1.0,
            "bridge_band_long_folds_before_after_conformance": [
                folds_before_conformance,
                folds_after_conformance,
            ],
            "new_bridge_points_conformed_to_authored_surface": len(generated),
            "removed_band_vertices": len(missing),
            "original_to_candidate_envelope_m": old_to_new,
            "candidate_to_original_envelope_m": new_to_old,
            "retained_coordinates_skin_bones_hands_preserved": True,
            "full_deformation_visual_browser_qa_pending": True,
        }
    )
    bm.verts.layers.int.remove(original)
    bm.to_mesh(body.data)
    bm.free()
    for face in body.data.polygons:
        face.use_smooth = True
    body.data.update()
report_path.write_text(json.dumps(reports, indent=2) + "\n")
bpy.context.scene["bodyguard_stage"] = (
    "S2.4 local neck retopology; all QA pending; NOT release approved"
)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
print("NATIVE NECK BRIDGE", json.dumps(reports))
