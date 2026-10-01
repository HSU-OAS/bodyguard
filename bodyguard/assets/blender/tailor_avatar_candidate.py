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


def rebuild_wrist_seams(body, wrist_planes):
    # A-02 root cause: the capped Boolean union left thin overlapping fins.
    # Cut only the joined wrist band; bridge the existing professional surfaces.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    original = bm.verts.layers.int.new("Original artist vertex")
    deform = bm.verts.layers.deform.active
    assert deform is not None
    arm_groups = {
        g.index
        for g in body.vertex_groups
        if g.name.startswith(("lowerarm", "wrist", "finger", "metacarpal"))
    }

    def wrist_vertex(vertex, center):
        # A rest wrist is near the thigh: a sphere alone also cuts the leg.
        # Use the existing authored arm weights to exclude that other surface.
        return (vertex.co - center).length < 0.13 and sum(
            vertex[deform].get(i, 0) for i in arm_groups
        ) > 0.25

    retained = {v.index + 1: (v.co.copy(), dict(v[deform])) for v in bm.verts}
    distal = {i + 1 for i in body["bodyguard_distal_hand_vertices"]}
    for v in bm.verts:
        v[original] = v.index + 1
    for center, direction in wrist_planes:
        for offset in (-0.08, 0.009):
            faces = [f for f in bm.faces if any(wrist_vertex(v, center) for v in f.verts)]
            edges = {e for f in faces for e in f.edges}
            vertices = {v for f in faces for v in f.verts}
            before = set(bm.verts)
            bmesh.ops.bisect_plane(
                bm,
                geom=list(vertices) + list(edges) + faces,
                plane_co=center + direction * offset,
                plane_no=direction,
                dist=1e-8,
            )
            for v in set(bm.verts) - before:
                v[original] = 0
        faces = [
            f
            for f in bm.faces
            if all(wrist_vertex(v, center) for v in f.verts)
            and -0.08 + 1e-7 < (f.calc_center_median() - center).dot(direction) < 0.009 - 1e-7
        ]
        assert faces, "No joined wrist band selected"
        bmesh.ops.delete(bm, geom=faces, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        boundary = {e for e in bm.edges if e.is_boundary}
        assert boundary and all(
            sum(e.is_boundary for e in v.link_edges) == 2 for e in boundary for v in e.verts
        ), "Wrist cut did not produce simple closed contours"
        loops = []
        remaining = set(boundary)
        while remaining:
            loop = {remaining.pop()}
            stack = list(loop)
            while stack:
                for vertex in stack.pop().verts:
                    for edge in vertex.link_edges:
                        if edge in remaining:
                            remaining.remove(edge)
                            loop.add(edge)
                            stack.append(edge)
            loops.append(loop)
        print(
            "WRIST CUT CONTOURS",
            body.name,
            [
                {
                    "edges": len(loop),
                    "radius_max": max((v.co - center).length for e in loop for v in e.verts),
                    "plane_range": (
                        min((v.co - center).dot(direction) for e in loop for v in e.verts),
                        max((v.co - center).dot(direction) for e in loop for v in e.verts),
                    ),
                }
                for loop in loops
            ],
        )
        assert len(loops) == 2, f"Expected two wrist contours, got {len(loops)}"
        assert all((v.co - center).length < 0.13 for e in boundary for v in e.verts), (
            "Cut escaped the wrist region"
        )
        # Native surface interpolation follows the neighbouring artist faces;
        # do not own a linear loft/subdivision/smoothing pipeline for this band.
        before = {tuple(v.co): v[original] for v in bm.verts}
        for element in list(bm.verts) + list(bm.edges) + list(bm.faces):
            element.select = False
        for edge in boundary:
            edge.select_set(True)
        bm.to_mesh(body.data)
        bm.free()
        active(body)
        bpy.context.scene.tool_settings.mesh_select_mode = (False, True, False)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.bridge_edge_loops(
            type="SINGLE", number_cuts=6, interpolation="SURFACE", smoothness=1.0
        )
        bpy.ops.object.mode_set(mode="OBJECT")
        bm = bmesh.new()
        bm.from_mesh(body.data)
        original = bm.verts.layers.int.get("Original artist vertex")
        deform = bm.verts.layers.deform.active
        assert original is not None and deform is not None
        for vertex in bm.verts:
            vertex[original] = before.get(tuple(vertex.co), 0)
        assert all(edge.is_manifold for edge in bm.edges), (
            "Native surface bridge opened the professional mesh"
        )
        print("NATIVE WRIST BRIDGE", body.name, [len(x) for x in loops])
    bm.verts.index_update()
    remap = {v[original]: v.index for v in bm.verts if v[original]}
    print(
        "MISSING HAND QA",
        body.name,
        len(distal - remap.keys()),
        [
            {
                "original": i - 1,
                "position": tuple(retained[i][0]),
                "planes": [(retained[i][0] - c).dot(d) for c, d in wrist_planes],
            }
            for i in sorted(distal - remap.keys())[:4]
        ],
    )
    assert distal <= remap.keys(), "Wrist repair removed authored hand QA vertices"
    assert all(
        any(
            (p - center).length < 0.13
            and -0.080001 <= (p - center).dot(direction) <= 0.009001
            and sum(weights.get(i, 0) for i in arm_groups) > 0.25
            for center, direction in wrist_planes
        )
        for key, (p, weights) in retained.items()
        if key not in remap
    ), "Wrist repair removed an unrelated professional vertex"
    assert all(
        (v.co - retained[v[original]][0]).length < 1e-6
        and dict(v[deform]) == retained[v[original]][1]
        for v in bm.verts
        if v[original]
    ), "Wrist repair changed retained professional coordinates/weights"
    assert all(
        isfinite(total := sum(v[deform].values())) and abs(total - 1) < 0.01 for v in bm.verts
    ), "Native wrist interpolation lost normalized skin weights"
    body["bodyguard_distal_hand_vertices"] = [remap[i] for i in sorted(distal)]
    bm.verts.layers.int.remove(original)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(body.data)
    bm.free()
    for polygon in body.data.polygons:
        polygon.use_smooth = True


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
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    assert len(bm.faces) > 100, "Empty/fragmented tailored garment"
    remaining = set(bm.verts)
    stack = [remaining.pop()]
    while stack:
        for edge in stack.pop().link_edges:
            for vertex in edge.verts:
                if vertex in remaining:
                    remaining.remove(vertex)
                    stack.append(vertex)
    assert not remaining, "Detached arm/other surface remained in the garment"
    boundary = [v for v in bm.verts if v.is_boundary]
    assert boundary and all(sum(e.is_boundary for e in v.link_edges) == 2 for v in boundary), (
        "Non-simple contour; do not hide malformed cuts"
    )
    deform = bm.verts.layers.deform.active
    assert deform is not None and all(abs(sum(v[deform].values()) - 1) < 0.01 for v in bm.verts), (
        "Native cut lost normalized artist weights"
    )
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
    finish = obj.modifiers.new("Local cloth fairing - QA required", "SMOOTH")
    finish.factor = 0.4
    finish.iterations = 6
    bpy.ops.object.modifier_apply(modifier=finish.name)
    edge = obj.modifiers.new("Thin tailored textile edge", "SOLIDIFY")
    edge.thickness = 0.0008
    edge.offset = -1
    bpy.ops.object.modifier_apply(modifier=edge.name)
    rim = obj.modifiers.new("Soft tailored rim - QA required", "BEVEL")
    rim.limit_method = "ANGLE"
    rim.angle_limit = 0.6
    rim.width = 0.0003
    rim.segments = 2
    bpy.ops.object.modifier_apply(modifier=rim.name)
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
        direction = (to_body.to_3x3() @ (wrist.tail_local - wrist.head_local)).normalized()
        wrist_planes.append((center, direction))
    active(body)
    mask = body.vertex_groups.new(name="Artist seam-only finish")
    mask_name = mask.name
    untouched = {}
    for vertex in body.data.vertices:
        p = vertex.co / height
        neck = exp(-((p.x / 0.075) ** 2)) * max(0, 1 - abs(p.z - 0.862) / 0.055)
        pelvis = (
            max(0, 1 - abs(p.x) / 0.09) * max(0, 1 - abs(p.z - 0.50) / 0.065)
            if label == "Male"
            else 0
        )
        weight = max(neck, pelvis)
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
    assert all((body.data.vertices[i].co - p).length < 1e-6 for i, p in untouched.items()), (
        "Local seam polish changed an unrelated part of the artist surface"
    )
    assert before == [tuple((g.group, g.weight) for g in v.groups) for v in body.data.vertices], (
        "Surface polish must preserve every original skin weight and vertex"
    )
    # The minimal garment-only comparison retained the old wrist crease. Keep
    # native local retopology, with original hand/outside vertices guarded.
    rebuild_wrist_seams(body, wrist_planes)
    # Remove only temporary candidate garments, not the original .blend file.
    old = [
        o for o in scene.objects if o.name.startswith(f"BODYGUARD {label}") and "draft" in o.name
    ]
    material = old[0].data.materials[0]
    for obj in old:
        bpy.data.objects.remove(obj, do_unlink=True)
    # Flat circular shoulder appliques looked like stickers, not the reference
    # anatomy. Keep the professional shoulder surface and elbow/knee contours.
    for obj in list(scene.objects):
        if obj.name.startswith(f"BODYGUARD {label} joint edge upperarm01."):
            bpy.data.objects.remove(obj, do_unlink=True)
    if label == "Female":
        arm_groups = {
            g.index
            for g in body.vertex_groups
            if g.name.startswith(("upperarm", "lowerarm", "wrist", "finger", "metacarpal"))
        }

        # All dimensions are artist pattern coordinates, NOT human/clinical thresholds.
        def neck(v, deform, height=height):
            x, y, z = v.co / height
            return 0.830 - (0.045 - 0.015 * tanh(y / 0.012)) * max(0, 1 - (x / 0.079) ** 2) - z

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
                lambda v, d, groups=arm_groups: 0.15 - sum(v[d].get(i, 0) for i in groups),
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
                # Arms hang beside the pelvis. XYZ bounds alone leave detached
                # arm patches that masquerade as wrist fins in the shorts.
                lambda v, d, groups=arm_groups: 0.15 - sum(v[d].get(i, 0) for i in groups),
            ],
            material,
        )

scene["bodyguard_stage"] = "S2.4 tailored candidate; ALL QA pending; NOT release approved"
# Studio presentation, not a change to surface/clinical acceptance criteria.
key = bpy.data.objects["BODYGUARD review key"]
key.location = (-3, -2, 3.5)
key.rotation_euler = (Vector((0, 0, 1)) - key.location).to_track_quat("-Z", "Y").to_euler()
key.data.size = 1.5
bpy.data.objects["BODYGUARD review fill"].data.energy = 60
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
    ("male-hand", "Male", (0.43, -2, 0.75), (0.34, 0, 0.75), 0.42),
    ("male-neck", "Male", (0, -4, 1.42), (0, 0, 1.42), 0.7),
):
    for obj in scene.objects:
        if (
            obj.type == "MESH"
            and obj.name.startswith("BODYGUARD ")
            and "review ground" not in obj.name
        ):
            obj.hide_render = bool(label and not obj.name.startswith(f"BODYGUARD {label}"))
    if label:
        x = bpy.data.objects[f"BODYGUARD {label} sculpt WIP"].matrix_world.translation.x
        location = (x + location[0], *location[1:])
        target = (x + target[0], *target[1:])
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.ortho_scale = scale
    scene.render.filepath = str(previews / f"{name}.png")
    bpy.ops.render.render(write_still=True)
print("ART PREVIEW ONLY; source/GLB deformation and browser QA still required", output)
