// Landing page: required display name, live lobby stats, hand off to search.html.
// This socket only listens for stats — it never searches, so leaving it
// behind on navigation costs nothing.
import { connect, getName, saveName } from './relay.js';

const nameEl = document.getElementById('name');
const nameError = document.getElementById('nameError');
const searchBtn = document.getElementById('searchBtn');
const statsEl = document.getElementById('stats');
const statusText = document.getElementById('statusText');
const dot = document.getElementById('dot');

let connected = false;

nameEl.value = getName();
if (sessionStorage.getItem('relay-need-name')) {
  sessionStorage.removeItem('relay-need-name');
  nameError.classList.remove('hidden');
  nameEl.focus();
}

function username() {
  return (nameEl.value.trim() || '').slice(0, 32);
}

function refreshUI() {
  const hasName = username().length > 0;
  nameError.classList.toggle('hidden', hasName);
  nameEl.setAttribute('aria-invalid', hasName ? 'false' : 'true');
  searchBtn.disabled = !(connected && hasName);
}

function setStatus(label, color) {
  statusText.textContent = label;
  dot.className = `w-2.5 h-2.5 rounded-full inline-block ${color}`;
}

setStatus('Connecting…', 'bg-amber-500 animate-pulse');

connect({
  open() {
    connected = true;
    setStatus('Idle', 'bg-slate-400');
    refreshUI();
  },
  close() {
    connected = false;
    setStatus('Reconnecting…', 'bg-amber-500 animate-pulse');
    refreshUI();
    setTimeout(() => location.reload(), 3000);
  },
  stats(m) {
    statsEl.textContent = `${m.online} online · ${m.searching} searching`;
  },
});

nameEl.addEventListener('input', () => {
  saveName(nameEl.value);
  refreshUI();
});

function go() {
  if (!username()) {
    nameError.classList.remove('hidden');
    nameEl.focus();
    return;
  }
  saveName(nameEl.value);
  location.href = './search.html';
}

searchBtn.onclick = go;
nameEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') go();
});

refreshUI();
