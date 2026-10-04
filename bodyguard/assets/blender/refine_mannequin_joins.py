"""FR-A-01~04: native local fairing of an authored neutral mannequin.

Blender --factory-startup --disable-autoexec -b existing-candidate.blend
 --python-exit-code 1 --python this.py -- new-source.blend new-preview-directory
Never generates a body, changes skin weights/bones, or approves clinical motion.
"""

import json
import sys
from math import exp, isfinite, pi
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

output, previews = map(Path, sys.argv[sys.argv.index("--") + 1 :])
if output.exists() or output.resolve() == Path(bpy.data.filepath).resolve():
    raise FileExistsError("Preserve the prior artist source")
if previews.exists():
    raise FileExistsError("Preserve prior visual/diagnostic evidence")
scene = bpy.context.scene
assert not any(o.name.startswith("BODYGUARD ") and "draft" in o.name for o in scene.objects)
reports = []
for label in ("Male", "Female"):
    body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    assert len(body.modifiers) == 1 and body.modifiers[0].object == rig
    assert len(rig.data.bones) == 163 and all(b.matrix_basis.is_identity for b in rig.pose.bones)
    skin = [tuple((g.group, g.weight) for g in v.groups) for v in body.data.vertices]
    rest = [v.co.copy() for v in body.data.vertices]
    bones = [(b.name, tuple(b.matrix_local)) for b in rig.data.bones]
    height = max(v.co.z for v in body.data.vertices)
    protected = set(body["bodyguard_distal_hand_vertices"])
    arm = {
        g.index
        for g in body.vertex_groups
        if g.name.startswith(("lowerarm", "wrist", "finger", "metacarpal"))
    }
    transform = body.matrix_world.inverted() @ rig.matrix_world
    planes = []
    for side in ("L", "R"):
        bone = rig.data.bones[f"wrist.{side}"]
        planes.append(
            (
                transform @ bone.head_local,
                (transform.to_3x3() @ (bone.tail_local - bone.head_local)).normalized(),
            )
        )

    def folds(body=body, height=height, arm=arm, planes=planes):
        # Artist rest-surface diagnostic, not a medical angle/acceptance threshold.
        bm = bmesh.new()
        bm.from_mesh(body.data)
        bm.normal_update()
        deform = bm.verts.layers.deform.active
        values = {}
        for region in ("neck", "wrist.L", "wrist.R"):
            if region == "neck":

                def inside_region(v, height=height):
                    return abs(v.co.x / height) < 0.08 and 0.83 < v.co.z / height < 0.90
            else:
                center, direction = planes[0 if region.endswith(".L") else 1]

                def inside_region(v, center=center, direction=direction, arm=arm):
                    return (
                        (v.co - center).length < 0.13
                        and (-0.080001 <= (v.co - center).dot(direction) <= 0.009001)
                        and sum(v[deform].get(i, 0) for i in arm) > 0.25
                    )

            edges = [
                e for e in bm.edges if e.is_manifold and all([inside_region(v) for v in e.verts])
            ]
            values[region] = {
                "edges": len(edges),
                "folds_over_90": sum(e.calc_face_angle() > pi / 2 for e in edges),
                "folds_over_90_long": sum(
                    e.calc_face_angle() > pi / 2 and e.calc_length() > 0.001 for e in edges
                ),
            }
        bm.free()
        return values

    before = folds()
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    mask = body.vertex_groups.new(name="Local mannequin join fairing")
    mask_name = mask.name
    selected = set()
    for vertex in body.data.vertices:
        p = vertex.co / height
        neck = exp(-((p.x / 0.075) ** 2)) * max(0, 1 - abs(p.z - 0.865) / 0.055)
        wrist = 0
        if (
            vertex.index not in protected
            and sum(g.weight for g in vertex.groups if g.group in arm) > 0.25
        ):
            for center, direction in planes:
                t = (vertex.co - center).dot(direction)
                if (vertex.co - center).length < 0.13:
                    wrist = max(wrist, max(0, 1 - abs(t + 0.0355) / 0.0445))
        weight = max(neck, wrist)
        if weight:
            selected.add(vertex.index)
            mask.add([vertex.index], weight, "REPLACE")
    finish = body.modifiers.new("Local authored seam fairing - QA required", "CORRECTIVE_SMOOTH")
    finish.vertex_group = mask_name
    finish.factor = 0.6
    finish.iterations = 32
    finish.smooth_type = "LENGTH_WEIGHTED"
    finish.use_only_smooth = True
    bpy.ops.object.modifier_move_up(modifier=finish.name)
    bpy.ops.object.modifier_apply(modifier=finish.name)
    # Applying a native modifier invalidates cached DeformGroup RNA handles.
    body.vertex_groups.remove(body.vertex_groups[mask_name])
    assert len(rest) == len(body.data.vertices), "Do not remove anatomical topology"
    assert skin == [tuple((g.group, g.weight) for g in v.groups) for v in body.data.vertices]
    assert bones == [(b.name, tuple(b.matrix_local)) for b in rig.data.bones]
    assert all(
        (v.co - rest[v.index]).length < 1e-6 for v in body.data.vertices if v.index not in selected
    )
    assert all((body.data.vertices[i].co - rest[i]).length < 1e-6 for i in protected)
    displacement = max((v.co - rest[v.index]).length for v in body.data.vertices)
    print("LOCAL ARTIST DISPLACEMENT", label, displacement)
    # Artist edit budget only; not a patient/model-estimation accuracy claim.
    assert isfinite(displacement) and displacement < 0.006, "Excessive anatomical surface change"
    reports.append(
        {
            "body": label,
            "selected_vertices": len(selected),
            "vertices": len(rest),
            "bones": len(bones),
            "maximum_artist_displacement_m": displacement,
            "rest_surface_before": before,
            "rest_surface_after": folds(),
            "source_skin_bones_distal_hand_outside_region_preserved": True,
            "full_deformation_visual_browser_qa_pending": True,
        }
    )
previews.mkdir(parents=True)
(previews / "join-fairing-report.json").write_text(json.dumps(reports, indent=2) + "\n")
scene["bodyguard_stage"] = "S2.4 local joint fairing; ALL QA pending; NOT release approved"
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
scene.render.resolution_x = scene.render.resolution_y = 1000
scene.cycles.samples = 32
camera = scene.camera
for label in ("Male", "Female"):
    for obj in scene.objects:
        if (
            obj.type == "MESH"
            and obj.name.startswith("BODYGUARD ")
            and "review ground" not in obj.name
        ):
            obj.hide_render = not obj.name.startswith(f"BODYGUARD {label}")
    x = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"].matrix_world.translation.x
    for name, location, target, scale in (
        ("wrist", (x + 0.50, -2, 0.85), (x + 0.25, 0, 0.85), 0.40),
        ("neck-back", (x + 0.4, 3, 1.42), (x, 0, 1.42), 0.60),
        ("front", (x, -4, 0.83), (x, 0, 0.83), 1.95),
    ):
        camera.location = location
        camera.rotation_euler = (
            (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
        )
        camera.data.ortho_scale = scale
        scene.render.filepath = str(previews / f"{label.lower()}-{name}.png")
        bpy.ops.render.render(write_still=True)
print("NATIVE JOIN FAIRING", json.dumps(reports))
