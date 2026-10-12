"""FR-A-02/03/08: front-protected lateral neck and shoulder authoring domain.

Uses existing professional mesh/bones; contains no clinical or user thresholds.
"""

from surface_visibility import read


def domain(body, rig):
    height = max(v.co.z for v in body.data.vertices)
    transform = body.matrix_world.inverted() @ rig.matrix_world
    low = (transform @ rig.data.bones["neck01"].head_local).z / height
    high = (transform @ rig.data.bones["neck02"].tail_local).z / height
    anterior = read(body)["anterior"]
    front = {
        i for polygon in body.data.polygons if polygon.index in anterior for i in polygon.vertices
    }
    selected = set()
    for vertex in body.data.vertices:
        x, y, z = (value / height for value in vertex.co)
        lateral = low < z < high and 0.025 < abs(x) < 0.1
        shoulder = 0.82 < z < low and abs(x) < 0.16
        if (lateral or shoulder) and y > 0 and vertex.index not in front:
            selected.add(vertex.index)
    assert selected and not selected.intersection(front)
    return {
        "selected": selected,
        "anterior": anterior,
        "front": front,
        "height": height,
        "neck_lower": low,
        "neck_upper": high,
    }


def weight(vertex, selection, bounds):
    """Smooth falloff at the protected anterior and existing neck boundaries."""
    if vertex.index not in selection:
        return 0.0
    x, y, z = (value / bounds["height"] for value in vertex.co)

    def taper(value, first, last):
        t = max(0.0, min(1.0, (value - first) / (last - first)))
        return t * t * (3.0 - 2.0 * t)

    lower, upper = bounds["neck_lower"], bounds["neck_upper"]
    if z >= lower:
        return (
            taper(abs(x), 0.025, 0.035)
            * (1.0 - taper(abs(x), 0.085, 0.1))
            * taper(z, lower, lower + 0.01)
            * (1.0 - taper(z, upper - 0.01, upper))
            * taper(y, 0.0, 0.015)
        )
    return (
        taper(z, 0.82, 0.835)
        * (1.0 - taper(z, lower - 0.01, lower))
        * (1.0 - taper(abs(x), 0.14, 0.16))
        * taper(y, 0.0, 0.015)
    )
