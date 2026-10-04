"""FR-A-02/03/08: budget independence and exact native arithmetic regression."""

import unittest
from dataclasses import FrozenInstanceError

from native_y_budget import NativeYBudget, float32


class NativeYBudgetTests(unittest.TestCase):
    def test_gender_order_and_measurements_do_not_change_weights(self):
        male, female = {0: 0.000036}, {0: 0.000066, 1: -0.000012}
        first = NativeYBudget.from_fields({"Male": male, "Female": female})
        reversed_plan = NativeYBudget.from_fields({"Female": female, "Male": male})
        self.assertEqual(first, reversed_plan)
        observed_male_maximum = 0.000036
        self.assertNotEqual(observed_male_maximum, first.maximum_field_m)
        self.assertEqual(first.weight(0.000066), 1)
        self.assertEqual(first.weight(0.000036), 0.000036 / 0.000066)
        self.assertEqual(first.common_factor, 1)

    def test_plan_is_immutable(self):
        plan = NativeYBudget.from_fields({"Female": {0: 0.000066}})
        with self.assertRaises(FrozenInstanceError):
            plan.maximum_field_m = 0.000036

    def test_common_limit_and_signed_weight_do_not_clip(self):
        plan = NativeYBudget.from_fields({"Male": {0: 0.004}, "Female": {0: -0.008}})
        self.assertEqual(plan.maximum_field_m, 0.008)
        self.assertEqual(plan.common_factor, 0.0059 / 0.008)
        self.assertEqual(plan.native_strength_m, 0.0059)
        self.assertEqual(plan.weight(-0.008), 1)
        self.assertEqual(plan.weight(0.004), 0.5)

    def test_exact_float32_native_arithmetic(self):
        plan = NativeYBudget.from_fields({"Male": {0: 0.004}, "Female": {0: -0.008}})
        original = float32(-0.009487529285252094)
        expected = float32(original + float32(float32(0.0059) * float32(0.5)))
        self.assertEqual(plan.native_expected_y(original, 0.004), expected)
        negative = float32(original + float32(float32(-0.0059) * float32(1)))
        self.assertEqual(plan.native_expected_y(original, -0.008), negative)
        self.assertEqual(plan.native_expected_y(original, 0), original)

    def test_empty_zero_and_nonfinite_fields_rejected(self):
        for fields in (
            {},
            {"Male": {}},
            {"Male": {0: 0}},
            {"Male": {0: float("nan")}},
            {"Male": {0: float("inf")}},
            {"Male": {0: True}},
        ):
            with self.subTest(fields=fields), self.assertRaises(ValueError):
                NativeYBudget.from_fields(fields)

    def test_invalid_limits_and_outside_values_rejected(self):
        for limit in (0, -1, float("inf"), float("nan"), True):
            with self.subTest(limit=limit), self.assertRaises(ValueError):
                NativeYBudget.from_fields({"Male": {0: 0.001}}, limit)
        plan = NativeYBudget.from_fields({"Male": {0: 0.001}})
        for delta in (0.002, -0.002, float("inf"), float("nan"), True):
            with self.subTest(delta=delta), self.assertRaises(ValueError):
                plan.weight(delta)
        with self.assertRaises(ValueError):
            plan.native_expected_y(float("nan"), 0.001)

    def test_direct_invalid_construction_rejected(self):
        for values in (
            (0, 1, 0),
            (0.001, 2, 0.002),
            (0.001, 0.5, 0.001),
            (float("nan"), 1, 0.001),
            (0.001, True, 0.001),
        ):
            with self.subTest(values=values), self.assertRaises(ValueError):
                NativeYBudget(*values)


if __name__ == "__main__":
    unittest.main()
