# Shadow AI Checker

**by [Vault Systems](https://vaultsystems.ai)**

Shadow AI Checker is a free, open-source toolkit that helps small regulated businesses see which AI tools their staff use and how risky that is. It is written for law firms, CPA firms, small healthcare practices, and community banks, including shops in Ohio, Kentucky, and West Virginia.

It helps reduce risk. It does not decide whether a firm has met HIPAA, ethics rules, or any other duty, and it does not see devices the firm does not manage.

The paid [Vault](https://vaultsystems.ai) product is for firms that want help putting the controls from this checklist into practice. The quiz ends with a link to get a free Shadow-AI Risk Check from Vault.

## What is in the box

| Piece | What it does |
| --- | --- |
| [`packages/core`](packages/core) | Shared question bank, scoring, AI-service domains, and sensitive-data patterns. Framework-agnostic, so it can move into Vault's private monorepo as `packages/shadow-ai`. |
| [`apps/quiz`](apps/quiz) | About a 10-minute self-assessment. Runs entirely in the browser and downloads a PDF. Intended for [checker.vaultsystems.ai](https://checker.vaultsystems.ai). |
| [`apps/extension`](apps/extension) | Manifest V3 extension for Chrome and Edge (Firefox 115+ can load the same build). Warns on the device when a paste into a known AI site matches a sensitive pattern. |
| [`apps/dns-check`](apps/dns-check) | CLI for IT providers. Reads Pi-hole, dnsmasq, BIND, or CSV query logs and writes a CSV and Markdown report, plus a Pi-hole blocklist and allowlist of the catalog. |

## Privacy model

- **Quiz.** Answers stay in the browser. They are written to this tab's session storage so a refresh does not wipe the page, and they are cleared when the tab closes or when the user deletes them. There is no account, no backend, and no upload.
- **Extension.** Paste text is checked in memory and then dropped. The extension stores anonymous counts only: visits by product name, and warnings by pattern type (SSN, card, email, phone, health hint, client-matter hint). It does not store page contents, prompts, or the pasted text. This version does not make a network call. `apps/extension/src/report-counts.ts` is a stub for a future opt-in dashboard and it does not send anything.
- **DNS check.** It reads a log file you point it at and writes a report next to you. It does not phone home. Client addresses in the report are whatever the log already contained.

An MSP can add `?partner=North%20River%20MSP` to the quiz URL. The name is shown as co-branding and printed on the PDF. It is length-limited and stripped of markup. It is not sent to a server by this project.

## What this does not cover

Unmanaged and personal devices are out of scope. A home laptop, a personal phone on a cellular network, and any browser without the extension will not show up. DNS visibility stops at the resolver you scan: DNS-over-HTTPS that bypasses Pi-hole, and queries from devices that do not use it, are invisible. A quiet report is not proof that sensitive information stayed inside the firm.

Domain lists and pattern matches are incomplete on purpose. Broad company domains such as `google.com` and `microsoft.com` are left out so a blocklist does not knock out ordinary work. Copilot inside desktop Office can be one of those gaps. Meeting bots and document-upload sites are only covered when their own hostnames are in the catalog.

Some states, including New York, Connecticut, and Delaware, require notice before an employer monitors electronic activity. If you install the extension on managed browsers, start from [the employee notice template](apps/extension/EMPLOYEE_NOTICE.md) and the [admin deployment note](apps/extension/ADMIN_DEPLOYMENT.md), and have counsel review them. The templates are not legal advice.

## Quickstart

Requires Node.js 22+ and pnpm 10.

```bash
pnpm install
pnpm test
pnpm build
```

### Quiz

```bash
pnpm dev
```

Open the printed localhost URL. The assessment is one page: start, answer, then download the PDF or follow the Vault link. A static export is produced by:

```bash
pnpm --filter @shadow-ai/quiz build
```

Upload `apps/quiz/out` to any static host. No server and no environment variables. For a co-branded link, use `https://checker.vaultsystems.ai/?partner=Your%20MSP`.

### Browser extension

```bash
pnpm --filter @shadow-ai/extension build
```

In Chrome or Edge, open the extensions page, turn on Developer mode, and load `apps/extension/dist`. Firefox 115+ can load that folder as a temporary add-on from `about:debugging`. Visit a catalog site such as ChatGPT, open the toolbar popup to see the visit count, and paste a fake SSN (`219-09-9999`) to see the on-device warning. The warning does not repeat the pasted text.

Deployment for managed browsers, including the notice you should give staff, is in [apps/extension/ADMIN_DEPLOYMENT.md](apps/extension/ADMIN_DEPLOYMENT.md).

### DNS check

```bash
pnpm --filter @shadow-ai/dns-check exec shadow-ai-dns --help
pnpm --filter @shadow-ai/dns-check exec shadow-ai-dns scan \
  --input apps/dns-check/examples/dnsmasq.log \
  --format pihole \
  --out ./tmp-report
pnpm --filter @shadow-ai/dns-check exec shadow-ai-dns export-lists --out ./tmp-report
```

`scan` accepts:

| `--format` | Input |
| --- | --- |
| `auto` | Sniff CSV, dnsmasq/Pi-hole text, BIND, or a Pi-hole FTL SQLite file |
| `pihole`, `dnsmasq` | `query[A] name from client` lines, including `/var/log/pihole/pihole.log` |
| `bind` | BIND query logs (`query: name IN A`) |
| `csv` | Header row with a domain column (`domain`, `query`, `qname`, `name`, or `host`) |
| `pihole-db` | Pi-hole FTL `queries` table with `domain`, `timestamp`, and `client` |

The text report is `shadow-ai-dns-report.md` plus `shadow-ai-dns-report.csv`. `export-lists` writes `shadow-ai-blocklist.txt` and `shadow-ai-allowlist.txt` for Pi-hole. Review the list before blocking anything. Low-signal names such as Notion are the whole product, not only its AI feature. The allowlist is the same catalog for domains you have decided to permit. It is not a recommendation to allow all of them.

If your Pi-hole version stores client addresses in a different table, export a CSV from the query log and use `--format csv`.

## Roadmap

- An opt-in way for a firm to send anonymous counts to a dashboard. The hook is stubbed and does not open a connection today.
- A store listing and extension id so managed Chrome and Edge policies can force-install a published build.
- More Pi-hole FTL schemas, if client addresses move out of the `queries` table.
- Tighter local-only patterns, still without keeping the text that matched.
- Question-bank edits as firms tell us which questions are actually useful.
- Lifting `packages/core` into Vault's private monorepo as `packages/shadow-ai` without taking the quiz, extension, or CLI along unless we want them.

## License

[MIT](LICENSE) © Vault Systems.

[Contribute](CONTRIBUTING.md) a domain, a pattern, or a clearer question. Please keep the wording honest.
