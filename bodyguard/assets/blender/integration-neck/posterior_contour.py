"""FR-A-02/08: read the two native body-cut arcs; do not infer back from Y>0."""

from collections import Counter, deque
from itertools import pairwise
from statistics import mean

import bmesh
from mathutils import Vector


def read(body, z):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        result = bmesh.ops.bisect_plane(
            mesh,
            geom=[*mesh.verts, *mesh.edges, *mesh.faces],
            dist=1e-8,
            plane_co=Vector((0, 0, z)),
            plane_no=Vector((0, 0, 1)),
            clear_inner=False,
            clear_outer=False,
            use_snap_center=False,
        )
        mesh.normal_update()
        edges = {e for e in result["geom_cut"] if isinstance(e, bmesh.types.BMEdge)}
        pending = {v for e in edges for v in e.verts}
        components = []
        while pending:
            seed = pending.pop()
            reached, queue = {seed}, deque([seed])
            while queue:
                vertex = queue.popleft()
                for e in vertex.link_edges:
                    if e not in edges:
                        continue
                    other = e.other_vert(vertex)
                    if other in pending:
                        pending.remove(other)
                        reached.add(other)
                        queue.append(other)
            if min(v.co.x for v in reached) < 0 < max(v.co.x for v in reached):
                components.append(reached)
        assert len(components) == 1, "No unique central native body cross-section"
        vertices = components[0]
        loop_edges = {e for e in edges if all(v in vertices for v in e.verts)}
        degree = Counter(v for e in loop_edges for v in e.verts)
        assert all(n == 2 for n in degree.values()), (
            "Central native contour is not simple"
        )
        first, last = (
            min(vertices, key=lambda v: v.co.x),
            max(vertices, key=lambda v: v.co.x),
        )
        starts = [e for e in first.link_edges if e in loop_edges]
        assert len(starts) == 2
        paths = []
        for initial in starts:
            current, previous = initial.other_vert(first), first
            path = [first, current]
            while current != last:
                candidates = [
                    e.other_vert(current)
                    for e in current.link_edges
                    if e in loop_edges and e.other_vert(current) != previous
                ]
                assert len(candidates) == 1
                previous, current = current, candidates[0]
                assert current not in path
                path.append(current)
            paths.append(path)
        assert set(paths[0]) | set(paths[1]) == vertices
        assert set(paths[0]) & set(paths[1]) == {first, last}
        back = max(paths, key=lambda path: mean(v.co.y for v in path))
        front = next(path for path in paths if path is not back)
        native_edges = [mesh.edges.get((a, b)) for a, b in pairwise(back)]
        assert all(e is not None for e in native_edges)
        return {
            "z_m": z,
            "central_loop_vertices": len(vertices),
            "other_components_excluded": len(
                {v for e in edges for v in e.verts} - vertices
            ),
            "posterior_xyz_m": [list(v.co) for v in back],
            "anterior_xyz_m": [list(v.co) for v in front],
            "posterior_mean_y_m": mean(v.co.y for v in back),
            "anterior_mean_y_m": mean(v.co.y for v in front),
            "posterior_strictly_monotone_x": all(
                b.co.x > a.co.x for a, b in pairwise(back)
            ),
            "posterior_edges": len(native_edges),
            "posterior_maximum_dihedral_radians": max(
                e.calc_face_angle() for e in native_edges if e.is_manifold
            ),
        }
    finally:
        mesh.free()
