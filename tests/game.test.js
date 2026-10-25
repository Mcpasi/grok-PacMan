const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const revision = process.env.PACMAN_REVISION;
function readSource(file) {
  return revision
    ? execFileSync('git', ['show', `${revision}:${file}`], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
}
const html = readSource('index.html');
const scripts = [...html.matchAll(/<script(?:\s+src="([^"]+)"[^>]*>|>)([\s\S]*?)<\/script>/g)]
  .map((match) => ({ name: match[1] || 'inline.js', code: match[1] ? readSource(match[1]) : match[2] }));

function boot(options = {}) {
  const elements = new Map();
  const frames = [];
  const timers = [];
  const drawing = [];
  const storage = new Map([['pacmanHigh', options.highScore || '0']]);
  const context2d = new Proxy({}, {
    get(target, key) {
      return target[key] ?? ((...args) => drawing.push([key, ...args]));
    }
  });
  class Element {
    constructor() { this.style = {}; this.listeners = new Map(); this.children = []; }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    emit(type, event = {}) {
      for (const listener of this.listeners.get(type) || []) listener(event);
      if (type === 'click' && this.onclick) this.onclick(event);
    }
    appendChild(child) { this.children.push(child); }
    getContext() { return context2d; }
    setPointerCapture(id) { this.capturedPointer = id; }
    set innerHTML(value) {
      this.children = [];
      this.html = value;
      for (const match of value.matchAll(/id="([^"]+)"/g)) elements.set(match[1], new Element());
    }
    get innerHTML() { return this.html || ''; }
  }
  for (const id of ['gameCanvas', 'score', 'highScore', 'lives', 'overlay', 'startBtn']) {
    elements.set(id, new Element());
  }
  class AudioContext {
    constructor() {
      if (options.audio === 'throws') throw new Error('Audio unavailable');
      this.currentTime = 0;
      this.destination = {};
      this.state = options.audio === 'suspended' ? 'suspended' : 'running';
    }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createOscillator() {
      if (options.audio === 'toneThrows') throw new Error('Audio device lost');
      return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    }
  }
  const window = new Element();
  if (options.audio !== 'missing') window[options.audio === 'webkit' ? 'webkitAudioContext' : 'AudioContext'] = AudioContext;
  const document = new Element();
  document.getElementById = (id) => elements.get(id) || null;
  document.createElement = () => new Element();
  const sandbox = {
    window, document,
    localStorage: {
      getItem(key) {
        if (options.storage === 'readThrows') throw new Error('SecurityError');
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        if (options.storage === 'writeThrows') throw new Error('QuotaExceededError');
        storage.set(key, String(value));
      }
    },
    requestAnimationFrame(callback) { frames.push(callback); },
    setTimeout(callback, delay) { timers.push({ callback, delay }); }
  };
  if (options.storage === 'accessThrows') {
    Object.defineProperty(sandbox, 'localStorage', { get() { throw new Error('SecurityError'); } });
  }
  const context = vm.createContext(sandbox);
  for (const script of scripts) vm.runInContext(script.code, context, { filename: script.name });
  const run = (code) => vm.runInContext(code, context);
  window.emit('load');
  return {
    run, elements, frames, drawing, storage,
    click(id = 'startBtn') { elements.get(id).emit('click'); },
    key(key, repeat = false) {
      const event = { key, repeat, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      document.emit('keydown', event);
      return event;
    },
    pointer(type, x, y, id = 1) {
      elements.get('gameCanvas').emit(type, { clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: true });
    },
    advance(count = 1) {
      for (let i = 0; i < count; i++) {
        assert.ok(frames.length, 'animation loop must keep running');
        frames.shift()(i * 1000 / 60);
      }
    },
    respawn() {
      const timer = timers.find(({ delay }) => delay === 1500);
      assert.ok(timer, 'death must schedule a respawn');
      timer.callback();
    }
  };
}

test('load renders the maze and a new game spawns in a corridor', () => {
  const game = boot();
  game.advance();
  assert.ok(game.drawing.some(([method]) => method === 'arc'));
  game.click();
  assert.equal(game.run('maze[Math.floor(player.y / TILE)][Math.floor(player.x / TILE)] !== 0'), true);
  assert.equal(game.run('player.y % TILE'), 8);
});

test('after Start, Pac-Man moves and eats dots without input', () => {
  const game = boot();
  game.click();
  const x = game.run('player.x');
  game.advance(40);
  assert.ok(game.run('player.x') > x + 32);
  assert.ok(game.run('score') >= 30);
});

test('centering does not undo movement, including fractional level speeds', () => {
  for (const speed of [1.6, 1.7, 1.8, 1.9, 2.2]) {
    const game = boot();
    game.run(`player.x = 13.5 * TILE; player.y = 22.5 * TILE; player.speed = ${speed};`);
    const x = game.run('player.x');
    game.run('for (let i = 0; i < 40; i++) updatePlayer();');
    assert.ok(Math.abs(game.run('player.x') - x - 40 * speed) < 1e-6, `speed ${speed}`);
  }
});

test('buffered turns happen at tile centers and walls stop movement', () => {
  const game = boot();
  game.click();
  game.run('player.x = 5.5 * TILE; player.y = 22.5 * TILE; player.dir = 0; player.nextDir = 3;');
  game.run('for (let i = 0; i < 15; i++) updatePlayer();');
  assert.ok(Math.abs(game.run('player.x') - 6.5 * 16) < 1e-6);
  assert.ok(Math.abs(game.run('player.y') - 22 * 16) < 1e-6);
  game.run('player.x = 26.5 * TILE; player.y = 22.5 * TILE; player.dir = player.nextDir = 0;');
  game.run('for (let i = 0; i < 40; i++) updatePlayer();');
  assert.equal(game.run('player.x'), 26.5 * 16);
});

test('reversing between tile centers is immediate', () => {
  const game = boot();
  game.click();
  game.run('player.y = 22.5 * TILE; updatePlayer();');
  const x = game.run('player.x');
  assert.equal(game.key('A').defaultPrevented, true);
  game.run('updatePlayer();');
  assert.ok(Math.abs(game.run('player.x') - (x - 1.6)) < 1e-6);
});

test('both tunnel directions wrap without trapping the player', () => {
  for (const dir of [0, 2]) {
    const game = boot();
    game.run(`player.x = ${dir === 0 ? 27.5 : -0.5} * TILE; player.y = 11.5 * TILE; player.dir = player.nextDir = ${dir};`);
    game.run('for (let i = 0; i < 20; i++) updatePlayer();');
    assert.ok(dir === 0 ? game.run('player.x < 40') : game.run('player.x > 400'));
  }
});

test('keyboard starts, pauses, resumes and does not hide the title on Escape', () => {
  const game = boot();
  game.key('Escape');
  assert.notEqual(game.elements.get('overlay').style.display, 'none');
  assert.equal(game.key('Enter').defaultPrevented, true);
  assert.equal(game.run('gameState'), 'playing');
  game.key('p');
  assert.equal(game.run('gameState'), 'paused');
  game.key('p', true);
  assert.equal(game.run('gameState'), 'paused');
  const x = game.run('player.x');
  game.advance(10);
  assert.equal(game.run('player.x'), x);
  game.click('ovBtn');
  assert.equal(game.run('gameState'), 'playing');
  for (const [key, dir] of [['ArrowRight', 0], ['S', 1], ['ArrowLeft', 2], ['W', 3]]) {
    assert.equal(game.key(key).defaultPrevented, true);
    assert.equal(game.run('player.nextDir'), dir);
  }
});

test('swiping changes direction and cancellation or other fingers do not steer', () => {
  const game = boot();
  game.click();
  game.pointer('pointerdown', 100, 100);
  game.pointer('pointermove', 60, 100);
  assert.equal(game.run('player.nextDir'), 2);
  game.advance(10);
  assert.ok(game.run('player.x < 13.5 * TILE'));
  game.pointer('pointermove', 60, 60);
  assert.equal(game.run('player.nextDir'), 3);
  game.pointer('pointermove', 100, 60, 2);
  assert.equal(game.run('player.nextDir'), 3);
  game.pointer('pointercancel', 60, 60);
  game.pointer('pointermove', 100, 60);
  assert.equal(game.run('player.nextDir'), 3);
  game.pointer('pointerdown', 100, 100);
  game.pointer('pointerup', 100, 140);
  assert.equal(game.run('player.nextDir'), 1);
});

for (const storage of ['accessThrows', 'readThrows', 'writeThrows']) {
  test(`unavailable storage (${storage}) never aborts loading or rendering`, () => {
    const game = boot({ storage });
    game.advance();
    game.click();
    game.run('player.x = 1.5 * TILE; player.y = 1.5 * TILE;');
    game.advance(10);
    assert.ok(game.run('score') > 0);
    assert.equal(game.run('highScore'), game.run('score'));
    assert.equal(game.frames.length, 1);
  });
}

test('invalid saved scores fall back to zero and high scores still save', () => {
  const game = boot({ highScore: 'not-a-score' });
  assert.equal(game.run('highScore'), 0);
  game.click();
  game.run('player.x = 1.5 * TILE; player.y = 1.5 * TILE;');
  game.advance();
  assert.equal(game.storage.get('pacmanHigh'), String(game.run('score')));
});

for (const audio of ['missing', 'throws', 'toneThrows', 'suspended', 'webkit']) {
  test(`audio (${audio}) does not prevent Start or stop the animation`, () => {
    const game = boot({ audio });
    game.click();
    assert.equal(game.run('gameState'), 'playing');
    game.run('player.x = 1.5 * TILE; player.y = 1.5 * TILE;');
    game.advance(10);
    assert.equal(game.frames.length, 1);
    if (audio === 'suspended') assert.equal(game.run('audioCtx.state'), 'running');
  });
}

test('death respawns and both next-level and restart buttons allow movement', () => {
  const game = boot();
  game.click();
  game.run('ghosts[0].mode = "chase"; ghosts[0].x = player.x; ghosts[0].y = player.y; checkCollisions();');
  assert.equal(game.run('lives'), 2);
  game.respawn();
  assert.equal(game.run('player.alive'), true);
  const x = game.run('player.x');
  game.advance(20);
  assert.ok(game.run('player.x') > x);
  game.run('dotsLeft = 0; updatePlayer();');
  assert.equal(game.run('gameState'), 'levelComplete');
  game.click('ovBtn');
  game.advance(20);
  assert.ok(game.run('player.x') > x);
  game.run('gameState = "gameOver"; showOverlay("GAME OVER", "", "RESTART");');
  game.click('ovBtn');
  assert.equal(game.run('lives'), 3);
  game.advance(20);
  assert.ok(game.run('player.x') > x);
});
