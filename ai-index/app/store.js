// Chat history + session id (localStorage)
export class Store {
  HISTORY_KEY = "chat_history_v1";
  SESSION_KEY = "chat_session_id_v1";

  constructor() {
    this.history = [];
    this.sessionId = this.loadSession();
  }

  loadSession() {
    let id = localStorage.getItem(this.SESSION_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(this.SESSION_KEY, id);
    }
    return id;
  }

  resetSession() {
    localStorage.removeItem(this.SESSION_KEY);
    this.sessionId = this.loadSession();
  }

  push(role, content, opts = {}) {
    this.history.push({
      role,
      content,
      typing: !!opts.typing,
      ts: opts.ts ?? Date.now(),
    });
    this.persist();
  }

  replace(index, role, content, opts = {}) {
    this.history[index] = {
      role,
      content,
      typing: !!opts.typing,
      ts: opts.ts ?? Date.now(),
    };
    this.persist();
  }

  clearHistory() {
    this.history = [];
    localStorage.removeItem(this.HISTORY_KEY);
  }

  persist() {
    try {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.history.slice(-200)));
    } catch {}
  }
}
