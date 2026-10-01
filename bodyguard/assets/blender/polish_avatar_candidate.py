"""FR-A-01~03: native surface polish of an existing artist-authored candidate.

Blender -b explicit-candidate.blend --python-exit-code 1 --python this.py
  -- new-candidate.blend
Keeps source/rig/hand topology; no primitive human or medical motion is generated.
Run the complete source and GLB deformation harness after any surface edit.
"""

import sys
from math import exp, isfinite
from pathlib import Path

import bmesh
import bpy
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index("--") + 1 :]
if len(args) != 1:
    raise ValueError("Expected a new candidate .blend path")
output = Path(args[0])
if output.exists() or output.resolve() == Path(bpy.data.filepath).resolve():
    raise FileExistsError("Never overwrite an edited source or prior candidate")


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def rebind(body, target):
    target.vertex_groups.clear()
    active(target)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
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
    assert all(
        isfinite(total := sum(g.weight for g in vertex.groups))
        and abs(total - 1) < 0.01
        for vertex in target.data.vertices
    ), "Incomplete polished-surface weights"


for label in ("Male", "Female"):
    body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    assert len(body.modifiers) == 1 and body.modifiers[0].type == "ARMATURE"
    skin = body.modifiers[0]
    assert skin.object == rig
    assert all(bone.matrix_basis.is_identity for bone in rig.pose.bones)
    groups_before = [
        tuple((g.group, g.weight) for g in v.groups) for v in body.data.vertices
    ]
    height = max(v.co.z for v in body.data.vertices)
    active(body)
    mask = body.vertex_groups.new(name="Head-neck native sculpt polish")
    mask_name = mask.name
    for vertex in body.data.vertices:
        z = vertex.co.z / height
        weight = max(
            min(1, max(0, (z - 0.85) / 0.055)),
            0.8
            * exp(-((vertex.co.x / (height * 0.05)) ** 2))
            * max(0, 1 - abs(z - 0.84) / 0.055),
        )
        if weight:
            mask.add([vertex.index], weight, "REPLACE")
    finish = body.modifiers.new("Artist blank-head and neck surface polish", "SMOOTH")
    finish.vertex_group = mask_name
    finish.factor = 0.5
    finish.iterations = 40
    bpy.ops.object.modifier_move_up(modifier=finish.name)
    bpy.ops.object.modifier_apply(modifier=finish.name)
    body.vertex_groups.remove(body.vertex_groups[mask_name])
    assert groups_before == [
        tuple((g.group, g.weight) for g in v.groups) for v in body.data.vertices
    ]
    for polygon in body.data.polygons:
        polygon.use_smooth = True
    body.data.update()
    tree = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    for obj in list(bpy.context.scene.objects):
        if (
            obj.type != "MESH"
            or not obj.name.startswith(f"BODYGUARD {label}")
            or obj == body
        ):
            continue
        active(obj)
        obj.modifiers.clear()
        if "draft" in obj.name:
            # Recover the authored outer cloth surface, rather than smoothing
            # a closed thin shell whose opposite sides constrain the hem.
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bm.normal_update()
            remove = []
            for face in bm.faces:
                _, normal, _, _ = tree.find_nearest(face.calc_center_median())
                assert normal is not None
                if face.normal.dot(normal) < 0.5:
                    remove.append(face)
            bmesh.ops.delete(bm, geom=remove, context="FACES")
            bmesh.ops.delete(
                bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS"
            )
            boundary = [v for v in bm.verts if v.is_boundary]
            assert boundary and len(bm.faces) > 100
            for _ in range(32):
                updates = {}
                for vertex in boundary:
                    neighbours = [
                        e.other_vert(vertex) for e in vertex.link_edges if e.is_boundary
                    ]
                    assert len(neighbours) == 2, (
                        "Polish requires simple cloth boundaries"
                    )
                    updates[vertex] = vertex.co.lerp(
                        (neighbours[0].co + neighbours[1].co) / 2, 0.45
                    )
                for vertex, point in updates.items():
                    vertex.co = point
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            bm.to_mesh(obj.data)
            bm.free()
            finish = obj.modifiers.new("Tailored cloth surface polish", "SMOOTH")
            finish.factor = 0.3
            finish.iterations = 8
            bpy.ops.object.modifier_apply(modifier=finish.name)
            wrap = obj.modifiers.new(
                "Polished cloth ease on artist anatomy", "SHRINKWRAP"
            )
            wrap.target = body
            wrap.wrap_method = "NEAREST_SURFACEPOINT"
            wrap.wrap_mode = "ABOVE_SURFACE"
            wrap.offset = 0.006
            bpy.ops.object.modifier_apply(modifier=wrap.name)
            # Finish after conforming too, so nearest-surface changes do not
            # reintroduce the uneven neckline which motivated this edit.
            finish = obj.modifiers.new("Final textile hem relaxation", "SMOOTH")
            finish.factor = 0.2
            finish.iterations = 6
            bpy.ops.object.modifier_apply(modifier=finish.name)
            edge = obj.modifiers.new("Polished garment edge thickness", "SOLIDIFY")
            edge.thickness = 0.0008
            edge.offset = -1
            bpy.ops.object.modifier_apply(modifier=edge.name)
        else:
            # Keep the existing authored seam; lift it off the skin to avoid
            # broken/dotted intersections, without moving the body itself.
            for vertex in obj.data.vertices:
                _, normal, _, _ = tree.find_nearest(vertex.co)
                assert normal is not None
                vertex.co += normal * 0.0012
            obj.data.update()
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        rebind(body, obj)
        skin = obj.modifiers.new(
            "Polished authored surface skin - QA required", "ARMATURE"
        )
        skin.object = rig
        print("SURFACE POLISH", obj.name, "vertices", len(obj.data.vertices))

bpy.context.scene["bodyguard_stage"] = (
    "S2.4 surface-polished candidate; all QA pending; NOT release approved"
)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
