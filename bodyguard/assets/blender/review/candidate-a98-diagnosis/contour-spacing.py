"""FR-A-02/03: read-only wrist contour spacing; no candidate save or approval."""

import hashlib
import json
import statistics
import sys
from collections import Counter
from pathlib import Path

import bmesh
import bpy
from mathutils.kdtree import KDTree

output = Path(sys.argv[sys.argv.index("--") + 1])
source = Path(bpy.data.filepath)
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
assert source_hash == "8a2bcf7d74f10d084fd5551a9470a076c003de7ef7dfcb9a7348607cbd3e3618"
assert not output.exists()
rows = []


def distribution(values):
    values = sorted(values)
    assert values and all(x >= 0 for x in values)
    return {
        "count": len(values),
        "min_m": values[0],
        "median_m": statistics.median(values),
        "p95_m": values[int((len(values) - 1) * 0.95)],
        "max_m": values[-1],
        "under_10um": sum(x < 1e-5 for x in values),
        "under_100um": sum(x < 1e-4 for x in values),
        "under_500um": sum(x < 5e-4 for x in values),
    }


for label in ("Male", "Female"):
    body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    transform = body.matrix_world.inverted() @ rig.matrix_world
    groups = {
        g.index for g in body.vertex_groups if g.name.startswith(("lowerarm", "wrist"))
    }
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    bm.verts.index_update()
    skin = bm.verts.layers.deform.active
    protected = set(body["bodyguard_distal_hand_vertices"])
    for side in ("L", "R"):
        bone = rig.data.bones[f"wrist.{side}"]
        center = transform @ bone.head_local
        direction = (
            transform.to_3x3() @ (bone.tail_local - bone.head_local)
        ).normalized()
        for offset in (-0.08, 0.009):
            ring = {
                v
                for v in bm.verts
                if (v.co - center).length < 0.13
                and abs((v.co - center).dot(direction) - offset) < 1e-6
                and sum(v[skin].get(i, 0) for i in groups) > 0.25
            }
            assert len(ring) > 2
            edges = [e for e in bm.edges if all(v in ring for v in e.verts)]
            tree = KDTree(len(ring))
            for v in ring:
                tree.insert(v.co, v.index)
            tree.balance()
            nearest = [
                min(d for _, index, d in tree.find_n(v.co, 2) if index != v.index)
                for v in ring
            ]
            components = 0
            remaining = set(ring)
            while remaining:
                components += 1
                todo = [remaining.pop()]
                while todo:
                    vertex = todo.pop()
                    for edge in vertex.link_edges:
                        neighbor = edge.other_vert(vertex)
                        if neighbor in remaining:
                            remaining.remove(neighbor)
                            todo.append(neighbor)
            rows.append(
                {
                    "body": label,
                    "side": side,
                    "offset_m": offset,
                    "ring_vertices": len(ring),
                    "ring_components": components,
                    "protected_hand_vertices": sum(v.index in protected for v in ring),
                    "ring_edge_lengths": distribution([e.calc_length() for e in edges]),
                    "nearest_point_distances": distribution(nearest),
                    "ring_degree_counts": dict(
                        Counter(sum(e in edges for e in v.link_edges) for v in ring)
                    ),
                }
            )
    bm.free()
assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
output.write_text(
    json.dumps(
        {
            "source_sha256": source_hash,
            "rows": rows,
            "assets_changed": False,
            "appearance_approved": False,
            "causal_browser_comparison_run": False,
        },
        indent=2,
    )
    + "\n"
)
print(json.dumps(rows))
