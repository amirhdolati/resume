const APP_TITLES = {
  resume: "Resume.exe",
  experience: "Experience.exe",
  stack: "Stack.sys",
  projects: "Projects.lnk",
  cmd: "Cmd.exe",
  paint: "Paint.exe",
  player: "Media Player.exe",
  life: "Life.exe",
  education: "Education.txt",
  contact: "Contact.cmd",
  readme: "Readme.nfo",
  taskmgr: "Taskmgr.exe",
  trash: "Trash",
};

const clock = document.querySelector("[data-clock]");
const startupAudio = document.querySelector("#startup-audio");
const bootScreen = document.querySelector("[data-boot-screen]");
const bootStatus = document.querySelector("[data-boot-status]");
const popupLayer = document.querySelector("[data-popup-layer]");
const startButton = document.querySelector("[data-start-button]");
const startMenu = document.querySelector("[data-start-menu]");
const taskbarApps = document.querySelector("[data-taskbar-apps]");
const taskList = document.querySelector("[data-task-list]");
const desktopSurface = document.querySelector(".desktop-surface");
let startupSoundPlayed = false;

let audioContext;
let zIndex = 40;
let focusedApp = "resume";
let stopMediaPlayer = () => {};

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

async function playStartupSound() {
  if (!startupAudio || startupSoundPlayed) return false;
  try {
    startupAudio.pause();
    startupAudio.currentTime = 0;
    startupAudio.volume = 1;
    await startupAudio.play();
    startupSoundPlayed = true;
    return true;
  } catch {
    return false;
  }
}

async function playStartup() {
  const bootLines = [
    "Checking memory...",
    "Loading HIMEM.SYS...",
    "Starting AMIRHD desktop...",
    "Opening resume apps...",
  ];
  bootLines.forEach((line, index) => {
    setTimeout(() => {
      if (bootStatus) bootStatus.textContent = line;
    }, index * 620);
  });
  await playStartupSound();
  setTimeout(hideBootScreen, 2800);
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
  if (appId === "player") stopMediaPlayer();
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
    const status = isRunning ? (win.classList.contains("is-minimized") ? "Minimized" : "Running") : "Closed";
    const memory = isRunning ? `${Math.round((title.length * 3 + id.length * 11) / 2)} KB` : "-";
    row.innerHTML = `
      <span>${title}</span>
      <span>${status}</span>
      <span>${memory}</span>
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
      endButton.textContent = "End Task";
      endButton.addEventListener("click", () => closeApp(id));
      const minimizeButton = document.createElement("button");
      minimizeButton.className = "button tiny";
      minimizeButton.type = "button";
      minimizeButton.textContent = "Minimize";
      minimizeButton.addEventListener("click", () => minimizeApp(id));
      actions.append(switchButton, minimizeButton, endButton);
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
    button.addEventListener("click", () => {
      if (button.dataset.justDragged === "true") {
        delete button.dataset.justDragged;
        return;
      }
      openApp(button.dataset.openApp);
    });
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

function setupPaint() {
  const canvas = document.querySelector("#paint-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let color = "#000080";
  let tool = "pen";
  let drawing = false;
  let start = null;

  function position(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width * canvas.width,
      y: (event.clientY - rect.top) / rect.height * canvas.height,
    };
  }

  function drawTemplate() {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#c0c0c0";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#000080";
    ctx.font = "16px MSW98UI, monospace";
    ctx.fillText("Go API", 34, 55);
    ctx.fillText("Ledger", 194, 55);
    ctx.fillText("Chain", 348, 55);
    ctx.strokeStyle = "#101010";
    ctx.lineWidth = 2;
    [["Go API", 24, 68], ["Ledger", 184, 68], ["Chain", 338, 68]].forEach(([, x, y]) => {
      ctx.strokeRect(x, y, 86, 44);
    });
    ctx.beginPath();
    ctx.moveTo(110, 90);
    ctx.lineTo(184, 90);
    ctx.moveTo(270, 90);
    ctx.lineTo(338, 90);
    ctx.stroke();
  }

  function stamp(point) {
    ctx.fillStyle = color;
    ctx.fillRect(point.x - 28, point.y - 12, 56, 24);
    ctx.fillStyle = "#ffffff";
    ctx.font = "13px MSW98UI, monospace";
    ctx.fillText("service", point.x - 21, point.y + 4);
  }

  function activateTool(button) {
    document.querySelectorAll("[data-paint-tool]").forEach((node) => node.classList.remove("primary"));
    button.classList.add("primary");
    tool = button.dataset.paintTool;
  }

  document.querySelectorAll("[data-paint-tool]").forEach((button) => {
    button.addEventListener("click", () => activateTool(button));
  });

  document.querySelectorAll("[data-paint-color]").forEach((button) => {
    button.addEventListener("click", () => {
      color = button.dataset.paintColor;
      document.querySelectorAll("[data-paint-color]").forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
    });
  });

  document.querySelector("[data-paint-clear]")?.addEventListener("click", () => {
    drawTemplate();
    playSystemSound("error");
  });

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    drawing = true;
    start = position(event);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    if (tool === "stamp") {
      stamp(start);
      drawing = false;
    } else if (tool === "pen") {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drawing || tool !== "pen") return;
    const point = position(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!drawing || !start) return;
    const point = position(event);
    if (tool === "line") {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    drawing = false;
    start = null;
  });

  drawTemplate();
  document.querySelector("[data-paint-color]")?.classList.add("active");
}

function setupMediaPlayer() {
  const playButton = document.querySelector("[data-player-play]");
  const stopButton = document.querySelector("[data-player-stop]");
  const tempoButton = document.querySelector("[data-player-tempo]");
  const progress = document.querySelector("[data-player-progress]");
  const bars = Array.from(document.querySelectorAll(".player-screen span"));
  if (!playButton || !stopButton || !tempoButton) return;

  const pattern = [
    82, 82, 98, 82, 123, 110, 98, 82,
    82, 92, 110, 92, 138, 123, 110, 92,
  ];
  let timer;
  let step = 0;
  let running = false;
  let turbo = false;

  function chipTone(frequency, delay, duration, volume, type = "square") {
    try {
      tone(frequency, delay, duration, type, volume);
    } catch {}
  }

  function render() {
    if (progress) progress.style.width = `${step / pattern.length * 100}%`;
    bars.forEach((bar, index) => {
      const height = 18 + ((step + index * 3) % 7) * 9;
      bar.style.height = running ? `${height}px` : "10px";
    });
  }

  function tick() {
    const base = pattern[step % pattern.length];
    chipTone(base, 0, 0.09, 0.045);
    chipTone(base / 2, 0.01, 0.12, 0.035, "triangle");
    if (step % 4 === 0) chipTone(base * 2, 0.04, 0.06, 0.032);
    if (step % 8 === 6) chipTone(base * 3, 0.02, 0.05, 0.025);
    step = (step + 1) % pattern.length;
    render();
  }

  function start() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();
    clearInterval(timer);
    running = true;
    playButton.textContent = "Pause";
    tick();
    timer = setInterval(tick, turbo ? 90 : 132);
  }

  stopMediaPlayer = function stop() {
    clearInterval(timer);
    running = false;
    playButton.textContent = "Play";
    if (progress) progress.style.width = "0%";
    bars.forEach((bar) => {
      bar.style.height = "10px";
    });
  };

  playButton.addEventListener("click", () => {
    if (running) stopMediaPlayer();
    else start();
  });

  stopButton.addEventListener("click", stopMediaPlayer);

  tempoButton.addEventListener("click", () => {
    turbo = !turbo;
    tempoButton.classList.toggle("primary", turbo);
    tempoButton.textContent = turbo ? "Normal" : "Turbo";
    if (running) start();
  });

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

function setupSmallApps() {
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

function desktopIcons() {
  return Array.from(document.querySelectorAll(".desktop-icon"));
}

function layoutDesktopIcons() {
  if (!desktopSurface) return;
  const icons = desktopIcons();
  const iconWidth = 88;
  const iconHeight = 70;
  const gap = 9;
  const startX = 12;
  const startY = 14;
  const usableHeight = Math.max(iconHeight, desktopSurface.clientHeight - startY - 10);
  const rows = Math.max(1, Math.floor((usableHeight + gap) / (iconHeight + gap)));

  icons.forEach((icon, index) => {
    if (icon.dataset.moved === "true") return;
    const column = Math.floor(index / rows);
    const row = index % rows;
    icon.style.left = `${startX + column * (iconWidth + gap)}px`;
    icon.style.top = `${startY + row * (iconHeight + gap)}px`;
  });
}

function selectDesktopIcon(icon) {
  desktopIcons().forEach((node) => node.classList.remove("selected"));
  icon.classList.add("selected");
}

function setupDesktopIcons() {
  layoutDesktopIcons();
  window.addEventListener("resize", layoutDesktopIcons);

  desktopIcons().forEach((icon) => {
    icon.addEventListener("click", () => {
      if (icon.dataset.justDragged === "true") return;
      selectDesktopIcon(icon);
    });

    icon.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !desktopSurface) return;
      selectDesktopIcon(icon);

      const iconRect = icon.getBoundingClientRect();
      const surfaceRect = desktopSurface.getBoundingClientRect();
      const offsetX = event.clientX - iconRect.left;
      const offsetY = event.clientY - iconRect.top;
      const startX = event.clientX;
      const startY = event.clientY;
      let dragging = false;

      icon.setPointerCapture(event.pointerId);

      function move(moveEvent) {
        const distance = Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY);
        if (distance < 5 && !dragging) return;
        dragging = true;
        icon.classList.add("dragging");
        icon.dataset.moved = "true";

        const maxX = Math.max(4, surfaceRect.width - iconRect.width - 4);
        const maxY = Math.max(4, surfaceRect.height - iconRect.height - 4);
        const x = Math.max(4, Math.min(maxX, moveEvent.clientX - surfaceRect.left - offsetX));
        const y = Math.max(4, Math.min(maxY, moveEvent.clientY - surfaceRect.top - offsetY));
        icon.style.left = `${x}px`;
        icon.style.top = `${y}px`;
      }

      function stop() {
        icon.removeEventListener("pointermove", move);
        icon.removeEventListener("pointerup", stop);
        icon.removeEventListener("pointercancel", stop);
        icon.classList.remove("dragging");
        if (dragging) {
          icon.dataset.justDragged = "true";
          setTimeout(() => {
            delete icon.dataset.justDragged;
          }, 0);
        }
      }

      icon.addEventListener("pointermove", move);
      icon.addEventListener("pointerup", stop);
      icon.addEventListener("pointercancel", stop);
    });
  });
}

updateClock();
setInterval(updateClock, 30000);

document.addEventListener("pointerdown", () => {
  if (audioContext?.state === "suspended") audioContext.resume();
  playStartupSound();
}, { once: true });

document.querySelectorAll("[data-popup]").forEach((button) => {
  button.addEventListener("click", () => showPopup(button.dataset.popup));
});

setupWindowControls();
setupDragging();
setupStartMenu();
setupCommandLine();
setupPaint();
setupMediaPlayer();
setupLife();
setupSmallApps();
setupDesktopIcons();
focusApp("resume");
renderShell();
playStartup();
