"""FR-A-02/08: native face-side observations only; no authoring or clinical data."""

from mathutils import Vector
from mathutils.bvhtree import BVHTree


def read(body):
    body.data.calc_loop_triangles()
    triangles = list(body.data.loop_triangles)
    tree = BVHTree.FromPolygons(
        [v.co for v in body.data.vertices],
        [list(t.vertices) for t in triangles],
        all_triangles=True,
    )
    result = {side: set() for side in ("anterior", "posterior")}
    for triangle in triangles:
        center = (
            sum((body.data.vertices[i].co for i in triangle.vertices), Vector()) / 3
        )
        for side, sign in (("anterior", -1), ("posterior", 1)):
            position, _, index, _ = tree.ray_cast(
                Vector((center.x, sign, center.z)), Vector((0, -sign, 0)), 2
            )
            if (
                position is not None
                and triangles[index].polygon_index == triangle.polygon_index
                and abs(position.y - center.y) < 1e-6
            ):
                result[side].add(triangle.polygon_index)
    return result
