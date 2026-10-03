"""FR-A-02/03/07/08: retain authored anatomy, remove intersecting decorative loops.

Blender -b immutable-artist.blend --python-exit-code 1 --python this.py
 -- new-artist.blend removal-report.json
The original body/skin/rig/materials are never edited or restored after an edit.
Separate renders, complete deformation, GLB and browser QA remain mandatory.
"""

import hashlib
import json
import sys
from pathlib import Path

import bpy


def geometry_signature(obj):
    """Exact native values, including skin order, topology and world placement."""
    values = {
        "points": [tuple(v.co) for v in obj.data.vertices],
        "skin": [[(g.group, g.weight) for g in v.groups] for v in obj.data.vertices],
        "faces": [
            (tuple(p.vertices), p.material_index, p.use_smooth)
            for p in obj.data.polygons
        ],
        "groups": [g.name for g in obj.vertex_groups],
        "world": [tuple(row) for row in obj.matrix_world],
        "materials": [m.name for m in obj.data.materials],
        "modifiers": [(m.name, m.type) for m in obj.modifiers],
    }
    return hashlib.sha256(json.dumps(values).encode()).hexdigest()


def rig_signature(obj):
    values = {
        "rest": [
            (b.name, [tuple(row) for row in b.matrix_local]) for b in obj.data.bones
        ],
        "pose": [
            (b.name, b.rotation_mode, [tuple(row) for row in b.matrix_basis])
            for b in obj.pose.bones
        ],
        "world": [tuple(row) for row in obj.matrix_world],
    }
    return hashlib.sha256(json.dumps(values).encode()).hexdigest()


def remove_joint_overlays(scene):
    expected = {
        f"BODYGUARD {label} joint edge {name}.{side}"
        for label in ("Male", "Female")
        for name in ("lowerarm01", "lowerleg01")
        for side in ("L", "R")
    }
    overlays = [
        o
        for o in scene.objects
        if o.name.startswith("BODYGUARD ") and " joint edge " in o.name
    ]
    assert {o.name for o in overlays} == expected, "Unexpected decorative overlay set"
    bodies = [
        bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
        for label in ("Male", "Female")
    ]
    rigs = [
        bpy.data.objects[f"BODYGUARD {label} rig WIP"] for label in ("Male", "Female")
    ]
    assert all(len(r.data.bones) == 163 for r in rigs), "Incomplete authored rig"
    # Validate all targets before mutation. A malformed/unknown object is not deleted.
    for obj in overlays:
        label = obj.name.split()[1]
        assert obj.type == "MESH" and len(obj.data.vertices) == 512
        assert len(obj.modifiers) == 1 and obj.modifiers[0].type == "ARMATURE"
        assert obj.modifiers[0].object == bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    remaining = [o for o in scene.objects if o.type == "MESH" and o not in overlays]
    before = {o.name: geometry_signature(o) for o in remaining}
    rigs_before = {r.name: rig_signature(r) for r in rigs}
    removed = sorted(o.name for o in overlays)
    for obj in overlays:
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()
    assert before == {o.name: geometry_signature(o) for o in remaining}
    assert rigs_before == {r.name: rig_signature(r) for r in rigs}
    return {
        "removed_decorative_overlays": removed,
        "retained_mesh_signatures": before,
        "retained_rig_signatures": rigs_before,
        "body_vertices": {o.name: len(o.data.vertices) for o in bodies},
        "all_retained_coordinates_skin_topology_groups_materials_world_exact": True,
        "all_163_rest_bones_pose_world_each_exact": True,
        "anatomical_body_or_rig_removed": False,
        "appearance_approved": False,
        "production_adopted": False,
    }


def validate_outputs(source, output, report):
    assert source.is_file(), "Existing native source required"
    assert len({p.resolve() for p in (source, output, report)}) == 3, (
        "Source, candidate and report must use distinct paths"
    )
    assert not output.exists() and not report.exists(), "Preserve prior assets/evidence"


def main():
    output, report = map(Path, sys.argv[sys.argv.index("--") + 1 :])
    source = Path(bpy.data.filepath)
    validate_outputs(source, output, report)
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    result = remove_joint_overlays(bpy.context.scene)
    bpy.context.scene["bodyguard_stage"] = (
        "S2.4 anatomical mannequin, decorative loops removed; ALL QA pending; NOT release"
    )
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
    result.update(
        {
            "source": str(source),
            "source_sha256": source_hash,
            "output_sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
            "source_file_unchanged": True,
            "camera_calls": 0,
        }
    )
    report.write_text(json.dumps(result, indent=2))
    print("DECORATIVE OVERLAY REMOVAL", json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
