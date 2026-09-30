"""FR-A-01~03: repeatable Blender deformation harness, not medical motion content.

Run Blender -b draft.blend --python-exit-code 1 --python review_avatar.py -- output-directory.
The 20-degree neck rotation is a technical stress test, not a target for users.
The loaded .blend is never saved; reviewed poses are temporary.
"""

from math import degrees, isfinite, radians
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Quaternion, Vector


output = Path(sys.argv[sys.argv.index("--") + 1])
output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
for label in ("Male", "Female"):
    obj = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    assert len(obj.data.vertices) > 10_000, f"{label}: unexpected loss of authored body topology"
    assert all(isfinite(c) for v in obj.data.vertices for c in v.co), f"{label}: nonfinite surface"
    height = max(v.co.z for v in obj.data.vertices) - min(v.co.z for v in obj.data.vertices)
    assert 1.5 < height < 2, f"{label}: expected complete metre-scale body, got {height}"
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    invalid = sum(not e.is_manifold for e in bm.edges)
    unseen = set(bm.verts)
    components = 0
    while unseen:
        components += 1
        stack = [unseen.pop()]
        while stack:
            vertex = stack.pop()
            for edge in vertex.link_edges:
                other = edge.other_vert(vertex)
                if other in unseen:
                    unseen.remove(other)
                    stack.append(other)
    bm.free()
    assert invalid == 0, f"{label}: {invalid} non-manifold edges"
    assert components == 1, f"{label}: head/body must be joined, got {components} components"
    unweighted = sum(not isfinite(total := sum(g.weight for g in v.groups)) or abs(total - 1) > 0.01
        for v in obj.data.vertices)
    assert unweighted == 0, f"{label}: {unweighted} unnormalized vertices"
    print("AVATAR QC", label, "vertices", len(obj.data.vertices), "bones", len(rig.data.bones),
        "components", components, "non_manifold", invalid, "unnormalized", unweighted)
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion()

scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1400
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("BODYGUARD review world")
scene.world.color = (0.3, 0.3, 0.3)
for name, location, energy in (("key", (0, -3, 4), 1300), ("fill", (2, -2, 2), 350)):
    light = bpy.data.objects.get("BODYGUARD review " + name)
    if light is None:
        data = bpy.data.lights.new("BODYGUARD review " + name, "AREA")
        light = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(light)
    data = light.data
    light.location = location
    data.energy = energy
    data.size = 4
camera = scene.camera
camera.data.type = "ORTHO"
camera.data.ortho_scale = 2.8
camera.location = (0, -5, 0.84)
camera.rotation_euler = (Vector((0, 0, 0.84)) - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = str(output / "faceless-front.png")
bpy.ops.render.render(write_still=True)
camera.location = (2.4, -4.8, 0.84)
camera.rotation_euler = (Vector((0, 0, 0.84)) - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = str(output / "faceless-quarter.png")
bpy.ops.render.render(write_still=True)

scene.render.resolution_x = 900
scene.render.resolution_y = 1000
camera.data.ortho_scale = 0.7
for label in ("Male", "Female"):
    obj = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    z = max(v.co.z for v in obj.data.vertices) - 0.2
    other_mesh = bpy.data.objects[f"BODYGUARD {'Female' if label == 'Male' else 'Male'} sculpt WIP"]
    other_mesh.hide_render = True
    camera.location = (obj.location.x + 4, 0, z)
    camera.rotation_euler = (Vector((obj.location.x, 0, z)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(output / f"faceless-side-{label.lower()}.png")
    bpy.ops.render.render(write_still=True)
    camera.location = (obj.location.x, -4, z)
    camera.rotation_euler = (Vector((obj.location.x, 0, z)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    for side, sign in (("left", 1), ("right", -1)):
        for name, angle in (("neck01", 4), ("neck02", 5), ("neck03", 5), ("head", 6)):
            pb = rig.pose.bones[name]
            # Bone-local Y runs along the bone. Convert the actual scene Y axis
            # into each rest frame so this test bends the neck instead of twisting it.
            axis = pb.bone.matrix_local.to_3x3().inverted() @ Vector((0, 1, 0))
            pb.rotation_quaternion = Quaternion(axis, radians(sign * angle))
        bpy.context.view_layer.update()
        delta = (rig.pose.bones["head"].matrix @ rig.data.bones["head"].matrix_local.inverted()).to_quaternion()
        assert abs(degrees(delta.angle) - 20) < 0.05
        assert abs(abs(delta.axis.y) - 1) < 0.01
        print("NECK QC", label, side, "rotation", round(degrees(delta.angle), 2), "axis", tuple(round(v, 3) for v in delta.axis))
        scene.render.filepath = str(output / f"faceless-neck-{label.lower()}-{side}.png")
        bpy.ops.render.render(write_still=True)
    for pb in rig.pose.bones:
        pb.rotation_quaternion = Quaternion()
    other_mesh.hide_render = False
