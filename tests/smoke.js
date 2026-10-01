// Smoke test: boots server.js on a test port and verifies the
// one-time 1-on-1 room lifecycle. Run with `npm test`.
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

    const a = track(await openSocket());
    a.send(JSON.stringify({ type: 'create', username: 'Alice' }));
    const created = await onceType(a, 'created');
    if (!created.roomId) throw new Error('create did not return roomId');
    console.log(`create room: ok (${created.roomId})`);
    const roomId = created.roomId;

    const b = track(await openSocket());
    const peerJoinedP = onceType(a, 'peer-joined');
    b.send(JSON.stringify({ type: 'join', roomId, username: 'Bob' }));
    const joined = await onceType(b, 'joined');
    if (joined.count !== 2) throw new Error(`expected count 2, got ${joined.count}`);
    await peerJoinedP;
    console.log('join as 2nd person: ok (2/2)');

    const chatP = onceType(b, 'chat');
    a.send(JSON.stringify({ type: 'message', text: 'hello bob' }));
    const chat = await chatP;
    if (chat.text !== 'hello bob' || chat.username !== 'Alice') {
      throw new Error('message relay mismatch');
    }
    console.log('message relay: ok');

    const c = track(await openSocket());
    c.send(JSON.stringify({ type: 'join', roomId, username: 'Eve' }));
    await onceType(c, 'room-full');
    console.log('3rd person rejected (room-full): ok');
    c.close();

    const peerLeftP = onceType(a, 'peer-left');
    b.close();
    await peerLeftP;
    console.log('burn on disconnect (peer-left): ok');
    await wait(800); // allow server to finish burning the link

    const d = track(await openSocket());
    d.send(JSON.stringify({ type: 'join', roomId, username: 'Zed' }));
    await onceType(d, 'link-disabled');
    console.log('rejoin after burn rejected (link-disabled): ok');
    d.close();
    a.close();

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
