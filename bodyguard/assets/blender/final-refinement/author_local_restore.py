"""FR-A-02/03/08: bounded restorative editing of an existing professional mesh.

Restore the actual folded core to its artist-authored position. Transport only
that displacement through its local connected neighbours with a convex field;
never generate anatomy or change skin, topology, rig or protected front.
"""

import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lateral_contract import compare, quality, state
from lateral_domain import domain

source = Path(bpy.data.filepath)
origin, target, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


input_sha, origin_sha = sha(source), sha(origin)
assert input_sha == "be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068"
assert origin_sha == "2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff"
assert not target.exists() and not output.exists()
assert len({p.resolve() for p in (source, origin, target, output)}) == 4
report = {
    "method": "professional_core_restore_convex_local_transport",
    "passed": False,
    "appearance_approved": False,
    "rows": [],
    "input_sha256": input_sha,
    "professional_origin_sha256": origin_sha,
}


def objects(gender):
    return (
        bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"],
        bpy.data.objects[f"BODYGUARD {gender} rig WIP"],
    )


def selection(body, rig):
    bounds = domain(body, rig)
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.index_update()
        mesh.normal_update()
        selected_faces = {
            f for f in mesh.faces if all(v.index in bounds["selected"] for v in f.verts)
        }
        folds = {
            e
            for f in selected_faces
            for e in f.edges
            if e.is_manifold and math.degrees(e.calc_face_angle()) > 90
        }
        core = {v.index for e in folds for f in e.link_faces for v in f.verts}
        neighbours = {v.index: {e.other_vert(v).index for e in v.link_edges} for v in mesh.verts}
    finally:
        mesh.free()
    assert core and not core.intersection(bounds["front"])
    ids = [v.value for v in body.data.attributes["a239_source_point_id"].data]
    assert all(ids[i] >= 0 for i in core)
    # Six connected edge rings are a fixed authoring domain, not a pose threshold.
    region = set(core)
    for _ in range(6):
        region |= {
            i
            for old in region
            for i in neighbours[old]
            if i not in bounds["front"] and body.data.vertices[i].co.y > 0
        }
    border = {i for i in region if not neighbours[i].issubset(region)}
    assert not border.intersection(core), "Core reaches protected surface"
    return {
        "core": core,
        "region": region,
        "border": border,
        "neighbours": neighbours,
        "ids": ids,
        "front": bounds["front"],
    }


try:
    specs = {gender: selection(*objects(gender)) for gender in ("Male", "Female")}
    requests = {
        gender: {specs[gender]["ids"][i] for i in specs[gender]["core"]} for gender in specs
    }
    bpy.ops.wm.open_mainfile(filepath=str(origin), load_ui=False, use_scripts=False)
    originals = {}
    for gender, wanted in requests.items():
        body, _ = objects(gender)
        mapped = {}
        for vertex, identifier in zip(
            body.data.vertices, body.data.attributes["a239_source_point_id"].data, strict=True
        ):
            if identifier.value in wanted:
                assert identifier.value not in mapped
                mapped[identifier.value] = tuple(vertex.co)
        assert set(mapped) == wanted
        originals[gender] = mapped
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    for gender, spec in specs.items():
        body, rig = objects(gender)
        before = state(body, rig)
        baseline = quality(body, spec["region"])
        old = {i: Vector(before["points"][i]) for i in spec["region"]}
        targets = {i: Vector(originals[gender][spec["ids"][i]]) for i in spec["core"]}
        displacements = {
            i: targets[i] - old[i] if i in targets else Vector() for i in spec["region"]
        }
        anchor_bound = max(value.length for value in displacements.values())
        assert 0 < anchor_bound < 0.006
        interior = spec["region"] - spec["border"] - spec["core"]
        # Positive convex averaging cannot reproduce the unbounded native solver failure.
        for step in range(240):
            updated = {
                i: sum((displacements[j] for j in spec["neighbours"][i]), Vector())
                / len(spec["neighbours"][i])
                for i in interior
            }
            difference = max(((updated[i] - displacements[i]).length for i in interior), default=0)
            displacements.update(updated)
            if difference < 1e-8:
                break
        for i in spec["region"] - spec["border"]:
            value = displacements[i]
            assert all(math.isfinite(c) for c in value) and value.length <= anchor_bound + 1e-8
            body.data.vertices[i].co = targets[i] if i in targets else old[i] + value
        body.data.update()
        row = {
            "gender": gender,
            "core_points": len(spec["core"]),
            "region_points": len(spec["region"]),
            "protected_border_points": len(spec["border"]),
            "convex_iterations": step + 1,
            "maximum_anchor_displacement_m": anchor_bound,
            "before": baseline,
            "after": quality(body, spec["region"]),
        }
        report["rows"].append(row)
        row.update(compare(before, state(body, rig), spec["region"] - spec["border"]))
        assert all(tuple(body.data.vertices[i].co) == before["points"][i] for i in spec["front"])
        assert row["after"]["nonmanifold"] == 0 and row["after"]["winding"] == 0
        assert row["after"]["tiny_faces"] <= row["before"]["tiny_faces"]
        assert row["after"]["selected_dihedral_above_90"] == 0, "Local folded surface remains"
        assert (
            abs(
                row["after"]["whole_professional_mesh_volume_m3"]
                - row["before"]["whole_professional_mesh_volume_m3"]
            )
            < 0.0001
        )
    assert sha(source) == input_sha and sha(origin) == origin_sha
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True, check_existing=True)
    report.update(passed=True, candidate_sha256=sha(target))
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    report["two_input_files_unchanged"] = sha(source) == input_sha and sha(origin) == origin_sha
    report["candidate_present"] = target.exists()
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
