// Relay shared render helpers (ES module). All stranger content goes
// through textContent — never innerHTML.

export function relTime(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return new Date(iso).toLocaleTimeString();
}

// Build one chat bubble. `grouped` hides the name/timestamp meta for
// rapid follow-ups from the same sender.
export function bubble({ from, text, timestamp, mine, grouped }) {
  const div = document.createElement('div');
  div.className = `msg-in max-w-[78%] px-4 py-2.5 leading-snug break-words ${
    mine
      ? 'self-end bg-orange-500 text-white rounded-3xl rounded-br-lg shadow-sm'
      : 'self-start bg-white text-slate-800 border-2 border-orange-100 rounded-3xl rounded-bl-lg shadow-sm'
  }`;
  if (!grouped) {
    const meta = document.createElement('div');
    meta.className = `text-[0.7rem] font-extrabold mb-0.5 ${mine ? 'text-orange-100' : 'text-orange-500'}`;
    meta.textContent = `${from} · ${relTime(timestamp)}`;
    meta.title = new Date(timestamp).toLocaleString();
    div.appendChild(meta);
  }
  const body = document.createElement('div');
  body.className = 'font-semibold';
  body.textContent = text;
  div.appendChild(body);
  return div;
}

let toastTimer = null;

// Floating pill toast anchored to a relatively-positioned parent.
export function toast(parent, text, bad) {
  let el = parent.querySelector('[data-toast]');
  if (!el) {
    el = document.createElement('div');
    el.setAttribute('data-toast', '');
    el.setAttribute('role', 'alert');
    parent.appendChild(el);
  }
  el.textContent = text;
  el.className = `toast-in absolute top-2 left-1/2 -translate-x-1/2 z-20 max-w-[90%] px-4 py-2 text-[13px] font-bold text-center rounded-full shadow-lg whitespace-nowrap overflow-hidden text-ellipsis ${
    bad ? 'bg-rose-500 text-white' : 'bg-amber-300 text-amber-950'
  }`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 5000);
}
