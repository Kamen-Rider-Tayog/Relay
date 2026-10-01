// Relay — ephemeral one-on-one chat relay.
// Rules: unique one-time link, max 2 people per link, link burns permanently
// on first disconnect (no rejoin/reuse). No persistence by design.
require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

// roomId -> Set<ws>. Ephemeral: lives only in memory.
const rooms = new Map();
// Permanently burned links — never reusable, even after room is deleted.
const burned = new Set();

function newRoomId() {
  return crypto.randomBytes(8).toString('hex');
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

// Burn a room forever: notify the surviving peer, then drop all state.
function burnRoom(roomId, reason) {
  if (!roomId || burned.has(roomId)) return;
  burned.add(roomId);
  const peers = rooms.get(roomId);
  rooms.delete(roomId);
  if (peers) {
    for (const peer of peers) {
      send(peer, { type: 'peer-left', reason });
      // Give the client a beat to render the notice, then drop the socket.
      setTimeout(() => { try { peer.close(4000, 'burned'); } catch {} }, 300);
      peer.roomId = null;
    }
  }
  console.log(`[x] burned ${roomId} (${reason}), ${burned.size} burned total`);
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

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'create') {
      if (ws.roomId) return; // already in a room
      const roomId = newRoomId();
      const username = String(msg.username || 'Anonymous').slice(0, 32) || 'Anonymous';
      rooms.set(roomId, new Set([ws]));
      ws.roomId = roomId;
      ws.username = username;
      console.log(`[+] room ${roomId} created by ${username}`);
      send(ws, { type: 'created', roomId, count: 1 });
      return;
    }

    if (msg.type === 'join') {
      if (ws.roomId) return;
      const roomId = String(msg.roomId || '').trim();
      const username = String(msg.username || 'Anonymous').slice(0, 32) || 'Anonymous';
      if (!roomId || burned.has(roomId) || !rooms.has(roomId)) {
        send(ws, { type: 'link-disabled' });
        setTimeout(() => { try { ws.close(4001, 'disabled'); } catch {} }, 300);
        return;
      }
      const peers = rooms.get(roomId);
      if (peers.size >= 2) {
        send(ws, { type: 'room-full' });
        setTimeout(() => { try { ws.close(4002, 'full'); } catch {} }, 300);
        return;
      }
      peers.add(ws);
      ws.roomId = roomId;
      ws.username = username;
      console.log(`[+] ${username} joined ${roomId} (${peers.size}/2)`);
      send(ws, { type: 'joined', roomId, count: peers.size });
      for (const peer of peers) {
        if (peer !== ws) send(peer, { type: 'peer-joined', count: peers.size });
      }
      return;
    }

    if (msg.type === 'message') {
      if (!ws.roomId || !rooms.has(ws.roomId)) return;
      const text = String(msg.text || '');
      if (!text.trim() || text.length > 2000) return;
      const out = JSON.stringify({
        type: 'chat',
        username: ws.username || 'Anonymous',
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
    // ANY disconnect burns the one-time link permanently — no rejoin.
    if (ws.roomId) burnRoom(ws.roomId, 'peer disconnected');
  });
  ws.on('error', (err) => console.error('[!] socket error:', err.message));
});

server.listen(PORT, () => console.log(`Relay listening on :${PORT}`));
