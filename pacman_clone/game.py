"""Core logic for a lightweight Pac-Man clone playable in the terminal."""

from __future__ import annotations

import os
import random
import sys
import time
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

Grid = List[List[str]]


@dataclass(frozen=True)
class Position:
    """Coordinates inside the grid."""

    row: int
    col: int

    def move(self, delta: Tuple[int, int]) -> "Position":
        return Position(self.row + delta[0], self.col + delta[1])


@dataclass(frozen=True)
class Level:
    """Static definition of the level layout."""

    rows: Sequence[str]

    @property
    def pellet_count(self) -> int:
        return sum(row.count(".") for row in self.rows)


DIRECTIONS: Dict[str, Tuple[int, int]] = {
    "w": (-1, 0),
    "s": (1, 0),
    "a": (0, -1),
    "d": (0, 1),
}


class Game:
    """Stateful Pac-Man game model."""

    def __init__(self, level: Level, *, lives: int = 3) -> None:
        self.level = level
        self.grid: Grid = [list(row) for row in level.rows]
        self.player = self._find_and_clear("P")
        if self.player is None:
            raise ValueError("Level must include a 'P' for the player start")
        self.ghosts: List[Position] = self._find_all_and_clear("G")
        if not self.ghosts:
            raise ValueError("Level must include at least one 'G' ghost")
        self.score = 0
        self.lives = lives
        self.remaining_pellets = self._count_pellets()
        self.game_over_message: Optional[str] = None
        self.random = random.Random()

    def _find_and_clear(self, marker: str) -> Optional[Position]:
        for row_index, row in enumerate(self.grid):
            for col_index, char in enumerate(row):
                if char == marker:
                    self.grid[row_index][col_index] = " "
                    return Position(row_index, col_index)
        return None

    def _find_all_and_clear(self, marker: str) -> List[Position]:
        positions: List[Position] = []
        for row_index, row in enumerate(self.grid):
            for col_index, char in enumerate(row):
                if char == marker:
                    self.grid[row_index][col_index] = " "
                    positions.append(Position(row_index, col_index))
        return positions

    def _count_pellets(self) -> int:
        return sum(cell == "." for row in self.grid for cell in row)

    def reset(self) -> None:
        """Reset the game to the initial level layout."""

        self.grid = [list(row) for row in self.level.rows]
        player = self._find_and_clear("P")
        ghosts = self._find_all_and_clear("G")
        if player is None or not ghosts:
            raise RuntimeError("Level reset failed due to missing player or ghosts")
        self.player = player
        self.ghosts = ghosts
        self.score = 0
        self.lives = 3
        self.remaining_pellets = self._count_pellets()
        self.game_over_message = None

    def handle_input(self, key: Optional[str]) -> None:
        if key is None:
            return
        key = key.lower()
        if key == "q":
            self.game_over_message = "Quit"
            return
        move = DIRECTIONS.get(key)
        if move is None:
            return
        next_position = self.player.move(move)
        if self._is_wall(next_position):
            return
        self.player = next_position
        self._eat_pellet(next_position)

    def update(self) -> None:
        self._move_ghosts()
        self._check_collisions()
        if self.remaining_pellets == 0 and self.game_over_message is None:
            self.game_over_message = "You cleared the maze!"

    def is_running(self) -> bool:
        return self.game_over_message is None and self.lives > 0

    def render(self) -> str:
        display = [row.copy() for row in self.grid]
        display[self.player.row][self.player.col] = "C"
        for ghost in self.ghosts:
            display[ghost.row][ghost.col] = "G"
        board_lines = ["".join(row) for row in display]
        header = f"Score: {self.score}   Lives: {self.lives}   Pellets: {self.remaining_pellets}"
        footer = "Controls: W/A/S/D to move, Q to quit"
        return "\n".join([header, *board_lines, footer])

    def _is_wall(self, position: Position) -> bool:
        return self.grid[position.row][position.col] == "#"

    def _eat_pellet(self, position: Position) -> None:
        if self.grid[position.row][position.col] == ".":
            self.grid[position.row][position.col] = " "
            self.score += 10
            self.remaining_pellets -= 1

    def _move_ghosts(self) -> None:
        updated: List[Position] = []
        for ghost in self.ghosts:
            options = self._available_moves(ghost)
            if options:
                # Basic chase: move towards the player if possible, otherwise random.
                preferred = self._preferred_move(ghost, options)
                updated.append(preferred)
            else:
                updated.append(ghost)
        self.ghosts = updated

    def _preferred_move(self, ghost: Position, options: List[Position]) -> Position:
        def distance_sq(pos: Position) -> int:
            return (pos.row - self.player.row) ** 2 + (pos.col - self.player.col) ** 2

        options.sort(key=distance_sq)
        # Give a little randomness to avoid deterministic oscillation.
        if len(options) > 1 and self.random.random() < 0.2:
            return self.random.choice(options)
        return options[0]

    def _available_moves(self, origin: Position) -> List[Position]:
        moves: List[Position] = []
        for delta in DIRECTIONS.values():
            candidate = origin.move(delta)
            if not self._is_wall(candidate):
                moves.append(candidate)
        return moves

    def _check_collisions(self) -> None:
        for ghost in self.ghosts:
            if ghost == self.player:
                self.lives -= 1
                if self.lives <= 0:
                    self.game_over_message = "Caught by a ghost!"
                    return
                # Reset player position to safe tile.
                self.player = self._find_respawn()
                return

    def _find_respawn(self) -> Position:
        # Respawn near original start if free; otherwise first open tile.
        original = self._find_and_clear("P")
        if original:
            return original
        for row_index, row in enumerate(self.grid):
            for col_index, cell in enumerate(row):
                if cell == " ":
                    return Position(row_index, col_index)
        raise RuntimeError("No valid respawn location found")


DEFAULT_LEVEL = Level(
    rows=(
        "####################",
        "#........##........#",
        "#.##.###.##.###.##.#",
        "#.................G#",
        "#.##.#.######.#.##.#",
        "#....#....##....#..#",
        "####.#### ## ####.##",
        "#P.................#",
        "####################",
    )
)


def clear_screen() -> None:
    if os.name == "nt":
        os.system("cls")
    else:
        sys.stdout.write("\033[2J\033[H")
        sys.stdout.flush()


def read_key(timeout: float = 0.1) -> Optional[str]:
    end_time = time.perf_counter() + timeout
    if os.name == "nt":
        import msvcrt  # type: ignore

        while time.perf_counter() < end_time:
            if msvcrt.kbhit():
                char = msvcrt.getwch()
                if char:
                    return char
            time.sleep(0.01)
        return None

    import select
    import termios
    import tty

    file_descriptor = sys.stdin.fileno()
    original_settings = termios.tcgetattr(file_descriptor)
    try:
        tty.setcbreak(file_descriptor)
        ready, _, _ = select.select([sys.stdin], [], [], timeout)
        if ready:
            char = sys.stdin.read(1)
            return char
        return None
    finally:
        termios.tcsetattr(file_descriptor, termios.TCSADRAIN, original_settings)


def run_game(level: Level = DEFAULT_LEVEL) -> None:
    game = Game(level)
    frame_delay = 0.12
    while game.is_running():
        clear_screen()
        print(game.render())
        key = read_key(frame_delay)
        game.handle_input(key)
        game.update()
    clear_screen()
    print(game.render())
    message = game.game_over_message or "Game over"
    print(f"\n{message}")
