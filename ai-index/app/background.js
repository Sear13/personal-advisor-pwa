// Rotating background images
export function initBackgroundRotator({
  images = [
    "assets/background/ai-bg1.png",
    "assets/background/ai-bg2.png",
    "assets/background/ai-bg3.png",
  ],
  fadeMs = 1000,
  intervalMs = 10000,
  elId = "bg-rotator",
} = {}) {
  const rotator = document.getElementById(elId);
  if (!rotator || !images?.length) return;

  images.forEach((src) => {
    const img = new Image();
    img.src = src;
  });

  let i = Math.floor(Math.random() * images.length);
  const setBg = (idx) => (rotator.style.backgroundImage = `url(${images[idx]})`);

  setBg(i);
  rotator.style.opacity = 1;

  setInterval(() => {
    i = (i + 1) % images.length;
    rotator.style.opacity = 0;
    setTimeout(() => {
      setBg(i);
      rotator.style.opacity = 1;
    }, fadeMs);
  }, intervalMs);
}
