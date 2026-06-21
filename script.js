const clock = document.querySelector("[data-clock]");
const startupAudio = document.querySelector("#startup-audio");
const bootScreen = document.querySelector("[data-boot-screen]");
const enableAudioButton = document.querySelector("[data-enable-audio]");
const popupLayer = document.querySelector("[data-popup-layer]");

let audioContext;
let zIndex = 40;

function updateClock() {
  if (!clock) return;
  clock.textContent = new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function tone(frequency, start, duration, type = "square", volume = 0.05) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + start);
  gain.gain.setValueAtTime(volume, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(ctx.currentTime + start);
  oscillator.stop(ctx.currentTime + start + duration);
}

function playSystemSound(kind) {
  try {
    if (kind === "error") {
      tone(180, 0, 0.12, "sawtooth", 0.06);
      tone(120, 0.13, 0.18, "square", 0.05);
      return;
    }
    tone(660, 0, 0.08, "square", 0.05);
    tone(880, 0.09, 0.12, "square", 0.04);
  } catch {
    // Audio can be unavailable in some embedded browsers.
  }
}

function hideBootScreen() {
  if (!bootScreen) return;
  bootScreen.classList.add("hidden");
}

async function playStartup() {
  if (!startupAudio) {
    hideBootScreen();
    return;
  }
  try {
    startupAudio.currentTime = 0;
    await startupAudio.play();
    setTimeout(hideBootScreen, 900);
  } catch {
    if (enableAudioButton) enableAudioButton.hidden = false;
  }
}

function showPopup(kind = "info") {
  if (!popupLayer) return;
  const isError = kind === "error";
  const popup = document.createElement("div");
  popup.className = `popup window ${isError ? "error" : "info"}`;
  popup.style.zIndex = String(++zIndex);
  popup.innerHTML = `
    <div class="titlebar">
      <span>${isError ? "system_error.wav" : "system_info.wav"}</span>
      <div class="window-actions">
        <button type="button" aria-label="Close popup" data-popup-close></button>
      </div>
    </div>
    <div class="popup-body">
      <div class="popup-symbol">${isError ? "!" : "i"}</div>
      <div>
        <p>${isError ? "Legacy code detected. AmirHossein has entered debugging mode." : "Resume loaded. Backend services, exchange workflows, and pixel tools are online."}</p>
        <button class="button tiny primary" type="button" data-popup-close>OK</button>
      </div>
    </div>
  `;
  popupLayer.appendChild(popup);
  playSystemSound(kind);
  popup.querySelectorAll("[data-popup-close]").forEach((button) => {
    button.addEventListener("click", () => popup.remove());
  });
  setTimeout(() => {
    if (popup.isConnected) popup.remove();
  }, 6500);
}

function setupWindows() {
  document.querySelectorAll(".window").forEach((windowNode) => {
    windowNode.classList.add("draggable");
    windowNode.addEventListener("pointerdown", () => {
      document.querySelectorAll(".window").forEach((node) => node.classList.remove("focused"));
      windowNode.classList.add("focused");
      windowNode.style.zIndex = String(++zIndex);
    });
  });

  document.querySelectorAll("[data-window-effect]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const win = button.closest(".window");
      if (!win) return;
      const effect = button.dataset.windowEffect;
      playSystemSound(effect === "close" ? "error" : "info");
      if (effect === "min") {
        win.classList.toggle("minimized");
      }
      if (effect === "max") {
        win.classList.remove("flash");
        void win.offsetWidth;
        win.classList.add("flash");
      }
      if (effect === "close") {
        win.classList.add("closed");
        setTimeout(() => {
          win.classList.remove("closed");
          win.style.display = "none";
        }, 250);
      }
    });
  });

  document.querySelectorAll(".titlebar").forEach((titlebar) => {
    titlebar.addEventListener("pointerdown", (event) => {
      const win = titlebar.closest(".window");
      if (!win || win.classList.contains("popup")) return;
      const rect = win.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const currentX = Number(win.dataset.x || 0);
      const currentY = Number(win.dataset.y || 0);
      titlebar.setPointerCapture(event.pointerId);

      function move(moveEvent) {
        const nextX = currentX + moveEvent.clientX - startX;
        const nextY = currentY + moveEvent.clientY - startY;
        const maxX = window.innerWidth - rect.width - 8;
        const maxY = window.innerHeight - 88;
        const x = Math.max(-rect.left + 8, Math.min(nextX, maxX));
        const y = Math.max(-rect.top + 8, Math.min(nextY, maxY));
        win.dataset.x = String(x);
        win.dataset.y = String(y);
        win.style.transform = `translate(${x}px, ${y}px)`;
      }

      function stop() {
        titlebar.removeEventListener("pointermove", move);
        titlebar.removeEventListener("pointerup", stop);
        titlebar.removeEventListener("pointercancel", stop);
      }

      titlebar.addEventListener("pointermove", move);
      titlebar.addEventListener("pointerup", stop);
      titlebar.addEventListener("pointercancel", stop);
    });
  });
}

function setupPaint() {
  const canvas = document.querySelector("#paint-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let color = "#101010";
  let drawing = false;

  function clear() {
    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#c0c0c0";
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.fillRect(x, 0, 1, canvas.height);
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.fillRect(0, y, canvas.width, 1);
    }
  }

  function draw(event) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * canvas.width / 8) * 8;
    const y = Math.floor((event.clientY - rect.top) / rect.height * canvas.height / 8) * 8;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 8, 8);
  }

  clear();
  canvas.addEventListener("pointerdown", (event) => {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    draw(event);
    playSystemSound("info");
  });
  canvas.addEventListener("pointermove", (event) => {
    if (drawing) draw(event);
  });
  canvas.addEventListener("pointerup", () => {
    drawing = false;
  });
  canvas.addEventListener("pointercancel", () => {
    drawing = false;
  });

  document.querySelectorAll("[data-color]").forEach((button) => {
    button.addEventListener("click", () => {
      color = button.dataset.color;
      document.querySelectorAll("[data-color]").forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      playSystemSound("info");
    });
  });

  document.querySelector("[data-paint-clear]")?.addEventListener("click", () => {
    clear();
    playSystemSound("error");
  });
}

function setupLife() {
  const canvas = document.querySelector("#life-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cell = 10;
  const cols = Math.floor(canvas.width / cell);
  const rows = Math.floor(canvas.height / cell);
  let grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  let running = false;
  let timer;

  function randomize() {
    grid = grid.map((row) => row.map(() => Math.random() > 0.72 ? 1 : 0));
  }

  function draw() {
    ctx.fillStyle = "#080808";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1f2937";
    for (let x = 0; x <= cols; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * cell, 0);
      ctx.lineTo(x * cell, rows * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell);
      ctx.lineTo(cols * cell, y * cell);
      ctx.stroke();
    }
    ctx.fillStyle = "#33d17a";
    grid.forEach((row, y) => {
      row.forEach((alive, x) => {
        if (alive) ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      });
    });
  }

  function count(x, y) {
    let total = 0;
    for (let yy = -1; yy <= 1; yy += 1) {
      for (let xx = -1; xx <= 1; xx += 1) {
        if (xx === 0 && yy === 0) continue;
        const nx = (x + xx + cols) % cols;
        const ny = (y + yy + rows) % rows;
        total += grid[ny][nx];
      }
    }
    return total;
  }

  function step() {
    grid = grid.map((row, y) => row.map((alive, x) => {
      const neighbors = count(x, y);
      return neighbors === 3 || (alive && neighbors === 2) ? 1 : 0;
    }));
    draw();
  }

  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * cols);
    const y = Math.floor((event.clientY - rect.top) / rect.height * rows);
    grid[y][x] = grid[y][x] ? 0 : 1;
    draw();
    playSystemSound("info");
  });

  document.querySelector("[data-life-toggle]")?.addEventListener("click", (event) => {
    running = !running;
    event.currentTarget.textContent = running ? "Pause" : "Run";
    playSystemSound("info");
    if (running) timer = setInterval(step, 120);
    else clearInterval(timer);
  });
  document.querySelector("[data-life-step]")?.addEventListener("click", () => {
    step();
    playSystemSound("info");
  });
  document.querySelector("[data-life-random]")?.addEventListener("click", () => {
    randomize();
    draw();
    playSystemSound("info");
  });
  document.querySelector("[data-life-clear]")?.addEventListener("click", () => {
    grid = grid.map((row) => row.map(() => 0));
    draw();
    playSystemSound("error");
  });

  randomize();
  draw();
}

function setupGame() {
  const canvas = document.querySelector("#game-canvas");
  const scoreNode = document.querySelector("[data-score]");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const keys = new Set();
  const player = { x: canvas.width / 2 - 16, y: canvas.height - 28, width: 32, height: 16 };
  const drops = [];
  let score = 0;
  let frame = 0;

  function spawn() {
    drops.push({
      x: Math.floor(Math.random() * (canvas.width - 14)),
      y: -14,
      size: 14,
      speed: 1.2 + Math.random() * 2.2,
      good: Math.random() > 0.35,
    });
  }

  function hit(a, b) {
    return a.x < b.x + b.size && a.x + a.width > b.x && a.y < b.y + b.size && a.y + a.height > b.y;
  }

  function loop() {
    frame += 1;
    if (frame % 34 === 0) spawn();
    if (keys.has("ArrowLeft") || keys.has("a")) player.x -= 4;
    if (keys.has("ArrowRight") || keys.has("d")) player.x += 4;
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));

    ctx.fillStyle = "#080808";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1f2937";
    for (let x = 0; x < canvas.width; x += 20) ctx.fillRect(x, 0, 1, canvas.height);
    for (let y = 0; y < canvas.height; y += 20) ctx.fillRect(0, y, canvas.width, 1);

    ctx.fillStyle = "#ffd447";
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(player.x + 6, player.y + 4, 4, 4);
    ctx.fillRect(player.x + 22, player.y + 4, 4, 4);

    for (let i = drops.length - 1; i >= 0; i -= 1) {
      const drop = drops[i];
      drop.y += drop.speed;
      ctx.fillStyle = drop.good ? "#33d17a" : "#ff3f8e";
      ctx.fillRect(drop.x, drop.y, drop.size, drop.size);
      if (hit(player, drop)) {
        score += drop.good ? 1 : -2;
        if (scoreNode) scoreNode.textContent = String(score);
        playSystemSound(drop.good ? "info" : "error");
        drops.splice(i, 1);
      } else if (drop.y > canvas.height) {
        drops.splice(i, 1);
      }
    }

    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (event) => keys.add(event.key));
  window.addEventListener("keyup", (event) => keys.delete(event.key));
  loop();
}

updateClock();
setInterval(updateClock, 30000);

enableAudioButton?.addEventListener("click", async () => {
  if (audioContext?.state === "suspended") await audioContext.resume();
  await playStartup();
  hideBootScreen();
});

document.addEventListener("pointerdown", () => {
  if (audioContext?.state === "suspended") audioContext.resume();
}, { once: true });

document.querySelectorAll("[data-popup]").forEach((button) => {
  button.addEventListener("click", () => showPopup(button.dataset.popup));
});

setupWindows();
setupPaint();
setupLife();
setupGame();
playStartup();
