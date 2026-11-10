const $ = (id) => document.getElementById(id);
const fmt = (v) => (typeof v === "number" ? v.toFixed(2) : "—");

chrome.storage.local.get({ replace: false }, (s) => ($("replace").checked = s.replace));
$("replace").addEventListener("change", (e) => chrome.storage.local.set({ replace: e.target.checked }));

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  chrome.tabs.sendMessage(tab.id, { type: "get" }, (res) => {
    if (chrome.runtime.lastError || !res) {
      $("msg").textContent = "Open a UTR profile to see ratings.";
      return;
    }
    if (!res.onProfile) {
      $("msg").textContent = "Open a player's profile.";
      return;
    }
    if (!res.player) {
      $("msg").textContent = "No rating data yet. Try reloading the page.";
      return;
    }
    $("msg").hidden = true;
    $("stats").hidden = false;
    $("singles").textContent = fmt(res.player.singles);
    $("doubles").textContent = fmt(res.player.doubles);
    if (res.player.threeMonth != null) {
      $("threeRow").hidden = false;
      $("three").textContent = fmt(res.player.threeMonth);
    }
  });
});
