// Actor renderers know nothing about the environment or movement rules.
// Replace either function through GameRenderer.setActors() to introduce a new skin.
const ClassicActors = {
  player(ctx, player, { tile }) {
    if (!player.alive) return;
    const mouth = 0.2 + player.mouth * 0.6;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.dir * Math.PI / 2);
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, tile * 0.45, mouth, Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  ghosts(ctx, ghosts, { tile, colors, dirs, powerTimer, animFrame }) {
    ghosts.forEach(g => {
      if (g.mode === 'house' && g.houseTimer > 30) return;
      const x = g.x, y = g.y;
      let color = colors[g.color];
      if (g.mode === 'eyes') color = '#fff';
      else if (g.scared) color = (powerTimer < 120 && Math.floor(animFrame / 8) % 2) ? '#fff' : '#2121de';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y - 2, tile * 0.4, Math.PI, 0);
      ctx.lineTo(x + tile * 0.4, y + tile * 0.3);
      for (let i = 0; i < 3; i++) {
        ctx.quadraticCurveTo(x + tile * 0.4 - i * tile * 0.25, y + tile * 0.5,
          x + tile * 0.4 - (i + 0.5) * tile * 0.25, y + tile * 0.3);
      }
      ctx.lineTo(x - tile * 0.4, y - 2);
      ctx.fill();
      if (g.mode !== 'eyes') {
        const eyeOff = dirs[g.dir][0] * 2;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - 4, y - 4, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 4, y - 4, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0000ff';
        ctx.beginPath(); ctx.arc(x - 4 + eyeOff, y - 4, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 4 + eyeOff, y - 4, 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#00f';
        ctx.beginPath(); ctx.arc(x - 4, y - 2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 4, y - 2, 3, 0, Math.PI * 2); ctx.fill();
      }
    });
  }
};
