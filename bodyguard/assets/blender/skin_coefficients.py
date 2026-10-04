"""FR-A-03: compare exact numeric skin coefficients, not sparse zero bookkeeping."""

from collections.abc import Mapping
from math import isfinite


def exact_skin_coefficients(
    values: Mapping[int, float], group_count: int
) -> tuple[tuple[int, float], ...]:
    """Absent equals explicit zero; positive values never use a tolerance.

    The palette size must match the caller's unchanged vertex-group order.
    This reads coefficients only: no normalization, mutation or restoration.
    """
    if (
        isinstance(group_count, bool)
        or not isinstance(group_count, int)
        or group_count < 0
    ):
        raise ValueError("Invalid skin palette size")
    result = []
    for group, value in values.items():
        if (
            isinstance(group, bool)
            or not isinstance(group, int)
            or not 0 <= group < group_count
        ):
            raise ValueError("Unknown skin group")
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TypeError("Invalid skin coefficient")
        weight = float(value)
        if not isfinite(weight) or not 0 <= weight <= 1:
            raise ValueError("Invalid skin coefficient")
        if weight != 0:
            result.append((group, weight))
    return tuple(sorted(result))
