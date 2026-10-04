"""FR-A-03: pre-save fail-closed guard, not a skin normalization operation."""

import unittest

from avatar_skin_guard import require_valid_skin


class AvatarSkinGuardTests(unittest.TestCase):
    def test_normalized_vertices_pass(self):
        self.assertEqual(require_valid_skin([{0: 0.5, 1: 0.5}, {0: 1.0}], 2), 2)

    def test_explicit_zero_is_not_a_rig_change(self):
        self.assertEqual(require_valid_skin([{0: 1.0, 1: 0.0}], 2), 1)

    def test_sum_near_one_does_not_allow_negative_coefficient(self):
        for weight in (-1e-12, -5.466188923719528e-8, -1.748251654554167e-9):
            with self.subTest(weight=weight), self.assertRaises(ValueError):
                require_valid_skin([{0: 1.0, 1: weight}], 2)

    def test_unknown_even_zero_palette_entry_fails(self):
        with self.assertRaises(ValueError):
            require_valid_skin([{0: 1.0, 2: 0.0}], 2)

    def test_empty_and_unnormalized_vertices_fail(self):
        for vertices in ([], [{}], [{0: 0.25}]):
            with self.subTest(vertices=vertices), self.assertRaises(ValueError):
                require_valid_skin(vertices, 1)

    def test_nonfinite_and_greater_than_one_fail(self):
        for weight in (float("nan"), float("inf"), 1.000000001):
            with self.subTest(weight=weight), self.assertRaises(ValueError):
                require_valid_skin([{0: weight}], 1)

    def test_source_is_not_mutated_or_fixed(self):
        vertices = [{0: 1.0, 1: -1e-12}]
        with self.assertRaises(ValueError):
            require_valid_skin(vertices, 2)
        self.assertEqual(vertices, [{0: 1.0, 1: -1e-12}])

    def test_failed_preflight_does_not_reach_writer(self):
        writes = []
        with self.assertRaises(ValueError):
            require_valid_skin([{0: 1.0, 1: -1e-12}], 2)
            writes.append("would save or export")
        self.assertEqual(writes, [])

    def test_one_shot_vertex_iterator_is_checked(self):
        self.assertEqual(require_valid_skin(iter([{0: 1.0}, {0: 1.0}]), 1), 2)


if __name__ == "__main__":
    unittest.main()
