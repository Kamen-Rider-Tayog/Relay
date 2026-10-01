// Smoke test: boots server.js on a test port and verifies the
// Omegle-style stranger-chat lifecycle. Run with `npm test`.
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.TEST_PORT || 18080;
const URL = `ws://127.0.0.1:${PORT}`;
const TIMEOUT = 8000;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function onceType(ws, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), TIMEOUT);
    const handler = (data) => {
      try {
        const m = JSON.parse(data.toString());
        if (m.type === type) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          resolve(m);
        }
      } catch { /* ignore non-JSON */ }
    };
    ws.on('message', handler);
  });
}

async function waitForHealth() {
  const start = Date.now();
  while (Date.now() - start < TIMEOUT) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await wait(200);
  }
  throw new Error('server did not become healthy in time');
}

function openSocket() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const timer = setTimeout(() => reject(new Error('connect timeout')), TIMEOUT);
    ws.on('open', () => { clearTimeout(timer); resolve(ws); });
    ws.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe',
  });
  server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  const sockets = [];
  const track = (ws) => { sockets.push(ws); return ws; };
  let failed = null;

  try {
    await waitForHealth();
    console.log('health check: ok');

    // 1. Username is required — blank search is rejected, socket survives.
    const anon = track(await openSocket());
    anon.send(JSON.stringify({ type: 'search', username: '   ' }));
    await onceType(anon, 'username-required');
    console.log('username required (blank rejected): ok');

    // 2. Two searchers pair up and see each other's names.
    const a = track(await openSocket());
    const b = track(await openSocket());
    a.send(JSON.stringify({ type: 'search', username: 'Alice' }));
    await onceType(a, 'searching');
    b.send(JSON.stringify({ type: 'search', username: 'Bob' }));
    const [matchA, matchB] = await Promise.all([onceType(a, 'matched'), onceType(b, 'matched')]);
    if (matchA.peer !== 'Bob' || matchB.peer !== 'Alice') {
      throw new Error(`peer names wrong: ${matchA.peer} / ${matchB.peer}`);
    }
    console.log('random match with visible names: ok');

    // 3. Message relay within the pairing.
    const chatP = onceType(b, 'chat');
    a.send(JSON.stringify({ type: 'message', text: 'hello bob' }));
    const chat = await chatP;
    if (chat.text !== 'hello bob' || chat.username !== 'Alice') {
      throw new Error('message relay mismatch');
    }
    console.log('message relay: ok');

    // 4. A third searcher waits unpaired while the pair is busy.
    const c = track(await openSocket());
    c.send(JSON.stringify({ type: 'search', username: 'Cara' }));
    await onceType(c, 'searching');
    await wait(500);
    console.log('3rd searcher waits (no steal): ok');

    // 5. Skip: Alice auto-repairs with waiting Cara, Bob gets peer-skipped.
    const skippedP = onceType(b, 'peer-skipped');
    const rematchP = onceType(a, 'matched');
    const caraMatchP = onceType(c, 'matched');
    a.send(JSON.stringify({ type: 'next', username: 'Alice' }));
    const [rematch, caraMatch] = await Promise.all([rematchP, caraMatchP]);
    await skippedP;
    if (rematch.peer !== 'Cara' || caraMatch.peer !== 'Alice') {
      throw new Error(`skip rematch wrong: ${rematch.peer} / ${caraMatch.peer}`);
    }
    console.log('skip auto-matches next stranger, survivor notified: ok');

    // 6. Disconnect burns the pairing permanently for the survivor.
    const leftP = onceType(c, 'peer-left');
    a.close();
    await leftP;
    console.log('burn on disconnect (peer-left): ok');

    // 7. Lobby stats are broadcast.
    const statsP = onceType(c, 'stats');
    const d = track(await openSocket());
    const stats = await statsP;
    if (typeof stats.online !== 'number' || typeof stats.searching !== 'number') {
      throw new Error('stats shape wrong');
    }
    console.log(`lobby stats broadcast: ok (${stats.online} online)`);
    d.close();

    anon.close(); b.close(); c.close();
    console.log('SMOKE_PASSED');
  } catch (err) {
    failed = err;
    console.error(`SMOKE_FAILED: ${err.message}`);
  } finally {
    for (const ws of sockets) { try { ws.close(); } catch {} }
    await wait(300);
    server.kill();
    await wait(300);
  }
  process.exit(failed ? 1 : 0);
})();
