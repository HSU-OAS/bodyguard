"""Read-only native topology inspection; generated model coordinates, not users."""

import json
import math
import sys
from collections import Counter
from pathlib import Path

import bmesh
import bpy

rows = []
for gender in ("Male", "Female"):
    body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
    mesh = bmesh.new()
    mesh.from_mesh(body.data)
    mesh.verts.ensure_lookup_table()
    mesh.normal_update()
    height = max(v.co.z for v in mesh.verts)
    selected = [
        v for v in mesh.verts
        if v.co.y > 0 and 0.82 < v.co.z / height < 0.94
        and abs(v.co.x) / height < 0.1
    ]
    selected_ids = {v.index for v in selected}
    edges = [e for e in mesh.edges if all(v.index in selected_ids for v in e.verts)]
    faces = [f for f in mesh.faces if all(v.index in selected_ids for v in f.verts)]
    bins = []
    for i in range(12):
        lower = 0.82 + i * 0.01
        verts = [v for v in selected if lower <= v.co.z / height < lower + 0.01]
        bins.append({
            "z_fraction": round(lower, 2), "vertices": len(verts),
            "valence": dict(Counter(len(v.link_edges) for v in verts)),
            "sharp_edges_degrees": max((math.degrees(e.calc_face_angle(0)) for v in verts for e in v.link_edges), default=0),
        })
    top_edges = sorted(edges, key=lambda e: e.calc_face_angle(0), reverse=True)[:12]
    rows.append({
        "gender": gender, "height": height,
        "attributes": [(a.name, a.domain, a.data_type) for a in body.data.attributes],
        "properties": [(k, str(body[k])[:200]) for k in body.keys()],
        "polygons": dict(Counter(len(f.verts) for f in faces)),
        "valence": dict(Counter(len(v.link_edges) for v in selected)),
        "bins": bins,
        "sharpest": [{"degrees": math.degrees(e.calc_face_angle(0)),
                      "length": e.calc_length(),
                      "vertices": [v.index for v in e.verts],
                      "normalized": [list(v.co / height) for v in e.verts]}
                     for e in top_edges],
        "custom_normals": body.data.has_custom_normals,
    })
    mesh.free()
target = Path(sys.argv[sys.argv.index("--") + 1])
assert not target.exists()
target.write_text(json.dumps(rows, indent=2), encoding="utf-8")
print(json.dumps(rows, indent=2))
