"""FR-S-03/04, FR-A-01/02: author test-only keyframes in memory.

Run Blender --background preserved-a37.blend --python this-script.
Output is local bone basis samples, not approved correct-stretch data.
Never save or overwrite a .blend/GLB.
"""

import json

import bpy
from mathutils import Quaternion, Vector

reports = []
for gender in ("Male", "Female"):
    rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
    rig.animation_data_clear()
    rig.animation_data_create()
    # These are demonstration amplitudes only, not clinical target angles.
    targets = {
        "neck01": 0.06,
        "neck02": 0.06,
        "head": 0.12,
        "upperarm01.L": 0.55,
        "lowerarm01.L": 0.55,
        "wrist.L": 0.15,
        "finger2-1.L": 0.12,
    }
    missing = [name for name in targets if name not in rig.pose.bones]
    assert not missing, f"Authored fixture bone missing: {missing}"
    phases = {}
    for phase, values in (
        ("waiting-start", (0.0, 0.0)),
        ("seeking-target", (0.0, 1.0)),
        ("holding", (1.0, 1.0)),
        ("waiting-return", (1.0, 0.0)),
    ):
        rig.animation_data.action = None
        for bone in rig.pose.bones:
            bone.rotation_mode = "QUATERNION"
            bone.rotation_quaternion = Quaternion()
        for frame, factor in ((1, values[0]), (25, values[1])):
            for name, angle in targets.items():
                bone = rig.pose.bones[name]
                bone.rotation_quaternion = Quaternion(Vector((0, 0, 1)), angle * factor)
                bone.keyframe_insert(
                    data_path="rotation_quaternion",
                    frame=frame,
                    group="fixture-not-release",
                )
        action = rig.animation_data.action
        action.name = f"fixture-not-release-{gender}-{phase}"
        samples = []
        for frame in (1, 7, 13, 19, 25):
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            samples.append(
                {
                    "seconds": (frame - 1) / 24,
                    "bones": {
                        name: [
                            bone.rotation_quaternion.x,
                            bone.rotation_quaternion.y,
                            bone.rotation_quaternion.z,
                            bone.rotation_quaternion.w,
                        ]
                        for name in targets
                        for bone in [rig.pose.bones[name]]
                    },
                }
            )
        phases[phase] = samples
    reports.append({"gender": gender.lower(), "phases": phases})
print(
    "BODYGUARD_REFERENCE_FIXTURE "
    + json.dumps(
        {
            "blender": bpy.app.version_string,
            "fixture_not_release": True,
            "source_saved": False,
            "glb_exported": False,
            "reports": reports,
        }
    )
)
