"""FR-A-02/03: read-only paired surface check with original edge membership locked.

Blender -b original.blend --python-exit-code 1 --python this.py
 -- next-same-topology.blend new-report.json
Artist-only mesh diagnostics, not clinical angles or a full quality approval.
"""

import json
import sys
from math import pi
from pathlib import Path

import bmesh
import bpy

candidate, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
if output.exists():
    raise FileExistsError("Preserve the previous paired diagnostic")
original = Path(bpy.data.filepath)
assert candidate.is_file() and candidate.resolve() != original.resolve()
snapshots = {}
for label in ("Male", "Female"):
    body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.edges.ensure_lookup_table()
    bm.edges.index_update()
    bm.normal_update()
    height = max(v.co.z for v in bm.verts)
    deform = bm.verts.layers.deform.active
    arm = {
        g.index
        for g in body.vertex_groups
        if g.name.startswith(("lowerarm", "wrist", "finger", "metacarpal"))
    }
    transform = body.matrix_world.inverted() @ rig.matrix_world
    regions = {}
    for region in ("neck", "wrist.L", "wrist.R"):
        if region == "neck":
            selected = [
                e
                for e in bm.edges
                if e.is_manifold
                and all(
                    abs(v.co.x / height) < 0.08 and 0.83 < v.co.z / height < 0.90 for v in e.verts
                )
            ]
        else:
            bone = rig.data.bones[region]
            center = transform @ bone.head_local
            direction = (transform.to_3x3() @ (bone.tail_local - bone.head_local)).normalized()
            selected = [
                e
                for e in bm.edges
                if e.is_manifold
                and all(
                    (v.co - center).length < 0.13
                    and -0.080001 <= (v.co - center).dot(direction) <= 0.009001
                    and sum(v[deform].get(i, 0) for i in arm) > 0.25
                    for v in e.verts
                )
            ]
        # Lock both membership AND the original long-edge classification.
        long = [e for e in selected if e.calc_length() > 0.001]
        regions[region] = {
            "selected_edges": len(selected),
            "long_indices": [e.index for e in long],
            "before_long": sum(e.calc_face_angle() > pi / 2 for e in long),
        }
    snapshots[label] = {
        "edges": [tuple(e.vertices) for e in body.data.edges],
        "faces": [tuple(f.vertices) for f in body.data.polygons],
        "regions": regions,
    }
    bm.free()
bpy.ops.wm.open_mainfile(filepath=str(candidate))
rows = []
for label, data in snapshots.items():
    body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    assert data["edges"] == [tuple(e.vertices) for e in body.data.edges]
    assert data["faces"] == [tuple(f.vertices) for f in body.data.polygons], (
        "Topology changed; corresponding original edge IDs are not valid"
    )
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.edges.ensure_lookup_table()
    bm.normal_update()
    for region, prior in data["regions"].items():
        long = [bm.edges[i] for i in prior["long_indices"]]
        rows.append(
            {
                "body": label,
                "region": region,
                "original_edges": prior["selected_edges"],
                "original_long_edges": len(long),
                "edge_membership_and_original_length_class_locked": True,
                "before_long": prior["before_long"],
                "after_long": sum(e.calc_face_angle() > pi / 2 for e in long),
            }
        )
    bm.free()
report = {
    "source": original.name,
    "compared_source": candidate.name,
    "full_qa": False,
    "checks": rows,
}
output.write_text(json.dumps(report, indent=2) + "\n")
print("PAIRED ORIGINAL EDGE CHECK", json.dumps(report))
