"""FR-A-03/08: explicit final GLB topology, preserving authored coordinates and skin."""

from collections import Counter
from math import isfinite, sqrt

import bmesh


def triangle_area(points):
    # Use Python doubles: float32 cross products can hide near-collinear edges.
    a, b, c = points
    u = [float(b[i]) - float(a[i]) for i in range(3)]
    v = [float(c[i]) - float(a[i]) for i in range(3)]
    cross = (
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    )
    return sqrt(sum(n * n for n in cross)) / 2


def triangle_key(vertices):
    ring = tuple(vertices)
    return min(ring[i:] + ring[:i] for i in range(len(ring)))


def final_web_triangles(mesh):
    # Degenerate cleanup above can create quads AFTER the first triangulation.
    # The implicit GLB diagonal produced zero-area triangles in A195. Re-split
    # only the bad parents, then explicitly freeze the remaining good faces.
    mesh.calc_loop_triangles()
    points = [tuple(v.co) for v in mesh.vertices]
    weights = [tuple((g.group, g.weight) for g in v.groups) for v in mesh.vertices]
    protected = Counter(triangle_key(f.vertices) for f in mesh.polygons if len(f.vertices) == 3)
    bad_parents = set()
    existing_tiny = set()
    before_zero = 0
    for t in mesh.loop_triangles:
        area = triangle_area([mesh.vertices[i].co for i in t.vertices])
        assert isfinite(area), "Nonfinite final web triangle"
        before_zero += area == 0
        if area < 1e-10:
            if len(mesh.polygons[t.polygon_index].vertices) > 3:
                bad_parents.add(t.polygon_index)
            else:
                assert area > 0, "Existing zero-area triangle requires source repair"
                existing_tiny.add(tuple(sorted(t.vertices)))
    bm = bmesh.new()
    try:
        bm.from_mesh(mesh)
        bm.faces.ensure_lookup_table()
        bad = [bm.faces[i] for i in sorted(bad_parents)]
        good = [f for f in bm.faces if len(f.verts) > 3 and f.index not in bad_parents]
        if bad:
            bmesh.ops.triangulate(bm, faces=bad, quad_method="ALTERNATE", ngon_method="BEAUTY")
        if good:
            bmesh.ops.triangulate(bm, faces=good, quad_method="BEAUTY", ngon_method="BEAUTY")
        assert all(e.is_manifold and e.is_contiguous for e in bm.edges), (
            "Final triangulation damaged surface closure/winding"
        )
        bm.normal_update()
        bm.to_mesh(mesh)
    finally:
        bm.free()
    assert [tuple(v.co) for v in mesh.vertices] == points, "Final split changed anatomy"
    assert [tuple((g.group, g.weight) for g in v.groups) for v in mesh.vertices] == weights, (
        "Final split changed skin weights"
    )
    actual = Counter(triangle_key(f.vertices) for f in mesh.polygons)
    assert all(actual[k] == n for k, n in protected.items()), "Unrelated triangle changed"
    assert all(len(f.vertices) == 3 for f in mesh.polygons), "Implicit export faces remained"
    mesh.calc_loop_triangles()
    areas = [triangle_area([mesh.vertices[i].co for i in t.vertices]) for t in mesh.loop_triangles]
    assert areas and all(isfinite(a) and a > 0 for a in areas), "Zero/nonfinite export triangle"
    tiny = {
        tuple(sorted(t.vertices)) for t, area in zip(mesh.loop_triangles, areas) if area < 1e-10
    }
    assert tiny == existing_tiny, "Final split introduced a new near-degenerate triangle"
    return {
        "vertices": len(mesh.vertices),
        "triangles": len(areas),
        "repaired_bad_parents": len(bad_parents),
        "explicit_good_parents": len(good),
        "zero_triangles_before": before_zero,
        "zero_triangles_after": 0,
        "preserved_existing_tiny_triangles": len(tiny),
        "minimum_triangle_area_m2": min(areas),
        "coordinates_skin_unrelated_triangles_exact": True,
        "appearance_approved": False,
    }
