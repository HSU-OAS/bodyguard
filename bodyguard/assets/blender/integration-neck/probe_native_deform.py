"""FR-A-02/03/08: installed native deformation API, non-human fixtures only.

No professional model is loaded, authored, rendered or saved. Positive group
weights test anchor membership, not clinical thresholds or avatar quality.
"""

import json
import math
import sys
from pathlib import Path

import bpy


def original_scene():
    return sorted(
        (obj.name, obj.type, tuple(tuple(row) for row in obj.matrix_world))
        for obj in bpy.context.scene.objects
    )


def fixture(label, positive_weight):
    side = 9
    points = [(x * 0.01, y * 0.01, 0.0) for y in range(side) for x in range(side)]
    faces = [
        (y * side + x, y * side + x + 1, (y + 1) * side + x + 1, (y + 1) * side + x)
        for y in range(side - 1)
        for x in range(side - 1)
    ]
    center = (side * side) // 2
    anchors = {
        y * side + x
        for y in range(side)
        for x in range(side)
        if x in (0, side - 1) or y in (0, side - 1)
    } | {center}
    mesh = bpy.data.meshes.new(f"nonhuman-{label}-mesh")
    obj = bpy.data.objects.new(f"nonhuman-{label}", mesh)
    bpy.context.scene.collection.objects.link(obj)
    try:
        mesh.from_pydata(points, [], faces)
        mesh.update()
        group = obj.vertex_groups.new(name="binary anchors")
        group.add(sorted(anchors), positive_weight, "REPLACE")
        modifier = obj.modifiers.new(
            name="installed native probe", type="LAPLACIANDEFORM"
        )
        modifier.vertex_group = group.name
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.context.view_layer.update()
        default_iterations = modifier.iterations
        assert modifier.is_bind is False
        outcome = bpy.ops.object.laplaciandeform_bind(modifier=modifier.name)
        assert outcome == {"FINISHED"} and modifier.is_bind is True
        mesh.vertices[center].co.z += 0.003
        mesh.update()
        bpy.context.view_layer.update()
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        result = evaluated.to_mesh()
        try:
            assert len(result.vertices) == len(points) and len(result.polygons) == len(
                faces
            )
            solved = [tuple(vertex.co) for vertex in result.vertices]
            assert all(math.isfinite(value) for point in solved for value in point)
            targets = [tuple(vertex.co) for vertex in mesh.vertices]
            boundary = anchors - {center}
            row = {
                "fixture": label,
                "positive_group_weight": positive_weight,
                "vertices": len(points),
                "faces": len(faces),
                "anchors": len(anchors),
                "native_bind_finished": True,
                "default_iterations_unchanged": default_iterations
                == modifier.iterations,
                "default_iterations": default_iterations,
                "finite_native_solution": True,
                "center_target_error_m": math.dist(solved[center], targets[center]),
                "maximum_boundary_anchor_error_m": max(
                    math.dist(solved[i], targets[i]) for i in boundary
                ),
                "non_anchor_displacement_m": max(
                    math.dist(solved[i], points[i])
                    for i in range(len(points))
                    if i not in anchors
                ),
            }
            assert row["non_anchor_displacement_m"] > 0, (
                "Native solver did not deform fixture"
            )
            return row, solved
        finally:
            evaluated.to_mesh_clear()
    finally:
        bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.meshes.remove(mesh)


output = Path(sys.argv[sys.argv.index("--") + 1])
assert not output.exists()
assert bpy.app.version_string == "5.1.1"
assert bpy.app.build_hash.decode() == "b70da489d7f4"
before = original_scene()
report = {
    "blender": bpy.app.version_string,
    "installed_build_hash": bpy.app.build_hash.decode(),
    "nonhuman_fixture_only": True,
    "professional_model_loaded_authored_or_saved": False,
    "appearance_approved": False,
    "clinical_or_camera_work": False,
    "completed": False,
    "rows": [],
}
try:
    properties = bpy.types.LaplacianDeformModifier.bl_rna.properties
    required = ("vertex_group", "iterations", "is_bind")
    assert all(name in properties for name in required)
    report["installed_rna_properties"] = {
        name: {"type": properties[name].type, "readonly": properties[name].is_readonly}
        for name in required
    }
    operator = bpy.ops.object.laplaciandeform_bind.get_rna_type()
    assert "modifier" in operator.properties
    report["installed_bind_operator"] = operator.identifier
    report["installed_bind_operator_doc"] = bpy.ops.object.laplaciandeform_bind.__doc__
    first, first_points = fixture("positive-one", 1.0)
    report["rows"].append(first)
    second, second_points = fixture("positive-quarter", 0.25)
    report["rows"].append(second)
    report["positive_weight_solutions_exact"] = first_points == second_points
    report["positive_weight_solution_maximum_difference_m"] = max(
        math.dist(a, b) for a, b in zip(first_points, second_points, strict=True)
    )
    assert first_points == second_points, "Installed positive-anchor semantics differ"
    assert original_scene() == before, "Original startup scene changed"
    report["original_startup_objects_exact"] = True
    report["completed"] = True
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
