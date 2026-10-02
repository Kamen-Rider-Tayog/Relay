// Chat page: re-forms the search.html pairing via reunion handoff,
// then chats / skips without ever navigating again.
// Direct visits without a username bounce to the front page.
import { connect, send, getName, takeHandoff } from './relay.js';
import { bubble, toast } from './ui.js';

const name = getName();
if (!name) {
  location.href = './index.html';
}
const handoff = takeHandoff(); // one-time { peer, reunion } from search.html

const peerLabel = document.getElementById('peerLabel');
const peerAvatar = document.getElementById('peerAvatar');
const peerPresence = document.getElementById('peerPresence');
const noticeHost = document.getElementById('noticeHost');
const chat = document.getElementById('chat');
const emptyState = document.getElementById('emptyState');
const endCard = document.getElementById('endCard');
const endTitle = document.getElementById('endTitle');
const endText = document.getElementById('endText');
const form = document.getElementById('form');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const statusText = document.getElementById('statusText');
const dot = document.getElementById('dot');

let ws = null;
let state = 'idle'; // idle | joining | chatting | searching
let lastFrom = null;
let lastAt = 0;

function setStatus(label, color) {
  statusText.textContent = label;
  dot.className = `w-2.5 h-2.5 rounded-full inline-block ${color}`;
}

function refreshUI() {
  sendBtn.disabled = state !== 'chatting';
}

function showChat(peer) {
  state = 'chatting';
  lastFrom = null;
  setStatus(`Chatting with ${peer}`, 'bg-green-500');
  peerLabel.textContent = peer;
  peerAvatar.textContent = (peer.trim()[0] || '?').toUpperCase();
  peerPresence.classList.remove('hidden');
  peerPresence.classList.add('flex');
  endCard.classList.add('hidden');
  endCard.classList.remove('grid');
  emptyState.style.display = 'grid';
  refreshUI();
  input.focus();
}

function showEndCard(title, text, actionLabel) {
  state = 'idle';
  peerPresence.classList.add('hidden');
  peerPresence.classList.remove('flex');
  endTitle.textContent = title;
  endText.textContent = text;
  document.getElementById('searchAgainBtn').textContent = actionLabel || 'Find someone new';
  endCard.classList.remove('hidden');
  endCard.classList.add('grid');
  refreshUI();
}

function addMessage({ username: from, text, timestamp }) {
  emptyState.style.display = 'none';
  const mine = from === name;
  const grouped = lastFrom === from && Date.now() - lastAt < 120000;
  lastFrom = from;
  lastAt = Date.now();
  chat.appendChild(bubble({ from, text, timestamp, mine, grouped }));
  chat.scrollTop = chat.scrollHeight;
}

function startSearch(reunion) {
  state = 'searching';
  setStatus('Searching…', 'bg-amber-500 animate-pulse');
  refreshUI();
  send(ws, reunion ? { type: 'search', username: name, reunion } : { type: 'search', username: name });
}

function handlers() {
  return {
    open() {
      if (handoff && !handlers.consumed) {
        // First connect carries the one-time handoff from search.html.
        handlers.consumed = true;
        state = 'joining';
        setStatus(`Rejoining ${handoff.peer}…`, 'bg-amber-500 animate-pulse');
        peerLabel.textContent = handoff.peer;
        peerAvatar.textContent = (handoff.peer.trim()[0] || '?').toUpperCase();
        send(ws, { type: 'search', username: name, reunion: handoff.reunion });
      } else if (state === 'searching') {
        // Reconnected mid-search (e.g. after Skip) — re-queue on the new socket.
        send(ws, { type: 'search', username: name });
      } else if (state === 'idle' && !endCard.classList.contains('hidden')) {
        // Reconnected while staring at the end card — wait for user action.
        setStatus('Idle', 'bg-slate-400');
      }
    },
    close() {
      if (state === 'chatting') {
        setStatus('Disconnected', 'bg-rose-500');
        showEndCard('Connection lost.', 'The chat burned with it. Find someone new below.', 'Find someone new');
      } else {
        setStatus('Reconnecting…', 'bg-amber-500 animate-pulse');
      }
      setTimeout(() => {
        ws = connect(handlers());
      }, 3000);
    },
    stats() {}, // chat page doesn't render lobby stats
    rejoining() {
      setStatus('Rejoining…', 'bg-amber-500 animate-pulse');
    },
    searching() {
      // Handoff partner never arrived (token expired) — now in normal queue.
      toast(noticeHost, "Partner didn't make it — searching for someone new.", false);
      setStatus('Searching…', 'bg-amber-500 animate-pulse');
    },
    matched(m) {
      chat.innerHTML = '';
      showChat(m.peer);
      toast(noticeHost, `You're chatting with ${m.peer}`, false);
    },
    'peer-skipped'() {
      setStatus('Skipped', 'bg-rose-500');
      showEndCard('Skipped!', 'They hopped to the next stranger. Your turn.', 'Find someone new');
    },
    'peer-left'() {
      setStatus('Ended', 'bg-rose-500');
      showEndCard('Chat burned.', 'They left — that pairing is gone forever.', 'Find someone new');
    },
    cancelled() {
      // Our own Pause landed: pairing burned, we stay put with Resume.
      setStatus('Paused', 'bg-slate-400');
      showEndCard('Paused.', 'Take your time — resume whenever you like.', 'Resume');
    },
    'username-required'() {
      location.href = './index.html';
    },
    chat(m) {
      addMessage(m);
    },
  };
}

if (!handoff) {
  // Direct visit with a name but no pairing: idle card, user starts search.
  setStatus('Idle', 'bg-slate-400');
  showEndCard('No active chat.', 'Press below to meet a stranger.', 'Find someone new');
}

ws = connect(handlers());

document.getElementById('skipBtn').onclick = () => {
  // Burn this pairing, auto-queue for the next stranger — no navigation.
  chat.innerHTML = '';
  emptyState.style.display = 'grid';
  state = 'searching';
  setStatus('Searching…', 'bg-amber-500 animate-pulse');
  refreshUI();
  send(ws, { type: 'next', username: name });
};

document.getElementById('pauseBtn').onclick = () => {
  // Burn this pairing like Leave did, but stay on the page: the server's
  // `cancelled` reply swaps the end card into its paused Resume variant.
  send(ws, { type: 'leave' });
  setStatus('Pausing…', 'bg-slate-400');
};

document.getElementById('searchAgainBtn').onclick = () => {
  endCard.classList.add('hidden');
  endCard.classList.remove('grid');
  chat.innerHTML = '';
  emptyState.style.display = 'grid';
  startSearch(null);
};

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN || state !== 'chatting') return;
  send(ws, { type: 'message', text });
  input.value = '';
  input.focus();
});

refreshUI();
