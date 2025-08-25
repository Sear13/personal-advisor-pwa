// SW registration + install prompt
export function initPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(console.warn);
    });
  }

  let installBtn = document.getElementById("installBtn");
  if (!installBtn) {
    installBtn = document.createElement("button");
    installBtn.id = "installBtn";
    installBtn.className = "btn";
    installBtn.textContent = "Install";
    Object.assign(installBtn.style, {
      position: "fixed",
      right: "12px",
      bottom: "12px",
      display: "none",
      zIndex: 9999,
    });
    document.body.appendChild(installBtn);
  }

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = "inline-block";
  });

  installBtn.addEventListener("click", async () => {
    installBtn.style.display = "none";
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch {}
    deferredPrompt = null;
  });

  window.addEventListener("appinstalled", () => {
    installBtn.style.display = "none";
  });
}
