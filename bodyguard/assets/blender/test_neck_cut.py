"""FR-A-03: native boundary regression, no avatar generation or source save.

Blender --factory-startup --disable-autoexec -b --python-exit-code 1 --python this.py
"""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import bmesh

# A normal local module import must not execute the producer's file-editing CLI.
spec = spec_from_file_location(
    "neck_helpers", Path(__file__).with_name("replace_neck_from_artist.py")
)
helpers = module_from_spec(spec)
spec.loader.exec_module(helpers)
closed_loops, cap_inner_cut = helpers.closed_loops, helpers.cap_inner_cut


def cut(contours):
    mesh = bmesh.new()
    for contour in contours:
        top = [mesh.verts.new((x, y, 0)) for x, y in contour]
        bottom = [mesh.verts.new((x, y, -1)) for x, y in contour]
        for i in range(len(top)):
            j = (i + 1) % len(top)
            mesh.faces.new((top[i], top[j], bottom[j], bottom[i]))
    edges = [e for e in mesh.edges if all(v.co.z == 0 for v in e.verts)]
    return mesh, edges


def square(size, offset=0):
    return [
        (offset - size, -size),
        (offset + size, -size),
        (offset + size, size),
        (offset - size, size),
    ]


def rejected(contours):
    mesh, edges = cut(contours)
    points, faces = {v: tuple(v.co) for v in mesh.verts}, len(mesh.faces)
    try:
        cap_inner_cut(mesh, edges)
    except AssertionError:
        assert points == {v: tuple(v.co) for v in mesh.verts} and faces == len(mesh.faces)
    else:
        raise AssertionError("Invalid cut was accepted")
    finally:
        mesh.free()


mesh, edges = cut([square(2)])
assert len(closed_loops(edges)) == 1 and cap_inner_cut(mesh, edges) == 0
mesh.free()
mesh, edges = cut([square(2), square(1)])
assert len(closed_loops(edges)) == 2 and cap_inner_cut(mesh, edges) == 4
assert len(closed_loops([e for e in edges if e.is_boundary])) == 1
mesh.free()
rejected([square(2), square(1, 5)])
rejected([square(2), square(1, 2)])
rejected([square(3), square(2), square(1)])
rejected(
    [
        [(-3, -3), (3, -3), (3, 3), (1, 3), (1, -1), (-1, -1), (-1, 3), (-3, 3)],
        [(-2, 1), (2, 1), (2, 2), (-2, 2)],
    ]
)

mesh = bmesh.new()
vertices = [mesh.verts.new(p) for p in ((0, 0, 0), (1, 0, 0), (0, 1, 0), (-1, 0, 0), (0, -1, 0))]
mesh.faces.new(vertices[:3])
mesh.faces.new((vertices[0], vertices[3], vertices[4]))
try:
    closed_loops(list(mesh.edges))
except AssertionError:
    pass
else:
    raise AssertionError("Branched boundary was accepted")
mesh.free()
print("NATIVE NECK CUT: 7 positive/negative checks passed; no files saved")
