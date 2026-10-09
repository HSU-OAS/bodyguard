"""FR-A-02/08: no-save diagnostic of failed native ribbon, not an adopted mesh."""

import hashlib
import json
import runpy
import sys
from collections import Counter
from pathlib import Path

import bmesh
import bpy

author, report_path, output, model, render = map(
    Path, sys.argv[sys.argv.index("--") + 1 :]
)
assert not output.exists() and not report_path.exists() and not model.exists()
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
source = Path(bpy.data.filepath)
assert bpy.app.version_string == "5.1.1"
assert sha(source) == "ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b"
assert sha(author) == "881d683ce656b3fe82b5eced957fa8017eda32f23b5602eedbf69c738623a6d4"
assert sha(render) == "80abd09c69f3edf9c17c39555a246ad1b6915da2799929fb66ee178e35f2d518"
body = bpy.data.objects["BODYGUARD Male sculpt WIP"]
rig = bpy.data.objects["BODYGUARD Male rig WIP"]
mesh = bmesh.new()
try:
    mesh.from_mesh(body.data)
    height = max(v.co.z for v in mesh.verts)
    transform = body.matrix_world.inverted() @ rig.matrix_world
    low = (transform @ rig.data.bones["neck02"].tail_local).z / height
    chosen = {
        f
        for f in mesh.faces
        if all(
            v.co.y > 0 and abs(v.co.x) / height < 0.1 and low < v.co.z / height < 0.94
            for v in f.verts
        )
    }
    for _ in range(8):
        borders = {
            e
            for f in chosen
            for e in f.edges
            if sum(other in chosen for other in e.link_faces) == 1
        }
        degrees = Counter(v for e in borders for v in e.verts)
        bad = {v for v, count in degrees.items() if count != 2}
        if not bad:
            break
        chosen -= {f for f in chosen if any(v in bad for v in f.verts)}
    else:
        raise AssertionError("Original boundary remains irregular")
    successor = {}
    for edge in borders:
        face = next(f for f in edge.link_faces if f in chosen)
        loop = next(loop for loop in face.loops if loop.edge == edge)
        successor[loop.vert] = loop.link_loop_next.vert
    start = next(iter(successor))
    ordered = [start]
    while successor[ordered[-1]] != start:
        assert successor[ordered[-1]] not in ordered
        ordered.append(successor[ordered[-1]])
    assert len(ordered) == len(borders)
    polygon = [(v.co.x, v.co.z) for v in ordered]
finally:
    mesh.free()


def inside(point):
    x, z = point.x, point.z
    crossing = 0
    for i, (ax, az) in enumerate(polygon):
        bx, bz = polygon[(i + 1) % len(polygon)]
        if (az > z) != (bz > z) and x < ax + (bx - ax) * (z - az) / (bz - az):
            crossing += 1
    return crossing % 2 == 1


sys.argv = [
    str(author),
    "--",
    str(model),
    str(report_path),
    "occipital",
    "ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b",
    "diagnostic",
]
failure = None
try:
    runpy.run_path(str(author), run_name="__main__")
except AssertionError as error:
    failure = error
assert failure is not None and not model.exists()
assert str(failure) == "New ribbon has an inward-facing projected face"
report = json.loads(report_path.read_text())
assert report["diagnostic_no_save"] and not report["passed"]
assert report["last_grid"]["geometry_diagnostic"]["diagnostic_flushed_to_memory_only"]
body = bpy.data.objects["BODYGUARD Male sculpt WIP"]
ids = [
    item.value
    for item in body.data.attributes["integration sectioned original occipital"].data
]
markers = [
    item.value
    for item in body.data.attributes["integration sectioned corner occipital"].data
]
new = [v for v in body.data.vertices if ids[v.index] < 0]
corners = [v for v in new if markers[v.index] != 0]
observations = {
    "failure": str(failure),
    "failed_gender": "Male",
    "original_outer_boundary_points": len(polygon),
    "new_points": len(new),
    "new_points_outside_original_xz_polygon": sum(not inside(v.co) for v in new),
    "inner_corners": [
        {
            "tag": markers[v.index],
            "xyz_m": list(v.co),
            "inside_original_xz_polygon": inside(v.co),
        }
        for v in corners
    ],
    "scene_saved": False,
    "appearance_approved": False,
    "female_unchanged_control": True,
}
output.write_text(json.dumps(observations, indent=2), encoding="utf-8")
sys.argv = [str(render), "--", str(output.parent / "render-failure")]
runpy.run_path(str(render), run_name="__main__")
assert not model.exists()
assert sha(source) == "ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b"
raise failure
