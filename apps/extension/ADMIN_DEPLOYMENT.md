# Deploying Shadow AI Checker to managed browsers

This note is for an IT provider or office manager installing the extension on firm-managed Chrome or Edge browsers. It is not a legal opinion. Tell people before you turn monitoring on. New York, Connecticut, and Delaware require notice for electronic monitoring, and other states may too. Start from [EMPLOYEE_NOTICE.md](EMPLOYEE_NOTICE.md) and have counsel review it.

## What the extension does

- On a managed browser, it notices visits to known AI sites (ChatGPT, Claude, Gemini, Copilot, Perplexity, and the rest of the catalog in `@shadow-ai/core`).
- When someone pastes into one of those sites, it checks the paste on the device for patterns such as SSNs, card numbers, emails, phone numbers, and simple health or client-matter hints.
- If a pattern matches, it shows a warning. It does not block the paste.
- It stores anonymous counts in that browser profile: visits by product, and warnings by pattern type.

## What it does not do

- It does not store or transmit page contents, prompts, or pasted text.
- This version does not make a network call. Counts are not sent to Vault or to you. A future dashboard hook exists in `src/report-counts.ts` and is a no-op. If you ever turn reporting on, update the employee notice first.
- It does not see unmanaged or personal devices, personal phones, or browsers where it is not installed.
- It does not see Copilot inside desktop Office apps when that traffic uses broad Microsoft 365 domains that the catalog deliberately omits.
- It is not a decision that the firm has met HIPAA or any other rule. It helps reduce risk on the browsers you manage.

## Pilot: load the unpacked extension

1. Build it from the repo root: `pnpm --filter @shadow-ai/extension build`
2. In Chrome or Edge, open `chrome://extensions` or `edge://extensions`.
3. Turn on Developer mode and choose Load unpacked.
4. Select `apps/extension/dist`.
5. Visit `https://chatgpt.com` and confirm the toolbar icon shows a visit after you open the popup.
6. Paste a fake SSN such as `219-09-9999` into the chat box and confirm the warning. The warning should not echo the number back.

Firefox 115 and newer can load the same `dist` folder from `about:debugging#/runtime/this-firefox` as a temporary add-on. The manifest includes a Gecko id. Chrome ignores that key.

## Force-install later

This repository does not ship a Chrome Web Store id or an update server. For a pilot, load the unpacked folder or distribute the `dist` directory through your own packaging process.

When you publish or self-host a CRX, Chrome and Edge enterprise policy `ExtensionInstallForcelist` (and the Edge equivalent) can install it on managed browsers. You will need the extension id and an update URL from that packaging step. Do not force-install onto personal devices people use outside of work.

## After install

- Show staff the notice and the warning they will see.
- Counts live in `chrome.storage.local` on that profile. An admin who can open the browser profile can view them from the extension's options page. Reset is on that page.
- Re-read the catalog when you update the extension. New domains are added in `packages/core/src/data/services.json`.

The paid Vault product, for firms that want help running the controls behind this checklist, is at [vaultsystems.ai](https://vaultsystems.ai).
