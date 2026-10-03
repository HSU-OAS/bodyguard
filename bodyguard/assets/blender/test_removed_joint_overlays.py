"""FR-A-02/03: real native negative fixture and independent saved-file preservation."""

import hashlib
import json
import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import bpy


def main():
    helper, source, candidate, report = map(Path, sys.argv[sys.argv.index("--") + 1 :])
    assert not report.exists()
    hashes = {
        str(p): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in (helper, source, candidate)
    }
    spec = spec_from_file_location("remove_joint_overlays", helper)
    assert spec is not None and spec.loader is not None
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    proposed = report.with_name("guard-only-not-created.blend")
    proposed_report = report.with_name("guard-only-not-created.json")
    module.validate_outputs(source, proposed, proposed_report)
    for bad_candidate, bad_report, expected in (
        (proposed, proposed, "Source, candidate and report must use distinct paths"),
        (
            source,
            proposed_report,
            "Source, candidate and report must use distinct paths",
        ),
        (proposed, source, "Source, candidate and report must use distinct paths"),
        (candidate, proposed_report, "Preserve prior assets/evidence"),
    ):
        try:
            module.validate_outputs(source, bad_candidate, bad_report)
        except AssertionError as error:
            assert str(error) == expected
        else:
            raise AssertionError("Unsafe output path was accepted")
    assert not proposed.exists() and not proposed_report.exists()
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    names = {o.name for o in bpy.context.scene.objects}
    excluded = {n for n in names if n.startswith("BODYGUARD ") and " joint edge " in n}
    assert len(excluded) == 8
    original = {
        o.name: module.geometry_signature(o)
        for o in bpy.context.scene.objects
        if o.type == "MESH" and o.name not in excluded
    }
    rigs = {
        o.name: module.rig_signature(o)
        for o in bpy.context.scene.objects
        if o.type == "ARMATURE"
    }
    palettes = {}
    for label in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
        nodes = body.data.materials[0].node_tree.nodes
        pbr = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
        palettes[label] = {
            i.name: tuple(i.default_value)
            if hasattr(i.default_value, "__iter__")
            else i.default_value
            for i in pbr.inputs
        }
    # Rename an existing authored overlay: no primitive body or relaxed target set.
    overlay = bpy.data.objects[min(excluded)]
    name = overlay.name
    overlay.name = name + " unexpected"
    try:
        module.remove_joint_overlays(bpy.context.scene)
    except AssertionError as error:
        assert str(error) == "Unexpected decorative overlay set"
    else:
        raise AssertionError("Malformed overlay set must fail before deletion")
    assert len(bpy.context.scene.objects) == len(names)
    overlay.name = name
    assert names == {o.name for o in bpy.context.scene.objects}
    assert original == {
        o.name: module.geometry_signature(o)
        for o in bpy.context.scene.objects
        if o.type == "MESH" and o.name not in excluded
    }
    bpy.ops.wm.open_mainfile(filepath=str(candidate), load_ui=False)
    assert {o.name for o in bpy.context.scene.objects} == names - excluded
    assert original == {
        o.name: module.geometry_signature(o)
        for o in bpy.context.scene.objects
        if o.type == "MESH"
    }
    assert rigs == {
        o.name: module.rig_signature(o)
        for o in bpy.context.scene.objects
        if o.type == "ARMATURE"
    }
    for label in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
        pbr = next(
            n
            for n in body.data.materials[0].node_tree.nodes
            if n.type == "BSDF_PRINCIPLED"
        )
        assert palettes[label] == {
            i.name: tuple(i.default_value)
            if hasattr(i.default_value, "__iter__")
            else i.default_value
            for i in pbr.inputs
        }
    assert hashes == {
        str(p): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in (helper, source, candidate)
    }
    result = {
        "passed": True,
        "input_sha256": hashes,
        "negative_fixture": "Unexpected decorative overlay set rejected before deletion",
        "unsafe_output_path_fixtures_rejected": 4,
        "positive_output_path_created_files": 0,
        "removed_objects": sorted(excluded),
        "retained_mesh_signatures": original,
        "retained_rig_signatures": rigs,
        "independent_saved_reopen_body_and_163_rest_rigs_materials_exact": True,
        "source_and_candidate_files_unchanged": True,
        "saved_assets": 0,
        "camera_calls": 0,
        "appearance_approved": False,
    }
    report.write_text(json.dumps(result, indent=2))
    print("SAVED JOINT OVERLAY REGRESSION", json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
