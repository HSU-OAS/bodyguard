"""FR-A-01~03: derive a dressed, neutral draft from the authored CC0 body/head.

Blender --factory-startup --disable-autoexec -b bodyguard_avatar_studio.blend
  --python-exit-code 1 --python make_avatar_candidate.py -- new-draft.blend review-directory mpfb-source.blend
No live scene or input file is saved. A rendered draft is not a release approval.
"""

import sys
from math import cos, exp, isfinite, radians, sin, tau
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

output, reviews, rig_source = map(Path, sys.argv[sys.argv.index("--") + 1 :])
if output.exists() or output.resolve() == Path(bpy.data.filepath).resolve():
    raise FileExistsError("Use a new candidate path; never overwrite the edited source")
reviews.mkdir(parents=True, exist_ok=True)
if not rig_source.is_file():
    raise FileNotFoundError(rig_source)
scene = bpy.context.scene


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def transfer_weights(source, target):
    # FR-A-03: bind the edited surface at its final coordinates, by group name.
    target.vertex_groups.clear()
    active(target)
    source.select_set(True)
    bpy.context.view_layer.objects.active = source
    bpy.ops.object.data_transfer(
        data_type="VGROUP_WEIGHTS",
        use_create=True,
        use_object_transform=True,
        vert_mapping="POLYINTERP_NEAREST",
        layers_select_src="ALL",
        layers_select_dst="NAME",
    )
    active(target)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    if any(
        not isfinite(total := sum(g.weight for g in vertex.groups))
        or abs(total - 1) > 0.01
        for vertex in target.data.vertices
    ):
        raise ValueError(f"Incomplete final-surface weights: {target.name}")


def material(name, color, roughness):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    node = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    node.inputs["Base Color"].default_value = (*color, 1)
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Specular IOR Level"].default_value = 0.25
    return mat


body_mat = material("BODYGUARD porcelain warm white", (0.79, 0.78, 0.76), 0.62)
cloth_mat = material("BODYGUARD ivory textile", (0.72, 0.715, 0.70), 0.88)
seam_mat = material("BODYGUARD quiet joint edge", (0.60, 0.59, 0.57), 0.80)


def authored_hands(body, donor, rig, height):
    # FR-A-03/04: use the CC0 hand surface that matches its authored finger rig.
    # Nearest transfer between different finger shapes split a digit across bones.
    planes = []
    for side, sign in (("L", 1), ("R", -1)):
        wrist = rig.data.bones[f"wrist.{side}"]
        inverse = body.matrix_world.inverted()
        center = inverse @ (rig.matrix_world @ wrist.head_local)
        direction = (
            inverse.to_3x3()
            @ rig.matrix_world.to_3x3()
            @ (wrist.tail_local - wrist.head_local)
        ).normalized()
        planes.append((sign, center, direction))
        hand = donor.copy()
        hand.data = donor.data.copy()
        hand.name = f"Authored {side} hand fitting surface"
        scene.collection.objects.link(hand)
        # Work in the body's frame; bake only this temporary source derivative.
        matrix = inverse @ hand.matrix_world
        hand.data.transform(matrix)
        hand.parent = None
        hand.matrix_world = body.matrix_world.copy()
        bm = bmesh.new()
        bm.from_mesh(hand.data)
        remove = [
            face
            for face in bm.faces
            if sign * face.calc_center_median().x < height * 0.175
            or face.calc_center_median().z > height * 0.63
        ]
        bmesh.ops.delete(bm, geom=remove, context="FACES")
        bmesh.ops.bisect_plane(
            bm,
            geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
            plane_co=center - direction * 0.008,
            plane_no=direction,
            clear_inner=True,
        )
        bmesh.ops.holes_fill(
            bm, edges=[edge for edge in bm.edges if edge.is_boundary], sides=0
        )
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(hand.data)
        bm.free()
        if len(hand.data.polygons) < 100:
            raise ValueError(f"Incomplete authored hand: {side}")
        bm = bmesh.new()
        bm.from_mesh(body.data)
        faces = [
            face
            for face in bm.faces
            if sign * face.calc_center_median().x > height * 0.175
            and face.calc_center_median().z < height * 0.63
        ]
        edges = {edge for face in faces for edge in face.edges}
        vertices = {vertex for face in faces for vertex in face.verts}
        bmesh.ops.bisect_plane(
            bm,
            geom=list(vertices) + list(edges) + faces,
            plane_co=center,
            plane_no=direction,
            clear_outer=True,
        )
        bmesh.ops.holes_fill(
            bm, edges=[edge for edge in bm.edges if edge.is_boundary], sides=0
        )
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(body.data)
        bm.free()
        active(body)
        join = body.modifiers.new("Continuous authored wrist union", "BOOLEAN")
        join.operation = "UNION"
        join.solver = "EXACT"
        join.object = hand
        bpy.ops.object.modifier_apply(modifier=join.name)
        bpy.data.objects.remove(hand, do_unlink=True)
        mask = body.vertex_groups.new(name="Wrist sculpt finish")
        mask_name = mask.name
        for vertex in body.data.vertices:
            if sign * vertex.co.x > height * 0.175 and vertex.co.z < height * 0.63:
                weight = max(0, 1 - abs((vertex.co - center).dot(direction)) / 0.025)
                if weight:
                    mask.add([vertex.index], weight, "REPLACE")
        finish = body.modifiers.new("Authored wrist seam finish", "SMOOTH")
        finish.vertex_group = mask_name
        finish.factor = 0.5
        finish.iterations = 25
        bpy.ops.object.modifier_apply(modifier=finish.name)
        body.vertex_groups.remove(body.vertex_groups[mask_name])
    for polygon in body.data.polygons:
        polygon.use_smooth = True
    return planes


def fit_authored_rig(body, old_rig, label):
    # FR-A-03: match the donor rest pose before transferring its authored weights.
    # An unposed MPFB hand was beside the target thigh, causing wrong-limb skinning.
    names = [f"Bodyguard_{label}_Base", f"Bodyguard_{label}_Base.rig"]
    with bpy.data.libraries.load(str(rig_source)) as (available, imported):
        if not set(names).issubset(available.objects):
            raise ValueError("The authored MPFB rig/weights source is incomplete")
        imported.objects = names
    donor, rig = imported.objects
    for obj in (donor, rig):
        scene.collection.objects.link(obj)
    height = max(v.co.z for v in body.data.vertices)
    bpy.context.view_layer.update()
    evaluated = donor.evaluated_get(bpy.context.evaluated_depsgraph_get())
    source_height = max(
        (evaluated.matrix_world @ v.co).z for v in evaluated.data.vertices
    )
    rig.location = body.location
    rig.scale *= height / source_height
    bpy.context.view_layer.update()
    active(rig)
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in rig.data.edit_bones:
        bone.inherit_scale = "NONE"
        if bone.name.startswith(
            (
                "shoulder",
                "upperarm",
                "lowerarm",
                "wrist",
                "upperleg",
                "lowerleg",
                "foot",
            )
        ):
            # Connected bones silently clamp a posed head to the old parent tail.
            # Fit coordinates must be honoured before baking the new rest pose.
            bone.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")

    def segment(name, start, end):
        bone = rig.pose.bones[name]
        direction = end - start
        rotation = bone.matrix.to_quaternion()
        rotation = (rotation @ Vector((0, 1, 0))).rotation_difference(
            direction
        ) @ rotation
        bone.matrix = (
            Matrix.Translation(start)
            @ rotation.to_matrix().to_4x4()
            @ Matrix.Diagonal((1, direction.length / bone.bone.length, 1, 1))
        )
        bpy.context.view_layer.update()
        assert (bone.head - start).length < 0.0001, f"Fitted head not applied: {name}"
        assert (bone.tail - end).length < 0.0001, (
            f"Fitted tail not applied: {name}, delta={(bone.tail - end).length}"
        )

    for side, sign in (("L", 1), ("R", -1)):
        shoulder = rig.pose.bones[f"upperarm01.{side}"].head.copy()
        if label == "Female":
            shoulder = Vector((sign * 0.109, 0.008, 0.801)) * height / rig.scale.x
            segment(
                f"shoulder01.{side}",
                rig.pose.bones[f"shoulder01.{side}"].head.copy(),
                shoulder,
            )
        # These are artist-mesh rig fitting coordinates, not camera/clinical thresholds.
        elbow_point = (
            (0.172, -0.002, 0.645) if label == "Male" else (0.147, 0.019, 0.645)
        )
        wrist_point = (
            (0.221, -0.039, 0.540) if label == "Male" else (0.203, -0.012, 0.540)
        )
        elbow = Vector((sign * elbow_point[0], *elbow_point[1:])) * height / rig.scale.x
        wrist = Vector((sign * wrist_point[0], *wrist_point[1:])) * height / rig.scale.x
        # Two authored twist segments remain, with their proportions preserved.
        for prefix, start, end in (
            ("upperarm", shoulder, elbow),
            ("lowerarm", elbow, wrist),
        ):
            first, second = (rig.pose.bones[f"{prefix}0{i}.{side}"] for i in (1, 2))
            ratio = first.bone.length / (first.bone.length + second.bone.length)
            middle = start.lerp(end, ratio)
            segment(first.name, start, middle)
            segment(second.name, middle, end)
        segment(
            f"wrist.{side}",
            wrist,
            wrist + Vector((sign * 0.014, -0.012, -0.024)) * height / rig.scale.x,
        )
        hip = rig.pose.bones[f"upperleg01.{side}"].head.copy()
        knee_point = (
            (0.079, 0.004, 0.283) if label == "Male" else (0.064, -0.004, 0.284)
        )
        ankle_point = (
            (0.103, 0.032, 0.053) if label == "Male" else (0.075, 0.022, 0.053)
        )
        knee = Vector((sign * knee_point[0], *knee_point[1:])) * height / rig.scale.x
        ankle = Vector((sign * ankle_point[0], *ankle_point[1:])) * height / rig.scale.x
        for prefix, start, end in (("upperleg", hip, knee), ("lowerleg", knee, ankle)):
            first, second = (rig.pose.bones[f"{prefix}0{i}.{side}"] for i in (1, 2))
            ratio = first.bone.length / (first.bone.length + second.bone.length)
            middle = start.lerp(end, ratio)
            segment(first.name, start, middle)
            segment(second.name, middle, end)
        segment(
            f"foot.{side}",
            ankle,
            ankle + Vector((sign * 0.002, -0.050, -0.031)) * height / rig.scale.x,
        )
    # Bake only the fitted donor into a temporary transfer surface. The source is read-only.
    finish = donor.modifiers.new("Authored hand surface density", "SUBSURF")
    finish.levels = 2
    finish.render_levels = 2
    bpy.context.view_layer.update()
    donor.data = bpy.data.meshes.new_from_object(
        donor.evaluated_get(bpy.context.evaluated_depsgraph_get()),
        preserve_all_data_layers=True,
        depsgraph=bpy.context.evaluated_depsgraph_get(),
    )
    donor.modifiers.clear()
    active(rig)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    body.modifiers.clear()
    hand_planes = authored_hands(body, donor, rig, height)
    body.vertex_groups.clear()
    prefixes = (
        "spine",
        "neck",
        "head",
        "pelvis",
        "upperleg",
        "lowerleg",
        "foot",
        "clavicle",
        "shoulder",
        "upperarm",
        "lowerarm",
        "wrist",
    )
    original_deform = {bone.name: bone.use_deform for bone in rig.data.bones}
    for bone in rig.data.bones:
        bone.use_deform = bone.use_deform and bone.name.startswith(prefixes)
    binding = body.copy()
    binding.data = body.data.copy()
    scene.collection.objects.link(binding)
    active(binding)
    proxy = binding.modifiers.new("Closed native binding proxy", "REMESH")
    proxy.mode = "VOXEL"
    proxy.voxel_size = 0.006
    bpy.ops.object.modifier_apply(modifier=proxy.name)
    before = binding.matrix_world.copy()
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    bpy.context.view_layer.update()
    assert (
        max(
            abs(binding.matrix_world[i][j] - before[i][j])
            for i in range(4)
            for j in range(4)
        )
        < 1e-5
    )
    active(binding)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    assert all(
        abs(sum(g.weight for g in v.groups) - 1) < 0.01 for v in binding.data.vertices
    ), "Native core binding incomplete"
    transfer_weights(binding, body)
    bpy.data.objects.remove(binding, do_unlink=True)
    for bone in rig.data.bones:
        bone.use_deform = original_deform[bone.name]
    for group in donor.vertex_groups:
        if group.name not in body.vertex_groups:
            body.vertex_groups.new(name=group.name)
    hand_mask = body.vertex_groups.new(name="Authored hand transfer mask")
    hand_mask_name = hand_mask.name
    hand_indices = []
    hand_finish = {}
    for vertex in body.data.vertices:
        # Thumb roots lie nearer the torso than other digits. World-X masks
        # diluted their authored weights; blend across the actual wrist plane.
        weight = max(
            (
                min(1, max(0, ((vertex.co - center).dot(direction) + 0.004) / 0.016))
                for sign, center, direction in hand_planes
                if sign * vertex.co.x > height * 0.175 and vertex.co.z < height * 0.63
            ),
            default=0,
        )
        if weight:
            hand_mask.add([vertex.index], weight, "REPLACE")
            hand_finish[vertex.index] = weight
        if weight == 1:
            hand_indices.append(vertex.index)
    active(body)
    hand_transfer = body.modifiers.new("Fitted authored hand weights", "DATA_TRANSFER")
    hand_transfer.object = donor
    hand_transfer.use_vert_data = True
    hand_transfer.data_types_verts = {"VGROUP_WEIGHTS"}
    hand_transfer.vert_mapping = "POLYINTERP_NEAREST"
    hand_transfer.layers_vgroup_select_src = "ALL"
    hand_transfer.layers_vgroup_select_dst = "NAME"
    hand_transfer.vertex_group = hand_mask_name
    bpy.ops.object.modifier_apply(modifier=hand_transfer.name)
    body.vertex_groups.remove(body.vertex_groups[hand_mask_name])
    for group in list(body.vertex_groups):
        bone = rig.data.bones.get(group.name)
        if bone is None or not bone.use_deform:
            body.vertex_groups.remove(group)
    active(body)
    # FR-A-03: native VGroup Smooth modified unselected torso weights too.
    # Explicitly restrict the edit to connected hand surface neighbours.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    deform = bm.verts.layers.deform.active
    selected = set(hand_finish)
    untouched = {v.index: dict(v[deform]) for v in bm.verts if v.index not in selected}
    for _ in range(48):
        updates = {}
        for index in selected:
            vertex = bm.verts[index]
            neighbours = [edge.other_vert(vertex) for edge in vertex.link_edges]
            if not neighbours:
                raise ValueError("Disconnected authored hand vertex")
            factor = 0.5 * hand_finish[index]
            weights = {
                group: weight * (1 - factor) for group, weight in vertex[deform].items()
            }
            for neighbour in neighbours:
                for group, weight in neighbour[deform].items():
                    weights[group] = weights.get(group, 0) + weight * factor / len(
                        neighbours
                    )
            updates[index] = weights
        for index, weights in updates.items():
            bm.verts[index][deform].clear()
            for group, weight in weights.items():
                bm.verts[index][deform][group] = weight
    assert all(
        dict(bm.verts[index][deform]) == weights for index, weights in untouched.items()
    ), "Hand finish changed torso weights"
    bm.to_mesh(body.data)
    bm.free()
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    if any(abs(sum(g.weight for g in v.groups) - 1) > 0.01 for v in body.data.vertices):
        raise ValueError(f"Fitted donor left unweighted vertices: {label}")
    # Runnable root-cause check: the target distal hand must never inherit thigh weights.
    if not hand_indices:
        raise ValueError("Authored hand check region is empty")
    body["bodyguard_distal_hand_vertices"] = hand_indices
    for index in hand_indices:
        vertex = body.data.vertices[index]
        if any(
            body.vertex_groups[g.group].name.startswith(
                ("upperleg", "lowerleg", "pelvis")
            )
            and g.weight > 0.01
            for g in vertex.groups
        ):
            raise ValueError(f"Wrong-limb hand weights remain: {label}")
    skin = body.modifiers.new(
        "Fitted authored weights - deformation QA required", "ARMATURE"
    )
    skin.object = rig
    bpy.data.objects.remove(donor, do_unlink=True)
    old_name = old_rig.name
    bpy.data.objects.remove(old_rig, do_unlink=True)
    rig.name = old_name
    return rig


def garment(body, name, include):
    # Copy the professional surface and its deform data, not procedural body primitives.
    obj = body.copy()
    obj.data = body.data.copy()
    obj.name = name
    scene.collection.objects.link(obj)
    obj.modifiers.clear()
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    deform = bm.verts.layers.deform.active
    arm_groups = {
        g.index
        for g in body.vertex_groups
        if g.name.startswith(("upperarm", "lowerarm", "wrist", "finger", "metacarpal"))
    }
    if deform is None:
        raise ValueError("Garment requires the authored body's deform data")
    remove = [
        f
        for f in bm.faces
        if not include(f.calc_center_median())
        or sum(sum(v[deform].get(i, 0) for i in arm_groups) for v in f.verts)
        / len(f.verts)
        > 0.15
    ]
    bmesh.ops.delete(bm, geom=remove, context="FACES")
    # Face selection can leave pinched, self-touching hems. Remove their tiny
    # boundary bridges rather than hiding a malformed clothing surface.
    for _ in range(8):
        pinches = [
            v for v in bm.verts if sum(edge.is_boundary for edge in v.link_edges) > 2
        ]
        if not pinches:
            break
        bmesh.ops.delete(bm, geom=pinches, context="VERTS")
    unseen = set(bm.faces)
    components = []
    while unseen:
        component = {unseen.pop()}
        pending = list(component)
        while pending:
            face = pending.pop()
            for edge in face.edges:
                for adjacent in edge.link_faces:
                    if adjacent in unseen:
                        unseen.remove(adjacent)
                        component.add(adjacent)
                        pending.append(adjacent)
        components.append(component)
    if not components:
        raise ValueError(f"Empty garment: {name}")
    largest = max(components, key=len)
    bmesh.ops.delete(
        bm,
        geom=[
            face
            for component in components
            if component != largest
            for face in component
        ],
        context="FACES",
    )
    boundary = [v for v in bm.verts if v.is_boundary]
    for _ in range(24):
        # Fair the boundary loop itself; interior neighbours make cut hems jagged.
        updates = {}
        for vertex in boundary:
            neighbours = [
                edge.other_vert(vertex)
                for edge in vertex.link_edges
                if edge.is_boundary
            ]
            if len(neighbours) != 2:
                raise ValueError(f"Non-simple garment boundary: {name}")
            updates[vertex] = vertex.co.lerp(
                (neighbours[0].co + neighbours[1].co) / 2, 0.45
            )
        for vertex, point in updates.items():
            vertex.co = point
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    if len(obj.data.polygons) < 100:
        raise ValueError(f"Incomplete authored garment surface: {name}")
    obj.data.materials.clear()
    obj.data.materials.append(cloth_mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    active(obj)
    smooth = obj.modifiers.new("Textile surface relaxation", "SMOOTH")
    smooth.factor = 0.5
    smooth.iterations = 8
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    finish = obj.modifiers.new("Tailored boundary surface", "SUBSURF")
    finish.levels = 1
    finish.render_levels = 1
    bpy.ops.object.modifier_apply(modifier=finish.name)
    wrap = obj.modifiers.new("Drape on authored anatomy", "SHRINKWRAP")
    wrap.target = body
    wrap.wrap_method = "NEAREST_SURFACEPOINT"
    # ON_SURFACE offsets toward the old point, including inside the body.
    wrap.wrap_mode = "OUTSIDE_SURFACE"
    wrap.offset = 0
    bpy.ops.object.modifier_apply(modifier=wrap.name)
    # Bind on the actual body surface before adding cloth ease/thickness.
    # Sampling weights after the offset could choose a different nearby fold.
    transfer_weights(body, obj)
    wrap = obj.modifiers.new("Textile ease", "SHRINKWRAP")
    wrap.target = body
    wrap.wrap_method = "NEAREST_SURFACEPOINT"
    # Outside Surface follows the old projection line, which becomes unstable
    # after binding directly on the surface. Above Surface uses smooth normals.
    wrap.wrap_mode = "ABOVE_SURFACE"
    wrap.offset = 0.006
    bpy.ops.object.modifier_apply(modifier=wrap.name)
    edge = obj.modifiers.new("Garment edge thickness", "SOLIDIFY")
    edge.thickness = 0.0012
    edge.offset = -1
    bpy.ops.object.modifier_apply(modifier=edge.name)
    skin = obj.modifiers.new("Garment skin", "ARMATURE")
    skin.object = body.modifiers[0].object
    return obj


def joint_edge(body, rig, bone_name, radius_x, radius_z):
    # FR-A-01: a subtle seam traced on the authored anatomy, not a joint proxy.
    center = body.matrix_world.inverted() @ (
        rig.matrix_world @ rig.data.bones[bone_name].head_local
    )
    if bone_name.startswith("upperarm"):
        center.z -= 0.020
    tree = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    points = []
    for i in range(64):
        angle = tau * i / 64
        origin = Vector(
            (center.x + radius_x * cos(angle), -1, center.z + radius_z * sin(angle))
        )
        point, normal, _, _ = tree.ray_cast(origin, Vector((0, 1, 0)), 2)
        if point is None:
            raise ValueError(
                f"Joint seam left authored surface: {body.name}/{bone_name}, point={tuple(origin)}"
            )
        points.append(point + normal * 0.0006)
    curve = bpy.data.curves.new(f"Quiet edge {bone_name}", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 0.00035
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points, strict=True):
        point.co = (*co, 1)
    spline.use_cyclic_u = True
    obj = bpy.data.objects.new(
        f"BODYGUARD {body.name.split()[1]} joint edge {bone_name}", curve
    )
    scene.collection.objects.link(obj)
    obj.location = body.location
    active(obj)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.data.materials.append(seam_mat)
    transfer_weights(body, obj)
    skin = obj.modifiers.new("Authored-surface joint skin", "ARMATURE")
    skin.object = rig
    return obj


for label in ("Male", "Female"):
    body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    if body.modifiers[0].type != "ARMATURE" or body.modifiers[0].object != rig:
        raise ValueError(f"Unexpected source rig: {label}")
    # Finish residual blank-head voxel facets without changing body topology.
    active(body)
    body.modifiers.clear()
    height = max(vertex.co.z for vertex in body.data.vertices)
    mask = body.vertex_groups.new(name="Blank head sculpt finish")
    mask_name = mask.name
    for vertex in body.data.vertices:
        weight = max(
            min(1, max(0, (vertex.co.z / height - 0.845) / 0.055)),
            0.75
            * exp(-((vertex.co.x / (height * 0.055)) ** 2))
            * max(0, 1 - abs(vertex.co.z / height - 0.845) / 0.065),
        )
        if weight:
            mask.add([vertex.index], weight, "REPLACE")
    finish = body.modifiers.new("Blank head surface finish", "SMOOTH")
    finish.vertex_group = mask_name
    finish.factor = 0.5
    finish.iterations = 25
    bpy.ops.object.modifier_apply(modifier=finish.name)
    body.vertex_groups.remove(body.vertex_groups[mask_name])
    rig = fit_authored_rig(body, rig, label)
    body.data.materials.clear()
    body.data.materials.append(body_mat)
    for polygon in body.data.polygons:
        polygon.material_index = 0
    height = max(v.co.z for v in body.data.vertices)
    # FR-A-03: bake the display-neutral body before deriving fitted clothing.
    # This is appearance setup, not a stretching prescription (FR-S-03).
    for side, sign in (("L", 1), ("R", -1)):
        bone = rig.pose.bones[f"upperarm01.{side}"]
        bone.rotation_mode = "QUATERNION"
        axis = bone.bone.matrix_local.to_3x3().inverted() @ Vector((0, 1, 0))
        # Female source arms are already closer to the torso: preserve clearance
        # through twist/hip tests rather than placing clothing inside the forearm.
        bone.rotation_quaternion = Quaternion(
            axis, radians(sign * (10 if label == "Female" else 17))
        )
    bpy.context.view_layer.update()
    active(body)
    skin = next(m for m in body.modifiers if m.type == "ARMATURE")
    bpy.ops.object.modifier_apply(modifier=skin.name)
    active(rig)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    skin = body.modifiers.new("Neutral-rest skin - QA required", "ARMATURE")
    skin.object = rig
    garments = []
    if label == "Female":

        def tank(p, height=height):
            x, y, z = p / height
            # A scoop neck and armholes on the authored torso surface; front/back differ.
            neck = 0.830 - (0.060 if y < 0 else 0.030) * max(0, 1 - (x / 0.079) ** 2)
            width = 0.116 if z < 0.755 else 0.104 - max(0, z - 0.77) * 0.20
            return 0.555 < z < neck and abs(x) < width

        garments.append(garment(body, "BODYGUARD Female tank draft", tank))
        garments.append(
            garment(
                body,
                "BODYGUARD Female shorts draft",
                lambda p, height=height: (
                    0.397 < p.z / height < 0.564 and abs(p.x) / height < 0.15
                ),
            )
        )
    else:
        garments.append(
            garment(
                body,
                "BODYGUARD Male pelvis shell draft",
                lambda p, height=height: (
                    0.475 + 0.45 * abs(p.x) / height < p.z / height < 0.557
                    and abs(p.x) / height < 0.16
                ),
            )
        )
        garments[0].data.materials[0] = body_mat

    for obj in [body, *garments]:
        obj["bodyguard_source"] = (
            "Blender Foundation Human Base Meshes v1.4.1 CC0 body/head; MakeHuman MPFB CC0 core hands/rig; BODYGUARD authored edits"
        )
        print(
            "DRESSED DRAFT",
            label,
            obj.name,
            "vertices",
            len(obj.data.vertices),
            "faces",
            len(obj.data.polygons),
        )
    for side in ("L", "R"):
        for bone_name, rx, rz in (
            (f"upperarm01.{side}", 0.019, 0.025),
            (f"lowerarm01.{side}", 0.013, 0.018),
            (f"lowerleg01.{side}", 0.022, 0.031),
        ):
            joint_edge(body, rig, bone_name, rx, rz)

# Presentation lighting is separate from web performance/clinical validation.
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 1100
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.world.use_nodes = True
background = next(n for n in scene.world.node_tree.nodes if n.type == "BACKGROUND")
background.inputs["Color"].default_value = (0.70, 0.70, 0.69, 1)
background.inputs["Strength"].default_value = 0.18
world_nodes = scene.world.node_tree.nodes
world_links = scene.world.node_tree.links
camera_background = world_nodes.new("ShaderNodeBackground")
camera_background.inputs["Color"].default_value = (0.70, 0.70, 0.69, 1)
camera_background.inputs["Strength"].default_value = 0.85
light_path = world_nodes.new("ShaderNodeLightPath")
mix = world_nodes.new("ShaderNodeMixShader")
world_links.new(light_path.outputs["Is Camera Ray"], mix.inputs[0])
world_links.new(background.outputs["Background"], mix.inputs[1])
world_links.new(camera_background.outputs["Background"], mix.inputs[2])
world_links.new(
    mix.outputs[0],
    next(n for n in world_nodes if n.type == "OUTPUT_WORLD").inputs["Surface"],
)
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
for name, location, energy in (("key", (-2, -3, 4), 550), ("fill", (3, -1, 2.8), 140)):
    light = bpy.data.objects[f"BODYGUARD review {name}"]
    light.location = location
    light.rotation_euler = (
        (Vector((0, 0, 1)) - light.location).to_track_quat("-Z", "Y").to_euler()
    )
    light.data.energy = energy
    light.data.size = 2.3
floor_mat = material("BODYGUARD studio ground", (0.70, 0.70, 0.69), 0.9)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.012))
floor = bpy.context.object
floor.name = "BODYGUARD review ground"
floor.data.materials.append(floor_mat)
camera = scene.camera
camera.data.type = "ORTHO"
camera.data.ortho_scale = 2.6
camera.location = (0, -5, 0.85)
camera.rotation_euler = (
    (Vector((0, 0, 0.85)) - camera.location).to_track_quat("-Z", "Y").to_euler()
)
scene["bodyguard_stage"] = (
    "S2.4 dressed neutral draft; NOT release approved; no coaching motion"
)
scene["bodyguard_clothing"] = (
    "Authored derivatives of the existing CC0 professional body surface; no third-party clothing assets"
)
scene["rig_source"] = (
    "MakeHuman MPFB CC0 core hands/rig/weights; fitted and deformation-tested derivative"
)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
scene.render.filepath = str(reviews / "candidate-front.png")
bpy.ops.render.render(write_still=True)
print("CANDIDATE SAVED", output)
