// Minimal production-ready WebSocket chat relay.
// Deploy: Render / Fly.io (free tier). `npm install && npm start`.

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

// Plain HTTP server: handles Render health checks + upgrades to WS on same port.
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Chat WS server. Connect via WebSocket.\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log(`[+] client connected (${wss.clients.size} total)`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; } // ignore non-JSON
    if (!msg.text || typeof msg.text !== 'string') return;

    // Normalize payload so every client gets the same shape.
    const out = JSON.stringify({
      username: String(msg.username || 'Anonymous').slice(0, 32),
      text: String(msg.text).slice(0, 2000),
      timestamp: msg.timestamp || new Date().toISOString(),
    });

    // Broadcast to ALL clients including sender (simplifies client render logic).
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(out);
    }
  });

  ws.on('close', () => console.log(`[-] client disconnected (${wss.clients.size} total)`));
  ws.on('error', (err) => console.error('[!] socket error:', err.message));
});

server.listen(PORT, () => console.log(`WS chat listening on :${PORT}`));
