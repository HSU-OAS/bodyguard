"""Read preserved authored rest bones, never save or modify Blender assets."""
import json
import bpy

reports = []
for label in ("Male", "Female"):
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    bones = rig.data.bones
    entries = []
    for side in ("L", "R"):
        for name in [f"wrist.{side}", *[f"finger{digit}-{joint}.{side}" for digit in range(1, 6) for joint in range(1, 4)]]:
            bone = bones[name]
            local = bone.matrix_local.inverted().to_3x3() @ (bone.tail_local - bone.head_local)
            axis = local.normalized()
            assert (axis - __import__("mathutils").Vector((0, 1, 0))).length < 1e-5
            entries.append({"name": name, "parent": bone.parent.name, "local_tail_axis": list(axis), "length": bone.length})
    reports.append({"gender": label.lower(), "bones": entries})
print("BODYGUARD_AUTHORED_HANDS " + json.dumps({"blender": bpy.app.version_string, "read_only": True, "reports": reports}))
