function init() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  try {
    highScore = Math.max(0, parseInt(localStorage.getItem('pacmanHigh'), 10) || 0);
  } catch {
    highScore = 0; // Storage can be blocked in private or embedded browsers.
  }
  document.getElementById('highScore').textContent = 'HIGH: ' + highScore;
  document.getElementById('startBtn').addEventListener('click', startGame);
  initInput();
  loadMaze();
  resetLevel(true);
  requestAnimationFrame(loop);
}

function resetLevel(isNewGame = false) {
  loadMaze();
  dotsLeft = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (maze[r][c] === 2 || maze[r][c] === 3) dotsLeft++;
  player = {
    x: 13.5 * TILE, y: 22.5 * TILE,
    dir: 0, nextDir: 0, // 0=right,1=down,2=left,3=up
    speed: 1.6, mouth: 0, mouthDir: 1, alive: true
  };
  ghosts = [
    { x: 13.5*TILE, y: 11*TILE, dir: 0, color: 0, mode: 'house', houseTimer: 0, target: {x:0,y:0}, scared: false },
    { x: 13.5*TILE, y: 14*TILE, dir: 0, color: 1, mode: 'house', houseTimer: 60, target: {x:0,y:0}, scared: false },
    { x: 11.5*TILE, y: 14*TILE, dir: 2, color: 2, mode: 'house', houseTimer: 120, target: {x:0,y:0}, scared: false },
    { x: 15.5*TILE, y: 14*TILE, dir: 0, color: 3, mode: 'house', houseTimer: 180, target: {x:0,y:0}, scared: false }
  ];
  powerMode = false;
  powerTimer = 0;
  ghostEatCombo = 0;
  if (isNewGame) {
    score = 0;
    lives = 3;
  }
  updateUI();
}

function startGame() {
  initAudio();
  animFrame = 0;
  gameState = 'playing';
  document.getElementById('overlay').style.display = 'none';
  resetLevel(true);
}
