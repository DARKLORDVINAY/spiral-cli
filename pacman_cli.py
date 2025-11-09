"""Command-line entry point for the Pac-Man clone."""

from pacman_clone.game import DEFAULT_LEVEL, run_game


if __name__ == "__main__":
    run_game(DEFAULT_LEVEL)
