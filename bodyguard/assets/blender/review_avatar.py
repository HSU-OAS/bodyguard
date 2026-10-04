"""FR-A-01~03: repeatable Blender deformation harness, not medical motion content.

Run Blender -b draft.blend --python-exit-code 1 --python review_avatar.py -- output-directory.
The 20-degree neck rotation is a technical stress test, not a target for users.
The loaded .blend is never saved; reviewed poses are temporary.
"""

import json
import sys
from math import degrees, isfinite, radians
from pathlib import Path

import bmesh
import bpy
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree

output = Path(sys.argv[sys.argv.index("--") + 1])
output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
candidate = "--candidate" in sys.argv
only_check = "--qc-only" in sys.argv
mannequin = "--mannequin" in sys.argv
failures = []
checks = []
current_pose = "neutral"


def render(name):
    scene.render.filepath = str(output / name)
    if not only_check:
        bpy.ops.render.render(write_still=True)


def clothing_clearance(body, clothes):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(body, depsgraph)
    for obj in clothes:
        mesh = obj.evaluated_get(depsgraph).data
        mesh.calc_loop_triangles()
        points = [v.co for v in mesh.vertices] + [
            sum((mesh.vertices[i].co for i in triangle.vertices), Vector()) / 3
            for triangle in mesh.loop_triangles
        ]
        signed = []
        inside = 0
        ambiguous = 0
        for point in points:
            point = body.matrix_world.inverted() @ (obj.matrix_world @ point)
            surface, normal, _, _ = tree.find_nearest(point)
            assert surface is not None
            distance = (point - surface).dot(normal)
            signed.append(distance)
            if distance >= -0.0001:
                continue
            # Nearest face normals can misclassify points near concave edges.
            # Confirm against the closed volume with three non-axis-aligned rays.
            parities = []
            for direction in (
                Vector((1, 0.137, 0.391)),
                Vector((0.281, 1, 0.197)),
                Vector((0.167, 0.193, 1)),
            ):
                direction.normalize()
                origin = point.copy()
                crossings = 0
                for _ in range(200):
                    hit, _, _, _ = tree.ray_cast(origin, direction, 3)
                    if hit is None:
                        break
                    crossings += 1
                    origin = hit + direction * 0.00001
                else:
                    raise AssertionError("Unresolved clothing/body intersections")
                parities.append(crossings % 2)
            inside += sum(parities) >= 2
            ambiguous += len(set(parities)) > 1
        print(
            "CLOTHING QC",
            obj.name,
            "samples",
            len(points),
            "inside",
            inside,
            "ambiguous",
            ambiguous,
            "minimum",
            round(min(signed), 6),
        )
        if inside or ambiguous:
            failures.append(f"{obj.name}: {inside} inside / {ambiguous} unresolved volume samples")
        checks.append(
            {
                "pose": current_pose,
                "surface": obj.name,
                "samples": len(points),
                "inside": inside,
                "ambiguous": ambiguous,
                "minimum_m": min(signed),
            }
        )


def topology(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    invalid = sum(not e.is_manifold for e in bm.edges)
    unseen = set(bm.verts)
    components = 0
    while unseen:
        components += 1
        stack = [unseen.pop()]
        while stack:
            for edge in stack.pop().link_edges:
                for vertex in edge.verts:
                    if vertex in unseen:
                        unseen.remove(vertex)
                        stack.append(vertex)
    bm.free()
    return components, invalid


def rest_edges(body):
    # FR-A-03: the same original >1mm edge set for neck and articulation stress.
    rest = [v.co.copy() for v in body.data.vertices]
    return [
        (a, b, length)
        for edge in body.data.edges
        for a, b in [edge.vertices]
        if (length := (rest[a] - rest[b]).length) > 0.001
    ]


def skin_stretch(body, edges):
    mesh = body.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
    assert all(isfinite(c) for v in mesh.vertices for c in v.co)
    return max(
        (mesh.vertices[a].co - mesh.vertices[b].co).length / length for a, b, length in edges
    )


if mannequin:
    # FR-A-01~04 / CEO 2026-10-01: no clothing; shared physical finish after GLB too.
    assert candidate, "Unified mannequin QA requires the complete candidate harness"
    garments = [
        obj.name
        for obj in scene.objects
        if obj.type == "MESH" and obj.name.startswith("BODYGUARD ") and "draft" in obj.name
    ]
    assert not garments, f"Separate garment remained: {garments}"
    finishes = []
    for label in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
        assert len(body.data.materials) == 1 and all(
            face.material_index == 0 for face in body.data.polygons
        ), "Mannequin body must have one neutral material"
        nodes = [n for n in body.data.materials[0].node_tree.nodes if n.type == "BSDF_PRINCIPLED"]
        assert len(nodes) == 1 and not any(i.is_linked for i in nodes[0].inputs), (
            "Unexpected skin texture/procedural detail"
        )
        finish = {}
        for name in ("Base Color", "Metallic", "Roughness", "Specular IOR Level", "Alpha"):
            value = nodes[0].inputs[name].default_value
            finish[name] = list(value) if hasattr(value, "__iter__") else value
        finishes.append(finish)
    assert finishes[0] == finishes[1], "Male/female physical surface finish differs"
    checks.append(
        {
            "pose": "neutral",
            "surface_style": "unified-white-mannequin",
            "garments": garments,
            "shared_finish": finishes[0],
            "realistic_details_visual_review_required": True,
        }
    )

for label in ("Male", "Female"):
    obj = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    assert len(obj.data.vertices) > 10_000, f"{label}: unexpected loss of authored body topology"
    assert all(isfinite(c) for v in obj.data.vertices for c in v.co), f"{label}: nonfinite surface"
    height = max(v.co.z for v in obj.data.vertices) - min(v.co.z for v in obj.data.vertices)
    assert 1.5 < height < 2, f"{label}: expected complete metre-scale body, got {height}"
    components, invalid = topology(obj.data)
    assert invalid == 0, f"{label}: {invalid} non-manifold edges"
    assert components == 1, f"{label}: head/body must be joined, got {components} components"
    unweighted = sum(
        not isfinite(total := sum(g.weight for g in v.groups)) or abs(total - 1) > 0.01
        for v in obj.data.vertices
    )
    assert unweighted == 0, f"{label}: {unweighted} unnormalized vertices"
    print(
        "AVATAR QC",
        label,
        "vertices",
        len(obj.data.vertices),
        "bones",
        len(rig.data.bones),
        "components",
        components,
        "non_manifold",
        invalid,
        "unnormalized",
        unweighted,
    )
    checks.append(
        {
            "pose": "neutral",
            "surface": obj.name,
            "vertices": len(obj.data.vertices),
            "components": components,
            "non_manifold": invalid,
            "unnormalized": unweighted,
        }
    )
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion()
    if candidate:
        indices = obj.get("bodyguard_distal_hand_vertices")
        assert indices, "Candidate must retain the authored hand QA selection"
        for index in indices:
            assert not any(
                obj.vertex_groups[g.group].name.startswith(("upperleg", "lowerleg", "pelvis"))
                and g.weight > 0.01
                for g in obj.data.vertices[index].groups
            ), "Wrong-limb hand skinning"
        extra = [
            o
            for o in scene.objects
            if o.type == "MESH" and o.name.startswith(f"BODYGUARD {label}") and o != obj
        ]
        for surface in extra:
            assert all(isfinite(c) for v in surface.data.vertices for c in v.co)
            assert all(
                abs(sum(g.weight for g in v.groups) - 1) < 0.01 for v in surface.data.vertices
            ), f"{surface.name}: unnormalized skin"
            assert any(m.type == "ARMATURE" and m.object == rig for m in surface.modifiers)
            if "draft" in surface.name:
                components, invalid = topology(surface.data)
                checks.append(
                    {
                        "pose": "neutral",
                        "surface": surface.name,
                        "components": components,
                        "non_manifold": invalid,
                    }
                )
                if components != 1 or invalid:
                    failures.append(
                        f"{surface.name}: detached/open garment "
                        f"({components} components, {invalid} non-manifold)"
                    )
        clothing_clearance(obj, [o for o in extra if "draft" in o.name])

scene.render.engine = "CYCLES" if candidate else "BLENDER_EEVEE"
if candidate:
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
scene.render.resolution_x = 1400
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
if not candidate:
    scene.world = bpy.data.worlds.new("BODYGUARD review world")
    scene.world.color = (0.3, 0.3, 0.3)
for name, location, energy in (
    () if candidate else (("key", (0, -3, 4), 1300), ("fill", (2, -2, 2), 350))
):
    light = bpy.data.objects.get("BODYGUARD review " + name)
    if light is None:
        data = bpy.data.lights.new("BODYGUARD review " + name, "AREA")
        light = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(light)
    data = light.data
    light.location = location
    data.energy = energy
    data.size = 4
camera = scene.camera
camera.data.type = "ORTHO"
camera.data.ortho_scale = 2.8
camera.location = (0, -5, 0.84)
camera.rotation_euler = (Vector((0, 0, 0.84)) - camera.location).to_track_quat("-Z", "Y").to_euler()
render("faceless-front.png")
camera.location = (2.4, -4.8, 0.84)
camera.rotation_euler = (Vector((0, 0, 0.84)) - camera.location).to_track_quat("-Z", "Y").to_euler()
render("faceless-quarter.png")

scene.render.resolution_x = 900
scene.render.resolution_y = 1000
camera.data.ortho_scale = 0.7
for label in ("Male", "Female"):
    obj = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    x = obj.matrix_world.translation.x
    z = max((obj.matrix_world @ v.co).z for v in obj.data.vertices) - 0.2
    others = [
        o
        for o in scene.objects
        if o.type == "MESH"
        and o.name.startswith(f"BODYGUARD {'Female' if label == 'Male' else 'Male'}")
    ]
    for surface in others:
        surface.hide_render = True
    if candidate:
        # A-02: full silhouettes and authored hand/knee details, not neck-only crops.
        for name, location, target, scale in (
            (
                "body-side",
                (x + 4, 0, 0.83),
                (x, 0, 0.83),
                1.95,
            ),
            ("body-back", (x, 4, 0.83), (x, 0, 0.83), 1.95),
            (
                "hand",
                (x + 0.43, -2, 0.75),
                (x + 0.34, 0, 0.75),
                0.42,
            ),
            (
                "knee",
                (x + 0.4, -2, 0.48),
                (x + 0.1, 0, 0.48),
                0.46,
            ),
        ):
            camera.data.ortho_scale = scale
            camera.location = location
            camera.rotation_euler = (
                (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
            )
            render(f"faceless-{name}-{label.lower()}.png")
        camera.data.ortho_scale = 0.7
    camera.location = (x + 4, 0, z)
    camera.rotation_euler = (
        (Vector((x, 0, z)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    render(f"faceless-side-{label.lower()}.png")
    camera.location = (x, -4, z)
    camera.rotation_euler = (
        (Vector((x, 0, z)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    edges = rest_edges(obj) if candidate else None
    for side, sign in (("left", 1), ("right", -1)):
        current_pose = f"{label}/neck/{side}"
        for name, angle in (("neck01", 4), ("neck02", 5), ("neck03", 5), ("head", 6)):
            pb = rig.pose.bones[name]
            # Bone-local Y runs along the bone. Convert the actual scene Y axis
            # into each rest frame so this test bends the neck instead of twisting it.
            axis = pb.bone.matrix_local.to_3x3().inverted() @ Vector((0, 1, 0))
            pb.rotation_quaternion = Quaternion(axis, radians(sign * angle))
        bpy.context.view_layer.update()
        delta = (
            rig.pose.bones["head"].matrix @ rig.data.bones["head"].matrix_local.inverted()
        ).to_quaternion()
        assert abs(degrees(delta.angle) - 20) < 0.05
        assert abs(abs(delta.axis.y) - 1) < 0.01
        print(
            "NECK QC",
            label,
            side,
            "rotation",
            round(degrees(delta.angle), 2),
            "axis",
            tuple(round(v, 3) for v in delta.axis),
        )
        neck_check = {
            "pose": current_pose,
            "head_rotation_degrees": degrees(delta.angle),
            "axis_y": delta.axis.y,
        }
        if candidate:
            maximum = skin_stretch(obj, edges)
            neck_check["edge_ratio_max"] = maximum
            if maximum >= 3:
                failures.append(f"{current_pose}: severe local skin stretch {maximum:.3f}")
            clothing_clearance(
                obj,
                [
                    o
                    for o in scene.objects
                    if o.type == "MESH"
                    and o.name.startswith(f"BODYGUARD {label}")
                    and "draft" in o.name
                ],
            )
        checks.append(neck_check)
        render(f"faceless-neck-{label.lower()}-{side}.png")
    for pb in rig.pose.bones:
        pb.rotation_quaternion = Quaternion()
    for surface in others:
        surface.hide_render = False

if candidate:
    # FR-A-03: technical articulation checks, never correct-motion prescriptions.
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1000
    for label in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
        edges = rest_edges(body)
        others = [
            o
            for o in scene.objects
            if o.type == "MESH"
            and o.name.startswith(f"BODYGUARD {'Female' if label == 'Male' else 'Male'}")
        ]
        for surface in others:
            surface.hide_render = True
        camera.data.ortho_scale = 1.95
        x = body.matrix_world.translation.x
        camera.location = (x + 2, -4, 0.83)
        camera.rotation_euler = (
            (Vector((x, 0, 0.83)) - camera.location).to_track_quat("-Z", "Y").to_euler()
        )
        cases = (
            (
                ("clavicle", (0, 1, 0), -10),
                ("upperarm01", (0, 1, 0), -60),
                ("lowerarm01", (1, 0, 0), -70),
                ("wrist", (1, 0, 0), -30),
                ("upperleg01", (1, 0, 0), -40),
                ("lowerleg01", (1, 0, 0), 60),
                ("foot", (1, 0, 0), -20),
            )
            + tuple(
                (f"finger{digit}-{segment}", (1, 0, 0), -40)
                for digit in range(1, 6)
                for segment in range(1, 4)
            )
            + tuple((f"metacarpal{digit}", (1, 0, 0), -20) for digit in range(1, 5))
            + tuple((f"spine{segment:02}", (0, 0, 1), 20) for segment in range(1, 6))
        )
        for name, axis, angle in cases:
            for side in ("",) if name.startswith("spine") else ("L", "R"):
                current_pose = f"{label}/{name}/{side}"
                for bone in rig.pose.bones:
                    bone.rotation_quaternion = Quaternion()
                bone = rig.pose.bones[f"{name}.{side}" if side else name]
                local_axis = bone.bone.matrix_local.to_3x3().inverted() @ Vector(axis)
                sign = -1 if side == "R" and axis[1] else 1
                bone.rotation_quaternion = Quaternion(local_axis, radians(angle * sign))
                bpy.context.view_layer.update()
                maximum = skin_stretch(body, edges)
                print(
                    "ARTICULATION QC",
                    label,
                    name,
                    side,
                    "edge_ratio_max",
                    round(maximum, 3),
                )
                checks.append({"pose": current_pose, "edge_ratio_max": maximum})
                # An engineering tearing alarm, not clinical motion acceptance.
                if maximum >= 3:
                    failures.append(
                        f"{label}/{name}/{side}: severe local skin stretch {maximum:.3f}"
                    )
                clothing_clearance(
                    body,
                    [
                        o
                        for o in scene.objects
                        if o.type == "MESH"
                        and o.name.startswith(f"BODYGUARD {label}")
                        and "draft" in o.name
                    ],
                )
                if side in {"L", ""} and (
                    not name.startswith(("finger", "metacarpal", "spine"))
                    or name in {"finger2-1", "spine02"}
                ):
                    render(f"technical-{label.lower()}-{name}.png")
        for bone in rig.pose.bones:
            bone.rotation_quaternion = Quaternion()
        for surface in others:
            surface.hide_render = False

# FR-A-03: generated engineering evidence includes failures, never a medical approval.
(output / "deformation-report.json").write_text(
    json.dumps(
        {
            "blender": bpy.app.version_string,
            "source": Path(bpy.data.filepath).name,
            "candidate": candidate,
            "rendered": not only_check,
            "passed": not failures,
            "checks": checks,
            "failures": failures,
        },
        indent=2,
    )
    + "\n"
)
assert not failures, "Candidate deformation failed:\n" + "\n".join(failures)
