// Relay shared client core (ES module): backend URL, session store, socket factory.
// No DOM here — pages own their views; see ui.js for render helpers.

const params = new URLSearchParams(location.search);
// TODO: after renaming the Render service, change this to wss://relay.onrender.com
// ?server= override always wins (useful for local dev + migration).
const DEFAULT_BACKEND = 'wss://sundaysolution.onrender.com';

export const WS_URL =
  params.get('server') ||
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? `ws://${location.hostname}:8080`
    : DEFAULT_BACKEND);

const NAME_KEY = 'relay-display-name';

export function getName() {
  return ((localStorage.getItem(NAME_KEY) || '').trim()).slice(0, 32);
}

export function saveName(name) {
  localStorage.setItem(NAME_KEY, (name || '').trim().slice(0, 32));
}

// One-time handoff payload written by search.html, consumed by chat.html.
export function saveHandoff({ peer, reunion }) {
  sessionStorage.setItem('relay-handoff', JSON.stringify({ peer, reunion }));
}

export function takeHandoff() {
  try {
    const raw = sessionStorage.getItem('relay-handoff');
    sessionStorage.removeItem('relay-handoff');
    if (!raw) return null;
    const { peer, reunion } = JSON.parse(raw);
    if (!peer || !reunion) return null;
    return { peer, reunion };
  } catch {
    return null;
  }
}

// Open a socket and fan messages out to per-type handlers.
// handlers: { open?, close?, error?, [type]: (msg) => void }
export function connect(handlers) {
  const ws = new WebSocket(WS_URL);
  ws.onopen = () => handlers.open && handlers.open();
  ws.onmessage = (e) => {
    let m;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    if (m && typeof m.type === 'string' && handlers[m.type]) handlers[m.type](m);
  };
  ws.onclose = () => handlers.close && handlers.close();
  ws.onerror = () => {
    try {
      ws.close();
    } catch {}
    handlers.error && handlers.error();
  };
  return ws;
}

export function send(ws, obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}
