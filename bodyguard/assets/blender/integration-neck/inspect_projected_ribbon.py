"""FR-A-02/03/08: read-only section/ribbon geometry; no source save or clinical data."""

import hashlib
import json
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

INPUT_SHA = "ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b"
CANDIDATE_SHA = "2932e63d0d9f7565ae2b9835377d941af2ffe894f8036037479fb2c3fcc1e394"
ORIGIN = "integration sectioned original occipital"
args = sys.argv[sys.argv.index("--") + 1 :]
assert len(args) == 2
source, output = map(Path, args)
candidate = Path(bpy.data.filepath)
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
assert not output.exists() and output.resolve() not in (
    source.resolve(),
    candidate.resolve(),
)
assert sha(source) == INPUT_SHA and sha(candidate) == CANDIDATE_SHA
assert bpy.app.version_string == "5.1.1"
samples = {}
rows = []


def inspect(body, points):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.normal_update()
        tree = BVHTree.FromBMesh(mesh)
        counts = []
        for x, z in points:
            start = Vector((x, 1, z))
            hits = 0
            for _ in range(16):
                position, _, _, _ = tree.ray_cast(start, Vector((0, -1, 0)), 2)
                if position is None or position.y <= 0:
                    break
                hits += 1
                start = position - Vector((0, 1e-6, 0))
            else:
                raise AssertionError("Rear intersection count exceeded inspection cap")
            counts.append(hits)
        layer = mesh.verts.layers.int.get(ORIGIN)
        result = {
            "rear_hit_counts": counts,
            "samples": len(points),
            "single_rear_hits": sum(n == 1 for n in counts),
            "multiple_rear_hits": sum(n > 1 for n in counts),
            "maximum_rear_hits": max(counts),
        }
        if layer is not None:
            ribbon = [
                f
                for f in mesh.faces
                if any(v[layer] >= 0 for v in f.verts)
                and any(v[layer] < 0 for v in f.verts)
            ]
            result.update(
                {
                    "ribbon_faces": len(ribbon),
                    "ribbon_negative_y_normal_faces": sum(
                        f.normal.y < 0 for f in ribbon
                    ),
                    "ribbon_tiny_faces": sum(f.calc_area() < 1e-10 for f in ribbon),
                }
            )
        return result
    finally:
        mesh.free()


for gender in ("Male", "Female"):
    body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
    ids = [item.value for item in body.data.attributes[ORIGIN].data]
    new_points = [v.co for v in body.data.vertices if ids[v.index] < 0]
    low, high = min(v.z for v in new_points), max(v.z for v in new_points)
    width = (
        min(abs(min(v.x for v in new_points)), abs(max(v.x for v in new_points))) * 0.8
    )
    # Professional asset probes: original and candidate use identical local X/Z.
    samples[gender] = [
        (width * (column / 16 - 1), z + 0.00025 * step)
        for z in (low, high)
        for step in range(-16, 17)
        for column in range(33)
    ]
    rows.append({"gender": gender, "candidate": inspect(body, samples[gender])})
bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
for row in rows:
    body = bpy.data.objects[f"BODYGUARD {row['gender']} sculpt WIP"]
    row["original"] = inspect(body, samples[row["gender"]])
    assert row["candidate"]["ribbon_negative_y_normal_faces"] == 0
    assert row["candidate"]["ribbon_tiny_faces"] == 0
    assert all(
        new <= max(1, old)
        for new, old in zip(
            row["candidate"]["rear_hit_counts"], row["original"]["rear_hit_counts"]
        )
    ), "Saved candidate adds a rear surface intersection"
assert sha(source) == INPUT_SHA and sha(candidate) == CANDIDATE_SHA
output.write_text(
    json.dumps(
        {
            "blender": bpy.app.version_string,
            "input_sha256": INPUT_SHA,
            "candidate_sha256": CANDIDATE_SHA,
            "read_only_scene": True,
            "inspection_passed": True,
            "mixed_origin_ribbon_subset_only": True,
            "source_saved_or_modified": False,
            "appearance_approved": False,
            "clinical_or_camera_data": False,
            "rows": rows,
        },
        indent=2,
    ),
    encoding="utf-8",
)
