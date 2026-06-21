const clock = document.querySelector("[data-clock]");

function updateClock() {
  if (!clock) return;
  clock.textContent = new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

updateClock();
setInterval(updateClock, 30000);

document.querySelectorAll(".window").forEach((windowNode) => {
  windowNode.addEventListener("pointerdown", () => {
    document.querySelectorAll(".window").forEach((node) => node.classList.remove("focused"));
    windowNode.classList.add("focused");
  });
});
