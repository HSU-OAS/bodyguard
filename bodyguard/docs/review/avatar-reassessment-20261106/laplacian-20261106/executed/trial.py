"""FR-A-02/03/08: fair a duplicate professional surface; project only the join.

The native uniform target is never exported. Preserve the actual source front,
body, topology, raw skin and rig; a technical pass is not appearance approval.
"""

import hashlib
import heapq
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lateral_contract import compare, quality, state
from surface_visibility import read

source = Path(bpy.data.filepath)
target, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
assert source_sha == "71c369c96667549d00a4e77ff5d0b301ce307d806d5f3b42e739f48b4b7a8a2d"
assert not target.exists() and not output.exists(), "Never overwrite earlier evidence"
assert len({p.resolve() for p in (source, target, output)}) == 3
report = {
    "blender": bpy.app.version_string,
    "source_sha256": source_sha,
    "method": "native_weighted_laplacian_trial",
    "passed": False,
    "appearance_approved": False,
    "rows": [],
}


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def taper(value, start, end):
    t = max(0.0, min(1.0, (value - start) / (end - start)))
    return t * t * (3 - 2 * t)


try:
    for gender in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
        before = state(body, rig)
        transform = body.matrix_world.inverted() @ rig.matrix_world
        # MPFB spine05 is near the pelvis, not the upper shoulder.
        shoulder = min(
            (transform @ rig.data.bones[f"upperarm01.{s}"].head_local).z for s in ("L", "R")
        )
        low = shoulder - 0.06
        high = (transform @ rig.data.bones["head"].head_local).z + 0.01
        shoulder_width = max(
            abs((transform @ rig.data.bones[f"upperarm01.{s}"].head_local).x) for s in ("L", "R")
        )
        width = shoulder_width + 0.02
        upper_taper = (transform @ rig.data.bones["neck03"].head_local).z
        assert low < shoulder < upper_taper < high and 0 < shoulder_width < width
        anterior = read(body)["anterior"]
        front = {i for face in body.data.polygons if face.index in anterior for i in face.vertices}
        group = body.vertex_groups.new(name="temporary uniform join projection")
        group_name = group.name
        selected = set()
        for vertex in body.data.vertices:
            x, y, z = vertex.co
            if vertex.index in front or y <= 0 or not low < z < high or abs(x) >= width:
                continue
            weight = (
                taper(z, low, shoulder)
                * (1 - taper(z, upper_taper, high))
                * (1 - taper(abs(x), shoulder_width, width))
            )
            group.add([vertex.index], weight, "REPLACE")
            selected.add(vertex.index)
        assert selected and not selected.intersection(front)
        row = {
            "gender": gender,
            "domain_m": {"low": low, "shoulder": shoulder, "high": high, "width": width},
            "before": quality(body, selected),
        }
        report["rows"].append(row)
        # A native projection needs a continuous transition to every protected
        # neighbour, including the front-facing boundary, not just box edges.
        neighbours = {index: [] for index in selected}
        distances = {index: math.inf for index in selected}
        for edge in body.data.edges:
            a, b = edge.vertices
            length = (body.data.vertices[a].co - body.data.vertices[b].co).length
            if a in selected and b in selected:
                neighbours[a].append((b, length))
                neighbours[b].append((a, length))
            elif a in selected:
                distances[a] = min(distances[a], length)
            elif b in selected:
                distances[b] = min(distances[b], length)
        queue = [(distance, index) for index, distance in distances.items() if distance < 0.015]
        heapq.heapify(queue)
        while queue:
            distance, index = heapq.heappop(queue)
            if distance != distances[index]:
                continue
            for neighbour, length in neighbours[index]:
                proposed = distance + length
                if proposed < 0.015 and proposed < distances[neighbour]:
                    distances[neighbour] = proposed
                    heapq.heappush(queue, (proposed, neighbour))
        for index in selected:
            group.add([index], group.weight(index) * taper(distances[index], 0, 0.015), "REPLACE")
        row["protected_surface_transition_m"] = 0.015
        activate(body)
        modifier = body.modifiers.new("local curvature fairing trial", "LAPLACIANSMOOTH")
        modifier.vertex_group = group_name
        modifier.lambda_factor = 0.1
        modifier.iterations = 2
        modifier.use_volume_preserve = True
        while body.modifiers.find(modifier.name) > 0:
            bpy.ops.object.modifier_move_up(modifier=modifier.name)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        body.vertex_groups.remove(body.vertex_groups[group_name])
        body.data.update()
        after = state(body, rig)
        row.update(compare(before, after, selected))
        assert all(before["points"][i] == after["points"][i] for i in front)
        row["after"] = quality(body, selected)
        assert row["after"]["selected_dihedral_above_90"] == 0, "Projection introduced a fold"
        assert row["after"]["nonmanifold"] == 0 and row["after"]["winding"] == 0
        assert row["after"]["tiny_faces"] <= row["before"]["tiny_faces"]
        row["front_exact_and_no_exported_target"] = True
        assert row["maximum_displacement_m"] <= 0.002, "Trial exceeded 2 mm"
        assert row["after"]["selected_maximum_dihedral_degrees"] <= row["before"]["selected_maximum_dihedral_degrees"], "Trial increased maximum sharp edge"
        print("UNIFORM JOIN", gender, json.dumps(row), flush=True)
    assert hashlib.sha256(source.read_bytes()).hexdigest() == source_sha
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True, check_existing=True)
    report.update(passed=True, candidate_sha256=hashlib.sha256(target.read_bytes()).hexdigest())
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    report["source_unchanged"] = hashlib.sha256(source.read_bytes()).hexdigest() == source_sha
    report["candidate_present"] = target.exists()
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
