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

  document.querySelectorAll("[data-open-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.openTarget);
      if (!target) return;
      if (target.classList.contains("window")) {
        target.style.display = "";
        target.classList.remove("minimized", "closed");
        target.classList.add("focused", "flash");
        target.style.zIndex = String(++zIndex);
        setTimeout(() => target.classList.remove("flash"), 450);
      }
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      playSystemSound("info");
    });
  });

  document.querySelectorAll(".titlebar").forEach((titlebar) => {
    titlebar.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
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

function setupCommandLine() {
  const output = document.querySelector("[data-command-output]");
  if (!output) return;
  const commands = {
    backend: "[backend] Go services, APIs, ledgers, exchange workflows, observability",
    systems: "[systems] C/C++, concurrency, networking, ROS, embedded UI, low-latency delivery",
    contact: "[contact] AmirHossein_Dolati@outlook.com | LinkedIn ready",
  };

  document.querySelectorAll("[data-cmd-run]").forEach((button) => {
    button.addEventListener("click", () => {
      output.textContent = commands[button.dataset.cmdRun] || "[error] command not found";
      playSystemSound(button.dataset.cmdRun === "contact" ? "info" : "info");
    });
  });
}

function setupOpsConsole() {
  const ordersNode = document.querySelector("[data-orders]");
  const latencyNode = document.querySelector("[data-latency]");
  const ledgerNode = document.querySelector("[data-ledger]");
  const riskNode = document.querySelector("[data-risk]");
  const logNode = document.querySelector("[data-ops-log]");
  if (!ordersNode || !latencyNode || !ledgerNode || !riskNode || !logNode) return;

  let orders = 1284;
  let latency = 41;
  const messages = [
    "[match] order batch accepted",
    "[ledger] settlement queue drained",
    "[wallet] balance snapshot verified",
    "[risk] exposure limits checked",
    "[chain] tx indexer caught up",
    "[api] p95 latency inside budget",
  ];

  function appendLog(message) {
    const line = document.createElement("div");
    line.textContent = message;
    logNode.prepend(line);
    while (logNode.children.length > 6) {
      logNode.lastElementChild?.remove();
    }
  }

  function render() {
    ordersNode.textContent = String(orders);
    latencyNode.textContent = `${latency}ms`;
    ledgerNode.textContent = latency > 90 ? "LAG" : "OK";
    riskNode.textContent = latency > 110 ? "WATCH" : "LOW";
    ledgerNode.style.color = latency > 90 ? "#ff3f8e" : "#000080";
    riskNode.style.color = latency > 110 ? "#ff3f8e" : "#000080";
  }

  function tick() {
    orders += Math.floor(6 + Math.random() * 42);
    latency = Math.max(18, Math.floor(latency + (Math.random() * 28 - 11)));
    appendLog(messages[Math.floor(Math.random() * messages.length)]);
    render();
    playSystemSound(latency > 110 ? "error" : "info");
  }

  document.querySelector("[data-ops-tick]")?.addEventListener("click", tick);
  document.querySelector("[data-ops-check]")?.addEventListener("click", () => {
    latency = Math.max(22, latency - 18);
    appendLog("[check] reconciliation passed");
    render();
    showPopup("info");
  });

  render();
}

function setupLife() {
  const canvas = document.querySelector("#life-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cell = 10;
  const cols = Math.floor(canvas.width / cell);
  const rows = Math.floor(canvas.height / cell);
  let grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  let running = true;
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
  const toggleButton = document.querySelector("[data-life-toggle]");
  if (toggleButton) toggleButton.textContent = "Pause";
  timer = setInterval(step, 120);
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
setupCommandLine();
setupOpsConsole();
setupLife();
playStartup();
