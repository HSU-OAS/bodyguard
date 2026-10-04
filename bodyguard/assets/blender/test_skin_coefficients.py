"""FR-A-03: zero sparsity is not lost rig precision; true coefficient changes fail."""

import unittest

from skin_coefficients import exact_skin_coefficients


class SkinCoefficientTests(unittest.TestCase):
    def test_absent_and_explicit_zero_are_exactly_equal(self):
        self.assertEqual(
            exact_skin_coefficients({0: 1.0, 1: 0.0}, 2),
            exact_skin_coefficients({0: 1.0}, 2),
        )

    def test_palette_order_is_numeric_not_insertion_order(self):
        self.assertEqual(
            exact_skin_coefficients({2: 0.25, 0: 0.75, 1: 0}, 3), ((0, 0.75), (2, 0.25))
        )

    def test_tiny_positive_weight_is_not_dropped(self):
        self.assertNotEqual(
            exact_skin_coefficients({0: 1.0}, 2),
            exact_skin_coefficients({0: 1.0, 1: 1e-12}, 2),
        )

    def test_one_float32_ulp_difference_is_not_tolerated(self):
        self.assertNotEqual(
            exact_skin_coefficients({0: 0.5}, 1),
            exact_skin_coefficients({0: 0.5000000596046448}, 1),
        )

    def test_source_mapping_is_not_mutated_or_normalized(self):
        source = {0: 0.25, 1: 0.0}
        self.assertEqual(exact_skin_coefficients(source, 2), ((0, 0.25),))
        self.assertEqual(source, {0: 0.25, 1: 0.0})

    def test_empty_zero_palette(self):
        self.assertEqual(exact_skin_coefficients({}, 0), ())

    def test_unknown_even_zero_group_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unknown skin group"):
            exact_skin_coefficients({1: 0}, 1)

    def test_negative_and_boolean_groups_are_rejected(self):
        for group in (-1, True):
            with (
                self.subTest(group=group),
                self.assertRaisesRegex(ValueError, "Unknown skin group"),
            ):
                exact_skin_coefficients({group: 0.5}, 1)

    def test_nonfinite_and_out_of_range_weights_are_rejected(self):
        for weight in (
            float("inf"),
            float("-inf"),
            float("nan"),
            -0.1,
            -1e-12,
            -5.466188923719528e-8,
            -1.748251654554167e-9,
            1.00001,
        ):
            with (
                self.subTest(weight=weight),
                self.assertRaisesRegex(ValueError, "Invalid skin coefficient"),
            ):
                exact_skin_coefficients({0: weight}, 1)

    def test_boolean_and_nonnumeric_coefficients_are_rejected(self):
        for weight in (True, "0.5", None):
            with (
                self.subTest(weight=weight),
                self.assertRaisesRegex(TypeError, "Invalid skin coefficient"),
            ):
                exact_skin_coefficients({0: weight}, 1)

    def test_invalid_palette_size_is_rejected(self):
        for count in (-1, True):
            with (
                self.subTest(count=count),
                self.assertRaisesRegex(ValueError, "Invalid skin palette size"),
            ):
                exact_skin_coefficients({}, count)


if __name__ == "__main__":
    unittest.main()
