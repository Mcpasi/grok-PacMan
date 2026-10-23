# The original prompt

The brief below was given, word for word, to all three builders on 2026-10-22 — to Muse Spark in chat (Muse-PacMan), to Grok (grok-PacMan), and through the Zouroboros Workshop factory to Hermes / claude-opus-5-5 (workshop-PacMan). The workshop copy additionally carried a delivery contract (named deliverables and a build report with provenance), appended when the brief was dispatched as factory task t_ee20fc1b; the game specification itself was unchanged.

---

Build a complete, playable Pac-Man–style game using only HTML, CSS, and vanilla JavaScript (no frameworks or external libraries). Use an HTML5 Canvas for the game board.

Core Requirements:

Maze
- Generate a classic-style Pac-Man maze with walls, open paths, and a central ghost house.
- Use a 2D tile/grid system so the maze is easy to modify.
- Include tunnel exits on the left and right sides that wrap around.

Player (Pac-Man)
- Yellow circle that opens and closes its mouth while moving.
- Controlled with arrow keys or WASD.
- Moves smoothly on the grid (or tile-by-tile).
- Starts with 3 lives.

Collectibles
- Small white dots scattered throughout the maze.
- Four larger power pellets (usually in the corners).
- Eating all dots wins the level.

Ghosts (4 total)
- Classic colors: Red, Pink, Cyan, Orange.
- Each has a simple but distinct AI behavior (e.g., one chases directly, one tries to cut off, one wanders, one is more random).
- Ghosts leave the ghost house at staggered times.
- When a power pellet is eaten, ghosts turn blue/vulnerable for a short time and can be eaten for points (200, 400, 800, 1600).
- After being eaten, a ghost returns to the house and regenerates.

Scoring & Lives
- Points for dots, power pellets, and eating ghosts.
- Display score, high score, and remaining lives on screen.
- Lose a life when touched by a non-vulnerable ghost. Game over when lives reach 0.

Game Flow
- Title/start screen.
- Level complete screen when all dots are eaten (then restart the maze with increased difficulty or same layout).
- Game over screen with final score and restart option.
- Pause functionality (press P or Escape).

Polish
- Simple animations (Pac-Man mouth, ghost eye direction).
- Basic sound effects using the Web Audio API (or optional <audio> tags) for eating dots, power pellets, death, and eating ghosts.
- Responsive canvas that scales reasonably on different screen sizes.
- Clean, readable code with comments explaining the main systems (maze, movement, ghost AI, collision).

Deliver the full working code in a single HTML file so I can open it directly in a browser. Make the maze and game feel as close to the original Pac-Man as reasonably possible while keeping the code understandable.
