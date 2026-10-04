"""Set up a Blender sculpt scene from Blender Foundation's CC0 human base meshes.

Run with Blender 5.1+ and four local paths after ``--``:
  Blender --background --python-exit-code 1 --python prepare_sculpt_studio.py -- \
    human_base_meshes_bundle.blend female-reference.png male-reference.png base-studio.blend

This imports artist-made meshes; it does not generate body geometry or a rig.
"""

import sys
from pathlib import Path

import bpy
from mathutils import Vector

source, female_reference, male_reference, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
for path in (source, female_reference, male_reference):
    if not path.is_file():
        raise FileNotFoundError(path)
if output.exists():
    raise FileExistsError("Choose a new base-studio path; do not overwrite edited source")

bpy.ops.wm.read_factory_settings(use_empty=True)
names = ("GEO-body_male_realistic", "GEO-body_female_realistic")
with bpy.data.libraries.load(str(source)) as (available, imported):
    if not set(names).issubset(available.objects):
        raise ValueError("Blender Human Base Meshes v1.4.1 male/female bodies not found")
    imported.objects = list(names)

white = bpy.data.materials.new("BODYGUARD warm white - sculpt WIP")
white.diffuse_color = (0.82, 0.81, 0.79, 1)
white.use_nodes = True
surface = next(node for node in white.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
surface.inputs["Base Color"].default_value = (0.82, 0.81, 0.79, 1)
surface.inputs["Roughness"].default_value = 0.72

for obj, x in zip(imported.objects, (-0.68, 0.68), strict=True):
    bpy.context.scene.collection.objects.link(obj)
    obj.location.x = x
    obj.data.materials.clear()
    obj.data.materials.append(white)
    obj.name = "BODYGUARD " + ("Male" if x < 0 else "Female") + " sculpt WIP"
    for face in obj.data.polygons:
        face.use_smooth = True

references = bpy.data.collections.new("CEO references - modeling only")
bpy.context.scene.collection.children.link(references)
for label, path, x in (("Female", female_reference, 2.6), ("Male", male_reference, -2.6)):
    image = bpy.data.images.load(str(path))
    image.name = label + " reference"
    image.pack()
    image.filepath = "//reference-" + label.lower() + ".png"
    ref = bpy.data.objects.new(label + " reference", None)
    references.objects.link(ref)
    ref.empty_display_type = "IMAGE"
    ref.data = image
    ref.location = (x, 0.7, 0.85)
    ref.rotation_euler.x = 1.57079632679
    ref.empty_display_size = 1.8
    ref.hide_render = True

camera_data = bpy.data.cameras.new("Review front")
camera = bpy.data.objects.new("Review front", camera_data)
bpy.context.scene.collection.objects.link(camera)
camera.location = (0, -5, 0.84)
camera.rotation_euler = (Vector((0, 0, 0.84)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera_data.type = "ORTHO"
camera_data.ortho_scale = 2.7
bpy.context.scene.camera = camera
bpy.context.scene["bodyguard_stage"] = "sculpt WIP; no rig or animation; not for release"
bpy.context.scene["base_mesh_source"] = "Blender Human Base Meshes v1.4.1 (CC0)"

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output))
print("SAVED", output)
