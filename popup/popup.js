document.getElementById("openBtn").onclick = () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("popup/recorder.html")
  });
};