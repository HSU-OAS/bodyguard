"""FR-A-01~04 / CEO 2026-10-01: remove clothing, retain authored body/rig.

Blender --factory-startup --disable-autoexec -b explicit-candidate.blend
  --python-exit-code 1 --python this.py -- new-candidate.blend new-preview-directory
No human geometry is generated or smoothed. Run source/GLB/visual/browser QA.
"""

import sys
from pathlib import Path

import bpy
from mathutils import Vector

output, previews = map(Path, sys.argv[sys.argv.index("--") + 1 :])
if output.exists() or output.resolve() == Path(bpy.data.filepath).resolve():
    raise FileExistsError("Use a new candidate; preserve the prior source")
if previews.exists():
    raise FileExistsError("Use a new preview directory")
scene = bpy.context.scene
bodies = [bpy.data.objects[f"BODYGUARD {label} sculpt WIP"] for label in ("Male", "Female")]
material = bodies[0].data.materials[0]
for body in bodies:
    rig = body.modifiers[0].object
    assert len(body.modifiers) == 1 and body.modifiers[0].type == "ARMATURE"
    assert len(rig.data.bones) == 163
    assert all(bone.matrix_basis.is_identity for bone in rig.pose.bones)
    before = [
        (tuple(v.co), tuple((g.group, g.weight) for g in v.groups)) for v in body.data.vertices
    ]
    bones = [(b.name, tuple(b.matrix_local)) for b in rig.data.bones]
    # Remove actual garment objects, not a skin region or hidden overlay.
    for obj in list(scene.objects):
        if obj.name.startswith(f"BODYGUARD {body.name.split()[1]}") and "draft" in obj.name:
            bpy.data.objects.remove(obj, do_unlink=True)
    body.data.materials.clear()
    body.data.materials.append(material)
    for face in body.data.polygons:
        face.material_index = 0
    assert before == [
        (tuple(v.co), tuple((g.group, g.weight) for g in v.groups)) for v in body.data.vertices
    ], "Removing clothing must not alter authored body coordinates/skin weights"
    assert bones == [(b.name, tuple(b.matrix_local)) for b in rig.data.bones]
    print("MANNEQUIN BODY PRESERVED", body.name, len(before), "vertices", len(bones), "bones")
assert bodies[0].data.materials[0] == bodies[1].data.materials[0]
assert not any(
    "draft" in obj.name and obj.name.startswith("BODYGUARD ") for obj in scene.objects
), "A separate garment remained"
scene["bodyguard_surface_style"] = "unified-white-mannequin; CEO 2026-10-01"
scene["bodyguard_clothing"] = "None; prior dressed candidates/evidence preserved"
scene["bodyguard_stage"] = "S2.4 unified mannequin candidate; ALL QA pending; NOT release approved"
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
previews.mkdir(parents=True)
scene.render.resolution_x = 1400
scene.render.resolution_y = 1000
scene.cycles.samples = 32
camera = scene.camera
for name, label, location, target, scale in (
    ("front", "", (0, -5, 0.84), (0, 0, 0.84), 2.8),
    ("quarter", "", (2.4, -4.8, 0.84), (0, 0, 0.84), 2.8),
    ("female-torso", "Female", (0, -4, 1.0), (0, 0, 1.0), 0.95),
    ("male-torso", "Male", (0, -4, 1.0), (0, 0, 1.0), 0.95),
):
    for obj in scene.objects:
        if (
            obj.type == "MESH"
            and obj.name.startswith("BODYGUARD ")
            and "review ground" not in obj.name
        ):
            obj.hide_render = bool(label and not obj.name.startswith(f"BODYGUARD {label}"))
    if label:
        x = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"].matrix_world.translation.x
        location = (x + location[0], *location[1:])
        target = (x + target[0], *target[1:])
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.ortho_scale = scale
    scene.render.filepath = str(previews / f"{name}.png")
    bpy.ops.render.render(write_still=True)
print("UNIFIED MANNEQUIN PREVIEW ONLY; source/GLB/visual/browser QA still required", output)
