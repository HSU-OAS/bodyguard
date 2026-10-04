"""FR-A-02/03/08: immutable shared authoring budget and native float32 transfer."""

from collections.abc import Mapping
from dataclasses import dataclass
from math import isfinite
from struct import pack, unpack


def float32(value: float) -> float:
    """Match Blender's native float storage; not a geometry tolerance."""
    return unpack("f", pack("f", value))[0]


@dataclass(frozen=True, slots=True)
class NativeYBudget:
    maximum_field_m: float
    common_factor: float
    native_strength_m: float

    def __post_init__(self) -> None:
        values = (self.maximum_field_m, self.common_factor, self.native_strength_m)
        if any(isinstance(v, bool) or not isfinite(v) for v in values):
            raise ValueError("Native budget must contain finite numeric values")
        if not (
            self.maximum_field_m > 0
            and 0 < self.common_factor <= 1
            and self.native_strength_m > 0
            and self.native_strength_m == self.maximum_field_m * self.common_factor
        ):
            raise ValueError("Native budget values are inconsistent")

    @classmethod
    def from_fields(
        cls, fields: Mapping[str, Mapping[int, float]], limit_m: float = 0.0059
    ) -> "NativeYBudget":
        if isinstance(limit_m, bool) or not isfinite(limit_m) or limit_m <= 0:
            raise ValueError("Authoring budget must be finite and positive")
        values = [v for field in fields.values() for v in field.values()]
        if not values or any(isinstance(v, bool) or not isfinite(v) for v in values):
            raise ValueError("Authoring fields must be finite and nonempty")
        maximum = max(abs(v) for v in values)
        if maximum <= 0:
            raise ValueError("Authoring field must contain a real edit")
        factor = min(1.0, limit_m / maximum)
        return cls(maximum, factor, maximum * factor)

    def weight(self, delta_m: float) -> float:
        if (
            isinstance(delta_m, bool)
            or not isfinite(delta_m)
            or abs(delta_m) > self.maximum_field_m
        ):
            raise ValueError("Native delta exceeds the immutable field budget")
        return abs(delta_m) / self.maximum_field_m

    def native_expected_y(self, original_y: float, delta_m: float) -> float:
        """Y-only/no-texture DISPLACE, mid_level=0; each point has one sign group."""
        if not isfinite(original_y):
            raise ValueError("Original professional point must be finite")
        weight = float32(self.weight(delta_m))
        sign = 1 if delta_m >= 0 else -1
        strength = float32(self.native_strength_m * sign)
        return float32(float32(original_y) + float32(strength * weight))
