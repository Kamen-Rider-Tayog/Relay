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
// Handoff tokens: token -> { arrived: [ws], timer }. Lets both strangers
// survive the search.html -> chat.html navigation (which drops sockets)
// and re-pair within REUNION_TTL. One-time use, unguessable, short-lived.
const reunions = new Map();
const REUNION_TTL = 12000;

function newToken() {
  return crypto.randomBytes(8).toString('hex');
}

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

// Pair two waiters into a fresh ephemeral room. Each side also gets a
// one-time reunion token so the search -> chat page navigation (which
// drops both sockets and burns this room) can re-form the same pairing.
function pair(a, b) {
  const roomId = crypto.randomBytes(8).toString('hex');
  rooms.set(roomId, new Set([a, b]));
  a.roomId = roomId;
  b.roomId = roomId;
  a.reunionWait = null;
  b.reunionWait = null;
  const reunion = newToken();
  reunions.set(reunion, {
    arrived: [],
    timer: setTimeout(() => expireReunion(reunion), REUNION_TTL),
  });
  console.log(`[+] matched ${a.username} <> ${b.username} (${roomId})`);
  send(a, { type: 'matched', peer: b.username, count: 2, reunion });
  send(b, { type: 'matched', peer: a.username, count: 2, reunion });
}

// A handoff token expired before both strangers re-arrived: park
// survivors back into the normal queue instead of stranding them.
function expireReunion(token) {
  const rec = reunions.get(token);
  if (!rec) return;
  reunions.delete(token);
  for (const ws of rec.arrived) {
    ws.reunionWait = null;
    if (ws.readyState !== 1 || ws.roomId || isInQueue(ws)) continue;
    waiting.push(ws);
    send(ws, { type: 'searching' });
  }
  console.log(`[~] reunion ${token} expired, survivors re-queued`);
  tryMatch();
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
    pair(a, b);
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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};
// Pages + shared assets served locally (Pages serves the same tree).
const PAGES = new Set(['/', '/index.html', '/search.html', '/chat.html']);

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') { res.writeHead(200); res.end('ok'); return; }
  if (req.method !== 'GET') { res.writeHead(405); res.end('method not allowed\n'); return; }
  let rel;
  if (url.pathname === '/') rel = 'index.html';
  else if (PAGES.has(url.pathname)) rel = url.pathname.slice(1);
  else if (url.pathname.startsWith('/assets/')) rel = url.pathname.slice(1);
  else { res.writeHead(404); res.end('not found\n'); return; }
  const abs = path.normalize(path.join(__dirname, rel));
  if (!abs.startsWith(__dirname + path.sep)) { res.writeHead(403); res.end('forbidden\n'); return; }
  const ext = path.extname(abs).toLowerCase();
  if (!MIME[ext]) { res.writeHead(403); res.end('forbidden\n'); return; }
  fs.readFile(abs, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found\n'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext], 'Cache-Control': 'public, max-age=300' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }
  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Relay WS server. Connect via WebSocket.\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.roomId = null;
  ws.username = null;
  ws.reunionWait = null;
  broadcastStats();

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;

    // --- Search for a random stranger ---------------------------------
    // Optional `reunion` token: re-pairs both strangers after the
    // search -> chat page navigation dropped their sockets. Falls back
    // to the normal queue when the token is unknown or expired.
    if (msg.type === 'search') {
      const username = cleanUsername(msg.username);
      if (!username) { send(ws, { type: 'username-required' }); return; }
      if (ws.roomId) { send(ws, { type: 'already-in-chat' }); return; }
      ws.username = username;
      const token = typeof msg.reunion === 'string' ? msg.reunion : null;
      const rec = token ? reunions.get(token) : null;
      if (rec) {
        if (rec.arrived.includes(ws)) { send(ws, { type: 'rejoining' }); return; }
        removeFromQueue(ws);
        rec.arrived.push(ws);
        ws.reunionWait = token;
        if (rec.arrived.length >= 2) {
          clearTimeout(rec.timer);
          reunions.delete(token);
          const [a, b] = rec.arrived;
          a.reunionWait = null;
          b.reunionWait = null;
          if (a.readyState === 1 && b.readyState === 1 && !a.roomId && !b.roomId) {
            console.log(`[~] reunion ${token} re-paired ${a.username} <> ${b.username}`);
            pair(a, b);
          } else {
            for (const s of [a, b]) {
              if (s.readyState === 1 && !s.roomId && !isInQueue(s)) {
                waiting.push(s);
                send(s, { type: 'searching' });
              }
            }
            tryMatch();
          }
        } else {
          console.log(`[~] ${username} rejoining (1/2)`);
          send(ws, { type: 'rejoining' });
        }
        return;
      }
      if (isInQueue(ws)) { send(ws, { type: 'searching' }); return; }
      ws.reunionWait = null; // abandon any stale handoff wait
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
      ws.reunionWait = null;
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
      ws.reunionWait = null;
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
    // Handoff records outlive navigation disconnects on purpose: the
    // REUNION_TTL timer moves stranded partners back to the queue.
    ws.reunionWait = null;
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
