const APP_TITLES = {
  resume: "Resume.exe",
  experience: "Experience.exe",
  stack: "Stack.sys",
  projects: "Projects.lnk",
  cmd: "Cmd.exe",
  paint: "Paint.exe",
  player: "Media Player.exe",
  code: "Code.exe",
  mines: "Minesweeper.exe",
  ie: "Internet Explorer.exe",
  life: "Life.exe",
  education: "Education.txt",
  languages: "Language Pack.exe",
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
let selectedTaskId = "resume";
let upsetMode = false;
let upsetClickCount = 0;
let screenSaverTimer;
let screenSaverActive = false;
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

function playTypeSound() {
  try {
    const base = 420 + Math.floor(Math.random() * 180);
    tone(base, 0, 0.035, "square", 0.025);
  } catch {}
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
  if (upsetMode && appId !== "taskmgr") {
    showPopup("error", "AMIRHD OS is crying right now. Applications are refusing to cooperate.");
    return;
  }
  const win = getWindow(appId);
  if (!win) return;
  appWindows().forEach((node) => node.classList.remove("focused"));
  win.classList.add("focused");
  win.style.zIndex = String(++zIndex);
  focusedApp = appId;
  renderShell();
}

function openApp(appId) {
  if (upsetMode && appId !== "taskmgr") {
    showPopup("error", "The desktop is upset. It only trusts Task Manager at the moment.");
    return;
  }
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
    row.className = `task-row ${selectedTaskId === id ? "selected" : ""}`;
    row.dataset.taskId = id;
    const status = isRunning ? (win.classList.contains("is-minimized") ? "Minimized" : "Running") : "Closed";
    const memory = isRunning ? `${Math.round((title.length * 3 + id.length * 11) / 2)} KB` : "-";
    row.innerHTML = `
      <span>${title}</span>
      <span>${status}</span>
      <span>${memory}</span>
    `;
    row.addEventListener("click", () => {
      selectedTaskId = id;
      renderTaskManager();
    });
    row.addEventListener("dblclick", () => openApp(id));
    taskList.appendChild(row);
  });
}

function selectedTaskWindow() {
  return selectedTaskId ? getWindow(selectedTaskId) : null;
}

function setupTaskManagerButtons() {
  document.querySelector("[data-task-switch]")?.addEventListener("click", () => {
    if (!selectedTaskId) return;
    openApp(selectedTaskId);
  });
  document.querySelector("[data-task-minimize]")?.addEventListener("click", () => {
    if (!selectedTaskWindow()?.classList.contains("is-open")) return;
    minimizeApp(selectedTaskId);
  });
  document.querySelector("[data-task-end]")?.addEventListener("click", () => {
    if (!selectedTaskWindow()?.classList.contains("is-open")) return;
    closeApp(selectedTaskId);
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

function appendCommandLine(text) {
  const log = document.querySelector("[data-command-log]");
  if (!log) return;
  const line = document.createElement("strong");
  line.textContent = text;
  log.append(line);
  log.parentElement.scrollTop = log.parentElement.scrollHeight;
}

function showShutdownDialog() {
  if (!popupLayer) return;
  const dialog = document.createElement("div");
  dialog.className = "popup window is-open shutdown-dialog";
  dialog.style.zIndex = String(++zIndex);
  dialog.innerHTML = `
    <div class="titlebar">
      <span>Shut Down Windows</span>
      <div class="window-actions">
        <button type="button" aria-label="Close shutdown dialog" data-shutdown-cancel></button>
      </div>
    </div>
    <div class="shutdown-body">
      <p>What do you want AMIRHD OS 98 to do?</p>
      <div class="shutdown-actions">
        <button class="button tiny" type="button" data-shutdown-action="standby">Stand by</button>
        <button class="button tiny" type="button" data-shutdown-action="restart">Restart</button>
        <button class="button tiny primary" type="button" data-shutdown-action="shutdown">Shut down</button>
        <button class="button tiny" type="button" data-shutdown-cancel>Cancel</button>
      </div>
    </div>
  `;
  popupLayer.appendChild(dialog);
  playSystemSound("info");

  function close() {
    dialog.remove();
  }

  dialog.querySelectorAll("[data-shutdown-cancel]").forEach((button) => {
    button.addEventListener("click", close);
  });

  dialog.querySelectorAll("[data-shutdown-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.shutdownAction;
      close();
      if (action === "standby") {
        document.body.classList.add("standby-mode");
        showPopup("info", "Stand by failed. Backend is still running.");
        setTimeout(() => document.body.classList.remove("standby-mode"), 1800);
      }
      if (action === "restart") {
        bootScreen?.classList.remove("hidden");
        if (bootStatus) bootStatus.textContent = "Restarting without losing tabs...";
        setTimeout(hideBootScreen, 1800);
      }
      if (action === "shutdown") {
        triggerUpsetMode();
      }
    });
  });
}

function clearUpsetMode() {
  upsetMode = false;
  document.body.classList.remove("upset-mode");
  showPopup("info", "Apology accepted. AMIRHD OS 98 is emotionally available again.");
}

function triggerUpsetMode() {
  if (!popupLayer) return;
  upsetMode = true;
  document.body.classList.add("upset-mode");
  playSystemSound("error");

  const dialog = document.createElement("div");
  dialog.className = "popup window is-open patrick-popup";
  dialog.style.zIndex = String(++zIndex);
  dialog.innerHTML = `
    <div class="titlebar">
      <span>System Feelings</span>
      <div class="window-actions">
        <button type="button" aria-label="Close feelings dialog" data-patrick-close></button>
      </div>
    </div>
    <div class="patrick-body">
      <img src="assets/imge.webp" alt="Crying Patrick meme">
      <p>Why do you hate me? I only wanted to show you backend experience.</p>
      <div class="patrick-actions">
        <button class="button tiny primary" type="button" data-patrick-apology>Apologize</button>
        <button class="button tiny" type="button" data-patrick-close>Let it cry</button>
      </div>
    </div>
  `;
  popupLayer.appendChild(dialog);
  appendCommandLine("shutdown denied: desktop feelings.exe is now running");
  renderShell();

  dialog.querySelector("[data-patrick-apology]")?.addEventListener("click", () => {
    dialog.remove();
    clearUpsetMode();
  });
  dialog.querySelectorAll("[data-patrick-close]").forEach((button) => {
    button.addEventListener("click", () => dialog.remove());
  });
}

function showBlueScreen() {
  const bsod = document.querySelector("[data-bsod]");
  if (!bsod) return;
  upsetMode = false;
  upsetClickCount = 0;
  document.body.classList.remove("upset-mode");
  bsod.classList.add("active");
  bsod.setAttribute("aria-hidden", "false");
  bsod.focus();
  playSystemSound("error");
}

function hideBlueScreen() {
  const bsod = document.querySelector("[data-bsod]");
  if (!bsod?.classList.contains("active")) return;
  bsod.classList.remove("active");
  bsod.setAttribute("aria-hidden", "true");
  bootScreen?.classList.remove("hidden");
  if (bootStatus) bootStatus.textContent = "Restarting after emotional exception...";
  setTimeout(hideBootScreen, 1600);
}

function setupBlueScreenAchievement() {
  document.addEventListener("click", (event) => {
    if (!upsetMode) return;
    if (event.target.closest("[data-patrick-apology]")) return;
    upsetClickCount += 1;
    if (upsetClickCount >= 8) showBlueScreen();
  }, true);

  document.addEventListener("keydown", () => hideBlueScreen());
  document.querySelector("[data-bsod]")?.addEventListener("click", () => hideBlueScreen());
}

function setupScreenSaver() {
  const saver = document.querySelector("[data-screensaver]");
  if (!saver) return;

  function show() {
    if (screenSaverActive) return;
    screenSaverActive = true;
    saver.classList.add("active");
    saver.setAttribute("aria-hidden", "false");
  }

  function hide() {
    if (screenSaverActive) {
      screenSaverActive = false;
      saver.classList.remove("active");
      saver.setAttribute("aria-hidden", "true");
    }
    clearTimeout(screenSaverTimer);
    screenSaverTimer = setTimeout(show, 45000);
  }

  ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, hide, { passive: true });
  });
  hide();
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
        const maxY = window.innerHeight - rect.height - 64;
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
    showShutdownDialog();
    startMenu?.classList.remove("open");
    startButton?.classList.remove("active");
  });
}

function setupCommandLine() {
  const log = document.querySelector("[data-command-log]");
  const form = document.querySelector("[data-command-form]");
  const input = document.querySelector("[data-command-input]");
  if (!log || !form || !input) return;
  const history = [];
  let historyIndex = 0;

  const commands = {
    help: "commands: help, about, backend, fintech, blockchain, projects, experience, contact, cv, life, mines, ie, trash, music, code, languages, shutdown, clear",
    about: "AmirHossein Dolati - Go/backend engineer building financial, exchange, and blockchain-adjacent systems.",
    backend: "Go services, APIs, ledgers, exchange workflows, observability.",
    fintech: "Financial software: ledgers, reconciliation, risk checks, exchange operations.",
    blockchain: "Blockchain-adjacent backend work: indexers, wallets, transaction flows, settlement thinking.",
    projects: "Opening Projects.lnk...",
    experience: "Opening Experience.exe...",
    contact: "Email: AmirHossein_Dolati@outlook.com | LinkedIn is available from Contact.cmd.",
    cv: "Opening CV download...",
    life: "Opening Life.exe...",
    mines: "Opening Minesweeper.exe...",
    ie: "Opening Internet Explorer.exe...",
    trash: "Opening Trash...",
    music: "Opening Media Player.exe...",
    code: "Opening Code.exe...",
    languages: "Opening Language Pack.exe...",
    shutdown: "Opening shutdown dialog...",
  };

  const openCommands = {
    projects: "projects",
    experience: "experience",
    contact: "contact",
    life: "life",
    mines: "mines",
    ie: "ie",
    trash: "trash",
    music: "player",
    code: "code",
    languages: "languages",
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
    history.push(command);
    historyIndex = history.length;
    if (command === "clear") {
      log.innerHTML = "";
      input.value = "";
      playSystemSound("info");
      return;
    }
    append(command, commands[command] || "Bad command or file name");
    if (openCommands[command]) openApp(openCommands[command]);
    if (command === "shutdown") showShutdownDialog();
    if (command === "cv") window.open("AmirHossein-Dolati-CV-11-20-24-1.pdf", "_blank", "noopener");
    playSystemSound(commands[command] ? "info" : "error");
    input.value = "";
  });

  input.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      append("^C", "Break");
      input.value = "";
      playSystemSound("error");
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] || "";
      input.setSelectionRange(input.value.length, input.value.length);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || "";
      input.setSelectionRange(input.value.length, input.value.length);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const prefix = input.value.trim().toLowerCase();
      if (!prefix) return;
      const matches = Object.keys(commands).concat("clear").filter((name) => name.startsWith(prefix));
      if (matches.length === 1) {
        input.value = matches[0];
        input.setSelectionRange(input.value.length, input.value.length);
        playSystemSound("info");
      } else if (matches.length > 1) {
        append(prefix, matches.join("  "));
      }
    }
  });

  document.querySelector("[data-app='cmd'] .command-content")?.addEventListener("click", () => {
    input.focus();
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
    ctx.font = "16px ByteBounce, monospace";
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
    ctx.font = "13px ByteBounce, monospace";
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
  const progress = document.querySelector("[data-player-progress]");
  const timeNode = document.querySelector("[data-player-time]");
  const statusNode = document.querySelector("[data-player-status]");
  const bars = Array.from(document.querySelectorAll(".player-bars span"));
  if (!playButton || !stopButton) return;

  const pattern = [
    82, 82, 98, 82, 123, 110, 98, 82,
    82, 92, 110, 92, 138, 123, 110, 92,
  ];
  let timer;
  let visualTimer;
  let audio;
  let step = 0;
  let running = false;
  let paused = false;

  function chipTone(frequency, delay, duration, volume, type = "square") {
    try {
      tone(frequency, delay, duration, type, volume);
    } catch {}
  }

  function render() {
    const progressValue = audio?.duration ? audio.currentTime / audio.duration * 100 : step / pattern.length * 100;
    const seconds = audio ? Math.floor(audio.currentTime) : step;
    if (progress) progress.style.width = `${Math.max(0, Math.min(100, progressValue))}%`;
    if (timeNode) timeNode.textContent = String(seconds % 60).padStart(2, "0");
    if (statusNode) statusNode.textContent = running ? "Playing" : (paused ? "Paused" : "Stopped");
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

  function startVisualizer() {
    clearInterval(visualTimer);
    visualTimer = setInterval(() => {
      step = (step + 1) % pattern.length;
      render();
    }, 132);
  }

  function startChipFallback() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();
    clearInterval(timer);
    running = true;
    paused = false;
    playButton.textContent = "Pause";
    playButton.setAttribute("aria-label", "Pause");
    if (statusNode) statusNode.textContent = "Playing fallback";
    tick();
    timer = setInterval(tick, 132);
  }

  async function startAudio() {
    if (!audio) {
      audio = new Audio(playButton.dataset.audioSrc);
      audio.preload = "none";
      audio.addEventListener("timeupdate", render);
      audio.addEventListener("ended", stopMediaPlayer);
      audio.addEventListener("error", () => {
        if (!running) startChipFallback();
      });
    }
    try {
      if (statusNode) statusNode.textContent = "Opening...";
      await audio.play();
      running = true;
      paused = false;
      playButton.textContent = "Pause";
      playButton.setAttribute("aria-label", "Pause");
      startVisualizer();
      render();
    } catch {
      startChipFallback();
    }
  }

  stopMediaPlayer = function stop() {
    clearInterval(timer);
    clearInterval(visualTimer);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    running = false;
    paused = false;
    playButton.textContent = "Play";
    playButton.setAttribute("aria-label", "Play");
    if (progress) progress.style.width = "0%";
    bars.forEach((bar) => {
      bar.style.height = "10px";
    });
    render();
  };

  function pauseMediaPlayer() {
    clearInterval(timer);
    clearInterval(visualTimer);
    if (audio) audio.pause();
    running = false;
    paused = true;
    playButton.textContent = "Resume";
    playButton.setAttribute("aria-label", "Resume");
    bars.forEach((bar) => {
      bar.style.height = "10px";
    });
    render();
  }

  playButton.addEventListener("click", () => {
    if (running) pauseMediaPlayer();
    else startAudio();
  });

  stopButton.addEventListener("click", stopMediaPlayer);

  render();
}

function setupCodeEditor() {
  const editor = document.querySelector("[data-code-editor]");
  const output = document.querySelector("[data-code-output]");
  const count = document.querySelector("[data-code-count]");
  if (!editor || !output) return;

  const source = `#include <chrono>
#include <cstdint>
#include <iostream>
#include <optional>
#include <queue>
#include <string>
#include <unordered_map>
#include <vector>

namespace exchange {

struct Money {
  std::int64_t atoms{};
  static Money fromAtoms(std::int64_t value) { return Money{value}; }
};

struct Order {
  std::string id;
  std::string user;
  Money price;
  Money quantity;
  bool bid{};
};

class Ledger {
 public:
  void reserve(const std::string& user, Money amount) {
    balances_[user] -= amount.atoms;
    reserved_[user] += amount.atoms;
  }

  void settle(const std::string& maker, const std::string& taker, Money notional) {
    reserved_[maker] -= notional.atoms;
    balances_[taker] -= notional.atoms;
    balances_[maker] += notional.atoms;
  }

 private:
  std::unordered_map<std::string, std::int64_t> balances_;
  std::unordered_map<std::string, std::int64_t> reserved_;
};

class MatchingEngine {
 public:
  void submit(Order order) {
    auto& side = order.bid ? bids_ : asks_;
    side.push(std::move(order));
    match();
  }

 private:
  void match() {
    while (!bids_.empty() && !asks_.empty()) {
      auto bid = bids_.front();
      auto ask = asks_.front();
      if (bid.price.atoms < ask.price.atoms) return;
      const auto traded = Money::fromAtoms(std::min(bid.quantity.atoms, ask.quantity.atoms));
      ledger_.settle(ask.user, bid.user, traded);
      std::cout << "fill " << bid.id << " x " << ask.id << "\\n";
      bids_.pop();
      asks_.pop();
    }
  }

  std::queue<Order> bids_;
  std::queue<Order> asks_;
  Ledger ledger_;
};

}  // namespace exchange

int main() {
  exchange::MatchingEngine engine;
  engine.submit({"B-100", "recruiter", {4200}, {10}, true});
  engine.submit({"A-200", "amirhd", {4100}, {10}, false});
  std::cout << "backend online\\n";
  return 0;
}
`;

  let index = 0;
  output.textContent = "";

  function writeNext(amount = 1) {
    if (index >= source.length) index = 0;
    output.textContent += source.slice(index, index + amount);
    index += amount;
    const lines = output.textContent.split("\n").length;
    if (count) count.textContent = `${lines} LOC`;
    requestAnimationFrame(() => {
      output.scrollTop = output.scrollHeight;
      editor.scrollTop = editor.scrollHeight;
    });
    playTypeSound();
  }

  editor.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    writeNext(event.key === "Enter" ? 5 : 2 + Math.floor(Math.random() * 4));
  });
  editor.addEventListener("click", () => editor.focus());
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

function setupMinesweeper() {
  const board = document.querySelector("[data-mines-board]");
  const minesLeft = document.querySelector("[data-mines-left]");
  const timeNode = document.querySelector("[data-mines-time]");
  const resetButton = document.querySelector("[data-mines-reset]");
  if (!board || !minesLeft || !timeNode || !resetButton) return;

  const size = 9;
  const mineCount = 10;
  let cells = [];
  let started = false;
  let gameOver = false;
  let flags = 0;
  let seconds = 0;
  let timer;

  function pad(value) {
    return String(Math.max(0, Math.min(999, value))).padStart(3, "0");
  }

  function updatePanel() {
    minesLeft.textContent = pad(mineCount - flags);
    timeNode.textContent = pad(seconds);
  }

  function neighbors(index) {
    const x = index % size;
    const y = Math.floor(index / size);
    const result = [];
    for (let yy = y - 1; yy <= y + 1; yy += 1) {
      for (let xx = x - 1; xx <= x + 1; xx += 1) {
        if (xx === x && yy === y) continue;
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
        result.push(yy * size + xx);
      }
    }
    return result;
  }

  function startTimer() {
    if (started) return;
    started = true;
    timer = setInterval(() => {
      seconds += 1;
      updatePanel();
    }, 1000);
  }

  function renderCell(cell) {
    const button = board.querySelector(`[data-cell="${cell.index}"]`);
    if (!button) return;
    button.className = "mine-cell";
    button.textContent = "";
    if (cell.revealed) {
      button.classList.add("revealed");
      if (cell.mine) {
        button.classList.add("mine");
        button.textContent = "*";
      } else if (cell.count) {
        button.textContent = String(cell.count);
        button.dataset.count = String(cell.count);
      }
    } else if (cell.flagged) {
      button.classList.add("flagged");
      button.textContent = "F";
    }
  }

  function renderAll() {
    cells.forEach(renderCell);
    updatePanel();
  }

  function reveal(index) {
    const cell = cells[index];
    if (!cell || cell.revealed || cell.flagged || gameOver) return;
    startTimer();
    cell.revealed = true;
    if (cell.mine) {
      gameOver = true;
      clearInterval(timer);
      resetButton.textContent = ":(";
      cells.forEach((item) => {
        if (item.mine) item.revealed = true;
      });
      renderAll();
      showPopup("error", "Boom. Production deploy stepped on a mine.");
      return;
    }
    if (!cell.count) neighbors(index).forEach(reveal);
    renderCell(cell);
    const safeOpen = cells.filter((item) => item.revealed && !item.mine).length;
    if (safeOpen === size * size - mineCount) {
      gameOver = true;
      clearInterval(timer);
      resetButton.textContent = "B)";
      showPopup("info", "Mines cleared. Resume survived the deployment.");
    }
  }

  function toggleFlag(index) {
    const cell = cells[index];
    if (!cell || cell.revealed || gameOver) return;
    startTimer();
    cell.flagged = !cell.flagged;
    flags += cell.flagged ? 1 : -1;
    renderCell(cell);
    updatePanel();
  }

  function reset() {
    clearInterval(timer);
    started = false;
    gameOver = false;
    flags = 0;
    seconds = 0;
    resetButton.textContent = ":)";
    const mineIndexes = new Set();
    while (mineIndexes.size < mineCount) {
      mineIndexes.add(Math.floor(Math.random() * size * size));
    }
    cells = Array.from({ length: size * size }, (_, index) => ({
      index,
      mine: mineIndexes.has(index),
      flagged: false,
      revealed: false,
      count: 0,
    }));
    cells.forEach((cell) => {
      cell.count = cell.mine ? 0 : neighbors(cell.index).filter((idx) => cells[idx].mine).length;
    });
    board.innerHTML = "";
    cells.forEach((cell) => {
      const button = document.createElement("button");
      button.className = "mine-cell";
      button.type = "button";
      button.dataset.cell = String(cell.index);
      button.addEventListener("click", () => reveal(cell.index));
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        toggleFlag(cell.index);
      });
      button.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "touch") {
          button.longPress = setTimeout(() => toggleFlag(cell.index), 450);
        }
      });
      button.addEventListener("pointerup", () => clearTimeout(button.longPress));
      button.addEventListener("pointercancel", () => clearTimeout(button.longPress));
      board.appendChild(button);
    });
    renderAll();
  }

  resetButton.addEventListener("click", reset);
  reset();
}

function setupInternetExplorer() {
  const form = document.querySelector("[data-ie-form]");
  const input = document.querySelector("[data-ie-input]");
  const error = document.querySelector("[data-ie-error]");
  const status = document.querySelector("[data-ie-status]");
  const vpnStatus = document.querySelector("[data-vpn-status]");
  const vpnButton = document.querySelector("[data-vpn-button]");
  const page = document.querySelector("[data-ie-page]");
  if (!form || !input || !error || !status || !vpnStatus || !vpnButton || !page) return;

  const errors = [
    "This site is filtered in your region.",
    "VPN connection failed. Subscription expired during handshake.",
    "Your country is not allowed to view this website.",
    "Proxy timeout. Packets are waiting behind a very tired firewall.",
    "DNS says no. Try again after tea.",
  ];
  let index = 0;

  function fail(url) {
    const message = errors[index % errors.length];
    index += 1;
    page.classList.add("shake");
    setTimeout(() => page.classList.remove("shake"), 350);
    error.textContent = message;
    status.textContent = `Cannot open ${url || "about:blank"} - restricted route`;
    playSystemSound("error");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    fail(input.value.trim());
  });

  vpnButton.addEventListener("click", () => {
    const states = [
      "VPN: connecting...",
      "VPN: auth failed",
      "VPN: server full",
      "VPN: disconnected again",
    ];
    vpnStatus.textContent = states[index % states.length];
    fail(input.value.trim() || "vpn://resume");
  });
}

function setupSmallApps() {
  document.querySelectorAll("[data-inspect-file]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.closest("div")?.querySelector("span")?.textContent || "mystery file";
      const messages = {
        "node_modules_final.zip": "Size: infinite. Contents: one package-lock and ancient regret.",
        "bad_tokenomics.xlsx": "Forecast says: number goes sideways, investor confidence goes downstairs.",
        "production_hotfix_3am.tmp": "Contains a fix, two TODOs, and no memory of who approved it.",
        "old_vpn_config.pbk": "VPN profile found. Status: still cannot connect.",
        "warcraft(dota).exe": "A sacred LAN artifact. Restoring may summon mid-only arguments.",
      };
      showPopup("info", messages[name] || `${name} looks suspiciously recoverable.`);
    });
  });

  document.querySelectorAll("[data-restore-file]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.closest("div")?.querySelector("span")?.textContent || "file";
      button.closest("div")?.remove();
      appendCommandLine(`restored ${name} to C:\\CHAOS\\`);
      showPopup("info", `${name} restored. Please pretend this was a good idea.`);
    });
  });

  document.querySelector("[data-empty-trash]")?.addEventListener("click", () => {
    const list = document.querySelector("[data-trash-list]");
    if (list) list.innerHTML = "<div class=\"trash-empty\"><span>Trash is empty. Bad ideas are in cold storage.</span></div>";
    document.querySelector("[data-open-app='trash'] img")?.setAttribute("src", "assets/icons/trash.ico");
    showPopup("error", "Trash emptied. The bad ideas are gone, but the audit log remembers.");
  });
}

function desktopIcons() {
  return Array.from(document.querySelectorAll(".desktop-icon"));
}

function layoutDesktopIcons() {
  if (!desktopSurface) return;
  const icons = desktopIcons();
  const iconWidth = 122;
  const iconHeight = 100;
  const gap = 12;
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
setupCodeEditor();
setupLife();
setupMinesweeper();
setupInternetExplorer();
setupSmallApps();
setupBlueScreenAchievement();
setupScreenSaver();
setupTaskManagerButtons();
setupDesktopIcons();
focusApp("resume");
renderShell();
playStartup();
