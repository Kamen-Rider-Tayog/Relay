// Relay — Omegle-style ephemeral 1-on-1 stranger chat.
// Rules: username required (no anonymous), random matching via Search,
// Skip finds the next stranger automatically, every pairing burns
// permanently on leave/disconnect (no rejoin). No persistence by design.
require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

// roomId -> Set<ws>. Internal only — IDs are never sent to clients,
// so a burned pairing is unrecoverable by design.
const rooms = new Map();
// FIFO queue of sockets waiting for a stranger.
const waiting = [];

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

// Username is mandatory everywhere — returns null when missing/blank.
function cleanUsername(value) {
  const name = String(value || '').trim().slice(0, 32);
  return name || null;
}

function isInQueue(ws) {
  return waiting.includes(ws);
}

function removeFromQueue(ws) {
  const i = waiting.indexOf(ws);
  if (i !== -1) waiting.splice(i, 1);
}

// Live lobby stats for the landing screen.
function broadcastStats() {
  const payload = JSON.stringify({
    type: 'stats',
    online: wss.clients.size,
    searching: waiting.length,
  });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

// Pair two waiters into a fresh ephemeral room.
function tryMatch() {
  while (waiting.length >= 2) {
    const a = waiting.shift();
    const b = waiting.shift();
    if (a.readyState !== 1 || b.readyState !== 1) {
      // Drop dead sockets, re-queue the live one if any.
      if (a.readyState === 1 && !a.roomId) waiting.unshift(a);
      if (b.readyState === 1 && !b.roomId) waiting.unshift(b);
      continue;
    }
    const roomId = crypto.randomBytes(8).toString('hex');
    rooms.set(roomId, new Set([a, b]));
    a.roomId = roomId;
    b.roomId = roomId;
    console.log(`[+] matched ${a.username} <> ${b.username} (${roomId})`);
    send(a, { type: 'matched', peer: b.username, count: 2 });
    send(b, { type: 'matched', peer: a.username, count: 2 });
  }
  broadcastStats();
}

// Burn a pairing forever: delete it, notify the survivor (if any).
// reason: 'skipped' (peer pressed Next) or 'left' (peer disconnected).
function burnRoom(roomId, survivor, reason) {
  if (!roomId) return;
  rooms.delete(roomId);
  if (survivor && survivor.readyState === 1) {
    send(survivor, { type: reason === 'skipped' ? 'peer-skipped' : 'peer-left' });
    survivor.roomId = null;
  }
  broadcastStats();
}

function serveIndex(res) {
  try {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch {
    res.writeHead(500);
    res.end('index.html missing\n');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') { res.writeHead(200); res.end('ok'); return; }
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    serveIndex(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Relay WS server. Connect via WebSocket.\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.roomId = null;
  ws.username = null;
  broadcastStats();

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;

    // --- Search for a random stranger ---------------------------------
    if (msg.type === 'search') {
      const username = cleanUsername(msg.username);
      if (!username) { send(ws, { type: 'username-required' }); return; }
      if (ws.roomId) { send(ws, { type: 'already-in-chat' }); return; }
      if (isInQueue(ws)) { send(ws, { type: 'searching' }); return; }
      ws.username = username;
      waiting.push(ws);
      console.log(`[?] ${username} searching (${waiting.length} waiting)`);
      send(ws, { type: 'searching' });
      tryMatch();
      return;
    }

    // --- Skip: burn current chat, auto-search for the next stranger ---
    if (msg.type === 'next') {
      const username = cleanUsername(msg.username || ws.username);
      if (!username) { send(ws, { type: 'username-required' }); return; }
      ws.username = username;
      if (ws.roomId) {
        const roomId = ws.roomId;
        const peers = rooms.get(roomId) || new Set();
        let survivor = null;
        for (const peer of peers) {
          if (peer !== ws) survivor = peer;
        }
        ws.roomId = null;
        console.log(`[>] ${username} skipped (${roomId})`);
        burnRoom(roomId, survivor, 'skipped');
      }
      removeFromQueue(ws); // de-dupe in case of double-clicks
      if (!isInQueue(ws)) waiting.push(ws);
      send(ws, { type: 'searching' });
      tryMatch();
      return;
    }

    // --- Leave current chat without searching again ------------------------
    if (msg.type === 'leave') {
      removeFromQueue(ws);
      if (ws.roomId) {
        const roomId = ws.roomId;
        const peers = rooms.get(roomId) || new Set();
        let survivor = null;
        for (const peer of peers) {
          if (peer !== ws) survivor = peer;
        }
        ws.roomId = null;
        console.log(`[-] ${ws.username || '?'} left (${roomId})`);
        burnRoom(roomId, survivor, 'left');
      }
      send(ws, { type: 'cancelled' });
      return;
    }

    // --- Cancel an ongoing search --------------------------------------
    if (msg.type === 'cancel') {
      removeFromQueue(ws);
      send(ws, { type: 'cancelled' });
      broadcastStats();
      return;
    }

    // --- Chat message (paired rooms only) -------------------------------
    if (msg.type === 'message') {
      if (!ws.roomId || !rooms.has(ws.roomId)) return;
      if (!ws.username) return; // must have a validated name
      const text = String(msg.text || '');
      if (!text.trim() || text.length > 2000) return;
      const out = JSON.stringify({
        type: 'chat',
        username: ws.username,
        text: text.slice(0, 2000),
        timestamp: new Date().toISOString(),
      });
      for (const peer of rooms.get(ws.roomId)) {
        if (peer.readyState === 1) peer.send(out);
      }
      return;
    }
  });

  ws.on('close', () => {
    removeFromQueue(ws);
    // ANY disconnect burns the pairing permanently — no rejoin.
    if (ws.roomId) {
      const roomId = ws.roomId;
      const peers = rooms.get(roomId) || new Set();
      let survivor = null;
      for (const peer of peers) {
        if (peer !== ws) survivor = peer;
      }
      ws.roomId = null;
      console.log(`[x] ${ws.username || '?'} disconnected, burned ${roomId}`);
      burnRoom(roomId, survivor, 'left');
    } else {
      broadcastStats();
    }
  });
  ws.on('error', (err) => console.error('[!] socket error:', err.message));
});

server.listen(PORT, () => console.log(`Relay stranger-chat listening on :${PORT}`));
