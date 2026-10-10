"""FR-A-02/08: bind local quad rows to real artist posterior cuts, not Y>0 arcs."""

import math
from itertools import pairwise

from mathutils import Vector
from posterior_contour import read


def section_grid(body, zmin, zmax, rows, columns, margin, outer_polygon):
    positions, observations = [], []
    for row in range(rows + 1):
        z = zmin + margin + (zmax - zmin - 2 * margin) * row / rows
        contour = read(body, z)
        assert contour["posterior_maximum_dihedral_radians"] < math.pi / 2, (
            "Original posterior contour crosses a folded face"
        )
        posterior = contour["posterior_xyz_m"]
        crossing = sorted(
            ax + (bx - ax) * (z - az) / (bz - az)
            for i, (ax, az) in enumerate(outer_polygon)
            for bx, bz in [outer_polygon[(i + 1) % len(outer_polygon)]]
            if (az > z) != (bz > z)
        )
        assert len(crossing) >= 2 and len(crossing) % 2 == 0
        intervals = list(zip(crossing[::2], crossing[1::2]))
        central = [pair for pair in intervals if pair[0] < 0 < pair[1]]
        assert len(central) == 1, (
            "Original projected row has no unique central interior"
        )
        left, right = central[0][0] + margin, central[0][1] - margin
        assert left < right
        values, sample_counts = [], []
        for column in range(columns + 1):
            x = left + (right - left) * column / columns
            candidates = [
                a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])
                for a, b in pairwise(posterior)
                if (a[0] <= x < b[0]) or (b[0] <= x < a[0])
            ]
            assert candidates, "No native posterior guide extrapolation"
            # The actual outermost artist posterior surface, not invented volume.
            y = max(candidates)
            assert y > 0 and all(math.isfinite(v) for v in (x, y, z))
            values.append(Vector((x, y, z)))
            sample_counts.append(len(candidates))
        positions.append(values)
        observations.append(
            {
                "row": row,
                "z_m": z,
                "central_native_contour_vertices": contour["central_loop_vertices"],
                "posterior_edges": contour["posterior_edges"],
                "maximum_posterior_dihedral_degrees": math.degrees(
                    contour["posterior_maximum_dihedral_radians"]
                ),
                "actual_posterior_arc_not_coordinate_only": True,
                "native_posterior_sample_counts": sample_counts,
                "projected_original_interval_m": central[0],
                "original_projected_intervals_m": intervals,
                "inner_interval_m": [left, right],
            }
        )
    return positions, observations
