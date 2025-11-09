"""Minimal regression tests for the Pac-Man clone."""

import unittest

from pacman_clone.game import DEFAULT_LEVEL, Game


class GameTests(unittest.TestCase):
    def test_pellet_count_matches_level(self) -> None:
        game = Game(DEFAULT_LEVEL)
        self.assertEqual(game.remaining_pellets, DEFAULT_LEVEL.pellet_count)

    def test_player_eats_pellet(self) -> None:
        game = Game(DEFAULT_LEVEL)
        start_score = game.score
        # Move right twice to guarantee eating at least one pellet.
        game.handle_input("d")
        game.update()
        game.handle_input("d")
        game.update()
        self.assertGreater(game.score, start_score)
        self.assertLess(game.remaining_pellets, DEFAULT_LEVEL.pellet_count)


if __name__ == "__main__":
    unittest.main()
