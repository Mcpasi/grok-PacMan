// ==================== DRAWING ====================
function drawMaze() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = maze[r][c];
      const x = c * TILE, y = r * TILE;
      if (cell === 0) {
        ctx.fillStyle = '#2121de';
        ctx.fillRect(x, y, TILE, TILE);
        // inner highlight
        ctx.fillStyle = '#0000aa';
        ctx.fillRect(x+1, y+1, TILE-2, TILE-2);
      } else if (cell === 2) {
        ctx.fillStyle = '#ffb897';
        ctx.beginPath();
        ctx.arc(x + TILE/2, y + TILE/2, 2, 0, Math.PI*2);
        ctx.fill();
      } else if (cell === 3) {
        ctx.fillStyle = '#ffb897';
        ctx.beginPath();
        ctx.arc(x + TILE/2, y + TILE/2, 6, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }
  // ghost house door
  ctx.fillStyle = '#ffb8ff';
  ctx.fillRect(13*TILE, 12*TILE - 2, 2*TILE, 4);
}

function drawPlayer() {
  if (!player.alive) return;
  const mouth = 0.2 + player.mouth * 0.6;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.dir * Math.PI / 2);
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, TILE*0.45, mouth, Math.PI*2 - mouth);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGhosts() {
  ghosts.forEach(g => {
    if (g.mode === 'house' && g.houseTimer > 30) return; // hide a bit
    const x = g.x, y = g.y;
    let color = GHOST_COLORS[g.color];
    if (g.mode === 'eyes') color = '#fff';
    else if (g.scared) color = (powerTimer < 120 && Math.floor(animFrame/8)%2) ? '#fff' : '#2121de';
    ctx.fillStyle = color;
    // body
    ctx.beginPath();
    ctx.arc(x, y - 2, TILE*0.4, Math.PI, 0);
    ctx.lineTo(x + TILE*0.4, y + TILE*0.3);
    for (let i = 0; i < 3; i++) {
      ctx.quadraticCurveTo(x + TILE*0.4 - i*TILE*0.25, y + TILE*0.5, x + TILE*0.4 - (i+0.5)*TILE*0.25, y + TILE*0.3);
    }
    ctx.lineTo(x - TILE*0.4, y - 2);
    ctx.fill();
    // eyes
    if (g.mode !== 'eyes') {
      const eyeOff = DIRS[g.dir][0]*2;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x-4, y-4, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+4, y-4, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#0000ff';
      ctx.beginPath(); ctx.arc(x-4 + eyeOff, y-4, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+4 + eyeOff, y-4, 2, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle = '#00f';
      ctx.beginPath(); ctx.arc(x-4, y-2, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+4, y-2, 3, 0, Math.PI*2); ctx.fill();
    }
  });
}
