"""FR-A-01/03: reopen the generated editable native file; no source writes/rendering."""

import json
import math
import re
import sys
from pathlib import Path

import bpy

scratch = sys.argv[sys.argv.index("--") + 1]
assert re.fullmatch(r"/private/tmp/bodyguard-motion-media\.[A-Za-z0-9]+", scratch)
reports = []
for gender in ("male", "female"):
    rig = bpy.data.objects[f"BODYGUARD {gender.title()} rig WIP"]
    mesh = bpy.data.objects[f"BODYGUARD {gender.title()} sculpt WIP"]
    for motion, peak, end, bone in (
        ("neck-side", 40, 144, "head"),
        ("shoulder-shrug", 36, 72, "clavicle.L"),
        ("arm-overhead", 44, 144, "upperarm01.L"),
    ):
        action = bpy.data.actions[f"bodyguard-preview-{gender}-{motion}"]
        assert action.use_fake_user and len(action.slots) == 1
        rig.animation_data.action = action
        rig.animation_data.action_slot = action.slots[0]
        poses = []
        for frame in (1, peak, end):
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            poses.append(rig.pose.bones[bone].rotation_quaternion.copy())
            evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
            assert len(evaluated.data.vertices) > 0
            assert all(math.isfinite(value) for corner in evaluated.bound_box for value in corner)
        moved = poses[0].rotation_difference(poses[1]).angle
        returned = poses[0].rotation_difference(poses[2]).angle
        assert moved > 0.001 and returned < 0.001
        reports.append({"gender": gender, "motion": motion, "reopened": True, "changed": True, "returned": True, "finiteDeformedBounds": True})
assert len(reports) == 6
target = Path(scratch) / "native-reopen.json"
assert not target.exists()
target.write_text(json.dumps({"blender": bpy.app.version_string, "sourceSaved": False, "actualPeople": False, "reports": reports}, indent=2))
print("BODYGUARD_NATIVE_MEDIA_CHECK " + json.dumps({"reports": reports}))
