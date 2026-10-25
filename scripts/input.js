function onKeyDown(e) {
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (gameState === 'playing') gameState = 'paused';
    else if (gameState === 'paused') gameState = 'playing';
    showOverlay(gameState === 'paused' ? 'PAUSED' : null);
  }
  if (gameState === 'title' && (e.key === 'Enter' || e.key === ' ')) startGame();
  if (gameState === 'gameOver' && (e.key === 'Enter' || e.key === ' ')) startGame();
  if (gameState === 'levelComplete' && (e.key === 'Enter' || e.key === ' ')) {
    gameState = 'playing';
    document.getElementById('overlay').style.display = 'none';
    resetLevel(false);
    // slight speed increase
    player.speed = Math.min(2.2, player.speed + 0.1);
    ghosts.forEach(g => g.speed = Math.min(1.9, (g.speed||1.4) + 0.08));
  }
  // direction
  if (e.key === 'ArrowRight' || e.key === 'd') player.nextDir = 0;
  if (e.key === 'ArrowDown' || e.key === 's') player.nextDir = 1;
  if (e.key === 'ArrowLeft' || e.key === 'a') player.nextDir = 2;
  if (e.key === 'ArrowUp' || e.key === 'w') player.nextDir = 3;
}
function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }
