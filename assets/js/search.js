// Searching page: auto-searches on connect, hands matched pairs to chat.html.
// A socket drop here never burns anything — no pairing exists yet.
import { connect, send, getName, saveHandoff } from './relay.js';

const name = getName();
if (!name) {
  sessionStorage.setItem('relay-need-name', '1');
  location.href = './index.html';
}

const statusText = document.getElementById('statusText');
const dot = document.getElementById('dot');
const searchTimer = document.getElementById('searchTimer');
const searchTip = document.getElementById('searchTip');

const TIPS = [
  'Tip: chats burn when anyone leaves — make the first hello count.',
  'Tip: Skip is instant and the other person never sees your name after.',
  'Tip: a display name people can pronounce gets more replies.',
];

let ws = null;
let secs = 0;
const timerInt = setInterval(() => {
  secs += 1;
  searchTimer.textContent = `${secs}s`;
  if (secs % 6 === 0) searchTip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
}, 1000);

function handlers() {
  return {
    open() {
      send(ws, { type: 'search', username: name });
    },
    close() {
      // Still searching — reconnect and re-queue (nothing to burn yet).
      statusText.textContent = 'Reconnecting…';
      setTimeout(() => {
        ws = connect(handlers());
      }, 2000);
    },
    searching() {
      statusText.textContent = 'Searching…';
      dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse inline-block';
    },
    matched(m) {
      clearInterval(timerInt);
      saveHandoff({ peer: m.peer, reunion: m.reunion });
      location.href = './chat.html';
    },
    'username-required'() {
      sessionStorage.setItem('relay-need-name', '1');
      location.href = './index.html';
    },
  };
}

ws = connect(handlers());

// No Cancel button: the ← Home pill navigates away, which drops this
// socket — the server removes it from the queue, so nothing lingers.
