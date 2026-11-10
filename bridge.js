let latest = null;
let replace = false;

function sendReplace() {
  window.postMessage({ source: "utr-dec-bridge", type: "setReplace", value: replace }, "*");
}

window.addEventListener("message", (e) => {
  if (e.source !== window || e.data?.source !== "utr-dec-main") return;
  if (e.data.type === "data") latest = e.data.player;
  if (e.data.type === "ready") sendReplace();
});

chrome.storage.local.get({ replace: false }, (s) => {
  replace = s.replace;
  sendReplace();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.replace) {
    replace = changes.replace.newValue;
    sendReplace();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === "get") {
    reply({ player: latest, onProfile: /profiles\/\d+/.test(location.pathname) });
  }
});
