// ==================== GAME STATE ====================
const TILE = 16;
let canvas, ctx;
let player, ghosts = [], score = 0, highScore = 0, lives = 3;
let dotsLeft = 0, powerMode = false, powerTimer = 0, ghostEatCombo = 0;
let gameState = 'title'; // title, playing, paused, levelComplete, gameOver
let animFrame = 0, lastTime = 0;
let keys = {};

const GHOST_COLORS = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852'];
const GHOST_NAMES = ['Blinky', 'Pinky', 'Inky', 'Clyde'];
