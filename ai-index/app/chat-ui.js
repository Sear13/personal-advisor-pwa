import { $, md, sanitize, toMarkdownLinks } from "./utils.js";

export class ChatUI {
  constructor(store, client, advisor) {
    this.store = store;
    this.client = client;
    this.advisor = advisor;

    // DOM
    this.input = $("#promptInput");
    this.sendBtn = $("#generateBtn");
    this.stopBtn = $("#stopBtn");
    this.reloadBtn = $("#reloadBtn");
    this.panel = $("#messages");
    this.scrollBtn = $("#scrollDownBtn");

    // Create reload button if not provided in HTML
    if (!this.reloadBtn) {
      const actions = this.sendBtn?.parentElement || document.querySelector(".actions");
      if (actions) {
        this.reloadBtn = document.createElement("button");
        this.reloadBtn.id = "reloadBtn";
        this.reloadBtn.className = "btn";
        this.reloadBtn.title = "Reload app";
        this.reloadBtn.setAttribute("aria-label", "Reload");
        this.reloadBtn.textContent = "↻";
        actions.insertBefore(this.reloadBtn, this.sendBtn || null);
      }
    }

    this.controller = null;
    this.suppressAutoScroll = true;
    this.hasUserSpoken = false;

    // Events
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.onSend();
      }
    });
    this.input.addEventListener("input", () => {
      this.autosize();
      this.updateButtons();
    });
    this.sendBtn.addEventListener("click", () => this.onSend());
    this.stopBtn.addEventListener("click", () => this.onStop());
    this.reloadBtn?.addEventListener("click", () => this.onReload());
    this.panel.addEventListener("scroll", () => this.updateScrollBtn());
    this.scrollBtn.addEventListener("click", () => this.scrollToBottom(true));
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.controller) this.onStop();
    });

    // First paint
    this.renderAll();
    this.panel.scrollTop = 0;
    this.suppressAutoScroll = false;

    // Sticky greeting — removed after first send
    this.advisor.say("Hello there! 👋 How can I assist you?", { sticky: true });

    this.autosize();
    this.updateButtons();
  }

  isAtBottom() {
    const threshold = 24;
    return this.panel.scrollTop + this.panel.clientHeight >= this.panel.scrollHeight - threshold;
  }

  renderAll() {
    const wasAtBottom = this.isAtBottom();
    this.panel.innerHTML = "";
    for (const { role, content, typing } of this.store.history) {
      this.renderMsg(role, content, typing);
    }
    if (wasAtBottom && !this.suppressAutoScroll) this.scrollToBottom(false);
    this.updateScrollBtn();
  }

  renderMsg(role, markdown, typing = false) {
    const item = document.createElement("div");
    item.className = `msg ${role}` + (typing ? " typing" : "");
    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (typing) {
      bubble.innerHTML = `<div class="loader"><span></span><span></span><span></span></div>`;
    } else {
      const withLinks = toMarkdownLinks(markdown || "");
      const html = sanitize(md(withLinks));
      bubble.innerHTML = html;

      bubble.querySelectorAll("a").forEach((a) => {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        try {
          const u = new URL(a.href, window.location.origin);
          const p = u.pathname.toLowerCase();
          if (p.endsWith(".pdf") || p.endsWith(".txt")) {
            const name =
              u.pathname.split("/").pop() || (p.endsWith(".pdf") ? "file.pdf" : "file.txt");
            a.setAttribute("download", name);
          }
        } catch {}
      });
    }

    item.appendChild(bubble);
    this.panel.appendChild(item);
  }

  autosize() {
    const el = this.input;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.33) + "px";
  }

  updateButtons() {
    const hasText = !!this.input.value.trim();
    this.sendBtn.disabled = !hasText || !!this.controller;
    this.stopBtn.disabled = !this.controller;
  }

  scrollToBottom(smooth) {
    this.panel.scrollTo({ top: this.panel.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  updateScrollBtn() {
    const threshold = 24;
    const atBottom =
      this.panel.scrollTop + this.panel.clientHeight >= this.panel.scrollHeight - threshold;
    this.scrollBtn.classList.toggle("show", !atBottom);
  }

  async onSend() {
    const prompt = this.input.value.trim();
    if (!prompt || this.controller) return;

    if (!this.hasUserSpoken) {
      this.hasUserSpoken = true;
      this.advisor.dismiss(); // disperse sticky greeting
    }

    this.store.push("user", prompt);
    this.input.value = "";
    this.autosize();

    const placeholderIndex = this.store.history.length;
    this.store.push("assistant", "", { typing: true });
    this.renderAll();
    this.updateButtons();

    this.controller = new AbortController();
    this.updateButtons(); // enable Stop immediately

    try {
      const content = await this.client.send({
        prompt,
        sessionId: this.store.sessionId,
        signal: this.controller.signal,
      });
      this.store.replace(placeholderIndex, "assistant", content, { typing: false });
    } catch (e) {
      const msg =
        e?.name === "AbortError"
          ? "_Request aborted._"
          : `**Error**\n\n${e?.message || "Something went wrong"}`;
      this.store.replace(placeholderIndex, "assistant", msg, { typing: false });
    } finally {
      this.controller = null;
      this.renderAll();
      this.updateButtons();
    }
  }

  onStop() {
    if (this.controller) this.controller.abort();
    this.controller = null;
    this.updateButtons();
  }

  onReload() {
    if (this.controller) this.onStop();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    }
    window.location.reload();
  }
}
