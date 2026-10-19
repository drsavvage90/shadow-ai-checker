import { detectSensitiveData, type SensitiveFinding } from "@shadow-ai/core/detect";

if (window.top === window) {
  chrome.runtime.sendMessage({ type: "visit", host: location.hostname });

  document.addEventListener(
    "paste",
    (event) => {
      const pasted = event.clipboardData?.getData("text") ?? "";
      if (!pasted) return;
      const findings = detectSensitiveData(pasted);
      if (findings.length === 0) return;
      showWarning(findings);
      chrome.runtime.sendMessage({ type: "warning", patterns: findings.map((finding) => finding.id) });
    },
    true,
  );
}

function showWarning(findings: SensitiveFinding[]): void {
  const high = findings.some((finding) => finding.severity === "high");
  document.getElementById("shadow-ai-checker-warning")?.remove();
  const host = document.createElement("div");
  host.id = "shadow-ai-checker-warning";
  host.style.position = "fixed";
  host.style.zIndex = "2147483647";
  host.style.top = "0";
  host.style.left = "0";
  host.style.right = "0";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    .box { margin: 12px auto; max-width: 720px; background: #1c2430; color: #f3efe4; padding: 14px 16px; border-radius: 12px; border-top: 4px solid #e8c48c; font: 15px/1.45 "Segoe UI", sans-serif; box-shadow: 0 12px 30px rgba(0,0,0,.25); }
    p { margin: 0 0 8px; }
    button { font: inherit; background: #e8c48c; color: #1c2430; border: 0; border-radius: 999px; padding: 8px 14px; cursor: pointer; }
  `;
  const box = document.createElement("div");
  box.className = "box";
  box.setAttribute("role", "alert");
  const title = document.createElement("p");
  title.textContent = high
    ? "This paste may include sensitive client, patient, or account data."
    : "This paste includes contact details such as an email or phone number.";
  const detail = document.createElement("p");
  const labels = findings.map((finding) => finding.label).join(", ");
  detail.textContent = `Matched on this device only: ${labels}. Nothing from the paste was saved or sent. A pattern can miss sensitive text, and it can flag something harmless.`;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Dismiss";
  button.addEventListener("click", () => host.remove());
  box.append(title, detail, button);
  shadow.append(style, box);
  document.documentElement.append(host);
}
