import { $ } from "./utils.js";

// Floating “advisor” overlay with sticky greeting
export class Advisor {
  constructor() {
    this.el = document.createElement("div");
    this.el.className = "advisor-overlay idle";
    this.el.innerHTML = `
      <div class="advisor-cloud">
        <img class="advisor-img" src="assets/favicon.png" alt="Advisor avatar" />
      </div>
      <div class="advisor-speech" aria-live="polite" aria-atomic="true"></div>
    `;
    document.body.appendChild(this.el);

    this.speech = this.el.querySelector(".advisor-speech");
    this.dismissed = false;
    this.sticky = false;

    const messages = $("#messages");
    const positionOverlay = () => {
      try {
        const rect = messages.getBoundingClientRect();
        const leftInset = Math.max(12, rect.left + 12);
        this.el.style.left = `${leftInset}px`;
        this.el.style.top = `${Math.max(12, rect.top + 12)}px`;
      } catch {}
    };
    positionOverlay();
    window.addEventListener("resize", positionOverlay);
    new ResizeObserver(positionOverlay).observe(document.body);

    const updateVisibility = () => {
      if (this.dismissed) return;
      const atTop = messages.scrollTop <= 16;
      this.el.classList.toggle("hidden", !atTop);
    };
    messages.addEventListener("scroll", updateVisibility);
    updateVisibility();
  }

  showIdle() {
    if (this.dismissed || this.sticky) return;
    this.el.classList.remove("talking");
    this.el.classList.add("idle");
  }

  say(text, { sticky = false } = {}) {
    if (this.dismissed) return;
    this.sticky = !!sticky;
    this.speech.textContent = text;
    this.el.classList.remove("idle");
    this.el.classList.add("talking");
    clearTimeout(this._t);
    if (!this.sticky) this._t = setTimeout(() => this.showIdle(), 5000);
  }

  dismiss() {
    this.sticky = false;
    this.dismissed = true;
    this.el.classList.add("hidden");
    this.el.style.display = "none";
    clearTimeout(this._t);
  }

  clear() {
    if (this.dismissed) return;
    this.sticky = false;
    this.speech.textContent = "";
    this.showIdle();
  }
}
