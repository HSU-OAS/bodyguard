"""FR-S-01/06·FR-A-01: animate preserved Blender candidates for private selection media.

Blender --background source.blend --python script -- scratch label [samples|video]
No source/GLB overwrite, new mesh, clinical threshold or exercise-dose prescription.
"""

import hashlib
import json
import re
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

args = sys.argv[sys.argv.index("--") + 1 :]
scratch, label, mode = args
assert re.fullmatch(r"/private/tmp/bodyguard-motion-media\.[A-Za-z0-9]+", scratch)
assert re.fullmatch(r"[a-z][a-z0-9-]+", label)
assert mode in ("samples", "video")
out = Path(scratch) / label
out.mkdir(exist_ok=False)


def enum(owner, field, value):
    assert value in [item.identifier for item in owner.bl_rna.properties[field].enum_items]
    setattr(owner, field, value)


scene = bpy.context.scene
try:
    scene.render.engine = "BLENDER_EEVEE"
except TypeError as error:
    raise RuntimeError(f"Eevee unavailable: {error}") from error
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.fps = 24
enum(scene.render.image_settings, "file_format", "PNG")
enum(scene.render.image_settings, "color_mode", "RGBA")
scene.render.film_transparent = True
scene.world.use_nodes = True
background = next(n for n in scene.world.node_tree.nodes if n.type == "BACKGROUND")
background.inputs[0].default_value = (1, 1, 1, 1)
background.inputs[1].default_value = 0.8
# Keep the source's color management; dynamic OCIO enums are not statically enumerable.
ground = bpy.data.objects.get("BODYGUARD review ground")
if ground:
    ground.hide_render = True

rigs = {gender.lower(): bpy.data.objects[f"BODYGUARD {gender} rig WIP"] for gender in ("Male", "Female")}
meshes = {gender.lower(): bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"] for gender in ("Male", "Female")}


def mesh_hash(mesh):
    # Base vertex/face/weight data, not a lossy visual proxy for the preserved mesh.
    data = {
        "vertices": [list(v.co) for v in mesh.data.vertices],
        "faces": [list(p.vertices) for p in mesh.data.polygons],
        "weights": [[(g.group, g.weight) for g in v.groups] for v in mesh.data.vertices],
    }
    return hashlib.sha256(json.dumps(data, separators=(",", ":")).encode()).hexdigest()


before = {gender: mesh_hash(mesh) for gender, mesh in meshes.items()}
camera = scene.camera or bpy.data.objects["Review front"]
enum(camera.data, "type", "ORTHO")
scene.camera = camera
specs = {
    "neck-side": {"end": 144, "poster": 40, "keys": [(1, 0), (12, 0), (40, 1), (48, 1), (72, 0), (104, -1), (112, -1), (144, 0)]},
    "shoulder-shrug": {"end": 72, "poster": 36, "keys": [(1, 0), (12, 0), (36, 1), (44, 1), (72, 0)]},
    "arm-overhead": {"end": 144, "poster": 44, "keys": [(1, 0), (12, 0), (44, 1), (52, 1), (72, 0), (108, -1), (116, -1), (144, 0)]},
}
reports = []
for gender, rig in rigs.items():
    mesh = meshes[gender]
    base = {b.name: b.matrix_basis.to_quaternion() for b in rig.pose.bones}
    for b in rig.pose.bones:
        enum(b, "rotation_mode", "QUATERNION")
    rig.animation_data_clear()
    rig.animation_data_create()
    for motion, spec in specs.items():
        rig.animation_data.action = None
        for bone in rig.pose.bones:
            bone.rotation_quaternion = base[bone.name]
        if motion == "neck-side":
            amplitudes = {"neck01": 0.06, "neck02": 0.06, "neck03": 0.06, "head": 0.08}
        elif motion == "shoulder-shrug":
            amplitudes = {"clavicle.L": -0.16, "clavicle.R": 0.16}
        else:
            amplitudes = {"upperarm01.L": -2.2, "upperarm01.R": 2.2, "clavicle.L": -0.12, "clavicle.R": 0.12}
        for frame, progress in spec["keys"]:
            for name, amplitude in amplitudes.items():
                bone = rig.pose.bones[name]
                factor = progress
                if motion == "arm-overhead":
                    factor = max(progress, 0) if name.endswith(".L") else max(-progress, 0)
                # Illustration amplitudes only; not target anatomical angles/clinical rules.
                local_axis = bone.bone.matrix_local.to_quaternion().inverted() @ Vector((0, 1, 0))
                bone.rotation_quaternion = base[name] @ Quaternion(local_axis, amplitude * factor)
                bone.keyframe_insert("rotation_quaternion", frame=frame, group="selection-preview-not-validated")
        action = rig.animation_data.action
        action.name = f"bodyguard-preview-{gender}-{motion}"
        action.use_fake_user = True
        curves = [curve for layer in action.layers for strip in layer.strips for bag in strip.channelbags for curve in bag.fcurves]
        assert len(curves) == len(amplitudes) * 4, "Incomplete quaternion action"
        for curve in curves:
            for key in curve.keyframe_points:
                enum(key, "interpolation", "BEZIER")
                enum(key, "handle_left_type", "AUTO_CLAMPED")
                enum(key, "handle_right_type", "AUTO_CLAMPED")
        for other_gender, other in meshes.items():
            other.hide_render = other_gender != gender
        for other_gender, other in rigs.items():
            other.hide_render = other_gender != gender
        # Candidate-b proved +Y sees the back; -Y shows the chest/front. No mesh rotation.
        center_z = 1.4 if motion == "arm-overhead" else 1.35
        center = Vector((rig.location.x, 0, center_z))
        camera.location = (rig.location.x, -3, center_z)
        camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
        camera.data.ortho_scale = 1.65 if motion == "arm-overhead" else 1.1
        scene.frame_start = 1
        scene.frame_end = spec["end"]
        folder = out / f"{gender}-{motion}"
        folder.mkdir(exist_ok=False)
        frames = [1, spec["poster"], spec["end"]] if mode == "samples" else range(1, spec["end"] + 1)
        for frame in frames:
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            scene.render.filepath = str(folder / f"{frame:04}.png")
            bpy.ops.render.render(write_still=True)
        reports.append({"gender": gender, "motion": motion, "frames": len(frames), "fps": 24, "end": spec["end"], "poster": spec["poster"], "action": action.name})

after = {gender: mesh_hash(mesh) for gender, mesh in meshes.items()}
assert before == after, "Source mesh/weights changed"
# All six actions have fake users; preserve one editable native copy, not six duplicated meshes.
bpy.ops.wm.save_as_mainfile(filepath=str(out / "motion-preview-authoring.blend"), check_existing=False)
(out / "report.json").write_text(json.dumps({"blender": bpy.app.version_string, "method": "private Blender-rendered selection previews; illustration only", "before": before, "after": after, "reports": reports, "actualPeople": False, "sourceOverwritten": False, "glbModified": False}, indent=2))
print("BODYGUARD_MOTION_MEDIA " + json.dumps({"output": str(out), "reports": reports, "meshUnchanged": True}))
