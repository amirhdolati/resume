const APP_TITLES = {
  resume: "Resume.exe",
  experience: "Experience.exe",
  stack: "Stack.sys",
  projects: "Projects.lnk",
  cmd: "Cmd.exe",
  exchange: "Exchange.exe",
  life: "Life.exe",
  education: "Education.txt",
  contact: "Contact.cmd",
  taskmgr: "Taskmgr.exe",
  trash: "Trash",
};

const clock = document.querySelector("[data-clock]");
const startupAudio = document.querySelector("#startup-audio");
const bootScreen = document.querySelector("[data-boot-screen]");
const enableAudioButton = document.querySelector("[data-enable-audio]");
const popupLayer = document.querySelector("[data-popup-layer]");
const startButton = document.querySelector("[data-start-button]");
const startMenu = document.querySelector("[data-start-menu]");
const taskbarApps = document.querySelector("[data-taskbar-apps]");
const taskList = document.querySelector("[data-task-list]");

let audioContext;
let zIndex = 40;
let focusedApp = "resume";

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
    // Audio may be unavailable until the browser receives a user gesture.
  }
}

function hideBootScreen() {
  bootScreen?.classList.add("hidden");
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

function getWindow(appId) {
  return document.querySelector(`[data-app="${appId}"]`);
}

function appWindows() {
  return Array.from(document.querySelectorAll("[data-app]"));
}

function focusApp(appId) {
  const win = getWindow(appId);
  if (!win) return;
  appWindows().forEach((node) => node.classList.remove("focused"));
  win.classList.add("focused");
  win.style.zIndex = String(++zIndex);
  focusedApp = appId;
  renderShell();
}

function openApp(appId) {
  const win = getWindow(appId);
  if (!win) return;
  win.classList.add("is-open");
  win.classList.remove("is-minimized", "flash");
  focusApp(appId);
  win.classList.add("flash");
  setTimeout(() => win.classList.remove("flash"), 450);
  startMenu?.classList.remove("open");
  startButton?.classList.remove("active");
  playSystemSound("info");
}

function minimizeApp(appId) {
  const win = getWindow(appId);
  if (!win) return;
  win.classList.add("is-minimized");
  renderShell();
}

function closeApp(appId) {
  const win = getWindow(appId);
  if (!win) return;
  win.classList.remove("is-open", "is-minimized", "is-maximized", "focused");
  playSystemSound(appId === "trash" ? "error" : "info");
  renderShell();
}

function toggleMaximize(appId) {
  const win = getWindow(appId);
  if (!win) return;
  win.classList.toggle("is-maximized");
  focusApp(appId);
  playSystemSound("info");
}

function runningApps() {
  return appWindows()
    .filter((win) => win.classList.contains("is-open"))
    .map((win) => ({
      id: win.dataset.app,
      title: APP_TITLES[win.dataset.app] || win.dataset.app,
      minimized: win.classList.contains("is-minimized"),
      focused: win.dataset.app === focusedApp && !win.classList.contains("is-minimized"),
    }));
}

function renderTaskbar() {
  if (!taskbarApps) return;
  taskbarApps.innerHTML = "";
  runningApps().forEach((app) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `task-button ${app.focused ? "active" : ""}`;
    button.textContent = app.title;
    button.addEventListener("click", () => {
      const win = getWindow(app.id);
      if (!win) return;
      if (app.focused) {
        minimizeApp(app.id);
      } else {
        openApp(app.id);
      }
    });
    taskbarApps.appendChild(button);
  });
}

function renderTaskManager() {
  if (!taskList) return;
  taskList.innerHTML = "";
  Object.entries(APP_TITLES).forEach(([id, title]) => {
    const win = getWindow(id);
    const isRunning = win?.classList.contains("is-open");
    const row = document.createElement("div");
    row.className = "task-row";
    row.innerHTML = `
      <span>${title}</span>
      <span>${isRunning ? (win.classList.contains("is-minimized") ? "Minimized" : "Running") : "Closed"}</span>
      <span class="task-actions"></span>
    `;
    const actions = row.querySelector(".task-actions");
    if (isRunning) {
      const switchButton = document.createElement("button");
      switchButton.className = "button tiny";
      switchButton.type = "button";
      switchButton.textContent = "Switch";
      switchButton.addEventListener("click", () => openApp(id));
      const endButton = document.createElement("button");
      endButton.className = "button tiny";
      endButton.type = "button";
      endButton.textContent = "End";
      endButton.addEventListener("click", () => closeApp(id));
      actions.append(switchButton, endButton);
    } else {
      const runButton = document.createElement("button");
      runButton.className = "button tiny";
      runButton.type = "button";
      runButton.textContent = "Run";
      runButton.addEventListener("click", () => openApp(id));
      actions.append(runButton);
    }
    row.addEventListener("dblclick", () => openApp(id));
    taskList.appendChild(row);
  });
}

function renderShell() {
  renderTaskbar();
  renderTaskManager();
}

function showPopup(kind = "info", message) {
  if (!popupLayer) return;
  const isError = kind === "error";
  const popup = document.createElement("div");
  popup.className = `popup window is-open ${isError ? "error" : "info"}`;
  popup.style.zIndex = String(++zIndex);
  popup.innerHTML = `
    <div class="titlebar">
      <span>${isError ? "System Error" : "Information"}</span>
      <div class="window-actions">
        <button type="button" aria-label="Close popup" data-popup-close></button>
      </div>
    </div>
    <div class="popup-body">
      <div class="popup-symbol">${isError ? "!" : "i"}</div>
      <div>
        <p>${message || (isError ? "Trash contains old drafts, bad hero ideas, and one suspicious temp file." : "AMIRHD OS 98 is running resume applications.")}</p>
        <button class="button tiny primary" type="button" data-popup-close>OK</button>
      </div>
    </div>
  `;
  popupLayer.appendChild(popup);
  playSystemSound(kind);
  popup.querySelectorAll("[data-popup-close]").forEach((button) => {
    button.addEventListener("click", () => popup.remove());
  });
}

function setupWindowControls() {
  document.querySelectorAll("[data-open-app]").forEach((button) => {
    button.addEventListener("click", () => openApp(button.dataset.openApp));
  });

  document.querySelectorAll("[data-window-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const win = button.closest("[data-app]");
      if (!win) return;
      const appId = win.dataset.app;
      const action = button.dataset.windowAction;
      if (action === "minimize") minimizeApp(appId);
      if (action === "maximize") toggleMaximize(appId);
      if (action === "close") closeApp(appId);
    });
  });

  appWindows().forEach((win) => {
    win.addEventListener("pointerdown", () => focusApp(win.dataset.app));
  });
}

function setupDragging() {
  document.querySelectorAll("[data-app] .titlebar").forEach((titlebar) => {
    titlebar.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      const win = titlebar.closest("[data-app]");
      if (!win || win.classList.contains("is-maximized")) return;
      focusApp(win.dataset.app);

      const rect = win.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      titlebar.setPointerCapture(event.pointerId);

      function move(moveEvent) {
        const maxX = window.innerWidth - rect.width - 4;
        const maxY = window.innerHeight - rect.height - 46;
        const x = Math.max(4, Math.min(maxX, moveEvent.clientX - offsetX));
        const y = Math.max(4, Math.min(maxY, moveEvent.clientY - offsetY));
        win.style.left = `${x}px`;
        win.style.top = `${y}px`;
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

function setupStartMenu() {
  startButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    startMenu?.classList.toggle("open");
    startButton.classList.toggle("active");
    playSystemSound("info");
  });

  document.addEventListener("pointerdown", (event) => {
    if (!startMenu?.classList.contains("open")) return;
    if (event.target.closest("[data-start-menu]") || event.target.closest("[data-start-button]")) return;
    startMenu.classList.remove("open");
    startButton?.classList.remove("active");
  });

  document.querySelector("[data-shutdown]")?.addEventListener("click", () => {
    showPopup("info", "It is now safe to keep browsing this resume.");
    startMenu?.classList.remove("open");
    startButton?.classList.remove("active");
  });
}

function setupCommandLine() {
  const log = document.querySelector("[data-command-log]");
  const form = document.querySelector("[data-command-form]");
  const input = document.querySelector("[data-command-input]");
  if (!log || !form || !input) return;

  const commands = {
    backend: "Go services, APIs, ledgers, exchange workflows, observability.",
    systems: "C/C++, concurrency, networking, ROS, embedded UI, low-latency delivery.",
    contact: "Email: AmirHossein_Dolati@outlook.com | LinkedIn is available from Contact.",
    stack: "Go, C++17, Python, financial systems, exchange platforms, blockchain, Qt/QML, ROS.",
    help: "commands: backend, systems, contact, stack, clear",
  };

  function append(command, output) {
    const cmd = document.createElement("div");
    cmd.textContent = `C:\\> ${command}`;
    const result = document.createElement("strong");
    result.textContent = output;
    log.append(cmd, result);
    log.parentElement.scrollTop = log.parentElement.scrollHeight;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = input.value.trim().toLowerCase();
    if (!command) return;
    if (command === "clear") {
      log.innerHTML = "";
      input.value = "";
      playSystemSound("info");
      return;
    }
    append(command, commands[command] || "Bad command or file name");
    playSystemSound(commands[command] ? "info" : "error");
    input.value = "";
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
    while (logNode.children.length > 12) logNode.lastElementChild?.remove();
  }

  function render() {
    ordersNode.textContent = String(orders);
    latencyNode.textContent = `${latency}ms`;
    ledgerNode.textContent = latency > 90 ? "LAG" : "OK";
    riskNode.textContent = latency > 110 ? "WATCH" : "LOW";
    ledgerNode.style.color = latency > 90 ? "#ff3f8e" : "#000080";
    riskNode.style.color = latency > 110 ? "#ff3f8e" : "#000080";
  }

  function tick(makeSound = true) {
    orders += Math.floor(6 + Math.random() * 42);
    latency = Math.max(18, Math.floor(latency + (Math.random() * 28 - 11)));
    appendLog(messages[Math.floor(Math.random() * messages.length)]);
    render();
    if (makeSound) playSystemSound(latency > 110 ? "error" : "info");
  }

  document.querySelector("[data-ops-tick]")?.addEventListener("click", () => tick(true));
  document.querySelector("[data-ops-check]")?.addEventListener("click", () => {
    latency = Math.max(22, latency - 18);
    appendLog("[check] reconciliation passed");
    render();
    showPopup("info", "Reconciliation passed. Ledger and wallet snapshots are aligned.");
  });

  setInterval(() => tick(false), 3200);
  render();
}

function setupLife() {
  const canvas = document.querySelector("#life-canvas");
  const toggleButton = document.querySelector("[data-life-toggle]");
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

  function start() {
    clearInterval(timer);
    timer = setInterval(step, 120);
    running = true;
    if (toggleButton) toggleButton.textContent = "Pause";
  }

  function stop() {
    clearInterval(timer);
    running = false;
    if (toggleButton) toggleButton.textContent = "Run";
  }

  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * cols);
    const y = Math.floor((event.clientY - rect.top) / rect.height * rows);
    grid[y][x] = grid[y][x] ? 0 : 1;
    draw();
    playSystemSound("info");
  });

  toggleButton?.addEventListener("click", () => {
    if (running) stop();
    else start();
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
    stop();
    playSystemSound("error");
  });

  randomize();
  draw();
  start();
}

function setupTrash() {
  document.querySelectorAll("[data-restore-file]").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest("div")?.remove();
      showPopup("info", "File restored to a very imaginary archive.");
    });
  });

  document.querySelector("[data-empty-trash]")?.addEventListener("click", () => {
    const list = document.querySelector("[data-trash-list]");
    if (list) list.innerHTML = "<div><span>Trash is empty.</span><span></span></div>";
    showPopup("error", "Trash emptied. The bad ideas are gone.");
  });
}

function setupDesktopSelection() {
  document.querySelectorAll(".desktop-icon").forEach((icon) => {
    icon.addEventListener("click", () => {
      document.querySelectorAll(".desktop-icon").forEach((node) => node.classList.remove("selected"));
      icon.classList.add("selected");
    });
  });
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

setupWindowControls();
setupDragging();
setupStartMenu();
setupCommandLine();
setupOpsConsole();
setupLife();
setupTrash();
setupDesktopSelection();
focusApp("resume");
renderShell();
playStartup();
