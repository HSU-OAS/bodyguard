"""FR-A-01~04: native contour cuts/polish of the existing CC0 artist surface.

Blender -b explicit-candidate.blend --python-exit-code 1 --python this.py
  -- new-candidate.blend new-preview-directory
The original file/rig is not saved; preview is not QA or a medical demonstration.
Run review_avatar.py on both the new source and exported GLB roundtrip.
"""

import sys
from math import exp, isfinite, tanh
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

output, previews = map(Path, sys.argv[sys.argv.index("--") + 1 :])
if output.exists() or output.resolve() == Path(bpy.data.filepath).resolve():
    raise FileExistsError("Use a new candidate; never overwrite the edited source")
if previews.exists():
    raise FileExistsError("Use a new preview directory")
previews.mkdir(parents=True)
scene = bpy.context.scene


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def garment(body, name, fields, material):
    # A-02 root cause: centroid face removal produces stair-step cloth edges.
    # Native bisect interpolates original positions AND deform data at the cut.
    # Only this temporary copy uses signed Z; restore the actual artist surface.
    obj = body.copy()
    obj.data = body.data.copy()
    obj.name = name
    scene.collection.objects.link(obj)
    obj.modifiers.clear()
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    deform = bm.verts.layers.deform.active
    assert deform is not None, "Artist surface must carry deform weights"
    original = bm.verts.layers.float_vector.new("Tailor original surface")
    for field in fields:
        for vertex in bm.verts:
            vertex[original] = vertex.co.copy()
            vertex.co.z = field(vertex, deform)
        bmesh.ops.bisect_plane(
            bm,
            geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
            plane_co=(0, 0, 0),
            plane_no=(0, 0, 1),
            dist=1e-8,
            clear_inner=True,
        )
        for vertex in bm.verts:
            vertex.co = vertex[original]
    bm.verts.layers.float_vector.remove(original)
    bmesh.ops.delete(
        bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS"
    )
    assert len(bm.faces) > 100, "Empty/fragmented tailored garment"
    boundary = [v for v in bm.verts if v.is_boundary]
    assert boundary and all(
        sum(e.is_boundary for e in v.link_edges) == 2 for v in boundary
    ), "Non-simple contour; do not hide malformed cuts"
    deform = bm.verts.layers.deform.active
    assert deform is not None and all(
        abs(sum(v[deform].values()) - 1) < 0.01 for v in bm.verts
    ), "Native cut lost normalized artist weights"
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.materials.clear()
    obj.data.materials.append(material)
    active(obj)
    finish = obj.modifiers.new("Continuous tailored contour", "SUBSURF")
    finish.levels = finish.render_levels = 1
    bpy.ops.object.modifier_apply(modifier=finish.name)
    wrap = obj.modifiers.new("Artist textile ease - QA required", "SHRINKWRAP")
    wrap.target = body
    wrap.wrap_method = "NEAREST_SURFACEPOINT"
    wrap.wrap_mode = "ABOVE_SURFACE"
    # A-02: two garments on the same 6mm surface flicker in their waist overlap.
    # Keep the shorts' validated ease; place the top on a separate outer layer.
    wrap.offset = 0.008 if "tank" in name else 0.006
    bpy.ops.object.modifier_apply(modifier=wrap.name)
    edge = obj.modifiers.new("Thin tailored textile edge", "SOLIDIFY")
    edge.thickness = 0.0008
    edge.offset = -1
    bpy.ops.object.modifier_apply(modifier=edge.name)
    assert all(
        isfinite(total := sum(g.weight for g in v.groups)) and abs(total - 1) < 0.01
        for v in obj.data.vertices
    ), "Tailoring altered skin normalization"
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    skin = obj.modifiers.new("Tailored artist weights - QA required", "ARMATURE")
    skin.object = body.modifiers[0].object
    print("TAILORED SURFACE", name, "vertices", len(obj.data.vertices))
    return obj


for label in ("Male", "Female"):
    body = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"]
    rig = bpy.data.objects[f"BODYGUARD {label} rig WIP"]
    assert len(body.modifiers) == 1 and body.modifiers[0].object == rig
    assert all(bone.matrix_basis.is_identity for bone in rig.pose.bones)
    before = [tuple((g.group, g.weight) for g in v.groups) for v in body.data.vertices]
    height = max(v.co.z for v in body.data.vertices)
    wrist_planes = []
    for side in ("L", "R"):
        wrist = rig.data.bones[f"wrist.{side}"]
        to_body = body.matrix_world.inverted() @ rig.matrix_world
        center = to_body @ wrist.head_local
        direction = (
            to_body.to_3x3() @ (wrist.tail_local - wrist.head_local)
        ).normalized()
        wrist_planes.append((center, direction))
    active(body)
    mask = body.vertex_groups.new(name="Artist seam-only finish")
    mask_name = mask.name
    untouched = {}
    for vertex in body.data.vertices:
        p = vertex.co / height
        neck = exp(-((p.x / 0.052) ** 2)) * max(0, 1 - abs(p.z - 0.862) / 0.04)
        wrist = max(
            (
                max(0, 1 - abs((vertex.co - center).dot(direction)) / 0.035)
                if (vertex.co - center).length < 0.065
                else 0
            )
            for center, direction in wrist_planes
        )
        pelvis = (
            max(0, 1 - abs(p.x) / 0.09) * max(0, 1 - abs(p.z - 0.50) / 0.065)
            if label == "Male"
            else 0
        )
        weight = max(neck, wrist, pelvis)
        if weight:
            mask.add([vertex.index], weight, "REPLACE")
        else:
            untouched[vertex.index] = vertex.co.copy()
    # Global volume correction moved unselected vertices in the rejected A30
    # attempt. Use native edge-length-weighted local smoothing, never restore
    # unrelated vertices afterwards just to hide that failed boundary check.
    finish = body.modifiers.new("Length-aware artist seam surface", "CORRECTIVE_SMOOTH")
    finish.vertex_group = mask_name
    finish.factor = 0.35
    finish.iterations = 12
    finish.smooth_type = "LENGTH_WEIGHTED"
    finish.use_only_smooth = True
    bpy.ops.object.modifier_move_up(modifier=finish.name)
    bpy.ops.object.modifier_apply(modifier=finish.name)
    body.vertex_groups.remove(body.vertex_groups[mask_name])
    assert all(
        (body.data.vertices[i].co - p).length < 1e-6 for i, p in untouched.items()
    ), "Local seam polish changed an unrelated part of the artist surface"
    assert before == [
        tuple((g.group, g.weight) for g in v.groups) for v in body.data.vertices
    ], "Surface polish must preserve every original skin weight and vertex"
    # Remove only temporary candidate garments, not the original .blend file.
    old = [
        o
        for o in scene.objects
        if o.name.startswith(f"BODYGUARD {label}") and "draft" in o.name
    ]
    material = old[0].data.materials[0]
    for obj in old:
        bpy.data.objects.remove(obj, do_unlink=True)
    if label == "Female":
        arm_groups = {
            g.index
            for g in body.vertex_groups
            if g.name.startswith(
                ("upperarm", "lowerarm", "wrist", "finger", "metacarpal")
            )
        }

        # All dimensions are artist pattern coordinates, NOT human/clinical thresholds.
        def neck(v, deform, height=height):
            x, y, z = v.co / height
            return (
                0.830
                - (0.045 - 0.015 * tanh(y / 0.012)) * max(0, 1 - (x / 0.079) ** 2)
                - z
            )

        def armhole(v, deform, height=height):
            x, _, z = v.co / height
            t = min(1, max(0, (z - 0.71) / 0.09))
            return 0.120 - 0.025 * t * t * (3 - 2 * t) - abs(x)

        garment(
            body,
            "BODYGUARD Female tank draft",
            [
                lambda v, d, height=height: v.co.z / height - 0.555,
                neck,
                armhole,
                lambda v, d, groups=arm_groups: (
                    0.15 - sum(v[d].get(i, 0) for i in groups)
                ),
            ],
            material,
        )
        garment(
            body,
            "BODYGUARD Female shorts draft",
            [
                lambda v, d, height=height: v.co.z / height - 0.397,
                lambda v, d, height=height: 0.564 - v.co.z / height,
                lambda v, d, height=height: 0.15 - abs(v.co.x) / height,
            ],
            material,
        )

scene["bodyguard_stage"] = (
    "S2.4 tailored candidate; ALL QA pending; NOT release approved"
)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
scene.render.resolution_x = 1400
scene.render.resolution_y = 1000
scene.cycles.samples = 24
camera = scene.camera
for name, label, location, target, scale in (
    ("front", "", (0, -5, 0.84), (0, 0, 0.84), 2.8),
    ("female-back", "Female", (0, 4, 0.83), (0, 0, 0.83), 1.95),
    ("female-hand", "Female", (0.43, -2, 0.75), (0.34, 0, 0.75), 0.42),
    ("female-neck", "Female", (0, -4, 1.42), (0, 0, 1.42), 0.7),
):
    for obj in scene.objects:
        if (
            obj.type == "MESH"
            and obj.name.startswith("BODYGUARD ")
            and "review ground" not in obj.name
        ):
            obj.hide_render = bool(
                label and not obj.name.startswith(f"BODYGUARD {label}")
            )
    if label:
        x = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"].matrix_world.translation.x
        location = (x + location[0], *location[1:])
        target = (x + target[0], *target[1:])
    camera.location = location
    camera.rotation_euler = (
        (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    camera.data.ortho_scale = scale
    scene.render.filepath = str(previews / f"{name}.png")
    bpy.ops.render.render(write_still=True)
print("ART PREVIEW ONLY; source/GLB deformation and browser QA still required", output)
