"""FR-A-01~03 / ADR-0018: refine artist-made meshes in a Blender studio copy.

Open the sculpt studio with Blender -b, then pass after --:
  official-human-base-meshes.blend mpfb-rig-source.blend output-draft.blend
The output is an editable rigging draft, not a validated stretching instruction.
Use --python-exit-code 1 so a failed script cannot appear to pass a shell check.
"""

from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector


source, rig_source, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
for path in (source, rig_source):
    if not path.is_file():
        raise FileNotFoundError(path)
if output.resolve() in {source.resolve(), rig_source.resolve(), Path(bpy.data.filepath).resolve()}:
    raise ValueError("Refinement must write a separate draft")
if output.exists():
    raise FileExistsError("Choose a new draft path; do not overwrite edited source")
if any(obj.type == "ARMATURE" for obj in bpy.context.scene.objects):
    raise ValueError("Input must be the unrigged base studio, not an already edited rig draft")

head_names = ("GEO-head_male_primitive_realistic", "GEO-head_primitive_female_realistic")
with bpy.data.libraries.load(str(source)) as (available, loaded):
    if not set(head_names).issubset(available.objects):
        raise ValueError("Expected Blender Human Base Meshes v1.4.1 head assets")
    loaded.objects = list(head_names)
heads = list(loaded.objects)

with bpy.data.libraries.load(str(rig_source)) as (available, loaded):
    loaded.objects = [f"Bodyguard_{label}_Base{suffix}" for label in ("Male", "Female") for suffix in ("", ".rig")]
for obj in loaded.objects:
    if obj is None:
        raise ValueError("The MPFB male/female rig source is incomplete")
    bpy.context.scene.collection.objects.link(obj)

for label, head in zip(("Male", "Female"), heads, strict=True):
    obj = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.modifiers[0].levels = 1
    bpy.context.view_layer.update()
    obj.data = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    obj.modifiers.clear()
    height = max(v.co.z for v in obj.data.vertices)

    # This is a professionally authored head asset. Smooth its shallow eye plane
    # along depth only; retain the artist's outline instead of generating primitives.
    bpy.context.scene.collection.objects.link(head)
    head.parent = None
    head.location.x = obj.location.x
    bm = bmesh.new()
    bm.from_mesh(head.data)
    face = [v for v in bm.verts if v.co.y < -0.025]
    for _ in range(18):
        bmesh.ops.smooth_vert(bm, verts=face, factor=0.65, use_axis_x=False, use_axis_y=True, use_axis_z=False)
    bm.to_mesh(head.data)
    bm.free()
    # Conforming to a coarse evaluated target bakes its planar facets into the
    # sculpt. Evaluate the artist's curved surface before transferring its shape.
    for modifier in head.modifiers:
        if modifier.type == "SUBSURF":
            modifier.levels = 4
            modifier.render_levels = 4
    bpy.context.view_layer.update()
    head.data = bpy.data.meshes.new_from_object(head.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    head.modifiers.clear()
    head.data.materials.clear()
    head.data.materials.append(obj.data.materials[0])

    # Keep the body's continuous neck. The blend starts below the chin, so nose,
    # lips and ears are fully conformed to the professionally authored blank head.
    start = min((head.matrix_world @ v.co).z for v in head.data.vertices) - 0.045
    mask = obj.vertex_groups.new(name="Faceless head sculpt mask")
    mask_name = mask.name
    for vertex in obj.data.vertices:
        amount = min(1, max(0, (vertex.co.z - start) / 0.055))
        weight = amount * amount * (3 - 2 * amount)
        if weight:
            mask.add([vertex.index], weight, "REPLACE")
    sculpt = obj.modifiers.new("Conform to artist blank head", "SHRINKWRAP")
    sculpt.target = head
    sculpt.vertex_group = mask_name
    sculpt.wrap_method = "NEAREST_SURFACEPOINT"
    bpy.ops.object.modifier_apply(modifier=sculpt.name)
    bpy.data.objects.remove(head, do_unlink=True)
    smooth = obj.modifiers.new("Head-neck sculpt finish", "SMOOTH")
    smooth.vertex_group = mask_name
    smooth.factor = 0.5
    smooth.iterations = 10
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    obj.vertex_groups.remove(obj.vertex_groups[mask_name])
    # Collapsed oral/ear surfaces leave visible creases even on a closed mesh.
    # Remesh only the head/upper neck, preserving the body's authored topology.
    clean_head = obj.copy()
    clean_head.data = obj.data.copy()
    bpy.context.scene.collection.objects.link(clean_head)
    join_z = start - 0.01
    for part, z, above in ((clean_head, join_z, True), (obj, join_z + 0.025, False)):
        bm = bmesh.new()
        bm.from_mesh(part.data)
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
            plane_co=(0, 0, z), plane_no=(0, 0, 1), clear_inner=above, clear_outer=not above)
        bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(part.data)
        bm.free()
    bpy.context.view_layer.objects.active = clean_head
    remesh = clean_head.modifiers.new("Head-only surface cleanup", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = 0.001
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    finish = clean_head.modifiers.new("Head-only smooth finish", "SMOOTH")
    finish.factor = 0.5
    finish.iterations = 5
    bpy.ops.object.modifier_apply(modifier=finish.name)
    reduce = clean_head.modifiers.new("Blank head draft density", "DECIMATE")
    reduce.ratio = 0.15
    bpy.ops.object.modifier_apply(modifier=reduce.name)
    bpy.context.view_layer.objects.active = obj
    union = obj.modifiers.new("Continuous head-neck surface", "BOOLEAN")
    union.operation = "UNION"
    union.object = clean_head
    bpy.ops.object.modifier_apply(modifier=union.name)
    bpy.data.objects.remove(clean_head, do_unlink=True)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    seam_z = join_z + 0.025
    patch = [face for face in bm.faces if any(abs(v.co.z - seam_z) < 0.02 for v in face.verts)]
    bmesh.ops.triangulate(bm, faces=patch)
    edges = [edge for edge in bm.edges if all(abs(v.co.z - seam_z) < 0.02 for v in edge.verts)]
    bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=True)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    seam = obj.vertex_groups.new(name="Neck seam sculpt mask")
    seam_name = seam.name
    for vertex in obj.data.vertices:
        weight = max(0, 1 - abs(vertex.co.z - seam_z) / 0.03)
        if weight:
            seam.add([vertex.index], weight, "REPLACE")
    finish = obj.modifiers.new("Continuous neck finish", "SMOOTH")
    finish.vertex_group = seam_name
    finish.factor = 0.5
    finish.iterations = 12
    bpy.ops.object.modifier_apply(modifier=finish.name)
    obj.vertex_groups.remove(obj.vertex_groups[seam_name])
    for face in obj.data.polygons:
        face.use_smooth = True

    donor = bpy.data.objects[f"Bodyguard_{label}_Base"]
    rig = bpy.data.objects[f"Bodyguard_{label}_Base.rig"]
    bpy.context.view_layer.update()
    evaluated = donor.evaluated_get(bpy.context.evaluated_depsgraph_get())
    source_height = max((evaluated.matrix_world @ v.co).z for v in evaluated.data.vertices)
    rig.location = Vector((obj.location.x, 0, 0))
    rig.scale *= height / source_height
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    donor.select_set(True)
    bpy.context.view_layer.objects.active = donor
    bpy.ops.object.data_transfer(data_type="VGROUP_WEIGHTS", use_create=True,
        use_object_transform=True, vert_mapping="POLYINTERP_NEAREST",
        layers_select_src="ALL", layers_select_dst="NAME")
    for group in list(obj.vertex_groups):
        bone = rig.data.bones.get(group.name)
        if bone is None or not bone.use_deform:
            obj.vertex_groups.remove(group)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    skin = obj.modifiers.new("Draft skin - requires joint QA", "ARMATURE")
    skin.object = rig
    unweighted = sum(sum(g.weight for g in v.groups) < 0.99 for v in obj.data.vertices)
    if unweighted:
        raise ValueError(f"{label}: {unweighted} vertices lack normalized deform weights")
    rig.name = f"BODYGUARD {label} rig WIP"
    rig.show_in_front = True
    bpy.data.objects.remove(donor, do_unlink=True)
    print("DRAFT QC", label, "vertices", len(obj.data.vertices), "bones", len(rig.data.bones),
        "deform_groups", len(obj.vertex_groups), "unweighted", unweighted)

bpy.context.scene["bodyguard_stage"] = "faceless rigging draft; deformation QA only; not a release asset"
bpy.context.scene["base_mesh_source"] = "Blender Human Base Meshes v1.4.1 bodies and artist-made heads (CC0)"
bpy.context.scene["rig_source"] = "MPFB standard rig/core weights (CC0); transferred draft weights"
scene = bpy.context.scene
scene.render.resolution_x = 1400
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.camera.data.ortho_scale = 2.8
scene.world = bpy.data.worlds.new("BODYGUARD review world")
scene.world.color = (0.3, 0.3, 0.3)
for name, location, energy in (("key", (0, -3, 4), 1300), ("fill", (2, -2, 2), 350)):
    data = bpy.data.lights.new("BODYGUARD review " + name, "AREA")
    light = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(light)
    light.location = location
    data.energy = energy
    data.size = 4
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
