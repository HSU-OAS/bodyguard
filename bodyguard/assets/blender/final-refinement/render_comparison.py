"""FR-A-02/08: fixed-condition actual native previews, not an image mock-up."""

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

output = Path(sys.argv[sys.argv.index("--") + 1])
assert not output.exists(), "Preserve earlier previews"
output.mkdir(parents=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 600
scene.render.resolution_y = 700
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
camera = scene.camera
assert camera is not None
camera.data.type = "ORTHO"
rows = []
for label in ("Male", "Female"):
    for obj in scene.objects:
        if obj.type == "MESH" and obj.name.startswith("BODYGUARD "):
            obj.hide_render = not obj.name.startswith(f"BODYGUARD {label} ")
    body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    x = body.matrix_world.translation.x
    height = max(v.co.z for v in body.data.vertices)
    z = height * 0.895
    for name, location in (
        ("back", (x, 3, z)),
        ("side", (x + 3, 0, z)),
        ("quarter", (x + 2, -3, z)),
        ("front", (x, -3, z)),
    ):
        camera.data.ortho_scale = 0.65
        camera.location = location
        target = Vector((x, 0, z))
        camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
        name = f"{label.lower()}-{name}.png"
        scene.render.filepath = str(output / name)
        bpy.ops.render.render(write_still=True)
        rows.append(name)
(output / "render.json").write_text(
    json.dumps(
        {
            "blender": bpy.app.version_string,
            "samples": 32,
            "views": rows,
            "same_source_material_world_lights": True,
            "appearance_approved": False,
        },
        indent=2,
    ),
    encoding="utf-8",
)
