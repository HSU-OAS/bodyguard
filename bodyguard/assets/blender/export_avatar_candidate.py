"""FR-A-02~04: a separate web draft and native GLB roundtrip, never release approval.

Blender --factory-startup --disable-autoexec -b candidate.blend
  --python-exit-code 1 --python export_avatar_candidate.py -- new-web.blend glb-directory [ratio]
The artist source is never saved. Run review_avatar.py on both new .blend files.
"""

import json
import sys
from importlib.util import module_from_spec, spec_from_file_location
from math import isfinite
from pathlib import Path

import bmesh
import bpy
from mathutils.bvhtree import BVHTree

# Blender CLI scripts do not add their directory to the normal module path.
spec = spec_from_file_location(
    "web_surface_topology", Path(__file__).with_name("web_surface_topology.py")
)
assert spec is not None and spec.loader is not None
surface_helpers = module_from_spec(spec)
spec.loader.exec_module(surface_helpers)
final_web_triangles = surface_helpers.final_web_triangles

args = sys.argv[sys.argv.index("--") + 1 :]
if len(args) not in {2, 3}:
    raise ValueError(
        "Expected new web .blend, GLB directory, optional decimation ratio"
    )
output, directory = map(Path, args[:2])
ratio = float(args[2]) if len(args) == 3 else 1.0
roundtrip = output.with_name(output.stem + "-roundtrip.blend")
files = {
    label: directory / f"bodyguard-{label.lower()}-candidate.glb"
    for label in ("Male", "Female")
}
if not isfinite(ratio) or not 0.1 <= ratio <= 1:
    raise ValueError(
        "Web sculpt ratio must be within 0.1..1; verify geometry, not just size"
    )
if any(path.exists() for path in (output, roundtrip, *files.values())):
    raise FileExistsError(
        "Use new paths; never overwrite an edited source or previous export"
    )
directory.mkdir(parents=True, exist_ok=True)
source = Path(bpy.data.filepath).name
scene = bpy.context.scene
models = {}
offsets = {}
expected = {}
surface_topology = []


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def hand_selection(body):
    groups = {
        g.index
        for g in body.vertex_groups
        if g.name.startswith(("wrist", "finger", "metacarpal"))
    }
    body["bodyguard_distal_hand_vertices"] = [
        v.index
        for v in body.data.vertices
        if sum(g.weight for g in v.groups if g.group in groups) > 0.95
    ]
    assert body["bodyguard_distal_hand_vertices"], "Web hand QA region is empty"


def bounds(objects):
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    points = [
        obj.matrix_world @ vertex.co
        for obj in objects
        if obj.type == "MESH"
        for vertex in obj.evaluated_get(graph).data.vertices
    ]
    assert points and all(isfinite(c) for p in points for c in p)
    return [[min(p[i] for p in points), max(p[i] for p in points)] for i in range(3)]


for label, file in files.items():
    body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    objects = [
        obj
        for obj in scene.objects
        if obj.type == "MESH" and obj.name.startswith(f"BODYGUARD {label}")
    ]
    models[label] = [*objects, rig]
    offsets[label] = body.location.x
    assert all(obj.parent is None for obj in models[label]), (
        "Unexpected source hierarchy"
    )
    active(body)
    shape_before = bounds([body])
    protected = {
        group.index
        for group in body.vertex_groups
        if group.name.startswith(
            (
                "wrist",
                "finger",
                "metacarpal",
                "neck",
                "head",
                "clavicle",
                "upperarm",
                "lowerarm",
            )
        )
    }
    density = body.vertex_groups.new(name="Web density - preserve fine joints")
    for vertex in body.data.vertices:
        keep = sum(
            weight.weight for weight in vertex.groups if weight.group in protected
        )
        density.add([vertex.index], 0 if keep > 0.25 else 1, "REPLACE")
    reduce = body.modifiers.new(
        "Web sculpt density - deformation QA required", "DECIMATE"
    )
    reduce.ratio = ratio
    reduce.vertex_group = density.name
    reduce.vertex_group_factor = 1
    reduce.use_collapse_triangulate = True
    bpy.ops.object.modifier_move_up(modifier=reduce.name)
    bpy.ops.object.modifier_apply(modifier=reduce.name)
    body.vertex_groups.remove(body.vertex_groups["Web density - preserve fine joints"])
    triangulate = body.modifiers.new(
        "Explicit web triangles - topology QA required", "TRIANGULATE"
    )
    bpy.ops.object.modifier_move_up(modifier=triangulate.name)
    bpy.ops.object.modifier_apply(modifier=triangulate.name)
    # Collapse can leave tiny triangular fins at authored Boolean joins.
    # Remove only those extra faces; a hole or other non-manifold error still fails.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=0.000001)
    fins = [
        face
        for face in bm.faces
        if len(face.verts) == 3
        and sum(edge.is_boundary for edge in face.edges) == 2
        and any(len(edge.link_faces) == 3 for edge in face.edges)
        and face.calc_area() < 0.000001
    ]
    bmesh.ops.delete(bm, geom=fins, context="FACES")
    bmesh.ops.delete(
        bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS"
    )
    assert all(edge.is_manifold for edge in bm.edges), (
        f"{label}: web reduction damaged the closed surface"
    )
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(body.data)
    bm.free()
    topology_report = final_web_triangles(body.data)
    surface_topology.append({"gender": label, **topology_report})
    print("WEB FINAL TRIANGLES", label, json.dumps(topology_report), flush=True)
    print("WEB FIN REPAIR", label, len(fins))
    shape_after = bounds([body])
    assert (
        max(
            abs(shape_before[i][j] - shape_after[i][j])
            for i in range(3)
            for j in range(2)
        )
        < 0.003
    ), f"{label}: reduction changed the authored silhouette envelope"
    for obj in sorted(objects, key=lambda surface: surface != body):
        if obj != body:
            # Bind overlays to the actual reduced web surface, not the artist draft.
            if "draft" in obj.name:
                tree = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
                for vertex in obj.data.vertices:
                    _, normal, _, _ = tree.find_nearest(vertex.co)
                    assert normal is not None
                    vertex.co += normal * 0.003
                obj.data.update()
            obj.vertex_groups.clear()
            active(obj)
            body.select_set(True)
            bpy.context.view_layer.objects.active = body
            bpy.ops.object.data_transfer(
                data_type="VGROUP_WEIGHTS",
                use_create=True,
                use_object_transform=True,
                vert_mapping="POLYINTERP_NEAREST",
                layers_select_src="ALL",
                layers_select_dst="NAME",
            )
        active(obj)
        # FR-A-03: four-weight truncation failed shoulder/palm deformation QA.
        # Native eight-weight skin is a candidate, requiring roundtrip + web QA.
        bpy.ops.object.vertex_group_limit_total(limit=8)
        bpy.ops.object.vertex_group_normalize_all(lock_active=False)
        assert all(
            len([g for g in v.groups if g.weight > 0]) <= 8
            and isfinite(total := sum(g.weight for g in v.groups))
            and abs(total - 1) < 0.01
            for v in obj.data.vertices
        ), f"Incomplete eight-weight web skin: {obj.name}"
    hand_selection(body)
    for obj in objects:
        world = obj.matrix_world.copy()
        obj.parent = rig
        obj.matrix_world = world
    # glTF expects the skin armature to own its meshes. Move only that root.
    rig.location.x -= offsets[label]
    expected[label] = bounds(objects)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in models[label]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=str(file),
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_texcoords=False,
        export_skins=True,
        export_def_bones=True,
        export_extras=False,
        export_all_influences=True,
    )
    rig.location.x += offsets[label]

scene["bodyguard_stage"] = (
    "S2.4 optimized engineering draft; NOT release approved; no coaching clips"
)
scene["bodyguard_web_ratio"] = ratio
scene["bodyguard_web_skin_influences"] = 8
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
checks = []
for label, file in files.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Blender's editor-only bone widgets are not exported avatar surfaces.
    bpy.ops.import_scene.gltf(
        filepath=str(file), disable_bone_shape=True, merge_vertices=True
    )
    assert not bpy.data.images, "Reference/texture images must not be exported"
    assert not any(obj.type in {"CAMERA", "LIGHT"} for obj in bpy.context.scene.objects)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    actual = bounds(meshes)
    assert (
        max(
            abs(actual[i][j] - expected[label][i][j])
            for i in range(3)
            for j in range(2)
        )
        < 0.0001
    ), (
        f"{label}: roundtrip scale/position changed: expected={expected[label]}, actual={actual}"
    )
    checks.append(
        {
            "gender": label,
            "bytes": file.stat().st_size,
            "meshes": len(meshes),
            "bounds_m": actual,
            "animations": len(bpy.data.actions),
            "images": len(bpy.data.images),
        }
    )
    assert not bpy.data.actions, (
        "Technical neutral export must not contain coaching clips"
    )

# Restore presentation only, then replace explicit candidate objects with imported GLBs.
bpy.ops.wm.open_mainfile(filepath=str(output))
scene = bpy.context.scene
for label, file in files.items():
    for obj in list(scene.objects):
        if obj.type in {"MESH", "ARMATURE"} and obj.name.startswith(
            f"BODYGUARD {label}"
        ):
            bpy.data.objects.remove(obj, do_unlink=True)
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(
        filepath=str(file), disable_bone_shape=True, merge_vertices=True
    )
    imported = set(scene.objects) - before
    for obj in imported:
        if obj.parent not in imported:
            obj.location.x += offsets[label]
    hand_selection(bpy.data.objects[f"BODYGUARD {label} sculpt WIP"])
scene["bodyguard_stage"] = (
    "S2.4 native GLB roundtrip; deformation QA pending; NOT release approved"
)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(roundtrip), compress=True)
(directory / "roundtrip-report.json").write_text(
    json.dumps(
        {
            "source": source,
            "blender": bpy.app.version_string,
            "ratio": ratio,
            "maximum_skin_influences": 8,
            "transforms_passed": True,
            "geometry_deformation_pending": True,
            "final_surface_topology": surface_topology,
            "checks": checks,
        },
        indent=2,
    )
    + "\n"
)
print("WEB ROUNDTRIP", json.dumps(checks))
