"""FR-A-03: read-only asset diagnosis; not clinical motion or full QA approval.

Blender -b explicit.blend --python-exit-code 1 --python diagnose_web_skin.py
  -- new-report.json [--triangulate]
Triangulation is temporary, without saving the loaded artist source.
"""

import json
import sys
from math import radians
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Quaternion, Vector

args = sys.argv[sys.argv.index("--") + 1 :]
if len(args) not in {1, 2} or (len(args) == 2 and args[1] != "--triangulate"):
    raise ValueError("Expected a new report path and optional --triangulate")
output = Path(args[0])
if output.exists():
    raise FileExistsError("Keep previous diagnostic evidence")
results = []
for label in ("Male", "Female"):
    body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    if "--triangulate" in args:
        bm = bmesh.new()
        bm.from_mesh(body.data)
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        bm.to_mesh(body.data)
        bm.free()
        body.data.update()
    rest = np.array([tuple(v.co) for v in body.data.vertices])
    edges = np.array([tuple(e.vertices) for e in body.data.edges])
    lengths = np.linalg.norm(rest[edges[:, 0]] - rest[edges[:, 1]], axis=1)
    edges, lengths = edges[lengths > 0.001], lengths[lengths > 0.001]
    for name, axis, angle in (
        ("upperarm01", (0, 1, 0), -60),
        ("metacarpal1", (1, 0, 0), -20),
    ):
        for side in ("L", "R"):
            for bone in rig.pose.bones:
                bone.rotation_mode = "QUATERNION"
                bone.rotation_quaternion = Quaternion()
            bone = rig.pose.bones[f"{name}.{side}"]
            local = bone.bone.matrix_local.to_3x3().inverted() @ Vector(axis)
            sign = -1 if side == "R" and axis[1] else 1
            bone.rotation_quaternion = Quaternion(local, radians(angle * sign))
            bpy.context.view_layer.update()
            mesh = body.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
            assert len(mesh.vertices) == len(rest), "Diagnosis requires stable topology"
            posed = np.array([tuple(v.co) for v in mesh.vertices])
            assert np.isfinite(posed).all()
            ratios = (
                np.linalg.norm(posed[edges[:, 0]] - posed[edges[:, 1]], axis=1)
                / lengths
            )
            worst = []
            for index in np.argsort(ratios)[-8:][::-1]:
                endpoints = []
                for vertex in edges[index]:
                    v = body.data.vertices[int(vertex)]
                    endpoints.append(
                        {
                            "vertex": int(vertex),
                            "asset_rest_m": list(v.co),
                            "weights": {
                                body.vertex_groups[g.group].name: g.weight
                                for g in v.groups
                                if g.weight > 0
                            },
                        }
                    )
                worst.append({"ratio": float(ratios[index]), "endpoints": endpoints})
            result = {
                "pose": f"{label}/{name}/{side}",
                "edge_ratio_max": float(np.max(ratios)),
                "vertices": len(rest),
                "maximum_influences": max(
                    sum(g.weight > 0 for g in v.groups) for v in body.data.vertices
                ),
                "worst": worst,
            }
            results.append(result)
            print("SKIN DIAGNOSIS", result["pose"], result["edge_ratio_max"])
    for bone in rig.pose.bones:
        bone.rotation_quaternion = Quaternion()
output.write_text(
    json.dumps(
        {
            "source": Path(bpy.data.filepath).name,
            "triangulated_for_diagnosis": "--triangulate" in args,
            "full_qa": False,
            "checks": results,
        },
        indent=2,
    )
    + "\n"
)
