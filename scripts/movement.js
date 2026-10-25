// ==================== MOVEMENT & COLLISION ====================
const DIRS = [[1,0],[0,1],[-1,0],[0,-1]];

function canMove(x, y, dir, isGhost = false) {
  const nx = x + DIRS[dir][0] * TILE * 0.6;
  const ny = y + DIRS[dir][1] * TILE * 0.6;
  const c = Math.floor(nx / TILE);
  const r = Math.floor(ny / TILE);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true; // tunnel
  const cell = maze[r][c];
  if (cell === 0) return false;
  if (cell === 4 && !isGhost) return false; // player can't enter door
  return true;
}

function updatePlayer() {
  if (!player.alive) return;
  // try turn
  if (canMove(player.x, player.y, player.nextDir)) player.dir = player.nextDir;
  if (canMove(player.x, player.y, player.dir)) {
    player.x += DIRS[player.dir][0] * player.speed;
    player.y += DIRS[player.dir][1] * player.speed;
  }
  // tunnel wrap
  if (player.x < -TILE/2) player.x = COLS * TILE - TILE/2;
  if (player.x > COLS * TILE - TILE/2) player.x = -TILE/2;
  // snap to center of tile for cleaner turns
  const cx = Math.floor(player.x / TILE) * TILE + TILE/2;
  const cy = Math.floor(player.y / TILE) * TILE + TILE/2;
  if (Math.abs(player.x - cx) < player.speed && Math.abs(player.y - cy) < player.speed) {
    player.x = cx; player.y = cy;
  }
  // mouth
  player.mouth += player.mouthDir * 0.3;
  if (player.mouth > 0.4 || player.mouth < 0) player.mouthDir *= -1;
  // eat
  const c = Math.floor(player.x / TILE);
  const r = Math.floor(player.y / TILE);
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
    if (maze[r][c] === 2) {
      maze[r][c] = 1;
      score += 10;
      dotsLeft--;
      playChomp();
      updateUI();
    } else if (maze[r][c] === 3) {
      maze[r][c] = 1;
      score += 50;
      dotsLeft--;
      powerMode = true;
      powerTimer = 480; // ~8 seconds at 60fps
      ghostEatCombo = 0;
      ghosts.forEach(g => { if (g.mode !== 'house' && g.mode !== 'eyes') g.scared = true; });
      playPower();
      updateUI();
    }
  }
  if (dotsLeft <= 0) {
    gameState = 'levelComplete';
    showOverlay('LEVEL COMPLETE!', 'Press Enter or click to continue', 'NEXT LEVEL');
  }
}

function updateGhosts() {
  ghosts.forEach((g, i) => {
    if (g.mode === 'house') {
      g.houseTimer--;
      if (g.houseTimer <= 0) {
        g.mode = 'chase';
        g.y = 11 * TILE;
        g.scared = powerMode;
      }
      return;
    }
    if (g.mode === 'eyes') {
      // return to house
      const target = { x: 13.5*TILE, y: 11*TILE };
      const dx = target.x - g.x, dy = target.y - g.y;
      if (Math.abs(dx) + Math.abs(dy) < TILE) {
        g.mode = 'house';
        g.houseTimer = 60;
        g.x = 13.5*TILE; g.y = 14*TILE;
        g.scared = false;
        return;
      }
      // simple move toward
      let best = 0, bestDist = Infinity;
      for (let d = 0; d < 4; d++) {
        if (!canMove(g.x, g.y, d, true)) continue;
        const nx = g.x + DIRS[d][0]*TILE, ny = g.y + DIRS[d][1]*TILE;
        const dist = Math.hypot(nx - target.x, ny - target.y);
        if (dist < bestDist) { bestDist = dist; best = d; }
      }
      g.dir = best;
      g.x += DIRS[g.dir][0] * 2.2;
      g.y += DIRS[g.dir][1] * 2.2;
      return;
    }
    // AI targeting
    let targetX = player.x, targetY = player.y;
    if (g.scared) {
      // flee
      targetX = g.x + (g.x - player.x)*2;
      targetY = g.y + (g.y - player.y)*2;
    } else {
      if (i === 0) { /* Blinky: direct chase */ }
      else if (i === 1) { /* Pinky: 4 tiles ahead */
        targetX = player.x + DIRS[player.dir][0] * 4 * TILE;
        targetY = player.y + DIRS[player.dir][1] * 4 * TILE;
      } else if (i === 2) { /* Inky: ambush */
        const bx = ghosts[0].x, by = ghosts[0].y;
        const px = player.x + DIRS[player.dir][0]*2*TILE;
        const py = player.y + DIRS[player.dir][1]*2*TILE;
        targetX = px + (px - bx);
        targetY = py + (py - by);
      } else { /* Clyde: chase if far, scatter if close */
        const dist = Math.hypot(g.x - player.x, g.y - player.y);
        if (dist < 8*TILE) { targetX = 0; targetY = ROWS*TILE; } // corner
      }
    }
    // choose best direction (no reverse)
    let best = g.dir, bestDist = Infinity;
    for (let d = 0; d < 4; d++) {
      if (d === (g.dir + 2) % 4 && !g.scared) continue; // no 180
      if (!canMove(g.x, g.y, d, true)) continue;
      const nx = g.x + DIRS[d][0] * TILE;
      const ny = g.y + DIRS[d][1] * TILE;
      const dist = Math.hypot(nx - targetX, ny - targetY);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    g.dir = best;
    const spd = g.scared ? 0.9 : 1.4;
    g.x += DIRS[g.dir][0] * spd;
    g.y += DIRS[g.dir][1] * spd;
    // tunnel
    if (g.x < -TILE/2) g.x = COLS*TILE - TILE/2;
    if (g.x > COLS*TILE - TILE/2) g.x = -TILE/2;
  });
  if (powerMode) {
    powerTimer--;
    if (powerTimer <= 0) {
      powerMode = false;
      ghosts.forEach(g => g.scared = false);
    }
  }
}

function checkCollisions() {
  if (!player.alive) return;
  ghosts.forEach(g => {
    if (g.mode === 'house' || g.mode === 'eyes') return;
    const dist = Math.hypot(player.x - g.x, player.y - g.y);
    if (dist < TILE * 0.7) {
      if (g.scared) {
        // eat ghost
        g.mode = 'eyes';
        g.scared = false;
        const pts = [200,400,800,1600][Math.min(ghostEatCombo, 3)];
        score += pts;
        ghostEatCombo++;
        playGhostEat();
        updateUI();
      } else {
        // die
        player.alive = false;
        lives--;
        playDeath();
        updateUI();
        setTimeout(() => {
          if (lives <= 0) {
            gameState = 'gameOver';
            showOverlay('GAME OVER', `Final Score: ${score}`, 'RESTART');
          } else {
            resetLevel(false);
            player.alive = true;
          }
        }, 1500);
      }
    }
  });
}
