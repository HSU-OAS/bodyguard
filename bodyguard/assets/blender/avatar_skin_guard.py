"""FR-A-03: reject invalid individual skin coefficients before asset writes."""

from collections.abc import Iterable, Mapping
from math import isfinite

from skin_coefficients import exact_skin_coefficients


def require_valid_skin(
    vertices: Iterable[Mapping[int, float]], group_count: int
) -> int:
    """Read-only preflight; retain every positive coefficient and never normalize.

    The 0.01 sum tolerance is the existing technical harness bound, not a
    clinical angle or acceptance score. Individual weights have no tolerance.
    """
    count = 0
    for count, values in enumerate(vertices, start=1):
        try:
            exact = exact_skin_coefficients(values, group_count)
        except (TypeError, ValueError) as error:
            message = f"Invalid skin vertex {count - 1}: {error}"
            raise type(error)(message) from error
        total = sum(weight for _, weight in exact)
        if not isfinite(total) or abs(total - 1) > 0.01:
            raise ValueError(f"Unnormalized skin vertex {count - 1}")
    if count == 0:
        raise ValueError("Empty skin mesh")
    return count
