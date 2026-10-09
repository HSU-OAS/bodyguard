"""Native constrained X/-Z connectivity for an existing professional patch.

Never create/move a vertex, merge original points, fit a primitive human, or
relax appearance/skin/rig/closed-surface criteria. Callers own those guards.
"""

from collections import Counter

from mathutils import Vector, geometry

EPSILON = 1e-12  # Native numerical tolerance; not camera/clinical accuracy.


def signed_area(polygon):
    return (
        sum(
            a[0] * polygon[(i + 1) % len(polygon)][1]
            - polygon[(i + 1) % len(polygon)][0] * a[1]
            for i, a in enumerate(polygon)
        )
        / 2
    )


def inside(point, polygon):
    x, y = point
    hits = 0
    for i, (ax, ay) in enumerate(polygon):
        bx, by = polygon[(i + 1) % len(polygon)]
        if (ay > y) != (by > y) and x < ax + (bx - ax) * (y - ay) / (by - ay):
            hits += 1
    return hits % 2 == 1


def fill(mesh, outer, inner):
    """Keep exact original 3D refs; use CDT only for validated triangle indices."""
    references = [*outer, *inner]
    original_xyz = [tuple(v.co) for v in references]
    assert len(set(references)) == len(references)
    coords = [Vector((v.co.x, -v.co.z)) for v in references]
    outer_polygon = coords[: len(outer)]
    inner_polygon = coords[len(outer) :]
    assert signed_area(outer_polygon) > 0 and signed_area(inner_polygon) > 0
    assert all(inside(point, outer_polygon) for point in inner_polygon)
    outer_edges = [(i, (i + 1) % len(outer)) for i in range(len(outer))]
    inner_edges = [
        (len(outer) + i, len(outer) + (i + 1) % len(inner)) for i in range(len(inner))
    ]
    result, edges, triangles, origins, _, _ = geometry.delaunay_2d_cdt(
        coords,
        [*outer_edges, *inner_edges],
        [list(range(len(outer)))],
        1,
        EPSILON,
        True,
    )
    assert len(result) == len(references) and all(len(ids) == 1 for ids in origins), (
        "Native CDT inserted/merged a protected constraint point"
    )
    assert Counter(ids[0] for ids in origins) == Counter(range(len(references)))
    assert all(
        tuple(result[i]) == tuple(coords[ids[0]]) for i, ids in enumerate(origins)
    ), "Native CDT shifted a constraint point"
    edges = {frozenset((origins[a][0], origins[b][0])) for a, b in edges}
    assert all(frozenset(edge) in edges for edge in [*outer_edges, *inner_edges]), (
        "Native CDT split/removed an original constraint edge"
    )
    selected = []
    excluded_core = 0
    for face in triangles:
        assert len(face) == 3, "Native constrained fill returned a non-triangle"
        ids = [origins[i][0] for i in face]
        projected = [coords[i] for i in ids]
        assert signed_area(projected) > 0, "Native constrained triangle is reversed"
        center = sum(projected, Vector((0, 0))) / 3
        assert inside(center, outer_polygon), "Native CDT leaves the outer domain"
        if inside(center, inner_polygon):
            excluded_core += 1
        else:
            selected.append(ids)
    edge_counts = Counter(
        frozenset((face[i], face[(i + 1) % 3])) for face in selected for i in range(3)
    )
    constraint_edges = {frozenset(edge) for edge in [*outer_edges, *inner_edges]}
    assert {
        edge for edge, count in edge_counts.items() if count == 1
    } == constraint_edges
    assert all(
        count == (1 if edge in constraint_edges else 2)
        for edge, count in edge_counts.items()
    )
    area = sum(signed_area([coords[i] for i in face]) for face in selected)
    expected_area = signed_area(outer_polygon) - signed_area(inner_polygon)
    assert abs(area - expected_area) < 1e-12, "Native constrained annulus area mismatch"
    faces = [mesh.faces.new([references[i] for i in face]) for face in selected]
    assert [tuple(v.co) for v in references] == original_xyz
    return faces, {
        "native_projected_cdt": True,
        "numerical_epsilon": EPSILON,
        "outer_points": len(outer),
        "inner_points": len(inner),
        "new_faces": len(faces),
        "excluded_core_triangles": excluded_core,
        "input_3d_coordinates_exact": True,
        "native_origins_one_to_one": True,
        "all_constraints_preserved_without_splits": True,
        "projected_annulus_area_m2": area,
        "projected_annulus_area_error_m2": abs(area - expected_area),
    }
