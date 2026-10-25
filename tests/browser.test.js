const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

// Opt-in, dependency-free Chromium smoke test:
// PACMAN_BROWSER=chromium PACMAN_TEST_THREE=1 node --test tests/browser.test.js
// Omit PACMAN_TEST_THREE for a fully offline Canvas-only run.
const executable = process.env.PACMAN_BROWSER;
const root = path.join(__dirname, '..');

async function connect(url) {
  const socket = new WebSocket(url);
  await once(socket, 'open', { signal: AbortSignal.timeout(15000) });
  let sequence = 0;
  const pending = new Map(), errors = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('Browser debugging connection closed.'));
    }
    pending.clear();
  });
  function send(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  return {
    send, errors, close: () => socket.close(),
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
  };
}

async function waitFor(check, message, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  throw new Error(message);
}

test('browser smoke: city, movement, pause, mobile layout and offline fallback', {
  skip: !executable && 'Set PACMAN_BROWSER to a Chromium executable.', timeout: 90000
}, async t => {
  let browser, client, profile;
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
      const file = path.join(root, pathname === '/' ? 'index.html' : decodeURIComponent(pathname));
      if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
      const content = await fs.readFile(file);
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' }[path.extname(file)];
      response.writeHead(200, { 'Content-Type': type || 'application/octet-stream' }).end(content);
    } catch { response.writeHead(404).end(); }
  });
  t.after(async () => {
    client?.close();
    if (browser?.pid && browser.exitCode === null && browser.signalCode === null) {
      const exited = once(browser, 'exit');
      browser.kill();
      await exited;
    }
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    if (profile) await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const preferredTemp = '/data/user/0/com.foxdebug.acode/cache/opencode';
  const temp = await fs.stat(preferredTemp).then(() => preferredTemp, () => os.tmpdir());
  profile = await fs.mkdtemp(path.join(temp, 'pacman-browser-'));
  const testThree = process.env.PACMAN_TEST_THREE === '1';
  const gpuArgs = process.env.PACMAN_BROWSER_ARGS ? JSON.parse(process.env.PACMAN_BROWSER_ARGS) :
    testThree ? ['--enable-unsafe-swiftshader', '--use-angle=swiftshader-webgl', '--ignore-gpu-blocklist'] : ['--disable-gpu', '--disable-software-rasterizer'];
  browser = spawn(executable, ['--headless', '--no-sandbox', '--disable-dev-shm-usage',
    ...gpuArgs,
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank']);
  let stderr = '', startupError;
  browser.stderr.on('data', chunk => { stderr += chunk; });
  browser.on('error', error => { startupError = error; });
  t.after(() => { if (t.passed === false) t.diagnostic(stderr.slice(-5000)); });
  await waitFor(() => {
    if (startupError) throw startupError;
    return /DevTools listening on (ws:\/\/\S+)/.test(stderr);
  }, 'Chromium did not start: ' + stderr);
  const debugUrl = new URL(stderr.match(/DevTools listening on (ws:\/\/\S+)/)[1]);
  t.diagnostic('Chromium started.');
  const pages = await fetch(`http://${debugUrl.host}/json/list`).then(response => response.json());
  client = await connect(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  t.diagnostic('Browser debugging connection established.');
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  await client.send('Network.enable');
  if (!testThree) await client.send('Network.setBlockedURLs', { urls: ['*cdn.jsdelivr.net*'] });
  await client.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 900, deviceScaleFactor: 1, mobile: false });
  await client.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  await waitFor(() => client.evaluate("!!document.getElementById('gameCanvas')?.dataset.renderer"), 'Game did not initialize.');
  t.diagnostic('Game initialized.');
  if (testThree) {
    await waitFor(() => client.evaluate("document.getElementById('gameCanvas').dataset.renderer === 'three'"),
      'Three.js did not initialize (this opt-in check needs CDN access and WebGL).', 40000);
    assert.equal(await client.evaluate("document.querySelectorAll('.city-scene').length"), 1);
    t.diagnostic('Three.js city rendered.');
  }
  await client.evaluate("document.getElementById('startBtn').click()");
  await waitFor(() => client.evaluate('score > 0 && player.x > 13.5 * TILE'), 'Pac-Man did not move and collect dots.');
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'p' });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'p' });
  assert.equal(await client.evaluate('gameState'), 'paused');
  const position = await client.evaluate('player.x');
  await client.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  assert.equal(await client.evaluate('player.x'), position);

  if (testThree) {
    await client.evaluate('resetLevel(false); resetLevel(false);');
    assert.equal(await client.evaluate("document.querySelectorAll('.city-scene').length"), 1, 'restarts must not leak canvases');
    await client.evaluate(`(() => {
      const canvas = document.querySelector('.city-scene');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      gl.getExtension('WEBGL_lose_context').loseContext();
    })()`);
    await waitFor(() => client.evaluate("document.getElementById('gameCanvas').dataset.renderer === 'canvas'"), 'Context loss did not activate Canvas.');
    assert.equal(await client.evaluate("document.querySelectorAll('.city-scene').length"), 0);
  }

  for (const [width, height] of [[390, 844], [844, 390]]) {
    await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    assert.ok(await client.evaluate(`(() => {
      const rect = document.getElementById('gameViewport').getBoundingClientRect();
      return rect.width > 100 && rect.left >= 0 && rect.right <= innerWidth &&
        document.documentElement.scrollWidth <= innerWidth;
    })()`), 'mobile layout must fit horizontally');
  }
  await client.send('Emulation.setDeviceMetricsOverride', { width: 960, height: 900, deviceScaleFactor: 1, mobile: false });
  await client.evaluate('gameState = "playing"; showOverlay(null);');
  if (process.env.PACMAN_SCREENSHOT) {
    const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(process.env.PACMAN_SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
  }
  await client.send('Network.setBlockedURLs', { urls: ['*cdn.jsdelivr.net*'] });
  await client.send('Page.reload', { ignoreCache: true });
  await waitFor(() => client.evaluate("!!document.getElementById('startBtn') && document.getElementById('gameCanvas').dataset.renderer === 'canvas'"), 'Offline city did not initialize.');
  await client.evaluate("document.getElementById('startBtn').click()");
  await waitFor(() => client.evaluate('score > 0'), 'Offline city is not playable.');
  assert.deepEqual(client.errors, [], 'no uncaught browser errors');
});
