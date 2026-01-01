async function injectScript(tabId, url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return;

    const code = await response.text();

    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      world: "MAIN",
      func: (scriptText) => {
        const script = document.createElement("script");
        script.textContent = scriptText;
        document.documentElement.appendChild(script);
        script.remove();
      },
      args: [code]
    });

  } catch {}
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    injectScript(
      tab.id,
      "https://raw.githubusercontent.com/xgui-client/X-GUI-BLOOKET-CLIENT/refs/heads/main/x-gui%20cheats/X-GUI.JS"
    );
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url?.endsWith("?x-gui")
  ) {
    injectScript(
      tabId,
      "https://raw.githubusercontent.com/xgui-client/X-GUI-BLOOKET-CLIENT/refs/heads/main/x-gui%20cheats/X-GUI.JS"
    );
  }
});
