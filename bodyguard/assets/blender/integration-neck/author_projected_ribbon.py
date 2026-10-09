"""FR-A-02/03/08: native projected-domain ribbons protect a professional rear-head patch.

No generated primitive human, source overwrite, clinical target or public asset.
Blender --factory-startup --disable-autoexec -b candidate-unapproved.blend
  --python-exit-code 1 --python author_projected_ribbon.py
  -- new.blend report.json segment input-sha256
"""

import hashlib
import json
import math
import sys
from bisect import bisect_right
from collections import Counter, deque
from pathlib import Path
from statistics import median

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from artist_snapshot_values import snapshot
from projected_ribbon import fill as fill_projected_ribbon

HISTORY_ARRAYS = (
    "bodyguard_authoring_a123_original_ids",
    "bodyguard_a146_parent_ids",
    "bodyguard_a195_parent_ids",
)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def region(point, height, limits, side):
    return (
        point.y > 0
        and abs(point.x) / height < 0.1
        and limits[0] < point.z / height < limits[1]
        and (side == 0 or point.x * side > 0)
    )


def boundary(faces):
    return {
        e
        for f in faces
        for e in f.edges
        if sum(other in faces for other in e.link_faces) == 1
    }


def canonical(values):
    values = tuple(values)
    first = values.index(min(values))
    return values[first:] + values[:first]


def geometry(body):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.normal_update()
        return {
            "vertices": len(mesh.verts),
            "faces": len(mesh.faces),
            "nonmanifold": sum(not e.is_manifold for e in mesh.edges),
            "winding": sum(not e.is_contiguous for e in mesh.edges if e.is_manifold),
            "tiny_faces": sum(f.calc_area() < 1e-10 for f in mesh.faces),
        }
    finally:
        mesh.free()


def fixed_state(body, rig):
    state = snapshot(body, rig)
    for key in ("points", "skin", "faces", "point_ledger", "hands"):
        state.pop(key)
    for key in (*HISTORY_ARRAYS, "bodyguard_distal_hand_vertices"):
        state["properties"].pop(key)
    return state


def section_grid(body, zmin, zmax, rows, columns, margin, outer_polygon):
    """Read private native cuts; never fit the core to the old folded patch."""
    positions = []
    observations = []
    for row in range(rows + 1):
        z = zmin + margin + (zmax - zmin - 2 * margin) * row / rows
        source = bmesh.new()
        try:
            source.from_mesh(body.data)
            cut = bmesh.ops.bisect_plane(
                source,
                geom=[*source.verts, *source.edges, *source.faces],
                dist=1e-8,
                plane_co=Vector((0, 0, z)),
                plane_no=Vector((0, 0, 1)),
                clear_inner=False,
                clear_outer=False,
                use_snap_center=False,
            )
            source.normal_update()
            edges = {
                item for item in cut["geom_cut"] if isinstance(item, bmesh.types.BMEdge)
            }
            points = {v for edge in edges for v in edge.verts}
            assert edges and all(
                sum(edge in edges for edge in v.link_edges) == 2 for v in points
            ), "Original cross-section is not a closed simple loop"
            # One connected loop, not a second body part or self-touching cut.
            pending, reached = deque([next(iter(points))]), set()
            while pending:
                vertex = pending.popleft()
                if vertex in reached:
                    continue
                reached.add(vertex)
                pending.extend(
                    edge.other_vert(vertex)
                    for edge in vertex.link_edges
                    if edge in edges
                )
            assert reached == points, "Original cross-section contains multiple loops"
            rear = {edge for edge in edges if all(v.co.y > 0 for v in edge.verts)}
            rear_points = {v for edge in rear for v in edge.verts}
            degrees = Counter(v for edge in rear for v in edge.verts)
            assert rear and sum(degree == 1 for degree in degrees.values()) == 2
            assert all(degree in (1, 2) for degree in degrees.values())
            ordered = sorted(rear_points, key=lambda v: v.co.x)
            ids = {v: index for index, v in enumerate(ordered)}
            assert all(
                abs(ids[edge.verts[0]] - ids[edge.verts[1]]) == 1 for edge in rear
            ), "Original rear guide is not a single monotone cross-section"
            assert all(ordered[i + 1].co.x > v.co.x for i, v in enumerate(ordered[:-1]))
            angle = max(edge.calc_face_angle() for edge in rear if edge.is_manifold)
            assert angle < math.pi / 2, "Original rear guide crosses a folded face"
            # The positive-Y native body cut is wider than the selected hole.
            # Keep every new row strictly inside the ORIGINAL projected domain.
            crossings = []
            for i, (ax, az) in enumerate(outer_polygon):
                bx, bz = outer_polygon[(i + 1) % len(outer_polygon)]
                if (az > z) != (bz > z):
                    crossings.append(ax + (bx - ax) * (z - az) / (bz - az))
            assert len(crossings) >= 2 and len(crossings) % 2 == 0
            sorted_crossings = sorted(crossings)
            intervals = list(zip(sorted_crossings[::2], sorted_crossings[1::2]))
            central = [(left, right) for left, right in intervals if left < 0 < right]
            assert len(central) == 1, (
                "Original projected row has no unique central interior"
            )
            hole_left, hole_right = central[0]
            left = max(ordered[0].co.x, hole_left) + margin
            right = min(ordered[-1].co.x, hole_right) - margin
            assert right > left, "Cross-section has no protected inner width"
            xs = [v.co.x for v in ordered]
            values = []
            for column in range(columns + 1):
                x = left + (right - left) * column / columns
                index = bisect_right(xs, x) - 1
                assert 0 <= index < len(ordered) - 1, "No guide extrapolation"
                first, last = ordered[index].co, ordered[index + 1].co
                y = first.y + (last.y - first.y) * (x - first.x) / (last.x - first.x)
                assert y > 0 and all(math.isfinite(v) for v in (x, y, z))
                values.append(Vector((x, y, z)))
            positions.append(values)
            observations.append(
                {
                    "row": row,
                    "z_m": z,
                    "rear_points": len(ordered),
                    "maximum_rear_dihedral_degrees": math.degrees(angle),
                    "connected_monotone_guide": True,
                    "projected_original_interval_m": [hole_left, hole_right],
                    "original_projected_intervals_m": intervals,
                    "unique_central_interior": True,
                    "inner_interval_m": [left, right],
                }
            )
        finally:
            source.free()
    return positions, observations


def constrain_native_grid(faces, rows, columns, positions, marker):
    """Keep native quad connections, bind all new grid points to real section rows."""
    vertices = {v for face in faces for v in face.verts}
    edges = {edge for face in faces for edge in face.edges}
    corners = {v[marker]: v for v in vertices if v[marker] != 0}
    assert set(corners) == {1, 2, 3, 4}

    def distances(start):
        result, queue = {start: 0}, deque([start])
        while queue:
            current = queue.popleft()
            for edge in current.link_edges:
                if edge not in edges:
                    continue
                other = edge.other_vert(current)
                if other not in result:
                    result[other] = result[current] + 1
                    queue.append(other)
        assert set(result) == vertices
        return result

    first, second = distances(corners[1]), distances(corners[2])
    assert first[corners[2]] == rows and first[corners[4]] == columns
    used = set()
    for vertex in vertices:
        numerator = first[vertex] - second[vertex] + rows
        assert numerator % 2 == 0, "Native grid is not rectangular topology"
        row = numerator // 2
        column = first[vertex] - row
        assert 0 <= row <= rows and 0 <= column <= columns
        assert (row, column) not in used
        used.add((row, column))
        vertex.co = positions[row][column]
    assert len(used) == (rows + 1) * (columns + 1)


def projected_inside(point, polygon):
    x, z = point.x, point.z
    crossings = 0
    for i, (ax, az) in enumerate(polygon):
        bx, bz = polygon[(i + 1) % len(polygon)]
        if (az > z) != (bz > z) and x < ax + (bx - ax) * (z - az) / (bz - az):
            crossings += 1
    return crossings % 2 == 1


def rear_intersections(tree, probes):
    counts = []
    for x, z in probes:
        start = Vector((x, 1, z))
        count = 0
        for _ in range(16):
            position, _, _, _ = tree.ray_cast(start, Vector((0, -1, 0)), 2)
            if position is None or position.y <= 0:
                break
            count += 1
            start = position - Vector((0, 1e-6, 0))
        else:
            raise AssertionError("Rear intersection count exceeded inspection cap")
        counts.append(count)
    return counts


args = sys.argv[sys.argv.index("--") + 1 :]
assert len(args) in (4, 5)
target, output = map(Path, args[:2])
segment, INPUT_SHA = args[2:4]
diagnostic = len(args) == 5
assert not diagnostic or args[4] == "diagnostic"
assert segment == "occipital", "This guide is validated only for the rear-head section"
assert len(INPUT_SHA) == 64 and all(c in "0123456789abcdef" for c in INPUT_SHA)
ORIGIN = f"integration sectioned original {segment}"
CORNER = f"integration sectioned corner {segment}"
loaded = Path(bpy.data.filepath)
assert digest(loaded) == INPUT_SHA
assert bpy.app.version_string == "5.1.1"
assert not target.exists() and not output.exists()
assert target.resolve() != loaded.resolve()
report = {
    "input_sha256": INPUT_SHA,
    "blender": bpy.app.version_string,
    "passed": False,
    "appearance_approved": False,
    "clinical_or_camera_work": False,
    "segment": segment,
    "diagnostic_no_save": diagnostic,
    "rows": [],
}
try:
    for gender in ("Male", "Female"):
        body = bpy.data.objects[f"BODYGUARD {gender} sculpt WIP"]
        rig = bpy.data.objects[f"BODYGUARD {gender} rig WIP"]
        before = snapshot(body, rig)
        fixed = fixed_state(body, rig)
        old_geometry = geometry(body)
        points = [v.co.copy() for v in body.data.vertices]
        history = {key: list(body[key]) for key in HISTORY_ARRAYS}
        assert all(len(values) == len(points) for values in history.values())
        assert body.data.shape_keys is None
        assert len(body.modifiers) == 1 and body.modifiers[0].type == "ARMATURE"
        assert all(pb.matrix_basis.is_identity for pb in rig.pose.bones)
        # Preserve the professional mesh as a private native weight-transfer source.
        # It is not saved or published and is removed before the final snapshot.
        skin_source = body.copy()
        skin_source.data = body.data.copy()
        skin_source.name = f"Private native skin source - {gender}"
        bpy.context.scene.collection.objects.link(skin_source)
        skin_source.hide_render = True
        mesh = bmesh.new()
        try:
            mesh.from_mesh(body.data)
            mesh.verts.ensure_lookup_table()
            mesh.faces.ensure_lookup_table()
            mesh.normal_update()
            assert body.data.attributes.get(ORIGIN) is None
            # Create CustomData before retaining element wrappers/boundary refs.
            mesh.verts.layers.int.new(ORIGIN)
            mesh.verts.layers.int.new(CORNER)
            origin = mesh.verts.layers.int[ORIGIN]
            corner_marker = mesh.verts.layers.int[CORNER]
            mesh.verts.index_update()
            for vertex in mesh.verts:
                assert tuple(vertex.co) == before["points"][vertex.index]
                vertex[origin] = vertex.index
            height = max(v.co.z for v in mesh.verts)
            rig_to_body = body.matrix_world.inverted() @ rig.matrix_world
            lower = (rig_to_body @ rig.data.bones["neck01"].head_local).z / height
            upper = (rig_to_body @ rig.data.bones["neck02"].tail_local).z / height
            assert 0.82 < lower < upper < 0.94
            limits, side = {
                "occipital": ((upper, 0.94), 0),
                "neck": ((lower, upper), 0),
                "shoulder-left": ((0.82, lower), -1),
                "shoulder-right": ((0.82, lower), 1),
            }[segment]
            chosen = {
                f
                for f in mesh.faces
                if all(region(v.co, height, limits, side) for v in f.verts)
            }
            # Only shrink the selection at touching boundaries; never enter front.
            pruned = []
            for _ in range(8):
                borders = boundary(chosen)
                incidence = Counter(v for e in borders for v in e.verts)
                bad = {v for v, degree in incidence.items() if degree != 2}
                if not bad:
                    break
                remove = {f for f in chosen if any(v in bad for v in f.verts)}
                assert remove
                pruned.append(len(remove))
                chosen -= remove
            else:
                raise AssertionError("Patch boundary did not become regular")
            assert len(chosen) > 500
            borders = boundary(chosen)
            successor = {}
            for edge in borders:
                face = next(f for f in edge.link_faces if f in chosen)
                loop = next(loop for loop in face.loops if loop.edge == edge)
                assert loop.vert not in successor
                successor[loop.vert] = loop.link_loop_next.vert
            start = min(successor, key=lambda v: v.index)
            ordered = [start]
            next_point = successor[start]
            while next_point != start:
                assert next_point not in ordered, "Multiple/self-touching boundary"
                ordered.append(next_point)
                next_point = successor[next_point]
            assert len(ordered) == len(borders), "Patch has more than one opening"
            protected = {
                v.index
                for v in mesh.verts
                if any(f not in chosen for f in v.link_faces)
            }
            protected |= {v.index for v in ordered}
            assert all(i in protected for i in before["hands"])
            assert all(i in protected for i, p in enumerate(points) if p.y <= 0)
            outside_faces = Counter(
                (canonical(v.index for v in f.verts), f.material_index, f.smooth)
                for f in mesh.faces
                if f not in chosen
            )
            selected_ids = {f.index for f in chosen}
            body.data.calc_loop_triangles()
            triangles = [
                tuple(t.vertices)
                for t in body.data.loop_triangles
                if t.polygon_index in selected_ids
            ]
            tree = BVHTree.FromPolygons(points, triangles, all_triangles=True)
            # Faces-only removal followed by internal-only orphan removal.
            assert all(v.is_valid for v in ordered), (
                "Boundary refs invalid before removal"
            )
            bmesh.ops.delete(mesh, geom=list(chosen), context="FACES_ONLY")
            assert all(v.is_valid for v in ordered), (
                "Boundary lost in face-only removal"
            )
            unused = [
                v for v in mesh.verts if not v.link_faces and v[origin] not in protected
            ]
            bmesh.ops.delete(mesh, geom=unused, context="VERTS")
            assert all(v.is_valid for v in ordered), (
                "Boundary lost in internal vertex removal"
            )
            # Removing only faces can leave chords between retained boundary points.
            bmesh.ops.delete(
                mesh, geom=[e for e in mesh.edges if e.is_wire], context="EDGES_FACES"
            )
            assert all(v.is_valid for v in ordered)
            transition = None
            if len(ordered) % 2:
                # Odd boundaries mathematically require one triangular transition.
                candidates = []
                for i, v in enumerate(ordered):
                    first, last = ordered[i - 1], ordered[(i + 1) % len(ordered)]
                    turn = (v.co - first.co).cross(last.co - v.co)
                    if turn.y > 1e-9 and mesh.edges.get((first, last)) is None:
                        candidates.append((turn.y, i))
                assert candidates, "No convex native triangle transition"
                _, offset = max(candidates)
                triangle = (
                    ordered[offset - 1],
                    ordered[offset],
                    ordered[(offset + 1) % len(ordered)],
                )
                transition = mesh.faces.new(triangle)
                transition.smooth = True
                ordered.pop(offset)
            # Define the corner and column count geometrically, not by vertex ID.
            xmin, xmax = min(v.co.x for v in ordered), max(v.co.x for v in ordered)
            zmin, zmax = min(v.co.z for v in ordered), max(v.co.z for v in ordered)
            assert xmax > xmin and zmax > zmin
            corners = [
                min(
                    ordered,
                    key=lambda v, x=x, z=z: (
                        ((v.co.x - x) / (xmax - xmin)) ** 2
                        + ((v.co.z - z) / (zmax - zmin)) ** 2
                    ),
                )
                for x, z in ((xmin, zmin), (xmin, zmax), (xmax, zmax), (xmax, zmin))
            ]
            assert len(set(corners)) == 4, "Patch does not have four distinct corners"
            corner_offset = ordered.index(corners[0])
            steps = [
                (ordered.index(v) - corner_offset) % len(ordered) for v in corners[1:]
            ]
            corner_ids = [v[origin] for v in corners]
            assert (
                corners[0].co.z < corners[1].co.z and corners[3].co.z < corners[2].co.z
            )
            assert (
                corners[0].co.x < corners[3].co.x and corners[1].co.x < corners[2].co.x
            )
            # A transition ribbon preserves the uneven professional outer boundary.
            # Only its new inner loop is sampled with equal opposite side counts.
            ordered = ordered[corner_offset:] + ordered[:corner_offset]
            cuts = [0, *sorted(steps), len(ordered)]
            intervals = [cuts[i + 1] - cuts[i] for i in range(4)]
            counts = [min(intervals[0], intervals[2]), min(intervals[1], intervals[3])]
            assert min(counts) >= 2
            margin = min(
                0.002,
                2
                * median(
                    (ordered[(i + 1) % len(ordered)].co - v.co).length
                    for i, v in enumerate(ordered)
                ),
            )
            assert 2 * margin < min(xmax - xmin, zmax - zmin)
            # Derive the core span from the actual four-sided boundary arcs,
            # not global extrema of the clipped / jagged outer perimeter.
            bottom_arc = ordered[cuts[3] :] + [ordered[0]]
            top_arc = ordered[cuts[1] : cuts[2] + 1]
            domain_min = max(v.co.z for v in bottom_arc)
            domain_max = min(v.co.z for v in top_arc)
            assert domain_min + margin < domain_max - margin
            positions, guide_observations = section_grid(
                body,
                domain_min,
                domain_max,
                counts[0],
                counts[1],
                margin,
                [(v.co.x, v.co.z) for v in ordered],
            )
            inner = []
            for section in range(4):
                count = counts[section % 2]
                for index in range(count):
                    row, column = (
                        (index, 0),
                        (counts[0], index),
                        (counts[0] - index, counts[1]),
                        (0, counts[1] - index),
                    )[section]
                    vertex = mesh.verts.new(positions[row][column])
                    vertex[origin] = -1
                    vertex[corner_marker] = section + 1 if index == 0 else 0
                    inner.append(vertex)
            outer_edges = [
                mesh.edges.get((v, ordered[(i + 1) % len(ordered)]))
                for i, v in enumerate(ordered)
            ]
            assert all(edge is not None for edge in outer_edges)
            inner_edges = [
                mesh.edges.new((v, inner[(i + 1) % len(inner)]))
                for i, v in enumerate(inner)
            ]
            # Use native constrained projected connectivity, never relocate
            # original professional boundary or move/merge CDT points.
            retained_before_ring = set(mesh.faces)
            ribbon_faces, ribbon_observation = fill_projected_ribbon(
                mesh, ordered, inner
            )
            assert ribbon_faces and set(mesh.faces) - retained_before_ring == set(
                ribbon_faces
            )
            assert all(edge.is_boundary for edge in inner_edges), (
                "Native projected CDT closed the core opening"
            )
            for face in ribbon_faces:
                face.smooth = True
                face.material_index = 0
            ribbon_sides = [{**ribbon_observation, "inner_hole_preserved": True}]
            inner_count = len(inner)
            # Native accepts two opposite OPEN loops. The other two sides are
            # already the only remaining boundary paths, avoiding editor span /
            # direction inference without changing any acceptance criterion.
            first_end = counts[0]
            opposite_start = sum(counts)
            opposite_end = opposite_start + counts[0]
            selected_edges = [
                *inner_edges[:first_end],
                *inner_edges[opposite_start:opposite_end],
            ]
            assert len(selected_edges) == 2 * counts[0]
            assert all(edge.is_boundary for edge in selected_edges)
            assert {edge for edge in mesh.edges if edge.is_boundary} == set(inner_edges)
            retained = set(mesh.verts)
            retained_faces = set(mesh.faces)
            report["last_grid"] = {
                "gender": gender,
                "boundary": len(ordered),
                "geometric_corner_ids": corner_ids,
                "original_side_intervals": intervals,
                "inner_side_intervals": [*counts, *counts],
                "inner_boundary_vertices": inner_count,
                "explicit_open_boundary_edges": [counts[0], counts[0]],
                "native_section_guides": guide_observations,
                "original_boundary_clear_z_band_m": [
                    domain_min + margin,
                    domain_max - margin,
                ],
                "native_projected_annulus": ribbon_sides,
            }
            result = bmesh.ops.grid_fill(
                mesh,
                edges=selected_edges,
                mat_nr=0,
                use_smooth=True,
                use_interp_simple=True,
            )
            new_faces = list(result["faces"])
            assert new_faces and set(mesh.faces) - retained_faces == set(new_faces)
            core_points = [vertex for vertex in mesh.verts if vertex not in retained]
            for vertex in core_points:
                vertex[origin] = -1
                vertex[corner_marker] = 0
            corner_faces = Counter(
                v for face in new_faces for v in face.verts if v in retained
            )
            actual_corners = sorted(
                v[corner_marker]
                for v, incidence in corner_faces.items()
                if incidence == 1
            )
            report["last_grid"]["actual_native_corner_tags"] = actual_corners
            assert actual_corners == [1, 2, 3, 4], (
                "Native grid did not follow the four explicit inner corners"
            )
            constrain_native_grid(
                new_faces, counts[0], counts[1], positions, corner_marker
            )
            new_points = [v for v in mesh.verts if v[origin] == -1]
            assert new_points
            distances = []
            for vertex in new_points:
                surface, _, _, distance = tree.find_nearest(vertex.co)
                assert surface is not None
                distances.append(distance)
            bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
            mesh.normal_update()
            report["last_grid"]["geometry_diagnostic"] = {
                "new_points": len(new_points),
                "maximum_source_distance_m": max(distances),
                "points_exceeding_6mm": sum(value >= 0.006 for value in distances),
                "core_faces": len(new_faces),
                "core_rear_facing_faces": sum(
                    face.normal.y > 0.1 for face in new_faces
                ),
                "core_wrong_facing_faces": sum(
                    face.normal.y < -0.1 for face in new_faces
                ),
                "core_tiny_faces": sum(face.calc_area() < 1e-10 for face in new_faces),
                "diagnostic_flushed_to_memory_only": diagnostic,
            }
            # Reject new rear folds before skin transfer or saving. Same source
            # and candidate X/Z probes, not webcam/person coordinates.
            width = (
                min(
                    abs(min(v.co.x for v in new_points)),
                    abs(max(v.co.x for v in new_points)),
                )
                * 0.8
            )
            probes = [
                (width * (column / 16 - 1), z + 0.00025 * step)
                for z in (
                    min(v.co.z for v in new_points),
                    max(v.co.z for v in new_points),
                )
                for step in range(-16, 17)
                for column in range(33)
            ]
            outer_polygon = [(v.co.x, v.co.z) for v in ordered]
            interior_misses = sum(
                not projected_inside(v.co, outer_polygon) for v in new_points
            )
            face_center_misses = sum(
                not projected_inside(face.calc_center_median(), outer_polygon)
                for face in [*new_faces, *ribbon_faces]
            )
            candidate_tree = BVHTree.FromBMesh(mesh)
            source_tree = BVHTree.FromPolygons(
                points, [tuple(p.vertices) for p in body.data.polygons]
            )
            original_hits = rear_intersections(source_tree, probes)
            candidate_hits = rear_intersections(candidate_tree, probes)
            report["last_grid"]["ribbon_geometry"] = {
                "faces": len(ribbon_faces),
                "new_points_outside_original_projection": interior_misses,
                "new_face_centers_outside_original_projection": face_center_misses,
                "negative_y_faces": sum(f.normal.y < 0 for f in ribbon_faces),
                "tiny_faces": sum(f.calc_area() < 1e-10 for f in ribbon_faces),
                "rear_samples": len(probes),
                "original_multiple_hits": sum(n > 1 for n in original_hits),
                "candidate_multiple_hits": sum(n > 1 for n in candidate_hits),
                "candidate_maximum_hits": max(candidate_hits),
                "additional_intersection_samples": sum(
                    n > max(1, old) for n, old in zip(candidate_hits, original_hits)
                ),
            }
            if diagnostic:
                # Neutral geometry inspection only. Save remains forbidden even
                # if all later guards unexpectedly pass. No GLB / skin approval.
                mesh.to_mesh(body.data)
            assert all(face.normal.y > 0 for face in new_faces), (
                "New grid has an inward-facing projected core face"
            )
            assert interior_misses == face_center_misses == 0, (
                "New patch leaves the original projected interior"
            )
            assert all(face.normal.y > 0 for face in ribbon_faces), (
                "New ribbon has an inward-facing projected face"
            )
            assert all(
                new <= max(1, old) for new, old in zip(candidate_hits, original_hits)
            ), "New ribbon adds a rear surface intersection"
            transfer_distance = 0
            for vertex in new_points:
                surface, _, _, distance = tree.find_nearest(vertex.co)
                assert surface is not None
                transfer_distance = max(transfer_distance, distance)
                assert distance < 0.006, (
                    f"Native grid leaves source surface: {distance}m"
                )
                for name in ("a239_source_point_id", "A123 authored parent point"):
                    layer = mesh.verts.layers.int.get(name)
                    if layer is not None:
                        vertex[layer] = -1
            bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
            mesh.verts.index_update()
            new_point_ids = [vertex.index for vertex in new_points]
            mesh.to_mesh(body.data)
        finally:
            mesh.free()
        bpy.ops.object.select_all(action="DESELECT")
        body.select_set(True)
        bpy.context.view_layer.objects.active = body
        mask = body.vertex_groups.new(name="Quad patch native skin mask")
        mask_name = mask.name
        mask.add(new_point_ids, 1, "REPLACE")
        transfer = body.modifiers.new(
            "Professional surface skin transfer", "DATA_TRANSFER"
        )
        transfer.object = skin_source
        transfer.use_vert_data = True
        transfer.data_types_verts = {"VGROUP_WEIGHTS"}
        transfer.vert_mapping = "POLYINTERP_NEAREST"
        transfer.layers_vgroup_select_src = "ALL"
        transfer.layers_vgroup_select_dst = "NAME"
        transfer.mix_mode = "REPLACE"
        transfer.mix_factor = 1
        transfer.vertex_group = mask_name
        transfer.use_max_distance = True
        transfer.max_distance = 0.006
        transfer_name = transfer.name
        body.modifiers.move(len(body.modifiers) - 1, 0)
        assert bpy.ops.object.modifier_apply(modifier=transfer_name) == {"FINISHED"}
        body.vertex_groups.remove(body.vertex_groups[mask_name])
        # Native Data Transfer can add zero-valued memberships even under a
        # zero mask. Do not restore changed influences: verify every positive
        # value exactly first, then remove only newly added literal-zero entries.
        zero_entries_removed = 0
        cleanup = bmesh.new()
        try:
            cleanup.from_mesh(body.data)
            ids_layer = cleanup.verts.layers.int[ORIGIN]
            weights_layer = cleanup.verts.layers.deform.active
            assert weights_layer is not None
            for vertex in cleanup.verts:
                old_id = vertex[ids_layer]
                if old_id < 0:
                    continue
                original = dict(before["skin"][old_id])
                weights = vertex[weights_layer]
                assert {i: w for i, w in weights.items() if w != 0} == {
                    i: w for i, w in original.items() if w != 0
                }, f"Protected influence changed at original point {old_id}"
                for group_id, value in list(weights.items()):
                    if group_id not in original:
                        assert value == 0
                        del weights[group_id]
                        zero_entries_removed += 1
            cleanup.to_mesh(body.data)
        finally:
            cleanup.free()
        private_mesh = skin_source.data
        bpy.data.objects.remove(skin_source, do_unlink=True)
        assert private_mesh.users == 0
        bpy.data.meshes.remove(private_mesh)
        ids = [item.value for item in body.data.attributes[ORIGIN].data]
        remap = {old: new for new, old in enumerate(ids) if old >= 0}
        assert len(remap) == len([i for i in ids if i >= 0])
        assert set(remap) == protected
        current_outside = Counter()
        for face in body.data.polygons:
            values = tuple(ids[i] for i in face.vertices)
            if all(i >= 0 for i in values):
                key = (canonical(values), face.material_index, face.use_smooth)
                if key in outside_faces:
                    current_outside[key] += 1
        assert current_outside == outside_faces, "Original outside polygons changed"
        for vertex in body.data.vertices:
            old_id = ids[vertex.index]
            if old_id >= 0:
                assert tuple(vertex.co) == before["points"][old_id]
                raw = [(g.group, g.weight) for g in vertex.groups]
                if raw != before["skin"][old_id]:
                    report["protected_raw_skin_difference"] = {
                        "gender": gender,
                        "source_point": old_id,
                        "candidate_point": vertex.index,
                        "source": before["skin"][old_id],
                        "candidate": raw,
                        "positive_weights_exact": {
                            i: value for i, value in raw if value != 0
                        }
                        == {
                            i: value
                            for i, value in before["skin"][old_id]
                            if value != 0
                        },
                    }
                    raise AssertionError("Protected raw skin changed")
            assert all(math.isfinite(value) for value in vertex.co)
            assert abs(sum(g.weight for g in vertex.groups) - 1) < 0.01
        body["bodyguard_distal_hand_vertices"] = [remap[i] for i in before["hands"]]
        for key, values in history.items():
            body[key] = [values[i] if i >= 0 else -1 for i in ids]
        assert fixed_state(body, rig) == fixed, "Rest rig/material/scene changed"
        new_geometry = geometry(body)
        report["rows"].append(
            {
                "gender": gender,
                "boundary_vertices": len(ordered),
                "native_explicit_open_boundary_edges": [counts[0], counts[0]],
                "boundary_pruned_faces": pruned,
                "original_patch_faces": len(selected_ids),
                "new_points": len(new_points),
                "odd_boundary_triangle_transition": transition is not None,
                "maximum_surface_binding_distance_m": transfer_distance,
                "surface_design": "native professional cross-sections constrain new local quad grid; no boundary-only volume interpolation, smoothing or folded-core shrinkwrap",
                "native_section_guides": guide_observations,
                "geometric_corner_ids": corner_ids,
                "body_space_z_limits": limits,
                "skin_transfer": "native Data Transfer / POLYINTERP_NEAREST / new-point mask only",
                "ribbon_geometry": report["last_grid"]["ribbon_geometry"],
                "original_boundary_clear_z_band_m": [
                    domain_min + margin,
                    domain_max - margin,
                ],
                "new_literal_zero_memberships_removed": zero_entries_removed,
                "outside_coordinates_raw_skin_polygons_exact": True,
                "front_hands_preserved": True,
                "rest_rig_world_material_exact": True,
                "before": old_geometry,
                "after": new_geometry,
            }
        )
        assert new_geometry["nonmanifold"] == new_geometry["winding"] == 0
        assert new_geometry["tiny_faces"] <= old_geometry["tiny_faces"]
    assert not diagnostic, (
        "Diagnostics never save; native authoring criteria unexpectedly passed"
    )
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(target), check_existing=True)
    assert digest(loaded) == INPUT_SHA
    report["output_sha256"] = digest(target)
    report["passed"] = True
except Exception as error:
    report["failure"] = f"{type(error).__name__}: {error}"
    raise
finally:
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
