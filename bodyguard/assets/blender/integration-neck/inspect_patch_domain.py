"""FR-A-02/08: read original projected patch domain; never author/save a model."""

import hashlib
import json
import sys
from collections import Counter
from pathlib import Path
from statistics import median

import bmesh
import bpy

source = Path(bpy.data.filepath)
expected = "ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b"
sha = lambda: hashlib.sha256(source.read_bytes()).hexdigest()
output = Path(sys.argv[sys.argv.index("--") + 1])
assert not output.exists() and sha() == expected
assert bpy.app.version_string == "5.1.1"
rows = []
for gender in ("Male", "Female"):
    body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.index_update()
        height = max(v.co.z for v in mesh.verts)
        transform = body.matrix_world.inverted() @ rig.matrix_world
        low = (transform @ rig.data.bones["neck02"].tail_local).z / height
        chosen = {
            f
            for f in mesh.faces
            if all(
                v.co.y > 0
                and abs(v.co.x) / height < 0.1
                and low < v.co.z / height < 0.94
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
        xmin, xmax = min(v.co.x for v in ordered), max(v.co.x for v in ordered)
        zmin, zmax = min(v.co.z for v in ordered), max(v.co.z for v in ordered)
        corners = [
            min(
                ordered,
                key=lambda v, x=x, z=z: (
                    ((v.co.x - x) / (xmax - xmin)) ** 2
                    + ((v.co.z - z) / (zmax - zmin)) ** 2
                ),
            )
            for x, z in ((xmin, zmin), (xmin, zmax), (xmax, zmax), (xmax, zmin))
        ]
        assert len(set(corners)) == 4
        offset = ordered.index(corners[0])
        ordered = ordered[offset:] + ordered[:offset]
        cuts = [ordered.index(v) for v in corners] + [len(ordered)]
        assert cuts == sorted(cuts)
        intervals = [cuts[i + 1] - cuts[i] for i in range(4)]
        margin = min(
            0.002,
            2
            * median(
                (ordered[(i + 1) % len(ordered)].co - v.co).length
                for i, v in enumerate(ordered)
            ),
        )
        bottom = ordered[cuts[3] :] + [ordered[0]]
        top = ordered[cuts[1] : cuts[2] + 1]
        band_low = max(v.co.z for v in bottom) + margin
        band_high = min(v.co.z for v in top) - margin
        assert band_low < band_high
        count = min(intervals[0], intervals[2])
        polygon = [(v.co.x, v.co.z) for v in ordered]

        def inspect_band(lower, upper, count=count, polygon=polygon):
            result = []
            for row in range(count + 1):
                z = lower + (upper - lower) * row / count
                cross = sorted(
                    ax + (bx - ax) * (z - az) / (bz - az)
                    for i, (ax, az) in enumerate(polygon)
                    for bx, bz in [polygon[(i + 1) % len(polygon)]]
                    if (az > z) != (bz > z)
                )
                assert len(cross) % 2 == 0
                pairs = list(zip(cross[::2], cross[1::2]))
                central = [pair for pair in pairs if pair[0] < 0 < pair[1]]
                result.append(
                    {
                        "row": row,
                        "z_m": z,
                        "intervals_m": pairs,
                        "unique_central_interval": len(central) == 1,
                    }
                )
            return result

        old_rows = inspect_band(zmin + margin, zmax - margin)
        band_rows = inspect_band(band_low, band_high)
        rows.append(
            {
                "gender": gender,
                "outer_boundary_points": len(ordered),
                "original_side_intervals": intervals,
                "corners_xyz_m": [list(v.co) for v in corners],
                "old_z_bounds_m": [zmin + margin, zmax - margin],
                "bottom_top_clear_band_m": [band_low, band_high],
                "old_rows": old_rows,
                "clear_band_rows": band_rows,
                "old_rows_missing_central_interior": sum(
                    not row["unique_central_interval"] for row in old_rows
                ),
                "clear_band_rows_missing_central_interior": sum(
                    not row["unique_central_interval"] for row in band_rows
                ),
            }
        )
    finally:
        mesh.free()
assert sha() == expected
output.write_text(
    json.dumps(
        {
            "input_sha256": expected,
            "blender": bpy.app.version_string,
            "read_only_scene": True,
            "model_authored_or_saved": False,
            "appearance_approved": False,
            "clinical_or_camera_data": False,
            "rows": rows,
        },
        indent=2,
    ),
    encoding="utf-8",
)
